import type { CapabilityIntent } from "@/lib/capabilities/types";
import { massShellWarnings, massTotalHeight, roofClearance, maxPreservedOverhang } from "../compiler";
import type { MassGeometryOperation, MassOpening, MassVolume, RoofRecipe, RoofRecipeKind, SiteStrategy } from "../document";
import { buildFloorFootprint } from "../geometry/footprint";
import { baselineViolations } from "../planBaseline";
import { planConformance, realizeVolumePlan, sharedFacades } from "../volumePlan";
import type { StageConflict } from "./recovery";

/**
 * The objective, deterministic integrity checks of the V2 path — validation only, never a fix. Each returns the
 * conflicts it finds, addressed to the stage that owns the repair. The same functions run twice: inside the
 * owning stage's `validate` (so the conflict is repaired by the AI within that stage's retry budget), and again
 * in the final integrity gate over the artifact that will actually be saved (where an unrepaired one blocks).
 */

/** Two volumes interpenetrating by less than this (in plan or height) are touching, not colliding. */
export const MATERIAL_PENETRATION_M = 0.5;

/** How far two (possibly turned) footprints penetrate each other in plan: the smallest separating move, 0 when they are clear. */
export function footprintPenetration(a: MassVolume, b: MassVolume): number {
  const axes = (m: MassVolume): [number, number][] => { const c = Math.cos(m.rotation), s = Math.sin(m.rotation); return [[c, -s], [s, c]]; };
  const extent = (m: MassVolume, [nx, nz]: [number, number]) => {
    const [[ux, uz], [vx, vz]] = axes(m);
    const centre = m.position.x * nx + m.position.z * nz;
    const half = (m.width / 2) * Math.abs(ux * nx + uz * nz) + (m.depth / 2) * Math.abs(vx * nx + vz * nz);
    return [centre - half, centre + half] as const;
  };
  let least = Infinity;
  for (const axis of [...axes(a), ...axes(b)]) {
    const [a0, a1] = extent(a, axis), [b0, b1] = extent(b, axis);
    const overlap = Math.min(a1, b1) - Math.max(a0, b0);
    if (overlap <= 0) return 0;
    least = Math.min(least, overlap);
  }
  return least;
}

const top = (m: MassVolume) => m.elevation + massTotalHeight(m);
const verticalOverlap = (a: MassVolume, b: MassVolume) => Math.min(top(a), top(b)) - Math.max(a.elevation, b.elevation);

/** A link is authored to meet the volumes it joins; it is the one kind of mass allowed to run into another. */
function isAuthoredLink(a: MassVolume, b: MassVolume): boolean {
  const bridges = (from: MassVolume, to: MassVolume) => (from.relationships ?? []).some((r) => r.kind === "bridge-between" && r.target === to.id);
  return a.role === "connector" || b.role === "connector" || bridges(a, b) || bridges(b, a);
}

export interface MassCollision { a: string; b: string; penetration: number }

/** Pairs of volumes that materially occupy the same space (in plan AND in height). */
export function massCollisions(masses: readonly MassVolume[]): MassCollision[] {
  const out: MassCollision[] = [];
  for (let i = 0; i < masses.length; i++) for (let j = i + 1; j < masses.length; j++) {
    const a = masses[i], b = masses[j];
    if (isAuthoredLink(a, b)) continue;
    const penetration = Math.min(footprintPenetration(a, b), verticalOverlap(a, b));
    if (penetration > MATERIAL_PENETRATION_M) out.push({ a: a.id, b: b.id, penetration });
  }
  return out;
}

/**
 * Whether the placed composition can carry the plans its volumes were given — owned by the placing stage
 * (Foundation for the primary mass, Mass Expansion for every other): a planned form/terrace/entry on a facade a
 * neighbor stands against, a form the volume is too small for, a planned cantilever with no authored reach, or
 * two volumes in the same space.
 */
export function placementConflicts(masses: readonly MassVolume[], site: SiteStrategy, stage: "foundation" | "mass-expansion"): StageConflict[] {
  const conflicts: StageConflict[] = [];
  for (const mass of masses) {
    const realization = realizeVolumePlan(mass, masses, site);
    for (const conflict of realization.conflicts ?? []) conflicts.push({ stage, code: "plan-unbuildable", massId: mass.id, detail: `"${mass.id}": ${conflict.detail} Re-plan it or place the volumes so that facade is free.` });
    if (realization.cantilever && !mass.cantilever) conflicts.push({ stage, code: "cantilever-unauthored", massId: mass.id, detail: `"${mass.id}" plans structure "cantilever" on ${mass.floors} floors but authors no "cantilever" (direction and distance). Author it, or choose another structure.` });
  }
  for (const hit of massCollisions(masses)) conflicts.push({ stage, code: "mass-collision", massId: hit.b, detail: `"${hit.a}" and "${hit.b}" occupy the same space (${hit.penetration.toFixed(1)}m overlap). Move or resize one; only a connector may run into the volumes it joins.` });
  return conflicts;
}

