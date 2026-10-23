import { V3_INITIAL_MAX_OUTPUT_TOKENS, V3_STRUCTURED_OUTPUT_RAW_PREVIEW_MAX_CHARS } from '@/lib/ai/v3GenerationLimits';
import { v3ConsistencyRepairInstructions } from '@/lib/v3/designConsistency';
import { assessV3Revision, assessV3ObjectiveRevision } from '@/lib/v3/safeRevision';
import { retainV3RevisionArtifact } from '@/lib/ai/v3FailureArtifact';
import type { V3TerrainMode } from "@/lib/v3/terrainMode";
import { retainV3FailureArtifact } from "@/lib/ai/v3FailureArtifact";
import { V3_COMPOSITION_PROMPT } from "@/lib/v3/composition";
import { reviewV3Architecture, v3DesignRepairInstructions } from "@/lib/v3/designReview";
import { NextRequest, NextResponse } from "next/server";
import { generateText, JSONParseError, NoObjectGeneratedError, Output, TypeValidationError } from "ai";
import { buildPatchResponseSchema, validateOperations } from "@/lib/ai/siteSchema";
import { buildScopedSystemPrompt } from "@/lib/ai/systemPrompt";
import { buildScopeContext } from "@/lib/ai/context";
import { partitionOpsForScope, scopeFromHint, WORLD_SCOPE } from "@/lib/ai/targeting";
import type { AssetRef } from "@/lib/ai/capabilities";
import { applyPatch } from "@/lib/house/applyPatch";
import { resolveSiteCollisions } from "@/lib/house/architecture/siteCollisions";
import { revisionOf } from "@/lib/house/revision";
import { isBlankSite } from "@/lib/house/blank";
import { AI_NOT_CONFIGURED_MESSAGE, AI_PROVIDER_OPTIONS, getAiModel, getAiModelId, isAiConfigured } from "@/lib/ai/model";
import { createTimings } from "@/lib/ai/timing";
import { withUsageLogging, type UsageMeta } from "@/lib/ai/usage/track";
import { describeEditGoalSummary, summarizeEditGoals } from "@/lib/architecture/editGoals";
import { auditCirculation } from "@/lib/architecture/circulationAudit";
import { recipeRetrievalForSpaces, recordPriorityAssetNeed, recordArchitectVocabularyCapabilityNeed, recordSpatialReflowCapabilityNeed, roofRecipesForBrief } from "@/lib/library/service";
import { extractContextTags, extractStyleTags } from "@/lib/library/taxonomy";
import { readLibrary } from "@/lib/library/store";
import { assetBackend } from "@/lib/assets/serverStore";
import { toAssetIndex } from "@/lib/library/retrieval";
import { planOutdoorSpaces } from "@/lib/outdoor/spaces";
import { inferSiteHints } from "@/lib/house/siteSettings";
import { INITIAL_CAPABILITIES } from "@/lib/library/capabilities";
import type { AssetIndexEntry } from "@/lib/library/retrieval";
import { isArchitecturalDesignDocument, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument } from "@/lib/architecture/document";
import { compileArchitecture } from "@/lib/architecture/compiler";
import { runDesignQualityGate } from "@/lib/architecture/stages/qualityGate";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { runArchitecturePipeline, type PipelineInput, type PipelineResult, type PipelineStageEvent } from "@/lib/architecture/stages/pipeline";
import { architectureGenerationMode } from "@/lib/architecture/stages/generationMode";
import type { StageDiagnostics } from "@/lib/architecture/stages/diagnostics";
import { setDevSession } from "@/lib/architecture/stages/devSessionCache";
import { runFinalAssembly } from "@/lib/ai/finalAssembly";
import { sitePlanContextForDocument } from "@/lib/architecture/sitePlanContext";
import { runSitePlanStage } from "@/lib/architecture/stages/sitePlanStage";
import { sitePlanAuthorityHash } from "@/lib/architecture/stages/authority";
import { isV2GenerationFailure } from "@/lib/architecture/stages/recovery";
import { v2FailureResponse } from "@/lib/ai/v2Failure";
import { logV3ProviderRequestRejection, providerErrorResponse } from "@/lib/ai/providerErrors";
import { placeV2AdditiveAsset } from "@/lib/architecture/v2AdditivePlacement";
import { routeV2FollowUp } from "@/lib/architecture/v2AdditiveObjects";
import { runArchitectEditStage } from "@/lib/architecture/stages/architectStage";
import { architecturalEditDiff, describeArchitecturalEditDiff } from "@/lib/architecture/stages/architectEditDiff";
import { architectureAuthorityHash } from "@/lib/architecture/stages/authority";
import { runV2IntegrityGate } from "@/lib/architecture/stages/integrityGate";
import type { OutdoorAssetPlacement, OutdoorAssetTombstone } from "@/lib/outdoor/placements";
import { materializeGeneratedAssets } from "@/lib/outdoor/ownership";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { persistentFurniturePlacements } from "@/lib/landscaping/furniture";
import { sitePlanSchema, type SitePlan } from "@/lib/architecture/sitePlanContract";
import { reconcileSitePlanExecution } from "@/lib/architecture/stages/reconcileSitePlanExecution";
import { spatialReflowDiff } from "@/lib/architecture/stages/spatialReflow";
import { computeCostUsd } from "@/lib/ai/pricing";
import { isV3ProjectRoot, type V3Scene } from "@/lib/v3/scene";
import { executeV3SceneOperations } from "@/lib/v3/operations";
import { v3SceneArchitectPrompt } from "@/lib/v3/schema";
import { summarizeV3Generation } from "@/lib/v3/generation";
import { recoverV3FailedPreview } from "@/lib/v3/failedPreview";
import { ingestV3GenerationOutput } from "@/lib/v3/ingestion";
import { v3BlueprintFirstEnabled, V3_BLUEPRINT_REPAIR_PROMPT } from '@/lib/v3/blueprintGeneration';
import type { V3BlueprintApproval } from '@/lib/v3/blueprintApproval';
import { isV3PlanEvaluation } from '@/lib/v3/architecturalPlanEvaluation';
import { splitV3ArchitecturalBlueprint } from '@/lib/v3/architecturalPlanFirst';
import type { V3ArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprint';
import { generateV3FromArchitecturalBlueprint, v3ArchitecturalBlueprintEnabled, v3ArchitecturalBlueprintPrompt } from '@/lib/v3/architecturalBlueprintGeneration';
import { fingerprint } from "@/lib/ai/usage/diagnostics";
import type { UsageAssessment } from "@/lib/ai/usage/track";
import { randomUUID } from 'node:crypto';

/** Seconds. A mansion brief needs one 30-40 s model call, and a repair pass can need a second. */
export const maxDuration = 300;
/** Stop waiting for the model this long into the request, leaving room to answer before the platform kills the function. */
const GENERATION_BUDGET_MS = 270_000;
/**
 * The architecture sub-pipeline (Intent/Site Strategy/Primary Mass, Mass Expansion, Roof Composition) shares
 * this request's budget with the mandatory final design call below it — a call that decides facade,
 * materials, openings and outdoor siting and cannot be skipped. Without a reserved floor, a slow sub-pipeline
 * (retries, a slow provider) can eat nearly the whole budget and leave the final call under 1s, guaranteeing
 * it times out. Reserving time up front for the piece that must run last is what actually fixes that timeout,
 * not just running the sub-pipeline faster.
 */
const FINAL_ASSEMBLY_RESERVE_MS = 90_000;
const STAGE_PIPELINE_BUDGET_MS = GENERATION_BUDGET_MS - FINAL_ASSEMBLY_RESERVE_MS;

const MAX_HISTORY_TURNS = { world: 12, zone: 6, component: 4 } as const;
const MAX_OUTPUT_TOKENS = { world: 8000, zone: 4000, component: 2000 } as const;
const MAX_ASSETS = 40;
/** V3 is a bounded scene response, deliberately independent of V2's budgets. */

/** Shared usage/log output stays a preview; full failure artifacts are development-local only. */

const V3_STRUCTURED_OUTPUT_MAX_ISSUES = 4;
const V3_STRUCTURED_OUTPUT_VALUE_MAX_CHARS = 180;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  /** "generate" creates the initial design of a blank project; anything else is a scoped edit. */
  mode?: "generate" | "edit";
  /** Only used to attribute AI usage; never trusted for anything else. */
  projectId?: string;
  prompt?: string;
  currentHouseJson?: string;
  /** Revision (see revisionOf) of `currentHouseJson` as the client read it. */
  baseRevision?: string;
  history?: ChatTurn[];
  /** Untrusted hint about what the edit targets; the op allow-list is always rebuilt server-side. */
  scope?: unknown;
  /** Optional stable V2 target ids from the viewport selection; validated against the server catalog. */
  selectedTargetIds?: unknown;
  /** Imported PBR materials the model may reference by id. */
  assets?: AssetRef[];
  /** Explicit opt-in transport flag. Existing V2 requests omit it. */
  generationMode?: "v2-architectural" | "v3-scene";
  v3TerrainMode?: V3TerrainMode;
}

function parseAssets(raw: unknown): AssetRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is AssetRef => typeof a?.id === "string" && typeof a?.name === "string")
    .slice(0, MAX_ASSETS)
    .map((a) => ({ id: a.id, name: a.name.slice(0, 60) }));
}

function parseProjectId(raw: unknown): string | null {
  return typeof raw === "string" && /^[\w-]{1,64}$/.test(raw) ? raw : null;
}

type ResolvedGenerationMode = "v2-architectural" | "v3-scene";

/**
 * The root's V3 sentinel is durable project authority; the request mode is a
 * consistency check, never permission to reinterpret a project as V2.
 */
