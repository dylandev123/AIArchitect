import type { ArchitecturalDesign } from "./designEngine";
import type { ArchitecturalDesignDocument, MassRelationship, MassRole, MassVolume, RoofRecipe } from "./document";
import type { CapabilityIntent } from "@/lib/capabilities/types";

type DesignMassRole = ArchitecturalDesign["spacePlan"]["massAssignments"][number]["role"];
type AssignmentId = "living-pavilion" | "private-wing" | "outdoor-pavilion" | "service-spine" | "guest-pavilion";
type UsedComposition = "courtyard" | "pavilion-cluster" | "stepped-terraces" | "rotated-wings" | "rectangular-pavilion";

const ROLE_MAP: Record<DesignMassRole, MassRole> = {
  "main-living": "main-living",
  "private-wing": "bedroom-wing",
  "guest-wing": "guest-pavilion",
  service: "service",
  pavilion: "terrace",
};

const MASS_NAMES: Record<AssignmentId, string> = {
  "living-pavilion": "Main Living Pavilion",
  "private-wing": "Private Bedroom Wing",
  "outdoor-pavilion": "Outdoor Living Pavilion",
  "service-spine": "Service & Garage Spine",
  "guest-pavilion": "Guest Pavilion",
};

/** Exactly one of these strategies is always selected by `selectDesignStrategies`; it decides the layout template. */
const COMPOSITION_BY_STRATEGY: Partial<Record<ArchitecturalDesign["strategies"][number]["name"], UsedComposition>> = {
  "Stepped Hillside": "stepped-terraces",
  "Courtyard Composition": "courtyard",
  "Linear View Bar": "rectangular-pavilion",
  "Pavilion Composition": "pavilion-cluster",
  "Offset Wings": "rotated-wings",
};

interface MassTemplate {
  width: number; depth: number; position: { x: number; z: number }; rotation: number; elevation: number;
  relationships?: MassRelationship[];
}

/**
 * Deterministic geometry per composition, keyed by the fixed mass ids `createSpacePlan` always emits.
 * Relationships here deliberately avoid `side`/`rotationOffset` (except the stepped-terraces elevation
 * pair, which is idempotent with its literal elevation) so `resolveMasses` never overwrites these literal
 * positions/rotations — they stay descriptive, the same pattern the hand-authored fixtures already use.
 */
