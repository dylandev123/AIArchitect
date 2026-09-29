import { z } from "zod";
import type { PatchOp } from "@/lib/house/applyPatch";
import type { CompassSide } from "@/types/house";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import { runStage, type RunStageResult } from "./runStage";

const side = z.enum(["north", "south", "east", "west"]);
const driveway = z.object({ wall: side, offset: z.number().min(0).max(80), width: z.number().min(2.5).max(8), length: z.number().min(6).max(60), bend: z.number().min(-20).max(20).optional() });
const parking = z.object({ x: z.number().min(-100).max(100), z: z.number().min(-100).max(100), width: z.number().min(2.5).max(40), depth: z.number().min(4.5).max(40) });
const pool = z.object({ wall: side, offset: z.number().min(0).max(80), distance: z.number().min(1).max(40), width: z.number().min(3).max(30), depth: z.number().min(2).max(20), waterDepth: z.number().min(.8).max(3), shape: z.enum(["rectangle", "rounded", "oval", "kidney"]).optional() });
const patio = z.object({ wall: side, offset: z.number().min(0).max(80), width: z.number().min(3).max(40), depth: z.number().min(2).max(20) });
const path = z.object({ from: z.enum(["arrival", "parking", "entrance", "outdoor-living", "pool"]), to: z.enum(["arrival", "parking", "entrance", "outdoor-living", "pool"]), x1: z.number().min(-100).max(100), z1: z.number().min(-100).max(100), x2: z.number().min(-100).max(100), z2: z.number().min(-100).max(100), width: z.number().min(.8).max(4), bend: z.number().min(-20).max(20), surface: z.enum(["gravel", "flagstone", "dirt", "boardwalk"]) });
const landscape = z.object({ purpose: z.enum(["privacy", "entrance-planting", "pool-planting", "view-framing"]), kind: z.enum(["garden", "lawn", "clearing"]), x: z.number().min(-100).max(100), z: z.number().min(-100).max(100), width: z.number().min(2).max(40), depth: z.number().min(2).max(40) });

export const sitePlanSchema = z.object({
  entrance: z.object({ wall: side, offset: z.number().min(0).max(80) }),
  driveway,
  parking: z.array(parking).min(1).max(3),
  pool,
  terrace: patio,
  poolDeck: z.object({ x: z.number().min(-100).max(100), z: z.number().min(-100).max(100), width: z.number().min(3).max(40), depth: z.number().min(2).max(20), shape: z.enum(["rectangle", "rounded", "oval", "arc"]).optional() }),
  paths: z.array(path).min(4).max(8),
  landscape: z.array(landscape).min(2).max(8),
});
export type SitePlan = z.infer<typeof sitePlanSchema>;

export interface SitePlanContext { brief: string; house: { width: number; depth: number; floors: number }; viewDirection: CompassSide; arrivalDirection: CompassSide; /** Grade-level V2 door centres in the same world x/z system as paths. */ entrancePoints?: readonly { x: number; z: number }[]; }

const SYSTEM = `You are the landscape architect for an executable residential site plan. Author exact geometry; do not leave placement to a later system. The graph MUST be connected by explicit paths: arrival → parking → entrance → outdoor-living terrace → pool. Put driveway, parking and entry on arrival; put terrace, pool and deck on the view side. Give every planting zone one purpose: privacy, entrance-planting, pool-planting or view-framing. Cars will be placed only inside your parking areas. Return all required objects.`;

export function sitePlanOperations(plan: SitePlan): PatchOp[] {
  return [
    { op: "addDriveway", value: plan.driveway },
    ...plan.parking.map((value) => ({ op: "addParking", value })),
    { op: "addPool", value: plan.pool },
    { op: "addPatio", value: plan.terrace },
    { op: "addDeck", value: { ...plan.poolDeck, level: 0 } },
    ...plan.paths.map(({ from: _from, to: _to, ...value }) => ({ op: "addPath", value })),
    ...plan.landscape.map(({ purpose, ...value }) => ({ op: "addLandscape", value: { ...value, purpose } })),
  ];
}