/** A mass exactly as the Geometry Pass authored it. */
export type ArticulatedMass = MassVolume & { operations: readonly MassGeometryOperation[]; openings: readonly MassOpening[] };

/**
 * Whether one volume's merged geometry (mandatory baseline + the Geometry Pass's refinements and additions)
 * realizes its plan and can be built — owned by the Geometry Pass: every planned element present, the mandatory
 * baseline intact (not removed, moved, modified beyond its refinable fields, duplicated or obstructed), nothing
 * on a shared wall, and nothing the shell compiler has to clip, drop or leave without its door.
 */
export function geometryConflicts(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, capabilities: readonly CapabilityIntent[]): StageConflict[] {
  const stage = "architectural-geometry" as const;
  const conflicts: StageConflict[] = [];
  const conformance = planConformance(mass, masses, site, capabilities);
  for (const missing of conformance.missing) conflicts.push({ stage, code: "missing-planned-geometry", massId: mass.id, detail: `"${mass.id}" is missing its planned ${missing}. Author it — nothing is restored for you.` });
  for (const violation of baselineViolations(mass, masses, site)) conflicts.push({ stage, code: violation.code, massId: mass.id, detail: `"${mass.id}": ${violation.detail}` });
  const shared = sharedFacades(mass, masses, site);
  for (const item of [...(mass.operations ?? []), ...(mass.openings ?? [])]) {
    if ("facade" in item && shared.has(item.facade)) conflicts.push({ stage, code: "shared-wall", massId: mass.id, detail: `"${mass.id}" authors a ${item.type} on its ${item.facade} facade, which stands against a neighboring volume. Remove it or put it on a free facade.` });
  }
  for (const op of mass.operations ?? []) if (op.type === "notch") {
    // The footprint builder has no arbitrary 4m capability limit; a notch is physical only while both legs
    // remain inside the mass it cuts. Keep that relationship-aware constraint here, where the mass is known.
    if (op.width >= mass.width || op.depth >= mass.depth) conflicts.push({ stage, code: "unbuildable-geometry", massId: mass.id, detail: `"${mass.id}" has a ${op.width.toFixed(1)}m × ${op.depth.toFixed(1)}m notch outside its ${mass.width.toFixed(1)}m × ${mass.depth.toFixed(1)}m footprint. Keep both notch legs smaller than their corresponding mass dimension.` });
  }
  for (const warning of massShellWarnings(mass)) conflicts.push({ stage, code: "unbuildable-geometry", massId: mass.id, detail: `"${mass.id}" cannot be built as authored — ${warning}` });
  return conflicts;
}

const RIDGE_KINDS = new Set<RoofRecipeKind>(["gable", "hip", "butterfly", "pavilion", "cross-gable"]);
const FLAT_KINDS = new Set<RoofRecipeKind>(["flat", "floating-flat"]);
/** Roofs whose wall plates are closer than this in height share one band and can run into each other. */
const ROOF_BAND_M = 1.2;
/** A flat deck under a stacked volume is its floor; anything rising more than this into that volume is a roof inside a building. */
const STACKED_ROOF_TOLERANCE_M = 0.3;

const topFloorRects = (mass: MassVolume) => buildFloorFootprint(mass.width, mass.depth, mass.operations ?? [], mass.floors - 1);

/** How far a roof rises above its wall plate. */
function roofRise(recipe: RoofRecipe, mass: MassVolume): number {
  if (FLAT_KINDS.has(recipe.kind) || recipe.kind === "mixed") {
    return (recipe.expression?.verticalGap ?? (recipe.kind === "floating-flat" ? 0.18 : 0)) + (recipe.expression?.thickness ?? 0.25) + (recipe.parapet?.height ?? 0);
  }
  const run = recipe.kind === "shed" || recipe.kind === "mono-pitch" ? mass.depth : Math.min(mass.width, mass.depth) / 2;
  return Math.tan(((recipe.pitch ?? 0) * Math.PI) / 180) * run;
}

