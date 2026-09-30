import type { ArchitecturalDesignDocument, MassVolume } from "../document";
import type { ArchitectureDiagnostics } from "../compiler";
import { resolveMasses } from "../compiler";
import { baselineViolations } from "../planBaseline";
import { planConformance, sharedFacades } from "../volumePlan";
import { massCollisions, roofConflicts } from "./integrityChecks";

/**
 * "blocking" = an objective structural-integrity failure: the artifact is not what was authored, or cannot
 * physically be what it says. A failed blocking check stops finalization (see integrityGate.ts).
 * "warning" = a subjective design-quality observation: reported, never blocking.
 */
export type QualitySeverity = "warning" | "blocking";
export interface QualityCheck { id: string; passed: boolean; detail: string; severity: QualitySeverity }
export interface QualityGateResult {
  checks: QualityCheck[];
  /** True when no BLOCKING check failed. Failed warnings do not change it. */
  passed: boolean;
  blocking: QualityCheck[];
  warnings: QualityCheck[];
}

function distanceBetween(a: MassVolume, b: MassVolume): number { return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z); }

/** Generous — this catches a genuinely scattered/lost mass, not ordinary site-scale separation between wings. */
const MAX_REASONABLE_DISTANCE_M = 45;
const MIN_COURTYARD_DIMENSION_M = 3;
const MAX_OVERHANG_RATIO = 0.4;
/** The capabilities a volume's plan can call for; one that was authored but did not build is missing planned geometry. */
const PLAN_CAPABILITIES = new Set(["entry-canopy", "brise-soleil", "screen-layer", "pilotis"]);

/** Summarizes a check list: only failed BLOCKING checks fail the gate. */
export function summarizeChecks(checks: QualityCheck[]): QualityGateResult {
  const blocking = checks.filter((c) => !c.passed && c.severity === "blocking");
  return { checks, passed: blocking.length === 0, blocking, warnings: checks.filter((c) => !c.passed && c.severity === "warning") };
}

/**
 * Deterministic, in-process checks over an already-compiled architecture document — no AI call, ever, and no
 * correction: every check is an independent pass/fail with a human-readable reason and an explicit severity.
 *
 * Blocking (objective): planned geometry missing from what was authored, a plan that cannot be built where it
 * stands, anything authored on a shared wall, geometry the compiler had to clip or drop, a planned capability
 * that did not build, volumes occupying the same space, an unresolved relationship, and every roof integrity
 * failure (missing/incomplete/unbuildable recipe, an eave trim that lost the authored roof, intersection,
 * stacking, fragmentation). Everything else is a subjective design-quality warning.
 *
 * This function only inspects the architecture. The final integrity gate (integrityGate.ts) runs it over the
 * artifact that will actually be saved, together with the Site Plan, scene-asset and authority checks, and is
 * what stops a blocked generation from finalizing.
 */
