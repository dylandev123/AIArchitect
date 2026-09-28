import type { SiteEnvironment } from "@/types/house";
import type { AssetCategory, DesignArea, KnowledgeTargets, RecipeCategory } from "@/types/library";

/**
 * The map of design knowledge AI Architect can be missing. Each entry is a parent category that will eventually
 * hold GLB assets, recipes, materials, plant and lighting collections. The catalog is code, not data: a
 * Knowledge Need record is only stored once generation first exposes the gap, so adding an entry here costs nothing
 * and existing records are untouched (their id is the slug).
 */

export interface KnowledgeDefinition {
  id: string;
  title: string;
  /** Design areas whose weakness can point here. */
  areas: DesignArea[];
  /** Style tags (see taxonomy) that make this entry the better home for a weak area. */
  styles?: string[];
  environments?: SiteEnvironment[];
  /** Words in the brief that make this entry apply. */
  keywords?: RegExp;
  /** True for narrow entries that must be matched by style/environment/keyword and are never a generic fallback. */
  requiresMatch?: boolean;
  /** Asset families this knowledge contains. */
  families: AssetCategory[];
  recipeCategories: RecipeCategory[];
  targets: KnowledgeTargets;
}

const T = (t: Partial<KnowledgeTargets>): KnowledgeTargets => ({ assets: 12, recipes: 4, materials: 2, lighting: 2, plants: 0, ...t });

