import type { CompassSide, DesignTier, ProjectScale, SiteEnvironment } from "@/types/house";
import type { AssetCategory, RecipeCategory } from "@/types/library";
import type { ZoneKind } from "@/lib/house/architecture/sitePlan";
import { inferScaleFromBrief, isProjectScale, SCALE_PROFILES, scaleRank } from "@/lib/house/scale";
import { inferSiteHints } from "@/lib/house/siteSettings";
import { extractStyleTags } from "@/lib/library/taxonomy";
import { COMPONENTS } from "./components";

/**
 * Outdoor spaces: the unit the exterior is designed in.
 *
 * The generator used to place objects — a pool, a gazebo, a patio — wherever a rule found room. A property is not read that
 * way: it is a handful of intentional *places* (the arrival court, the dining terrace, the pool lounge), each with a purpose,
 * a size, a position relative to the house and to the other places, a direction it faces, the recipes that describe how to
 * build it and the objects that dress it. This module plans that set from the brief, the scale, the style, the environment
 * and the view / arrival directions, and later reads a generated project to say which spaces the design actually contains.
 *
 * It is pure data and pure functions. It does not place anything: placement is still the site plan's job (the `zone` on each
 * space names the site-plan zone that owns it), and collisions remain a safety net behind it.
 */

export const OUTDOOR_SPACE_KINDS = [
  "arrival-court", "main-outdoor-living", "outdoor-dining", "outdoor-kitchen", "pool-lounge", "pool-bar",
  "fire-pit-lounge", "garden", "quiet-retreat", "guest-outdoor", "service", "view-terrace",
] as const;
export type OutdoorSpaceKind = (typeof OUTDOOR_SPACE_KINDS)[number];

/** Where on the property a space stands, relative to the two axes the site is composed around. */
export type SpaceSide = "arrival" | "view" | "flank" | "rear";

export interface OutdoorSpace {
  /** Realized placement frame, in metres and radians, derived from the generated site. */
  layout?: { center: [number, number, number]; width: number; depth: number; yaw: number };
  id: OutdoorSpaceKind;
  kind: OutdoorSpaceKind;
  name: string;
  purpose: string;
  /** The brief named it, as opposed to the planner adding it for the scale, style and site. */
  requested: boolean;
  /** Why it is in the plan. */
  reasons: string[];
  /** Approximate ground footprint, metres, for this project's scale. */
  footprint: { width: number; depth: number };
  side: SpaceSide;
  relationToHouse: string;
  /** Spaces it wants close, most important first. */
  near: OutdoorSpaceKind[];
  /** Spaces it must be kept away from. */
  apart: OutdoorSpaceKind[];
  orientation: { faces: "view" | "house" | "garden"; /** 0 (indifferent) … 1 (the view decides where it goes). */ viewPriority: number };
  /** The site-plan zone that owns it, where one does. */
  zone?: ZoneKind;
  recipeCategories: RecipeCategory[];
  /** Ids of the approved recipes retrieved for it. Empty until retrieval runs. */
  recipeIds: string[];
  /** Objects it is dressed with (keys of `COMPONENTS`). */
  components: { required: string[]; preferred: string[] };
  /** The asset families those objects belong to. */
  assetCategories: { required: AssetCategory[]; preferred: AssetCategory[] };
  /** What in the generated design stands for it; empty for a plan that has not been read against a project. */
  realizedBy: string[];
  realized: boolean;
}

interface Blueprint {
  name: string;
  purpose: string;
  side: SpaceSide;
  relationToHouse: string;
  near: OutdoorSpaceKind[];
  apart: OutdoorSpaceKind[];
  faces: OutdoorSpace["orientation"]["faces"];
  viewPriority: number;
  zone?: ZoneKind;
  recipeCategories: RecipeCategory[];
  required: string[];
  preferred: string[];
  /** Footprint at the family scale, metres; other scales grow or shrink it. */
  base: [number, number];
}