function resolveGenerationMode(requested: unknown, root: Record<string, unknown>): { mode: ResolvedGenerationMode } | { error: string } {
  if (requested !== undefined && requested !== "v2-architectural" && requested !== "v3-scene") {
    return { error: "Unknown generation mode. Expected v2-architectural or v3-scene." };
  }
  const rootIsV3 = isV3ProjectRoot(root);
  if (!rootIsV3 && (root.generationMode === "v3-scene" || root.v3Scene !== undefined)) return { error: "V3 routing/configuration error: malformed V3 authority cannot route into V2." };
  if (rootIsV3 && requested === "v2-architectural") {
    return { error: "V3 project routing conflict: a V3 scene project cannot invoke V2 generation." };
  }
  if (!rootIsV3 && requested === "v3-scene") {
    return { error: "V3 routing/configuration error: the persisted project is not a valid V3 scene root." };
  }
  return { mode: rootIsV3 ? "v3-scene" : "v2-architectural" };
}

/** Lets the client audit the mode the server resolved without changing its payload contract. */
function withResolvedGenerationMode(response: NextResponse, mode: ResolvedGenerationMode): NextResponse {
  response.headers.set("x-ai-architect-resolved-mode", mode);
  return response;
}

type V3SchemaIssue = { path?: unknown; message?: unknown; expected?: unknown; received?: unknown; input?: unknown };

export type V3StructuredOutputFailure = {
  code: "V3_MODEL_OUTPUT_INVALID" | "V3_OUTPUT_TRUNCATED" | "V3_MODEL_JSON_INVALID";
  finishReason?: string;
  error: string;
  cause: string;
  jsonParsingFailed: boolean;
  issues: Array<{ path?: string; message: string; expected?: string; received?: string }>;
  rawPreview?: string;
  outputFingerprint?: string;
};

function boundedV3Value(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  let text: string;
  try { text = typeof value === "string" ? value : JSON.stringify(value); } catch { text = String(value); }
  return redactV3DiagnosticText(text).slice(0, V3_STRUCTURED_OUTPUT_VALUE_MAX_CHARS);
}

