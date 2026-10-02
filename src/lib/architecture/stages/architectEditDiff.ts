import type { ArchitecturalDesignDocument, MassOpening, MassVolume, RoofRecipe } from "../document";

export interface ArchitecturalEditDiffEntry {
  path: string;
  change: "added" | "removed" | "changed";
  unrelated: boolean;
}

export interface ArchitecturalEditScope {
  /** Existing or structurally-associated masses the request is allowed to affect. */
  massIds: ReadonlySet<string>;
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
};

export const architecturalDocumentFingerprintInput = stable;

const words = (value: string) => value.toLowerCase().replace(/[-_]+/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const phrase = (text: string, value: string) => new RegExp(`(^|\\s)${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`).test(text);

/**
 * The document's durable ownership boundary is a MassVolume id. Roofs name their owner with `massId`; a
 * subordinate mass names it with `parentId` (or, for entry/connector pieces, a relationship target). The request
 * only chooses among those existing identities; it never invents architecture or decides a redesign is required.
 */
export function architecturalEditScope(document: ArchitecturalDesignDocument, request: string, candidate?: ArchitecturalDesignDocument): ArchitecturalEditScope {
  const text = words(request);
  const masses = document.massing.masses;
  const ids = new Set<string>();
  const add = (mass: MassVolume) => ids.add(mass.id);
  for (const mass of masses) {
    const role = words(mass.role);
    if (phrase(text, words(mass.id)) || phrase(text, role) || phrase(text, words(mass.name))) add(mass);
  }

  const main = masses.find((mass) => mass.role === "main-living");
  const asksForEntry = /\b(entrance|entry|front door|arrival)\b/.test(text);
  const asksForMain = /\b(main|primary|principal)\b/.test(text);
  const asksForRoof = /\broof\b/.test(text);
  if (main && ((asksForEntry && !/\b(bedroom|garage|guest|service)\b/.test(text)) || (asksForMain && /\b(roof|entrance|entry|door|facade)\b/.test(text)) || (asksForRoof && ids.size === 0))) add(main);

  // A named entry/connector can be an intentionally separate but directly-owned piece of the selected mass.
  // Do not pull in ordinary adjacent wings: their relationship is contextual, not ownership.
  const ownershipMasses = candidate
    ? [...masses, ...candidate.massing.masses.filter((mass) => !masses.some((current) => current.id === mass.id))]
    : masses;
  let changed = true;
  while (changed) {
    changed = false;
    for (const mass of ownershipMasses) {
      const related = mass.parentId !== undefined && ids.has(mass.parentId)
        || ((mass.role === "entry" || mass.role === "connector") && (mass.relationships ?? []).some((relationship) => ids.has(relationship.target)));
      if (related && !ids.has(mass.id)) { ids.add(mass.id); changed = true; }
    }
  }
  return { massIds: ids };
}

function label(mass: MassVolume, all: readonly MassVolume[]): string {
  return new Set(all.filter((candidate) => candidate.role === mass.role).map((candidate) => candidate.id)).size === 1 ? mass.role : mass.id;
}

const openingKinds: ReadonlyArray<[MassOpening["type"], string]> = [
  ["door", "doors"],
  ["glazing-zone", "glazing-zones"],
  ["opening-rhythm", "opening-rhythms"],
];

function openingDiff(entries: ArchitecturalEditDiffEntry[], before: MassVolume, after: MassVolume, massLabel: string, unrelated: boolean) {
  for (const facade of ["north", "south", "east", "west"] as const) for (const [kind, plural] of openingKinds) {
    const oldOpenings = (before.openings ?? []).filter((opening) => opening.facade === facade && opening.type === kind);
    const newOpenings = (after.openings ?? []).filter((opening) => opening.facade === facade && opening.type === kind);
    if (stable(oldOpenings) !== stable(newOpenings)) entries.push({ path: `${massLabel}.facade.${facade}.${plural}`, change: "changed", unrelated });
  }
}

function recipeEntries(entries: ArchitecturalEditDiffEntry[], before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument, scoped: ReadonlySet<string>) {
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
    entries.push({ path: `${massLabel}.roof${oldRecipe && newRecipe ? "" : `.${id}`}`, change: !oldRecipe ? "added" : !newRecipe ? "removed" : "changed", unrelated: !scoped.has(recipe.massId) });
  }
}

/** Field-level ownership diff for an Architect edit. It is both the preservation enforcement input and debug evidence. */
export function architecturalEditDiff(before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument, scope: ArchitecturalEditScope): ArchitecturalEditDiffEntry[] {
  const entries: ArchitecturalEditDiffEntry[] = [];
  const oldMasses = new Map(before.massing.masses.map((mass) => [mass.id, mass]));
  const newMasses = new Map(after.massing.masses.map((mass) => [mass.id, mass]));
  const allMasses = [...before.massing.masses, ...after.massing.masses];
  for (const id of new Set([...oldMasses.keys(), ...newMasses.keys()])) {
    const oldMass = oldMasses.get(id), newMass = newMasses.get(id);
    const mass = newMass ?? oldMass!;
    const massLabel = label(mass, allMasses);
    const unrelated = !scope.massIds.has(id);
    if (!oldMass || !newMass) {
      entries.push({ path: `${massLabel}.mass`, change: oldMass ? "removed" : "added", unrelated });
      continue;
    }
    for (const key of new Set([...Object.keys(oldMass), ...Object.keys(newMass)])) {
      if (key === "openings") continue;
      if (stable((oldMass as unknown as Record<string, unknown>)[key]) !== stable((newMass as unknown as Record<string, unknown>)[key])) {
        entries.push({ path: `${massLabel}.${key}`, change: "changed", unrelated });
      }
    }
    openingDiff(entries, oldMass, newMass, massLabel, unrelated);
  }
  recipeEntries(entries, before, after, scope.massIds);
  for (const key of ["version", "brief", "facade", "architecturalStyle", "outdoorPlan", "materialStrategy", "components", "furnishings", "capabilities"] as const) {
    if (stable(before[key]) !== stable(after[key])) entries.push({ path: `document.${key}`, change: "changed", unrelated: true });
  }
  if (before.massing.composition !== after.massing.composition) entries.push({ path: "massing.composition", change: "changed", unrelated: true });
  return entries;
}

export function describeArchitecturalEditDiff(entries: readonly ArchitecturalEditDiffEntry[]): string[] {
  return entries.map((entry) => `${entry.path}: ${entry.change}${entry.unrelated ? " [UNRELATED]" : ""}`);
}
