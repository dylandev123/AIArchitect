import type { ArchitecturalDesignDocument, MassVolume } from "../document";
import type { ArchitectureDiagnostics } from "../compiler";
import { resolveMasses } from "../compiler";
import { planConformance } from "../volumePlan";
import type { Rect } from "../geometry/footprint";
import { SIDE_VECTOR } from "@/lib/house/siteSettings";
import type { CompassSide } from "@/types/house";

const OPPOSITE_SIDE: Record<CompassSide, CompassSide> = { north: "south", south: "north", east: "west", west: "east" };
/** Mirrors `yawFacingSouthToward` in compiler.ts — duplicated locally rather than imported since it's a one-line trig formula and importing it would pull compiler.ts's whole private surface into this module's dependency graph for one function. */
function yawFacingSouthToward(direction: CompassSide): number {
  const [wx, wz] = SIDE_VECTOR[direction];
  return Math.atan2(wx, wz);
}

export interface QualityCheck { id: string; passed: boolean; detail: string }
export interface QualityGateResult { checks: QualityCheck[]; passed: boolean }

const INTENTIONALLY_ADJACENT_KINDS = new Set(["adjacent-to", "connected-to", "bridge-between", "stepped-above", "stepped-below"]);

function footprintAABB(mass: MassVolume): Rect {
  return { x0: mass.position.x - mass.width / 2, x1: mass.position.x + mass.width / 2, z0: mass.position.z - mass.depth / 2, z1: mass.position.z + mass.depth / 2 };
}
function overlaps(a: Rect, b: Rect): boolean { return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0; }
function distanceBetween(a: MassVolume, b: MassVolume): number { return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z); }
function directlyRelated(a: MassVolume, b: MassVolume): boolean {
  const relates = (from: MassVolume, toId: string) => (from.relationships ?? []).some((r) => r.target === toId && (INTENTIONALLY_ADJACENT_KINDS.has(r.kind) || r.kind === "surrounds-courtyard"));
  return relates(a, b.id) || relates(b, a.id);
}

/** Generous — this catches a genuinely scattered/lost mass, not ordinary site-scale separation between wings. */
const MAX_REASONABLE_DISTANCE_M = 45;
const MIN_COURTYARD_DIMENSION_M = 3;
const MAX_OVERHANG_RATIO = 0.4;

/**
 * Deterministic, in-process checks over an already-compiled document — no AI call, ever. Each check is an
 * independent pass/fail with a human-readable reason; `passed` is true only when every check that actually
 * applied to this document passed (a check with nothing to evaluate, e.g. no courtyard in a non-courtyard
 * design, is simply not run rather than counted as a pass or failure).
 *
 * This is reporting, not a gate that blocks or retries generation: there is no described corrective-action
 * loop, and wiring an automatic retry to a failed check would reintroduce exactly the extra-AI-call cost the
 * rest of this pipeline work is trying to eliminate. See `ArchitectureDebugPanel.tsx` for where this surfaces.
 */
