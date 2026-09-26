import { after, NextRequest, NextResponse } from "next/server";
import { APICallError, generateText, NoObjectGeneratedError, Output } from "ai";
import { buildGenerationResponseSchema, buildPatchResponseSchema, validateOperations } from "@/lib/ai/siteSchema";
import {
  assembleGeneratedProject,
  buildGenerationSystemPrompt,
  buildGenerationUserMessage,
} from "@/lib/ai/generation";
import { buildScopedSystemPrompt } from "@/lib/ai/systemPrompt";
import { buildScopeContext } from "@/lib/ai/context";
import { partitionOpsForScope, scopeFromHint, WORLD_SCOPE } from "@/lib/ai/targeting";
import type { AssetRef } from "@/lib/ai/capabilities";
import { applyPatch } from "@/lib/house/applyPatch";
import { resolveSiteCollisions } from "@/lib/house/architecture/siteCollisions";
import { revisionOf } from "@/lib/house/revision";
import { isBlankSite } from "@/lib/house/blank";
import { AI_NOT_CONFIGURED_MESSAGE, AI_PROVIDER_OPTIONS, getAiModel, getAiModelId, isAiConfigured } from "@/lib/ai/model";
import { createTimings, logTimings } from "@/lib/ai/timing";
import { withUsageLogging, type UsageMeta } from "@/lib/ai/usage/track";
import { attachLibraryAssets } from "@/lib/library/attach";
import { noteRecipeOutcome, recipesForBrief, recordMissingAssetNeeds } from "@/lib/library/service";
import { ASSET_CATEGORIES } from "@/types/library";
import type { AssetIndexEntry } from "@/lib/library/retrieval";

/** Seconds. A mansion brief needs one 30-40 s model call, and a repair pass can need a second. */
export const maxDuration = 300;
/** Stop waiting for the model this long into the request, leaving room to answer before the platform kills the function. */
const GENERATION_BUDGET_MS = 270_000;

const MAX_HISTORY_TURNS = { world: 12, zone: 6, component: 4 } as const;
const MAX_OUTPUT_TOKENS = { world: 8000, zone: 4000, component: 2000 } as const;
const MAX_ASSETS = 40;
/**
 * Initial generation gets one repair pass: validation errors the server cannot fix itself are fed back to the model.
 * Placement, layout and payload problems never reach it — they are repaired locally (see assembleGeneratedProject).
 */
const MAX_GENERATION_ATTEMPTS = 2;

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
  /** Approved reusable objects (GLBs) in the admin's library, so a request one of them fits is not counted as a Need. */
  libraryAssets?: unknown;
}

const MAX_LIBRARY_ASSETS = 500;

const strings = (v: unknown, max = 8): string[] => (Array.isArray(v) ? v.filter((t): t is string => typeof t === "string").slice(0, max).map((t) => t.slice(0, 40)) : []);
const dim = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 1000 ? v : undefined);
const count = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);

/** Untrusted client input: keep only what retrieval reads, in the shapes it expects. */
function parseLibraryAssets(raw: unknown): AssetIndexEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: AssetIndexEntry[] = [];
  for (const a of raw.slice(0, MAX_LIBRARY_ASSETS)) {
    if (typeof a?.id !== "string" || !(ASSET_CATEGORIES as readonly string[]).includes(a.family)) continue;
    const d = typeof a.dimensions === "object" && a.dimensions !== null ? a.dimensions : {};
    out.push({
      id: a.id.slice(0, 80),
      family: a.family,
      styleTags: strings(a.styleTags),
      contextTags: strings(a.contextTags),
      dimensions: { width: dim(d.width), depth: dim(d.depth), height: dim(d.height) },
      successCount: count(a.successCount),
      failureCount: count(a.failureCount),
    });
  }
  return out;
}

function parseAssets(raw: unknown): AssetRef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is AssetRef => typeof a?.id === "string" && typeof a?.name === "string")
    .slice(0, MAX_ASSETS)
    .map((a) => ({ id: a.id, name: a.name.slice(0, 60) }));
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

/** Maps a model-call failure to a clear, actionable response instead of a generic one (or a platform 504). */
function providerErrorResponse(error: unknown) {
  if (isTimeout(error)) {
    return NextResponse.json(
      { error: "The AI took too long to respond. Try again, or start with a shorter brief and add detail afterwards." },
      { status: 504 }
    );
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      return NextResponse.json({ error: "The AI provider is rate-limiting requests right now. Please wait a moment and try again." }, { status: 429 });
    }
    return NextResponse.json(
      { error: `The AI provider returned an error${error.statusCode ? ` (HTTP ${error.statusCode})` : ""}. Please try again.` },
      { status: 502 }
    );
  }
  return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 500 });
}