const TEMPLATES: Record<UsedComposition, Record<AssignmentId, MassTemplate>> = {
  courtyard: {
    "living-pavilion": { width: 16, depth: 7, position: { x: 0, z: 5 }, rotation: 0, elevation: 0 },
    "private-wing": { width: 6, depth: 12, position: { x: -9, z: -1 }, rotation: 0, elevation: 0, relationships: [{ kind: "surrounds-courtyard", target: "living-pavilion" }] },
    "outdoor-pavilion": { width: 10, depth: 5, position: { x: 0, z: -6 }, rotation: 0, elevation: 0, relationships: [{ kind: "view-facing", target: "living-pavilion" }] },
    "service-spine": { width: 7, depth: 10, position: { x: 9, z: -1 }, rotation: 0, elevation: 0, relationships: [{ kind: "surrounds-courtyard", target: "living-pavilion" }, { kind: "arrival-facing", target: "living-pavilion" }] },
    "guest-pavilion": { width: 7, depth: 7, position: { x: 13, z: 6 }, rotation: 0, elevation: 0, relationships: [{ kind: "separated-from", target: "living-pavilion", distance: 4 }] },
  },
  "pavilion-cluster": {
    "living-pavilion": { width: 14, depth: 9, position: { x: 0, z: 0 }, rotation: 0, elevation: 0 },
    "private-wing": { width: 9, depth: 8, position: { x: -15, z: -2 }, rotation: .12, elevation: 0, relationships: [{ kind: "separated-from", target: "living-pavilion", distance: 4 }] },
    "outdoor-pavilion": { width: 8, depth: 8, position: { x: 0, z: -13 }, rotation: 0, elevation: 0, relationships: [{ kind: "view-facing", target: "living-pavilion" }, { kind: "separated-from", target: "living-pavilion", distance: 3 }] },
    "service-spine": { width: 8, depth: 6, position: { x: 14, z: 3 }, rotation: 0, elevation: 0, relationships: [{ kind: "arrival-facing", target: "living-pavilion" }, { kind: "separated-from", target: "living-pavilion", distance: 4 }] },
    "guest-pavilion": { width: 7, depth: 7, position: { x: 16, z: -10 }, rotation: -.15, elevation: 0, relationships: [{ kind: "separated-from", target: "outdoor-pavilion", distance: 4 }] },
  },
  "stepped-terraces": {
    "living-pavilion": { width: 15, depth: 7, position: { x: 0, z: 3 }, rotation: 0, elevation: 0 },
    "private-wing": { width: 9, depth: 6, position: { x: 4, z: -6 }, rotation: .3, elevation: 2.4, relationships: [{ kind: "stepped-above", target: "living-pavilion", distance: 2.4 }, { kind: "offset-from", target: "living-pavilion" }] },
    "outdoor-pavilion": { width: 9, depth: 5, position: { x: -2, z: 9 }, rotation: 0, elevation: -1.2, relationships: [{ kind: "stepped-below", target: "living-pavilion", distance: 1.2 }, { kind: "view-facing", target: "living-pavilion" }] },
    "service-spine": { width: 7, depth: 5, position: { x: -9, z: -4 }, rotation: 0, elevation: 0, relationships: [{ kind: "arrival-facing", target: "living-pavilion" }] },
    "guest-pavilion": { width: 6, depth: 6, position: { x: 10, z: -9 }, rotation: -.2, elevation: 3.6, relationships: [{ kind: "stepped-above", target: "private-wing", distance: 1.2 }] },
  },
  "rotated-wings": {
    "living-pavilion": { width: 14, depth: 8, position: { x: 0, z: 2 }, rotation: 0, elevation: 0 },
    "private-wing": { width: 8, depth: 10, position: { x: -10, z: -5 }, rotation: .22, elevation: 0, relationships: [{ kind: "offset-from", target: "living-pavilion" }] },
    "outdoor-pavilion": { width: 9, depth: 6, position: { x: 3, z: -9 }, rotation: -.1, elevation: 0, relationships: [{ kind: "view-facing", target: "living-pavilion" }] },
    "service-spine": { width: 7, depth: 6, position: { x: 10, z: 5 }, rotation: 0, elevation: 0, relationships: [{ kind: "arrival-facing", target: "living-pavilion" }] },
    "guest-pavilion": { width: 6, depth: 6, position: { x: -14, z: 6 }, rotation: .3, elevation: 0, relationships: [{ kind: "separated-from", target: "private-wing", distance: 3 }] },
  },
  "rectangular-pavilion": {
    "living-pavilion": { width: 20, depth: 6, position: { x: 0, z: 3 }, rotation: 0, elevation: 0 },
    "private-wing": { width: 8, depth: 8, position: { x: -12, z: -5 }, rotation: 0, elevation: 0, relationships: [{ kind: "offset-from", target: "living-pavilion" }] },
    "outdoor-pavilion": { width: 10, depth: 5, position: { x: 0, z: -6 }, rotation: 0, elevation: 0, relationships: [{ kind: "view-facing", target: "living-pavilion" }] },
    "service-spine": { width: 7, depth: 6, position: { x: 12, z: 6 }, rotation: 0, elevation: 0, relationships: [{ kind: "arrival-facing", target: "living-pavilion" }] },
    "guest-pavilion": { width: 6, depth: 6, position: { x: -14, z: 4 }, rotation: 0, elevation: 0, relationships: [{ kind: "separated-from", target: "private-wing", distance: 3 }] },
  },
};

/** Which mass each live capability id attaches to. `deep-overhang` is intentionally absent — see module doc comment. */
const CAPABILITY_TARGETS: Partial<Record<string, AssignmentId[]>> = {
  "corner-glazing": ["living-pavilion", "private-wing"],
  "split-mass": ["private-wing"],
  "step-mass": ["private-wing"],
  "courtyard-composition": ["living-pavilion"],
  "offset-mass": ["private-wing"],
  "recessed-entry": ["service-spine"],
};

function compositionFor(design: ArchitecturalDesign): UsedComposition {
  const strategy = design.strategies.find((s) => COMPOSITION_BY_STRATEGY[s.name]);
  return (strategy && COMPOSITION_BY_STRATEGY[strategy.name]) ?? "rectangular-pavilion";
}

