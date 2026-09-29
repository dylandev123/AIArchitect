import { useAssetStore } from "@/store/useAssetStore";
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
import type { TimeOfDay } from "@/types/project";

export const STALE_PROJECT_MESSAGE =
  "The project changed while the AI was working, so its edit wasn't applied. Please ask again.";
export const V2_EDIT_UNCHANGED_MESSAGE =
  "This edit did not change the active V2 architectural document, so it was not applied as an architectural revision.";

export interface HouseEditRequest {
  projectId: string;
  prompt: string;
  history?: { role: "user" | "assistant"; content: string }[];
  /** Untrusted target hint (e.g. from a quick action); the server rebuilds the allowed ops itself. */
  scope?: unknown;
  /** Called synchronously, only if the project is still at the revision the request was based on. */
  apply: (summary: string, json: string, debugWriter?: string) => void;
}

export type HouseEditResult =
  | { ok: true; summary: string; generated: boolean }
  | { ok: false; error: string; status: number; stale?: boolean };

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
  const project = useProjectStore.getState().getProject(req.projectId);
  if (!project) return { ok: false, error: "Project not found.", status: 404 };

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
      projectId: req.projectId,
      prompt: req.prompt,
      currentHouseJson: baseJson,
      baseRevision,
      history: generate ? [] : (req.history ?? []),
      scope: req.scope,
      assets: useAssetStore.getState().getPBRMaterials().map((a) => ({ id: a.id, name: a.name })),
      libraryAssets: generate ? toAssetIndex(useAssetStore.getState().catalog) : undefined,
    }),
  });
  // A gateway timeout or crash answers with a non-JSON page: report what happened instead of a parse error.
  const data = (await res.json().catch(() => ({}))) as { summary?: string; json?: string; timeOfDay?: TimeOfDay; error?: string; intelligence?: GenerationReport };

  if (!res.ok || typeof data.json !== "string") {
    return { ok: false, error: data.error ?? fallbackError(res.status), status: res.status };
  }

  logEdit("RESULT", { projectId: req.projectId, mode: generate ? "generate" : "edit", summary: data.summary ?? "AI edit" }, data.json);
  const live = useProjectStore.getState().getProject(req.projectId);
  if (!live || revisionOf(live.houseConfigJson) !== baseRevision) {
    return { ok: false, error: STALE_PROJECT_MESSAGE, status: 409, stale: true };
  }

  const baseDocument = v2DocumentOf(baseJson);
  const resultDocument = v2DocumentOf(data.json);
  if (!generate && baseDocument && documentAudit(baseDocument).hash === (resultDocument ? documentAudit(resultDocument).hash : undefined)) {
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
