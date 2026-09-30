import type { ProjectScale, SiteEnvironment } from "@/types/house";
import type { DesignRecipe, RecipeCategory, ReportRecipe, ReportRecipeRejection } from "@/types/library";
import { pickKnowledgeForSpace } from "./knowledge/catalog";
import { MIN_RECIPE_SCORE, scoreRecipe } from "./retrieval";
import { spaceName, type OutdoorSpace, type OutdoorSpaceKind } from "@/lib/outdoor/spaces";

/**
 * Recipe retrieval for outdoor spaces. A recipe is not looked up for the brief as a whole: each space asks for the approved
 * recipes that describe how to build *it* (its recipe categories, or anything an admin filed under the Knowledge Need that is
 * the space's home), ranked by style, scale and environment. A few brief-level recipes for what no space covers (roofs, facades)
 * ride along. Every pick carries the reason it was chosen, and later whether it was applied.
 */

export interface RetrievalContext {
  brief: string;
  styles: readonly string[];
  scale?: ProjectScale;
  environment?: SiteEnvironment;
}

export interface RetrievedRecipe {
  recipe: DesignRecipe;
  /** The spaces it was retrieved for; empty for a brief-level recipe. */
  spaces: OutdoorSpaceKind[];
  reason: string;
  score: number;
}

export interface RecipeRetrievalResult {
  retrieved: RetrievedRecipe[];
  rejections: ReportRecipeRejection[];
}

const PER_SPACE = 2;
const GENERAL = 2;
/** The generation prompt carries every retrieved recipe: keep the total small. */
export const MAX_RETRIEVED_RECIPES = 6;
/** Filing a recipe under the space's Knowledge Need is a stronger statement than a matching category. */
const FILED_BONUS = 0.2;

/**
 * What an unfiled recipe is about, read from its own words (name, tags, guidance, parameters, relationships). A "specific" hit says
 * the recipe is about that space ("Dining Terrace" → Outdoor Dining); a "generic" one only that it could be ("terrace").
 */
const ABOUT: Record<OutdoorSpaceKind, { specific: RegExp; generic?: RegExp }> = {
  "arrival-court": { specific: /arriv|motor|forecourt|entrance|entry|driveway/i, generic: /court|drive/i },
  "main-outdoor-living": { specific: /outdoor[\s-]living|indoor[\s-]outdoor/i, generic: /terrace|patio|deck|lounge|living/i },
  "outdoor-dining": { specific: /dining|alfresco|al fresco|supper/i, generic: /\btable\b/i },
  "outdoor-kitchen": { specific: /kitchen|grill|bbq|barbecue/i },
  "pool-lounge": { specific: /\bpool|swim/i, generic: /lounge|sun/i },
  "pool-bar": { specific: /pool[\s-]bar|swim[\s-]?up|tiki|outdoor[\s-]bar/i, generic: /\bbar\b/i },
  "fire-pit-lounge": { specific: /fire/i },
  garden: { specific: /garden|planting|landscap/i, generic: /plant|lawn/i },
  "quiet-retreat": { specific: /retreat|reading|meditat|quiet/i },
  "guest-outdoor": { specific: /guest/i },
  service: { specific: /service/i },
  "view-terrace": { specific: /view|overlook|panoram/i, generic: /terrace|belvedere/i },
};

const textOf = (r: DesignRecipe): string =>
  [r.name, ...r.styleTags, ...r.guidance, ...r.parameters.map((p) => p.key), ...r.relationships.map((x) => `${x.target} ${x.note ?? ""}`)].join(" ");

/** Environmental synonyms are deliberately narrow: ocean-facing tropical projects can use beach guidance, but a generic
 * suburban project cannot; hillside guidance still needs explicit terrain evidence. */
function semanticEnvironmentTags(brief: string): SiteEnvironment[] {
  const text = brief.toLowerCase();
  const tags: SiteEnvironment[] = [];
  if (/ocean|coast|coastal|waterfront|beach|island|seaside/.test(text)) tags.push("beach");
  if (/hill|slope|cliff|ridge|mountain/.test(text)) tags.push("hillside");
  return tags;
}

function rejectionReason(recipe: DesignRecipe, query: Parameters<typeof scoreRecipe>[1], spaces: readonly OutdoorSpace[], homes: ReadonlyMap<OutdoorSpaceKind, string | undefined>): string {
  if (recipe.approval !== "approved") return `Not approved (${recipe.approval}).`;
  if (query.scale && recipe.compatibleScales.length > 0 && !recipe.compatibleScales.includes(query.scale)) return `Scale mismatch: recipe supports ${recipe.compatibleScales.join(", ")}, project is ${query.scale}.`;
  if (query.environment && recipe.environmentTags.length > 0 && !recipe.environmentTags.includes(query.environment) && !(query.semanticEnvironmentTags ?? []).some((tag) => recipe.environmentTags.includes(tag))) return `Environment mismatch: recipe is for ${recipe.environmentTags.join("/")}; project is ${query.environment}.`;
  const shared = (query.styleTags ?? []).filter((tag) => recipe.styleTags.includes(tag));
  if ((query.styleTags?.length ?? 0) > 0 && recipe.styleTags.length > 0 && shared.length === 0) return `Style mismatch: recipe is ${recipe.styleTags.join("/")}; project is ${(query.styleTags ?? []).join("/")}.`;
  if (targetsOf(recipe, spaces, homes).length === 0) return "No compatible outdoor space was present for this recipe category or Knowledge filing.";
  return "Compatible, but ranked below the per-space or generation retrieval limit.";
}

