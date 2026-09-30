import type { ArchitectureCriterion, ArchitectureCriterionScore, ArchitectureRecommendation, CapabilityRequest } from "@/types/library";
import { ARCHITECTURE_CRITERIA } from "@/types/library";
import type { ArchitecturalDesign } from "./designEngine";
import { massTotalHeight } from "./compiler";
import type { MassRole, MassVolume } from "./document";
import { collectV2Evidence, v2DocumentFromScene, type V2Evidence } from "./v2Evidence";

/**
 * The architectural critic: every completed design reviews itself. Deliberately the same shape as
 * `scoreDesignAreas` (heuristic, pure, cheap) but scoring architectural judgment — composition, hierarchy,
 * roof expression — rather than library/asset coverage. When the scene carries an accepted V2
 * `architecturalDesignDocument`, it compiles that document (deterministically, no AI) and scores only the
 * geometry the compiler actually built (see v2Evidence.ts); legacy scene projects keep the concept/scene-field
 * scoring. It never invents its own geometry model.
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

/** Legacy scene projects only: reads the concept plus legacy scene fields (`windows`, `patios`, `bays`, `porches`), which a V2 project never authors. */
function scoreLegacyCriterion(criterion: ArchitectureCriterion, design: ArchitecturalDesign, root: Rec): { score: number; reason: string } {
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

// ── V2: score the accepted document's compiled geometry ─────────────────────────────────────────────

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const m2 = (n: number) => `${n.toFixed(1)}m²`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const PRIVATE_ROLES = new Set<MassRole>(["bedroom-wing", "guest-pavilion"]);
const BACK_OF_HOUSE = new Set<MassRole>(["garage", "service"]);
const MAIN_ENTRY_ROLES = new Set<MassRole>(["entry", "connector"]);
/** Below this a compiled door is a sliver left beside a solid wall, not a way in. */
const MIN_DOOR_AREA_M2 = 1.5;
/** Glass whose bottom sits above standing eye height can't be seen into from the drive. */
const PRIVACY_SILL_M = 1.5;
/** Relationship kinds that mean two volumes are deliberately held apart. */
const APART_KINDS = new Set(["separated-from", "offset-from", "surrounds-courtyard", "stepped-above", "stepped-below", "bridge-between"]);
const footprintArea = (m: MassVolume) => m.width * m.depth;
function aabbGap(a: MassVolume, b: MassVolume): number {
  const box = (m: MassVolume) => { const c = Math.abs(Math.cos(m.rotation)), s = Math.abs(Math.sin(m.rotation)); const hx = (m.width * c + m.depth * s) / 2, hz = (m.width * s + m.depth * c) / 2; return { x0: m.position.x - hx, x1: m.position.x + hx, z0: m.position.z - hz, z1: m.position.z + hz }; };
  const p = box(a), q = box(b);
  return Math.max(0, p.x0 - q.x1, q.x0 - p.x1, p.z0 - q.z1, q.z0 - p.z1);
}

/**
 * Every V2 criterion reads only what the compiler built (see v2Evidence.ts). Absent geometry scores nothing;
 * there are no baseline points for a strategy name, a canned concept string, or an intent the compiler did
 * not realize. `material-consistency` has no V2 geometry yet (the material stage is still a placeholder), so
 * it returns undefined and keeps its concept-based score.
 */
function scoreV2Criterion(criterion: ArchitectureCriterion, e: V2Evidence): { score: number; reason: string } | undefined {
  const byId = new Map(e.masses.map((m) => [m.id, m] as const));
  const dominant = e.diagnostics.dominantMassId ? byId.get(e.diagnostics.dominantMassId) : undefined;
  const others = e.masses.filter((m) => m.id !== dominant?.id);
  const validCourt = e.courtyards.find((c) => c.valid);
  const applied = e.diagnostics.capabilities.filter((c) => c.status === "applied");
  const notApplied = e.diagnostics.capabilities.filter((c) => c.status !== "applied");
  const glassArea = sum(e.glass.map((g) => g.area));
  const relationKinds = new Set(e.masses.flatMap((m) => (m.relationships ?? []).filter((r) => r.kind === "view-facing" || r.kind === "arrival-facing" || byId.has(r.target)).map((r) => r.kind)));
  const check = (id: string) => e.gate.checks.find((c) => c.id === id)?.passed === true;
  const geometryOf = (id: string) => e.diagnostics.geometry.find((g) => g.massId === id);
  /** An operation counts only on a mass whose footprint compiled without dropping anything. */
  const cleanOps = (m: MassVolume) => ((geometryOf(m.id)?.warnings.length ?? 0) === 0 ? m.operations ?? [] : []);
  const articulated = e.masses.filter((m) => (geometryOf(m.id)?.topFloorRectCount ?? 1) > 1 || cleanOps(m).some((op) => op.type === "chamfer") || m.cantilever || e.outdoorRooms.some((r) => r.massId === m.id));
  const courtNote = e.courtyards.length ? (validCourt ? `a compiled ${validCourt.width.toFixed(1)}x${validCourt.depth.toFixed(1)}m courtyard enclosed by ${validCourt.enclosingMassIds.length + 1} volumes` : `a courtyard too small or under-enclosed to read (${e.courtyards[0].width.toFixed(1)}x${e.courtyards[0].depth.toFixed(1)}m)`) : "no compiled courtyard";

  switch (criterion) {
    case "composition": {
      // A notched (L-shaped) single footprint is itself a two-wing composition.
      const wings = others.filter((m) => m.role !== "connector" && dominant && footprintArea(m) >= 0.25 * footprintArea(dominant));
      const sides = new Set(wings.map((m) => (dominant ? sideOf(m.position.x - dominant.position.x, m.position.z - dominant.position.z) : "south")));
      const notched = e.masses.some((m) => cleanOps(m).some((op) => op.type === "notch"));
      const volumes = e.masses.length + (notched ? 1 : 0);
      const court = validCourt ? 1 : e.courtyards.length ? 0.4 : 0;
      const score = clamp01((volumes - 1) / 3) * 0.25 + clamp01((sides.size + (notched ? 1 : 0)) / 2) * 0.25 + clamp01(relationKinds.size / 3) * 0.2 + court * 0.3;
      return { score, reason: `${plural(e.masses.length, "volume")}${notched ? " (one L-shaped)" : ""}, ${plural(wings.length, "wing")} on ${plural(sides.size, "side")} of the dominant mass, ${plural(relationKinds.size, "relationship kind")}; ${courtNote}` };
    }
    case "hierarchy": {
      if (!dominant || others.length === 0) return { score: 0.35, reason: "a single volume: legible, but no hierarchy between volumes" };
      const largestOther = Math.max(...others.map(footprintArea));
      const ratio = footprintArea(dominant) / largestOther;
      const tallest = massTotalHeight(dominant) >= Math.max(...others.map(massTotalHeight)) - 1e-6;
      const roleCount = new Set(e.masses.map((m) => m.role)).size;
      const score = clamp01((ratio - 1) / 0.6) * 0.4 + (tallest ? 0.3 : 0) + clamp01(roleCount / 3) * 0.3;
      return { score, reason: `"${dominant.id}" is ${ratio.toFixed(2)}x the next-largest footprint and ${tallest ? "the tallest" : "not the tallest"} volume; ${plural(roleCount, "distinct role")}` };
    }
    case "roof-expression": {
      const recipes = e.doc.roofs.recipes;
      const kinds = new Set(recipes.map((r) => r.kind));
      const expressive = recipes.filter((r) => r.kind === "floating-flat" || (r.expression?.verticalGap ?? 0) > 0 || r.expression?.supportStyle || r.expression?.secondary || r.parapet);
      const covered = e.masses.filter((m) => recipes.some((r) => r.massId === m.id)).length / e.masses.length;
      const overhangs = recipes.map((r) => r.overhang ?? 0.6);
      const avg = overhangs.length ? sum(overhangs) / overhangs.length : 0;
      const score = (kinds.size > 1 ? 0.3 : 0) + (expressive.length ? 0.3 : 0) + clamp01(avg / 1.2) * 0.2 + covered * 0.2;
      return { score, reason: `${[...kinds].join("/") || "no"} roofs over ${pct(covered)} of volumes, ${plural(expressive.length, "expressed roof")} (floating/clerestory/parapet), ${avg.toFixed(2)}m average overhang` };
    }
    case "facade-rhythm": {
      const windows = e.glass.filter((g) => !g.door);
      const facadeCounts = new Map<string, number>();
      for (const g of windows) facadeCounts.set(`${g.massId}:${g.side}`, (facadeCounts.get(`${g.massId}:${g.side}`) ?? 0) + 1);
      const rhythmic = [...facadeCounts.values()].filter((n) => n >= 3).length;
      const reveals = e.masses.some((m) => (m.openings ?? []).some((o) => o.type === "glazing-zone" && (o.reveal ?? 0) >= 0.4 && windows.some((g) => g.massId === m.id)));
      const screen = e.screenElements > 0 ? 1 : reveals ? 0.4 : 0;
      const score = clamp01(facadeCounts.size / 6) * 0.25 + clamp01(rhythmic / 2) * 0.2 + screen * 0.25 + (articulated.length / e.masses.length) * 0.3;
      return { score, reason: `${plural(facadeCounts.size, "glazed facade")} (${rhythmic} with a 3+ opening rhythm), ${e.screenElements ? `a compiled screen on ${plural(e.screenedFacades, "facade")} (${e.screenElements} fins/battens)` : reveals ? "deep glazing reveals but no screen layer" : "no screen layer"}, ${articulated.length}/${e.masses.length} volumes articulated` };
    }
    case "entry-sequence": {
      // The main entry is on the dominant mass or a dedicated entry/connector volume; a guest-pavilion,
      // garage or service door facing the drive is not how the house is entered.
      const isMainEntryMass = (id: string) => id === dominant?.id || MAIN_ENTRY_ROLES.has(byId.get(id)?.role as MassRole);
      const doorArea = (main: boolean, side?: string) => {
        const byMass = new Map<string, number>();
        for (const d of e.glass) if (d.door && isMainEntryMass(d.massId) === main && !BACK_OF_HOUSE.has(byId.get(d.massId)?.role as MassRole) && (!side || d.side === side)) byMass.set(d.massId, (byMass.get(d.massId) ?? 0) + d.area);
        return Math.max(0, ...byMass.values());
      };
      const mainArrival = doorArea(true, e.arrival), mainAny = doorArea(true), secondary = doorArea(false, e.arrival);
      const recessed = e.masses.some((m) => cleanOps(m).some((op) => op.type === "entry-recess"));
      const canopy = applied.some((c) => c.id === "entry-canopy");
      const oriented = e.masses.some((m) => m.role === "entry" || (m.relationships ?? []).some((r) => r.kind === "arrival-facing"));
      const door = mainArrival >= MIN_DOOR_AREA_M2 ? 0.35 : mainAny >= MIN_DOOR_AREA_M2 || secondary >= MIN_DOOR_AREA_M2 ? 0.15 : 0;
      const score = door + (recessed ? 0.25 : 0) + (canopy ? 0.25 : 0) + (oriented ? 0.15 : 0);
      const doorNote = mainArrival >= MIN_DOOR_AREA_M2 ? `a ${m2(mainArrival)} main door faces the ${e.arrival} arrival`
        : mainAny >= MIN_DOOR_AREA_M2 ? `the main door (${m2(mainAny)}) does not face the ${e.arrival} arrival`
        : mainAny > 0 ? `the main entry door compiled to a ${m2(mainAny)} sliver`
        : secondary >= MIN_DOOR_AREA_M2 ? `no main entry door (only a secondary ${m2(secondary)} door faces the arrival)` : "no compiled main entry door";
      return { score, reason: `${doorNote}; ${recessed ? "a compiled entry recess" : "no entry recess"}, ${canopy ? "an entry canopy" : "no canopy"}${oriented ? ", an arrival-oriented volume" : ""}` };
    }
    case "views": {
      const facing = e.glass.filter((g) => g.side === e.view);
      const clear = facing.filter((g) => !g.obstructedBy);
      const clearArea = sum(clear.map((g) => g.area));
      const blocked = facing.filter((g) => g.obstructedBy);
      const share = glassArea ? clearArea / glassArea : 0;
      const dominantArea = sum(clear.filter((g) => g.massId === dominant?.id).map((g) => g.area));
      const rooms = e.outdoorRooms.filter((r) => r.side === e.view).length;
      const score = clamp01(clearArea / 25) * 0.45 + clamp01(share / 0.4) * 0.2 + clamp01(dominantArea / 6) * 0.2 + (rooms ? 0.15 : 0);
      const blockers = [...new Set(blocked.map((g) => g.obstructedBy))].join(", ");
      return { score, reason: `${m2(clearArea)} of unobstructed glazing faces the ${e.view} view (${pct(share)} of ${m2(glassArea)} compiled glass; ${m2(dominantArea)} on "${dominant?.id ?? "?"}")${blocked.length ? `, ${m2(sum(blocked.map((g) => g.area)))} more blocked by ${blockers}` : ""}; ${plural(rooms, "open outdoor room")} face it` };
    }
    case "privacy": {
      const privates = e.masses.filter((m) => PRIVATE_ROLES.has(m.role));
      // Glass the drive can see into: eye-level, unscreened, unobstructed, facing the arrival.
      const exposure = (id?: string) => sum(e.glass.filter((g) => !g.door && !g.obstructedBy && !g.screened && g.sill < PRIVACY_SILL_M && g.side === e.arrival && (!id || g.massId === id)).map((g) => g.area));
      const buffered = privates.filter((m) => !dominant || m.id === dominant.id || aabbGap(m, dominant) >= 1.5 || Math.abs(m.elevation - dominant.elevation) >= 1.5 || validCourt?.enclosingMassIds.includes(m.id) || (m.relationships ?? []).some((r) => r.target === dominant.id && APART_KINDS.has(r.kind) && aabbGap(m, dominant) > 0.6));
      const perPrivate = privates.map((m) => (buffered.includes(m) ? 0.6 : 0) + (exposure(m.id) <= 3 ? 0.4 : exposure(m.id) <= 8 ? 0.2 : 0));
      const zoning = perPrivate.length ? sum(perPrivate) / perPrivate.length : 0;
      const court = validCourt ? 1 : e.courtyards.length ? 0.4 : 0;
      const discretion = 1 - clamp01(exposure() / 20);
      const score = zoning * 0.4 + court * 0.35 + discretion * 0.25;
      return { score, reason: `${privates.length ? `${buffered.length}/${privates.length} private volumes held apart from the public mass` : "no separate private volume"}; ${courtNote}; ${m2(exposure())} of eye-level, unscreened glass faces the ${e.arrival} arrival` };
    }
    case "indoor-outdoor": {
      const rooms = e.outdoorRooms.filter((r) => r.atGrade);
      const roomArea = sum(rooms.map((r) => r.area));
      const walkOut = e.glass.filter((g) => g.atGrade);
      const threshold = sum(walkOut.map((g) => g.length)) + sum(rooms.map((r) => r.width));
      const oriented = rooms.filter((r) => r.side === e.view || r.facesCourtyard).length;
      const glassToOutside = walkOut.some((g) => (g.side === e.view && !g.obstructedBy) || g.facesCourtyard || rooms.some((r) => r.massId === g.massId && r.side === g.side));
      const score = clamp01(roomArea / 18) * 0.4 + clamp01(threshold / 14) * 0.3 + (oriented ? 0.15 : 0) + (glassToOutside ? 0.15 : 0);
      const raised = e.outdoorRooms.length - rooms.length;
      return { score, reason: `${plural(rooms.length, "covered outdoor room")} at grade (${m2(roomArea)}${oriented ? `, ${oriented} facing the view or courtyard` : ""}), ${threshold.toFixed(1)}m of walk-out threshold (full-height glass, doors, open edges)${raised ? `; ${raised} raised open edge${raised === 1 ? "" : "s"} not counted` : ""}` };
    }
    case "massing": {
      const kinds = new Set(e.doc.roofs.recipes.map((r) => r.kind)).size;
      const varied = e.masses.some((m) => m.cantilever || Math.abs(m.elevation - (dominant?.elevation ?? 0)) >= 0.5 || Math.abs(Math.sin(m.rotation - (dominant?.rotation ?? 0))) > 0.05);
      const score = clamp01((e.masses.length - 1) / 2) * 0.35 + clamp01(kinds - 1) * 0.2 + (varied ? 0.15 : 0) + (articulated.length / e.masses.length) * 0.3;
      return { score, reason: `${plural(e.masses.length, "volume")}, ${kinds} roof famil${kinds === 1 ? "y" : "ies"}, ${articulated.length}/${e.masses.length} with compiled footprint articulation${varied ? ", stepped/rotated/cantilevered placement" : ""}` };
    }
    case "structural-realism": {
      const ids = ["no-unintentional-overlap", "roof-mass-proportionality", "requested-geometry-survived-compilation", "relationship-satisfaction"];
      const checks = e.gate.checks.filter((c) => ids.includes(c.id) || c.id.startsWith("connector-connects-"));
      const failed = checks.filter((c) => !c.passed);
      const score = 0.4 + 0.6 * (checks.length ? (checks.length - failed.length) / checks.length : 1) - 0.1 * notApplied.length;
      return { score, reason: `compiled without errors; ${checks.length - failed.length}/${checks.length} structural checks pass${failed.length ? ` (failed: ${failed.map((c) => c.detail).join(" ")})` : ""}${notApplied.length ? `; ${plural(notApplied.length, "capability")} fell back (${notApplied.map((c) => c.id).join(", ")})` : ""}` };
    }
    case "material-consistency":
      return undefined;
    case "originality": {
      const vocabulary = new Set<string>();
      for (const m of e.masses) for (const op of cleanOps(m)) vocabulary.add(op.type === "notch" ? "L-shaped footprint" : op.type === "chamfer" ? (op.glazed ? "glazed prow" : "prow") : op.type === "entry-recess" ? "entry recess" : op.open ? "carved open terrace" : `${op.type}`);
      if (e.masses.some((m) => m.cantilever)) vocabulary.add("cantilever");
      if (dominant && others.some((m) => Math.abs(m.elevation - dominant.elevation) >= 0.5)) vocabulary.add("stepped section");
      if (dominant && others.some((m) => Math.abs(Math.sin(m.rotation - dominant.rotation)) > 0.05)) vocabulary.add("rotated wing");
      if (validCourt) vocabulary.add("courtyard");
      for (const c of applied) vocabulary.add(c.id);
      if (e.doc.roofs.recipes.some((r) => r.kind === "floating-flat")) vocabulary.add("floating roof");
      return { score: clamp01(vocabulary.size / 6), reason: vocabulary.size ? `${plural(vocabulary.size, "compiled move")}: ${[...vocabulary].join(", ")}` : "plain boxes: no compiled articulation beyond the massing" };
    }
    case "balance": {
      const overlap = check("no-unintentional-overlap"), isolated = check("no-isolated-pavilion");
      const score = clamp01(relationKinds.size / 3) * 0.5 + (overlap ? 0.25 : 0) + (isolated ? 0.25 : 0);
      return { score, reason: `${plural(relationKinds.size, "relationship kind")} between volumes${overlap ? "" : ", unexplained overlap"}${isolated ? "" : ", an isolated volume"}` };
    }
    case "quality": {
      const passed = e.gate.checks.filter((c) => c.passed).length;
      const gate = e.gate.checks.length ? passed / e.gate.checks.length : 0;
      const capabilityRatio = e.diagnostics.capabilities.length ? applied.length / e.diagnostics.capabilities.length : undefined;
      const score = capabilityRatio === undefined ? gate : gate * 0.8 + capabilityRatio * 0.2;
      const failed = e.gate.checks.filter((c) => !c.passed).map((c) => c.id);
      return { score, reason: `${passed}/${e.gate.checks.length} design-quality checks pass${failed.length ? ` (failed: ${failed.join(", ")})` : ""}${capabilityRatio === undefined ? "" : `; ${applied.length}/${e.diagnostics.capabilities.length} requested capabilities compiled`}` };
    }
  }
}

function sideOf(x: number, z: number): string {
  return Math.abs(x) >= Math.abs(z) ? (x >= 0 ? "east" : "west") : (z >= 0 ? "south" : "north");
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
  // An accepted V2 document is the architecture: score what it compiled to, not the legacy fields it never authors.
  const v2Doc = v2DocumentFromScene(root);
  const evidence = v2Doc ? collectV2Evidence(v2Doc) : undefined;
  const criteria: ArchitectureCriterionScore[] = ARCHITECTURE_CRITERIA.map((criterion) => {
    const { score, reason } = (evidence && scoreV2Criterion(criterion, evidence)) ?? scoreLegacyCriterion(criterion, design, root);
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
