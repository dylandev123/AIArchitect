import type { CompassSide } from "@/types/house";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassRelationship, MassRole, MassVolume, SiteStrategy, VolumePlan } from "../document";
import { computeCourtyards, pickDominantMass, resolveMasses } from "../compiler";
import { completeVolumePlan, realizeVolumePlan } from "../volumePlan";

/**
 * Deterministic completion of an AI-authored composition, run once every volume is placed and before the
 * Geometry Pass. It never adds a volume, changes a role, or overrides an explicit placement; it only makes
 * what the design already declared executable:
 *  - a courtyard the design started (any `surrounds-courtyard`) gets the sides, second wing and clear width
 *    the compiler needs to actually build one (`computeCourtyards` wants 2+ sided wings around one anchor);
 *  - a brief whose intent asks for indoor-outdoor living gets at least one at-grade open outdoor room, using
 *    the plan vocabulary (outdoor/outdoorSide) the model itself chooses from — only when it chose none.
 * Idempotent, so a Replay can re-run it over cached masses.
 */

const OPPOSITE: Record<CompassSide, CompassSide> = { north: "south", south: "north", east: "west", west: "east" };
const PERPENDICULAR: Record<CompassSide, [CompassSide, CompassSide]> = { north: ["east", "west"], south: ["east", "west"], east: ["north", "south"], west: ["north", "south"] };
/** Below this a courtyard is a gap between walls, not an outdoor room (matches the quality gate's minimum). */
export const MIN_COURTYARD_GAP_M = 3;
/** Wings that may close a courtyard, most private first; a garage never becomes a courtyard wall by inference. */
const WING_ROLES: readonly MassRole[] = ["bedroom-wing", "guest-pavilion", "service", "connector", "entry"];
const RECRUITABLE_KINDS = new Set<MassRelationship["kind"]>(["adjacent-to", "offset-from", "separated-from"]);
const OUTDOOR_ROLES: readonly MassRole[] = ["main-living", "guest-pavilion", "terrace", "veranda"];
const GRADE_M = 0.6;

export interface CompositionCompletion { masses: MassVolume[]; notes: string[] }

/** Where a courtyard wing goes when nothing says: the flanks of the view axis first (the court opens to the view), then the arrival side. Never the view side itself. */
function preferredCourtSides(site: SiteStrategy): CompassSide[] {
  const [a, b] = PERPENDICULAR[site.viewDirection];
  return [a, b, site.arrivalDirection, OPPOSITE[site.viewDirection]].filter((s, i, all) => s !== site.viewDirection && all.indexOf(s) === i);
}

function sideFromPositions(mass: MassVolume, anchor: MassVolume): CompassSide | undefined {
  const dx = mass.position.x - anchor.position.x, dz = mass.position.z - anchor.position.z;
  if (Math.hypot(dx, dz) < 0.5) return undefined;
  return Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? "east" : "west") : (dz > 0 ? "south" : "north");
}

