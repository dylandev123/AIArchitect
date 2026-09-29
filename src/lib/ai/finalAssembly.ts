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
import { validateArchitecturalDesignDocument, type ArchitecturalDesignDocument } from "@/lib/architecture/document";
import { pickDominantMass, ROOF_KIND_TO_LEGACY_TYPE } from "@/lib/architecture/compiler";
import type { PipelineResult } from "@/lib/architecture/stages/pipeline";
import type { DesignRecipe } from "@/types/library";
import { providerErrorResponse } from "./providerErrors";
import { runSitePlanStage, sitePlanOperations, type SitePlan } from "@/lib/architecture/stages/sitePlanStage";

/** V2 opening coordinates projected into the renderer's world frame (x=east, z=south). */
function v2EntrancePoints(document: ArchitecturalDesignDocument): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = [];
  for (const mass of document.massing.masses) for (const opening of mass.openings ?? []) {
    if (opening.type !== "door" || (opening.floors && opening.floors !== "ground" && opening.floors !== "all")) continue;
    const u = (opening.start + opening.end) / 2;
    let x = 0, z = 0;
    if (opening.facade === "north") { x = (u - .5) * mass.width; z = -mass.depth / 2; }
    if (opening.facade === "south") { x = (u - .5) * mass.width; z = mass.depth / 2; }
    if (opening.facade === "east") { x = mass.width / 2; z = (u - .5) * mass.depth; }
    if (opening.facade === "west") { x = -mass.width / 2; z = (u - .5) * mass.depth; }
    const c = Math.cos(mass.rotation), s = Math.sin(mass.rotation);
    points.push({ x: mass.position.x + x * c + z * s, z: mass.position.z - x * s + z * c });
  }
  return points;
}

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
  spaces: OutdoorSpace[];
  /** Total ms this call may spend, measured from `timings`'s own start (not from when this function was entered). */
  budgetMs: number;
}

/**
 * The mandatory tail of initial generation: the one large free-form call that decides facade, materials,
 * openings, siting of outdoor features, rooms, etc. — everything the architecture stages (Intent..Roof
 * Composition) don't decide. Split out so a dev-only Replay of just this stage can rerun it alone, reusing
 * an already-produced `pipelineResult` instead of recomputing the whole staged sub-pipeline.
 */
export async function runFinalAssembly(params: FinalAssemblyParams): Promise<NextResponse> {
  const { brief, assets, baseRevision, library, usageMeta, timings, pipelineResult, recipes, recipeIds, retrieved, spaces, budgetMs } = params;
  const design = pipelineResult.design;
  const architecturalDesignDocument = pipelineResult.document;
  const docErrors = validateArchitecturalDesignDocument(architecturalDesignDocument);
  if (docErrors.length) console.warn("[architecture-stages] invalid document, falling back to legacy shell:", docErrors);
  if (pipelineResult.massExpansionStopMessage) console.info(`[architecture-stages] ${pipelineResult.massExpansionStopMessage}`);

  // A valid V2 document already owns the real massing/roof/openings — compileArchitecture never reads
  // output.house, and the legacy shell those fields would otherwise describe is discarded entirely in favor
  // of it (see HouseRenderer.tsx). Final Assembly is not asked to author `house` for a V2 project at all;
  // instead a legacy-shaped `house` is synthesized here from the document's own dominant mass — genuinely
  // required downstream (room/outdoor placement math, collision avoidance) but never rendered, so getting it
  // from the real massing instead of a freely-invented model guess is strictly more correct, not just cheaper.
  const dominantMass = docErrors.length === 0 ? pickDominantMass(architecturalDesignDocument.massing.masses) : undefined;
  const synthesizedHouse: AiGenerationResponse["house"] | undefined = dominantMass ? {
    width: dominantMass.width, depth: dominantMass.depth, floors: dominantMass.floors,
    roof: ROOF_KIND_TO_LEGACY_TYPE[architecturalDesignDocument.roofs.recipes.find((r) => r.massId === dominantMass.id)?.kind ?? "flat"],
  } : undefined;

  // Site authority mirrors V2 architecture: a complete authored plan is executed verbatim, while a failed
  // Site Plan call leaves the established scale/site-rule system as the deterministic recovery path.
  let authoredSiteOps: ReturnType<typeof sitePlanOperations> | undefined;
  let authoredSitePlan: SitePlan | undefined;
  if (synthesizedHouse) {
    const siteResult = await runSitePlanStage({ brief, house: synthesizedHouse, viewDirection: architecturalDesignDocument.siteStrategy.viewDirection, arrivalDirection: architecturalDesignDocument.siteStrategy.arrivalDirection, entrancePoints: v2EntrancePoints(architecturalDesignDocument) }, timings, budgetMs - timings.elapsed(), usageMeta);
    if (siteResult.ok) { authoredSitePlan = siteResult.value; authoredSiteOps = sitePlanOperations(siteResult.value); }
    else console.warn("[site-plan] using deterministic recovery:", siteResult.errors);
  }

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
        finish("ok", attempt + 1);
        if (result.skipped.length > 0) console.warn("[AI] Rejected generation ops:", result.skipped);
        // The design is built with the procedural version of every object. Where an approved library GLB fits, the
        // feature just references it (assetId); the procedural geometry stays as the fallback.
        // The architectural concept is structured project data, not a prose note or a GLB. It makes the design intent
        // available to rendering, review and learning while the proven scene JSON remains the source of geometry.
        const conceivedJson = JSON.stringify({
          ...JSON.parse(result.json),
          architecture: design,
          ...(authoredSitePlan ? { sitePlan: authoredSitePlan } : {}),
          ...(docErrors.length ? {} : { architecturalDesignDocument }),
        });
        const attachedResult = attachLibraryAssets(conceivedJson, library);
        const attached = attachedResult.attached;
        const json = attachOutdoorAssets(attachedResult.json, brief, library);
        // The learning loop: spaces → Knowledge → Asset Needs → starter Plans → recipe outcomes, written in one transaction and
        // reported. It is awaited (bounded by its own timeout) so the report says what was actually stored; it never throws.
        const capabilityRequests = [...architecturalCapabilityRequests(design), ...pipelineResult.capabilityRequests];
        const intelligence = await timings.timeAsync("learning", () => runPostGeneration({ json, brief, projectId: usageMeta.projectId, library, retrieved, attached, architecturalRequests: architecturalAssetRequests(design, usageMeta.projectId), capabilityRequests, architecturalDesign: design }));
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
          ...(process.env.NODE_ENV !== "production" ? { architectureDiagnostics: pipelineResult.diagnostics, capabilityRequests: pipelineResult.capabilityRequests } : {}),
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