/** Keeps model text useful for diagnosis while preventing credentials or request transport data reaching logs. */
function redactV3DiagnosticText(text: string): string {
  return redactV3HeaderObjects(text)
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/([\"']?(?:(?:x-)?api[_-]?key|authorization|cookie|password|secret|token)[\"']?\s*[:=]\s*[\"']?)[^\"'\s,}\]]+/gi, "$1[REDACTED]");
}

/** Removes whole header objects (including nested values) from arbitrary, possibly malformed model text. */
function redactV3HeaderObjects(text: string): string {
  const headerStart = /([\"']?headers?[\"']?\s*[:=]\s*)\{/gi;
  let result = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = headerStart.exec(text))) {
    result += text.slice(cursor, match.index) + `${match[1]}[REDACTED_HEADERS]`;
    let index = headerStart.lastIndex;
    let depth = 1;
    let quote = "";
    while (index < text.length && depth > 0) {
      const char = text[index++];
      if (quote) {
        if (char === "\\") index++;
        else if (char === quote) quote = "";
      } else if (char === "\"" || char === "'") quote = char;
      else if (char === "{") depth++;
      else if (char === "}") depth--;
    }
    cursor = index;
    headerStart.lastIndex = index;
  }
  return result ? result + text.slice(cursor) : text;
}

function boundedV3RawPreview(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const safe = redactV3DiagnosticText(text);
  if (safe.length <= V3_STRUCTURED_OUTPUT_RAW_PREVIEW_MAX_CHARS) return safe;
  const head = 1_400;
  const tail = 500;
  // The marker is deliberately inside the published cap too (its longest practical form is < 148 chars).
  return `${safe.slice(0, head)}…[+${safe.length - head - tail} chars]…${safe.slice(-tail)}`.slice(0, V3_STRUCTURED_OUTPUT_RAW_PREVIEW_MAX_CHARS);
}

function pathOf(issue: V3SchemaIssue): string | undefined {
  if (typeof issue.path === "string") return issue.path;
  if (Array.isArray(issue.path)) return issue.path.map(String).join(".");
  return undefined;
}

/**
 * Extract only the AI SDK's structured-output evidence. This deliberately never serializes a request,
 * provider headers, or an arbitrary error message, all of which may contain credentials.
 */
function describeV3StructuredOutputFailure(error: unknown): V3StructuredOutputFailure | undefined {
  if (!NoObjectGeneratedError.isInstance(error)) return undefined;
  const cause = error.cause;
  const jsonParsingFailed = JSONParseError.isInstance(cause);
  const validationIssues = TypeValidationError.isInstance(cause)
    ? (cause.cause as { issues?: unknown } | undefined)?.issues
    : undefined;
  const issues = Array.isArray(validationIssues)
    ? validationIssues.slice(0, V3_STRUCTURED_OUTPUT_MAX_ISSUES).map((candidate) => {
      const issue = (candidate && typeof candidate === "object" ? candidate : {}) as V3SchemaIssue;
      return {
        ...(pathOf(issue) ? { path: pathOf(issue) } : {}),
        message: redactV3DiagnosticText(typeof issue.message === "string" ? issue.message : "validation issue"),
        ...(boundedV3Value(issue.expected) ? { expected: boundedV3Value(issue.expected) } : {}),
        ...(boundedV3Value(issue.received ?? issue.input) ? { received: boundedV3Value(issue.received ?? issue.input) } : {}),
      };
    }) : [];
  const rawPreview = boundedV3RawPreview(error.text);
  const code = error.finishReason === "length"
    ? "V3_OUTPUT_TRUNCATED"
    : jsonParsingFailed
      ? "V3_MODEL_JSON_INVALID"
      : "V3_MODEL_OUTPUT_INVALID";
  return {
    code,
    ...(typeof error.finishReason === "string" ? { finishReason: error.finishReason } : {}),
    error: error.name || "NoObjectGeneratedError",
    cause: cause instanceof Error && cause.name ? cause.name : "unknown",
    jsonParsingFailed,
    issues,
    ...(rawPreview ? { rawPreview, outputFingerprint: fingerprint(error.text ?? "") } : {}),
  };
}

function v3StructuredOutputUsageAssessment(error: unknown): UsageAssessment {
  const failure = describeV3StructuredOutputFailure(error);
  if (!failure) return {};
  const issueSummary = failure.issues.map((issue) => `${issue.path ?? "(root)"}: ${issue.message}`).join("; ");
  return {
    errorKind: failure.code.toLowerCase(),
    ...(failure.finishReason ? { finishReason: failure.finishReason } : {}),
    outputFingerprint: failure.outputFingerprint,
    diagnostic: [
      `code=${failure.code}`,
      `error=${failure.error}`,
      `cause=${failure.cause}`,
      `jsonParsingFailed=${failure.jsonParsingFailed}`,
      ...(issueSummary ? [`issues=${issueSummary}`] : []),
    ].join(" "),
    // The existing bounded candidate field keeps this compact V3-only evidence without storing a full response.
    candidate: JSON.stringify({ kind: "v3-structured-output-failure", ...failure }),
  };
}

function logV3StructuredOutputFailure(error: unknown): V3StructuredOutputFailure | undefined {
  const failure = describeV3StructuredOutputFailure(error);
  if (failure && process.env.NODE_ENV !== "production") {
    console.warn("[v3-contract] structured output failed", {
      finishReason: failure.finishReason,
      error: failure.error,
      cause: failure.cause,
      jsonParsingFailed: failure.jsonParsingFailed,
      issues: failure.issues,
      rawPreview: failure.rawPreview,
    });
  }
  return failure;
}

/** Safe flag diagnostics: no model, project data, credentials or provider call. */
export async function GET() {
  return NextResponse.json({
    architecturalBlueprint: {
      enabledForNewFlatGenerations: v3ArchitecturalBlueprintEnabled(process.env.AI_V3_ARCHITECTURAL_BLUEPRINT, 'flat'),
      contract: 'v3-plan-first-1',
      maxAuthoringAttempts: 2,
      maxOutputTokens: V3_INITIAL_MAX_OUTPUT_TOKENS,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
  }

  const currentHouseJson = typeof body.currentHouseJson === "string" ? body.currentHouseJson : "{}";
  const baseRevision = revisionOf(currentHouseJson);
  if (typeof body.baseRevision === "string" && body.baseRevision !== baseRevision) {
    return NextResponse.json(
      { error: "The project changed before the request arrived. Please try again." },
      { status: 409 }
    );
  }

  let root: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(currentHouseJson);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object");
    root = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Current project JSON is invalid; cannot apply edits." }, { status: 400 });
  }

  const assets = parseAssets(body.assets);
  const projectId = parseProjectId(body.projectId);
  const resolvedMode = resolveGenerationMode(body.generationMode, root);
  if ("error" in resolvedMode) return NextResponse.json({ error: resolvedMode.error, code: "GENERATION_MODE_ROUTING_ERROR" }, { status: 409 });

  // V3 is an entirely separate scene authority. It deliberately enters before every V2 document/router branch.
  if (resolvedMode.mode === "v3-scene") {
    console.info("[generation] generationMode: v3-scene");
    if(isV3ProjectRoot(root)&&isV3PlanEvaluation(root.v3Scene))return withResolvedGenerationMode(NextResponse.json({error:"Use Edit and save 2D plan for local changes, or Build in 3D for a separate exterior call."},{status:409}),resolvedMode.mode);
    if (!isAiConfigured()) return withResolvedGenerationMode(NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 }), resolvedMode.mode);
    if (body.mode === "generate" && body.v3TerrainMode !== undefined && body.v3TerrainMode !== "flat" && body.v3TerrainMode !== "advanced") return withResolvedGenerationMode(NextResponse.json({ error: "Unknown V3 terrain mode." }, { status: 400 }), resolvedMode.mode);
    const response = body.mode === "generate"
      ? generateV3Scene(prompt, root, baseRevision, projectId, body.v3TerrainMode ?? "flat")
      : editV3Scene(prompt, root, baseRevision, projectId, Array.isArray(body.selectedTargetIds) ? body.selectedTargetIds.filter((id): id is string => typeof id === "string").slice(0, 8) : []);
    return withResolvedGenerationMode(await response, resolvedMode.mode);
  }

  // Additive V2 placement is a deterministic executor, not an architecture-generation call.
  const activeDocument = root.architecturalDesignDocument ?? root.architectureDocument;
  if (body.mode !== "generate" && isArchitecturalDesignDocument(activeDocument)) {
    // Only a recognized loose asset takes the deterministic placer; everything else (architecture, changes to existing
    // things, and requests whose noun no list knows) goes to the same AI Architect, editing its saved document.
    if (routeV2FollowUp(prompt).route === "architect") {
      if (!isAiConfigured()) return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
      return editV2Architecture(prompt, root, activeDocument, currentHouseJson, baseRevision, projectId, Array.isArray(body.selectedTargetIds) ? body.selectedTargetIds.filter((id): id is string => typeof id === "string").slice(0, 8) : undefined);
    }
    return editV2SiteFeature(prompt, root, baseRevision, projectId);
  }

  if (!isAiConfigured()) {
    return withResolvedGenerationMode(NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 }), resolvedMode.mode);
  }

  if (body.mode === "generate") {
    // Generation only ever starts from a blank project; an existing design is never regenerated here.
    if (!isBlankSite(currentHouseJson)) {
      return NextResponse.json(
        { error: "This project already has a design. Describe what to change instead of generating a new one." },
        { status: 409 }
      );
    }
    const generationMode = architectureGenerationMode();
    console.info(`[generation] generationMode: ${generationMode}`);
    const usageMeta: UsageMeta = { projectId, requestType: "generation", scope: WORLD_SCOPE.level, model: getAiModelId(), generationMode };
    // Live progressive generation: the viewport can watch masses and roofs appear one at a time. Any caller that
    // doesn't ask for this (including every existing test) gets the exact same single JSON response as before.
    if (req.headers.get("accept")?.includes("text/event-stream")) {
      return withResolvedGenerationMode(await streamInitialDesign(prompt, assets, baseRevision, usageMeta), resolvedMode.mode);
    }
    return withResolvedGenerationMode(await generateInitialDesign(prompt, assets, baseRevision, usageMeta), resolvedMode.mode);
  }

  const scope = scopeFromHint(body.scope, prompt);
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS[scope.level]) : [];
  const context = buildScopeContext(root, scope, prompt);
  if (context.blocked) return NextResponse.json({ error: context.blocked }, { status: 422 });

  try {
    const { output } = await withUsageLogging(
      { projectId, requestType: "scoped_edit", scope: scope.level, model: getAiModelId() },
      () =>
        generateText({
          model: getAiModel(),
          maxOutputTokens: MAX_OUTPUT_TOKENS[scope.level],
          system: buildScopedSystemPrompt(scope, assets),
          messages: [
            ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
            { role: "user" as const, content: context.userMessage },
          ],
          output: Output.object({
            schema: buildPatchResponseSchema(scope, assets.map((a) => a.id)),
          }),
          providerOptions: AI_PROVIDER_OPTIONS,
        })
    );

    // Payloads are validated locally against the per-op schemas; invalid ops are never applied.
    const assetIds = assets.map((a) => a.id);
    const { valid, invalid } = validateOperations(output.operations, scope, assetIds);

    // Out-of-scope, off-target, or invented-id ops are dropped: never applied, never used as a fallback.
    const { allowed, rejected } = partitionOpsForScope(valid, scope, context.targetIds, context.roomGuard);
    rejected.unshift(...invalid);
    if (rejected.length > 0) {
      console.warn(`[AI] Rejected ops (${scope.level}/${scope.label}):`, rejected);
    }
    if (allowed.length === 0) {
      return NextResponse.json(
        { error: "The AI didn't produce any valid edit for that request. Try rephrasing it, or name what you want changed." },
        { status: 422 }
      );
    }

    // Features this edit adds must not land on anything: they move to the nearest clear spot, or the edit is refused.
    // What the project already has is never moved, and neither are existing features the edit does not name.
    const spatial = resolveSiteCollisions({ ops: allowed, existing: context.root });
    if (spatial.errors.length > 0) {
      return NextResponse.json(
        { error: `That would overlap something already on the site: ${spatial.errors[0]} Try describing where it should go.` },
        { status: 422 }
      );
    }

    const { json, errors } = applyPatch(JSON.stringify(context.root), spatial.ops);
    if (errors.length > 0) {
      console.error("AI patch application failed:", errors);
      return NextResponse.json(
        { error: `Couldn't apply that edit cleanly: ${errors[0]}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      summary: output.summary,
      json,
      baseRevision,
      revision: revisionOf(json),
      scope: { level: scope.level, label: scope.label },
      skipped: rejected,
      adjusted: spatial.relocated,
    });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return NextResponse.json(
        { error: "The AI's response didn't match the edit schema. Try rephrasing your request." },
        { status: 502 }
      );
    }
    console.error("AI house generation failed:", error);
    return providerErrorResponse(error);
  }
}

/** One authoritative Terra call for V3. A single repair may correct objective contract failures, never redesign it. */
async function generateV3Scene(prompt: string, root: Record<string, unknown>, baseRevision: string, projectId: string | null, terrainMode: V3TerrainMode) {
  if(v3ArchitecturalBlueprintEnabled(process.env.AI_V3_ARCHITECTURAL_BLUEPRINT,terrainMode)){
    const response=await generateArchitecturalBlueprintV3(prompt,baseRevision,projectId);
    response.headers.set('x-ai-architect-pipeline','v3-architectural-blueprint-1');
    return response;
  }
  const blueprintFirst = v3BlueprintFirstEnabled(process.env.AI_V3_BLUEPRINT_FIRST, terrainMode);
  const systemPrompt = v3SceneArchitectPrompt(terrainMode, { blueprintFirst });
  let approvedBlueprint: V3BlueprintApproval | undefined;
  let billedInput=0,billedOutput=0,billedTotal=0,billedCost=0;
  // At most one follow-up call: either an objective validation repair or, for a valid scene with genuine conflicts, one targeted revision.
  const run = async (repair?: { kind: "objective" | "design"; items: readonly string[]; plan: unknown }) => { const value=await withUsageLogging(
    { projectId, requestType: "generation", scope: WORLD_SCOPE.level, model: getAiModelId(), generationMode: "v3-scene", stage: !repair ? "v3-scene-architect" : repair.kind === "design" ? "v3-scene-design-repair" : "v3-scene-repair", retryNumber: repair ? 1 : 0, retryReason: !repair ? undefined : repair.kind === "design" ? "architectural-composition-review" : "objective-scene-validation", maxOutputTokens: V3_INITIAL_MAX_OUTPUT_TOKENS },
    // JSON mode asks the provider for JSON but deliberately supplies no exact
    // schema. The SDK may reject malformed JSON; our ingestion boundary owns
    // all normalization and canonical structural validation after parsing.
    () => generateText({ model: getAiModel(), maxOutputTokens: V3_INITIAL_MAX_OUTPUT_TOKENS, system: systemPrompt, messages: [{ role: "user", content: !repair ? prompt
      : repair.kind === "objective" ? `Repair this same scene plan only. Correct only diagnosed technical fields and geometric relationships. For diagnosed access gaps on standalone paths change only the named path extent/position, retaining the destination buildings and doors. For a diagnosed spatial route change only its local endpoint coordinates or bends, preserving endpoint object/opening ids, width and use; its owner box is derived. For a diagnosed missing site-access identity, add only its boundary record at the already authored endpoint coordinate; never choose a new gate location. For allocation conflicts change only the explicitly diagnosed reserved zone allocation within the site; preserve mode, membership and commitments. Derived zone measurements are never authored or repaired. For diagnosed stair usability failures correct only that circulation entry footprint/location or stairType/direction/turn; preserve its id, host, intended origin/destination levels and every unrelated staircase. Only invalid level ranges may correct levels. Never delete stairs, remove requirements, change floor datums or move architecture to silence a failure. For site overruns correct only the named non-building object extent. A joined composition requires touching geometry: correct only a diagnosed non-building member, never delete the claim. Threshold and inferred outdoor-access concerns are advisory; do not invent a redesign. Preserve object ids, materials, estatePlan intent, footprint family and segment/operation ids, all unrelated openings, geometry and relationships. An incompatible footprint roof may change only roofForm/pitch/overhang to flat, terrace, floating-flat or mono-pitch if the brief permits. Never replace a curved footprint with a rectangle, remove a required roof, or erase explicit unsupported user intent. Objective failures: ${JSON.stringify(repair.items)}\nOriginal brief: ${prompt}\nCurrent plan: ${JSON.stringify(repair.plan ?? root.v3Scene)}`
      : `Revise this same valid scene plan to resolve the architectural review findings below. Fix only the identified conflict. Preserve all existing object identities, mass positions/dimensions, roof families, materials, unrelated openings and assemblies, and site relationships. Collision counterpart ids are evidence, not permission to remodel them. Move or resize only the conflicting amenity; for an entry change only its door facade; for a balcony assembly change only that assembly facade. Add only an explicitly missing requested feature or an estate-plan object with its exact planned id. For estate access or relationship findings append only the missing planned relationship edges. Preserve estatePlan; never erase commitments to silence warnings. For a diagnosed spatial route conflict only, correct that route spatial.from, spatial.to or spatial.waypoints while preserving its ids, width, use and all other plan entries. For ESTATE_ACCESS_POINT_MISSING on a mass append only a ground door/glazed-door if necessary. For a missing site-access identity add only its boundary record at the already authored endpoint coordinate; never choose a new gate location. Never simplify unsupported architectural forms. For a completeness finding add only the missing access: a top-level circulation entry (stair or lift) inside the named host, door or glazed-door openings appended to that mass's existing openings, or terraceOpenEdges on that terrace. Never move masses, change roofs or materials, or rewrite existing openings to make room. Do not restart or restyle the design. Architectural review: ${JSON.stringify(repair.items)}\nOriginal brief: ${prompt}\nCurrent plan: ${JSON.stringify(repair.plan)}` }], output: Output.json({ name: "v3_scene" }), providerOptions: AI_PROVIDER_OPTIONS }),
    (outcome) => "error" in outcome ? v3StructuredOutputUsageAssessment(outcome.error) : {}
  );
    billedInput+=value.totalUsage.inputTokens??0;billedOutput+=value.totalUsage.outputTokens??0;billedTotal+=value.totalUsage.totalTokens??0;
    billedCost+=computeCostUsd(getAiModelId(),{inputTokens:value.totalUsage.inputTokens??0,outputTokens:value.totalUsage.outputTokens??0,cachedInputTokens:value.totalUsage.inputTokenDetails?.cacheReadTokens??0})??0;
    return value;
  };
  let attempt: 0 | 1 = 0;
  const ingest = async (result: Awaited<ReturnType<typeof run>>) => {
    // Snapshot before normalization/repair can touch provider-owned values.
    const raw = process.env.NODE_ENV === "development" ? (result.text ?? JSON.stringify(result.output)) : undefined;
    try {
      if(result.finishReason==='length')throw new Error("V3_OUTPUT_TRUNCATED: repair reached output limit; no partial scene accepted.");
      const prepared = ingestV3GenerationOutput(result.output, terrainMode, { requireDesignConsistency: true, requireBlueprint: blueprintFirst, approvedBlueprint });
      if (!prepared.ok) await retainV3FailureArtifact(raw, attempt, "ingestion", raw === undefined ? undefined : {
        terrainMode,
        decision: attempt === 0 ? "repair-requested" : "rejected",
        errors: [...prepared.validation.errors, ...(prepared.geometryAudit?.errors ?? [])],
        warnings: [...prepared.validation.warnings, ...(prepared.geometryAudit?.warnings ?? [])],
        notes: prepared.notes,
        omitted: prepared.notes.filter((note) => note.code.endsWith("_OMITTED") || note.code === "COMPOSITION_FALLBACK"),
        normalizedScene: prepared.scene,
      });
      return prepared;
    } catch (error) {
      await retainV3FailureArtifact(raw, attempt, "ingestion", { terrainMode, decision: "rejected", errors: [], warnings: [], notes: [], omitted: [] });
      throw error;
    }
  };
  try {
    let result = await run();
    if(result.finishReason==='length')return NextResponse.json({error:"Terra's V3 response reached its output limit; no incomplete scene was accepted.",code:"V3_OUTPUT_TRUNCATED"},{status:502});
    let prepared = await ingest(result);
    approvedBlueprint = prepared.blueprintApproval;
    let repair = false, objectiveRepair = false;
    if (!prepared.ok) {
      repair = objectiveRepair = true;
      // Bounded: this is the only repair call V3 initial generation can make.
      const coded=prepared.validation.issues.filter(i=>i.severity==='fatal').map(i=>`${i.code} [${(i.targetIds ?? [i.targetId]).join(', ')}]: ${i.message}`);
      const failures=[...new Set([...(prepared.consistency ? v3ConsistencyRepairInstructions(prepared.consistency) : coded.length ? coded : prepared.validation.errors),...(prepared.geometryAudit?.errors??[])])];
      if (blueprintFirst || prepared.blueprint) failures.unshift(V3_BLUEPRINT_REPAIR_PROMPT);
      const originalPrepared=prepared;
      attempt = 1;
      // Repair Terra's own authored plan, not the normalized runtime scene: re-sending derived arrays
      // invites the model to rewrite intent it never authored (and a lossy copy loses intent it did).
      result = await run({ kind: "objective", items: failures, plan: result.output });
      prepared = await ingest(result);
      if(prepared.ok){
        const decision=assessV3ObjectiveRevision(originalPrepared.scene,prepared.scene,originalPrepared.validation.issues);
        if(!decision.accepted){prepared.ok=false;prepared.validation.ok=false;prepared.validation.errors.push(...decision.reasons.map(r=>`OBJECTIVE_REPAIR_SCOPE: ${r}`));}
      }
    }
    let designReview = prepared.ok ? reviewV3Architecture(prepared.scene, { brief: prompt }) : undefined;
    const initialDesignCodes = designReview?.diagnostics.map((d) => d.code);
    let designRevised = false;
    if (!repair && designReview?.repairRecommended) {
      // One targeted follow-up; the original valid scene remains authoritative unless preservation passes.
      repair = true;
      attempt = 1;
      try {
        const revised = await run({ kind: "design", items: [...(blueprintFirst || prepared.blueprint ? [V3_BLUEPRINT_REPAIR_PROMPT] : []), ...v3DesignRepairInstructions(designReview)], plan: result.output });
        const revisedPrepared = await ingest(revised);
        const revisedReview = revisedPrepared.ok ? reviewV3Architecture(revisedPrepared.scene, { brief: prompt }) : undefined;
        const decision = revisedReview ? assessV3Revision(prepared.scene, revisedPrepared.scene, designReview, revisedReview)
          : { accepted: false, reasons: ['Revision failed objective validation.'], changedPaths: [] };
        await retainV3RevisionArtifact({ initialScene: prepared.scene, revisedScene: revisedPrepared.scene,
          initialAuthoredScene: result.output, revisedAuthoredScene: revised.output,
          targetedFindings: designReview.diagnostics.filter(d => d.severity === 'significant'), ...decision });
        if (revisedReview && decision.accepted) {
          result = revised;
          prepared = revisedPrepared;
          designReview = revisedReview;
          designRevised = true;
        }
      } catch {
        // A failed optional revision must never cost the user the valid scene already in hand.
        await retainV3RevisionArtifact({ initialScene: prepared.scene, initialAuthoredScene: result.output,
          targetedFindings: designReview.diagnostics.filter(d => d.severity === 'significant'), accepted: false,
          reasons: ['Revision generation or ingestion failed; original valid scene retained.'] });
        console.warn("[v3] design revision discarded; original valid scene retained.");
      }
    }
    const { scene, notes, validation, geometryAudit } = prepared;
    if (!prepared.ok) {
      const errors = [...validation.errors, ...(geometryAudit?.errors ?? [])];
      const preview = recoverV3FailedPreview(result.output, errors, terrainMode);
      return NextResponse.json({ error: `V3 scene could not pass objective validation: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}`, ...(preview ? { v3FailedPreview: preview } : {}) }, { status: 422 });
    }
    validation.warnings.push(...(geometryAudit?.warnings ?? []));
    const audit = summarizeV3Generation(notes, validation.issues);
    const usage = {inputTokens:billedInput,outputTokens:billedOutput,totalTokens:billedTotal};
    scene.metadata = {
      ...scene.metadata,
      brief: prompt,
      terrainMode,
      ...(blueprintFirst ? { blueprintContract: 'blueprint-first-v1' } : {}),
      generatedAt: new Date().toISOString(),
      audit: { status: audit.status, counts: audit.counts },
      designReview: { initial: initialDesignCodes ?? [], final: designReview?.diagnostics.map((d) => d.code) ?? [], revised: designRevised },
      usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens, attempts: repair ? 2 : 1, estimatedCost: billedCost || undefined, contextBytes: systemPrompt.length + prompt.length, schemaBytes: 0, repair },
    };
    const json = JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: scene });
    const warnings = [...notes.map((note) => `${note.code} [${note.targetId}]: ${note.message}`), ...validation.warnings, ...(designReview?.diagnostics.filter((d) => d.severity === "significant" || d.code === "UNSUPPORTED_ARCHITECTURAL_INTENT").map((d) => `DESIGN_${d.code} [${d.targetIds.join(", ")}]: ${d.message}`) ?? [])];
    return NextResponse.json({ summary: `V3 scene generated: ${scene.objects.length} persistent objects${designRevised ? " (one architectural revision)" : objectiveRepair ? " (one validation repair)" : ""}.${audit.summary ? ` ${audit.summary}` : ""}`, json, baseRevision, revision: revisionOf(json), generationMode: "v3-scene", warnings, v3Audit: audit, v3DesignReview: designReview });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) await retainV3FailureArtifact(error.text, attempt, "structured-output", { terrainMode, decision: "rejected", errors: [], warnings: [], notes: [], omitted: [] });
    const failure = logV3StructuredOutputFailure(error);
    if (failure) {
      const message = failure.code === "V3_OUTPUT_TRUNCATED"
        ? "Terra's V3 response was incomplete. Please try again."
        : failure.code === "V3_MODEL_JSON_INVALID"
          ? "Terra's V3 response was not valid JSON. Please try again."
          : "Terra's V3 response didn't match the compact scene contract. Please try again.";
      // This is an already-sanitised compiler input. It is
      // deliberately not a `json` result, so the normal client commit path
      // cannot persist it or replace the last valid scene.
      const preview = recoverV3FailedPreview((error as { text?: unknown }).text, failure.issues.map((issue) => `${issue.path ?? "(root)"}: ${issue.message}`), terrainMode);
      return NextResponse.json({ error: message, code: failure.code, ...(preview ? { v3FailedPreview: preview } : {}) }, { status: 502 });
    }
    logV3ProviderRequestRejection(error);
    return providerErrorResponse(error);
  }
}

