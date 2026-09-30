import { z } from "zod";
import type { CompassSide } from "@/types/house";
import { insideMass, massHalfExtents, type MassFootprint } from "./massFootprint";
import { routePathAroundMasses } from "./sitePathRouting";
import { pathCurve } from "@/lib/house/features/paths";

/** Browser-safe Site Plan contract and geometry checks. No AI, database, or stage dependencies. */
const side = z.enum(["north", "south", "east", "west"]);
const driveway = z.object({ wall: side, offset: z.number().min(0).max(80), width: z.number().min(2.5).max(8), length: z.number().min(6).max(60), bend: z.number().min(-20).max(20).optional() });
const parking = z.object({ x: z.number().min(-100).max(100), z: z.number().min(-100).max(100), width: z.number().min(2.5).max(40), depth: z.number().min(4.5).max(40) });
const pool = z.object({ wall: side, offset: z.number().min(0).max(80), distance: z.number().min(1).max(40), width: z.number().min(3).max(30), depth: z.number().min(2).max(20), waterDepth: z.number().min(.8).max(3), shape: z.enum(["rectangle", "rounded", "oval", "kidney"]).optional() });
const patio = z.object({ wall: side, offset: z.number().min(0).max(80), width: z.number().min(3).max(40), depth: z.number().min(2).max(20) });
const path = z.object({ from: z.enum(["arrival", "parking", "entrance", "outdoor-living", "pool"]), to: z.enum(["arrival", "parking", "entrance", "outdoor-living", "pool"]), x1: z.number().min(-100).max(100), z1: z.number().min(-100).max(100), x2: z.number().min(-100).max(100), z2: z.number().min(-100).max(100), width: z.number().min(.8).max(4), bend: z.number().min(-20).max(20), surface: z.enum(["gravel", "flagstone", "dirt", "boardwalk"]) });
const landscape = z.object({ purpose: z.enum(["privacy", "entrance-planting", "pool-planting", "view-framing"]), kind: z.enum(["garden", "lawn", "clearing"]), x: z.number().min(-100).max(100), z: z.number().min(-100).max(100), width: z.number().min(2).max(40), depth: z.number().min(2).max(40) });

/** Ground-level additions owned by a V2 Site Plan, never by legacy building geometry. */
export const siteFeatureSchema = z.object({
  id: z.string().min(1).max(100), kind: z.enum(["outdoor_bar"]),
  x: z.number().min(-100).max(100), z: z.number().min(-100).max(100),
  width: z.number().min(2).max(12), depth: z.number().min(2).max(8),
  rotation: z.number().min(-360).max(360).default(0), assetId: z.string().min(1).max(80).optional(),
});
export type V2SiteFeature = z.infer<typeof siteFeatureSchema>;

export const sitePlanSchema = z.object({
  entrance: z.object({ wall: side, offset: z.number().min(0).max(80) }), driveway, parking: z.array(parking).min(1).max(3), pool, terrace: patio,
  poolDeck: z.object({ x: z.number().min(-100).max(100), z: z.number().min(-100).max(100), width: z.number().min(3).max(40), depth: z.number().min(2).max(20), shape: z.enum(["rectangle", "rounded", "oval", "arc"]).optional() }),
  paths: z.array(path).min(4).max(8), landscape: z.array(landscape).min(2).max(8),
  // Optional for backwards-compatible reading of existing persisted V2 plans; writers always emit it.
  features: z.array(siteFeatureSchema).max(30).optional(),
});
export type SitePlan = z.infer<typeof sitePlanSchema>;
export interface SitePlanContext {
  brief: string;
  /**
   * The volume wall/offset features are authored against. `center` is its world centre (absent = the origin); the
   * renderer anchors those features at the same place (see HouseConfig.center), so authored and executed geometry agree.
   */
  house: { width: number; depth: number; floors: number; center?: { x: number; z: number } };
  viewDirection: CompassSide; arrivalDirection: CompassSide;
  entrancePoints?: readonly { x: number; z: number }[];
  /** Every V2 building mass, in world coordinates: site geometry is executed around them. */
  masses?: readonly MassFootprint[];
}

