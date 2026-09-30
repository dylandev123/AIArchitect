import type { PatchOp } from "@/lib/house/applyPatch";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import { runStage, type RunStageResult } from "./runStage";
import { routePathAroundMasses } from "@/lib/architecture/sitePathRouting";
import type { MassFootprint } from "@/lib/architecture/massFootprint";
import { clampNearBound } from "./numericNormalization";
import { geometricGraphErrors, sitePlanSchema, snapSitePlanPathEndpoints, type SitePlan, type SitePlanContext } from "@/lib/architecture/sitePlanContract";
export { geometricGraphErrors, sitePlanSchema, snapSitePlanPathEndpoints, type SitePlan, type SitePlanContext } from "@/lib/architecture/sitePlanContract";

const SYSTEM = `You are the landscape architect for an executable residential site plan. Author exact geometry; do not leave placement to a later system. The graph MUST be connected by explicit paths: arrival → parking → entrance → outdoor-living terrace → pool. Put driveway, parking and entry on arrival; put terrace, pool and deck on the view side. Give every planting zone one purpose: privacy, entrance-planting, pool-planting or view-framing. Cars will be placed only inside your parking areas. Return all required objects.`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const clamp = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : value;
/** Rounding-scale overshoot only (see `clampNearBound`); a wildly wrong size stays invalid and is still reported. */
const nearBound = (value: unknown, min: number, max: number) => clampNearBound(value, min, max) ?? value;
/** Offsets run along a wall from its corner: a negative one only means "flush with the corner", so it is always 0. */
const offset = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value < 0 ? 0 : nearBound(value, 0, 80);
const LANDSCAPE_PRIORITY = ["entrance-planting", "pool-planting", "privacy", "view-framing"] as const;

type Fixers = Record<string, (value: unknown) => unknown>;
function fix(value: unknown, fixers: Fixers): unknown {
  if (!isRecord(value)) return value;
  const out = { ...value };
  for (const [key, apply] of Object.entries(fixers)) if (key in out) out[key] = apply(out[key]);
  return out;
}
const size = (min: number, max: number) => (value: unknown) => nearBound(value, min, max);
const fixEach = (value: unknown, fixers: Fixers) => Array.isArray(value) ? value.map((entry) => fix(entry, fixers)) : value;

/**
 * Runs BEFORE strict schema validation (see `runStage`'s `normalize`), so harmless numeric range slips never
 * cost a repair call or discard the plan. Covers every wall/linear offset (negative → 0), bends and path
 * widths (clamped), and near-bound rounding on sizes. It deliberately never touches walls, node/edge labels,
 * or x/z coordinates: the schema plus connected/geometric validation still reject any real site-graph fault,
 * and that validation runs on the normalized geometry the renderer will actually receive.
 */
export function normalizeSitePlan(raw: unknown, ctx?: SitePlanContext): unknown {
  if (!isRecord(raw)) return raw;
  const plan: Record<string, unknown> = { ...raw };
  plan.entrance = fix(plan.entrance, { offset });
  plan.driveway = fix(plan.driveway, { offset, width: size(2.5, 8), length: size(6, 60), bend: (v) => clamp(v, -20, 20) });
  plan.pool = fix(plan.pool, { offset, distance: size(1, 40), width: size(3, 30), depth: size(2, 20), waterDepth: size(.8, 3) });
  plan.terrace = fix(plan.terrace, { offset, width: size(3, 40), depth: size(2, 20) });
  plan.poolDeck = fix(plan.poolDeck, { width: size(3, 40), depth: size(2, 20) });
  plan.parking = fixEach(plan.parking, { width: size(2.5, 40), depth: size(4.5, 40) });
  plan.paths = fixEach(plan.paths, { width: (v) => clamp(v, .8, 4), bend: (v) => clamp(v, -20, 20) });
  plan.landscape = fixEach(plan.landscape, { width: size(2, 40), depth: size(2, 40) });
  for (const key of ["entrance", "driveway", "pool", "terrace", "poolDeck", "parking", "paths", "landscape"]) if (plan[key] === undefined) delete plan[key];
  if (Array.isArray(plan.landscape) && plan.landscape.length > 8) {
    const ranked = plan.landscape.map((zone, index) => {
      const priority = isRecord(zone) ? LANDSCAPE_PRIORITY.indexOf(zone.purpose as typeof LANDSCAPE_PRIORITY[number]) : -1;
      return { zone, index, priority: priority < 0 ? LANDSCAPE_PRIORITY.length : priority };
    });
    ranked.sort((a, b) => a.priority - b.priority || a.index - b.index);
    plan.landscape = ranked.slice(0, 8).sort((a, b) => a.index - b.index).map((entry) => entry.zone);
  }
  // A complete, semantically named graph gets its endpoints attached to the
  // geometries it already authored. Invalid/missing references never parse here,
  // and therefore remain validation failures rather than being invented locally.
  if (ctx) {
    const parsed = sitePlanSchema.safeParse(plan);
    if (parsed.success) return snapSitePlanPathEndpoints(parsed.data, ctx);
  }
  return plan;
}