/** Blueprint-only authoring uses the same V3 request and maximum two-call budget. Default off. */
async function generateArchitecturalBlueprintV3(prompt:string,baseRevision:string,projectId:string|null){
  const system=v3ArchitecturalBlueprintPrompt();
  const generationId=randomUUID();
  let inputTokens=0,outputTokens=0,totalTokens=0,cost=0;
  let lastBlueprint:unknown;
  let lastAttempt:0|1=0;
  try{
    const built=await generateV3FromArchitecturalBlueprint(prompt,async({repair})=>{
      const result=await withUsageLogging(
        {projectId,operationId:generationId,requestType:'generation',scope:WORLD_SCOPE.level,model:getAiModelId(),generationMode:'v3-scene',stage:repair?'v3-architectural-blueprint-repair':'v3-architectural-blueprint',retryNumber:repair?1:0,retryReason:repair?'objective-blueprint-validation':undefined,maxOutputTokens:V3_INITIAL_MAX_OUTPUT_TOKENS},
        // Disable SDK transport retries: an ambiguous provider failure must not
        // secretly repeat authoring outside the explicit two-attempt budget.
        ()=>generateText({model:getAiModel(),maxRetries:0,maxOutputTokens:V3_INITIAL_MAX_OUTPUT_TOKENS,system,messages:[{role:'user',content:repair?
          `Repair this SAME blueprint only. No detailed scene. This consumes the single existing objective repair attempt. Only diagnosed circulation ids may change footprint/stairType/direction/turn; preserve host, levels, type and ids. Only diagnosed connection ids may change waypoints; preserve endpoint references, approach distance, width/use and surface identity. All other design decisions, buildings, storeys, rooms, entrances, materials, features and requirements are immutable. If a different design is necessary, report the unresolved decision. Failures: ${JSON.stringify(repair.findings)}\nOriginal brief: ${prompt}\nBlueprint: ${JSON.stringify(repair.planFirst??splitV3ArchitecturalBlueprint(repair.blueprint as V3ArchitecturalBlueprint))}`:prompt}],output:Output.json({name:'v3_architectural_blueprint'}),providerOptions:AI_PROVIDER_OPTIONS}),
        outcome=>'error' in outcome?v3StructuredOutputUsageAssessment(outcome.error):{},
      );
      inputTokens+=result.totalUsage.inputTokens??0;outputTokens+=result.totalUsage.outputTokens??0;totalTokens+=result.totalUsage.totalTokens??0;
      cost+=computeCostUsd(getAiModelId(),{inputTokens:result.totalUsage.inputTokens??0,outputTokens:result.totalUsage.outputTokens??0,cachedInputTokens:result.totalUsage.inputTokenDetails?.cacheReadTokens??0})??0;
      // SDK output is a lazy getter and can itself throw for nonterminal output.
      // Diagnose the provider termination before attempting to consume JSON.
      if(result.finishReason!==undefined&&result.finishReason!=='stop')return {output:undefined,finishReason:result.finishReason};
      lastBlueprint=result.output;
      lastAttempt=repair?1:0;
      return {output:lastBlueprint,finishReason:result.finishReason};
    },{requirePlanFirst:true,onAttempt:async attempt=>{
      if(attempt.rawBlueprint===undefined)return;
      await retainV3FailureArtifact(process.env.NODE_ENV==='development'?JSON.stringify(attempt.rawBlueprint):undefined,attempt.attempt,'ingestion',{
        generationId,terrainMode:'flat',decision:attempt.decision,
        errors:attempt.findings.filter(f=>f.severity==='fatal').map(f=>`${f.code} [${f.targetIds.join(', ')}]: ${f.message}`),
        warnings:attempt.findings.filter(f=>f.severity==='advisory').map(f=>f.message),notes:[],omitted:[],
        identityChanges:attempt.identityChanges,normalizedBlueprint:attempt.normalizedBlueprint,
      });
    }});
    if(!built.ok||!built.scene){
      const fatal=built.findings.filter(f=>f.severity==='fatal');
      return NextResponse.json({outcome:'cannot-construct',error:`Cannot Construct — architectural blueprint ${built.phase} failed: ${fatal[0]?.message??'Complete supported design required.'}`,code:fatal[0]?.code,phase:built.phase,findings:built.findings,attempts:built.attempts,...(built.planningScene?{architecturalPlan:{version:3,generationMode:'v3-scene',v3Scene:built.planningScene}}:{})},{status:built.phase==='output'?502:422});
    }
    built.scene.metadata={...built.scene.metadata,brief:prompt,terrainMode:'flat',blueprintContract:'v3-plan-first-1',generatedAt:new Date().toISOString(),
      usage:{inputTokens,outputTokens,totalTokens,attempts:built.attempts,estimatedCost:cost||undefined,contextBytes:Buffer.byteLength(system+prompt),schemaBytes:Buffer.byteLength(system.slice(system.indexOf('{'))),repair:built.attempts===2}};
    const json=JSON.stringify({version:3,generationMode:'v3-scene',v3Scene:built.scene});
    return NextResponse.json({summary:`${built.outcome==='draft'?'Draft — Needs Refinement (not fully validated)':'Complete'}: V3 property developed from its authoritative 2D plan; ${built.scene.objects.length} persistent objects.`,outcome:built.outcome,findings:built.findings,json,baseRevision,revision:revisionOf(json),generationMode:'v3-scene',warnings:built.findings.filter(f=>f.severity==='advisory').map(f=>`${f.code}: ${f.message}`)});
  }catch(error){
    // A planner/compiler exception must not destroy an already paid-for response.
    if(lastBlueprint!==undefined)await retainV3FailureArtifact(process.env.NODE_ENV==='development'?JSON.stringify(lastBlueprint):undefined,lastAttempt,'ingestion',{
      generationId,terrainMode:'flat',decision:'rejected',errors:['ARCHITECTURAL_PIPELINE_EXCEPTION: Offline replay required; original candidate retained.'],warnings:[],notes:[],omitted:[],
    });
    const failure=logV3StructuredOutputFailure(error);
    if(failure)return NextResponse.json({error:'The architectural blueprint response was incomplete or invalid. No scene was constructed.',code:failure.code},{status:502});
    logV3ProviderRequestRejection(error);return providerErrorResponse(error);
  }
}