type Point = { x: number; z: number };
function wallPoint(house: SitePlanContext["house"], wall: z.infer<typeof side>, offset: number, out = 0): Point {
  const cx = house.center?.x ?? 0, cz = house.center?.z ?? 0;
  switch (wall) {
    case "north": return { x: cx - house.width / 2 + offset, z: cz - house.depth / 2 - out };
    case "south": return { x: cx - house.width / 2 + offset, z: cz + house.depth / 2 + out };
    case "east": return { x: cx + house.width / 2 + out, z: cz - house.depth / 2 + offset };
    case "west": return { x: cx - house.width / 2 - out, z: cz - house.depth / 2 + offset };
  }
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * The executable attachment point for each named site geometry. These points are
 * deliberately derived from the authored features; snapping a path to one never
 * moves, resizes, or otherwise redesigns the driveway, parking, terrace, or pool.
 */
function siteGeometryAttachmentPoints(plan: SitePlan, ctx: SitePlanContext): Record<z.infer<typeof path>["from"], Point> {
  const parking = plan.parking[0];
  const entrance = ctx.entrancePoints?.length
    ? ctx.entrancePoints
    : [wallPoint(ctx.house, plan.entrance.wall, plan.entrance.offset)];
  return {
    arrival: wallPoint(ctx.house, plan.driveway.wall, plan.driveway.offset + plan.driveway.width / 2, plan.driveway.length),
    parking: { x: parking.x, z: parking.z },
    // A V2 door is the physical entrance geometry. For legacy plans, the authored
    // wall/offset point remains its only valid attachment point.
    entrance: entrance[0],
    "outdoor-living": wallPoint(ctx.house, plan.terrace.wall, plan.terrace.offset + plan.terrace.width / 2, plan.terrace.depth),
    pool: wallPoint(ctx.house, plan.pool.wall, plan.pool.offset + plan.pool.width / 2, plan.pool.distance + plan.pool.depth / 2),
  };
}

/**
 * Snaps only a path whose declared endpoints resolve to existing Site Plan
 * geometries. The path's route, all site features, and invalid/missing references
 * are preserved for normal schema/semantic failure handling.
 */
export function snapSitePlanPathEndpoints(plan: SitePlan, ctx: SitePlanContext): SitePlan {
  const anchors = siteGeometryAttachmentPoints(plan, ctx);
  return {
    ...plan,
    paths: plan.paths.map((edge) => {
      const from = anchors[edge.from];
      const to = anchors[edge.to];
      // `from`/`to` are closed schema enums, so both exist for a parsed plan. Keep
      // this guard for callers that may construct a typed value unsafely.
      if (!from || !to) return edge;
      const entranceCandidates = ctx.entrancePoints;
      const snappedFrom = edge.from === "entrance" && entranceCandidates?.length
        ? entranceCandidates.reduce((best, point) => distance(point, { x: edge.x1, z: edge.z1 }) < distance(best, { x: edge.x1, z: edge.z1 }) ? point : best)
        : from;
      const snappedTo = edge.to === "entrance" && entranceCandidates?.length
        ? entranceCandidates.reduce((best, point) => distance(point, { x: edge.x2, z: edge.z2 }) < distance(best, { x: edge.x2, z: edge.z2 }) ? point : best)
        : to;
      return { ...edge, x1: snappedFrom.x, z1: snappedFrom.z, x2: snappedTo.x, z2: snappedTo.z };
    }),
  };
}

export function geometricGraphErrors(plan: SitePlan, ctx: SitePlanContext): string[] {
  const nodes = siteGeometryAttachmentPoints(plan, ctx);
  const errors: string[] = [];
  for (const [from, to] of [["arrival", "parking"], ["parking", "entrance"], ["entrance", "outdoor-living"], ["outdoor-living", "pool"]] as const) {
    const edge = plan.paths.find((p) => p.from === from && p.to === to);
    if (!edge) errors.push(`Missing required ${from} → ${to} path.`);
    else if (distance({ x: edge.x1, z: edge.z1 }, nodes[from]) > 5 || distance({ x: edge.x2, z: edge.z2 }, nodes[to]) > 5) errors.push(`${from} → ${to} path endpoints do not connect to their authored geometry.`);
  }
  return errors;
}

/**
 * A luxury villa explicitly asking for strong indoor-outdoor living needs a pool and connected living surfaces that read at
 * the scale of its house. These are proportional minimums, not a replacement design: an accepted authored plan remains
 * untouched, while an undersized one is returned to the authoring stage as a validation error.
 */
export function luxuryOutdoorCompositionErrors(plan: SitePlan, ctx: SitePlanContext): string[] {
  const brief = ctx.brief.toLowerCase();
  const luxuryVilla = /\b(luxury|estate|resort)\b/.test(brief) && /\b(villa|residence|home|house)\b/.test(brief);
  const indoorOutdoor = /indoor[\s-]*outdoor|outdoor[\s-]*living|covered terrace|pool[\s-]*(?:side|deck|terrace)/.test(brief);
  if (!luxuryVilla || !indoorOutdoor) return [];

  const houseArea = ctx.house.width * ctx.house.depth;
  const poolArea = plan.pool.width * plan.pool.depth;
  const terraceArea = plan.terrace.width * plan.terrace.depth;
  const deckArea = plan.poolDeck.width * plan.poolDeck.depth;
  const errors: string[] = [];
  if (poolArea < houseArea * 0.1) errors.push(`Luxury indoor-outdoor brief needs a substantial pool: ${poolArea.toFixed(1)}m² is under 10% of the ${houseArea.toFixed(1)}m² house footprint.`);
  if (terraceArea < poolArea * 0.7) errors.push(`Outdoor-living terrace must be usable with the pool: ${terraceArea.toFixed(1)}m² is under 70% of pool area ${poolArea.toFixed(1)}m².`);
  if (deckArea < poolArea * 0.7) errors.push(`Pool deck must be usable around the pool: ${deckArea.toFixed(1)}m² is under 70% of pool area ${poolArea.toFixed(1)}m².`);
  if (!plan.landscape.some((zone) => zone.purpose === "pool-planting") || !plan.landscape.some((zone) => zone.purpose === "view-framing")) errors.push("Luxury pool composition needs both pool-planting and view-framing landscape zones.");
  return errors;
}

/** Every required node is reachable from arrival along the authored paths. */
export function sitePlanConnected(plan: SitePlan): boolean {
  const graph = new Map<string, Set<string>>();
  for (const p of plan.paths) { if (p.from === p.to) continue; (graph.get(p.from) ?? graph.set(p.from, new Set()).get(p.from)!).add(p.to); (graph.get(p.to) ?? graph.set(p.to, new Set()).get(p.to)!).add(p.from); }
  const seen = new Set(["arrival"]); let changed = true;
  while (changed) { changed = false; for (const node of [...seen]) for (const next of graph.get(node) ?? []) if (!seen.has(next)) { seen.add(next); changed = true; } }
  return ["parking", "entrance", "outdoor-living", "pool"].every((node) => seen.has(node));
}

export interface SiteRect { label: string; x0: number; x1: number; z0: number; z1: number }

/** Where a wall-anchored feature lies: `offset` along the wall from its west/north corner, `out`..`out + reach` away from it. */
function wallRect(label: string, house: SitePlanContext["house"], wall: z.infer<typeof side>, offset: number, span: number, out: number, reach: number): SiteRect {
  const a = wallPoint(house, wall, offset, out), b = wallPoint(house, wall, offset + span, out + reach);
  return { label, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
}
const centredRect = (label: string, r: { x: number; z: number; width: number; depth: number }): SiteRect => ({ label, x0: r.x - r.width / 2, x1: r.x + r.width / 2, z0: r.z - r.depth / 2, z1: r.z + r.depth / 2 });

/** The ground each authored site feature occupies, in world metres — the same frame the renderer executes it in. */
export function siteFeatureRects(plan: SitePlan, ctx: SitePlanContext): SiteRect[] {
  return [
    wallRect("driveway", ctx.house, plan.driveway.wall, plan.driveway.offset, plan.driveway.width, 0, plan.driveway.length),
    ...plan.parking.map((p, i) => centredRect(`parking ${i + 1}`, p)),
    wallRect("pool", ctx.house, plan.pool.wall, plan.pool.offset, plan.pool.width, plan.pool.distance, plan.pool.depth),
    wallRect("terrace", ctx.house, plan.terrace.wall, plan.terrace.offset, plan.terrace.width, 0, plan.terrace.depth),
    centredRect("pool deck", plan.poolDeck),
  ];
}

/** A site feature this far into a building (or into the pool) is a collision, not a shared edge. */
export const SITE_COLLISION_TOLERANCE_M = 0.5;
const rectPenetration = (a: Omit<SiteRect, "label">, b: Omit<SiteRect, "label">) => Math.min(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

/**
 * Major collisions in an authored plan, as executed: a feature standing inside a building mass, a pool under
 * the cars, or a path that still runs through a building after obstacle routing. Validation only — the plan is
 * returned to the Site Plan stage for repair (or blocks finalization); nothing is moved here.
 */
export function sitePlanCollisionErrors(plan: SitePlan, ctx: SitePlanContext): string[] {
  const errors: string[] = [];
  const masses = ctx.masses ?? [];
  const rects = siteFeatureRects(plan, ctx);
  for (const rect of rects) for (const mass of masses) {
    const { halfW, halfD } = massHalfExtents(mass);
    const depth = rectPenetration(rect, { x0: mass.cx - halfW, x1: mass.cx + halfW, z0: mass.cz - halfD, z1: mass.cz + halfD });
    if (depth > SITE_COLLISION_TOLERANCE_M) errors.push(`The ${rect.label} runs ${depth.toFixed(1)}m into building mass "${mass.id}". Move or resize it clear of the building.`);
  }
  const pool = rects.find((r) => r.label === "pool")!;
  for (const rect of rects.filter((r) => r.label === "driveway" || r.label.startsWith("parking"))) {
    const depth = rectPenetration(rect, pool);
    if (depth > SITE_COLLISION_TOLERANCE_M) errors.push(`The pool overlaps the ${rect.label} by ${depth.toFixed(1)}m. Keep water and vehicles apart.`);
  }
  for (const { from, to, ...path } of plan.paths) {
    const crosses = routePathAroundMasses(path, masses).some((segment) => pathCurve(segment).some((p) => masses.some((mass) => insideMass(mass, p[0], p[1], -SITE_COLLISION_TOLERANCE_M))));
    if (crosses) errors.push(`The ${from} → ${to} path cannot be carried around the building between its end points. Re-author its end points or route.`);
  }
  return errors;
}
