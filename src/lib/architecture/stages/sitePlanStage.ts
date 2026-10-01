import type { PatchOp } from "@/lib/house/applyPatch";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import { runStage, type RunStageResult } from "./runStage";
import { routePathAroundMasses } from "@/lib/architecture/sitePathRouting";
import type { MassFootprint } from "@/lib/architecture/massFootprint";
import { clampNearBound } from "./numericNormalization";
import { geometricGraphErrors, LUXURY_OUTDOOR_RATIOS, luxuryOutdoorCompositionErrors, SITE_COLLISION_TOLERANCE_M, sitePlanCollisionErrors, sitePlanConnected, sitePlanNumericLimits, sitePlanSchema, sitePlanSchemaErrors, snapSitePlanPathEndpoints, type SitePlan, type SitePlanContext } from "@/lib/architecture/sitePlanContract";
export { geometricGraphErrors, luxuryOutdoorCompositionErrors, sitePlanSchema, snapSitePlanPathEndpoints, type SitePlan, type SitePlanContext } from "@/lib/architecture/sitePlanContract";

/** The executable geometry contract: frames and units in words, every enforced numeric range read from the schema. */
const CONTRACT = `GEOMETRY CONTRACT (all values in metres unless stated):
- World frame: x grows east, z grows south (north is −z).
- entrance, driveway, pool and terrace are wall-anchored: \`offset\` is measured ALONG the named wall from its start corner — the west corner of a north/south wall, the north corner of an east/west wall — to the feature's near edge, so it spans offset → offset + width (the entrance is the single point at offset). It is NOT measured from the wall's centre. offset 0 = flush with the start corner; it is never negative. To centre a feature of width w on a wall of length L, use offset (L − w) / 2. A wall-anchored feature cannot start before its start corner: to sit further that way use offset 0 or attach it to another wall. Pool \`distance\` is the gap from the wall to the pool's near edge; the terrace starts at the wall.
- parking, poolDeck, landscape and features are rectangles given by their CENTRE (x, z), width along x and depth along z (features: before rotation, rotation in degrees).
- Every number must lie inside its range; these are the minimums and maximums of the executable geometry, not suggestions:
${sitePlanNumericLimits()}
- Landscape zones are at least 2 m in BOTH width and depth: author a hedge or planting strip at 2 m or more. A feature's width/depth is its whole ground footprint including standing/service space (an outdoor bar is ~6 × 3 m, never a counter-only 0.85 m).
- No feature may run more than ${SITE_COLLISION_TOLERANCE_M} m into a building mass, and the pool must not overlap the driveway or parking.
- For a luxury villa/estate brief with indoor-outdoor living, the pool area must be at least ${LUXURY_OUTDOOR_RATIOS.poolToHouse * 100}% of the house footprint, the terrace and the pool deck each at least ${LUXURY_OUTDOOR_RATIOS.surfaceToPool * 100}% of the pool area, with at least one pool-planting and one view-framing zone.`;

const SYSTEM = `You are the landscape architect for an executable residential site plan. Author exact geometry; do not leave placement to a later system. The graph MUST be connected by explicit paths: arrival → parking → entrance → outdoor-living terrace → pool. Put driveway, parking and entry on arrival; put terrace, pool and deck on the view side. For a luxury villa with strong indoor-outdoor living, compose a substantial pool proportionate to the house, a generous usable pool deck, a separate usable outdoor-living terrace, and pool-planting plus view-framing; do not make token-sized water or paving. Give every planting zone one purpose: privacy, entrance-planting, pool-planting or view-framing. Cars will be placed only inside your parking areas. Return all required objects.

${CONTRACT}`;