const BLUEPRINTS: Record<OutdoorSpaceKind, Blueprint> = {
  "arrival-court": {
    name: "Arrival / Motor Court",
    purpose: "Welcome and park: the drive, the garage court and the front entry, formal and kept apart from the private outdoor spaces.",
    side: "arrival",
    relationToHouse: "Meets the front door on the entrance wall; the garage court flanks the drive.",
    near: ["service"],
    apart: ["pool-lounge", "outdoor-dining", "main-outdoor-living", "pool-bar"],
    faces: "house",
    viewPriority: 0,
    zone: "arrivalCourt",
    recipeCategories: ["motor-court", "entry-sequence"],
    required: ["planter", "path-light"],
    preferred: ["lantern"],
    base: [12, 10],
  },
  "main-outdoor-living": {
    name: "Main Outdoor Living",
    purpose: "The house's outdoor room: a shaded terrace of lounge seating that opens straight off the living areas toward the view.",
    side: "view",
    relationToHouse: "Attached to the view wall, level with the living rooms.",
    near: ["outdoor-dining", "pool-lounge", "view-terrace"],
    apart: ["arrival-court", "service"],
    faces: "view",
    viewPriority: 1,
    zone: "viewTerrace",
    recipeCategories: ["outdoor-living", "terrace"],
    required: ["lounge-armchair", "side-table"],
    preferred: ["outdoor-bench", "lantern", "planter"],
    base: [8, 5],
  },
  "outdoor-dining": {
    name: "Outdoor Dining",
    purpose: "A table for the household and guests under shade, close to the kitchen, near the pool and protected from vehicle circulation.",
    side: "view",
    relationToHouse: "Steps off the kitchen and living room; shaded by a pergola or the house's own roof.",
    near: ["outdoor-kitchen", "main-outdoor-living", "pool-lounge"],
    apart: ["arrival-court", "service"],
    faces: "view",
    viewPriority: 0.6,
    zone: "outdoorLiving",
    recipeCategories: ["outdoor-living", "terrace"],
    required: ["dining-table", "dining-chair", "pergola"],
    preferred: ["pendant-light", "planter"],
    base: [5, 4],
  },
  "outdoor-kitchen": {
    name: "Outdoor Kitchen",
    purpose: "Cooking outdoors: an island with a grill and cold storage, close to the indoor kitchen and to the dining table it serves.",
    side: "view",
    relationToHouse: "Against the kitchen side of the house, downwind of the dining table.",
    near: ["outdoor-dining", "pool-lounge"],
    apart: ["arrival-court", "quiet-retreat"],
    faces: "house",
    viewPriority: 0.3,
    zone: "outdoorLiving",
    recipeCategories: ["outdoor-living"],
    required: ["kitchen-island", "grill"],
    preferred: ["outdoor-fridge", "bar-stool", "pendant-light"],
    base: [4, 3],
  },
  "pool-lounge": {
    name: "Pool Lounge",
    purpose: "Sun loungers, shade and side tables around the pool: the private, sun-facing heart of the outdoor living.",
    side: "view",
    relationToHouse: "Below the main terrace on the private side; the pool garden runs out toward the view.",
    near: ["main-outdoor-living", "pool-bar", "outdoor-dining"],
    apart: ["arrival-court", "service"],
    faces: "view",
    viewPriority: 0.9,
    zone: "poolGarden",
    recipeCategories: ["pool"],
    required: ["sun-lounger", "side-table"],
    preferred: ["parasol", "cabana", "planter"],
    base: [12, 7],
  },
  "pool-bar": {
    name: "Pool Bar",
    purpose: "A bar within reach of the water, for drinks and casual eating beside the pool.",
    side: "view",
    relationToHouse: "At the pool's edge, on the side away from the arrival.",
    near: ["pool-lounge"],
    apart: ["arrival-court", "quiet-retreat"],
    faces: "garden",
    viewPriority: 0.5,
    zone: "outdoorLiving",
    recipeCategories: ["pool", "outdoor-living"],
    required: ["bar-counter", "bar-stool"],
    preferred: ["pendant-light", "lantern"],
    base: [4, 3],
  },
  "fire-pit-lounge": {
    name: "Fire Pit Lounge",
    purpose: "An evening seating circle around a fire, set apart from the pool and the dining so it stays quiet.",
    side: "flank",
    relationToHouse: "A short walk from the terrace, at the edge of the garden with a view over it.",
    near: ["garden", "main-outdoor-living"],
    apart: ["arrival-court", "service"],
    faces: "garden",
    viewPriority: 0.6,
    zone: "outdoorLiving",
    recipeCategories: ["outdoor-living"],
    required: ["fire-pit", "lounge-armchair"],
    preferred: ["outdoor-bench", "side-table", "lantern"],
    base: [5, 5],
  },
  garden: {
    name: "Garden / Landscape",
    purpose: "Planting that frames the house, the entrance and the outdoor spaces, and ties the property together with paths.",
    side: "flank",
    relationToHouse: "Wraps the house and links the spaces; framing the arrival and the view.",
    near: ["quiet-retreat", "main-outdoor-living"],
    apart: ["service"],
    faces: "garden",
    viewPriority: 0.4,
    zone: "garden",
    recipeCategories: ["planting"],
    required: ["planter", "tropical-palm"],
    preferred: ["garden-pot", "path-light", "outdoor-bench"],
    base: [10, 8],
  },
  "quiet-retreat": {
    name: "Quiet Retreat / Reading",
    purpose: "A secluded corner for reading and stillness, screened by planting and away from the entertaining spaces.",
    side: "rear",
    relationToHouse: "Tucked to one side of the house, reached by a path through the garden.",
    near: ["garden"],
    apart: ["arrival-court", "service", "pool-bar"],
    faces: "garden",
    viewPriority: 0.3,
    zone: "garden",
    recipeCategories: ["courtyard", "planting"],
    required: ["outdoor-bench", "lounge-armchair"],
    preferred: ["planter", "lantern"],
    base: [5, 5],
  },
  "guest-outdoor": {
    name: "Guest Outdoor Area",
    purpose: "A private terrace for the guest house, connected to the main outdoor spaces by a path but not overlooked by them.",
    side: "flank",
    relationToHouse: "In front of the guest building, on the flank away from the arrival.",
    near: ["garden"],
    apart: ["arrival-court", "service"],
    faces: "garden",
    viewPriority: 0.4,
    zone: "guest",
    recipeCategories: ["courtyard"],
    required: ["lounge-armchair", "planter"],
    preferred: ["side-table", "lantern"],
    base: [8, 6],
  },
  service: {
    name: "Service Area",
    purpose: "The working side of the property: deliveries, bins and garden stores, screened from the view and the entertaining spaces.",
    side: "flank",
    relationToHouse: "Beside the garage court, out of sight of the view.",
    near: ["arrival-court"],
    apart: ["main-outdoor-living", "pool-lounge", "outdoor-dining"],
    faces: "house",
    viewPriority: 0,
    zone: "service",
    recipeCategories: [],
    required: [],
    preferred: [],
    base: [6, 4],
  },
  "view-terrace": {
    name: "View Terrace",
    purpose: "A raised or edge terrace whose only job is the view: a place to stand or sit and look.",
    side: "view",
    relationToHouse: "At the view edge of the property, reached from the main terrace.",
    near: ["main-outdoor-living"],
    apart: ["arrival-court", "service"],
    faces: "view",
    viewPriority: 1,
    zone: "viewTerrace",
    recipeCategories: ["terrace"],
    required: ["lounge-armchair", "planter"],
    preferred: ["lantern", "side-table"],
    base: [8, 4],
  },
};

