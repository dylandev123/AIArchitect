import type { ArchitectureCriterion, ArchitectureCriterionScore, ArchitectureRecommendation, CapabilityRequest } from "@/types/library";
import { ARCHITECTURE_CRITERIA } from "@/types/library";
import type { ArchitecturalDesign } from "./designEngine";

/**
 * The architectural critic: every completed design reviews itself. Deliberately the same shape as
 * `scoreDesignAreas` (heuristic, pure, cheap) but scoring architectural judgment — composition, hierarchy,
 * roof expression — rather than library/asset coverage. It reads the same `ArchitecturalDesign` the compiler
 * already produces; it never invents its own geometry model.
 *
 * A weak score becomes a `recommendedStrategy` and, where the fix is a known geometric operation, a
 * `missingCapability` id. `reviewCapabilityRequests` turns those into ordinary `CapabilityRequest`s, so a weak
 * review flows through the same capability-priority machinery a design's own stage requests already use —
 * the learning loop is the capability engine's, not a second one.
 */

/** Below this a criterion counts as weak; at or above `STRONG_SCORE` it counts as a strength. */
export const WEAK_REVIEW_SCORE = 0.5;
const STRONG_SCORE = 0.75;

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (root: Rec, key: string): Rec[] => (Array.isArray(root[key]) ? (root[key] as unknown[]).filter(isRecord) : []);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
const relationshipKinds = (design: ArchitecturalDesign) => new Set(design.spaceRelationships.map((r) => r.relationship));
const roles = (design: ArchitecturalDesign) => new Set(design.masses.map((m) => m.role));

/** What fixes each weak criterion. `capability`, when present, must be a registered capability id. */
const RECOMMENDATION: Record<ArchitectureCriterion, { strategy: string; capability?: string }> = {
  composition: { strategy: "Layered Volumes" },
  hierarchy: { strategy: "Split Mass", capability: "split-mass" },
  "roof-expression": { strategy: "Floating Roof", capability: "floating-roof" },
  "facade-rhythm": { strategy: "Screen Wall System", capability: "screen-layer" },
  "entry-sequence": { strategy: "Arrival Court", capability: "recessed-entry" },
  views: { strategy: "Framed Views", capability: "corner-glazing" },
  privacy: { strategy: "Courtyard Composition", capability: "courtyard-composition" },
  "indoor-outdoor": { strategy: "Indoor/Outdoor Living Layer", capability: "carve-terrace" },
  massing: { strategy: "Offset Wings", capability: "bridge-masses" },
  "structural-realism": { strategy: "Structural Realism Review" },
  "material-consistency": { strategy: "Material Palette Recipe" },
  originality: { strategy: "Explore an alternate strategy combination" },
  balance: { strategy: "Layered Volumes" },
  quality: { strategy: "Revisit composition, hierarchy and massing together" },
};

function scoreCriterion(criterion: ArchitectureCriterion, design: ArchitecturalDesign, root: Rec): { score: number; reason: string } {
  const buildings = list(root, "buildings");
  const n = (key: string) => list(root, key).length;
  switch (criterion) {
    case "composition": {
      const kinds = relationshipKinds(design).size;
      const score = clamp01((design.masses.length - 1) / 2) * 0.5 + clamp01(kinds / 3) * 0.5;
      return { score, reason: `${design.masses.length} masses related ${kinds} distinct way${kinds === 1 ? "" : "s"} (${[...relationshipKinds(design)].join(", ") || "none"})` };
    }
    case "hierarchy": {
      const distinctRoles = roles(design).size;
      const score = clamp01(design.concept.buildingHierarchy.length / 3) * 0.6 + clamp01(distinctRoles / 3) * 0.4;
      return { score, reason: `${design.concept.buildingHierarchy.length} ranked volumes, ${distinctRoles} distinct role${distinctRoles === 1 ? "" : "s"} across ${design.masses.length} masses` };
    }
    case "roof-expression": {
      const secondary = design.roofComposition.secondary !== design.roofComposition.primary ? 0.4 : 0;
      const overhang = clamp01(design.roofComposition.overhang / 1.4) * 0.3;
      const detail = clamp01(design.roofComposition.details.length / 4) * 0.3;
      return { score: secondary + overhang + detail, reason: `${design.roofComposition.primary}/${design.roofComposition.secondary} roofs, ${design.roofComposition.overhang}m overhang, ${design.roofComposition.details.length} details` };
    }
    case "facade-rhythm": {
      const features = n("bays") + n("arches") + Math.min(n("windows"), 12) / 3;
      const score = clamp01(features / 5);
      return { score, reason: `${n("bays")} bays, ${n("arches")} arches, ${n("windows")} windows` };
    }
    case "entry-sequence": {
      const hasSequence = design.concept.arrivalSequence.split("→").length >= 3 ? 0.5 : 0.2;
      const porch = clamp01(n("porches") / 1) * 0.5;
      return { score: hasSequence + porch, reason: `arrival sequence "${design.concept.arrivalSequence}", ${n("porches")} porches` };
    }
    case "views": {
      const openWalls = list(root, "windows").filter((w) => w.wall === design.siteAnalysis.viewDirection).length + list(root, "patios").filter((p) => p.wall === design.siteAnalysis.viewDirection).length;
      const score = 0.3 + clamp01(openWalls / 4) * 0.7;
      return { score, reason: `${openWalls} openings/terraces face the ${design.siteAnalysis.viewDirection} view` };
    }
    case "privacy": {
      const courtyard = design.strategies.some((strategy) => strategy.name === "Courtyard Composition");
      const buffered = [...relationshipKinds(design)].filter((k) => k === "buffered" || k === "separate").length;
      const score = (courtyard ? 0.6 : 0) + clamp01(buffered / 2) * 0.4;
      return { score, reason: courtyard ? "a courtyard/compound arrangement shields private rooms" : `${buffered} buffered/separate relationships between public and private volumes` };
    }
    case "indoor-outdoor": {
      const slider = design.components.some((c) => /sliding/i.test(c.name));
      const score = (slider ? 0.4 : 0) + clamp01(design.outdoorStrategy.length / 2) * 0.6;
      return { score, reason: `${slider ? "a sliding threshold plus " : ""}${design.outdoorStrategy.length} outdoor-living strategies` };
    }
    case "massing": {
      const distinctRoofs = new Set(design.masses.map((m) => m.roof)).size;
      const score = clamp01((design.masses.length - 1) / 2) * 0.6 + clamp01(distinctRoofs / 2) * 0.4;
      return { score, reason: `${design.masses.length} volumes, ${distinctRoofs} roof type${distinctRoofs === 1 ? "" : "s"} across them` };
    }
    case "structural-realism": {
      const score = buildings.length + (root.house ? 1 : 0) > 0 ? 0.7 : 0.2;
      return { score, reason: `${buildings.length + (root.house ? 1 : 0)} buildings compiled with wall/roof/floor geometry` };
    }
    case "material-consistency": {
      const palette = design.concept.materialPalette.length;
      const anchored = design.concept.materialPalette.includes(design.facadeLanguage.base) ? 0.4 : 0;
      const score = clamp01(palette / 4) * 0.6 + anchored;
      return { score, reason: `${palette}-material palette, facade base ${anchored ? "matches it" : "not drawn from it"}` };
    }
    case "originality": {
      const generic = design.concept.name === "Contemporary Pavilion Residence";
      return { score: generic ? 0.3 : 0.75, reason: generic ? "no distinguishing site or brief cue selected a named concept" : `concept resolved to "${design.concept.name}"` };
    }
    case "balance": {
      const kinds = relationshipKinds(design).size;
      const score = clamp01(kinds / 3);
      return { score, reason: `${kinds} relationship kind${kinds === 1 ? "" : "s"} between volumes (repetition reads as imbalance)` };
    }
    case "quality": {
      const componentCoverage = design.components.length ? design.components.filter((c) => c.required).length / design.components.length : 0.5;
      return { score: clamp01(componentCoverage), reason: `${design.components.filter((c) => c.required).length}/${design.components.length} concept components are required, not optional filler` };
    }
  }
}

