import { NextResponse, after } from "next/server";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { buildGenerationResponseSchema, type AiGenerationResponse } from "@/lib/ai/siteSchema";
import { assembleGeneratedProject, buildGenerationSystemPrompt, buildGenerationUserMessage } from "@/lib/ai/generation";
import { WORLD_SCOPE } from "@/lib/ai/targeting";
import type { AssetRef } from "@/lib/ai/capabilities";
import { revisionOf } from "@/lib/house/revision";
import { AI_PROVIDER_OPTIONS, getAiModel } from "@/lib/ai/model";
import type { Timings } from "@/lib/ai/timing";
import { logTimings } from "@/lib/ai/timing";
import { withUsageLogging, type UsageMeta } from "@/lib/ai/usage/track";
import { attachOutdoorAssets } from "@/lib/outdoor/placements";
import { attachLibraryAssets } from "@/lib/library/attach";
import { noteRecipeOutcome } from "@/lib/library/service";
import { runPostGeneration } from "@/lib/library/generationLoop";
import type { RetrievedRecipe } from "@/lib/library/spaceRecipes";
import type { OutdoorSpace } from "@/lib/outdoor/spaces";
import type { AssetIndexEntry } from "@/lib/library/retrieval";
import { architecturalAssetRequests, architecturalCapabilityRequests } from "@/lib/architecture/designEngine";
import { validateArchitecturalDesignDocument } from "@/lib/architecture/document";
import { pickDominantMass, ROOF_KIND_TO_LEGACY_TYPE } from "@/lib/architecture/compiler";
import { v2SiteFrameForDocument } from "@/lib/architecture/siteFrame";
import type { PipelineResult } from "@/lib/architecture/stages/pipeline";
import type { DesignRecipe, ReportRecipeRejection } from "@/types/library";
import { providerErrorResponse } from "./providerErrors";
import { sitePlanOperations, type SitePlan } from "@/lib/architecture/stages/sitePlanStage";
import { architectureAuthorityHash } from "@/lib/architecture/stages/authority";
import { runV2IntegrityGate } from "@/lib/architecture/stages/integrityGate";
import type { StageDiagnostics } from "@/lib/architecture/stages/diagnostics";
import { v2FailureResponse } from "./v2Failure";

export { sitePlanContextForDocument } from "@/lib/architecture/sitePlanContext";

/**
 * A repair pass takes about as long as the first call: don't start one that cannot finish inside the budget.
 * Initial generation gets one repair pass: validation errors the server cannot fix itself are fed back to the
 * model. Placement, layout and payload problems never reach it — they are repaired locally (see assembleGeneratedProject).
 */
export const MAX_GENERATION_ATTEMPTS = 2;
export const FINAL_ASSEMBLY_MAX_OUTPUT_TOKENS = 8000;

export interface FinalAssemblyParams {
  brief: string;
  assets: AssetRef[];
  baseRevision: string;
  library: AssetIndexEntry[];
  usageMeta: UsageMeta;
  timings: Timings;
  /** Already-produced architecture pipeline output — never recomputed here, whether this is a fresh generation or a Replay. */
  pipelineResult: PipelineResult;
  recipes: DesignRecipe[];
  recipeIds: string[];
  retrieved: readonly RetrievedRecipe[];
  recipeRejections?: readonly ReportRecipeRejection[];
  spaces: OutdoorSpace[];
  /** Total ms this call may spend, measured from `timings`'s own start (not from when this function was entered). */
  budgetMs: number;
  /** The canonical V2 Site Plan as the Site Plan stage accepted it. Required: there is no legacy site design to fall back to. */
  sitePlan: SitePlan;
  /** `sitePlanAuthorityHash` of `sitePlan`, taken when the stage accepted it. */
  sitePlanHash: string;
}

/**
 * The mandatory tail of initial generation: the one large free-form call that decides facade, materials,
 * openings, siting of outdoor features, rooms, etc. — everything the architecture stages (Intent..Roof
 * Composition) don't decide. Split out so a dev-only Replay of just this stage can rerun it alone, reusing
 * an already-produced `pipelineResult` instead of recomputing the whole staged sub-pipeline.
 *
 * It reads the architecture and the canonical Site Plan and may write neither. Before anything is returned,
 * reported or learned from, the assembled project JSON goes through the final V2 integrity gate; a blocking
 * finding means there is no successful generation — no `json` leaves this function and nothing is persisted.
 */
