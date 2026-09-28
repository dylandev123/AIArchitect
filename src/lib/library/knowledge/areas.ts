import { inferSiteHints } from "@/lib/house/siteSettings";
import { scaleRank } from "@/lib/house/scale";
import type { SiteEnvironment } from "@/types/house";
import type { AssetCategory, DesignArea, DesignRecipe } from "@/types/library";
import { styleTagsForProjectStyle } from "../requests";
import type { AssetIndexEntry } from "../retrieval";
import { extractRequestsFromBrief, extractStyleTags } from "../taxonomy";
import { pickKnowledge } from "./catalog";
import { factsFromIndex, knowledgeProgress } from "./progress";

/**
 * Scores the major design areas of a generated design independently, 0 (missing) … 1 (well served). An area
 * scores low when the procedural result is thin for the project's ambition (tier × scale) *and* the approved
 * library has nothing to enrich it with. Areas the procedural generator cannot draw at all (lighting, furniture)
 * are scored purely on library coverage, and only when the design has surfaces that call for them.
 *
 * This is a heuristic read of the generated JSON, deliberately cheap and pure: it runs after every generation.
 *
 * What "the library has something to enrich it with" means is the same thing the control center shows: the completion of the
 * Knowledge Need the area belongs to (approved assets of its families, approved recipes of its categories against the need's
 * targets). One approved chair does not make furniture "served"; a Need stays open, and keeps counting demand, until the
 * library really covers it.
 */

/** Below this an area counts as weak and feeds a Knowledge Need. */
export const WEAK_AREA_SCORE = 0.5;

/** How much of the gap between the procedural result and full library coverage the library closes. */
const LIBRARY_WEIGHT = 0.3;

export interface AreaScore {
  area: DesignArea;
  /** False when the design has no use for this area (a flat site needs no terracing): never weak. */
  relevant: boolean;
  score: number;
  reason: string;
}

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (root: Rec, key: string): Rec[] => (Array.isArray(root[key]) ? (root[key] as unknown[]).filter(isRecord) : []);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

const TIER_DEMAND: Record<string, number> = { starter: 0.6, comfort: 1, luxury: 1.5, estate: 2 };

/** How much detail the project's ambition calls for; 1 for a project with no tier or scale (the baseline). */
function demandOf(settings: Rec | undefined): number {
  const tier = typeof settings?.designTier === "string" ? (TIER_DEMAND[settings.designTier] ?? 1) : 1;
  const scale = typeof settings?.projectScale === "string" ? 0.85 + 0.075 * scaleRank(settings.projectScale as never) : 1;
  return tier * (Number.isFinite(scale) ? scale : 1);
}

/** Asset families whose approved library entries can serve each area. */
export const AREA_FAMILIES: Partial<Record<DesignArea, AssetCategory[]>> = {
  "outdoor-living": ["gazebo", "pergola", "outdoor-bar", "outdoor-kitchen", "cabana", "fire-pit", "hot-tub"],
  furniture: ["furniture"],
  lighting: ["light"],
  vegetation: ["vegetation"],
  gardens: ["vegetation", "decorative"],
  terrain: ["rock"],
  driveway: ["vehicle"],
  pool: ["cabana", "hot-tub", "furniture"],
  arrival: ["vehicle", "decorative", "light"],
  landscape: ["vegetation", "rock", "decorative"],
};

/** What the scorer needs to know about the project to find an area's Knowledge Need. */
interface AreaContext {
  brief: string;
  styles: string[];
  environment?: SiteEnvironment;
}

/**
 * How well the library already covers an area, 0…1: the completion of the Knowledge Need the area belongs to for this project.
 * Materials are ignored, because the server only sees the object assets a generation request sends with it, not PBR materials.
 */
function coverage(area: DesignArea, facts: { assets: ReturnType<typeof factsFromIndex>; recipes: readonly DesignRecipe[] }, ctx: AreaContext): number {
  const def = pickKnowledge(area, ctx);
  if (!def) return 0;
  return knowledgeProgress({ id: def.id, assetIds: [], recipeIds: [] }, facts, { ignore: ["materials"] }).completion;
}

interface Read {
  proc: number | null;
  relevant?: boolean;
  reason: string;
}

