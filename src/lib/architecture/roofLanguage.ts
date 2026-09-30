import { massTotalHeight } from "./compiler";
import type { MassVolume, RoofRecipe, RoofRecipeKind } from "./document";

/**
 * Whole-house roof language: the roof stage's model picks ONE dominant roof family for the dominant volume
 * first, and every other roof is authored as a subordinate of it. This module is only the deterministic
 * referee for that authored composition — it never picks a family or tunes a recipe itself; its findings are
 * fed back to the model as repair errors (or surfaced as warnings), never applied to the roofs.
 */
export interface RoofLanguage {
  /** The mass whose roof sets the language. */
  dominantMassId: string;
  /** The dominant roof family; the dominant mass's roof must use it. */
  family: RoofRecipeKind;
  /** One sentence describing the whole-house roof idea. */
  concept?: string;
}

/** A roof as the stage authored it, with an optional justification for deliberately breaking the language. */
export type AuthoredRoof = RoofRecipe & { counterpoint?: string };

export type RoofFamilyGroup = "planar" | "skillion" | "butterfly" | "gabled" | "hipped" | "mixed";

export const ROOF_FAMILY_GROUP: Record<RoofRecipeKind, RoofFamilyGroup> = {
  flat: "planar", "floating-flat": "planar", shed: "skillion", "mono-pitch": "skillion", butterfly: "butterfly",
  gable: "gabled", "cross-gable": "gabled", hip: "hipped", pavilion: "hipped", mixed: "mixed",
};

const SLOPED_GROUPS = new Set<RoofFamilyGroup>(["skillion", "butterfly", "gabled", "hipped"]);
const RIDGED_GROUPS = new Set<RoofFamilyGroup>(["gabled", "hipped"]);

/**
 * Which subordinate families read as one language with a dominant family. A floating plane is a signature
 * gesture, so it only repeats under a floating dominant; a lean-to shed coordinates with every pitched
 * language; a plain flat roof under a pitched language is only a quiet link (see `FLAT_UNDER_PITCHED_OK`).
 * `mixed` is not a language, so it is never a valid dominant family.
 */
export const COMPATIBLE_SUBORDINATE_KINDS: Record<Exclude<RoofRecipeKind, "mixed">, readonly RoofRecipeKind[]> = {
  flat: ["flat", "shed", "mono-pitch"],
  "floating-flat": ["floating-flat", "flat", "shed", "mono-pitch"],
  shed: ["shed", "mono-pitch", "flat"],
  "mono-pitch": ["mono-pitch", "shed", "flat"],
  butterfly: ["butterfly", "shed", "mono-pitch", "flat"],
  gable: ["gable", "cross-gable", "shed", "mono-pitch", "flat"],
  "cross-gable": ["cross-gable", "gable", "shed", "mono-pitch", "flat"],
  hip: ["hip", "pavilion", "shed", "mono-pitch", "flat"],
  pavilion: ["pavilion", "hip", "shed", "mono-pitch", "flat"],
};

/** Without a volume plan, these roles are links/porches that may carry a quiet flat roof under a pitched language. */
const LINK_ROLES = new Set<MassVolume["role"]>(["connector", "terrace", "entry", "veranda"]);
/** Max pitch (degrees) for a skillion that stays in a low-slope planar/butterfly language. */
export const LOW_SLOPE_MAX_PITCH = 15;
/** Degrees within which roofs of the dominant's own group count as sharing its pitch. */
export const PITCH_TOLERANCE = 3;
const DATUM_TOLERANCE = 0.05;
/** Meters within which same-family roofs on a shared wall plate share one eave line. */
export const EAVE_OVERHANG_TOLERANCE = 0.3;
const ANGLE_TOLERANCE = (3 * Math.PI) / 180;

const DEFAULT_PITCH: Partial<Record<RoofRecipeKind, number>> = { shed: 12, "mono-pitch": 12 };
const pitchOf = (r: RoofRecipe) => r.pitch ?? DEFAULT_PITCH[r.kind] ?? 0;
const round2 = (n: number) => Math.round(n * 100) / 100;
const deg = (radians: number) => Math.round((radians * 180) / Math.PI);

/** Distance of `radians` from the nearest multiple of `period`. */
function offPeriod(radians: number, period: number): number {
  const r = ((radians % period) + period) % period;
  return Math.min(r, period - r);
}

/** Wall-plate height (grade to roof bearing) — the datum a roof's eave line starts from. */
export const wallPlateHeight = (mass: MassVolume) => mass.elevation + massTotalHeight(mass);

