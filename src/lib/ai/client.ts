import { useAssetStore } from "@/store/useAssetStore";
import { assetLibraryReady } from "@/lib/assets/assetSync";
import { useGenerationStore } from "@/store/useGenerationStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useAdminStore } from "@/store/useAdminStore";
import type { GenerationReport } from "@/types/library";
import { toAssetIndex } from "@/lib/library/retrieval";
import { useProjectStore } from "@/store/useProjectStore";
import { revisionOf } from "@/lib/house/revision";
import { needsInitialGeneration } from "@/lib/house/blank";
import { compileArchitecture } from "@/lib/architecture/compiler";
import { isArchitecturalDesignDocument } from "@/lib/architecture/document";
import { auditHash, documentAudit, primitiveBounds, primitiveSignature } from "@/lib/architecture/renderAudit";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { GenerationMode, Project, TimeOfDay } from "@/types/project";
import { projectModeAuthority, projectModeDisagreementMessage } from "@/lib/v3/projectMode";
import type { V3FailedPreview } from "@/lib/v3/failedPreview";
import { useV3FailedPreviewStore } from "@/store/useV3FailedPreviewStore";

export const STALE_PROJECT_MESSAGE =
  "The project changed while the AI was working, so its edit wasn't applied. Please ask again.";
export const V2_EDIT_UNCHANGED_MESSAGE =
  "This edit did not change the active V2 architecture or Site Plan, so it was not applied.";

export interface HouseEditRequest {
  projectId: string;
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
  /** Untrusted target hint (e.g. from a quick action); the server rebuilds the allowed ops itself. */
  scope?: unknown;
  /** Stable V2 target ids from the current viewport selection, when available. */
  selectedTargetIds?: string[];
  /** Called synchronously, only if the project is still at the revision the request was based on. */
  apply: (summary: string, json: string, debugWriter?: string) => void;
}

export type HouseEditResult =
  | { ok: true; summary: string; generated: boolean; unchanged?: "already-satisfied" | "capability-needed" }
  | { ok: false; error: string; status: number; stale?: boolean };

export interface GenerationModeDiagnostic {
  projectId: string;
  persistedMode: GenerationMode;
  clientResolvedMode: GenerationMode;
  requestMode: GenerationMode;
  serverResolvedMode: GenerationMode | null;
}

/** Resolves from the exact root authority sent to the server and fails closed on a stale record mirror. */
export function resolveClientGenerationMode(project: Pick<Project, "generationMode" | "houseConfigJson">):
  | { ok: true; mode: GenerationMode }
  | { ok: false; error: string } {
  const authority = projectModeAuthority(project);
  const error = projectModeDisagreementMessage(authority);
  return error ? { ok: false, error } : { ok: true, mode: authority.persistedMode };
}

function logGenerationModeDiagnostic(diagnostic: GenerationModeDiagnostic): void {
  if (process.env.NODE_ENV !== "production") console.info("[client-generation]", diagnostic);
}

function fallbackError(status: number): string {
  if (status === 504 || status === 408) return "The AI took too long to respond. Try again, or start with a shorter brief and add detail afterwards.";
  if (status >= 500) return `The server had a problem handling that request (HTTP ${status}). Please try again.`;
  return "AI edit failed.";
}

function v2DocumentOf(json: string) {
  try {
    const root = JSON.parse(json) as Record<string, unknown>;
    const document = root.architecturalDesignDocument ?? root.architectureDocument;
    return isArchitecturalDesignDocument(document) ? document : undefined;
  } catch {
    return undefined;
  }
}

/** V2 edits may change the typed Site Plan without changing house massing. */
function v2EditHash(json: string): string | undefined {
  try {
    const root = JSON.parse(json) as Record<string, unknown>;
    const document = v2DocumentOf(json);
    if (!document) return undefined;
    // These are the V2-rendered/editable authorities. Compatibility house fields are deliberately absent:
    // an edit must not pass merely by changing the legacy shell.
    return JSON.stringify({ document: documentAudit(document).hash, sitePlan: root.sitePlan, outdoorAssetPlacements: root.outdoorAssetPlacements, materials: root.materials, exteriorOptions: root.exteriorOptions });
  } catch {
    return undefined;
  }
}