/**
 * The spaces a recipe serves. Filed under a Knowledge Need, it serves the spaces that need is the home of (filing says what it is
 * for). Filed nowhere, it serves the spaces of its category that its own words are about — the most specific ones — and, when
 * its words say nothing, only the first space of its category, so a generic recipe never lands on every space at once.
 */
function targetsOf(recipe: DesignRecipe, spaces: readonly OutdoorSpace[], homes: ReadonlyMap<OutdoorSpaceKind, string | undefined>): { space: OutdoorSpace; why: string }[] {
  if ((recipe.knowledgeIds?.length ?? 0) > 0) {
    return spaces.filter((s) => { const home = homes.get(s.kind); return !!home && recipe.knowledgeIds!.includes(home); }).map((space) => ({ space, why: `filed under ${homes.get(space.kind)}` }));
  }
  const candidates = spaces.filter((s) => s.recipeCategories.includes(recipe.category));
  if (candidates.length === 0) return [];
  const text = textOf(recipe);
  const weight = (s: OutdoorSpace) => (ABOUT[s.kind].specific.test(text) ? 2 : 0) + (ABOUT[s.kind].generic?.test(text) ? 1 : 0);
  const best = Math.max(...candidates.map(weight));
  if (best === 0) return [{ space: candidates[0], why: `category ${recipe.category}` }];
  return candidates.filter((s) => weight(s) === best).map((space) => ({ space, why: `category ${recipe.category}, its name and rules are about ${space.name.toLowerCase()}` }));
}

