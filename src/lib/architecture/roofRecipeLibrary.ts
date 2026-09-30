import type { DesignRecipe, RecipeParameter } from "@/types/library";
import type { MassVolume, RoofRecipeKind, RoofSystemChoice } from "./document";
import { getRoofSystem } from "./roofSystems";

const KINDS = new Set<RoofRecipeKind>(["flat", "floating-flat", "shed", "mono-pitch", "gable", "hip", "butterfly", "pavilion", "cross-gable", "mixed"]);
const pitchedValleyForms = new Set<RoofRecipeKind>(["gable", "hip", "pavilion", "cross-gable"]);
const key = (p: RecipeParameter) => p.key.replace(/[_.-]/g, "").toLowerCase();
const value = (recipe: DesignRecipe, names: readonly string[]) => recipe.parameters.find((p) => names.includes(key(p)))?.value;

/** A roof recipe is declarative V2 guidance only; it can never carry geometry or a GLB. */
export function roofRecipeSystem(recipe: DesignRecipe): string | undefined {
  const candidate = value(recipe, ["system", "roofsystem"]);
  return typeof candidate === "string" && getRoofSystem(candidate) ? candidate : undefined;
}

function recipeKind(recipe: DesignRecipe): RoofRecipeKind | undefined {
  const candidate = value(recipe, ["kind", "roofkind", "shape", "roofform"]);
  return typeof candidate === "string" && KINDS.has(candidate as RoofRecipeKind) ? candidate as RoofRecipeKind : undefined;
}

function complexPlan(mass: MassVolume): boolean {
  return mass.plan?.form === "l-shape" || (mass.operations ?? []).some((op) => op.type === "notch" || op.type === "recess" || op.type === "projection" || op.type === "entry-recess");
}

/** Valley-dependent pitched recipes cannot claim a notched/L mass until V2 has valley geometry. */
export function roofRecipeCompatibility(recipe: DesignRecipe, masses: readonly MassVolume[]): string | undefined {
  const kind = recipeKind(recipe);
  if (kind && pitchedValleyForms.has(kind) && masses.some(complexPlan)) return `${kind} recipes cannot be applied to L-shaped or notched masses until V2 valley geometry exists.`;
  return roofRecipeSystem(recipe) ? undefined : "Recipe does not select a registered Roof System.";
}

/**
 * Durable evidence that the architect cited an approved recipe. It carries the recipe's roof system (the
 * covering the compiler finishes the authored roofs in) and its parameters as a record — those parameters are
 * never written onto the roofs: kind, pitch and overhang are whatever Roof Composition authored.
 */
export function appliedRoofRecipe(recipe: DesignRecipe): { system: RoofSystemChoice; libraryRecipe: { id: string; name: string; system: string; parameters: Record<string, number | string | boolean>; status: "applied" } } | undefined {
  const system = roofRecipeSystem(recipe);
  if (!system) return undefined;
  return { system: { primary: system }, libraryRecipe: { id: recipe.id, name: recipe.name, system, parameters: Object.fromEntries(recipe.parameters.map((p) => [p.key, p.value])), status: "applied" } };
}