function isRecessive(mass: MassVolume): boolean {
  return mass.plan ? mass.plan.hierarchy === "recessive" : LINK_ROLES.has(mass.role);
}

/** A bullet list of the compatibility matrix, for the stage prompt — the prompt and the referee share one source. */
export function describeRoofLanguageRules(): string {
  return (Object.entries(COMPATIBLE_SUBORDINATE_KINDS) as [RoofRecipeKind, readonly RoofRecipeKind[]][])
    .map(([dominant, subs]) => `- ${dominant} → ${subs.join(", ")}`).join("\n");
}

/**
 * Every way the authored roofs break the declared whole-house roof language, as actionable sentences. Empty
 * means coherent. A roof carrying a `counterpoint` justification is exempt from the family, pitch, orientation
 * and datum rules — but only one counterpoint family is allowed, and never on the dominant mass.
 */
export function assessRoofLanguage(language: RoofLanguage | undefined, roofs: readonly AuthoredRoof[], masses: readonly MassVolume[]): string[] {
  const errors: string[] = [];
  const massById = new Map(masses.map((m) => [m.id, m] as const));
  const authored = roofs.filter((r) => massById.has(r.massId));

  // Orientation is a fit rule for every roof, language or not: `orientation` rotates the roof relative to its
  // own walls, so anything but a half-turn swings it off a rectangular footprint.
  for (const roof of authored) {
    const mass = massById.get(roof.massId)!;
    if (!roof.orientation) continue;
    const square = Math.abs(mass.width - mass.depth) <= 0.1 * Math.max(mass.width, mass.depth);
    const period = square ? Math.PI / 2 : Math.PI;
    if (offPeriod(roof.orientation, period) > ANGLE_TOLERANCE) {
      errors.push(`"${roof.massId}" roof orientation ${deg(roof.orientation)}° turns it off its own ${mass.width.toFixed(1)}x${mass.depth.toFixed(1)}m walls — use ${square ? "0°, 90°, 180° or 270°" : "0° or 180°"}.`);
    }
  }

  if (masses.length <= 1) return errors;
  if (!language) return [...errors, "Declare the whole-house roof language: the dominant mass and its roof family, before the individual roofs."];
  if (language.family === "mixed") return [...errors, `"mixed" is not a roof language — choose one dominant family (${Object.keys(COMPATIBLE_SUBORDINATE_KINDS).join(", ")}).`];

  const dominantMass = massById.get(language.dominantMassId);
  if (!dominantMass) return [...errors, `Roof language names unknown dominant mass "${language.dominantMassId}". Use one of: ${masses.map((m) => m.id).join(", ")}.`];
  const plannedDominants = masses.filter((m) => m.plan?.hierarchy === "dominant");
  if (plannedDominants.length && !plannedDominants.includes(dominantMass)) {
    errors.push(`Roof language dominant mass must be the planned dominant volume (${plannedDominants.map((m) => m.id).join(", ")}), not "${dominantMass.id}".`);
  }
  const dominantRoof = authored.find((r) => r.massId === dominantMass.id);
  if (!dominantRoof) return errors;
  if (dominantRoof.kind !== language.family) errors.push(`Dominant mass "${dominantMass.id}" must carry the language's own ${language.family} roof, not ${dominantRoof.kind}.`);
  if (dominantRoof.counterpoint) errors.push(`The dominant roof sets the language; it can't be a counterpoint.`);

  const family = language.family;
  const group = ROOF_FAMILY_GROUP[family];
  const allowed = COMPATIBLE_SUBORDINATE_KINDS[family];
  const dominantPitch = pitchOf(dominantRoof);
  const dominantYaw = dominantMass.rotation + (dominantRoof.orientation ?? 0);

  const counterpoints = authored.filter((r) => r.massId !== dominantMass.id && r.counterpoint);
  const counterpointFamilies = new Set(counterpoints.map((r) => ROOF_FAMILY_GROUP[r.kind]));
  if (counterpointFamilies.size > 1) errors.push(`At most one counterpoint roof family may break the ${family} language; found ${[...counterpointFamilies].join(", ")}.`);

  const subordinates = authored.filter((r) => r.massId !== dominantMass.id && !r.counterpoint);
  for (const roof of subordinates) {
    const mass = massById.get(roof.massId)!;
    const subGroup = ROOF_FAMILY_GROUP[roof.kind];
    // Hierarchy + family compatibility.
    if (!allowed.includes(roof.kind)) {
      errors.push(`"${roof.massId}" ${roof.kind} roof competes with the ${family} language — use ${allowed.join(", ")}, or give it a counterpoint justification.`);
      continue;
    }
    if (roof.kind === "flat" && RIDGED_GROUPS.has(group) && !isRecessive(mass)) {
      errors.push(`"${roof.massId}" is not a recessive link, so a flat roof under the ${family} language reads as a separate building — use ${allowed.filter((k) => k !== "flat").join(", ")}, or justify it as a counterpoint.`);
    }
    // Pitch relationships.
    const pitch = pitchOf(roof);
    if (SLOPED_GROUPS.has(subGroup)) {
      if (subGroup === group && Math.abs(pitch - dominantPitch) > PITCH_TOLERANCE) {
        errors.push(`"${roof.massId}" ${roof.kind} pitch ${round2(pitch)}° should share the dominant ${round2(dominantPitch)}° pitch (±${PITCH_TOLERANCE}°).`);
      } else if (subGroup === "skillion" && RIDGED_GROUPS.has(group) && pitch > dominantPitch + PITCH_TOLERANCE) {
        errors.push(`"${roof.massId}" lean-to pitch ${round2(pitch)}° is steeper than the dominant ${round2(dominantPitch)}° ${family} — a subordinate slope stays at or below it.`);
      } else if (subGroup === "skillion" && (group === "planar" || group === "butterfly") && pitch > LOW_SLOPE_MAX_PITCH) {
        errors.push(`"${roof.massId}" ${roof.kind} pitch ${round2(pitch)}° breaks the low-slope ${family} language — keep it at or below ${LOW_SLOPE_MAX_PITCH}°.`);
      }
      // Orientation relationship: sloped subordinates share the dominant's plan grid — unless massing deliberately
      // turned this volume off it, in which case the roof follows its own walls.
      const onGrid = offPeriod(mass.rotation - dominantMass.rotation, Math.PI / 2) <= ANGLE_TOLERANCE;
      const yaw = mass.rotation + (roof.orientation ?? 0);
      if (onGrid && offPeriod(yaw - dominantYaw, Math.PI / 2) > ANGLE_TOLERANCE) {
        errors.push(`"${roof.massId}" roof runs ${deg(offPeriod(yaw - dominantYaw, Math.PI / 2))}° off the dominant roof's grid — keep its slope parallel or perpendicular to the dominant ridge/slope.`);
      }
    }
  }

  // Shared datums: roofs bearing on the same wall-plate height share one eave/parapet/floating line.
  const coordinated = [dominantRoof, ...subordinates];
  for (let i = 0; i < coordinated.length; i++) {
    for (let j = i + 1; j < coordinated.length; j++) {
      const a = coordinated[i], b = coordinated[j];
      const ma = massById.get(a.massId)!, mb = massById.get(b.massId)!;
      if (Math.abs(wallPlateHeight(ma) - wallPlateHeight(mb)) > DATUM_TOLERANCE) continue;
      const pair = `"${a.massId}" and "${b.massId}"`;
      if (a.parapet && b.parapet && Math.abs(a.parapet.height - b.parapet.height) > DATUM_TOLERANCE) {
        errors.push(`${pair} share a wall-plate height, so their parapets should share one top line (${a.parapet.height}m vs ${b.parapet.height}m).`);
      }
      if (a.kind === "floating-flat" && b.kind === "floating-flat") {
        const gapA = a.expression?.verticalGap ?? 0.18, gapB = b.expression?.verticalGap ?? 0.18;
        const thickA = a.expression?.thickness ?? 0.25, thickB = b.expression?.thickness ?? 0.25;
        if (Math.abs(gapA - gapB) > DATUM_TOLERANCE || Math.abs(thickA - thickB) > DATUM_TOLERANCE) {
          errors.push(`${pair} share a wall-plate height, so their floating planes should share one reveal gap and plate thickness (${gapA}/${thickA}m vs ${gapB}/${thickB}m).`);
        }
      }
      const sameEdge = ma.plan?.roofEdge === mb.plan?.roofEdge;
      if (a.kind === b.kind && sameEdge && Math.abs((a.overhang ?? 0) - (b.overhang ?? 0)) > EAVE_OVERHANG_TOLERANCE) {
        errors.push(`${pair} are ${a.kind} roofs on one wall-plate height with the same planned edge, so they should share one eave line — overhangs ${a.overhang}m vs ${b.overhang}m differ by more than ${EAVE_OVERHANG_TOLERANCE}m.`);
      }
    }
  }
  return errors;
}