/** Compact local V3 edit retrieval and atomic direct-scene execution. */
async function editV3Scene(prompt: string, root: Record<string, unknown>, baseRevision: string, projectId: string | null, selectedIds: string[]) {
  const scene = root.v3Scene as V3Scene;
  const selected = selectedIds.length ? scene.objects.filter((object) => selectedIds.includes(object.id)) : scene.objects.slice(0, 36);
  const context = selected.map((object) => ({ id: object.id, type: object.type, role: object.semanticRole, architecture: object.architecture, composition: object.composition, levels: object.levels, facadePreset: object.facadePreset, roofForm: object.roofForm, p: object.architecture ? undefined : object.transform.position, d: object.architecture ? undefined : object.dimensions, material: object.material.id, hostId: object.hostId, support: object.support, fromSupportId: object.fromSupportId, toSupportId: object.toSupportId, groupId: object.groupId }));
  try {
    const { output } = await withUsageLogging(
      { projectId, requestType: "scoped_edit", scope: "component", model: getAiModelId(), generationMode: "v3-scene", stage: "v3-local-edit", maxOutputTokens: 1800 },
      () => generateText({ model: getAiModel(), maxOutputTokens: 1800, system: "You are Terra editing a compact V3 scene. Return JSON {intent,operations}. Operations: setComposition {target,composition} replaces the target building mass composition (use {} to restore facade presets), create {object}, delete {target}, editArchitecture {target,architecture: partial named geometry}, changeMaterial {target,material}, duplicate {target,id,position?}, attach {target,hostId}, detach {target}, setSupport {target,support}, setConnectorEndpoints {target,fromSupportId,toSupportId}, replaceSiteHierarchy {hierarchy}, replaceEstatePlan {estatePlan} (only for an explicit change of estate intent; preserve unrelated commitments and ids). Legacy move/rotate/resize use position/rotation/dimensions. Target supplied authored stable ids only. New objects use named architecture and material intent; support metadata is optional. For an object with architecture, use editArchitecture and change named x, z, baseElevation, width, depth, or height; never rewrite its derived runtime arrays. X is left/right, Y is vertical, Z is forward/back. Canonical legacy arrays are position [x,y,z] and dimensions [width,height,depth]. Preserve unusual valid support relationships when geometry is unchanged; ordinary architectural support is compiler-inferred. If a stair/ramp changes, include setConnectorEndpoints. When an edit changes levels or routes, use replaceSiteHierarchy with the complete corrected hierarchy. Hierarchy routes are world-space [x,y,z]. Do not recreate or use V2 architecture documents." + "\n" + V3_COMPOSITION_PROMPT, messages: [{ role: "user", content: `Request: ${prompt}\nEstate plan: ${JSON.stringify(scene.estatePlan)}\nSite hierarchy: ${JSON.stringify(scene.siteHierarchy)}\nLocal scene subset: ${JSON.stringify(context)}` }], output: Output.json({ name: "v3_semantic_edit" }), providerOptions: AI_PROVIDER_OPTIONS })
    );
    const applied = executeV3SceneOperations(scene, output);
    if (!applied.ok) return NextResponse.json({ error: `V3 edit was rejected atomically: ${applied.errors[0]}` }, { status: 422 });
    const json = JSON.stringify({ ...root, v3Scene: applied.scene });
    return NextResponse.json({ summary: (output as { intent: string }).intent, warnings: applied.warnings, json, baseRevision, revision: revisionOf(json), scope: { level: "component", label: "V3 local scene" }, generationMode: "v3-scene" });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) return NextResponse.json({ error: "Terra's V3 edit did not match the operation contract." }, { status: 502 });
    return providerErrorResponse(error);
  }
}

/**
 * Typed additive V2 edit path. It understands a small semantic object request and only appends a
 * grounded placement/site feature; V2 architecture and existing Site Plan geometry remain read-only.
 */
