import type { AssetCategory, AssetRequest, NeedDimensions, UsageContext } from "@/types/library";

/**
 * Wording normalisation. "modern gazebo", "contemporary pool pavilion" and "modern tropical pool gazebo" are the
 * same asset family; this turns free text into a category plus canonical style/context tags so the same semantic
 * request always lands on the same Need and can be matched against library assets.
 */

interface CategoryRule {
  category: AssetCategory;
  pattern: RegExp;
}

/** Most specific first: the first rule to match a clause claims its words. */
const CATEGORY_RULES: CategoryRule[] = [
  { category: "outdoor-kitchen", pattern: /\b(?:outdoor|summer|alfresco|patio)\s+kitchens?\b|\b(?:bbq|barbecue)\s+(?:area|station|island)\b|\bgrill\s+(?:station|island)\b/i },
  { category: "outdoor-bar", pattern: /\b(?:pool|swim[-\s]?up|tiki|beach|patio|outdoor|garden)\s+bars?\b/i },
  { category: "gazebo", pattern: /\b(?:gazebos?|pavilions?|belvederes?)\b/i },
  { category: "pergola", pattern: /\b(?:pergolas?|arbou?rs?|shade\s+structures?|trellis(?:es)?)\b/i },
  { category: "cabana", pattern: /\b(?:cabanas?|beach\s+huts?|poolside\s+huts?)\b/i },
  { category: "fire-pit", pattern: /\b(?:fire[-\s]?pits?|fire\s+(?:bowls?|tables?)|fire\s+features?)\b/i },
  { category: "hot-tub", pattern: /\b(?:hot[-\s]?tubs?|jacuzzis?|whirlpools?)\b/i },
  { category: "vehicle", pattern: /\b(?:cars?|vehicles?|suvs?|sports\s+cars?|supercars?|trucks?|vans?)\b/i },
  { category: "furniture", pattern: /\b(?:sun\s*loungers?|loungers?|day\s*beds?|sofas?|sectionals?|dining\s+(?:tables?|sets?)|patio\s+(?:chairs?|furniture)|outdoor\s+furniture|furniture)\b/i },
  { category: "light", pattern: /\b(?:lanterns?|bollards?|path\s+lights?|garden\s+lights?|string\s+lights?|uplights?|light\s+fixtures?)\b/i },
  { category: "rock", pattern: /\b(?:boulders?|rock\s+(?:formations?|features?))\b/i },
  { category: "vegetation", pattern: /\b(?:palms?|palm\s+trees?|bamboo|hedges?|shrubs?|topiar(?:y|ies)|planting|olive\s+trees?)\b/i },
  { category: "decorative", pattern: /\b(?:statues?|sculptures?|fountains?|planters?|urns?|water\s+feature)\b/i },
];

/** Canonical style tag -> the wordings that mean it. */
const STYLE_SYNONYMS: Record<string, RegExp> = {
  modern: /\b(?:modern|contemporary|minimalis[tm]|modernist|sleek|clean[-\s]lined?)\b/i,
  tropical: /\b(?:tropical|balinese|tiki|caribbean|island|palm[-\s]fringed)\b/i,
  mediterranean: /\b(?:mediterranean|tuscan|italian|spanish|amalfi|santorini|greek)\b/i,
  rustic: /\b(?:rustic|log|cabin|lodge|farmhouse|timber[-\s]frame)\b/i,
  industrial: /\b(?:industrial|loft[-\s]style|steel[-\s]and[-\s]concrete)\b/i,
  nordic: /\b(?:nordic|scandinavian|scandi)\b/i,
  coastal: /\b(?:coastal|nautical|seaside|beach(?:front)?|hamptons)\b/i,
  craftsman: /\b(?:craftsman|arts[-\s]and[-\s]crafts)\b/i,
  classic: /\b(?:classic(?:al)?|traditional|colonial|georgian|victorian)\b/i,
  "mid-century": /\b(?:mid[-\s]?century|midcentury|retro)\b/i,
};

const CONTEXT_SYNONYMS: Record<UsageContext, RegExp> = {
  poolside: /\b(?:pool|poolside|pool[-\s]?side|swim[-\s]?up|by\s+the\s+pool|lap\s+pool|infinity\s+pool)\b/i,
  terrace: /\b(?:terrace|patio|deck|veranda|lanai)\b/i,
  garden: /\b(?:garden|lawn|orchard|grounds|meadow)\b/i,
  entry: /\b(?:entry|entrance|front\s+door|approach|gatehouse)\b/i,
  driveway: /\b(?:driveway|motor[-\s]?court|forecourt|parking)\b/i,
  waterfront: /\b(?:waterfront|lakeside|lake|oceanfront|ocean|shoreline|seafront|dock|jetty)\b/i,
  rooftop: /\b(?:rooftop|roof\s+terrace|roof\s+deck|sky\s+deck)\b/i,
  courtyard: /\b(?:courtyard|atrium|cloister)\b/i,
};

const STYLE_ORDER = Object.keys(STYLE_SYNONYMS);
const CONTEXT_ORDER = Object.keys(CONTEXT_SYNONYMS) as UsageContext[];

export function extractStyleTags(text: string): string[] {
  return STYLE_ORDER.filter((tag) => STYLE_SYNONYMS[tag].test(text));
}

export function extractContextTags(text: string): UsageContext[] {
  return CONTEXT_ORDER.filter((tag) => CONTEXT_SYNONYMS[tag].test(text));
}

