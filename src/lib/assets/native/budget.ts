import { FAMILY_DEFAULTS } from "./families";
import { latticeLayout, type PrimitiveContext } from "./primitives";
import { minThickness, type AssetPart, type AssetSpec } from "./spec";
import { bevelRadius, DETAIL_LEVELS, STYLE_PROFILE, type DetailLevel } from "./styleProfile";

/**
 * Triangle-budget awareness. Every primitive has a deterministic cost (a pure function of its parameters and the detail
 * level, mirroring `primitives.ts` exactly), so a spec's triangle count is known BEFORE anything is built. When a spec is
 * over budget the builder does not fail: it walks a fixed ladder of reductions that protect the silhouette first —
 *
 *   thin repeated slats / ribs (span and fill ratio preserved) → square-edge the small parts (a bevel on a 2 cm slat is
 *   invisible at game distance) → only then give up bevel and facet polish (lower detail) → thinner still.
 *
 * A model that underestimates its geometry therefore gets a slightly sparser asset, not an error.
 */

export interface BuildPlan {
  detail: DetailLevel;
  /** Multiplier on repeated slat / rib / band counts. */
  density: number;
  /** Boxes with a smallest edge under this (m) are built square-edged. */
  flatBelow?: number;
  leanCushion: boolean;
}

/** Small parts below this (m) lose their bevel when the budget demands it. */
export const FLAT_BELOW = 0.045;
/** Repeated parts thinner than this are "fine detail" (slats, rungs, fins) and may be thinned; structural parts are never. */
const FINE_PART = 0.05;

const boxCost = (s: number) => 12 + 24 * s + 8 * s * s;
const edgeSegs = (d: DetailLevel) => STYLE_PROFILE.edgeSegments[d];
const radialSegs = (d: DetailLevel) => STYLE_PROFILE.radialSegments[d];
/** Side walls of every outline edge for each extrusion layer, plus both caps. */
const extrudeCost = (outlinePoints: number, bevelSegments: number) => 2 * outlinePoints * (2 * bevelSegments + 1) + 2 * (outlinePoints - 2);

/** Triangles of one instance of `part` (a slatArray counts all its slats; repeat / mirror are applied by the caller). */
export function partTriangles(part: AssetPart, ctx: Pick<PrimitiveContext, "detail" | "flatBelow" | "leanCushion">): number {
  const s = edgeSegs(ctx.detail);
  const box = (size: readonly number[]) => (ctx.flatBelow !== undefined && Math.min(...size) < ctx.flatBelow ? 12 : boxCost(s));
  switch (part.primitive) {
    case "box": case "panel": return box(part.size);
    case "cushion": return boxCost(s + (ctx.leanCushion ? 0 : 2));
    case "slatArray": return part.count * box(part.slatSize);
    case "cylinder": case "taperedCylinder": return (2 * s + 5) * radialSegs(ctx.detail) * 2;
    case "roundedRect": {
      // The builder rounds the outline by the corner radius minus the edge bevel; nothing is left to round below 1 mm.
      const rounded = part.cornerRadius - bevelRadius(Math.min(part.width, part.depth, part.height)) >= 1e-3;
      return extrudeCost(rounded ? 4 * (Math.max(2, s * 3) + 1) : 4, s);
    }
    case "tube": {
      const ring = ctx.detail === "low" ? 5 : ctx.detail === "medium" ? 8 : 12;
      const segments = Math.max(2, (part.path.length - 1) * (s + 2));
      return 2 * segments * ring + 2 * 4 * ring;
    }
    case "curvedSurface": {
      const n = Math.max(6, Math.ceil(part.arcDegrees / (ctx.detail === "low" ? 18 : ctx.detail === "medium" ? 10 : 6)));
      return extrudeCost(2 * (n + 1), s);
    }
    case "lattice": {
      const { sides, ringSegs, profileSegs, rings } = latticeLayout(part, ctx);
      if (part.form === "panel") return (part.ribs + part.bands) * 2 * sides + 4 * (2 * sides + 2 * (sides - 2));
      return part.ribs * profileSegs * 2 * sides + rings * ringSegs * 2 * sides;
    }
  }
}

export const mirrorFactor = (p: Pick<AssetPart, "mirror">) => (p.mirror === "xz" ? 4 : p.mirror ? 2 : 1);