/**
 * Whether the authored roofs are complete, buildable and physically clear — owned by Roof Composition: exactly
 * one complete recipe per volume, a family the compiler can build on that footprint, eaves whose clearance trim
 * still reads as the authored roof, and no roof inside or through another volume or roof.
 */
export function roofConflicts(masses: readonly MassVolume[], roofs: readonly RoofRecipe[]): StageConflict[] {
  const stage = "roof-composition" as const;
  const conflicts: StageConflict[] = [];
  const byMass = new Map<string, RoofRecipe>();
  for (const mass of masses) {
    const own = roofs.filter((r) => r.massId === mass.id);
    if (own.length === 0) { conflicts.push({ stage, code: "roof-missing", massId: mass.id, detail: `"${mass.id}" has no roof recipe. Author one — no fallback roof is built.` }); continue; }
    if (own.length > 1) conflicts.push({ stage, code: "roof-stacked", massId: mass.id, detail: `"${mass.id}" has ${own.length} roofs stacked on it. Author exactly one.` });
    const roof = own[0];
    byMass.set(mass.id, roof);
    if (roof.overhang === undefined || roof.pitch === undefined) conflicts.push({ stage, code: "roof-incomplete", massId: mass.id, detail: `The roof for "${mass.id}" must author both "overhang" and "pitch" — neither is defaulted.` });
    if (roof.kind === "mixed") conflicts.push({ stage, code: "roof-unbuildable", massId: mass.id, detail: `"mixed" is not a buildable roof family for "${mass.id}". Choose one family.` });
    const footprint = topFloorRects(mass);
    if (RIDGE_KINDS.has(roof.kind) && footprint.chamfers.length > 0) conflicts.push({ stage, code: "roof-unbuildable", massId: mass.id, detail: `A ${roof.kind} roof cannot follow the angled (chamfered) edge of "${mass.id}". Use flat, floating-flat, shed or mono-pitch there.` });
    else if (RIDGE_KINDS.has(roof.kind) && footprint.rects.length > 1) conflicts.push({ stage, code: "roof-fragmented", massId: mass.id, detail: `A ${roof.kind} roof on "${mass.id}" breaks into ${footprint.rects.length} separate ridged roofs over its articulated footprint (no valley geometry). Use flat, floating-flat, shed or mono-pitch there.` });
  }
  for (const c of roofClearance(masses, roofs)) {
    if (c.preservesLanguage) continue;
    conflicts.push({ stage, code: "roof-clearance", massId: c.massId, detail: `The ${c.authored.toFixed(2)}m overhang on "${c.massId}" runs into "${c.neighborId}" (${(c.gap ?? 0).toFixed(2)}m away) and would have to be cut to ${c.cleared.toFixed(2)}m, which is no longer the roof you authored. Author an overhang of at most ${maxPreservedOverhang(c.cleared).toFixed(2)}m for it.` });
  }
  const cleared = new Map(roofClearance(masses, roofs).map((c) => [c.massId, c.cleared] as const));
  for (let i = 0; i < masses.length; i++) for (let j = i + 1; j < masses.length; j++) {
    const a = masses[i], b = masses[j], ra = byMass.get(a.id), rb = byMass.get(b.id);
    if (!ra || !rb) continue;
    const inPlan = footprintPenetration(a, b);
    if (inPlan <= MATERIAL_PENETRATION_M) continue;
    if (Math.abs(top(a) - top(b)) < ROOF_BAND_M && verticalOverlap(a, b) > MATERIAL_PENETRATION_M && !isAuthoredLink(a, b)) {
      conflicts.push({ stage, code: "roof-intersection", massId: a.id, detail: `The roofs of "${a.id}" and "${b.id}" occupy the same space (${inPlan.toFixed(1)}m overlap at the same height, eaves ${cleared.get(a.id)?.toFixed(2)}m / ${cleared.get(b.id)?.toFixed(2)}m).` });
      continue;
    }
    // One volume stands on the other: the lower roof is only buildable as the deck the upper volume sits on.
    const [lower, upper, roof] = top(a) <= top(b) ? [a, b, ra] : [b, a, rb];
    const headroom = upper.elevation - top(lower);
    if (headroom > -MATERIAL_PENETRATION_M && roofRise(roof, lower) - Math.max(0, headroom) > STACKED_ROOF_TOLERANCE_M) {
      conflicts.push({ stage, code: "roof-stacking", massId: lower.id, detail: `The ${roof.kind} roof of "${lower.id}" rises ${roofRise(roof, lower).toFixed(2)}m into "${upper.id}", which stands on it. Under a stacked volume author a plain flat roof (no parapet, no floating gap).` });
    }
  }
  return conflicts;
}