type Point = { x: number; z: number };
const wallPoint = (house: SitePlanContext["house"], wall: z.infer<typeof side>, offset: number, out = 0): Point => {
  switch (wall) {
    case "north": return { x: -house.width / 2 + offset, z: -house.depth / 2 - out };
    case "south": return { x: -house.width / 2 + offset, z: house.depth / 2 + out };
    case "east": return { x: house.width / 2 + out, z: -house.depth / 2 + offset };
    case "west": return { x: -house.width / 2 - out, z: -house.depth / 2 + offset };
  }
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Site Plan coordinates are renderer world coordinates: x=east, z=south, with the
 * V2 massing origin at (0,0).  Validate the authored graph geometrically here, before
 * Final Assembly can turn it into patch operations.
 */
export function geometricGraphErrors(plan: SitePlan, ctx: SitePlanContext): string[] {
  const house = ctx.house;
  const parking = plan.parking[0];
  const nodes: Record<string, Point> = {
    arrival: wallPoint(house, plan.driveway.wall, plan.driveway.offset + plan.driveway.width / 2, plan.driveway.length),
    parking: { x: parking.x, z: parking.z },
    entrance: wallPoint(house, plan.entrance.wall, plan.entrance.offset),
    "outdoor-living": wallPoint(house, plan.terrace.wall, plan.terrace.offset + plan.terrace.width / 2, plan.terrace.depth),
    pool: wallPoint(house, plan.pool.wall, plan.pool.offset + plan.pool.width / 2, plan.pool.distance + plan.pool.depth / 2),
  };
  const errors: string[] = [];
  if (ctx.entrancePoints?.length) {
    const semanticEntrance = nodes.entrance;
    const actual = ctx.entrancePoints.reduce((best, point) => distance(point, semanticEntrance) < distance(best, semanticEntrance) ? point : best);
    // `entrance.wall/offset` remains compatibility metadata for legacy consumers;
    // the physical graph endpoint is always the compiled V2 door.
    nodes.entrance = actual;
  }
  const chain: [string, string][] = [["arrival", "parking"], ["parking", "entrance"], ["entrance", "outdoor-living"], ["outdoor-living", "pool"]];
  for (const [from, to] of chain) {
    const edge = plan.paths.find((p) => p.from === from && p.to === to);
    if (!edge) { errors.push(`Missing required ${from} → ${to} path.`); continue; }
    // The endpoints may meet an edge rather than a centre, so allow a small, fixed
    // construction tolerance while still rejecting merely semantic labels.
    if (distance({ x: edge.x1, z: edge.z1 }, nodes[from]) > 5 || distance({ x: edge.x2, z: edge.z2 }, nodes[to]) > 5)
      errors.push(`${from} → ${to} path endpoints do not connect to their authored geometry.`);
  }
  return errors;
}

function connected(plan: SitePlan): boolean {
  const graph = new Map<string, Set<string>>();
  for (const p of plan.paths) { if (p.from === p.to) continue; (graph.get(p.from) ?? graph.set(p.from, new Set()).get(p.from)!).add(p.to); (graph.get(p.to) ?? graph.set(p.to, new Set()).get(p.to)!).add(p.from); }
  let seen = new Set(["arrival"]); let changed = true;
  while (changed) { changed = false; for (const node of [...seen]) for (const next of graph.get(node) ?? []) if (!seen.has(next)) { seen.add(next); changed = true; } }
  return ["parking", "entrance", "outdoor-living", "pool"].every((node) => seen.has(node));
}

export async function runSitePlanStage(ctx: SitePlanContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RunStageResult<SitePlan>> {
  return runStage({ stageName: "site-plan", system: SYSTEM, schema: sitePlanSchema, timings, remainingBudgetMs, usageMeta, maxOutputTokens: 1800,
    buildMessage: (errors) => [`BRIEF:\n${ctx.brief}`, `House: ${ctx.house.width}×${ctx.house.depth}m, ${ctx.house.floors} floor(s). View=${ctx.viewDirection}; arrival=${ctx.arrivalDirection}.`, ctx.entrancePoints?.length ? `Actual V2 entrance door centre(s), in world x/z metres: ${ctx.entrancePoints.map((p) => `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).join(", ")}. The entrance path must end at one of these.` : "", errors.length ? `Correct: ${errors.join("; ")}` : ""].filter(Boolean).join("\n\n"),
    validate: (plan) => {
      const errors = connected(plan) ? [] : ["Paths must connect arrival, parking, entrance, outdoor-living and pool as one graph."];
      return [...errors, ...geometricGraphErrors(plan, ctx)];
    },
  });
}
