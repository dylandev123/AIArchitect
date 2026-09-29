import type { RoofType } from "@/types/house";
import type { ArchitecturalDesign, SpaceRelationship } from "../designEngine";
import { createSpacePlan, selectDesignStrategies } from "../designEngine";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassRelationshipKind, MassRole, MassVolume, RoofRecipe, RoofRecipeKind, SiteStrategy } from "../document";

type DesignMassRole = ArchitecturalDesign["masses"][number]["role"];

/** Inverse of `ROLE_MAP` in bridge.ts, extended for the two roles the recursive loop can propose that the legacy enum never had. */
const DESIGN_ROLE: Record<MassRole, DesignMassRole> = {
  "main-living": "main-living", "bedroom-wing": "private-wing", "guest-pavilion": "guest-wing",
  service: "service", terrace: "pavilion", veranda: "pavilion", entry: "pavilion", garage: "service", connector: "pavilion",
};

/** Mirrors the map in `projectArchitectureToLegacy` (compiler.ts). */
const ROOF_TYPE: Record<RoofRecipeKind, RoofType> = {
  flat: "flat", "floating-flat": "flat", shed: "shed", "mono-pitch": "shed", gable: "gable",
  hip: "hip", butterfly: "butterfly", pavilion: "hip", "cross-gable": "gable", mixed: "flat",
};

const LEGACY_RELATIONSHIP: Record<MassRelationshipKind, SpaceRelationship["relationship"]> = {
  "adjacent-to": "adjacent", "connected-to": "adjacent", "bridge-between": "adjacent",
  "offset-from": "buffered", "stepped-above": "buffered", "stepped-below": "buffered",
  "separated-from": "separated", "surrounds-courtyard": "buffered", "view-facing": "faces-view", "arrival-facing": "arrival-facing",
};

const relationshipToDesign = (r: SpaceRelationship["relationship"]): ArchitecturalDesign["spaceRelationships"][number]["relationship"] =>
  r === "adjacent" || r === "outdoor-connected" ? "direct" : r === "faces-view" || r === "arrival-facing" ? "framed" : r === "separated" ? "separate" : "buffered";

function describeRelationships(mass: MassVolume): string {
  if (!mass.relationships?.length) return "anchors the composition";
  return mass.relationships.map((r) => `${r.kind.replace(/-/g, " ")} ${r.target}`).join("; ");
}

const paletteFor = (style: string): string[] => {
  const s = style.toLowerCase();
  if (/tropical|caribbean|balinese|resort/.test(s)) return ["board-formed concrete", "travertine", "natural teak", "black aluminum"];
  return ["charcoal stucco", "limestone", "black aluminum", "corten steel"];
};

const roofDetailsFor = (recipes: readonly RoofRecipe[]): string[] => {
  const details: string[] = [];
  if (recipes.some((r) => r.kind === "floating-flat")) details.push("floating roof plane");
  if (recipes.some((r) => r.expression?.supportStyle === "clerestory")) details.push("clerestory band");
  if (recipes.some((r) => (r.overhang ?? 0) > 1)) details.push("deep overhang");
  if (new Set(recipes.map((r) => r.kind)).size > 1) details.push("mixed roof families across masses");
  return details.length ? details : ["continuous fascia"];
};

/**
 * Builds the legacy `ArchitecturalDesign` critic.ts/generationLoop.ts already consume, from the REAL
 * masses/roofs the staged pipeline produced — not from a deterministic template. `strategies` and
 * `spacePlan` are still produced by the existing deterministic functions (they're advisory/learning-loop
 * inputs, not geometry), so this is additive rather than a second parallel implementation.
 */
export function toArchitecturalDesign(input: {
  brief: string; intent: ArchitecturalIntent; siteStrategy: SiteStrategy; terrainResponse: string;
  masses: readonly MassVolume[]; roofs: readonly RoofRecipe[];
  recipes?: readonly import("@/types/library").DesignRecipe[]; availableCapabilities?: readonly string[]; variationSeed?: string;
}): ArchitecturalDesign {
  const strategies = selectDesignStrategies(input.intent, input.recipes, input.availableCapabilities, input.variationSeed);
  const spacePlan = createSpacePlan(input.intent, strategies);
  const palette = paletteFor(input.intent.source.style);
  const roofByMass = new Map(input.roofs.map((r) => [r.massId, r]));
  const main = input.masses.find((m) => m.role === "main-living") ?? input.masses[0];
  const mainRoof = main ? roofByMass.get(main.id) : undefined;
  const others = input.masses.filter((m) => m.id !== main?.id);
  const secondaryKind = others.map((m) => roofByMass.get(m.id)?.kind).find((k) => k && k !== mainRoof?.kind) ?? mainRoof?.kind ?? "flat";
  const overhangs = input.roofs.map((r) => r.overhang).filter((o): o is number => typeof o === "number");
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  const spaceRelationships: ArchitecturalDesign["spaceRelationships"] = input.masses.flatMap((mass) =>
    (mass.relationships ?? []).map((rel) => ({ from: mass.id, to: rel.target, relationship: relationshipToDesign(LEGACY_RELATIONSHIP[rel.kind]) }))
  );

  return {
    version: 1,
    pipeline: ["brief", "architectural-intent", "design-strategy", "space-planning", "massing", "space-relationships", "roof-composition", "facade-language", "components", "outdoor-spaces", "landscape", "retrieve-library", "generate-recipes", "generate-assets", "assemble", "learn"],
    intent: input.intent, strategies, spacePlan,
    concept: {
      name: `${input.intent.source.style.replace(/\b\w/g, (c) => c.toUpperCase())} Residence`,
      philosophy: "A composition built one purposeful mass at a time, each justified by what it connects to and what it serves.",
      buildingHierarchy: input.intent.hierarchyGoals,
      visualRhythm: "Massing-driven contrast between the dominant volume and its supporting pieces.",
      roofStrategy: mainRoof ? `${mainRoof.kind} primary roof, ${secondaryKind} on supporting masses.` : "Flat roof composition.",
      materialPalette: palette,
      circulation: spacePlan.circulation.arrival,
      zoning: "Massing and relationships decided piece by piece rather than from a fixed template.",
      indoorOutdoor: "Established by the facade and landscape stages, not yet decided.",
      viewStrategy: `Frame the ${input.siteStrategy.viewDirection} view from the dominant mass.`,
      arrivalSequence: spacePlan.circulation.arrival,
    },
    siteAnalysis: { environment: input.siteStrategy.environment, viewDirection: input.siteStrategy.viewDirection, approachSide: input.siteStrategy.arrivalDirection, terrainResponse: input.terrainResponse },
    masses: input.masses.map((mass) => ({ id: mass.id, role: DESIGN_ROLE[mass.role], relationship: describeRelationships(mass), roof: ROOF_TYPE[roofByMass.get(mass.id)?.kind ?? "flat"] })),
    spaceRelationships,
    roofComposition: {
      family: mainRoof ? `${mainRoof.kind} composition` : "Flat roof composition",
      primary: ROOF_TYPE[mainRoof?.kind ?? "flat"], secondary: ROOF_TYPE[secondaryKind ?? "flat"],
      pitch: avg(input.roofs.map((r) => r.pitch ?? 0)) || 2, overhang: avg(overhangs) || 0.75,
      details: roofDetailsFor(input.roofs),
    },
    facadeLanguage: { base: palette[0], openings: "Not yet decided by a staged facade pass.", shading: "Not yet decided by a staged facade pass.", rhythm: "Not yet decided by a staged facade pass." },
    components: [],
    outdoorStrategy: [],
    landscapeStrategy: [],
  };
}