export const KNOWLEDGE_CATALOG: KnowledgeDefinition[] = [
  {
    id: "luxury-outdoor-living",
    title: "Luxury Outdoor Living",
    areas: ["outdoor-living", "furniture"],
    families: ["outdoor-bar", "pergola", "gazebo", "fire-pit", "cabana", "outdoor-kitchen", "hot-tub", "furniture", "light", "vegetation"],
    recipeCategories: ["outdoor-living", "terrace"],
    targets: T({ assets: 18, recipes: 7, materials: 3, lighting: 5, plants: 3 }),
  },
  {
    id: "outdoor-dining",
    title: "Outdoor Dining",
    areas: ["outdoor-living", "furniture"],
    keywords: /\b(?:dining|alfresco|al fresco|supper|banquet)\b/i,
    requiresMatch: true,
    families: ["furniture", "outdoor-kitchen", "pergola", "light"],
    recipeCategories: ["outdoor-living", "terrace"],
    targets: T({ assets: 8, recipes: 3, lighting: 3 }),
  },
  {
    id: "luxury-terrace",
    title: "Luxury Terrace",
    areas: ["views", "outdoor-living"],
    keywords: /\b(?:terrace|veranda|loggia|lanai|balustrade)\b/i,
    families: ["furniture", "pergola", "light", "decorative"],
    recipeCategories: ["terrace"],
    targets: T({ assets: 8, recipes: 4, materials: 3 }),
  },
  {
    id: "luxury-pool-area",
    title: "Luxury Pool Area",
    areas: ["pool"],
    families: ["cabana", "hot-tub", "outdoor-bar", "furniture", "light", "vegetation"],
    recipeCategories: ["pool"],
    targets: T({ assets: 14, recipes: 5, materials: 3, lighting: 4, plants: 3 }),
  },
  {
    id: "modern-pool-area",
    title: "Modern Pool Area",
    areas: ["pool"],
    styles: ["modern", "nordic", "mid-century"],
    families: ["cabana", "hot-tub", "furniture", "light"],
    recipeCategories: ["pool"],
    targets: T({ assets: 10, recipes: 4, materials: 3, lighting: 3 }),
  },
  {
    id: "estate-arrival-court",
    title: "Estate Arrival Court",
    areas: ["arrival"],
    families: ["vehicle", "decorative", "light", "vegetation"],
    recipeCategories: ["entry-sequence", "motor-court"],
    targets: T({ assets: 8, recipes: 5, materials: 3, lighting: 4, plants: 3 }),
  },
  {
    id: "luxury-driveway",
    title: "Luxury Driveway",
    areas: ["driveway"],
    families: ["vehicle", "light", "vegetation", "decorative"],
    recipeCategories: ["motor-court", "entry-sequence"],
    targets: T({ assets: 6, recipes: 4, materials: 4, lighting: 3, plants: 2 }),
  },
  {
    id: "luxury-facade-details",
    title: "Luxury Facade Details",
    areas: ["facade", "architecture"],
    families: ["decorative", "light"],
    recipeCategories: ["facade"],
    targets: T({ assets: 6, recipes: 6, materials: 5, lighting: 3 }),
  },
  {
    id: "mediterranean-roof-collection",
    title: "Mediterranean Roof Collection",
    areas: ["roofing"],
    styles: ["mediterranean"],
    requiresMatch: true,
    families: [],
    recipeCategories: ["roof"],
    targets: T({ assets: 0, recipes: 8, materials: 4, lighting: 0 }),
  },
  {
    id: "luxury-roof-collection",
    title: "Luxury Roof Collection",
    areas: ["roofing"],
    families: [],
    recipeCategories: ["roof"],
    targets: T({ assets: 0, recipes: 8, materials: 4, lighting: 0 }),
  },
  {
    id: "estate-gardens",
    title: "Estate Gardens",
    areas: ["gardens", "landscape"],
    families: ["decorative", "vegetation", "rock", "light"],
    recipeCategories: ["planting", "retaining-wall"],
    targets: T({ assets: 10, recipes: 5, materials: 2, lighting: 3, plants: 8 }),
  },
  {
    id: "tropical-garden",
    title: "Tropical Garden",
    areas: ["gardens", "vegetation", "landscape"],
    styles: ["tropical"],
    environments: ["beach"],
    requiresMatch: true,
    families: ["vegetation", "rock", "decorative", "light"],
    recipeCategories: ["planting"],
    targets: T({ assets: 8, recipes: 4, materials: 1, lighting: 2, plants: 12 }),
  },
  {
    id: "caribbean-landscaping",
    title: "Caribbean Landscaping",
    areas: ["landscape", "gardens", "vegetation"],
    keywords: /\b(?:caribbean|bahamas|west indies|antigua|st\.? lucia)\b/i,
    requiresMatch: true,
    families: ["vegetation", "rock", "decorative"],
    recipeCategories: ["planting", "retaining-wall"],
    targets: T({ assets: 8, recipes: 4, materials: 2, lighting: 2, plants: 12 }),
  },
  {
    id: "japanese-courtyard",
    title: "Japanese Courtyard",
    areas: ["gardens", "landscape", "architecture"],
    keywords: /\b(?:japanese|japandi|zen|kyoto|tea garden|karesansui)\b/i,
    requiresMatch: true,
    families: ["rock", "vegetation", "decorative", "light"],
    recipeCategories: ["courtyard", "planting"],
    targets: T({ assets: 8, recipes: 4, materials: 3, lighting: 3, plants: 6 }),
  },
  {
    id: "coastal-plant-palette",
    title: "Coastal Plant Palette",
    areas: ["vegetation", "gardens"],
    styles: ["coastal"],
    environments: ["beach", "cliff"],
    requiresMatch: true,
    families: ["vegetation", "rock"],
    recipeCategories: ["planting"],
    targets: T({ assets: 4, recipes: 3, materials: 0, lighting: 0, plants: 14 }),
  },
  {
    id: "signature-plant-palette",
    title: "Signature Plant Palette",
    areas: ["vegetation"],
    families: ["vegetation"],
    recipeCategories: ["planting"],
    targets: T({ assets: 4, recipes: 3, materials: 0, lighting: 0, plants: 12 }),
  },
  {
    id: "waterfront-landscape",
    title: "Waterfront Landscape",
    areas: ["landscape", "views", "terrain"],
    environments: ["beach", "cliff"],
    keywords: /\b(?:waterfront|lakeside|lake|oceanfront|shoreline|seafront|dock|jetty|harbou?r)\b/i,
    requiresMatch: true,
    families: ["vegetation", "rock", "decorative", "light"],
    recipeCategories: ["planting", "retaining-wall"],
    targets: T({ assets: 8, recipes: 4, materials: 2, lighting: 2, plants: 8 }),
  },
  {
    id: "estate-landscape-composition",
    title: "Estate Landscape Composition",
    areas: ["landscape", "views"],
    families: ["vegetation", "rock", "decorative"],
    recipeCategories: ["planting", "entry-sequence"],
    targets: T({ assets: 8, recipes: 5, materials: 2, lighting: 2, plants: 8 }),
  },
  {
    id: "hillside-terracing",
    title: "Hillside Terracing",
    areas: ["terrain"],
    environments: ["hillside", "cliff"],
    keywords: /\b(?:hillside|terraced?|slope|steep|cliff)\b/i,
    families: ["rock", "vegetation", "light"],
    recipeCategories: ["retaining-wall"],
    targets: T({ assets: 5, recipes: 6, materials: 3, lighting: 2, plants: 4 }),
  },
  {
    id: "exterior-lighting",
    title: "Exterior Lighting",
    areas: ["lighting"],
    families: ["light"],
    recipeCategories: [],
    targets: T({ assets: 0, recipes: 0, materials: 0, lighting: 12 }),
  },
  {
    id: "luxury-material-palette",
    title: "Luxury Material Palette",
    areas: ["materials"],
    families: [],
    recipeCategories: ["facade"],
    targets: T({ assets: 0, recipes: 2, materials: 12, lighting: 0 }),
  },
];

