import type { MassVolume, SiteStrategy } from "../document";
import { withVolumePlan } from "../volumePlan";
import { authoredPlan, referenceGeometry } from "./authoredFixtures";

/**
 * A deterministic stand-in for the model behind every V2 generation stage (no live AI call): it recognizes which
 * stage is asking from that stage's system prompt and answers with a complete, authored, valid response — the
 * way a well-behaved architect would. Any stage's answer can be overridden to exercise failure paths.
 */

export const RESPONDER_SITE: SiteStrategy = { environment: "beach", viewDirection: "south", arrivalDirection: "north", terrain: "level" };

/** The single dominant volume the responder's Foundation authors: a canopied, glazed living pavilion with a covered terrace. */
export const RESPONDER_PRIMARY = { name: "Main Living Pavilion", width: 18, depth: 10, floors: 1, plan: authoredPlan("main-living") } as const;

const primaryMass = (): MassVolume => withVolumePlan({ id: "mass-0", name: RESPONDER_PRIMARY.name, role: "main-living", position: { x: 0, z: 0 }, width: RESPONDER_PRIMARY.width, depth: RESPONDER_PRIMARY.depth, floors: 1, elevation: 0, rotation: 0 }, RESPONDER_PRIMARY.plan);

export const responderOutputs = {
  foundation: () => ({
    intent: { mood: ["calm", "drama"], spatialGoals: ["indoor-outdoor", "views"], environmentalGoals: ["shelter"], hierarchyGoals: ["one dominant living pavilion"], compositionBias: "asymmetrical", style: "modern tropical" },
    siteStrategy: { ...RESPONDER_SITE, terrainResponse: "Keep the pavilion level and open to the view." },
    primaryMass: RESPONDER_PRIMARY,
  }),
  massExpansion: () => ({ decision: "done", reasoning: "One dominant pavilion carries this brief; the garage and outdoor rooms belong to the site plan." }),
  geometry: () => { const m = primaryMass(); return { results: [{ massId: "mass-0", operations: referenceGeometry(m, [m], RESPONDER_SITE) }] }; },
  roofs: () => ({ roofs: [{ massId: "mass-0", kind: "floating-flat", overhang: 0.9, pitch: 2, expression: { verticalGap: 0.25 } }] }),
  /** Path end points are left at 0 on purpose: the stage snaps them to the geometry each path names. */
  sitePlan: () => ({
    entrance: { wall: "north", offset: 9 },
    driveway: { wall: "north", offset: 12, width: 5, length: 24 },
    parking: [{ x: 16, z: -18, width: 10, depth: 11 }],
    pool: { wall: "south", offset: 2, distance: 9, width: 14, depth: 5, waterDepth: 1.6 },
    terrace: { wall: "south", offset: 1, width: 16, depth: 6 },
    poolDeck: { x: 0, z: 19, width: 20, depth: 10 },
    paths: [
      { from: "arrival", to: "parking", x1: 0, z1: 0, x2: 0, z2: 0, width: 1.6, bend: 0, surface: "flagstone" },
      { from: "parking", to: "entrance", x1: 0, z1: 0, x2: 0, z2: 0, width: 1.8, bend: 0, surface: "flagstone" },
      { from: "entrance", to: "outdoor-living", x1: 0, z1: 0, x2: 0, z2: 0, width: 1.4, bend: 0, surface: "gravel" },
      { from: "outdoor-living", to: "pool", x1: 0, z1: 0, x2: 0, z2: 0, width: 1.6, bend: 0, surface: "flagstone" },
    ],
    landscape: [
      { purpose: "privacy", kind: "garden", x: -26, z: 0, width: 6, depth: 20 },
      { purpose: "entrance-planting", kind: "garden", x: -8, z: -12, width: 8, depth: 4 },
      { purpose: "pool-planting", kind: "garden", x: 16, z: 20, width: 6, depth: 8 },
      { purpose: "view-framing", kind: "garden", x: -20, z: 26, width: 8, depth: 5 },
    ],
  }),
};

export type ResponderStage = keyof typeof responderOutputs | "finalAssembly";

export function stageOf(system: string): ResponderStage {
  if (system.includes("three foundational decisions")) return "foundation";
  if (system.includes("one volume at a time")) return "massExpansion";
  if (system.includes("authoring the built form")) return "geometry";
  if (system.includes("whole-house roof language")) return "roofs";
  if (system.includes("landscape architect")) return "sitePlan";
  return "finalAssembly";
}

/**
 * `generateText` implementation: authored stage outputs, `finalAssembly` for the one free-form call.
 * `overrides[stage]` replaces a stage's answer (return a rejected promise from it to simulate a provider error).
 */
export function v2StageResponder(finalAssembly: () => unknown, overrides: Partial<Record<ResponderStage, () => unknown>> = {}) {
  return (options: { system: string }) => {
    const stage = stageOf(options.system);
    const answer = overrides[stage] ?? (stage === "finalAssembly" ? finalAssembly : responderOutputs[stage]);
    const output = answer();
    return output instanceof Promise ? output : Promise.resolve({ output, totalUsage: {} });
  };
}
