import { z } from "zod";
import type { ArchitecturalAssembly, ArchitecturalAssemblyPart, ArchitecturalDesignDocument, FootprintScope, MassFacade, MassGeometryOperation, MassOpening, MassVolume, RoofRecipe } from "../document";

export interface ArchitecturalEditDiffEntry {
  path: string;
  change: "added" | "removed" | "changed";
  unrelated: boolean;
}

/**
 * The primitive families of a mass an edit may declare. They are the whole authorization vocabulary for
 * architecture: no feature names. `geometry` is the spatial footprint (position/size/rotation/elevation) and still
 * also requires a reflow entry; `form` is every other non-identity mass field (floors, height, form, plan, ...).
 */
export const EDIT_SCOPE_FIELDS = ["openings", "operations", "assemblies", "roof", "geometry", "form"] as const;
export type ArchitecturalEditField = (typeof EDIT_SCOPE_FIELDS)[number];
const OPENING_TYPES = ["door", "glazing-zone", "opening-rhythm"] as const;
const MASS_FACADES = ["north", "south", "east", "west"] as const satisfies readonly MassFacade[];

/**
 * The Architect's declaration of what its edit touches, authored alongside the edited document. It is the only
 * source of edit permission: deterministic code never reads the owner's wording to decide what may change. It
 * verifies that the before/after diff stays inside this declaration and that every declared target was used.
 *
 * `element` uses the same identities as the reflow graph: `mass:<id>` (architecture domain) or `site:<id>`
 * (Site Plan domain, e.g. `site:pool`, `site:driveway`, `site:landscape:<purpose>:<index>`, `site:feature:<id>`).
 */
export const editScopeTargetSchema = z.object({
  element: z.string().regex(/^(mass|site):.+$/, "element must be `mass:<id>` or `site:<element-id>`"),
  action: z.enum(["modify", "add", "remove"]),
  /** Required for a modified mass: the primitive families that change. Ignored for site elements and add/remove. */
  fields: z.array(z.enum(EDIT_SCOPE_FIELDS)).min(1).max(EDIT_SCOPE_FIELDS.length).optional(),
  /** The mass-local facade the openings/operations/assemblies are on. Omitted = any facade of that mass. */
  facade: z.enum(MASS_FACADES).optional(),
  /** The storey band the openings/operations/assemblies are on. Omitted = any level. */
  level: z.enum(["ground", "upper"]).optional(),
  /** Narrows `openings` to these opening kinds. Omitted = every kind on the declared facade/level. */
  openingTypes: z.array(z.enum(OPENING_TYPES)).min(1).optional(),
}).strict();
export const editScopeSchema = z.object({
  /** One sentence describing the intended change, recorded as evidence; it grants nothing. */
  intent: z.string().min(3).max(400),
  /**
   * Empty only when the unchanged document is an explicit inability-to-express response. The envelope (and
   * therefore its audit record) is still mandatory; any actual edit must have the targets its diff consumes.
   */
  targets: z.array(editScopeTargetSchema).max(8),
}).strict();
export type ArchitecturalEditScope = z.infer<typeof editScopeSchema>;
export type ArchitecturalEditTarget = z.infer<typeof editScopeTargetSchema>;

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
};

export const architecturalDocumentFingerprintInput = stable;

const SPATIAL_KEYS: ReadonlySet<string> = new Set(["position", "width", "depth", "rotation", "elevation"]);
const IDENTITY_KEYS: ReadonlySet<string> = new Set(["id"]);
const fieldForKey = (key: string): ArchitecturalEditField | undefined =>
  IDENTITY_KEYS.has(key) ? undefined
    : key === "openings" || key === "operations" || key === "assemblies" ? key
    : SPATIAL_KEYS.has(key) ? "geometry" : "form";

const massId = (element: string) => (element.startsWith("mass:") ? element.slice(5) : undefined);
export const scopeMassIds = (scope: ArchitecturalEditScope | undefined, actions: readonly ArchitecturalEditTarget["action"][] = ["modify", "add"]): Set<string> =>
  new Set((scope?.targets ?? []).filter((target) => actions.includes(target.action)).map((target) => massId(target.element)).filter((id): id is string => Boolean(id)));
export const scopeSiteTargets = (scope: ArchitecturalEditScope | undefined) => (scope?.targets ?? []).filter((target) => target.element.startsWith("site:"));

/** Which declared target (by index) and field authorized each accepted change; used to detect over-declaration. */
type Usage = Set<string>;
const recordUse = (usage: Usage | undefined, index: number, field: string) => usage?.add(`${index}:${field}`);