export async function runFinalAssembly(params: FinalAssemblyParams): Promise<NextResponse> {
  const { brief, assets, baseRevision, library, usageMeta, timings, pipelineResult, recipes, recipeIds, retrieved, recipeRejections = [], spaces, budgetMs } = params;
  const design = pipelineResult.design;
  const architecturalDesignDocument = pipelineResult.document;
  // Final Assembly owns compatibility/support data only. Keep a boundary fingerprint so future assembly
  // work cannot silently turn into an architecture writer.
  const architectureAtEntry = architectureAuthorityHash(architecturalDesignDocument);
  const docErrors = validateArchitecturalDesignDocument(architecturalDesignDocument);
  // An invalid V2 document is a failed generation. The legacy shell is never a stand-in for it.
  if (docErrors.length) return v2FailureResponse("v2-generation-failed", "final-assembly", docErrors.map((e) => `invalid architecture document: ${e}`), pipelineResult.diagnostics);
  if (pipelineResult.massExpansionStopMessage) console.info(`[architecture-stages] ${pipelineResult.massExpansionStopMessage}`);

  // A valid V2 document already owns the real massing/roof/openings — compileArchitecture never reads
  // output.house, and the legacy shell those fields would otherwise describe is discarded entirely in favor
  // of it (see HouseRenderer.tsx). Final Assembly is not asked to author `house` for a V2 project at all;
  // instead a legacy-shaped `house` is synthesized here from the document's own dominant mass — genuinely
  // required downstream (room/outdoor placement math, collision avoidance) but never rendered, so getting it
  // from the real massing instead of a freely-invented model guess is strictly more correct, not just cheaper.
  const dominantMass = pickDominantMass(architecturalDesignDocument.massing.masses);
  const synthesizedHouse: AiGenerationResponse["house"] | undefined = dominantMass ? {
    width: dominantMass.width, depth: dominantMass.depth, floors: dominantMass.floors,
    roof: ROOF_KIND_TO_LEGACY_TYPE[architecturalDesignDocument.roofs.recipes.find((r) => r.massId === dominantMass.id)?.kind ?? "flat"],
  } : undefined;

  // Site authority mirrors V2 architecture: the accepted plan is executed verbatim (paths carried around the
  // building between their authored end points). There is no deterministic site design behind it.
  const authoredSitePlan = params.sitePlan;
  const authoredSiteOps = sitePlanOperations(authoredSitePlan, v2SiteFrameForDocument(architecturalDesignDocument)?.masses);

  let errors: string[] = [];
  let lastAttemptMs = 0;
  const finish = (outcome: string, attempts: number) => logTimings("generate", timings, { outcome, attempts, briefChars: brief.length });
  // Same dev-only diagnostics the success branch below attaches — a final-assembly failure must never hide
  // how the architecture pipeline stages before it actually went (see route.ts's final-sequence log for the
  // server-side version of this same guarantee).
  const isDev = process.env.NODE_ENV !== "production";
  const devDiagnostics = isDev ? { architectureDiagnostics: pipelineResult.diagnostics, capabilityRequests: pipelineResult.capabilityRequests } : {};
  void noteRecipeOutcome(recipeIds, "pending");
  try {
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
      const remainingMs = budgetMs - timings.elapsed();
      if (attempt > 0 && remainingMs < lastAttemptMs * 1.3) {
        finish("budget_exhausted", attempt);
        return NextResponse.json(
          { error: "The AI took too long to finish that design. Try again, or start with a shorter brief and add detail afterwards.", ...(isDev ? { stage: "final-assembly" } : {}), ...devDiagnostics },
          { status: 504 }
        );
      }
      const callStart = performance.now();
      const { output: rawOutput } = await timings.timeAsync(`openai#${attempt + 1}`, () => withUsageLogging(usageMeta, () =>
        generateText({
          model: getAiModel(),
          maxOutputTokens: FINAL_ASSEMBLY_MAX_OUTPUT_TOKENS,
          system: buildGenerationSystemPrompt(assets, recipes, spaces, design, synthesizedHouse ? { floors: synthesizedHouse.floors } : undefined),
          messages: [{ role: "user", content: buildGenerationUserMessage(brief, errors) }],
          output: Output.object({ schema: buildGenerationResponseSchema(WORLD_SCOPE, assets.map((a) => a.id), synthesizedHouse !== undefined) }),
          providerOptions: AI_PROVIDER_OPTIONS,
          abortSignal: AbortSignal.timeout(Math.max(Math.floor(remainingMs), 1_000)),
          maxRetries: 1,
        })
      ));
      lastAttemptMs = performance.now() - callStart;
      // The schema never asked for `house` in the V2 branch (see buildGenerationResponseSchema's `forV2`), so
      // `rawOutput` has none — merged in here, unconditionally, before anything downstream reads it.
      const output: AiGenerationResponse = synthesizedHouse ? { ...rawOutput, house: synthesizedHouse } : rawOutput;

      const result = assembleGeneratedProject(output, assets, brief, true, timings, authoredSiteOps);
      if (result.ok) {
        if (architectureAuthorityHash(architecturalDesignDocument) !== architectureAtEntry) {
          throw new Error("[v2-authority] final-assembly mutated the architecture document.");
        }
        if (result.skipped.length > 0) console.warn("[AI] Rejected generation ops:", result.skipped);
        // The design is built with the procedural version of every object. Where an approved library GLB fits, the
        // feature just references it (assetId); the procedural geometry stays as the fallback.
        // The architectural concept is structured project data, not a prose note or a GLB. It makes the design intent
        // available to rendering, review and learning while the proven scene JSON remains the source of geometry.
        const conceivedJson = JSON.stringify({
          ...JSON.parse(result.json),
          architecture: design,
          sitePlan: authoredSitePlan,
          architecturalDesignDocument,
        });
        const attachedResult = attachLibraryAssets(conceivedJson, library);
        const attached = attachedResult.attached;
        const json = attachOutdoorAssets(attachedResult.json, brief, library);
        // The final V2 integrity gate: the exact JSON about to be returned, after every authoritative stage and
        // all deterministic execution, before the learning loop stores anything about it.
        const gateStart = performance.now();
        const gate = timings.time("integrityGate", () => runV2IntegrityGate({ json, brief, authority: { architectureHash: pipelineResult.authority.architectureHash, sitePlanHash: params.sitePlanHash } }));
        const gateDiagnostics: StageDiagnostics = {
          stage: "quality-gate", status: gate.passed ? "ok" : "error", outcome: gate.outcome, durationMs: performance.now() - gateStart, modelCalls: 0, retries: 0,
          ...(gate.blocking.length ? { error: gate.blocking.map((c) => `${c.id}: ${c.detail}`).join("; ") } : {}),
          ...(gate.warnings.length || gate.normalizations.length ? { warnings: [...gate.warnings.map((c) => `${c.id}: ${c.detail}`), ...gate.normalizations] } : {}),
        };
        const finalDiagnostics = [...pipelineResult.diagnostics.filter((d) => d.stage !== "quality-gate"), gateDiagnostics];
        if (!gate.passed) {
          finish("integrity_blocked", attempt + 1);
          after(() => noteRecipeOutcome(recipeIds, "failure"));
          return v2FailureResponse("v2-integrity-blocked", "integrity-gate", gate.blocking.map((c) => `${c.id}: ${c.detail}`), finalDiagnostics);
        }
        finish("ok", attempt + 1);
        // The learning loop: spaces → Knowledge → Asset Needs → starter Plans → recipe outcomes, written in one transaction and
        // reported. It is awaited (bounded by its own timeout) so the report says what was actually stored; it never throws.
        const capabilityRequests = [...architecturalCapabilityRequests(design), ...pipelineResult.capabilityRequests];
        const intelligence = await timings.timeAsync("learning", () => runPostGeneration({ json, brief, projectId: usageMeta.projectId, library, retrieved, recipeRejections, sitePlan: authoredSitePlan, attached, architecturalRequests: architecturalAssetRequests(design, usageMeta.projectId), capabilityRequests, architecturalDesign: design }));
        return NextResponse.json({
          summary: output.summary,
          json,
          baseRevision,
          revision: revisionOf(json),
          timeOfDay: result.timeOfDay,
          site: result.site,
          scope: { level: WORLD_SCOPE.level, label: "New design" },
          skipped: result.skipped,
          adjusted: [...result.notes, ...result.adjusted],
          intelligence,
          ...(process.env.NODE_ENV !== "production" ? { architectureDiagnostics: finalDiagnostics, capabilityRequests: pipelineResult.capabilityRequests } : {}),
        });
      }
      errors = result.errors;
      console.warn(`[AI] Generation attempt ${attempt + 1} failed validation:`, errors);
    }
    finish("invalid_after_retries", MAX_GENERATION_ATTEMPTS);
    after(() => noteRecipeOutcome(recipeIds, "failure"));
    return NextResponse.json(
      { error: "I couldn't produce a valid design from that brief. Try describing it a little differently.", ...(isDev ? { stage: "final-assembly" } : {}), ...devDiagnostics },
      { status: 502 }
    );
  } catch (error) {
    finish("error", 0);
    if (NoObjectGeneratedError.isInstance(error)) {
      return NextResponse.json(
        { error: "The AI's response didn't match the design schema. Try rephrasing your brief.", ...(isDev ? { stage: "final-assembly" } : {}), ...devDiagnostics },
        { status: 502 }
      );
    }
    console.error("AI initial generation failed:", error);
    return providerErrorResponse(error, "final-assembly", devDiagnostics);
  }
}
