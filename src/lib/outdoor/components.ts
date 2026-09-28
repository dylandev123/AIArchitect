import type { AssetCategory, AssetPriority, NeedDimensions, PlannedAsset, UsageContext } from "@/types/library";
import { finalizeGenerationPrompt } from "@/lib/library/plans";
import { nativeRoute } from "@/lib/assets/native/spec";

/**
 * The objects an outdoor space is dressed with. A space says *what* it needs ("dining-table", "pergola"); this catalog says
 * what each of those is: its asset family, the words that make a library asset count as one, and enough of a description to
 * seed a starter Asset Plan without an AI call. Every entry is a single freestanding object, sized inside the native
 * generator's family limits, so the admin can generate it natively straight from the plan.
 *
 * It is data, not behaviour: adding a component here makes every space that lists it ask for it.
 */

export interface ComponentDef {
  key: string;
  name: string;
  category: AssetCategory;
  /** Matched against an approved asset's name and tags: a hit means the library already supplies this object. */
  match: RegExp;
  description: string;
  material: string;
  dimensions: NeedDimensions;
  contexts: UsageContext[];
  tags: string[];
  /** 0–100, as in a plan: how widely future projects will reuse it. */
  reuse: number;
  /** The single-object generation prompt (see `finalizeGenerationPrompt`). */
  prompt: string;
}

const C = (def: ComponentDef): ComponentDef => def;