const levelOf = (floors: FootprintScope | undefined): FootprintScope => floors ?? "all";
/** A level-restricted target admits only primitives explicitly on that level; an all-floors primitive needs an unrestricted target. */
const levelAdmits = (target: ArchitecturalEditTarget, level: FootprintScope) => !target.level || target.level === level;
const facadeAdmits = (target: ArchitecturalEditTarget, facade: MassFacade | undefined) => !target.facade || target.facade === facade;

function label(mass: MassVolume, all: readonly MassVolume[]): string {
  return new Set(all.filter((candidate) => candidate.role === mass.role).map((candidate) => candidate.id)).size === 1 ? mass.role : mass.id;
}

const openingKinds: ReadonlyArray<[MassOpening["type"], string]> = [
  ["door", "doors"],
  ["glazing-zone", "glazing-zones"],
  ["opening-rhythm", "opening-rhythms"],
];

function openingDiff(entries: ArchitecturalEditDiffEntry[], before: MassVolume, after: MassVolume, massLabel: string, scope: ArchitecturalEditScope | undefined, usage?: Usage) {
  const targets = (scope?.targets ?? []).map((target, index) => ({ target, index })).filter(({ target }) => target.action === "modify" && massId(target.element) === before.id && target.fields?.includes("openings"));
  for (const facade of MASS_FACADES) for (const [kind, plural] of openingKinds) for (const level of ["ground", "upper", "all"] as const) {
    const bucket = (mass: MassVolume) => (mass.openings ?? []).filter((opening) => opening.facade === facade && opening.type === kind && levelOf(opening.floors) === level);
    if (stable(bucket(before)) === stable(bucket(after))) continue;
    const owner = targets.find(({ target }) => facadeAdmits(target, facade) && levelAdmits(target, level) && (!target.openingTypes || target.openingTypes.includes(kind)));
    if (owner) recordUse(usage, owner.index, "openings");
    entries.push({ path: `${massLabel}.facade.${facade}.${plural}${level === "all" ? "" : `.${level}`}`, change: "changed", unrelated: !owner });
  }
}

/** The facade and level a primitive sits on; corner operations have no facade and only pass an unrestricted target. */
const operationFacade = (operation: MassGeometryOperation): MassFacade | undefined => ("facade" in operation ? operation.facade : undefined);

function assemblyPlacement(assembly: ArchitecturalAssembly): { facades: Set<MassFacade | undefined>; levels: Set<FootprintScope | undefined> } {
  const parts = new Map(assembly.parts.map((part) => [part.id, part]));
  const partFacade = (part: ArchitecturalAssemblyPart): MassFacade | undefined => part.type === "railing" ? (parts.get(part.slabId) as Extract<ArchitecturalAssemblyPart, { type: "slab" }> | undefined)?.facade : part.facade;
  const resolvedLevel = (part: ArchitecturalAssemblyPart, seen = new Set<string>()): number | undefined => {
    if (seen.has(part.id)) return undefined;
    seen.add(part.id);
    if (part.type === "railing") return parts.has(part.slabId) ? resolvedLevel(parts.get(part.slabId)!, seen) : undefined;
    const host = part.host;
    if (host?.kind === "roof") return Number.POSITIVE_INFINITY;
    if (host?.kind === "floor" || host?.kind === "facade") return host.level;
    if (host?.kind === "entrance" || host?.kind === "terrace") return host.level ?? 0;
    if (host?.kind === "slab") return parts.has(host.slabId) ? resolvedLevel(parts.get(host.slabId)!, seen) : undefined;
    return part.level ?? 0;
  };
  const toScope = (level: number | undefined): FootprintScope | undefined => level === undefined ? undefined : level === 0 ? "ground" : "upper";
  return { facades: new Set(assembly.parts.map(partFacade)), levels: new Set(assembly.parts.map((part) => toScope(resolvedLevel(part)))) };
}

/**
 * A primitive list (operations/assemblies) may change only inside the union of its declared facade/level envelopes:
 * everything outside every envelope must be value-for-value identical. Returns the authorizing target indexes.
 */