function completeCourtyards(masses: MassVolume[], site: SiteStrategy, notes: string[]): MassVolume[] {
  const byId = new Map(masses.map((m) => [m.id, m] as const));
  const anchors = [...new Set(masses.flatMap((m) => (m.relationships ?? []).filter((r) => r.kind === "surrounds-courtyard" && byId.has(r.target)).map((r) => r.target)))];
  if (!anchors.length) return masses;
  let out = masses.map((m) => ({ ...m, relationships: m.relationships ? [...m.relationships] : m.relationships }));
  const setRel = (massId: string, index: number, rel: MassRelationship) => {
    out = out.map((m) => (m.id === massId ? { ...m, relationships: m.relationships!.map((r, i) => (i === index ? rel : r)) } : m));
  };

  for (const anchorId of anchors) {
    const anchor = out.find((m) => m.id === anchorId)!;
    const claimed = () => new Set(out.flatMap((m) => (m.relationships ?? []).filter((r) => r.kind === "surrounds-courtyard" && r.target === anchorId && r.side).map((r) => r.side!)));
    const freeSide = (preferred?: CompassSide) => [preferred, ...preferredCourtSides(site)].find((s): s is CompassSide => !!s && s !== site.viewDirection && !claimed().has(s));

    // 1. Every enclosing wing states which side of the anchor it closes, and stands a real courtyard's width away.
    for (const mass of out) {
      (mass.relationships ?? []).forEach((rel, i) => {
        if (rel.kind !== "surrounds-courtyard" || rel.target !== anchorId) return;
        let next = rel;
        if (!rel.side) {
          const side = freeSide(sideFromPositions(mass, anchor));
          if (!side) return;
          next = { ...next, side };
          notes.push(`"${mass.id}" encloses "${anchorId}"'s courtyard on its ${side} side (side inferred).`);
        }
        if (!mass.placementLocked && (next.distance ?? 0) < MIN_COURTYARD_GAP_M) {
          next = { ...next, distance: MIN_COURTYARD_GAP_M };
          notes.push(`"${mass.id}" set ${MIN_COURTYARD_GAP_M}m off "${anchorId}" so the courtyard is a usable outdoor room.`);
        }
        if (next !== rel) setRel(mass.id, i, next);
      });
    }

    // 2. One wing is an offset, not a courtyard: close it with the wing already placed against the anchor.
    const enclosing = () => out.filter((m) => (m.relationships ?? []).some((r) => r.kind === "surrounds-courtyard" && r.target === anchorId && r.side));
    const candidates = out
      .filter((m) => m.id !== anchorId && WING_ROLES.includes(m.role) && !enclosing().includes(m))
      .sort((a, b) => WING_ROLES.indexOf(a.role) - WING_ROLES.indexOf(b.role));
    for (const mass of candidates) {
      if (enclosing().length >= 2) break;
      const index = (mass.relationships ?? []).findIndex((r) => r.target === anchorId && RECRUITABLE_KINDS.has(r.kind) && r.side && r.side !== site.viewDirection && !claimed().has(r.side));
      if (index < 0) continue;
      const rel = mass.relationships![index];
      setRel(mass.id, index, { ...rel, kind: "surrounds-courtyard", distance: Math.max(rel.distance ?? 0, MIN_COURTYARD_GAP_M) });
      notes.push(`"${mass.id}" (${rel.kind} ${anchorId}, ${rel.side}) now closes "${anchorId}"'s courtyard as its second wing.`);
    }
    if (enclosing().length < 2) notes.push(`"${anchorId}"'s courtyard has ${enclosing().length} enclosing wing — no second wing is placed against it to close it.`);
  }
  return out;
}

function hasAtGradeTerrace(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy, plan?: VolumePlan): boolean {
  if (mass.elevation > GRADE_M) return false;
  return realizeVolumePlan(mass, masses, site, plan).operations.some((op) => (op.type === "projection" || op.type === "recess") && op.open && op.floors !== "upper");
}

function ensureIndoorOutdoor(masses: MassVolume[], intent: ArchitecturalIntent, site: SiteStrategy, notes: string[]): MassVolume[] {
  if (!intent.spatialGoals.includes("indoor-outdoor")) return masses;
  if (masses.some((m) => hasAtGradeTerrace(m, masses, site))) return masses;
  const dominant = pickDominantMass(masses);
  const inCourt = new Set(computeCourtyards(masses).flatMap((c) => [c.anchorMassId, ...c.enclosingMassIds]));
  const candidates = masses
    .filter((m) => OUTDOOR_ROLES.includes(m.role) && m.elevation <= GRADE_M)
    .sort((a, b) => (a.id === dominant?.id ? -1 : b.id === dominant?.id ? 1 : b.width * b.depth - a.width * a.depth));
  for (const mass of candidates) {
    const plan = mass.plan ?? completeVolumePlan(undefined, mass.role);
    const outdoor = plan.outdoor === "none" ? "covered-terrace" : plan.outdoor;
    const sides = [...new Set([plan.outdoorSide, ...(inCourt.has(mass.id) ? ["courtyard" as const] : []), "view" as const, "flank" as const])];
    for (const outdoorSide of sides) {
      const next: VolumePlan = { ...plan, outdoor, outdoorSide };
      if (!hasAtGradeTerrace(mass, masses, site, next)) continue;
      notes.push(`indoor-outdoor brief: "${mass.id}" opens a ${outdoor} to the ${outdoorSide} (no volume had an at-grade outdoor room).`);
      return masses.map((m) => (m.id === mass.id ? { ...m, plan: next } : m));
    }
  }
  notes.push("indoor-outdoor brief: no at-grade living/guest volume has a free edge for an outdoor room.");
  return masses;
}

export function completeComposition(masses: readonly MassVolume[], intent: ArchitecturalIntent, site: SiteStrategy): CompositionCompletion {
  const notes: string[] = [];
  const courted = resolveMasses({ siteStrategy: site, massing: { masses: completeCourtyards([...masses], site, notes) } });
  return { masses: ensureIndoorOutdoor(courted, intent, site, notes), notes };
}