export function runDesignQualityGate(doc: ArchitecturalDesignDocument, diagnostics: ArchitectureDiagnostics): QualityGateResult {
  const masses = resolveMasses(doc);
  const byId = new Map(masses.map((m) => [m.id, m] as const));
  const checks: QualityCheck[] = [];
  const push = (id: string, passed: boolean, detail: string, severity: QualitySeverity = "warning") => checks.push({ id, passed, detail, severity });

  for (const courtyard of diagnostics.courtyards) {
    const edgeCount = courtyard.enclosingMassIds.length + 1;
    push(`courtyard-edges-${courtyard.anchorMassId}`, edgeCount >= 3, `${edgeCount} edge(s) around ${courtyard.anchorMassId}'s courtyard (anchor + ${courtyard.enclosingMassIds.length} enclosing mass(es)).`);

    const width = courtyard.bounds.x1 - courtyard.bounds.x0;
    const depth = courtyard.bounds.z1 - courtyard.bounds.z0;
    push(`courtyard-dimensions-${courtyard.anchorMassId}`, width >= MIN_COURTYARD_DIMENSION_M && depth >= MIN_COURTYARD_DIMENSION_M, `Courtyard is ${width.toFixed(1)}x${depth.toFixed(1)}m.`);
  }

  const collisions = massCollisions(masses);
  push("no-unintentional-overlap", collisions.length === 0, collisions.length ? collisions.map((c) => `"${c.a}" and "${c.b}" occupy the same space (${c.penetration.toFixed(1)}m).`).join(" ") : "No two volumes occupy the same space.", "blocking");

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
  push("requested-geometry-survived-compilation", survivedCompilation, survivedCompilation ? "No requested operation was clipped or dropped." : diagnostics.geometry.flatMap((g) => g.warnings.map((w) => `${g.massId}: ${w}`)).join("; "), "blocking");

  const ids = new Set(masses.map((m) => m.id));
  const unsatisfied = masses.flatMap((m) => (m.relationships ?? []).filter((r) => !ids.has(r.target)).map((r) => `${m.id} -> ${r.target}`));
  push("relationship-satisfaction", unsatisfied.length === 0, unsatisfied.length === 0 ? "Every relationship resolved against a real mass." : `Unresolved relationship target(s): ${unsatisfied.join(", ")}.`, "blocking");

  // Observation only: a long facade with no authored opening. The compiler adds none — what is authored is what is built.
  for (const mass of masses) {
    const longSide = Math.max(mass.width, mass.depth);
    if (longSide >= 9) {
      const hasOpenings = (mass.openings?.length ?? 0) > 0 || (mass.operations ?? []).some((op) => (op.type === "projection" || op.type === "recess") && op.open);
      push(`blank-facade-${mass.id}`, hasOpenings, hasOpenings ? `"${mass.id}" has intentional facade relief.` : `"${mass.id}" has a ${longSide.toFixed(1)}m facade but no opening or open facade operation.`);
    }
  }

  for (const mass of masses.filter((m) => m.role === "main-living")) {
    const glazed = (mass.openings ?? []).some((op) => op.type === "glazing-zone" && op.heightRatio >= .65);
    push(`living-glazing-${mass.id}`, glazed, glazed ? `"${mass.id}" has substantial living-area glazing.` : `"${mass.id}" has no substantial authored glazing (none is added for it).`);
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

  // Plan fidelity: what was AUTHORED must contain every planned element, and the plan must be buildable where it stands.
  for (const mass of masses.filter((m) => m.plan)) {
    const { missing, conflicts, notes } = planConformance(mass, masses, doc.siteStrategy, doc.capabilities ?? []);
    const detail = missing.length ? `"${mass.id}" is missing planned ${missing.join(", ")}.` : `"${mass.id}" realizes its ${mass.plan!.form}/${mass.plan!.structure} plan.`;
    push(`plan-realized-${mass.id}`, missing.length === 0, notes.length ? `${detail} Reference notes: ${notes.join(" ")}` : detail, "blocking");
    const shared = sharedFacades(mass, masses, doc.siteStrategy);
    const onSharedWall = [...(mass.operations ?? []), ...(mass.openings ?? [])].filter((item) => "facade" in item && shared.has(item.facade)).map((item) => `${item.type} on the shared ${"facade" in item ? item.facade : ""} wall`);
    const impossible = [...conflicts.map((c) => c.detail), ...onSharedWall];
    const baseline = baselineViolations(mass, masses, doc.siteStrategy);
    push(`plan-baseline-${mass.id}`, baseline.length === 0, baseline.length ? `Mandatory VolumePlan geometry on "${mass.id}" was contradicted: ${baseline.map((v) => `[${v.code}] ${v.detail}`).join(" ")}` : `"${mass.id}" keeps its mandatory VolumePlan geometry intact.`, "blocking");
    push(`facade-realization-${mass.id}`, impossible.length === 0, impossible.length ? `Impossible authored facade intent on "${mass.id}": ${impossible.join(" ")}` : `"${mass.id}" has no facade-specific realization conflict.`, "blocking");
  }
  for (const capability of diagnostics.capabilities) {
    if (capability.status === "applied") continue;
    const planned = PLAN_CAPABILITIES.has(capability.id);
    push(`capability-built-${capability.massId}-${capability.id}`, false, `${capability.id} on "${capability.massId}" was authored but not built (${capability.status}${capability.note ? `: ${capability.note}` : ""}).`, planned ? "blocking" : "warning");
  }

  // Roofs: one complete, buildable, physically clear recipe per volume — inspected AFTER clearance processing.
  const roofProblems = roofConflicts(masses, doc.roofs.recipes);
  for (const mass of masses) {
    const own = roofProblems.filter((c) => c.massId === mass.id);
    push(`roof-integrity-${mass.id}`, own.length === 0, own.length ? own.map((c) => `[${c.code}] ${c.detail}`).join(" ") : `"${mass.id}" carries one complete, buildable roof that clears its neighbors.`, "blocking");
  }
  for (const clearance of diagnostics.roofClearance.filter((c) => c.cleared < c.authored && c.preservesLanguage)) {
    push(`roof-eave-trimmed-${clearance.massId}`, true, `Eave on "${clearance.massId}" trimmed ${clearance.authored.toFixed(2)}m → ${clearance.cleared.toFixed(2)}m to clear "${clearance.neighborId}" (roof language preserved).`);
  }

  return summarizeChecks(checks);
}