async function editV2SiteFeature(prompt: string, root: Record<string, unknown>, baseRevision: string, projectId: string | null): Promise<NextResponse> {
  let assets: Awaited<ReturnType<ReturnType<typeof assetBackend>["list"]>>["assets"] = [];
  let glbIds: string[] = [];
  try {
    ({ assets, glbIds } = await assetBackend().list());
  } catch {
    // The placement engine is self-contained. A transient catalog read must not turn a valid additive edit
    // into a failure; use the same procedural fallback as an empty approved catalog.
    console.warn("[v2-additive] asset catalog unavailable; placing procedural fallback");
  }
  const placed = placeV2AdditiveAsset(root, prompt, assets, glbIds);
  if (!placed.ok) return NextResponse.json({ error: placed.error, code: placed.code }, { status: 422 });
  if ("placementIds" in placed) {
    // A standalone proxy: its Need carries the request's own type, style, size and context, and the Need's id is
    // stamped on the proxy so an approved asset can later be matched to this exact placement.
    const need = placed.needRequest ? await recordPriorityAssetNeed({ ...placed.needRequest, projectId }) : undefined;
    const json = need ? withProxyNeedId(placed.json, placed.placementIds, need.id) : placed.json;
    return NextResponse.json({ summary: placed.summary, json, baseRevision, revision: revisionOf(json), scope: { level: "component", label: "V2 additive placement" }, operation: "addV2Placement", assetId: placed.assetId, placementIds: placed.placementIds, ...(placed.usedProceduralFallback ? { proceduralFallback: true, assetNeedId: need?.id } : {}) });
  }
  const assetNeed = placed.usedProceduralFallback
    ? await recordPriorityAssetNeed({
      text: placed.object === "bar" ? "outdoor bar" : placed.object === "lounger" ? "sun lounger" : /lounge\s+chairs?/i.test(prompt) ? "lounge chair" : placed.object,
      category: placed.object === "bar" ? "outdoor-bar" : placed.object === "planter" ? "decorative" : "furniture",
      styleTags: extractStyleTags(prompt), contextTags: extractContextTags(prompt), projectId,
      components: [placed.object === "lounger" ? "sun-lounger" : placed.object === "chair" ? "lounge-armchair" : placed.object],
    })
    : undefined;
  return NextResponse.json({ summary: placed.summary, json: placed.json, baseRevision, revision: revisionOf(placed.json), scope: { level: "component", label: "V2 additive placement" }, operation: "addV2Placement", assetId: placed.assetId, ...(placed.usedProceduralFallback ? { proceduralFallback: true, assetNeedId: assetNeed?.id } : {}) });
}

/**
 * Architectural follow-up edit: the same AI Architect edits its own saved document (one bounded repair). The edited
 * document must pass the Architect contract, the compiler, the design-quality gate, the edit preservation checks and
 * the final V2 integrity gate over the exact project JSON to be saved. The Architect may also submit one bounded,
 * relationship-audited Site Plan reflow; outdoor placements remain protected. Anything else fails with no `json`.
 */
async function editV2Architecture(prompt: string, root: Record<string, unknown>, current: ArchitecturalDesignDocument, currentHouseJson: string, baseRevision: string, projectId: string | null, selectedTargetIds?: readonly string[]): Promise<NextResponse> {
  const usageMeta: UsageMeta = { projectId, requestType: "scoped_edit", scope: WORLD_SCOPE.level, model: getAiModelId() };
  const parsedCurrentPlan = sitePlanSchema.safeParse(root.sitePlan);
  if (!parsedCurrentPlan.success) return NextResponse.json({ error: "The saved V2 project has no valid canonical Site Plan to reflow.", code: "SITE_PLAN_REQUIRED" }, { status: 422 });
  const currentPlan = parsedCurrentPlan.data;
  const savedOutdoorAssets = Array.isArray(root.outdoorAssetPlacements) ? root.outdoorAssetPlacements as OutdoorAssetPlacement[] : [];
  const savedOutdoorAssetTombstones = Array.isArray(root.outdoorAssetTombstones) ? root.outdoorAssetTombstones as OutdoorAssetTombstone[] : [];
  // Renderer-only patio sets get deterministic persistent identities in the edit
  // world. They are not saved merely because an unrelated architectural request
  // was made; an asset operation is required to materialize them in the project.
  const renderedSite = generateHouseFromJson(currentHouseJson).site;
  const derivedFurniture = renderedSite ? persistentFurniturePlacements(renderedSite) : [];
  // This is the authoritative edit world for the entire attempt. Renderer-only
  // assets receive durable ids before the Architect sees a catalog; if an asset
  // operation succeeds this exact array (with its edits) is what is persisted.
  const editableOutdoorAssets = materializeGeneratedAssets(savedOutdoorAssets, derivedFurniture)
    .filter((placement) => !savedOutdoorAssetTombstones.some((tombstone) => tombstone.semanticId === placement.source?.semanticId));
  const authority = (document: ArchitecturalDesignDocument, plan: SitePlan) => ({ architectureHash: architectureAuthorityHash(document), sitePlanHash: sitePlanAuthorityHash(plan) });
  const projectWith = (document: ArchitecturalDesignDocument, plan: SitePlan, outdoorAssetPlacements = root.outdoorAssetPlacements, outdoorAssetTombstones = root.outdoorAssetTombstones) => {
    const rest = { ...root };
    delete rest.architectureDocument;
    const context = sitePlanContextForDocument(document.brief, document);
    const reconciled = sitePlanAuthorityHash(plan) === sitePlanAuthorityHash(currentPlan) ? rest : reconcileSitePlanExecution(rest, plan, context?.masses);
    return JSON.stringify({ ...reconciled, architecturalDesignDocument: document, ...(outdoorAssetPlacements ? { outdoorAssetPlacements } : {}), ...(outdoorAssetTombstones ? { outdoorAssetTombstones } : {}) });
  };
  const editableBaselineJson = JSON.stringify({ ...root, outdoorAssetPlacements: editableOutdoorAssets });
  const compactIntegrityFailure = (id: string, detail: string) => {
    // Asset collision diagnostics contain exact placement and mass ids. Keep that
    // actionable evidence, but never send the renderer/compiler diagnostic blob
    // back through the model context.
    if (id === "scene-assets-clear-of-building") {
      const placement = detail.match(/"placement"\s*:\s*\{\s*"id"\s*:\s*"([^"]+)"/)?.[1];
      const mass = detail.match(/"intersectingMass"\s*:\s*\{\s*"id"\s*:\s*"([^"]+)"/)?.[1];
      if (placement || mass) return `${id}: ${placement ? `asset:${placement}` : "a placed asset"} intersects ${mass ? `mass:${mass}` : "the building"}. Revise the operation plan so targeted assets are supported and clear.`;
    }
    const concise = detail.replace(/\{[^{}]*\}/g, "").replace(/\s+/g, " ").trim();
    return `${id}: ${concise.slice(0, 360)}`;
  };
  const integrityErrors = (document: ArchitecturalDesignDocument, plan = currentPlan, outdoorAssetPlacements: readonly OutdoorAssetPlacement[] = editableOutdoorAssets) =>
    runV2IntegrityGate({
      json: projectWith(document, plan, outdoorAssetPlacements), brief: current.brief, authority: authority(document, plan),
      previousArchitectureDocument: current, previousJson: editableBaselineJson,
    }).blocking.map((check) => compactIntegrityFailure(check.id, check.detail));
  try {
    const result = await runArchitectEditStage({ current, currentSitePlan: currentPlan, outdoorAssetPlacements: editableOutdoorAssets, outdoorAssetTombstones: savedOutdoorAssetTombstones, request: prompt, selectedTargetIds, timings: createTimings(), budgetMs: GENERATION_BUDGET_MS, usageMeta, checkCandidate: integrityErrors });
    const fail = async (errors: readonly string[], repairRequests?: readonly string[], recordedNeedId?: string) => {
      console.warn("[v2-architectural-edit] not applied:", errors);
      const capability = errors.find((error) => error.startsWith("Capability Need:"));
      const capabilityNeed = recordedNeedId ? { id: recordedNeedId } : capability ? await recordSpatialReflowCapabilityNeed(capability.slice("Capability Need:".length).trim(), projectId, current.brief) : undefined;
      return NextResponse.json({
        error: "The Architect could not make that change while keeping the design valid, so the project was not changed. Try describing the change differently.",
        code: "ARCHITECTURAL_EDIT_FAILED", outcome: "failed", stage: "architect",
        ...(capabilityNeed ? { capabilityNeedId: capabilityNeed.id } : {}),
        ...(process.env.NODE_ENV !== "production" ? { conflicts: [...errors], repairRequests: [...(repairRequests ?? [])], attempts: result.attempts } : {}),
      }, { status: 422 });
    };
    if (!result.ok || !result.document) return fail(result.errors ?? ["The Architect returned no document."], result.repairRequests);
    const edited = result.document;
    const capabilityNeeds = result.capabilityNeeds ?? [];
    if (result.plan?.status === "already-satisfied") {
      return NextResponse.json({
        summary: result.plan.rationale!, json: currentHouseJson, baseRevision, revision: baseRevision,
        outcome: "already-satisfied", scope: { level: WORLD_SCOPE.level, label: "Architectural edit" }, operation: "architecturalEdit", changes: [], editPlan: result.plan, capabilityNeeds,
        ...(process.env.NODE_ENV !== "production" ? { attempts: result.attempts, repairRequests: result.repairRequests ?? [] } : {}),
      });
    }
    if (result.plan?.status === "capability-needed") {
      const need = await recordArchitectVocabularyCapabilityNeed(capabilityNeeds.map((need) => `${need.capability}: ${need.reason}`).join("; "), projectId, current.brief);
      return NextResponse.json({
        summary: `Capability needed: ${capabilityNeeds.map((need) => need.capability).join(", ")}. ${capabilityNeeds.map((need) => need.reason).join(" ")}`,
        json: currentHouseJson, baseRevision, revision: baseRevision, outcome: "capability-needed", scope: { level: WORLD_SCOPE.level, label: "Architectural edit" }, operation: "architecturalEdit", changes: [], editPlan: result.plan, capabilityNeeds,
        ...(need ? { capabilityNeedId: need.id } : {}),
        ...(process.env.NODE_ENV !== "production" ? { attempts: result.attempts, repairRequests: result.repairRequests ?? [] } : {}),
      });
    }
    // Goal coverage of the accepted plan. extrude/cut only record Capability Needs, so they are not applied work.
    const appliedOperations = result.plan?.operations.filter((operation) => operation.op !== "extrude" && operation.op !== "cut").length ?? 0;
    const goalSummary = result.plan ? summarizeEditGoals(result.plan.goals, appliedOperations, capabilityNeeds) : undefined;
    if (result.plan && goalSummary && !appliedOperations) {
      // A goal ledger that needs no world change: some goals already hold, the rest need capabilities.
      const need = goalSummary.capabilityNeeded ? await recordArchitectVocabularyCapabilityNeed(capabilityNeeds.map((need) => `${need.capability}: ${need.reason}`).join("; "), projectId, current.brief) : undefined;
      return NextResponse.json({
        summary: describeEditGoalSummary(goalSummary), json: currentHouseJson, baseRevision, revision: baseRevision,
        outcome: goalSummary.capabilityNeeded ? "capability-needed" : "already-satisfied", scope: { level: WORLD_SCOPE.level, label: "Architectural edit" }, operation: "architecturalEdit", changes: [], editPlan: result.plan, capabilityNeeds, goalSummary,
        ...(need ? { capabilityNeedId: need.id } : {}),
        ...(process.env.NODE_ENV !== "production" ? { attempts: result.attempts, repairRequests: result.repairRequests ?? [] } : {}),
      });
    }
    if (result.plan && capabilityNeeds.length && !appliedOperations && architectureAuthorityHash(edited) === architectureAuthorityHash(current) && sitePlanAuthorityHash(result.sitePlan ?? currentPlan) === sitePlanAuthorityHash(currentPlan)) {
      const need = await recordArchitectVocabularyCapabilityNeed(capabilityNeeds.map((need) => `${need.capability}: ${need.reason}`).join("; "), projectId, current.brief);
      return fail(capabilityNeeds.map((need) => `Capability Need: ${need.capability}: ${need.reason}`), undefined, need?.id);
    }
    // Replacement-document compatibility is isolated here. An operation plan is
    // authoritative by its validated operations and may legitimately change only
    // persistent assets, leaving both the document and Site Plan byte-identical.
    if (result.legacyDocumentReplacement && architectureAuthorityHash(edited) === architectureAuthorityHash(current) && (!result.sitePlan || sitePlanAuthorityHash(result.sitePlan) === sitePlanAuthorityHash(currentPlan))) {
        const need = await recordArchitectVocabularyCapabilityNeed(prompt, projectId, current.brief);
        return fail(["The legacy Architect replacement response returned the document unchanged."], undefined, need?.id);
    }
    const plan = result.sitePlan ?? currentPlan;
    const assetOperation = result.plan?.operations.some((operation) => "target" in operation && (operation.target.startsWith("asset:") || operation.target.startsWith("asset-group:")));
    const savedPlacements = assetOperation ? result.outdoorAssetPlacements : savedOutdoorAssets;
    const savedTombstones = assetOperation ? result.outdoorAssetTombstones : savedOutdoorAssetTombstones;
    const json = projectWith(edited, plan, savedPlacements, savedTombstones);
    // The stage already ran this gate on the candidate; this is the artifact actually returned for saving.
    const finalErrors = integrityErrors(edited, plan, savedPlacements);
    if (finalErrors.length) return fail(finalErrors);
    const changes = result.plan
      ? result.plan.operations.map((operation) => `${operation.op}${"target" in operation ? ` ${operation.target}` : ""}`)
      : describeArchitecturalEditDiff(architecturalEditDiff(current, edited, result.scope, new Set(result.reflow?.elements.filter((entry) => entry.id.startsWith("mass:")).map((entry) => entry.id.slice(5)) ?? [])));
    // Partial completion is honest: achievable goals were applied, the rest are recorded Capability Needs.
    const partialNeed = goalSummary && !goalSummary.complete ? await recordArchitectVocabularyCapabilityNeed(capabilityNeeds.map((need) => `${need.capability}: ${need.reason}`).join("; "), projectId, current.brief) : undefined;
    return NextResponse.json({
      summary: goalSummary ? describeEditGoalSummary(goalSummary) : `Architectural edit applied (${changes.join("; ") || "document updated"}).`,
      json, baseRevision, revision: revisionOf(json),
      scope: { level: WORLD_SCOPE.level, label: "Architectural edit" }, operation: "architecturalEdit", changes, ...(result.scope ? { editScope: result.scope } : {}), ...(result.plan ? { editPlan: result.plan, capabilityNeeds } : {}),
      // Pre-existing findings and what the geometry model cannot verify are reported, never claimed as passing.
      ...(goalSummary ? { goalSummary, completion: goalSummary.complete ? "complete" : "partial", circulation: auditCirculation(edited) } : {}),
      ...(partialNeed ? { capabilityNeedId: partialNeed.id } : {}),
      ...(result.reflow || result.plan?.siteReflow ? { reflow: result.reflow ?? result.plan?.siteReflow, reflowDiff: spatialReflowDiff(current, edited, currentPlan, plan) } : {}),
      ...(process.env.NODE_ENV !== "production" ? { attempts: result.attempts, repairRequests: result.repairRequests ?? [] } : {}),
    });
  } catch (error) {
    console.error("[v2-architectural-edit] failed:", error);
    return providerErrorResponse(error);
  }
}

