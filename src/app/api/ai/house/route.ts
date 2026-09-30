import { NextRequest, NextResponse } from "next/server";
import { generateText, NoObjectGeneratedError, Output } from "ai";
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
import { recipeRetrievalForSpaces, roofRecipesForBrief } from "@/lib/library/service";
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
import type { StageDiagnostics } from "@/lib/architecture/stages/diagnostics";
import { setDevSession } from "@/lib/architecture/stages/devSessionCache";
import { runFinalAssembly, sitePlanContextForDocument } from "@/lib/ai/finalAssembly";
import { runSitePlanStage, type SitePlan } from "@/lib/architecture/stages/sitePlanStage";
import { providerErrorResponse } from "@/lib/ai/providerErrors";
import { placeV2AdditiveAsset } from "@/lib/architecture/v2AdditivePlacement";

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
  /** Imported PBR materials the model may reference by id. */
  assets?: AssetRef[];
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

  // Additive V2 placement is a deterministic executor, not an architecture-generation call.
  const activeDocument = root.architecturalDesignDocument ?? root.architectureDocument;
  if (body.mode !== "generate" && isArchitecturalDesignDocument(activeDocument)) {
    return editV2SiteFeature(prompt, root, baseRevision);
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  if (body.mode === "generate") {
    // Generation only ever starts from a blank project; an existing design is never regenerated here.
    if (!isBlankSite(currentHouseJson)) {
      return NextResponse.json(
        { error: "This project already has a design. Describe what to change instead of generating a new one." },
        { status: 409 }
      );
    }
    const usageMeta: UsageMeta = { projectId, requestType: "generation", scope: WORLD_SCOPE.level, model: getAiModelId() };
    // Live progressive generation: the viewport can watch masses and roofs appear one at a time. Any caller that
    // doesn't ask for this (including every existing test) gets the exact same single JSON response as before.
    if (req.headers.get("accept")?.includes("text/event-stream")) {
      return streamInitialDesign(prompt, assets, baseRevision, usageMeta);
    }
    return generateInitialDesign(prompt, assets, baseRevision, usageMeta);
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

/**
 * Typed additive V2 edit path. It understands a small semantic object request and only appends a
 * grounded placement/site feature; V2 architecture and existing Site Plan geometry remain read-only.
 */
async function editV2SiteFeature(prompt: string, root: Record<string, unknown>, baseRevision: string): Promise<NextResponse> {
  let assets: Awaited<ReturnType<ReturnType<typeof assetBackend>["list"]>>["assets"] = [];
  let glbIds: string[] = [];
  try {
    ({ assets, glbIds } = await assetBackend().list());
  } catch {
    return NextResponse.json({ error: "Approved asset library is unavailable, so I cannot safely place a V2 outdoor object." }, { status: 503 });
  }
  const placed = placeV2AdditiveAsset(root, prompt, assets, glbIds);
  if (!placed.ok) return NextResponse.json({ error: placed.error, code: placed.code }, { status: 422 });
  return NextResponse.json({ summary: placed.summary, json: placed.json, baseRevision, revision: revisionOf(placed.json), scope: { level: "component", label: "V2 additive placement" }, operation: "addV2Placement", assetId: placed.assetId });
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
 * Dev-only: a deterministic dry-run of the document → geometry step (see compiler.ts) plus the deterministic
 * design-quality gate (qualityGate.ts) over the same compile, both timed and traced like every other stage.
 * Never changes what's returned to the renderer — compileArchitecture's output here is discarded; only
 * whether it throws, reports errors, or fails a quality check is recorded. The quality gate never blocks or
 * retries generation — see qualityGate.ts's own doc comment for why.
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
    const failed = gate.checks.filter((c) => !c.passed);
    const gateResult: StageDiagnostics = {
      stage: "quality-gate", status: gate.passed ? "ok" : "fallback", durationMs: performance.now() - gateStart, modelCalls: 0, retries: 0,
      ...(failed.length ? { error: failed.map((c) => `${c.id}: ${c.detail}`).join("; ") } : {}),
    };
    return [compilerResult, gateResult];
  } catch (error) {
    return [{ stage: "compiler", status: "error", durationMs: performance.now() - start, modelCalls: 0, retries: 0, error: error instanceof Error ? error.message : String(error) }];
  }
}

/**
 * Always logs a concise final sequence for a live generation — Foundation through Final Assembly — so an
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
  const massCount = pipelineResult.upstream.masses?.length ?? 0;
  const opCount = (pipelineResult.upstream.articulatedMasses ?? []).reduce((sum, m) => sum + (m.operations?.length ?? 0) + (m.openings?.length ?? 0), 0);
  const lines = [
    line("Foundation", "foundation"),
    line("Mass Expansion", "mass-expansion", `${massCount} mass${massCount === 1 ? "" : "es"}`),
    line("Geometry", "architectural-geometry", `${opCount} operation${opCount === 1 ? "" : "s"}`),
    line("Roofs", "roof-composition"),
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
 * failure (those are caught inside each stage and degrade to a fallback; see `runStage`). Says which stage
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
    logPipelineCrash(error, diagnosticsSoFar, upstreamSoFar);
    return providerErrorResponse(error, "architecture-pipeline", { architectureDiagnostics: [...diagnosticsSoFar] });
  }
  let sitePlan: SitePlan | undefined;
  const siteStart = performance.now();
  const siteContext = sitePlanContextForDocument(brief, pipelineResult.document);
  if (siteContext) {
    // `runStage` measures against the same generation-start timer itself. Passing the
    // fixed total budget leaves a real repair window instead of subtracting elapsed time twice.
    const siteResult = await runSitePlanStage(siteContext, timings, GENERATION_BUDGET_MS, usageMeta);
    if (siteResult.ok) sitePlan = siteResult.value;
    else console.warn("[site-plan] using deterministic recovery:", siteResult.errors);
    pipelineResult.diagnostics.push({ stage: "site-plan", status: siteResult.ok ? "ok" : "fallback", durationMs: performance.now() - siteStart, modelCalls: siteResult.attempts, retries: Math.max(0, siteResult.attempts - 1), ...(siteResult.ok ? {} : { error: siteResult.errors.join("; ") }) });
  } else pipelineResult.diagnostics.push({ stage: "site-plan", status: "fallback", durationMs: performance.now() - siteStart, modelCalls: 0, retries: 0, error: "No V2 mass available." });
  const diagnostics = [...pipelineResult.diagnostics, ...compilerDiagnostics(pipelineResult.document)];
  if (process.env.NODE_ENV !== "production") {
    for (const d of diagnostics) console.info(`[architecture-stages] ${d.stage}: ${d.status} (${Math.round(d.durationMs)}ms, ${d.modelCalls} call(s), ${d.retries} retr(y/ies))${d.error ? ` — ${d.error}` : ""}`);
  }
  setDevSession(usageMeta.projectId, {
    input: pipelineInput,
    result: { ...pipelineResult, diagnostics },
    finalAssembly: { assets, recipes, retrieved, spaces, library, baseRevision },
  });
  const response = await runFinalAssembly({ brief, assets, baseRevision, library, usageMeta, timings, pipelineResult: { ...pipelineResult, diagnostics }, recipes, recipeIds, retrieved, recipeRejections: recipeLookup.rejections, spaces, budgetMs: GENERATION_BUDGET_MS, sitePlan });
  // Peek at the response without consuming the body the caller still needs to return: `response.clone()` tees
  // the stream, so this never affects what actually reaches the client.
  let finalAssemblyError: string | undefined;
  if (!response.ok) {
    try { finalAssemblyError = ((await response.clone().json()) as { error?: string }).error; } catch { /* body already consumed/unreadable — logged without it */ }
  }
  logFinalSequence(pipelineResult, diagnostics, { ok: response.ok, status: response.status, error: finalAssemblyError });
  return response;
}