/**
 * The accepted plan as executable site operations, verbatim — except that a path whose line would cross one of the
 * building's `masses` is carried around it (see routePathAroundMasses); its authored end points are kept.
 */
export function sitePlanOperations(plan: SitePlan, masses: readonly MassFootprint[] = []): PatchOp[] {
  return [
    { op: "addDriveway", value: plan.driveway },
    ...plan.parking.map((value) => ({ op: "addParking", value })),
    { op: "addPool", value: plan.pool },
    { op: "addPatio", value: plan.terrace },
    { op: "addDeck", value: { ...plan.poolDeck, level: 0 } },
    ...plan.paths.flatMap(({ from: _from, to: _to, ...value }) => routePathAroundMasses(value, masses).map((segment) => ({ op: "addPath", value: { ...segment } }))),
    ...plan.landscape.map(({ purpose, ...value }) => ({ op: "addLandscape", value: { ...value, purpose } })),
  ];
}

function connected(plan: SitePlan): boolean {
  const graph = new Map<string, Set<string>>();
  for (const p of plan.paths) { if (p.from === p.to) continue; (graph.get(p.from) ?? graph.set(p.from, new Set()).get(p.from)!).add(p.to); (graph.get(p.to) ?? graph.set(p.to, new Set()).get(p.to)!).add(p.from); }
  const seen = new Set(["arrival"]); let changed = true;
  while (changed) { changed = false; for (const node of [...seen]) for (const next of graph.get(node) ?? []) if (!seen.has(next)) { seen.add(next); changed = true; } }
  return ["parking", "entrance", "outdoor-living", "pool"].every((node) => seen.has(node));
}

export async function runSitePlanStage(ctx: SitePlanContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RunStageResult<SitePlan>> {
  return runStage({ stageName: "site-plan", system: SYSTEM, schema: sitePlanSchema, timings, remainingBudgetMs, usageMeta, maxOutputTokens: 1800, normalize: (raw) => normalizeSitePlan(raw, ctx),
    buildMessage: (errors) => [`BRIEF:\n${ctx.brief}`, `House: ${ctx.house.width}×${ctx.house.depth}m, ${ctx.house.floors} floor(s)${ctx.house.center ? `, centred at world (${ctx.house.center.x.toFixed(2)}, ${ctx.house.center.z.toFixed(2)}); wall offsets and distances are measured from this footprint` : ""}. View=${ctx.viewDirection}; arrival=${ctx.arrivalDirection}.`,
      ctx.masses && ctx.masses.length > 1 ? `Building masses (world centre, width×depth, yaw°) — keep all site geometry off them: ${ctx.masses.map((m) => `${m.id} (${m.cx.toFixed(1)}, ${m.cz.toFixed(1)}) ${m.width.toFixed(1)}×${m.depth.toFixed(1)} ${Math.round((m.rotation * 180) / Math.PI)}°`).join("; ")}.` : "", ctx.entrancePoints?.length ? `Actual V2 entrance door centre(s), in world x/z metres: ${ctx.entrancePoints.map((p) => `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).join(", ")}. The entrance path must end at one of these.` : "", errors.length ? `Correct: ${errors.join("; ")}` : ""].filter(Boolean).join("\n\n"),
    validate: (plan) => {
      const errors = connected(plan) ? [] : ["Paths must connect arrival, parking, entrance, outdoor-living and pool as one graph."];
      return [...errors, ...geometricGraphErrors(plan, ctx)];
    },
  });
}