export function runDesignQualityGate(doc: ArchitecturalDesignDocument, diagnostics: ArchitectureDiagnostics): QualityGateResult {
  const masses = resolveMasses(doc);
  const byId = new Map(masses.map((m) => [m.id, m] as const));
  const checks: QualityCheck[] = [];
  const push = (id: string, passed: boolean, detail: string) => checks.push({ id, passed, detail });

  for (const courtyard of diagnostics.courtyards) {
    const edgeCount = courtyard.enclosingMassIds.length + 1;
    push(`courtyard-edges-${courtyard.anchorMassId}`, edgeCount >= 3, `${edgeCount} edge(s) around ${courtyard.anchorMassId}'s courtyard (anchor + ${courtyard.enclosingMassIds.length} enclosing mass(es)).`);

    const width = courtyard.bounds.x1 - courtyard.bounds.x0;
    const depth = courtyard.bounds.z1 - courtyard.bounds.z0;
    push(`courtyard-dimensions-${courtyard.anchorMassId}`, width >= MIN_COURTYARD_DIMENSION_M && depth >= MIN_COURTYARD_DIMENSION_M, `Courtyard is ${width.toFixed(1)}x${depth.toFixed(1)}m.`);

    const facingIn = courtyard.enclosingMassIds.every((id) => {
      const mass = byId.get(id);
      if (!mass) return false;
      const hasExplicitRotation = (mass.relationships ?? []).some((r) => r.kind === "view-facing" || r.kind === "arrival-facing" || r.rotationOffset !== undefined);
      if (hasExplicitRotation) return true; // an explicit rotation intent always wins over auto-orientation — see resolveMasses.
      const side = mass.relationships?.find((r) => r.kind === "surrounds-courtyard" && r.target === courtyard.anchorMassId)?.side;
      return side !== undefined && Math.abs(mass.rotation - yawFacingSouthToward(OPPOSITE_SIDE[side])) < 1e-6;
    });
    push(`courtyard-faces-inward-${courtyard.anchorMassId}`, facingIn, facingIn ? "Every enclosing mass is oriented toward the courtyard or has an explicit facing relationship." : "At least one enclosing mass never got oriented toward the courtyard.");
  }

  let overlapDetail = "No unrelated masses overlap.";
  let noOverlap = true;
  for (let i = 0; i < masses.length && noOverlap; i++) {
    for (let j = i + 1; j < masses.length; j++) {
      const a = masses[i], b = masses[j];
      if (directlyRelated(a, b)) continue;
      if (overlaps(footprintAABB(a), footprintAABB(b))) { noOverlap = false; overlapDetail = `"${a.id}" and "${b.id}" overlap without a relationship that explains it.`; break; }
    }
  }
  push("no-unintentional-overlap", noOverlap, overlapDetail);

  const dominant = diagnostics.dominantMassId ? byId.get(diagnostics.dominantMassId) : undefined;
  let disconnected: string | undefined;
  if (dominant) {
    for (const mass of masses) {
      if (mass.id === dominant.id) continue;
      if (distanceBetween(mass, dominant) > MAX_REASONABLE_DISTANCE_M) { disconnected = mass.id; break; }
    }
  }
  push("no-isolated-pavilion", !disconnected, disconnected ? `"${disconnected}" sits more than ${MAX_REASONABLE_DISTANCE_M}m from the dominant mass.` : "Every mass is within a reasonable distance of the dominant mass.");
  push("dominant-pavilion-identifiable", Boolean(diagnostics.dominantMassId), diagnostics.dominantMassId ? `"${diagnostics.dominantMassId}" reads as the dominant mass.` : "No mass could be identified as dominant.");

  const hasArrivalFacing = masses.some((m) => (m.relationships ?? []).some((r) => r.kind === "arrival-facing"));
  const hasEntryRecess = masses.some((m) => (m.operations ?? []).some((op) => op.type === "entry-recess"));
  push("entrance-sequence-exists", hasArrivalFacing || hasEntryRecess, hasArrivalFacing || hasEntryRecess ? "An arrival-facing orientation or entry-recess establishes arrival." : "Nothing in the document distinguishes an arrival sequence.");

  let proportionalRoofs = true;
  let proportionDetail = "Every roof's overhang is proportional to its mass.";
  for (const mass of masses) {
    const roof = doc.roofs.recipes.find((r) => r.massId === mass.id);
    if (!roof?.overhang) continue;
    if (roof.overhang > Math.min(mass.width, mass.depth) * MAX_OVERHANG_RATIO) { proportionalRoofs = false; proportionDetail = `"${mass.id}"'s ${roof.overhang.toFixed(1)}m overhang is disproportionate to its ${mass.width.toFixed(1)}x${mass.depth.toFixed(1)}m footprint.`; break; }
  }
  push("roof-mass-proportionality", proportionalRoofs, proportionDetail);

  const articulated = masses.some((m) => (m.operations?.length ?? 0) > 0 || (m.openings?.length ?? 0) > 0);
  push("minimum-facade-articulation", articulated, articulated ? "At least one mass has real footprint or facade articulation." : "Every mass is a plain, unarticulated rectangle.");

  const survivedCompilation = diagnostics.geometry.every((g) => g.warnings.length === 0);
  push("requested-geometry-survived-compilation", survivedCompilation, survivedCompilation ? "No requested operation was clipped or dropped." : diagnostics.geometry.flatMap((g) => g.warnings.map((w) => `${g.massId}: ${w}`)).join("; "));

  const ids = new Set(masses.map((m) => m.id));
  const unsatisfied = masses.flatMap((m) => (m.relationships ?? []).filter((r) => !ids.has(r.target)).map((r) => `${m.id} -> ${r.target}`));
  push("relationship-satisfaction", unsatisfied.length === 0, unsatisfied.length === 0 ? "Every relationship resolved against a real mass." : `Unresolved relationship target(s): ${unsatisfied.join(", ")}.`);

  // A long unpunctured facade is a concrete failure, not an aesthetic judgement. Roles that receive the
  // compiler's deterministic facade grammar are exempt; all other long masses must declare openings.
  for (const mass of masses) {
    const longSide = Math.max(mass.width, mass.depth);
    const roleGetsGrammar = mass.role === "main-living" || mass.role === "bedroom-wing" || mass.role === "guest-pavilion" || mass.role === "entry";
    if (longSide >= 9 && !roleGetsGrammar) {
      const hasOpenings = (mass.openings?.length ?? 0) > 0 || (mass.operations ?? []).some((op) => (op.type === "projection" || op.type === "recess") && op.open);
      push(`blank-facade-${mass.id}`, hasOpenings, hasOpenings ? `"${mass.id}" has intentional facade relief.` : `"${mass.id}" has a ${longSide.toFixed(1)}m facade but no opening or open facade operation.`);
    }
  }

  for (const mass of masses.filter((m) => m.role === "main-living")) {
    const courtyardFacing = (mass.openings ?? []).some((op) => op.type === "glazing-zone" && op.heightRatio >= .65);
    // The default living grammar supplies this when intent is absent; explicit opening intent must be adequate.
    push(`living-glazing-${mass.id}`, mass.openings === undefined || courtyardFacing, mass.openings === undefined || courtyardFacing ? `"${mass.id}" has substantial living-area glazing.` : `"${mass.id}" lacks a substantial glazed living facade.`);
  }

  for (const mass of masses.filter((m) => m.role === "connector")) {
    const linked = masses.filter((other) => other.id !== mass.id && ((mass.relationships ?? []).some((r) => r.target === other.id) || (other.relationships ?? []).some((r) => r.target === mass.id)));
    push(`connector-connects-${mass.id}`, linked.length >= 2, linked.length >= 2 ? `"${mass.id}" links ${linked.map((m) => m.id).join(" and ")}.` : `"${mass.id}" must relate to two masses to be a connector.`);
  }

  for (const mass of masses.filter((m) => m.role === "terrace" || m.role === "veranda")) {
    const openOutdoorEdge = (mass.operations ?? []).some((op) => (op.type === "projection" || op.type === "recess") && op.open);
    push(`outdoor-room-open-${mass.id}`, openOutdoorEdge, `"${mass.id}" ${openOutdoorEdge ? "has an open, post-capable edge" : "is enclosed; declare an open projection or recess"}.`);
  }

  const hasDoor = masses.some((m) => (m.openings ?? []).some((op) => op.type === "door"));
  push("identifiable-entrance", hasDoor || hasEntryRecess, hasDoor || hasEntryRecess ? "A door or entry recess marks the entrance." : "No actual door or entry recess identifies the entrance.");

  for (const mass of masses.filter((m) => m.floors > 1)) {
    const changesByLevel = Boolean(mass.cantilever) || (mass.operations ?? []).some((op) => op.floors === "ground" || op.floors === "upper");
    push(`multi-floor-articulation-${mass.id}`, changesByLevel, changesByLevel ? `"${mass.id}" changes footprint or position above ground.` : `"${mass.id}" stacks identical floor plates; add an upper/ground operation or cantilever.`);
  }

  // Plan fidelity: every planned volume must have been built as planned, not decorated after the fact.
  for (const mass of masses.filter((m) => m.plan)) {
    const { missing, notes } = planConformance(mass, masses, doc.siteStrategy);
    const detail = missing.length ? `"${mass.id}" is missing planned ${missing.join(", ")}.` : `"${mass.id}" realizes its ${mass.plan!.form}/${mass.plan!.structure} plan.`;
    push(`plan-realized-${mass.id}`, missing.length === 0, notes.length ? `${detail} Adapted: ${notes.join(" ")}` : detail);
  }

  return { checks, passed: checks.every((c) => c.passed) };
}
