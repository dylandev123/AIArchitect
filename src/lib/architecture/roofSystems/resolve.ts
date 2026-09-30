import { paintOf, shade } from "@/lib/house/architecture/parts";
import { resolveMaterial } from "@/lib/house/materials";
import type { MaterialAssignment, MaterialType } from "@/types/house";
import type { RoofComposition, RoofRecipe, RoofRecipeKind } from "../document";
import { getRoofSystem, listRoofSystems } from "./registry";
import "./systems";
import type { RoofFinish, RoofShape, RoofSystem } from "./types";

/** Pitch (degrees) a recipe that names none is built at — the roof stage's own per-family defaults. */
export const DEFAULT_ROOF_PITCH_DEG: Record<RoofRecipeKind, number> = {
  flat: 2, "floating-flat": 2, mixed: 2, shed: 12, "mono-pitch": 12, gable: 22, "cross-gable": 22, hip: 24, pavilion: 24, butterfly: 8,
};
const FLAT_KINDS = new Set<RoofRecipeKind>(["flat", "floating-flat", "mixed"]);

export function roofShapeOf(recipe: Pick<RoofRecipe, "kind" | "pitch">): RoofShape {
  return FLAT_KINDS.has(recipe.kind) ? { form: "flat", pitchDeg: 0 } : { form: "pitched", pitchDeg: recipe.pitch ?? DEFAULT_ROOF_PITCH_DEG[recipe.kind] };
}

/** The system a roof-zone material is the covering of; a material no system claims is a membrane deck's. */
export function roofSystemForMaterial(material: MaterialType): RoofSystem {
  return listRoofSystems().find((s) => s.materials.includes(material)) ?? getRoofSystem("flat-parapet")!;
}

/** The system that stands in when another can't cover `shape`: the form's designated stand-in, else the first that can. */
function standInFor(shape: RoofShape, not: RoofSystem): RoofSystem {
  const able = listRoofSystems().filter((s) => s !== not && s.supports(shape));
  return able.find((s) => s.fallbackFor === shape.form) ?? able[0] ?? not;
}

/**
 * The Roof System owns the roof's finish: the roof zone's assignment when that material belongs to the system,
 * otherwise the system's own default — a membrane deck on a tiled house is not tile-coloured.
 */
export function resolveRoofFinish(system: RoofSystem, roof: MaterialAssignment): RoofFinish {
  const assignment = system.materials.includes(roof.material) ? roof : system.defaultFinish;
  const paint = paintOf(resolveMaterial(assignment));
  return { material: assignment.material, paint, flashing: { color: shade(paint.color, 0.6), roughness: 0.42, metalness: 0.7 } };
}

export interface RoofSystemAssignment { recipeId: string; massId: string; system: string; role: "primary" | "counterpoint"; reason?: string }
export interface RoofSystemPlan { primary: string; counterpoint?: string; roofs: RoofSystemAssignment[]; warnings: string[] }

/**
 * One primary Roof System per house, plus at most one counterpoint. Deterministic, no model involved:
 *
 * - The primary is the document's own choice (`roofs.system.primary`) or, by default, the system the roof
 *   zone's material is the covering of — unless that system can't cover the dominant roof's form (tile on a
 *   flat deck), in which case the form's stand-in leads instead.
 * - An authored counterpoint applies to the masses it names.
 * - Any roof the primary still can't cover goes to ONE counterpoint system able to cover all of them: the
 *   roof material's own system if it can (pitched wings of a flat-roofed house in a tile finish are tiled),
 *   else each form's natural stand-in. Standing seam covers every form, so there always is one.
 */
export function planRoofSystems(composition: RoofComposition, dominantMassId: string | undefined, roofMaterial: MaterialType): RoofSystemPlan {
  const warnings: string[] = [];
  const recipes = composition.recipes;
  const authored = composition.system;
  const preferred = roofSystemForMaterial(roofMaterial);
  const dominant = recipes.find((r) => r.massId === dominantMassId) ?? recipes[0];

  let primary = authored ? getRoofSystem(authored.primary) : undefined;
  if (authored && !primary) warnings.push(`Unknown roof system "${authored.primary}" — using the roof material's own system.`);
  if (!primary) primary = !dominant || preferred.supports(roofShapeOf(dominant)) ? preferred : standInFor(roofShapeOf(dominant), preferred);

  let counterpoint = authored?.counterpoint ? getRoofSystem(authored.counterpoint.system) : undefined;
  if (authored?.counterpoint && !counterpoint) warnings.push(`Unknown counterpoint roof system "${authored.counterpoint.system}" — ignored.`);
  if (counterpoint === primary) counterpoint = undefined;
  const authoredMassIds = new Set(counterpoint ? authored!.counterpoint!.massIds : []);

  const describe = (r: RoofRecipe) => `${r.kind} roof${roofShapeOf(r).form === "pitched" ? ` at ${roofShapeOf(r).pitchDeg}°` : ""}`;
  const chosen = new Map<RoofRecipe, RoofSystemAssignment>();
  const assign = (r: RoofRecipe, system: RoofSystem, reason?: string) => chosen.set(r, { recipeId: r.id, massId: r.massId, system: system.id, role: system === primary ? "primary" : "counterpoint", ...(reason ? { reason } : {}) });
  const uncovered: RoofRecipe[] = [];
  for (const recipe of recipes) {
    const shape = roofShapeOf(recipe);
    if (counterpoint && authoredMassIds.has(recipe.massId)) {
      if (counterpoint.supports(shape)) { assign(recipe, counterpoint, authored!.counterpoint!.reason); continue; }
      warnings.push(`Counterpoint ${counterpoint.label} cannot cover "${recipe.massId}"'s ${describe(recipe)}.`);
    }
    if (primary.supports(shape)) assign(recipe, primary);
    else uncovered.push(recipe);
  }

  if (uncovered.length) {
    const coversAll = (s: RoofSystem) => uncovered.every((r) => s.supports(roofShapeOf(r)));
    const naturalFor = (s: RoofSystem) => uncovered.filter((r) => standInFor(roofShapeOf(r), primary!) === s).length;
    const shared = counterpoint && coversAll(counterpoint) ? counterpoint
      : counterpoint ? undefined
      : preferred !== primary && coversAll(preferred) ? preferred
      : listRoofSystems().filter((s) => s !== primary && coversAll(s)).sort((a, b) => naturalFor(b) - naturalFor(a))[0];
    for (const recipe of uncovered) {
      const system = shared ?? (counterpoint?.supports(roofShapeOf(recipe)) ? counterpoint : standInFor(roofShapeOf(recipe), primary));
      if (system !== (shared ?? counterpoint)) warnings.push(`"${recipe.massId}"'s ${describe(recipe)} needs a third roof system (${system.label}) — neither ${primary.label} nor the counterpoint can cover it.`);
      assign(recipe, system, `${primary.label} cannot cover a ${describe(recipe)}`);
    }
    counterpoint ??= shared;
  }
  const roofs = recipes.map((r) => chosen.get(r)!);
  const used = roofs.find((r) => r.system === counterpoint?.id) ?? roofs.find((r) => r.role === "counterpoint");
  return { primary: primary.id, ...(used ? { counterpoint: used.system } : {}), roofs, warnings };
}