export const spaceName = (kind: OutdoorSpaceKind): string => BLUEPRINTS[kind].name;
export const isSpaceKind = (v: unknown): v is OutdoorSpaceKind => typeof v === "string" && (OUTDOOR_SPACE_KINDS as readonly string[]).includes(v);

// ── Planning ────────────────────────────────────────────────────────────────

export interface SpaceInput {
  brief: string;
  scale?: ProjectScale;
  tier?: DesignTier;
  environment?: SiteEnvironment;
  /** Style tags (see taxonomy); read from the brief when omitted. */
  styles?: readonly string[];
  viewDirection?: CompassSide;
  approachSide?: CompassSide;
}

const ASKED: Record<OutdoorSpaceKind, RegExp> = {
  "arrival-court": /\b(?:driveway|motor[-\s]?court|forecourt|arrival|porte[-\s]?coch[eè]re|garage|parking)\b/i,
  "main-outdoor-living": /\b(?:outdoor[-\s]living|indoor[-\s]outdoor|terrace|patio|deck|veranda|lanai|alfresco|al fresco|entertain\w*)\b/i,
  "outdoor-dining": /\b(?:outdoor|covered|terrace|patio|pool(?:side)?|garden)\s+dining\b|\balfresco\b|\bal fresco\b|\beat(?:ing)? outside\b/i,
  "outdoor-kitchen": /\b(?:outdoor|summer|alfresco|patio)\s+kitchens?\b|\b(?:bbq|barbecue|grill)\b/i,
  "pool-lounge": /\b(?:pool|swimming|plunge|infinity)\b/i,
  "pool-bar": /\b(?:pool|swim[-\s]?up|tiki|beach|outdoor|garden)\s+bars?\b/i,
  "fire-pit-lounge": /\b(?:fire[-\s]?pits?|fire\s+(?:bowls?|tables?|features?|lounge)|fireside|bonfire)\b/i,
  garden: /\b(?:gardens?|landscap\w*|planting|lawns?|orchard|grounds)\b/i,
  "quiet-retreat": /\b(?:reading|retreat|quiet\s+(?:corner|spot|nook|garden)|meditat\w*|yoga|contemplat\w*|hammock|secluded|sanctuary)\b/i,
  "guest-outdoor": /\bguest\s+(?:house|villa|suite|cottage|bungalow|quarters)\b|\bcasita\b/i,
  service: /\b(?:service\s+(?:yard|area|court)|utility\s+yard|laundry\s+yard)\b/i,
  "view-terrace": /\b(?:view\s+terrace|overlook\w*|panoram\w*|belvedere|lookout|ocean\s+views?|sea\s+views?|sunset\s+terrace)\b/i,
};