const BY_ID = new Map(KNOWLEDGE_CATALOG.map((d) => [d.id, d]));

export const knowledgeDefinition = (id: string): KnowledgeDefinition | undefined => BY_ID.get(id);

export interface KnowledgeContext {
  brief: string;
  styles: readonly string[];
  environment?: SiteEnvironment;
}

/**
 * The Knowledge Need a weak design area belongs to, for this project: the most specific catalog entry that lists
 * the area (style, environment and brief keywords each make an entry more specific). Narrow entries only win on
 * a real match; otherwise the area falls to its generic parent. Null when nothing lists the area.
 */
export function pickKnowledge(area: DesignArea, ctx: KnowledgeContext): KnowledgeDefinition | null {
  let best: { def: KnowledgeDefinition; score: number } | null = null;
  for (const def of KNOWLEDGE_CATALOG) {
    if (!def.areas.includes(area)) continue;
    const styleHit = !!def.styles?.some((s) => ctx.styles.includes(s));
    const envHit = !!ctx.environment && !!def.environments?.includes(ctx.environment);
    const keywordHit = !!def.keywords && def.keywords.test(ctx.brief);
    if (def.requiresMatch && !styleHit && !envHit && !keywordHit) continue;
    // A generic entry that names a style/environment/keyword it did not match is still valid; it just ranks lower.
    const score = 1 + (styleHit ? 2 : 0) + (envHit ? 2 : 0) + (keywordHit ? 2 : 0) - (def.styles && !styleHit ? 0.25 : 0);
    if (!best || score > best.score) best = { def, score };
  }
  return best?.def ?? null;
}

/** Every catalog entry that contains an asset family, best-fitting first when styles are given. Powers "belongs to" on asset Needs. */
export function knowledgeForFamily(family: AssetCategory, styleTags: readonly string[] = []): KnowledgeDefinition[] {
  return KNOWLEDGE_CATALOG.filter((d) => d.families.includes(family)).sort((a, b) => {
    const hit = (d: KnowledgeDefinition) => (d.styles?.some((s) => styleTags.includes(s)) ? 1 : 0);
    return hit(b) - hit(a);
  });
}

/** Catalog entries the brief speaks to directly (a style, environment or keyword hit), for steering retrieval. */
export function matchKnowledge(ctx: KnowledgeContext): KnowledgeDefinition[] {
  return KNOWLEDGE_CATALOG.filter(
    (d) => d.styles?.some((s) => ctx.styles.includes(s)) || (!!ctx.environment && d.environments?.includes(ctx.environment)) || (!!d.keywords && d.keywords.test(ctx.brief))
  );
}