export const COMPONENTS: Record<string, ComponentDef> = Object.fromEntries(
  [
    // ── Seating and tables ──
    C({ key: "dining-table", name: "Outdoor Dining Table", category: "furniture", match: /\bdining[\s-]*(?:table|set)\b/i, description: "Long rectangular outdoor dining table seating eight, on trestle legs.", material: "teak", dimensions: { width: 2.4, depth: 1.0, height: 0.76 }, contexts: ["terrace", "poolside"], tags: ["dining", "table"], reuse: 95, prompt: "Long rectangular outdoor dining table with a slatted teak top and chunky trestle legs, weathered warm timber, seats eight" }),
    C({ key: "dining-chair", name: "Outdoor Dining Chair", category: "furniture", match: /\bdining[\s-]*chair\b/i, description: "Stackable outdoor dining chair with a slatted back and woven seat.", material: "teak and rope", dimensions: { width: 0.55, depth: 0.58, height: 0.9 }, contexts: ["terrace", "poolside"], tags: ["dining", "chair"], reuse: 95, prompt: "Outdoor dining chair with a slatted teak frame, gentle curved back and a woven rope seat, relaxed resort look" }),
    C({ key: "sun-lounger", name: "Pool Sun Lounger", category: "furniture", match: /lounger|chaise|sun[\s-]*bed|deck[\s-]*chair/i, description: "Reclining pool lounger with an adjustable back and a slatted teak frame.", material: "teak", dimensions: { width: 0.7, depth: 2.0, height: 0.4 }, contexts: ["poolside"], tags: ["lounger", "poolside"], reuse: 95, prompt: "Reclining poolside sun lounger with a slatted teak frame, angled back rest and a thin white cushion, low profile" }),
    C({ key: "lounge-armchair", name: "Lounge Armchair", category: "furniture", match: /arm[\s-]*chair|lounge[\s-]*chair|club[\s-]*chair/i, description: "Deep low outdoor lounge armchair with a thick seat cushion.", material: "teak and rattan", dimensions: { width: 0.85, depth: 0.85, height: 0.75 }, contexts: ["terrace", "garden", "poolside"], tags: ["armchair", "lounge"], reuse: 90, prompt: "Deep low outdoor lounge armchair with a teak frame, woven rattan sides and a thick linen seat cushion" }),
    C({ key: "outdoor-bench", name: "Garden Bench", category: "furniture", match: /bench|settee/i, description: "Slatted garden bench with a gentle back and arm rests.", material: "teak", dimensions: { width: 1.6, depth: 0.6, height: 0.85 }, contexts: ["garden", "terrace"], tags: ["bench", "garden"], reuse: 85, prompt: "Slatted teak garden bench with a low back and arm rests, weathered grey-brown timber" }),
    C({ key: "side-table", name: "Outdoor Side Table", category: "furniture", match: /side[\s-]*table|coffee[\s-]*table|end[\s-]*table/i, description: "Small round side table for drinks beside lounge seating.", material: "teak and stone", dimensions: { width: 0.5, depth: 0.5, height: 0.5 }, contexts: ["terrace", "poolside", "garden"], tags: ["side-table"], reuse: 90, prompt: "Small round outdoor side table with a stone top on three tapered teak legs, for drinks beside lounge seating" }),
    C({ key: "bar-stool", name: "Bar Stool", category: "furniture", match: /bar[\s-]*stool|stool/i, description: "Tall woven bar stool with a footrest ring.", material: "rattan and teak", dimensions: { width: 0.42, depth: 0.42, height: 0.78 }, contexts: ["poolside", "terrace"], tags: ["stool", "bar"], reuse: 88, prompt: "Tall bar stool with a round woven rattan seat, four splayed teak legs and a footrest ring" }),
    C({ key: "parasol", name: "Poolside Parasol", category: "furniture", match: /parasol|umbrella/i, description: "Large square cantilever parasol on a single pole.", material: "aluminium and canvas", dimensions: { width: 3.0, depth: 3.0, height: 2.7 }, contexts: ["poolside", "terrace"], tags: ["parasol", "shade"], reuse: 85, prompt: "Large square cantilever parasol with a slim off-centre pole, tilted canvas canopy in warm white and a heavy round base" }),

    // ── Kitchen and bar ──
    C({ key: "kitchen-island", name: "Outdoor Kitchen Island", category: "outdoor-kitchen", match: /\bisland\b|\bcounter\b/i, description: "Freestanding outdoor kitchen island with a stone worktop and cabinet base.", material: "stone and stainless steel", dimensions: { width: 2.6, depth: 0.9, height: 0.92 }, contexts: ["terrace", "poolside"], tags: ["kitchen", "island"], reuse: 85, prompt: "Freestanding outdoor kitchen island with a thick stone worktop, teak-panelled cabinet base and a raised breakfast ledge on one side" }),
    C({ key: "grill", name: "Built-in Grill", category: "outdoor-kitchen", match: /grill|bbq|barbecue/i, description: "Stainless steel built-in gas grill unit with a hood and side burner.", material: "stainless steel", dimensions: { width: 1.0, depth: 0.65, height: 1.1 }, contexts: ["terrace"], tags: ["grill", "appliance"], reuse: 80, prompt: "Stainless steel built-in barbecue grill unit with a hooded lid, control knobs along the front and a side burner" }),
    C({ key: "outdoor-fridge", name: "Outdoor Fridge Cabinet", category: "outdoor-kitchen", match: /fridge|refrigerator|cooler/i, description: "Undercounter outdoor fridge cabinet with a glass door.", material: "stainless steel", dimensions: { width: 0.6, depth: 0.6, height: 0.85 }, contexts: ["terrace", "poolside"], tags: ["fridge", "appliance"], reuse: 75, prompt: "Compact undercounter outdoor fridge with a stainless steel body, a glass front door and a slim handle" }),
    C({ key: "bar-counter", name: "Pool Bar Counter", category: "outdoor-bar", match: /bar[\s-]*counter|counter|bar/i, description: "Curved poolside bar counter with a thatched-look front panel.", material: "teak and stone", dimensions: { width: 3.0, depth: 0.8, height: 1.1 }, contexts: ["poolside"], tags: ["bar", "counter"], reuse: 75, prompt: "Poolside bar counter with a teak slatted front, a thick stone top and a back shelf for bottles, tiki resort look" }),

    // ── Shade, light and planting ──
    C({ key: "pergola", name: "Dining Pergola", category: "pergola", match: /pergola|arbou?r|shade[\s-]*structure/i, description: "Freestanding timber pergola with a slatted roof, sized to cover a dining table.", material: "teak", dimensions: { width: 4.5, depth: 3.5, height: 2.8 }, contexts: ["terrace", "poolside"], tags: ["pergola", "shade"], reuse: 90, prompt: "Freestanding timber pergola with four square posts, deep beams and a slatted open roof, sized to shade an outdoor dining table" }),
    C({ key: "pendant-light", name: "Woven Pendant Light", category: "light", match: /pendant|hanging[\s-]*light/i, description: "Woven rattan pendant light for hanging over a dining table or bar.", material: "rattan", dimensions: { width: 0.5, depth: 0.5, height: 0.6 }, contexts: ["terrace", "poolside"], tags: ["pendant", "lighting"], reuse: 92, prompt: "Woven rattan dome pendant light with a warm glowing bulb inside and a short cord, for hanging over a dining table" }),
    C({ key: "lantern", name: "Garden Lantern", category: "light", match: /lantern|table[\s-]*lamp|lamp/i, description: "Portable lantern with a metal frame and a warm glowing centre.", material: "metal and glass", dimensions: { width: 0.25, depth: 0.25, height: 0.45 }, contexts: ["terrace", "garden", "poolside"], tags: ["lantern", "lighting"], reuse: 95, prompt: "Portable garden lantern with a dark metal frame, glass panels, a top handle and a warm glowing candle inside" }),
    C({ key: "path-light", name: "Path Light", category: "light", match: /path[\s-]*light|bollard|garden[\s-]*light/i, description: "Low bollard path light for lining drives and garden paths.", material: "metal", dimensions: { width: 0.18, depth: 0.18, height: 0.7 }, contexts: ["garden", "driveway", "entry"], tags: ["path-light", "lighting"], reuse: 95, prompt: "Low bollard path light with a slim dark metal post, a shaded downward lamp head and a warm glow, for lining paths and drives" }),
    C({ key: "planter", name: "Tropical Planter", category: "decorative", match: /planter|plant[\s-]*pot|urn/i, description: "Large tapered planter for palms and structural planting.", material: "terracotta", dimensions: { width: 0.9, depth: 0.9, height: 0.8 }, contexts: ["terrace", "entry", "garden", "poolside"], tags: ["planter"], reuse: 95, prompt: "Large tapered terracotta planter with a thick rolled rim and a plain glazed finish, holding soil, for palms and structural planting" }),
    C({ key: "garden-pot", name: "Garden Pot", category: "decorative", match: /\bpot\b|\bvase\b|\bjar\b/i, description: "Round glazed garden pot for herbs and flowers.", material: "glazed ceramic", dimensions: { width: 0.5, depth: 0.5, height: 0.5 }, contexts: ["garden", "terrace", "entry"], tags: ["pot"], reuse: 90, prompt: "Round glazed ceramic garden pot with a wide mouth and a slim foot, soft sea-green finish, for herbs and flowers" }),

    // ── Things the native builders hand to an external provider ──
    C({ key: "fire-pit", name: "Fire Pit", category: "fire-pit", match: /fire[\s-]*pit|fire[\s-]*bowl|fire[\s-]*table/i, description: "Round stone fire pit with a copper bowl and glowing embers.", material: "stone and copper", dimensions: { width: 1.1, depth: 1.1, height: 0.45 }, contexts: ["terrace", "garden"], tags: ["fire-pit"], reuse: 80, prompt: "Round stone fire pit with a wide flat rim, a shallow copper bowl and glowing orange embers with low flames" }),
    C({ key: "tropical-palm", name: "Tropical Palm", category: "vegetation", match: /palm|banana|frond/i, description: "Mature coconut-style palm with a slim curved trunk and a full crown.", material: "organic", dimensions: { width: 3.5, depth: 3.5, height: 7 }, contexts: ["garden", "poolside", "entry"], tags: ["palm", "tropical"], reuse: 95, prompt: "Mature tropical palm with a slim gently curved trunk and a full crown of arching fronds, coconut-palm proportions" }),
    C({ key: "cabana", name: "Poolside Cabana", category: "cabana", match: /cabana|beach[\s-]*hut/i, description: "Four-post poolside cabana with white drapes and a daybed.", material: "teak and canvas", dimensions: { width: 3.0, depth: 3.0, height: 2.8 }, contexts: ["poolside"], tags: ["cabana"], reuse: 70, prompt: "Four-post poolside cabana with a flat canvas roof, tied-back white drapes and a large daybed under it" }),
  ].map((c) => [c.key, c])
);