function parseProjectId(raw: unknown): string | null {
  return typeof raw === "string" && /^[\w-]{1,64}$/.test(raw) ? raw : null;
}

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

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

  if (body.mode === "generate") {
    // Generation only ever starts from a blank project; an existing design is never regenerated here.
    if (!isBlankSite(currentHouseJson)) {
      return NextResponse.json(
        { error: "This project already has a design. Describe what to change instead of generating a new one." },
        { status: 409 }
      );
    }
    return generateInitialDesign(prompt, assets, baseRevision, parseLibraryAssets(body.libraryAssets), {
      projectId,
      requestType: "generation",
      scope: WORLD_SCOPE.level,
      model: getAiModelId(),
    });
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

/** Initial design from a brief: structured output -> typed ops on a blank base -> validated -> returned. */
async function generateInitialDesign(brief: string, assets: AssetRef[], baseRevision: string, library: AssetIndexEntry[], usageMeta: UsageMeta) {
  let errors: string[] = [];
  const timings = createTimings();
  const finish = (outcome: string, attempts: number) => logTimings("generate", timings, { outcome, attempts, briefChars: brief.length });
  let lastAttemptMs = 0;
  // Proven patterns for this brief, if the library has any. A library problem never blocks generation (see `safely`).
  const recipes = await timings.timeAsync("recipeLookup", () => recipesForBrief(brief));
  const recipeIds = recipes.map((r) => r.id);
  void noteRecipeOutcome(recipeIds, "pending");
  try {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      // A repair pass takes about as long as the first call: don't start one that cannot finish inside the budget.
      const remainingMs = GENERATION_BUDGET_MS - timings.elapsed();
      if (attempt > 0 && remainingMs < lastAttemptMs * 1.3) {
        finish("budget_exhausted", attempt);
        return NextResponse.json(
          { error: "The AI took too long to finish that design. Try again, or start with a shorter brief and add detail afterwards." },
          { status: 504 }
        );
      }
      const callStart = performance.now();
      const { output } = await timings.timeAsync(`openai#${attempt + 1}`, () => withUsageLogging(usageMeta, () =>
        generateText({
          model: getAiModel(),
          maxOutputTokens: MAX_OUTPUT_TOKENS.world,
          system: buildGenerationSystemPrompt(assets, recipes),
          messages: [{ role: "user", content: buildGenerationUserMessage(brief, errors) }],
          output: Output.object({ schema: buildGenerationResponseSchema(WORLD_SCOPE, assets.map((a) => a.id)) }),
          providerOptions: AI_PROVIDER_OPTIONS,
          abortSignal: AbortSignal.timeout(Math.max(Math.floor(remainingMs), 1_000)),
          maxRetries: 1,
        })
      ));
      lastAttemptMs = performance.now() - callStart;

      const result = assembleGeneratedProject(output, assets, brief, true, timings);
      if (result.ok) {
        finish("ok", attempt + 1);
        if (result.skipped.length > 0) console.warn("[AI] Rejected generation ops:", result.skipped);
        // The design is built with the procedural version of every object. Where an approved library GLB fits, the
        // feature just references it (assetId); the procedural geometry stays as the fallback.
        const { json } = attachLibraryAssets(result.json, library);
        // Library work that needn't delay the response happens after it.
        after(async () => {
          await noteRecipeOutcome(recipeIds, "success");
          await recordMissingAssetNeeds(json, brief, usageMeta.projectId, library);
        });
        return NextResponse.json({
          summary: output.summary,
          json,
          baseRevision,
          revision: revisionOf(json),
          timeOfDay: result.timeOfDay,
          site: result.site,
          scope: { level: WORLD_SCOPE.level, label: "New design" },
          skipped: result.skipped,
          adjusted: result.adjusted,
        });
      }
      errors = result.errors;
      console.warn(`[AI] Generation attempt ${attempt + 1} failed validation:`, errors);
    }
    finish("invalid_after_retries", MAX_GENERATION_ATTEMPTS);
    after(() => noteRecipeOutcome(recipeIds, "failure"));
    return NextResponse.json(
      { error: "I couldn't produce a valid design from that brief. Try describing it a little differently." },
      { status: 502 }
    );
  } catch (error) {
    finish("error", 0);
    if (NoObjectGeneratedError.isInstance(error)) {
      return NextResponse.json(
        { error: "The AI's response didn't match the design schema. Try rephrasing your brief." },
        { status: 502 }
      );
    }
    console.error("AI initial generation failed:", error);
    return providerErrorResponse(error);
  }
}
