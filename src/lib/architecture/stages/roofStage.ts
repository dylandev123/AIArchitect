import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassVolume, RoofRecipe, RoofRecipeKind, SiteStrategy, VolumeHierarchy } from "../document";
import { assessRoofLanguage, describeRoofLanguageRules, EAVE_OVERHANG_TOLERANCE, LOW_SLOPE_MAX_PITCH, PITCH_TOLERANCE, wallPlateHeight, type RoofLanguage } from "../roofLanguage";
import { runStage, type RunStageResult } from "./runStage";
import { roofCompositionStageOutputSchema, type RoofCompositionStageOutput } from "./schemas";

const SYSTEM = `You are a senior residential architect composing ONE coherent whole-house roof language and the complete executable roof recipe for every volume of a finished massing plan.

Work in this order:
1. Choose the dominant roof family and expression for the dominant volume first, and declare it as \`language\` (dominantMassId, family, one-sentence concept). "mixed" is never a language.
2. Author every other roof as a subordinate of that language, never as an independent design:
   - Compatible families only (dominant → allowed subordinates):
${describeRoofLanguageRules()}
     A flat roof under a gable/hip language is only for a recessive link (connector, entry, terrace, veranda).
   - Hierarchy: no subordinate may out-express the dominant roof; a floating plane only repeats under a floating-flat language.
   - Pitch: roofs of the dominant's own family share its pitch (±${PITCH_TOLERANCE}°); a lean-to shed stays at or below a gable/hip pitch; sheds in a flat/floating/butterfly language stay at or below ${LOW_SLOPE_MAX_PITCH}°.
   - Orientation: sloped roofs keep their ridge/slope parallel or perpendicular to the dominant roof; \`orientation\` turns a roof relative to its own walls, so use 0 or π (π/2 only on a square mass).
   - Datums: volumes sharing a wall-plate height share one eave line (same family + same planned edge → overhangs within ${EAVE_OVERHANG_TOLERANCE}m), one parapet top, one floating reveal gap and plate thickness.
3. Avoid unrelated gable/hip/flat/floating forms competing on one house. Break the language only when the architecture truly calls for it: then set that roof's \`counterpoint\` to the reason (at most one counterpoint family, never the dominant roof).

Choose family, overhang, pitch, orientation, parapet and floating expression where applicable; do not leave dimensional tuning to the compiler. Honor each volume's planned roof edge. Return exactly one roof for every mass listed, using its exact id.`;

/** Failure-only defaults for an incomplete roof response. */
const ROOF_KIND_DEFAULTS: Record<RoofRecipeKind, { overhang: number; pitch: number }> = {
  flat: { overhang: 0.6, pitch: 2 },
  "floating-flat": { overhang: 0.9, pitch: 2 },
  shed: { overhang: 0.75, pitch: 12 },
  "mono-pitch": { overhang: 0.75, pitch: 15 },
  gable: { overhang: 0.6, pitch: 22 },
  hip: { overhang: 0.6, pitch: 24 },
  butterfly: { overhang: 0.9, pitch: 8 },
  pavilion: { overhang: 0.9, pitch: 20 },
  "cross-gable": { overhang: 0.6, pitch: 22 },
  mixed: { overhang: 0.75, pitch: 14 },
};

export interface RoofCompositionStageContext { intent: ArchitecturalIntent; siteStrategy: SiteStrategy; masses: readonly MassVolume[]; }

/**
 * Scales a mass's overhang by its architectural weight instead of one flat per-kind default for every mass:
 * a dominant living volume keeps the family's full overhang; a connector/terrace/service volume — meant to
 * read as quieter, lighter infrastructure, not a second dominant form — gets a reduced one. Computed in
 * code, never asked of the model.
 */
const ROLE_OVERHANG_SCALE: Record<MassVolume["role"], number> = {
  "main-living": 1, "bedroom-wing": 0.85, "guest-pavilion": 0.85, garage: 0.7, service: 0.65, connector: 0.65, terrace: 0.65, veranda: 0.7, entry: 0.8,
};

/** A planned volume's hierarchy replaces the role-based scale — the plan already says how strongly it should read. */
const HIERARCHY_OVERHANG_SCALE: Record<VolumeHierarchy, number> = { dominant: 1, supporting: 0.85, recessive: 0.65 };

/** How far a `floating-flat` roof's reveal gap scales with the mass it sits on — a small mass with the flat `.18` default reads as floating fine, but a large one needs a deeper gap to read as floating at all. */
function scaledVerticalGap(mass: MassVolume): number {
  return Math.max(0.18, Math.min(0.4, Math.max(mass.width, mass.depth) * 0.02));
}