export interface ArchitectureCriticResult {
  overallScore: number;
  criteria: ArchitectureCriterionScore[];
  strengths: ArchitectureCriterion[];
  weaknesses: ArchitectureCriterion[];
  recommendations: ArchitectureRecommendation[];
  intentAchieved: string[];
  intentMissed: string[];
}

/** Pure: scores every criterion, then names strengths, weaknesses, and — for each weakness — why and what would fix it. */
export function scoreArchitecture(design: ArchitecturalDesign, json: string, brief: string): ArchitectureCriticResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    parsed = {};
  }
  const root = isRecord(parsed) ? parsed : {};
  const criteria: ArchitectureCriterionScore[] = ARCHITECTURE_CRITERIA.map((criterion) => {
    const { score, reason } = scoreCriterion(criterion, design, root);
    return { criterion, score: round2(clamp01(score)), reason };
  });
  const overallScore = round2(criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length);
  const strengths = criteria.filter((c) => c.score >= STRONG_SCORE).map((c) => c.criterion);
  const weak = criteria.filter((c) => c.score < WEAK_REVIEW_SCORE);
  const weaknesses = weak.map((c) => c.criterion);
  const recommendations: ArchitectureRecommendation[] = weak.map((c) => {
    const fix = RECOMMENDATION[c.criterion];
    return { criterion: c.criterion, issue: c.reason, recommendedStrategy: fix.strategy, missingCapability: fix.capability };
  });
  const score = (criterion: ArchitectureCriterion) => criteria.find((c) => c.criterion === criterion)!.score;
  const intentChecks: [string, ArchitectureCriterion][] = [
    ...(design.intent.spatialGoals.includes("privacy") ? [["Private bedroom wing", "privacy"] as [string, ArchitectureCriterion]] : []),
    ...(design.intent.spatialGoals.includes("views") ? [["Strong views", "views"] as [string, ArchitectureCriterion]] : []),
    ...(design.intent.spatialGoals.includes("indoor-outdoor") ? [["Indoor/outdoor living", "indoor-outdoor"] as [string, ArchitectureCriterion]] : []),
    ...(design.intent.spatialGoals.includes("grand-entertaining") ? [["Dramatic arrival", "entry-sequence"] as [string, ArchitectureCriterion]] : []),
  ];
  const intentAchieved = intentChecks.filter(([, criterion]) => score(criterion) >= WEAK_REVIEW_SCORE).map(([goal]) => goal);
  const intentMissed = intentChecks.filter(([, criterion]) => score(criterion) < WEAK_REVIEW_SCORE).map(([goal]) => goal);
  void brief;
  return { overallScore, criteria, strengths, weaknesses, recommendations, intentAchieved, intentMissed };
}

/** Every recommendation naming a capability becomes a normal capability request, stage `architecture-review`, so a
 * weak review raises that capability's priority through the same path a design stage's own request would. */
export function reviewCapabilityRequests(result: Pick<ArchitectureCriticResult, "recommendations">): CapabilityRequest[] {
  return result.recommendations.filter((r) => r.missingCapability).map((r) => ({ operation: r.missingCapability!, stage: "architecture-review", desiredBehaviour: r.issue }));
}
