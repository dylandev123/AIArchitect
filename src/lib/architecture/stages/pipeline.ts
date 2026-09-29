import type { CompassSide, ProjectScale, SiteEnvironment } from "@/types/house";
import type { DesignRecipe, CapabilityRequest } from "@/types/library";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { Timings } from "@/lib/ai/timing";
import type { SiteHints } from "@/lib/house/siteSettings";
import type { ArchitecturalDesign } from "../designEngine";
import type { ArchitecturalDesignDocument, MassVolume, RoofRecipe } from "../document";
import { runIntentStage } from "./intentStage";
import { runSiteStrategyStage } from "./siteStrategyStage";
import { runPrimaryMassStage } from "./primaryMassStage";
import { runMassExpansionStage } from "./massExpansionStage";
import { runRoofStage } from "./roofStage";
import { toArchitecturalDesign } from "./toArchitecturalDesign";

const TOTAL_STAGES = 5;

export type PipelineStageEvent =
  | { type: "stage"; stage: "intent" | "site-strategy" | "primary-mass" | "mass-expansion" | "roof-composition"; index: number; of: typeof TOTAL_STAGES; document: ArchitecturalDesignDocument }
  | { type: "mass-added"; stage: "mass-expansion"; massesSoFar: number; document: ArchitecturalDesignDocument }
  | { type: "roof-added"; stage: "roof-composition"; massId: string; roofsSoFar: number; totalMasses: number; document: ArchitecturalDesignDocument };

export interface PipelineInput {
  brief: string;
  hints: SiteHints;
  scale?: ProjectScale;
  recipes?: readonly DesignRecipe[];
  availableCapabilities?: readonly string[];
  variationSeed?: string;
  projectId?: string | null;
}

export interface PipelineResult {
  document: ArchitecturalDesignDocument;
  design: ArchitecturalDesign;
  capabilityRequests: CapabilityRequest[];
  massExpansionLog: { massId: string; reasoning: string }[];
  truncated: boolean;
}

const draftDocument = (brief: string, siteStrategy: ArchitecturalDesignDocument["siteStrategy"], masses: readonly MassVolume[], roofs: readonly RoofRecipe[], capabilities: ArchitecturalDesignDocument["capabilities"]): ArchitecturalDesignDocument => {
  const pending = { status: "pending" as const };
  const courtyard = masses.some((m) => m.relationships?.some((r) => r.kind === "surrounds-courtyard"));
  const composition = siteStrategy.terrain === "stepped" ? "stepped-terraces" : courtyard ? "courtyard" : "pavilion-cluster";
  return {
    version: 1, brief, siteStrategy, massing: { composition, masses }, roofs: { recipes: roofs }, capabilities,
    facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
    metadata: { createdAt: new Date().toISOString(), source: "stage-pipeline", compiler: "procedural-architecture-v1" },
  };
};

/**
 * Orchestrates Stages 1-5 (Intent, Site Strategy, Primary Mass, Recursive Mass Expansion, Roof
 * Composition) as real bounded model calls, calling `onEvent` after every stage AND after every
 * individual mass/roof so a streaming caller can update the viewport as the design grows. A
 * non-streaming caller can pass a no-op `onEvent` and just use the final `document`.
 */
export async function runArchitecturePipeline(input: PipelineInput, timings: Timings, budgetMs: number, usageMeta: UsageMeta, onEvent: (event: PipelineStageEvent) => void = () => {}): Promise<PipelineResult> {
  const environment: SiteEnvironment = input.hints.environment ?? "suburban";
  const viewDirection: CompassSide = input.hints.viewDirection ?? "south";
  const arrivalDirection: CompassSide = input.hints.approachSide ?? "north";

  const intentResult = await runIntentStage({ brief: input.brief, environment, scale: input.scale, viewDirection, arrivalDirection }, timings, budgetMs, usageMeta);
  const intent = intentResult.ok ? intentResult.value : fallbackIntent({ environment, scale: input.scale, viewDirection, arrivalDirection });
  onEvent({ type: "stage", stage: "intent", index: 1, of: TOTAL_STAGES, document: draftDocument(input.brief, { environment, viewDirection, arrivalDirection, terrain: "level" }, [], [], undefined) });

  const siteResult = await runSiteStrategyStage({ brief: input.brief, intent, hints: input.hints }, timings, budgetMs, usageMeta);
  const siteStrategy = siteResult.ok ? siteResult.value : { environment, viewDirection, arrivalDirection, terrain: "level" as const };
  const terrainResponse = siteResult.ok ? "" : "Kept level; the staged terrain-response call was unavailable.";
  onEvent({ type: "stage", stage: "site-strategy", index: 2, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, [], [], undefined) });

  const primaryResult = await runPrimaryMassStage({ brief: input.brief, intent, siteStrategy }, timings, budgetMs, usageMeta);
  const primaryMass: MassVolume = primaryResult.ok ? primaryResult.value : { id: "mass-0", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0 };
  onEvent({ type: "stage", stage: "primary-mass", index: 3, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, [primaryMass], [], undefined) });

  const expansion = await runMassExpansionStage({ brief: input.brief, intent, siteStrategy, primaryMass }, timings, budgetMs, usageMeta, (masses) => {
    onEvent({ type: "mass-added", stage: "mass-expansion", massesSoFar: masses.length, document: draftDocument(input.brief, siteStrategy, masses, [], undefined) });
  });
  onEvent({ type: "stage", stage: "mass-expansion", index: 4, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, expansion.masses, [], expansion.capabilityIntents) });

  const roofs: RoofRecipe[] = [];
  for (const mass of expansion.masses) {
    const neighborRoofs = roofs.map((r) => ({ massId: r.massId, kind: r.kind }));
    const roofResult = await runRoofStage({ intent, siteStrategy, mass, neighborRoofs }, timings, budgetMs, usageMeta);
    roofs.push(roofResult.ok ? roofResult.value : { id: `${mass.id}-roof`, massId: mass.id, kind: "flat", overhang: 0.6 });
    onEvent({ type: "roof-added", stage: "roof-composition", massId: mass.id, roofsSoFar: roofs.length, totalMasses: expansion.masses.length, document: draftDocument(input.brief, siteStrategy, expansion.masses, roofs, expansion.capabilityIntents) });
  }
  onEvent({ type: "stage", stage: "roof-composition", index: 5, of: TOTAL_STAGES, document: draftDocument(input.brief, siteStrategy, expansion.masses, roofs, expansion.capabilityIntents) });

  const document = draftDocument(input.brief, siteStrategy, expansion.masses, roofs, expansion.capabilityIntents);
  const design = toArchitecturalDesign({
    brief: input.brief, intent, siteStrategy, terrainResponse, masses: expansion.masses, roofs,
    recipes: input.recipes, availableCapabilities: input.availableCapabilities, variationSeed: input.variationSeed,
  });
  return { document, design, capabilityRequests: [...expansion.capabilityRequests], massExpansionLog: expansion.log, truncated: expansion.truncated };
}

function fallbackIntent(source: { environment: SiteEnvironment; scale?: ProjectScale; viewDirection: CompassSide; arrivalDirection: CompassSide }): import("../designEngine").ArchitecturalIntent {
  return {
    mood: ["calm"], spatialGoals: ["openness"], environmentalGoals: ["daylight"],
    hierarchyGoals: ["legible main living volume"], compositionBias: "asymmetrical",
    source: { environment: source.environment, scale: source.scale, viewDirection: source.viewDirection, arrivalDirection: source.arrivalDirection, style: "contemporary" },
  };
}
