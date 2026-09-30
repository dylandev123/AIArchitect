import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { ArchitecturalIntent } from "../designEngine";
import type { MassVolume, RoofRecipe, SiteStrategy } from "../document";
import type { DesignRecipe } from "@/types/library";
import { roofRecipeCompatibility, roofRecipeSystem } from "../roofRecipeLibrary";
import { roofConflicts } from "./integrityChecks";
import { repairRequests } from "./recovery";
import { getRoofSystem, roofShapeOf } from "../roofSystems";
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
4. A volume whose footprint is articulated (notched, L-shaped, recessed, with a projecting terrace) has no V2 valley geometry yet: never give it a gable, hip, butterfly, pavilion or cross-gable roof — use flat, floating-flat, shed or mono-pitch. The same holds for a chamfered prow.
5. Keep every eave clear of the neighboring volumes: two roofs whose overhangs together exceed the gap between their volumes collide. A volume that stands against another can carry at most a 0.6m overhang. Under a volume stacked on top of it, a roof is a plain flat deck (no parapet, no floating gap).

You author the complete executable recipe for every roof — family, overhang AND pitch always, plus orientation, parapet and floating expression where applicable. Nothing is defaulted, substituted or overridden afterwards: a missing, incomplete or unbuildable roof is sent back to you, and no fallback roof is ever built in its place. Honor each volume's planned roof edge. Return exactly one roof for every mass listed, using its exact id.`;

export interface RoofCompositionStageContext { intent: ArchitecturalIntent; siteStrategy: SiteStrategy; masses: readonly MassVolume[]; approvedRecipes?: readonly DesignRecipe[]; }

const hasChamfer = (m: MassVolume) => (m.operations ?? []).some((op) => op.type === "chamfer");
const isArticulated = (m: MassVolume) => (m.operations ?? []).some((op) => op.type !== "chamfer");
const describeMass = (m: MassVolume) => `${m.id} "${m.name}", role ${m.role}, ${m.width.toFixed(1)}x${m.depth.toFixed(1)}m at (${m.position.x.toFixed(1)}, ${m.position.z.toFixed(1)}), ${m.floors} floor(s), wall plate at ${wallPlateHeight(m).toFixed(2)}m${m.rotation ? `, rotated ${Math.round((m.rotation * 180) / Math.PI)}°` : ""}${m.plan ? `, ${m.plan.hierarchy}, planned roof edge ${m.plan.roofEdge}` : ""}${hasChamfer(m) ? ", chamfered prow" : ""}${isArticulated(m) ? ", articulated footprint" : ""}.`;

/** Canonical signed radians for a periodic authored roof rotation. */
export function normalizeRoofOrientation(radians: number): number {
  const turn = Math.PI * 2;
  return Math.round((((radians + Math.PI) % turn + turn) % turn - Math.PI) * 1_000_000) / 1_000_000;
}

/** The roof stage's result: the authored recipes, the declared language, and any language issues the model never repaired. */
export type RoofCompositionStageResult = RunStageResult<RoofRecipe[]> & { language?: RoofLanguage; warnings?: string[]; libraryRecipe?: DesignRecipe; normalizations?: string[] };

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
 * Turns an authored response into recipes — a one-to-one conversion of what the architect returned. The only
 * change is orientation normalization (a rotation is periodic). There is no fallback recipe: a mass the response
 * leaves out simply has no roof here, and an entry without overhang/pitch stays incomplete — both are
 * `roofConflicts`, repaired by this stage or fatal to the generation.
 */
export function recipesFromAuthoredRoofs(value: RoofCompositionStageOutput, masses: readonly MassVolume[]): RoofRecipe[] {
  const byId = new Map(value.roofs.map((r) => [r.massId, r] as const));
  return masses.flatMap((mass) => {
    const authored = byId.get(mass.id);
    if (!authored) return [];
    return [{ id: `${mass.id}-roof`, massId: mass.id, kind: authored.kind,
      ...(authored.overhang !== undefined ? { overhang: authored.overhang } : {}),
      ...(authored.pitch !== undefined ? { pitch: authored.pitch } : {}),
      ...(authored.orientation !== undefined ? { orientation: normalizeRoofOrientation(authored.orientation) } : {}),
      ...(authored.expression ? { expression: authored.expression } : {}),
      ...(authored.parapet ? { parapet: authored.parapet } : {}),
    }];
  });
}

/** Everything that makes an authored response unbuildable as authored: the id bookkeeping, then the physical roof checks. */
export function roofAuthorityErrors(value: RoofCompositionStageOutput, masses: readonly MassVolume[]): string[] {
  const structural = structuralRoofErrors(value, masses.map((m) => m.id));
  return structural.length ? structural : repairRequests(roofConflicts(masses, recipesFromAuthoredRoofs(value, masses)));
}