function withProxyNeedId(json: string, placementIds: readonly string[], needId: string): string {
  const root = JSON.parse(json) as { outdoorAssetPlacements: OutdoorAssetPlacement[] };
  root.outdoorAssetPlacements = root.outdoorAssetPlacements.map((p) => (p.proxy && placementIds.includes(p.id) ? { ...p, proxy: { ...p.proxy, needId } } : p));
  return JSON.stringify(root);
}

const sseFrame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/**
 * The streaming delivery mode: runs the identical `generateInitialDesign` function, differing only in that
 * `emit` is wired to flush one SSE frame per architecture stage/mass/roof as they complete, and the final
 * result (success or error) is delivered as one last `done`/`error` frame instead of the HTTP response
 * itself — so the two paths can never semantically drift, only in delivery cadence.
 */
function streamInitialDesign(brief: string, assets: AssetRef[], baseRevision: string, usageMeta: UsageMeta): NextResponse {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: PipelineStageEvent) => controller.enqueue(encoder.encode(sseFrame("stage", event)));
      try {
        const response = await generateInitialDesign(brief, assets, baseRevision, usageMeta, emit);
        const payload = (await response.json()) as Record<string, unknown>;
        const frameEvent = response.ok ? "done" : "error";
        controller.enqueue(encoder.encode(sseFrame(frameEvent, response.ok ? payload : { ...payload, status: response.status })));
        console.info(`[architecture-stages] SSE Finalization: ok — emitted "${frameEvent}" (HTTP ${response.status})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI request failed. Please try again.";
        controller.enqueue(encoder.encode(sseFrame("error", { error: message, status: 500 })));
        console.error(`[architecture-stages] SSE Finalization: FAILED — stream threw before a done/error frame could be built: ${message}`);
      } finally {
        controller.close();
      }
    },
  });
  return new NextResponse(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}

/**
 * A deterministic dry-run of the document → geometry step (see compiler.ts) plus the design-quality gate
 * (qualityGate.ts) over the same compile, both timed and traced like every other stage. compileArchitecture's
 * output here is discarded; what matters is whether it throws, reports errors, or fails a BLOCKING check — any
 * of which the architecture can no longer recover from, so the caller stops before paying for Final Assembly.
 * The gate that decides finalization runs later, over the assembled artifact itself (integrityGate.ts).
 */
function compilerDiagnostics(document: ArchitecturalDesignDocument): StageDiagnostics[] {
  const start = performance.now();
  const docErrors = validateArchitecturalDesignDocument(document);
  if (docErrors.length) {
    const durationMs = performance.now() - start;
    return [{ stage: "compiler", status: "error", durationMs, modelCalls: 0, retries: 0, error: docErrors.join("; ") }];
  }
  try {
    const { errors, diagnostics } = compileArchitecture(document, { materials: DEFAULT_MATERIALS_CONFIG });
    const compilerResult: StageDiagnostics = { stage: "compiler", status: errors.length ? "error" : "ok", durationMs: performance.now() - start, modelCalls: 0, retries: 0, ...(errors.length ? { error: errors.join("; ") } : {}) };
    if (errors.length || !diagnostics) return [compilerResult];
    const gateStart = performance.now();
    const gate = runDesignQualityGate(document, diagnostics);
    const gateResult: StageDiagnostics = {
      stage: "quality-gate", status: gate.passed ? "ok" : "error", outcome: gate.passed ? "accepted" : "failed", durationMs: performance.now() - gateStart, modelCalls: 0, retries: 0,
      ...(gate.blocking.length ? { error: gate.blocking.map((c) => `${c.id}: ${c.detail}`).join("; ") } : {}),
      ...(gate.warnings.length ? { warnings: gate.warnings.map((c) => `${c.id}: ${c.detail}`) } : {}),
    };
    return [compilerResult, gateResult];
  } catch (error) {
    return [{ stage: "compiler", status: "error", durationMs: performance.now() - start, modelCalls: 0, retries: 0, error: error instanceof Error ? error.message : String(error) }];
  }
}

/**
 * Always logs a concise final sequence for a live generation — Architect through Final Assembly — so an
 * HTTP 200 on the SSE transport (which succeeds as soon as headers go out, regardless of what the stream
 * ultimately contains) never hides which stage, if any, actually failed the generation the browser sees.
 * Unconditional, not dev-gated: this is exactly the trace needed to diagnose a live failure after the fact.
 * None of it reaches the client — only the response's own dev-gated `architectureDiagnostics` field does
 * (see `runFinalAssembly`).
 */
function logFinalSequence(pipelineResult: PipelineResult, diagnostics: StageDiagnostics[], finalAssembly: { ok: boolean; status: number; error?: string }): void {
  const byStage = new Map(diagnostics.map((d) => [d.stage, d] as const));
  const line = (label: string, stage: StageDiagnostics["stage"], extra?: string) => {
    const d = byStage.get(stage);
    if (!d) return `${label}: skipped`;
    return `${label}: ${d.status}${extra ? ` — ${extra}` : ""}${d.error ? ` (${d.error})` : ""}`;
  };
  const lines = [
    line("AI Architect", "architect"),
    line("Site Plan", "site-plan"),
    line("Compiler", "compiler"),
    line("Design Quality Gate", "quality-gate"),
    `Final Assembly: ${finalAssembly.ok ? "ok" : `FAILED (HTTP ${finalAssembly.status})${finalAssembly.error ? ` — ${finalAssembly.error}` : ""}`}`,
  ];
  console.info(`[architecture-stages] final sequence:\n${lines.join("\n")}`);
}

/** Diagnostics order matches `runArchitecturePipeline`'s push order — used only to name which stage was running when a catastrophic (non-model) error interrupted it. */
const PIPELINE_STAGE_ORDER = ["foundation", "mass-expansion", "architectural-geometry", "roof-composition"] as const;

/**
 * Logs a `[architecture-stages] CRASH` block for a genuinely unexpected throw from `runArchitecturePipeline`
 * — a deterministic JS bug (a bad relationship resolution, a stub missing a required field), never a model
 * failure (a stage that exhausts its retry budget throws `V2GenerationFailure`, handled separately). Says which stage
 * was running and how many masses survived, without the raw stack trace — safe to run unconditionally, in
 * production too, since only counts and the error's own message are logged, nothing from the request body.
 */
function logPipelineCrash(error: unknown, diagnosticsSoFar: readonly StageDiagnostics[], upstreamSoFar: PipelineResult["upstream"]): void {
  const lastSuccessfulStage = diagnosticsSoFar.length ? diagnosticsSoFar[diagnosticsSoFar.length - 1].stage : "none";
  const crashedStage = PIPELINE_STAGE_ORDER[diagnosticsSoFar.length] ?? "final-assembly";
  const massesPreserved = upstreamSoFar.masses?.length ?? 0;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[architecture-stages] CRASH\nstage: ${crashedStage}\nerror: ${message}\nlastSuccessfulStage: ${lastSuccessfulStage}\nmassesPreserved: ${massesPreserved}`);
}