const RESORT = /\b(?:resort|caribbean|tropical|balinese|island|hotel|retreat|villa)\b/i;
const OUTDOOR_FOCUS = /\b(?:outdoor[-\s]living|indoor[-\s]outdoor|entertain\w*|alfresco|al fresco|resort|focused on outdoor)\b/i;
const round1 = (n: number) => Math.round(n * 10) / 10;

function footprintFor(kind: OutdoorSpaceKind, rank: number): { width: number; depth: number } {
  const [w, d] = BLUEPRINTS[kind].base;
  const f = 0.85 + 0.075 * rank;
  return { width: round1(w * f), depth: round1(d * f) };
}

/**
 * The spaces a project should be designed around, most important first. Pure: the same input always yields the same plan.
 * Everything the brief names is in; everything else is in only when the scale, style, environment or a stated view calls for
 * it, and each carries the reason, so the admin can see why a space was planned.
 */
export function planOutdoorSpaces(input: SpaceInput): OutdoorSpace[] {
  const brief = input.brief ?? "";
  const hints = inferSiteHints(brief);
  const scale = input.scale ?? hints.projectScale ?? inferScaleFromBrief(brief);
  const rank = scale && isProjectScale(scale) ? scaleRank(scale) : 1;
  const profile = scale && isProjectScale(scale) ? SCALE_PROFILES[scale] : undefined;
  const tier = input.tier ?? hints.designTier;
  const env = input.environment ?? hints.environment;
  const styles = input.styles ?? extractStyleTags(brief);
  const luxuryPlus = rank >= 2 || tier === "luxury" || tier === "estate";
  const urban = env === "urban";
  const resort = RESORT.test(brief) || styles.includes("tropical") || styles.includes("coastal");
  const focus = OUTDOOR_FOCUS.test(brief);
  const asked = (kind: OutdoorSpaceKind) => ASKED[kind].test(brief);
  const viewSite = env === "hillside" || env === "cliff" || env === "beach";
  const hasPool = asked("pool-lounge") || (!!profile?.pool && !urban && luxuryPlus);

  type Decision = { include: boolean; reasons: string[] };
  const decide = (kind: OutdoorSpaceKind): Decision => {
    const reasons: string[] = [];
    if (asked(kind)) reasons.push("named in the brief");
    const also = (cond: boolean, why: string) => {
      if (cond) reasons.push(why);
    };
    switch (kind) {
      case "arrival-court":
        also(true, `a ${scale ?? "family"}-scale property has a drive and an entrance`);
        break;
      case "main-outdoor-living":
        also(true, "the house needs an outdoor room off its living side");
        break;
      case "outdoor-dining":
        also(luxuryPlus && (focus || resort), "outdoor-living focus at luxury scale");
        also(rank >= 3, "an estate entertains outdoors");
        break;
      case "outdoor-kitchen":
        also(rank >= 4 && (focus || resort), "a mansion's outdoor living includes cooking");
        break;
      case "pool-lounge":
        also(hasPool && !asked(kind), `${scale ?? "luxury"} scale has a pool`);
        break;
      case "pool-bar":
        also(hasPool && rank >= 4 && resort, "resort-style mansion with a pool");
        break;
      case "fire-pit-lounge":
        also(rank >= 4 && (focus || resort), "a mansion's evening space");
        break;
      case "garden":
        also(rank >= 2 || styles.includes("tropical") || styles.includes("mediterranean"), "planting frames the house and links the spaces");
        break;
      case "quiet-retreat":
        also(rank >= 4, "a mansion has a place for stillness");
        break;
      case "guest-outdoor":
        also(rank >= 4 && !urban, "a mansion's guest building has its own terrace");
        break;
      case "service":
        also(rank >= 2 && !urban, "garages and stores need a screened working side");
        break;
      case "view-terrace":
        also(viewSite && rank >= 1, `${env} site: the view decides the terrace`);
        also(!!hints.viewDirection && /\b(?:ocean|sea|view|overlook|sunset|sunrise)\b/i.test(brief) && !asked(kind), "the brief states a view");
        break;
    }
    // Nothing here is added to a design that has no space for it: an urban lot gets no pool bar or fire pit unless asked.
    const named = asked(kind);
    if (!named && urban && !["arrival-court", "main-outdoor-living", "garden"].includes(kind)) return { include: false, reasons: [] };
    return { include: reasons.length > 0, reasons };
  };

  const out: OutdoorSpace[] = [];
  for (const kind of OUTDOOR_SPACE_KINDS) {
    const { include, reasons } = decide(kind);
    if (!include) continue;
    const b = BLUEPRINTS[kind];
    const required = b.required.filter((c) => COMPONENTS[c]);
    const preferred = b.preferred.filter((c) => COMPONENTS[c]);
    const cats = (keys: string[]) => [...new Set(keys.map((c) => COMPONENTS[c].category))];
    out.push({
      id: kind,
      kind,
      name: b.name,
      purpose: b.purpose,
      requested: asked(kind),
      reasons,
      footprint: footprintFor(kind, rank),
      side: b.side,
      relationToHouse: b.relationToHouse,
      near: b.near,
      apart: b.apart,
      orientation: { faces: b.faces, viewPriority: b.viewPriority },
      zone: b.zone,
      recipeCategories: b.recipeCategories,
      recipeIds: [],
      components: { required, preferred },
      assetCategories: { required: cats(required), preferred: cats(preferred) },
      realizedBy: [],
      realized: false,
    });
  }
  // Requested spaces first (the brief's own words), then by how central they are to the view.
  return out.sort((a, b) => Number(b.requested) - Number(a.requested) || b.orientation.viewPriority - a.orientation.viewPriority);
}