/**
 * One model call for the whole roof composition instead of one per mass: by the time roofs are chosen every
 * mass is already placed, so the model sees the full composition and designs one roof language for it —
 * dominant family first, every other roof subordinate to it.
 *
 * Authority: the recipes that come out are exactly the ones the model authored. A missing, incomplete or
 * unbuildable roof (see `roofConflicts`) and language incoherence both drive the repair retry. If the last
 * attempt is complete and buildable but still has language issues, its authored roofs stand and the issues are
 * reported as warnings (a subjective finding). Otherwise the stage FAILS — no deterministic roof is ever
 * substituted. An approved library recipe is knowledge offered before authorship; citing one selects its roof
 * system (the covering), never the roof's kind, pitch or overhang.
 */
export async function runRoofCompositionStage(ctx: RoofCompositionStageContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RoofCompositionStageResult> {
  const result = await runStage({
    stageName: "roof-composition",
    system: SYSTEM,
    buildMessage: (previousErrors) => [
      `Architectural intent: mood ${ctx.intent.mood.join(", ")}; environmental goals ${ctx.intent.environmentalGoals.join(", ")}.`,
      `Site: environment=${ctx.siteStrategy.environment}, terrain=${ctx.siteStrategy.terrain}, view faces ${ctx.siteStrategy.viewDirection}.`,
      `Masses (${ctx.masses.length}):\n${ctx.masses.map(describeMass).join("\n")}`,
      ctx.approvedRecipes?.length ? `Approved Roof Recipes — proven options you may draw on. If you adopt one, author its kind, pitch and overhang yourself in "roofs" and cite it with libraryRecipeId (at most one): that only selects its roof system (covering). A recipe never changes what you author.\n${ctx.approvedRecipes.map((r) => `- ${r.id}: ${r.name}; ${r.parameters.map((p) => `${p.key}=${p.value}`).join(", ")}; ${r.guidance.join(" ")}`).join("\n")}` : "",
      previousErrors.length ? `Your previous attempt was rejected — repair exactly these and return every roof again:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: roofCompositionStageOutputSchema,
    timings, remainingBudgetMs, usageMeta,
    // A language header plus one complete recipe (family, overhang, pitch, optional orientation/parapet/expression) per mass.
    maxOutputTokens: 250 + ctx.masses.length * 90,
    validate: (value) => {
      const authority = roofAuthorityErrors(value, ctx.masses);
      return authority.length ? authority : roofLanguageErrors(value, ctx.masses);
    },
  });
  /** The cited approved recipe, when its roof system can actually cover the dominant roof as authored. */
  const cited = (value: RoofCompositionStageOutput, roofs: readonly RoofRecipe[]): DesignRecipe | undefined => {
    const recipe = ctx.approvedRecipes?.find((r) => r.id === value.libraryRecipeId);
    if (!recipe || roofRecipeCompatibility(recipe, ctx.masses)) return undefined;
    const system = getRoofSystem(roofRecipeSystem(recipe) ?? "");
    const dominant = roofs.find((roof) => roof.massId === value.language?.dominantMassId) ?? roofs[0];
    return system?.supports(roofShapeOf(dominant)) ? recipe : undefined;
  };
  const accepted = (value: RoofCompositionStageOutput, warnings: string[]): RoofCompositionStageResult => {
    const roofs = recipesFromAuthoredRoofs(value, ctx.masses);
    const libraryRecipe = cited(value, roofs);
    const normalizations = value.roofs.flatMap((r) => (r.orientation !== undefined && normalizeRoofOrientation(r.orientation) !== r.orientation ? [`${r.massId}: roof orientation wrapped to ${normalizeRoofOrientation(r.orientation)} rad.`] : []));
    return { ok: true, value: roofs, attempts: result.attempts, durationMs: result.durationMs,
      ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}),
      ...(value.language ? { language: value.language } : {}), ...(warnings.length ? { warnings } : {}), ...(libraryRecipe ? { libraryRecipe } : {}), ...(normalizations.length ? { normalizations } : {}) };
  };
  if (result.ok) return accepted(result.value, []);
  // Only language issues left unrepaired: the authored roofs are complete and buildable, so they stand.
  const last = result.rawValueTruncated ? undefined : roofCompositionStageOutputSchema.safeParse(result.rawValue);
  if (last?.success && roofAuthorityErrors(last.data, ctx.masses).length === 0) return accepted(last.data, roofLanguageErrors(last.data, ctx.masses));
  return result;
}