/** Initial design from a brief: structured output -> typed ops on a blank base -> validated -> returned. */
async function generateInitialDesign(brief: string, assets: AssetRef[], baseRevision: string, usageMeta: UsageMeta, emit: (event: PipelineStageEvent) => void = () => {}) {
  const timings = createTimings();
  // Only the server catalog and its stored GLB ids are authoritative for generation. If it is unavailable, generation remains
  // possible but retrieves no reusable assets rather than trusting a browser cache or invented client metadata.
  let library: AssetIndexEntry[] = [];
  let capabilities = INITIAL_CAPABILITIES;
  try {
    const [{ assets: storedAssets, glbIds }, snapshot] = await Promise.all([assetBackend().list(), readLibrary()]);
    const storedGlbs = new Set(glbIds);
    library = toAssetIndex(storedAssets.filter((asset) => asset.type !== "glb-model" || storedGlbs.has(asset.id))).map((asset) => ({ ...asset, serverStored: true }));
    capabilities = snapshot.capabilities;
  } catch (error) {
    console.warn("[generation] server library lookup failed; reusable-asset retrieval is unavailable:", error instanceof Error ? error.message : error);
  }
  // The outdoor spaces this brief calls for, and the approved recipes that describe how to build each (a proven pattern per space,
  // not one lookup for the whole brief). A library problem never blocks generation (see `safely`).
  const planned = planOutdoorSpaces({ brief });
  const recipeLookup = await timings.timeAsync("recipeLookup", () => recipeRetrievalForSpaces(brief, planned));
  const roofRecipes = await timings.timeAsync("roofRecipeLookup", () => roofRecipesForBrief(brief));
  const retrieved = recipeLookup.retrieved;
  const recipes = retrieved.map((r) => r.recipe);
  const recipeIds = recipes.map((r) => r.id);
  const spaces = planned.map((sp) => ({ ...sp, recipeIds: retrieved.filter((r) => r.spaces.includes(sp.kind)).map((r) => r.recipe.id) }));
  // This happens before the model chooses operations. The model receives a plan, rather than inventing
  // a default mass trio and receiving an architectural explanation afterwards.
  const hints = inferSiteHints(brief);
  const pipelineInput: PipelineInput = {
    brief, hints, scale: hints.projectScale, recipes, roofRecipes,
    availableCapabilities: capabilities.filter((capability) => capability.status === "supported" || capability.status === "partial").map((capability) => capability.id),
    variationSeed: usageMeta.projectId ?? brief, projectId: usageMeta.projectId,
  };
  // Stages 1-5 (Intent+Site Strategy+Primary Mass as one call, Recursive Mass Expansion, Roof Composition) run
  // as their own bounded model calls against a budget that reserves time for the mandatory final call below
  // (see STAGE_PIPELINE_BUDGET_MS), producing both the real mass/roof document the renderer prefers AND a
  // legacy-compatible `ArchitecturalDesign` that guides the final call exactly as the old deterministic bridge
  // did — critic.ts and the learning loop need no changes.
  let upstreamSoFar: PipelineResult["upstream"] = {};
  let diagnosticsSoFar: readonly StageDiagnostics[] = [];
  let pipelineResult: PipelineResult;
  try {
    pipelineResult = await runArchitecturePipeline(pipelineInput, timings, STAGE_PIPELINE_BUDGET_MS, usageMeta, emit, (upstream, diagnostics) => {
      upstreamSoFar = upstream;
      diagnosticsSoFar = diagnostics;
      // Written after every AI stage, not only once the whole pipeline finishes: if a later, purely
      // deterministic stage then throws, Replay can still resume from here instead of repaying for the
      // stages that already succeeded (see devSessionCache.ts and the replay route's fallback to `upstream`).
      setDevSession(usageMeta.projectId, { input: pipelineInput, upstream, diagnostics: [...diagnostics] });
    });
  } catch (error) {
    // An authoritative stage exhausted its retry budget: the generation is incomplete and does not finalize.
    if (isV2GenerationFailure(error)) return v2FailureResponse("v2-generation-failed", error.stage, error.conflicts, error.diagnostics, usageMeta);
    logPipelineCrash(error, diagnosticsSoFar, upstreamSoFar);
    return providerErrorResponse(error, "architecture-pipeline", { architectureDiagnostics: [...diagnosticsSoFar] });
  }
  // The architecture is final here. If it cannot compile, or fails a blocking integrity check, nothing later can
  // repair it (Site Plan and Final Assembly only read it) — stop before paying for them.
  const compilerChecks = compilerDiagnostics(pipelineResult.document);
  const architectureFailure = compilerChecks.find((d) => d.status === "error");
  if (architectureFailure) {
    return v2FailureResponse("v2-integrity-blocked", "integrity-gate", [`${architectureFailure.stage}: ${architectureFailure.error ?? "failed"}`], [...pipelineResult.diagnostics, ...compilerChecks], usageMeta);
  }
  // The canonical V2 Site Plan is authored by its stage or the generation is incomplete — there is no legacy
  // deterministic site design (pool/deck/drive/path rules) behind a failed Site Plan.
  const siteStart = performance.now();
  const siteContext = sitePlanContextForDocument(brief, pipelineResult.document);
  if (!siteContext) {
    pipelineResult.diagnostics.push({ stage: "site-plan", status: "error", outcome: "failed", durationMs: performance.now() - siteStart, modelCalls: 0, retries: 0, error: "No V2 mass available." });
    return v2FailureResponse("v2-generation-failed", "site-plan", ["No V2 site frame: the architecture has no mass to site a plan against."], [...pipelineResult.diagnostics, ...compilerChecks], usageMeta);
  }
  // `runStage` measures against the same generation-start timer itself. Passing the
  // fixed total budget leaves a real repair window instead of subtracting elapsed time twice.
  const siteResult = await runSitePlanStage(siteContext, timings, GENERATION_BUDGET_MS, usageMeta);
  pipelineResult.diagnostics.push({
    stage: "site-plan", status: siteResult.ok ? "ok" : "error", outcome: siteResult.ok ? "accepted" : "failed", durationMs: performance.now() - siteStart,
    modelCalls: siteResult.attempts, retries: Math.max(0, siteResult.attempts - 1),
    ...(siteResult.repairRequests?.length ? { repairRequests: siteResult.repairRequests } : {}), ...(siteResult.ok ? {} : { error: siteResult.errors.join("; ") }),
  });
  if (!siteResult.ok) return v2FailureResponse("v2-generation-failed", "site-plan", siteResult.errors, [...pipelineResult.diagnostics, ...compilerChecks], usageMeta);
  const sitePlan = siteResult.value;
  const sitePlanHash = sitePlanAuthorityHash(sitePlan);
  const diagnostics = [...pipelineResult.diagnostics, ...compilerChecks];
  if (process.env.NODE_ENV !== "production") {
    for (const d of diagnostics) console.info(`[architecture-stages] ${d.stage}: ${d.status} (${Math.round(d.durationMs)}ms, ${d.modelCalls} call(s), ${d.retries} retr(y/ies))${d.error ? ` — ${d.error}` : ""}`);
  }
  setDevSession(usageMeta.projectId, {
    input: pipelineInput,
    result: { ...pipelineResult, diagnostics },
    finalAssembly: { assets, recipes, retrieved, spaces, library, baseRevision, sitePlan, sitePlanHash, architectureHash: pipelineResult.authority.architectureHash },
  });
  const response = await runFinalAssembly({ brief, assets, baseRevision, library, usageMeta, timings, pipelineResult: { ...pipelineResult, diagnostics }, recipes, recipeIds, retrieved, recipeRejections: recipeLookup.rejections, spaces, budgetMs: GENERATION_BUDGET_MS, sitePlan, sitePlanHash });
  // Peek at the response without consuming the body the caller still needs to return: `response.clone()` tees
  // the stream, so this never affects what actually reaches the client.
  let finalAssemblyError: string | undefined;
  if (!response.ok) {
    try { finalAssemblyError = ((await response.clone().json()) as { error?: string }).error; } catch { /* body already consumed/unreadable — logged without it */ }
  }
  logFinalSequence(pipelineResult, diagnostics, { ok: response.ok, status: response.status, error: finalAssemblyError });
  return response;
}