// ── Reading a generated project ─────────────────────────────────────────────

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (root: Rec, key: string): Rec[] => (Array.isArray(root[key]) ? (root[key] as unknown[]).filter(isRecord) : []);

/**
 * Which spaces the generated design actually contains. A space is *realized* when something in the project stands for it (a
 * patio for the terrace, a pool for the pool lounge, a garden zone for the garden). The procedural generator draws surfaces and
 * structures, not the furniture on them, so a realized space is exactly where its components are still missing.
 */
export function realizeSpaces(spaces: readonly OutdoorSpace[], projectJson: string | Rec): OutdoorSpace[] {
  let root: Rec;
  try {
    const parsed: unknown = typeof projectJson === "string" ? JSON.parse(projectJson) : projectJson;
    if (!isRecord(parsed)) return spaces.map((s) => ({ ...s }));
    root = parsed;
  } catch {
    return spaces.map((s) => ({ ...s }));
  }
  const site = isRecord(root.site) ? root.site : {};
  const view = site.viewDirection;
  const buildings = list(root, "buildings");
  const kinds = (k: string) => buildings.filter((b) => b.kind === k);
  const count = (key: string) => list(root, key).length;
  const on = (key: string, wall: unknown) => list(root, key).filter((i) => i.wall === wall).length;
  const label = (n: number, name: string) => (n > 0 ? [`${n} ${name}${n === 1 ? "" : /(?:ch|sh|s|x)$/.test(name) ? "es" : "s"}`] : []);

  const found: Record<OutdoorSpaceKind, string[]> = {
    "arrival-court": [...label(count("driveways"), "driveway"), ...label(count("parking"), "parking area"), ...label(count("garages") + kinds("detached_garage").length, "garage"), ...label(count("porches"), "porch")],
    "main-outdoor-living": [...label(count("patios"), "patio"), ...label(count("decks"), "deck")],
    "outdoor-dining": [...label(count("patios") + count("decks"), "dining surface"), ...label(kinds("gazebo").length, "gazebo")],
    "outdoor-kitchen": [...label(count("patios") + count("decks"), "terrace surface"), ...label(kinds("outdoor_bar").length, "outdoor bar")],
    "pool-lounge": [...label(count("pools"), "pool")],
    "pool-bar": [...label(kinds("outdoor_bar").length, "outdoor bar")],
    "fire-pit-lounge": [...label(list(root, "landscaping").filter((z) => z.kind === "garden").length + kinds("gazebo").length, "garden or pavilion setting")],
    garden: [...label(list(root, "landscaping").filter((z) => z.kind === "garden").length, "garden zone"), ...label(count("paths"), "path")],
    "quiet-retreat": [...label(list(root, "landscaping").filter((z) => z.kind === "garden").length, "garden zone"), ...label(kinds("gazebo").length, "gazebo")],
    "guest-outdoor": [...label(kinds("villa").length, "guest building")],
    service: [...label(kinds("shed").length, "shed"), ...label(kinds("detached_garage").length, "detached garage")],
    "view-terrace": [...label(on("patios", view) + on("decks", view) + on("balconies", view), "view-side surface")],
  };
  return spaces.map((s) => ({ ...s, realizedBy: found[s.kind], realized: found[s.kind].length > 0 }));
}