function scopedList<T>(before: readonly T[], after: readonly T[], targets: readonly { target: ArchitecturalEditTarget; index: number }[], inside: (item: T, target: ArchitecturalEditTarget) => boolean): number[] | undefined {
  if (!targets.length) return undefined;
  const outside = (items: readonly T[]) => items.filter((item) => !targets.some(({ target }) => inside(item, target)));
  if (stable(outside(before)) !== stable(outside(after))) return undefined;
  const changed = [...before.filter((item) => !after.some((other) => stable(other) === stable(item))), ...after.filter((item) => !before.some((other) => stable(other) === stable(item)))];
  return targets.filter(({ target }) => changed.some((item) => inside(item, target))).map(({ index }) => index);
}

const operationInside = (operation: MassGeometryOperation, target: ArchitecturalEditTarget) =>
  facadeAdmits(target, operationFacade(operation)) && levelAdmits(target, levelOf(operation.floors));
const assemblyInside = (assembly: ArchitecturalAssembly, target: ArchitecturalEditTarget) => {
  const { facades, levels } = assemblyPlacement(assembly);
  return assembly.parts.length > 0 && [...facades].every((facade) => facadeAdmits(target, facade)) && [...levels].every((level) => level !== undefined && levelAdmits(target, level));
};

function recipeEntries(entries: ArchitecturalEditDiffEntry[], before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument, scope: ArchitecturalEditScope | undefined, usage?: Usage) {
  const oldRecipes = new Map(before.roofs.recipes.map((recipe) => [recipe.id, recipe]));
  const newRecipes = new Map(after.roofs.recipes.map((recipe) => [recipe.id, recipe]));
  const allMasses = [...before.massing.masses, ...after.massing.masses];
  const massFor = (recipe: RoofRecipe) => allMasses.find((mass) => mass.id === recipe.massId);
  for (const id of new Set([...oldRecipes.keys(), ...newRecipes.keys()])) {
    const oldRecipe = oldRecipes.get(id), newRecipe = newRecipes.get(id);
    if (oldRecipe && newRecipe && stable(oldRecipe) === stable(newRecipe)) continue;
    const recipe = newRecipe ?? oldRecipe!;
    const mass = massFor(recipe);
    const massLabel = mass ? label(mass, allMasses) : recipe.massId;
    // A roof follows its mass: a declared added/removed mass carries its own roof; otherwise `roof` must be declared.
    const owner = (scope?.targets ?? []).findIndex((target) => massId(target.element) === recipe.massId && (target.action !== "modify" || target.fields?.includes("roof")));
    if (owner >= 0) recordUse(usage, owner, "roof");
    entries.push({ path: `${massLabel}.roof${oldRecipe && newRecipe ? "" : `.${id}`}`, change: !oldRecipe ? "added" : !newRecipe ? "removed" : "changed", unrelated: owner < 0 });
  }
}

/**
 * Field-level ownership diff for an Architect edit against the Architect's declared scope. Every change outside the
 * declaration is `unrelated`. `reflowMassIds` are the masses in the auditable reflow graph: a spatial change also
 * needs that entry, whose locality and dependency chain `spatialReflowErrors` verifies separately.
 */
export function architecturalEditDiff(before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument, scope: ArchitecturalEditScope | undefined, reflowMassIds: ReadonlySet<string> = new Set(), usage?: Usage): ArchitecturalEditDiffEntry[] {
  const entries: ArchitecturalEditDiffEntry[] = [];
  const oldMasses = new Map(before.massing.masses.map((mass) => [mass.id, mass]));
  const newMasses = new Map(after.massing.masses.map((mass) => [mass.id, mass]));
  const allMasses = [...before.massing.masses, ...after.massing.masses];
  const indexed = (scope?.targets ?? []).map((target, index) => ({ target, index }));
  for (const id of new Set([...oldMasses.keys(), ...newMasses.keys()])) {
    const oldMass = oldMasses.get(id), newMass = newMasses.get(id);
    const mass = newMass ?? oldMass!;
    const massLabel = label(mass, allMasses);
    if (!oldMass || !newMass) {
      const owner = indexed.find(({ target }) => massId(target.element) === id && target.action === (oldMass ? "remove" : "add"));
      if (owner) recordUse(usage, owner.index, "mass");
      entries.push({ path: `${massLabel}.mass`, change: oldMass ? "removed" : "added", unrelated: !owner });
      continue;
    }
    const modify = indexed.filter(({ target }) => target.action === "modify" && massId(target.element) === id);
    const withField = (field: ArchitecturalEditField) => modify.filter(({ target }) => target.fields?.includes(field));
    for (const key of new Set([...Object.keys(oldMass), ...Object.keys(newMass)])) {
      if (key === "openings") continue;
      if (stable((oldMass as unknown as Record<string, unknown>)[key]) === stable((newMass as unknown as Record<string, unknown>)[key])) continue;
      const field = fieldForKey(key);
      let owners: number[] | undefined;
      if (field === "operations") owners = scopedList(oldMass.operations ?? [], newMass.operations ?? [], withField("operations"), operationInside);
      else if (field === "assemblies") owners = scopedList(oldMass.assemblies ?? [], newMass.assemblies ?? [], withField("assemblies"), assemblyInside);
      else if (field === "geometry") owners = reflowMassIds.has(id) ? (withField("geometry").length ? withField("geometry").map(({ index }) => index) : []) : undefined;
      else if (field) owners = withField(field).length ? withField(field).map(({ index }) => index) : undefined;
      owners?.forEach((index) => recordUse(usage, index, field!));
      entries.push({ path: `${massLabel}.${key}`, change: "changed", unrelated: !owners });
    }
    openingDiff(entries, oldMass, newMass, massLabel, scope, usage);
  }
  recipeEntries(entries, before, after, scope, usage);
  // Document-level design records and the site strategy are never inside an edit scope.
  for (const key of ["version", "brief", "facade", "architecturalStyle", "outdoorPlan", "materialStrategy", "components", "furnishings", "capabilities"] as const) {
    if (stable(before[key]) !== stable(after[key])) entries.push({ path: `document.${key}`, change: "changed", unrelated: true });
  }
  if (before.massing.composition !== after.massing.composition) entries.push({ path: "massing.composition", change: "changed", unrelated: true });
  return entries;
}