/** Total triangles of a spec's parts (repeat and mirror included) under `plan`, before anything is built. */
export function estimateTriangles(parts: readonly AssetPart[], plan: Pick<BuildPlan, "detail" | "flatBelow" | "leanCushion">): number {
  return parts.reduce((n, p) => n + partTriangles(p, plan) * (p.repeat?.count ?? 1) * mirrorFactor(p), 0);
}

// ── Thinning ────────────────────────────────────────────────────────────────

const target = (count: number, density: number, cap: number | undefined) => {
  const wanted = Math.min(Math.round(count * density), cap ?? Infinity);
  return Math.min(count, Math.max(Math.min(count, 3), wanted));
};

/** Fewer, proportionally wider strands over the same span: `n` pitches replace `count`, keeping the fill ratio. */
function thinSlats(p: Extract<AssetPart, { primitive: "slatArray" }>, n: number): AssetPart {
  const a = { x: 0, y: 1, z: 2 }[p.axis];
  const s = p.slatSize[a];
  const span = p.count * s + (p.count - 1) * p.gap;
  const fill = s / (s + p.gap);
  const pitch = span / (n - (1 - fill));
  const slatSize = [...p.slatSize] as [number, number, number];
  slatSize[a] = fill * pitch;
  return { ...p, count: n, slatSize, gap: (1 - fill) * pitch };
}

export interface ThinOptions {
  density: number;
  /** Family cap on slats per array / fine repeated part. */
  maxSlats?: number;
}

/** Thins repeated slats, fine repeats and lattice grids, preserving each part's overall extent. Returns the same parts when nothing changed. */
export function thinParts(parts: readonly AssetPart[], { density, maxSlats }: ThinOptions): AssetPart[] {
  return parts.map((p) => {
    if (p.primitive === "slatArray") {
      const n = target(p.count, density, maxSlats);
      return n < p.count ? thinSlats(p, n) : p;
    }
    if (p.primitive === "lattice") {
      const ribs = Math.min(p.ribs, Math.max(Math.min(p.ribs, p.form === "panel" ? 3 : 6), Math.round(p.ribs * density)));
      const bands = Math.min(p.bands, Math.max(Math.min(p.bands, 2), Math.round(p.bands * density)));
      if (ribs === p.ribs && bands === p.bands) return p;
      return { ...p, ribs, bands, strand: Math.min(0.1, p.strand * Math.min(1.5, Math.sqrt(p.ribs / ribs))) };
    }
    if (p.repeat && minThickness(p) <= FINE_PART) {
      const n = target(p.repeat.count, density, maxSlats);
      if (n >= p.repeat.count) return p;
      const k = (p.repeat.count - 1) / (n - 1);
      return { ...p, repeat: { count: n, step: p.repeat.step.map((v) => v * k) as [number, number, number] } };
    }
    return p;
  });
}

// ── The reduction ladder ────────────────────────────────────────────────────

/** Detail asked for by the spec, held to the family's cap (deck chairs and loungers are medium-detail props). */
export function effectiveDetail(spec: Pick<AssetSpec, "family" | "detailLevel">): DetailLevel {
  const cap = FAMILY_DEFAULTS[spec.family]?.maxDetail;
  return cap && DETAIL_LEVELS.indexOf(cap) < DETAIL_LEVELS.indexOf(spec.detailLevel) ? cap : spec.detailLevel;
}

/**
 * Plans to try, best first. Density comes down before detail does (silhouette first); detail drops only once density and
 * small-part bevels have been spent.
 */
export function buildLadder(detail: DetailLevel): BuildPlan[] {
  const lower = DETAIL_LEVELS.slice(0, DETAIL_LEVELS.indexOf(detail)).reverse();
  const plans: BuildPlan[] = [
    { detail, density: 1, leanCushion: false },
    { detail, density: 0.75, leanCushion: false },
    { detail, density: 0.55, leanCushion: false },
    { detail, density: 0.55, flatBelow: FLAT_BELOW, leanCushion: false },
    { detail, density: 0.4, flatBelow: FLAT_BELOW, leanCushion: true },
    ...lower.map((d) => ({ detail: d, density: 0.55, flatBelow: FLAT_BELOW, leanCushion: true })),
    { detail: "low" as DetailLevel, density: 0.35, flatBelow: FLAT_BELOW, leanCushion: true },
  ];
  // The same plan can appear twice (e.g. requested detail is already "low"): keep the first.
  return plans.filter((p, i) => plans.findIndex((q) => q.detail === p.detail && q.density === p.density && q.flatBelow === p.flatBelow && q.leanCushion === p.leanCushion) === i);
}

