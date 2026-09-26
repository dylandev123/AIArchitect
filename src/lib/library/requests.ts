import type { AssetRequest } from "@/types/library";
import { dedupeRequests, extractRequestsFromBrief, extractStyleTags, normalizeAssetRequest } from "./taxonomy";

/**
 * Which reusable visual assets a design asks for. Two sources: the freestanding buildings the generator placed
 * (a gazebo, an outdoor bar) and objects the brief names outright (a fire pit, a pergola). The procedural version
 * of each is already in the project; this only says what a library asset could later replace.
 */

/** Building kinds that are visually rich, reusable objects rather than architecture that must reshape to the house. */
const BUILDING_KIND_TEXT: Record<string, string> = {
  gazebo: "gazebo",
  outdoor_bar: "outdoor bar",
};

const POOLSIDE_RADIUS_M = 14;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** "caribbean-villa" -> ["tropical"], "modern-luxury" -> ["modern"]. */
export function styleTagsForProjectStyle(style: unknown): string[] {
  return typeof style === "string" ? extractStyleTags(style.replace(/-/g, " ")) : [];
}

/** Project-wide facts every building request reads: the style to inherit and where the pools are (for "poolside"). */
export interface RequestsContext {
  styleHint: string[];
  pools: { x: number; z: number }[];
}

export function requestsContext(root: unknown): RequestsContext {
  const styleHint = isRecord(root) && isRecord(root.exteriorOptions) ? styleTagsForProjectStyle(root.exteriorOptions.style) : [];
  const pools = (isRecord(root) && Array.isArray(root.pools) ? root.pools : []).filter(isRecord).flatMap((p) => {
    const x = num(p.siteX);
    const z = num(p.siteZ);
    return x !== undefined && z !== undefined ? [{ x, z }] : [];
  });
  return { styleHint, pools };
}

/** The asset request one building implies, or null when its kind is not a reusable object. */
export function requestForBuilding(b: Record<string, unknown>, ctx: RequestsContext, projectId: string | null): AssetRequest | null {
  const text = typeof b.kind === "string" ? BUILDING_KIND_TEXT[b.kind] : undefined;
  if (!text) return null;
  const req = normalizeAssetRequest(text, { styleHint: ctx.styleHint, dimensions: { width: num(b.width), depth: num(b.depth) }, projectId });
  if (!req) return null;
  const x = num(b.x);
  const z = num(b.z);
  if (x !== undefined && z !== undefined && ctx.pools.some((p) => Math.hypot(p.x - x, p.z - z) <= POOLSIDE_RADIUS_M) && !req.contextTags.includes("poolside")) {
    req.contextTags = [...req.contextTags, "poolside"];
  }
  return req;
}

export function requestsFromProject(json: string, brief: string, projectId: string | null): AssetRequest[] {
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch {
    return [];
  }
  const ctx = requestsContext(root);
  const out = extractRequestsFromBrief(brief, { styleHint: ctx.styleHint, projectId });
  if (!isRecord(root) || !Array.isArray(root.buildings)) return dedupeRequests(out);

  for (const b of root.buildings.filter(isRecord)) {
    const req = requestForBuilding(b, ctx, projectId);
    if (req) out.push(req);
  }
  return dedupeRequests(out);
}