const hasChamfer = (m: MassVolume) => (m.operations ?? []).some((op) => op.type === "chamfer");
const describeMass = (m: MassVolume) => `${m.id} "${m.name}", role ${m.role}, ${m.width.toFixed(1)}x${m.depth.toFixed(1)}m, ${m.floors} floor(s), wall plate at ${wallPlateHeight(m).toFixed(2)}m${m.rotation ? `, rotated ${Math.round((m.rotation * 180) / Math.PI)}°` : ""}${m.plan ? `, ${m.plan.hierarchy}, planned roof edge ${m.plan.roofEdge}` : ""}${hasChamfer(m) ? ", chamfered prow" : ""}.`;

/** The families the compiler can build along an angled (chamfered) edge; any other becomes a shed there — the closest single-plane form. */
const PROW_ROOF_KINDS = new Set<RoofRecipeKind>(["flat", "floating-flat", "shed", "mono-pitch"]);

/** Canonical signed radians for a periodic authored roof rotation. */
export function normalizeRoofOrientation(radians: number): number {
  const turn = Math.PI * 2;
  return Math.round((((radians + Math.PI) % turn + turn) % turn - Math.PI) * 1_000_000) / 1_000_000;
}

/**
 * A floating plane reads as floating from its reveal gap and thinness, not from reach: a deep cantilever of
 * a thin plate reads as a detached lid hovering off the volume. So its overhang is proportioned to the
 * volume (≈10% of its short side, 0.45–0.9m) with only a small shelter allowance — never the deep-eave depth.
 */
function floatingOverhang(minDim: number, shelter: boolean): number {
  return Math.min(Math.max(0.45, Math.min(0.9, minDim * 0.1)) + (shelter ? 0.25 : 0), minDim * 0.12);
}

/**
 * Turns a chosen roof family into a recipe, honoring the volume's planned roof edge: a parapet is a crisp
 * flat box edge with no eave, a floating edge a thin plane on a glass reveal, and deep/thin eaves set the
 * overhang regardless of family. A mass without a plan keeps the family-and-role defaults.
 */
export function roofForMass(mass: MassVolume, chosen: RoofRecipeKind, intent: ArchitecturalIntent): RoofRecipe {
  const edge = mass.plan?.roofEdge;
  const requested: RoofRecipeKind = edge === "parapet" ? "flat" : edge === "floating" ? "floating-flat" : chosen;
  const kind: RoofRecipeKind = hasChamfer(mass) && !PROW_ROOF_KINDS.has(requested) ? "shed" : requested;
  const defaults = ROOF_KIND_DEFAULTS[kind];
  const scale = mass.plan ? HIERARCHY_OVERHANG_SCALE[mass.plan.hierarchy] : ROLE_OVERHANG_SCALE[mass.role];
  // A shelter goal deepens every eave by the same margin `designArchitecture` uses, regardless of family.
  const shelter = intent.environmentalGoals.includes("shelter");
  const shelterBonus = shelter ? 0.5 : 0;
  const base = defaults.overhang * scale;
  const minDim = Math.min(mass.width, mass.depth);
  const planned = edge === "parapet" ? 0
    : edge === "thin-eave" ? Math.min(base, 0.4)
    : edge === "deep-eave" ? Math.max(base * 1.6, 1.2) + shelterBonus
    : edge === "floating" ? floatingOverhang(minDim, shelter)
    : base + shelterBonus;
  // A planned eave still stays in proportion to a small volume (the quality gate's roof-mass-proportionality limit is 40%).
  const overhang = edge ? Math.min(planned, minDim * 0.35) : planned;
  return {
    id: `${mass.id}-roof`, massId: mass.id, kind, overhang: Math.round(overhang * 100) / 100, pitch: defaults.pitch,
    ...(kind === "floating-flat" ? { expression: { verticalGap: scaledVerticalGap(mass) } } : {}),
    ...(edge === "parapet" ? { parapet: { height: mass.plan?.hierarchy === "dominant" ? 0.55 : 0.4, thickness: 0.2 } } : {}),
  };
}

/** What gets built when roof composition fails: every planned edge still honored, flat family otherwise. */
export function fallbackRoofs(masses: readonly MassVolume[], intent: ArchitecturalIntent): RoofRecipe[] {
  return masses.map((mass) => (mass.plan ? roofForMass(mass, "flat", intent) : { id: `${mass.id}-roof`, massId: mass.id, kind: "flat", overhang: 0.6 }));
}

/** The roof stage's result: the authored recipes, the declared language, and any language issues the model never repaired. */
export type RoofCompositionStageResult = RunStageResult<RoofRecipe[]> & { language?: RoofLanguage; warnings?: string[] };