function roofRecipeFor(mass: MassVolume, design: ArchitecturalDesign): RoofRecipe {
  const base = { id: `${mass.id}-roof`, massId: mass.id };
  switch (mass.role) {
    case "main-living":
      // Floating roof + deep overhang + clerestory, all in one non-conflicting expression — see module doc comment.
      return { ...base, kind: "floating-flat", overhang: design.roofComposition.overhang, expression: { verticalGap: .6, supportStyle: "clerestory", clerestoryHeight: .45 } };
    case "bedroom-wing":
      return { ...base, kind: "mono-pitch", overhang: .5 };
    case "terrace":
      return { ...base, kind: design.roofComposition.primary === "butterfly" ? "butterfly" : "flat", overhang: 1 };
    case "guest-pavilion":
      return { ...base, kind: /caribbean|resort/i.test(design.concept.name) ? "hip" : "pavilion" };
    case "service":
    default:
      return { ...base, kind: "flat", overhang: .4 };
  }
}

function buildCapabilityIntents(design: ArchitecturalDesign, presentMassIds: ReadonlySet<AssignmentId>, projectId: string | null | undefined): CapabilityIntent[] {
  const ids = [...new Set(design.strategies.flatMap((s) => s.requiredCapabilities))];
  const intents: CapabilityIntent[] = [];
  for (const id of ids) {
    if (id === "deep-overhang") continue; // baked into the main-living RoofRecipe.expression instead — see module doc comment
    const strategy = design.strategies.find((s) => s.requiredCapabilities.includes(id));
    for (const massId of CAPABILITY_TARGETS[id] ?? []) {
      if (!presentMassIds.has(massId)) continue;
      intents.push({ id, stage: strategy?.name ?? "design-strategy", parameters: { massId }, projectId: projectId ?? null });
    }
  }
  return intents;
}

/**
 * The missing conversion from System A (why: intent/strategy/space-plan) to System B (what: real
 * mass geometry the compiler can render). `createSpacePlan` always emits the same fixed mass ids;
 * this picks one of five deterministic layout templates keyed by whichever composition strategy won.
 *
 * `deep-overhang` is deliberately never turned into a live `CapabilityIntent`: its plugin and a
 * `floating-flat` `RoofRecipe` both independently call `buildRoofExpression()`, so applying both to
 * the same mass produces duplicate, overlapping roof geometry. The overhang effect is instead baked
 * directly into the main-living mass's `RoofRecipe.overhang`, which `design.roofComposition.overhang`
 * already computes correctly for this case. `architecturalCapabilityRequests()` (the separate,
 * already-wired learning-loop function) is unaffected and keeps reporting `deep-overhang` for learning.
 */
export function buildArchitecturalDesignDocument(
  design: ArchitecturalDesign,
  brief: string,
  options?: { projectId?: string | null }
): ArchitecturalDesignDocument {
  const composition = compositionFor(design);
  const template = TEMPLATES[composition];
  const masses: MassVolume[] = design.spacePlan.massAssignments.map((assignment) => {
    const id = assignment.id as AssignmentId;
    const geometry = template[id];
    return {
      id, name: MASS_NAMES[id], role: ROLE_MAP[assignment.role],
      position: geometry.position, width: geometry.width, depth: geometry.depth, floors: 1,
      elevation: geometry.elevation, rotation: geometry.rotation, relationships: geometry.relationships,
    };
  });
  const presentMassIds = new Set(masses.map((m) => m.id as AssignmentId));

  return {
    version: 1,
    brief,
    siteStrategy: {
      environment: design.siteAnalysis.environment,
      viewDirection: design.siteAnalysis.viewDirection,
      arrivalDirection: design.intent.source.arrivalDirection,
      terrain: composition === "stepped-terraces" ? "stepped" : "level",
    },
    massing: { composition, masses },
    roofs: { recipes: masses.map((mass) => roofRecipeFor(mass, design)) },
    capabilities: buildCapabilityIntents(design, presentMassIds, options?.projectId),
    facade: { status: "pending" },
    architecturalStyle: { status: "pending" },
    outdoorPlan: { status: "pending" },
    materialStrategy: { status: "pending" },
    components: { status: "pending" },
    furnishings: { status: "pending" },
    metadata: { createdAt: new Date().toISOString(), source: "live-generation", compiler: "procedural-architecture-v1" },
  };
}