/** DEV trace at the actual client-side boundary between patch JSON and the V2 compiler. */
function logEdit(stage: "INPUT" | "RESULT" | "COMPILE" | "COMMIT", details: Record<string, unknown>, json?: string): void {
  if (process.env.NODE_ENV === "production") return;
  const document = json ? v2DocumentOf(json) : undefined;
  const docAudit = document ? documentAudit(document) : undefined;
  const base = { configRevision: json ? revisionOf(json) : undefined, documentHash: docAudit?.hash, massCount: docAudit?.massCount ?? 0, operationCount: docAudit?.operationCount ?? 0, ...details };
  console.info(`[EDIT ${stage}]`, base);
  if (stage === "COMPILE" && document) {
    const primitives = compileArchitecture(document, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives;
    console.info("[EDIT COMPILE]", { ...base, primitiveCount: primitives.length, primitiveHash: auditHash(primitives.map(primitiveSignature)), bounds: primitiveBounds(primitives) });
  }
}

/**
 * POSTs one request to /api/ai/house against the project's current JSON and applies the result
 * only if nothing else changed the project in the meantime (optimistic revision check).
 */
export async function requestHouseEdit(req: HouseEditRequest): Promise<HouseEditResult> {
  // Retrieval reads the catalog sent with the request: let the first server load land so it is the server library, not a stale cache.
  await assetLibraryReady();
  const project = useProjectStore.getState().getProject(req.projectId);
  if (!project) return { ok: false, error: "Project not found.", status: 404 };

  const resolved = resolveClientGenerationMode(project);
  if (!resolved.ok) return { ok: false, error: resolved.error, status: 409 };
  const generationMode = resolved.mode;
  // This is intentionally before every network call. It makes the client
  // routing decision visible and auditable before spending an AI request.
  console.info(`[client-generation] resolvedMode: ${generationMode}`);

  const baseJson = project.houseConfigJson;
  const baseRevision = revisionOf(baseJson);
  // A never-designed project's first prompt is a brief for the initial design; every later one is a scoped
  // edit — even if the user has since emptied the design, which must not trigger a regeneration.
  const generate = needsInitialGeneration(project);
  logEdit("INPUT", { projectId: req.projectId, mode: generate ? "generate" : "edit", prompt: req.prompt }, baseJson);

  const res = await fetch("/api/ai/house", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: generate ? "generate" : "edit",
      generationMode,
      projectId: req.projectId,
      prompt: req.prompt,
      currentHouseJson: baseJson,
      baseRevision,
      history: generate ? [] : (req.history ?? []),
      scope: req.scope,
      selectedTargetIds: req.selectedTargetIds,
      assets: useAssetStore.getState().getPBRMaterials().map((a) => ({ id: a.id, name: a.name })),
      libraryAssets: generate ? toAssetIndex(useAssetStore.getState().catalog) : undefined,
    }),
  });
  const serverResolvedMode = res.headers.get("x-ai-architect-resolved-mode") as GenerationMode | null;
  const diagnostic: GenerationModeDiagnostic = {
    projectId: req.projectId,
    persistedMode: generationMode,
    clientResolvedMode: generationMode,
    requestMode: generationMode,
    serverResolvedMode,
  };
  logGenerationModeDiagnostic(diagnostic);
  if (serverResolvedMode && serverResolvedMode !== generationMode) {
    return { ok: false, error: `Generation mode disagreement: client requested ${generationMode}, but server resolved ${serverResolvedMode}. Generation was blocked.`, status: 409 };
  }
  // A gateway timeout or crash answers with a non-JSON page: report what happened instead of a parse error.
  const data = (await res.json().catch(() => ({}))) as { summary?: string; json?: string; timeOfDay?: TimeOfDay; error?: string; intelligence?: GenerationReport; outcome?: "already-satisfied" | "capability-needed"; v3FailedPreview?: V3FailedPreview };

  if (!res.ok || typeof data.json !== "string") {
    // Failed previews are held only in an ephemeral dev store. There is no
    // project-store write and no call to `apply` on this path.
    if (process.env.NODE_ENV !== "production" && generationMode === "v3-scene" && data.v3FailedPreview) {
      useV3FailedPreviewStore.getState().capture(req.projectId, data.v3FailedPreview);
    }
    return { ok: false, error: data.error ?? fallbackError(res.status), status: res.status };
  }

  logEdit("RESULT", { projectId: req.projectId, mode: generate ? "generate" : "edit", summary: data.summary ?? "AI edit" }, data.json);
  const live = useProjectStore.getState().getProject(req.projectId);
  if (!live || revisionOf(live.houseConfigJson) !== baseRevision) {
    return { ok: false, error: STALE_PROJECT_MESSAGE, status: 409, stale: true };
  }

  const baseDocument = v2DocumentOf(baseJson);
  // A validated V2 no-op is a successful answer, but deliberately creates no project version.
  if (!generate && data.outcome) {
    logEdit("COMMIT", { projectId: req.projectId, accepted: true, reason: data.outcome }, data.json);
    return { ok: true, summary: data.summary ?? "No project changes were needed.", generated: false, unchanged: data.outcome };
  }
  if (!generate && baseDocument && v2EditHash(baseJson) === v2EditHash(data.json)) {
    logEdit("COMMIT", { projectId: req.projectId, accepted: false, reason: "active-v2-document-unchanged" }, data.json);
    return { ok: false, error: V2_EDIT_UNCHANGED_MESSAGE, status: 422 };
  }
  logEdit("COMPILE", { projectId: req.projectId, mode: generate ? "generate" : "edit" }, data.json);

  const summary = data.summary ?? "AI edit";
  // What the learning loop found and stored for this generation: kept here too, for the admin (see useGenerationStore).
  if (generate && data.intelligence) {
    useGenerationStore.getState().record(data.intelligence);
    // The report is history; the persisted library is the live Admin state. Refresh
    // it as soon as the completed post-generation write reaches this browser.
    const adminEmail = useAdminStore.getState().adminEmail;
    if (data.intelligence.persistence.ok && adminEmail) void useLibraryStore.getState().refresh(adminEmail);
  }
  logEdit("COMMIT", { projectId: req.projectId, accepted: true, writer: generate ? "ai-initial-generation" : "ai-followup-edit" }, data.json);
  req.apply(summary, data.json, generate ? "ai-initial-generation" : "ai-followup-edit");
  if (generate && data.timeOfDay) useProjectStore.getState().setTimeOfDay(req.projectId, data.timeOfDay);
  return { ok: true, summary, generated: generate };
}