function categoriesIn(text: string): AssetCategory[] {
  const found: AssetCategory[] = [];
  // "a three-car garage" describes a building, not a vehicle asset.
  let rest = text.replace(/\b(?:\w+[-\s])?car[-\s]?(?:garage|port)s?\b/gi, " ");
  for (const rule of CATEGORY_RULES) {
    if (!rule.pattern.test(rest)) continue;
    if (!found.includes(rule.category)) found.push(rule.category);
    // A matched phrase must not also feed a looser rule ("pool bar" is not a "bar" plus a "pool").
    rest = rest.replace(new RegExp(rule.pattern.source, "gi"), " ");
  }
  return found;
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}

/**
 * One free-text asset request (an admin note, a model-proposed object) -> a normalised request.
 * Returns null when the text names no asset family, so unrecognised wording never creates a junk Need.
 */
export function normalizeAssetRequest(
  text: string,
  opts: { styleHint?: readonly string[]; dimensions?: NeedDimensions; projectId?: string | null } = {}
): AssetRequest | null {
  const [category] = categoriesIn(text);
  if (!category) return null;
  const styleTags = unique([...extractStyleTags(text), ...(opts.styleHint ?? [])]);
  // "pool bar" / "pool pavilion" carry poolside through the context matcher.
  const contextTags = extractContextTags(text);
  return { text: text.trim(), category, styleTags, contextTags, dimensions: opts.dimensions, projectId: opts.projectId ?? null };
}

/**
 * Every asset the brief itself asks for. Style and context words are read from the clause the object appears in
 * (split on sentence punctuation and "and"-style joins), with the project-wide style as a fallback, so
 * "a tropical pool bar and a fire pit on the terrace" yields two requests with their own tags.
 */
export function extractRequestsFromBrief(brief: string, opts: { styleHint?: readonly string[]; projectId?: string | null } = {}): AssetRequest[] {
  const clauses = brief.split(/[.;!?\n]+/).map((c) => c.trim()).filter(Boolean);
  const out: AssetRequest[] = [];
  for (const clause of clauses) {
    for (const category of categoriesIn(clause)) {
      const rule = CATEGORY_RULES.find((r) => r.category === category)!;
      const phrase = clause.match(new RegExp(`(?:\\S+\\s+){0,3}${rule.pattern.source}`, "i"))?.[0] ?? clause;
      // The clause supplies style/context; the phrase alone is the request's own wording.
      const styleTags = unique([...extractStyleTags(clause), ...(opts.styleHint ?? [])]);
      const contextTags = unique(extractContextTags(clause));
      out.push({ text: phrase.trim(), category, styleTags, contextTags, projectId: opts.projectId ?? null });
    }
  }
  return dedupeRequests(out);
}

/** Merges requests that are the same asset family, so one brief never counts the same object twice. */
export function dedupeRequests(requests: readonly AssetRequest[]): AssetRequest[] {
  const out: AssetRequest[] = [];
  for (const req of requests) {
    const same = out.find((r) => sameFamily(r, req));
    if (!same) {
      out.push({ ...req });
      continue;
    }
    same.styleTags = unique([...same.styleTags, ...req.styleTags]);
    same.contextTags = unique([...same.contextTags, ...req.contextTags]);
    same.dimensions = maxDimensions(same.dimensions, req.dimensions);
  }
  return out;
}

/**
 * Same asset family when the category matches and the style tags agree: either side has none (unstyled requests
 * fit anything), one is a subset of the other, or they overlap by at least half. "modern gazebo" ~ "modern tropical
 * gazebo"; "modern rustic gazebo" !~ "modern tropical gazebo". Context is deliberately ignored — a garden and a
 * poolside gazebo are the same object.
 */
export function sameFamily(a: Pick<AssetRequest, "category" | "styleTags">, b: Pick<AssetRequest, "category" | "styleTags">): boolean {
  if (a.category !== b.category) return false;
  if (a.styleTags.length === 0 || b.styleTags.length === 0) return true;
  const shared = a.styleTags.filter((t) => b.styleTags.includes(t)).length;
  if (shared === 0) return false;
  const union = new Set([...a.styleTags, ...b.styleTags]).size;
  return shared === Math.min(a.styleTags.length, b.styleTags.length) || shared / union >= 0.5;
}

export function maxDimensions(a?: NeedDimensions, b?: NeedDimensions): NeedDimensions | undefined {
  if (!a) return b;
  if (!b) return a;
  const pick = (x?: number, y?: number) => (x === undefined ? y : y === undefined ? x : Math.max(x, y));
  return { width: pick(a.width, b.width), depth: pick(a.depth, b.depth), height: pick(a.height, b.height) };
}

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  gazebo: "Gazebo", pergola: "Pergola", "outdoor-bar": "Outdoor Bar", "outdoor-kitchen": "Outdoor Kitchen", cabana: "Cabana",
  "fire-pit": "Fire Pit", "hot-tub": "Hot Tub", furniture: "Furniture", vehicle: "Vehicle", light: "Light",
  vegetation: "Vegetation", rock: "Rock", decorative: "Decorative Object",
};

export const categoryLabel = (c: AssetCategory): string => CATEGORY_LABEL[c];

const titleCase = (s: string) => s.replace(/(^|[-\s])([a-z])/g, (_, sep: string, ch: string) => `${sep}${ch.toUpperCase()}`);

/** "Modern Tropical Gazebo", "Poolside Outdoor Bar" — how a Need is titled. */
export function titleFor(req: Pick<AssetRequest, "category" | "styleTags" | "contextTags">): string {
  const parts = [...req.styleTags.slice(0, 2).map(titleCase), ...(req.styleTags.length === 0 && req.contextTags[0] ? [titleCase(req.contextTags[0])] : []), categoryLabel(req.category)];
  return parts.join(" ");
}