export function scoreDesignAreas(json: string, brief: string, library: readonly AssetIndexEntry[], recipes: readonly DesignRecipe[] = []): AreaScore[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];
  const root = parsed;
  // The site block is stored under `site` (that is what the renderer and `applyPatch` read and write). `settings` is the name the
  // type once had and older fixtures still use, so it is read as a fallback.
  const settings = isRecord(root.site) ? root.site : isRecord(root.settings) ? root.settings : undefined;
  const opts = isRecord(root.exteriorOptions) ? root.exteriorOptions : {};
  const styleKey = typeof opts.style === "string" ? opts.style : "";
  const ctx: AreaContext = {
    brief: `${brief} ${styleKey.replace(/-/g, " ")}`,
    styles: [...new Set([...extractStyleTags(brief), ...styleTagsForProjectStyle(styleKey)])],
    environment: (typeof settings?.environment === "string" ? settings.environment : inferSiteHints(brief).environment) as SiteEnvironment | undefined,
  };
  const facts = { assets: factsFromIndex(library), recipes };
  const d = demandOf(settings);

  const n = (key: string) => list(root, key).length;
  const buildings = list(root, "buildings");
  const house = isRecord(root.house) ? root.house : {};
  const wallOf = (items: Rec[], side: unknown) => items.filter((i) => i.wall === side).length;
  const requested = new Set(extractRequestsFromBrief(brief).map((r) => r.category));
  const mentionsPool = /\bpool\b/i.test(brief);
  const view = settings?.viewDirection;

  const richFeatures = n("bays") + n("arches") + n("curvedWalls") + n("dormers") + n("crossGables") + n("chimneys") + n("porches") + n("stairs");
  const roofTypes = new Set([house.roof, ...buildings.map((b) => b.roof)].filter((r) => typeof r === "string"));
  const roofParts = n("dormers") + n("crossGables") + n("chimneys");
  const wantedRoofTypes = Math.min(1 + Math.ceil(d), 1 + buildings.length);
  const gardenZones = list(root, "landscaping").filter((z) => z.kind === "garden").length;
  const outdoorSurfaces = n("patios") + n("decks") + n("porches") + n("pools");
  const optKeys = ["wallFinish", "windowStyle", "doorStyle", "railingStyle", "columnStyle", "patioSurface", "poolTile"].filter((k) => opts[k] !== undefined).length;
  const optAssets = ["patioAssetId", "poolAssetId", "drivewayAssetId"].filter((k) => typeof opts[k] === "string").length;

  // Objects the brief asks for that procedural generation does not draw (a fire pit, a cabana) and no library asset supplies.
  const unmetObjects = [...requested].filter(
    (c) => (AREA_FAMILIES["outdoor-living"] ?? []).includes(c) && !["gazebo", "outdoor-bar"].includes(c) && !library.some((a) => a.family === c)
  ).length;
  const outdoorFeatures = n("patios") + n("decks") + n("pools") + n("porches") + n("balconies") * 0.5 + buildings.filter((b) => b.kind === "gazebo" || b.kind === "outdoor_bar").length * 1.5;

  const slope = settings?.terrainSlope;
  const terrainFeatures = n("slopes") + n("retainingWalls") + n("waterways") + n("rocks") * 0.5;
  const terrainWanted = slope === "steep" ? 5 : slope === "gentle" ? 2 : 0;

  const viewAligned = settings
    ? wallOf(list(root, "patios"), view) + wallOf(list(root, "pools"), view) + wallOf(list(root, "balconies"), view) + wallOf(list(root, "porches"), view) + Math.min(wallOf(list(root, "windows"), view), 4) / 2
    : 0;

  const reads: Record<DesignArea, Read> = {
    architecture: { proc: clamp01(richFeatures / (4 * d)), reason: `${richFeatures} architectural features, ~${round1(4 * d)} expected` },
    roofing: {
      proc: 0.5 * clamp01(roofTypes.size / wantedRoofTypes) + 0.5 * clamp01(roofParts / (3 * d)),
      reason: `${roofTypes.size} roof type${roofTypes.size === 1 ? "" : "s"} across ${buildings.length + 1} buildings, ${roofParts} dormers/gables/chimneys`,
    },
    landscape: {
      proc: clamp01((n("landscaping") + n("paths") + n("retainingWalls") + n("rocks") + n("waterways") + n("slopes")) / (5 * d)),
      reason: `${n("landscaping")} landscape zones, ${n("paths")} paths`,
    },
    "outdoor-living": {
      proc: clamp01(outdoorFeatures / (4 * d) - 0.15 * unmetObjects),
      reason: `${round1(outdoorFeatures)} outdoor-living features${unmetObjects > 0 ? `, ${unmetObjects} requested object type${unmetObjects === 1 ? "" : "s"} with no asset` : ""}`,
    },
    pool: {
      relevant: n("pools") > 0 || mentionsPool,
      proc: n("pools") === 0 ? 0 : 0.5 + (n("patios") + n("decks") > 0 ? 0.25 : 0) + (n("pools") > 1 || list(root, "pools").some((p) => p.shape && p.shape !== "rectangle") ? 0.25 : 0),
      reason: n("pools") === 0 ? "a pool was asked for but none was designed" : `${n("pools")} pool(s), ${n("patios") + n("decks")} surrounding deck/patio`,
    },
    arrival: {
      proc: clamp01((n("driveways") + n("roads") + n("parking") + n("porches") + n("paths") * 0.5) / (3 * d)),
      reason: `${n("driveways") + n("roads")} approach routes, ${n("porches")} porches`,
    },
    driveway: {
      relevant: n("driveways") + n("parking") + n("garages") > 0,
      proc: (n("driveways") > 0 ? 0.4 : 0) + (list(root, "driveways").some((x) => typeof x.bend === "number" && x.bend !== 0) ? 0.3 : 0) + (n("parking") > 0 ? 0.2 : 0) + (n("garages") > 0 ? 0.1 : 0),
      reason: `${n("driveways")} driveways, ${n("parking")} parking areas`,
    },
    facade: {
      proc: clamp01((Math.min(n("windows"), 16) / 4 + n("balconies") + n("porches") + n("bays") * 1.5 + n("arches") * 1.5 + optKeys * 0.5) / (8 * d)),
      reason: `${n("windows")} windows, ${n("bays") + n("arches")} bays/arches, ${optKeys} exterior options set`,
    },
    gardens: {
      proc: clamp01((gardenZones + n("paths") * 0.5) / (2 * d)),
      reason: `${gardenZones} garden zones, ${n("paths")} paths`,
    },
    lighting: { proc: null, relevant: outdoorSurfaces + n("driveways") + n("paths") + buildings.length >= 2, reason: "the design has outdoor surfaces but the library has no lighting assets" },
    vegetation: {
      proc: clamp01((n("landscaping") + n("slopes") * 0.5 + n("rocks") * 0.25 + n("paths") * 0.25) / (3 * d)),
      reason: `${n("landscaping")} planted zones`,
    },
    materials: {
      proc: clamp01((optKeys * 0.5 + optAssets * 1.5) / (4 * d)),
      reason: `${optKeys} finish options and ${optAssets} imported material overrides`,
    },
    views: {
      relevant: settings !== undefined,
      proc: view ? 0.3 + 0.7 * clamp01(viewAligned / 2) : 0.2,
      reason: `${round1(viewAligned)} openings and outdoor spaces face the ${typeof view === "string" ? view : "unspecified"} view`,
    },
    terrain: {
      relevant: terrainWanted > 0 || settings?.environment === "hillside" || settings?.environment === "cliff",
      proc: clamp01(terrainFeatures / Math.max(terrainWanted, 2)),
      reason: `${round1(terrainFeatures)} terrain features on a ${typeof slope === "string" ? slope : "sloping"} site`,
    },
    furniture: { proc: null, relevant: n("patios") + n("decks") + n("pools") + n("porches") > 0, reason: "outdoor spaces are drawn empty and the library has no furniture" },
  };

  return (Object.keys(reads) as DesignArea[]).map((area) => {
    const { proc, relevant = true, reason } = reads[area];
    const lib = coverage(area, facts, ctx);
    // The library can only lift a thin procedural result, never lower a rich one.
    const score = proc === null ? lib : clamp01(proc + LIBRARY_WEIGHT * Math.max(0, lib - proc));
    return { area, relevant, score: Math.round(score * 100) / 100, reason };
  });
}

/** The relevant areas that fell below the weak threshold. */
export const weakAreas = (scores: readonly AreaScore[]): AreaScore[] => scores.filter((s) => s.relevant && s.score < WEAK_AREA_SCORE);