// ── Prompt ──────────────────────────────────────────────────────────────────

/**
 * The generation prompt's outdoor-space section: the spaces to design (not objects to scatter), where each belongs and what it
 * relates to. Empty when there is nothing to say. Deliberately short: the site planner, not the model, does the placing.
 */
export function describeSpacesForPrompt(spaces: readonly OutdoorSpace[]): string {
  if (spaces.length === 0) return "";
  const lines = spaces.map((s) => {
    const rel = [s.near.length ? `near ${s.near.slice(0, 3).map(spaceName).join(", ")}` : "", s.apart.length ? `away from ${s.apart.slice(0, 3).map(spaceName).join(", ")}` : ""].filter(Boolean).join("; ");
    return `- ${s.name} (~${s.footprint.width} × ${s.footprint.depth} m, ${s.side === "view" ? "view side" : s.side === "arrival" ? "arrival side" : s.side === "rear" ? "private corner" : "flank"}): ${s.purpose}${rel ? ` ${rel[0].toUpperCase()}${rel.slice(1)}.` : ""}`;
  });
  return `═══ OUTDOOR SPACES ═══

Design the exterior as these intentional outdoor spaces, not as scattered objects. Each is a place with a purpose, a position relative to the house and to the other spaces, and a direction it faces.
${lines.join("\n")}

Placement principles: the driveway, garage court and front entry belong on the arrival side (the approachSide wall). The main outdoor living, the pool and the dining belong on the private, view side (the viewDirection wall) — never in the arrival court, unless the brief explicitly places the pool at the entrance. On a hillside or ocean site the pool and terrace face the view first. Keep dining and seating away from vehicle circulation.`;
}