/** Every mass exactly once, by exact id — the only faults that make a response unbuildable. */
function structuralRoofErrors(value: RoofCompositionStageOutput, ids: readonly string[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const roof of value.roofs) {
    if (!ids.includes(roof.massId)) errors.push(`Unknown mass id "${roof.massId}". Use one of: ${ids.join(", ")}.`);
    else if (seen.has(roof.massId)) errors.push(`Duplicate roof for mass "${roof.massId}".`);
    seen.add(roof.massId);
  }
  for (const id of ids) if (!seen.has(id)) errors.push(`Missing a roof for mass "${id}".`);
  return errors;
}

/** Whole-house roof-language coherence of an authored response (see roofLanguage.ts). */
export function roofLanguageErrors(value: RoofCompositionStageOutput, masses: readonly MassVolume[]): string[] {
  const roofs = value.roofs.map((r) => ({ ...r, id: `${r.massId}-roof` }));
  return assessRoofLanguage(value.language, roofs, masses);
}

/**
 * Turns an authored response into recipes. The AI's valid executable recipe is authoritative — the compiler
 * will still reject impossible meshes; `roofForMass` is reserved for a missing/incomplete entry, never for
 * reinterpreting a complete one (and never for enforcing the roof language).
 */
export function recipesFromAuthoredRoofs(value: RoofCompositionStageOutput, masses: readonly MassVolume[], intent: ArchitecturalIntent): RoofRecipe[] {
  const byId = new Map(value.roofs.map((r) => [r.massId, r] as const));
  return masses.map((mass) => {
    const authored = byId.get(mass.id);
    if (!authored) return roofForMass(mass, "flat", intent);
    if (authored.overhang === undefined || authored.pitch === undefined) return roofForMass(mass, authored.kind, intent);
    return { id: `${mass.id}-roof`, massId: mass.id, kind: authored.kind, overhang: authored.overhang, pitch: authored.pitch,
      ...(authored.orientation !== undefined ? { orientation: normalizeRoofOrientation(authored.orientation) } : {}),
      ...(authored.expression ? { expression: authored.expression } : {}),
      ...(authored.parapet ? { parapet: authored.parapet } : {}),
    };
  });
}

/**
 * One model call for the whole roof composition instead of one per mass: by the time roofs are chosen every
 * mass is already placed, so the model sees the full composition and designs one roof language for it —
 * dominant family first, every other roof subordinate to it. Language incoherence drives the repair retry;
 * if the last attempt is still structurally complete, its authored roofs are kept (AI authority) and the
 * unrepaired language issues are reported as warnings rather than replaced by deterministic flat roofs.
 */
export async function runRoofCompositionStage(ctx: RoofCompositionStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RoofCompositionStageResult> {
  const ids = ctx.masses.map((m) => m.id);
  const result = await runStage({
    stageName: "roof-composition",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `Architectural intent: mood ${ctx.intent.mood.join(", ")}; environmental goals ${ctx.intent.environmentalGoals.join(", ")}.`,
      `Site: environment=${ctx.siteStrategy.environment}, terrain=${ctx.siteStrategy.terrain}, view faces ${ctx.siteStrategy.viewDirection}.`,
      `Masses (${ctx.masses.length}):\n${ctx.masses.map(describeMass).join("\n")}`,
      previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: roofCompositionStageOutputSchema,
    timings, remainingBudgetMs, usageMeta,
    // A language header plus one complete recipe (family, overhang, pitch, optional orientation/parapet/expression) per mass.
    maxOutputTokens: 250 + ctx.masses.length * 90,
    validate: (value) => {
      const structural = structuralRoofErrors(value, ids);
      return structural.length ? structural : roofLanguageErrors(value, ctx.masses);
    },
  });
  if (result.ok) return { ...result, value: recipesFromAuthoredRoofs(result.value, ctx.masses, ctx.intent), ...(result.value.language ? { language: result.value.language } : {}) };
  // Only language issues left unrepaired: the authored roofs still build, so they stand.
  const last = result.rawValueTruncated ? undefined : roofCompositionStageOutputSchema.safeParse(result.rawValue);
  if (last?.success && structuralRoofErrors(last.data, ids).length === 0) {
    const warnings = roofLanguageErrors(last.data, ctx.masses);
    return { ok: true, value: recipesFromAuthoredRoofs(last.data, ctx.masses, ctx.intent), attempts: result.attempts, durationMs: result.durationMs,
      ...(last.data.language ? { language: last.data.language } : {}), ...(warnings.length ? { warnings } : {}) };
  }
  return result;
}