export function retrieveRecipesWithDiagnostics(recipes: readonly DesignRecipe[], spaces: readonly OutdoorSpace[], ctx: RetrievalContext, limit = MAX_RETRIEVED_RECIPES): RecipeRetrievalResult {
  const approved = recipes.filter((r) => r.approval === "approved");
  const query = { styleTags: [...ctx.styles], scale: ctx.scale, environment: ctx.environment, semanticEnvironmentTags: semanticEnvironmentTags(ctx.brief) };
  const homes = new Map(spaces.map((s) => [s.kind, pickKnowledgeForSpace(s.kind, { brief: ctx.brief, styles: ctx.styles, environment: ctx.environment })?.id] as const));
  const homeTitle = (kind: OutdoorSpaceKind) => pickKnowledgeForSpace(kind, { brief: ctx.brief, styles: ctx.styles, environment: ctx.environment })?.title;

  const picked = new Map<string, RetrievedRecipe>();
  const take = (recipe: DesignRecipe, space: OutdoorSpaceKind | undefined, reason: string, score: number) => {
    const seen = picked.get(recipe.id);
    if (!seen) return void picked.set(recipe.id, { recipe, spaces: space ? [space] : [], reason, score });
    if (space && !seen.spaces.includes(space)) seen.spaces.push(space);
    if (score > seen.score) {
      seen.score = score;
      seen.reason = reason;
    }
  };

  // Each space gets its best few of the recipes assigned to it.
  const bySpace = new Map<OutdoorSpaceKind, { recipe: DesignRecipe; score: number; reason: string }[]>();
  const assigned = new Set<string>();
  for (const recipe of approved) {
    const scored = scoreRecipe(recipe, query);
    if (!scored || scored.score < MIN_RECIPE_SCORE) continue;
    for (const { space, why } of targetsOf(recipe, spaces, homes)) {
      assigned.add(recipe.id);
      const filed = (recipe.knowledgeIds?.length ?? 0) > 0;
      const reason = `${spaceName(space.kind)}: ${(filed ? `filed under ${homeTitle(space.kind) ?? "its Knowledge Need"}` : why)}${scored.reasons.length ? `, ${scored.reasons.join(", ")}` : ""}`;
      bySpace.set(space.kind, [...(bySpace.get(space.kind) ?? []), { recipe, score: scored.score + (filed ? FILED_BONUS : 0), reason }]);
    }
  }
  const covered = new Set<RecipeCategory>(spaces.flatMap((s) => s.recipeCategories));
  for (const [kind, found] of bySpace) {
    found.sort((a, b) => b.score - a.score);
    for (const f of found.slice(0, PER_SPACE)) take(f.recipe, kind, f.reason, f.score);
  }

  // What no space covers (roof, facade…): the best few for the brief's style, scale and environment.
  const general = approved
    .filter((r) => !covered.has(r.category) && !picked.has(r.id))
    .map((r) => scoreRecipe(r, query))
    .filter((s): s is NonNullable<typeof s> => s !== null && s.score >= MIN_RECIPE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, GENERAL);
  for (const g of general) take(g.item, undefined, `brief: ${g.reasons.join(", ") || "matches the brief"}`, g.score);

  const retrieved = [...picked.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  const selected = new Set(retrieved.map((entry) => entry.recipe.id));
  const rejections = recipes.filter((recipe) => !selected.has(recipe.id)).map((recipe) => ({ id: recipe.id, name: recipe.name, reason: rejectionReason(recipe, query, spaces, homes) }));
  return { retrieved, rejections };
}

export function retrieveRecipes(recipes: readonly DesignRecipe[], spaces: readonly OutdoorSpace[], ctx: RetrievalContext, limit = MAX_RETRIEVED_RECIPES): RetrievedRecipe[] {
  return retrieveRecipesWithDiagnostics(recipes, spaces, ctx, limit).retrieved;
}

// ── Was it applied? ─────────────────────────────────────────────────────────

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (root: Rec, key: string): Rec[] => (Array.isArray(root[key]) ? (root[key] as unknown[]).filter(isRecord) : []);

/**
 * Whether a recipe's `requires` target exists in the generated project. Targets the check does not know are not judged:
 * `undefined` = "cannot tell", which never counts against a recipe.
 */
function targetPresent(target: string, root: Rec): boolean | undefined {
  const t = target.toLowerCase();
  const kinds = (k: string) => list(root, "buildings").filter((b) => b.kind === k).length;
  if (/pool[-\s]?bar|outdoor[-\s]?bar|\bbar\b/.test(t)) return kinds("outdoor_bar") > 0;
  if (/\bpool\b/.test(t)) return list(root, "pools").length > 0;
  if (/patio|terrace|deck/.test(t)) return list(root, "patios").length + list(root, "decks").length > 0;
  if (/gazebo|pavilion/.test(t)) return kinds("gazebo") > 0;
  if (/driveway|drive\b/.test(t)) return list(root, "driveways").length > 0;
  if (/garage/.test(t)) return list(root, "garages").length + kinds("detached_garage") > 0;
  if (/garden|planting|lawn/.test(t)) return list(root, "landscaping").length > 0;
  if (/house|view/.test(t)) return true;
  return undefined;
}

/** Whether a brief-level recipe's category has anything in the design to act on. */
function categoryPresent(category: RecipeCategory, root: Rec): boolean {
  switch (category) {
    case "pool": return list(root, "pools").length > 0;
    case "planting": return list(root, "landscaping").length > 0;
    case "retaining-wall": return list(root, "retainingWalls").length > 0;
    case "motor-court": case "entry-sequence": return list(root, "driveways").length + list(root, "parking").length > 0;
    case "terrace": case "outdoor-living": return list(root, "patios").length + list(root, "decks").length > 0;
    default: return true; // roof, facade, courtyard: the house itself is what they act on
  }
}

/**
 * Applied means the recipe was in the generation prompt AND the design contains what it describes: a space it was retrieved
 * for stands in the design, and nothing it requires is absent. It says nothing about whether the model followed every rule in
 * the recipe — that is not measurable — only that the recipe had something to act on and its preconditions held.
 */
export function evaluateRecipes(retrieved: readonly RetrievedRecipe[], spaces: readonly OutdoorSpace[], projectJson: string | Rec): ReportRecipe[] {
  let root: Rec = {};
  try {
    const parsed: unknown = typeof projectJson === "string" ? JSON.parse(projectJson) : projectJson;
    if (isRecord(parsed)) root = parsed;
  } catch {
    /* an unreadable project applies nothing */
  }
  const byKind = new Map(spaces.map((s) => [s.kind, s]));
  return retrieved.map(({ recipe, spaces: kinds, reason }) => {
    const realized = kinds.map((k) => byKind.get(k)).filter((s): s is OutdoorSpace => !!s && s.realized);
    const missing = recipe.relationships.filter((r) => r.kind === "requires" && targetPresent(r.target, root) === false).map((r) => r.target);
    const spaceNames = kinds.map(spaceName);
    let applied: boolean;
    let note: string;
    if (kinds.length > 0) {
      applied = realized.length > 0 && missing.length === 0;
      note = realized.length === 0
        ? `${spaceNames.join(", ")} not in the design, so there was nothing for it to shape.`
        : missing.length > 0
          ? `${realized.map((s) => s.name).join(", ")} is in the design, but it requires ${missing.join(", ")}, which is not.`
          : `Given to the generator for ${realized.map((s) => `${s.name} (${s.realizedBy.join(", ")})`).join("; ")}; its required parts are present.`;
    } else {
      applied = categoryPresent(recipe.category, root) && missing.length === 0;
      note = applied ? `Given to the generator as ${recipe.category} guidance; the design has that to act on.` : `The design has nothing for a ${recipe.category} recipe to act on${missing.length ? ` (needs ${missing.join(", ")})` : ""}.`;
    }
    return { id: recipe.id, name: recipe.name, spaces: spaceNames, reason, applied, note };
  });
}