/**
 * Objective checks of the declaration itself against the current and edited documents: it must name real elements,
 * attach any new mass to a declared target, and be fully used — a declared target/field that did not change is an
 * over-broad declaration, not harmless slack. Site-domain targets are checked by `spatialReflowErrors`.
 */
export function editScopeDeclarationErrors(before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument, scope: ArchitecturalEditScope | undefined, reflowMassIds: ReadonlySet<string> = new Set()): string[] {
  if (!scope) return ["Declare the edit scope: return `scope:{intent,targets:[{element,action,fields,facade?,level?,openingTypes?}]}` naming exactly the masses/site elements, facades, levels and primitive fields your edit changes."];
  const parsed = editScopeSchema.safeParse(scope);
  if (!parsed.success) return parsed.error.issues.map((issue) => `scope.${issue.path.join(".")}: ${issue.message}`);
  const errors: string[] = [];
  const had = new Set(before.massing.masses.map((mass) => mass.id)), has = new Set(after.massing.masses.map((mass) => mass.id));
  scope.targets.forEach((target, index) => {
    const id = massId(target.element);
    if (id === undefined) return;
    const where = `scope.targets.${index} (${target.element})`;
    if (target.action === "modify" && !had.has(id)) errors.push(`${where}: no such existing mass to modify.`);
    if (target.action === "modify" && !target.fields?.length) errors.push(`${where}: a modified mass must declare the primitive fields it changes.`);
    if (target.action === "remove" && (!had.has(id) || has.has(id))) errors.push(`${where}: removal must name an existing mass that the edited document no longer contains.`);
    if (target.action === "add") {
      const added = after.massing.masses.find((mass) => mass.id === id);
      if (had.has(id) || !added) errors.push(`${where}: an added mass must be new and present in the edited document.`);
      // Locality: a new mass is anchored to existing architecture, never floats free; collisions are the integrity gate's.
      else if (!(added.parentId !== undefined && had.has(added.parentId)) && !(added.relationships ?? []).some((relationship) => had.has(relationship.target))) errors.push(`${where}: a new mass must be attached (parentId or relationship) to an existing mass.`);
    }
  });
  const usage: Usage = new Set();
  architecturalEditDiff(before, after, scope, reflowMassIds, usage);
  scope.targets.forEach((target, index) => {
    if (!target.element.startsWith("mass:")) return;
    const fields = target.action === "modify" ? target.fields ?? [] : ["mass"];
    for (const field of fields) if (!usage.has(`${index}:${field}`)) errors.push(`scope.targets.${index} (${target.element}) declares ${target.action === "modify" ? `"${field}"` : target.action} but the edit changed nothing there; declare only what the edit changes.`);
  });
  return errors;
}

export function describeArchitecturalEditDiff(entries: readonly ArchitecturalEditDiffEntry[]): string[] {
  return entries.map((entry) => `${entry.path}: ${entry.change}${entry.unrelated ? " [UNRELATED]" : ""}`);
}