/** Where each wall's `offset` 0 is in this house's world frame, so the model can compute offsets instead of guessing them. */
function wallFrameLine(house: SitePlanContext["house"]): string {
  const cx = house.center?.x ?? 0, cz = house.center?.z ?? 0;
  return `Wall frame: north/south walls are ${house.width}m long, offset 0 at x = ${(cx - house.width / 2).toFixed(2)} (west corner), increasing east; east/west walls are ${house.depth}m long, offset 0 at z = ${(cz - house.depth / 2).toFixed(2)} (north corner), increasing south. North wall at z = ${(cz - house.depth / 2).toFixed(2)}, south wall at z = ${(cz + house.depth / 2).toFixed(2)}, west wall at x = ${(cx - house.width / 2).toFixed(2)}, east wall at x = ${(cx + house.width / 2).toFixed(2)}.`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const clamp = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : value;
/** Rounding-scale overshoot only (see `clampNearBound`); a wildly wrong size stays invalid and is still reported. */
const nearBound = (value: unknown, min: number, max: number) => clampNearBound(value, min, max) ?? value;
/**
 * Offsets run 0..80 m along a wall from its start corner. A negative one is left as authored: clamping it to 0 moved a
 * live driveway 4.5 m from where the model placed it, so it stays invalid and the model repairs it from the diagnostic.
 */
const offset = (value: unknown) => typeof value === "number" && value < 0 ? value : nearBound(value, 0, 80);
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
 * cost a repair call or discard the plan. Covers bends and path widths (clamped) and near-bound rounding on
 * sizes and the upper offset bound — never a negative offset, which the model corrects. It deliberately never
 * touches walls, node/edge labels, or x/z coordinates: the schema plus connected/geometric validation still reject any real site-graph fault,
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

/** Everything that makes an authored plan unusable as the canonical V2 Site Plan — the stage's repair requests, and the final gate's blocking findings. */
export function sitePlanIntegrityErrors(plan: SitePlan, ctx: SitePlanContext): string[] {
  const errors = sitePlanConnected(plan) ? [] : ["Paths must connect arrival, parking, entrance, outdoor-living and pool as one graph."];
  return [...errors, ...geometricGraphErrors(plan, ctx), ...sitePlanCollisionErrors(plan, ctx)];
}

/**
 * The canonical V2 Site Plan is authored here or not at all: a failed result (after the stage's one repair
 * attempt) means the generation is incomplete — the caller must never fall back to legacy deterministic site
 * design for it. Deterministic work is bounded numeric normalization, endpoint snapping (`normalizeSitePlan`)
 * and obstacle routing at execution (`sitePlanOperations`).
 */
/** Site Plan's initial output allowance (reasoning + JSON). 1800 was exhausted repeatedly in production before any usable JSON. */
export const SITE_PLAN_MAX_OUTPUT_TOKENS = 4000;

export async function runSitePlanStage(ctx: SitePlanContext, timings: Timings, remainingBudgetMs: number, usageMeta: UsageMeta): Promise<RunStageResult<SitePlan>> {
  return runStage({ stageName: "site-plan", system: SYSTEM, schema: sitePlanSchema, timings, remainingBudgetMs, usageMeta, maxOutputTokens: SITE_PLAN_MAX_OUTPUT_TOKENS, normalize: (raw) => normalizeSitePlan(raw, ctx),
    buildMessage: (errors) => [`BRIEF:\n${ctx.brief}`, `House: ${ctx.house.width}×${ctx.house.depth}m, ${ctx.house.floors} floor(s)${ctx.house.center ? `, centred at world (${ctx.house.center.x.toFixed(2)}, ${ctx.house.center.z.toFixed(2)}); wall offsets and distances are measured from this footprint` : ""}. View=${ctx.viewDirection}; arrival=${ctx.arrivalDirection}.`, wallFrameLine(ctx.house),
      ctx.masses && ctx.masses.length > 1 ? `Building masses (world centre, width×depth, yaw°) — keep all site geometry off them: ${ctx.masses.map((m) => `${m.id} (${m.cx.toFixed(1)}, ${m.cz.toFixed(1)}) ${m.width.toFixed(1)}×${m.depth.toFixed(1)} ${Math.round((m.rotation * 180) / Math.PI)}°`).join("; ")}.` : "", ctx.entrancePoints?.length ? `Actual V2 entrance door centre(s), in world x/z metres: ${ctx.entrancePoints.map((p) => `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).join(", ")}. The entrance path must end at one of these.` : "", errors.length ? `Correct: ${errors.join("; ")}` : ""].filter(Boolean).join("\n\n"),
    // Diagnosed on the normalized value, so a repair names only what normalization did not already settle.
    schemaError: (raw) => sitePlanSchemaErrors(normalizeSitePlan(raw)),
    validate: (plan) => [...sitePlanIntegrityErrors(plan, ctx), ...luxuryOutdoorCompositionErrors(plan, ctx)],
  });
}