export const componentDef = (key: string): ComponentDef | undefined => COMPONENTS[key];

/** The asset family an asset must belong to for `key` to be satisfied. */
export const componentCategory = (key: string): AssetCategory | undefined => COMPONENTS[key]?.category;

const PRIORITY_FOR: Record<"required" | "preferred", AssetPriority> = { required: "required", preferred: "recommended" };

/**
 * A planned asset for a component, ready to save in a starter Asset Plan. Style is the style of the project that exposed it;
 * `space` and `component` ride along as tags so the admin (and the reuse report) can tell what it was planned for.
 */
export function plannedAssetFor(key: string, opts: { styles: readonly string[]; space?: string; need: "required" | "preferred"; id?: string }): PlannedAsset | undefined {
  const def = COMPONENTS[key];
  if (!def) return undefined;
  const style = opts.styles.length > 0 ? [...opts.styles] : ["tropical", "modern"];
  const asset = {
    id: opts.id ?? crypto.randomUUID(),
    name: def.name,
    category: def.category,
    description: def.description,
    style,
    material: def.material,
    dimensions: def.dimensions,
    tags: [...new Set([...def.tags, `component:${def.key}`, ...(opts.space ? [`space:${opts.space}`] : [])])],
    priority: PRIORITY_FOR[opts.need],
    estimatedReuse: def.reuse,
    contexts: def.contexts,
    generationPrompt: finalizeGenerationPrompt(def.prompt, { dimensions: def.dimensions }),
    approved: false,
    generated: false,
  } satisfies Omit<PlannedAsset, "route">;
  return { ...asset, route: nativeRoute(asset) };
}