export function describePlan(plan: BuildPlan, requested: DetailLevel): string | null {
  const bits: string[] = [];
  if (plan.density < 1) bits.push(`thinned repeated slats and ribs to ${Math.round(plan.density * 100)}% (overall extent kept)`);
  if (plan.flatBelow !== undefined) bits.push("built parts under 4.5 cm square-edged");
  if (plan.detail !== requested) bits.push(`dropped detail from ${requested} to ${plan.detail}`);
  return bits.length ? `To fit ${STYLE_PROFILE.triangleBudget[plan.detail]} triangles: ${bits.join(", ")}.` : null;
}

// ── What the model is told ──────────────────────────────────────────────────

const probe = (part: Record<string, unknown>) => part as unknown as AssetPart;

/** Compact cost table for the system prompt, computed from the real estimator so it can never go stale. */
export function costGuidance(): string {
  const at = (f: (d: DetailLevel) => number) => `${f("medium")} [${f("low")}/${f("high")}]`;
  const ctx = (detail: DetailLevel) => ({ detail, leanCushion: false });
  const cost = (part: Record<string, unknown>) => (d: DetailLevel) => partTriangles(probe(part), ctx(d));
  const box = cost({ primitive: "box", size: [0.1, 0.1, 0.1] });
  const flat = partTriangles(probe({ primitive: "box", size: [0.02, 0.06, 0.5] }), { detail: "medium", flatBelow: FLAT_BELOW, leanCushion: false });
  const cushion = cost({ primitive: "cushion", size: [0.5, 0.1, 0.5] });
  const cyl = cost({ primitive: "cylinder", radius: 0.1, height: 0.2 });
  const round = cost({ primitive: "roundedRect", width: 0.6, depth: 0.4, height: 0.05, cornerRadius: 0.06 });
  const tube = cost({ primitive: "tube", path: [[0, 0, 0], [0, 0.3, 0]], radius: 0.015 });
  const curved = cost({ primitive: "curvedSurface", radius: 0.3, arcDegrees: 90, height: 0.4, thickness: 0.03 });
  const shade = cost({ primitive: "lattice", form: "dome", radiusBottom: 0.25, height: 0.3, ribs: 16, bands: 5, strand: 0.02, weave: true });
  const basket = cost({ primitive: "lattice", form: "tapered", radiusBottom: 0.18, radiusTop: 0.24, height: 0.4, ribs: 16, bands: 6, strand: 0.025, weave: true });
  const panel = cost({ primitive: "lattice", form: "panel", width: 0.5, height: 0.5, ribs: 10, bands: 8, strand: 0.025, weave: true });
  return `TRIANGLE COSTS per part at "medium" [low/high] — your asset must fit ${STYLE_PROFILE.triangleBudget.medium} at medium (${STYLE_PROFILE.triangleBudget.low} low, ${STYLE_PROFILE.triangleBudget.high} high):
- beveled box / panel ${at(box)} (an edge under ${FLAT_BELOW * 100} cm is built square-edged at ${flat} when the budget is tight)
- slatArray = count × box (24 slats ≈ ${24 * flat}-${24 * box("medium")}); cushion ${at(cushion)}; cylinder / taperedCylinder ${at(cyl)}
- roundedRect ≈ ${at(round)}; tube ≈ ${at(tube)} per 2 points; curvedSurface ≈ ${at(curved)}
- lattice: dome shade ≈ ${at(shade)}, basket / drum ≈ ${at(basket)}, flat woven panel ≈ ${at(panel)}
- multiply by repeat count and by mirror (x or z ×2, xz ×4). A bare frame is ~500-1,500; each cushion adds ~240.
The builder thins repeated slats / ribs and square-edges small parts to fit, keeping the silhouette, so an overshoot is not fatal — but design economically: silhouette first, then a few readable details. Deck chairs and loungers: at most 8-10 slats per array.`;
}
