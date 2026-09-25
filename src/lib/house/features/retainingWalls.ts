import type { RetainingWallConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { RETAINING_WALL_LIMITS, SITE_POSITION_LIMIT } from "../constants";
import { box, hash01, shade } from "../architecture/parts";
import { extrudeBand, offsetPolyline, bowedCurve, polylineLength, samplesFor, triMeshOf, pointAlong, type P2 } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validateRetainingWall(raw: unknown): FeatureValidation<RetainingWallConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x1", "z1", "x2", "z2"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const pos = (v: number, field: string) => clampNumber(v, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, field, warnings);
  const x1 = pos(values.x1, "x1");
  const z1 = pos(values.z1, "z1");
  let x2 = pos(values.x2, "x2");
  const z2 = pos(values.z2, "z2");
  if (Math.hypot(x2 - x1, z2 - z1) < RETAINING_WALL_LIMITS.length.min) {
    warnings.push('"x2"/"z2" were nearly identical to "x1"/"z1" — extended the end point.');
    x2 = x1 + RETAINING_WALL_LIMITS.length.min;
  }
  const height = readNumber(o, "height", 1.2, RETAINING_WALL_LIMITS.height.min, RETAINING_WALL_LIMITS.height.max, warnings);
  const thickness = readNumber(o, "thickness", 0.4, RETAINING_WALL_LIMITS.thickness.min, RETAINING_WALL_LIMITS.thickness.max, warnings);
  const bend = readNumber(o, "bend", 0, RETAINING_WALL_LIMITS.bend.min, RETAINING_WALL_LIMITS.bend.max, warnings);
  return { value: { x1, z1, x2, z2, height, thickness, bend }, errors: [], warnings };
}

/** The wall's centre line — shared with the footprint code so trees keep clear of it. */
export function retainingWallCurve(config: RetainingWallConfig): P2[] {
  const a: P2 = [config.x1, config.z1];
  const b: P2 = [config.x2, config.z2];
  return bowedCurve(a, b, config.bend, samplesFor(Math.hypot(b[0] - a[0], b[1] - a[1]), 1.6, 3, 90));
}

const STONE = "#8a8478";
const BURIED = 0.45;

/**
 * A retaining wall: a stone band that follows a straight or bowed line, with a projecting coping and a buttress
 * pier every few metres on the low side. The wall stands on the ground at each end (it tracks the terrain).
 */
export function buildRetainingWall(config: RetainingWallConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const centre = retainingWallCurve(config);
  const half = config.thickness / 2;
  const left = offsetPolyline(centre, half);
  const right = offsetPolyline(centre, -half);
  const id = `retainingWall-${index}`;
  const label = `Retaining Wall ${index + 1}`;
  const g = ctx.groundAt;
  const top = (x: number, z: number) => g(x, z) + config.height;
  const bottom = (x: number, z: number) => g(x, z) - BURIED;
  const stone = { color: STONE, roughness: 0.92, metalness: 0.02 };

  const out: HousePrimitive[] = [
    triMeshOf(`${id}-wall`, "retainingWall", label, extrudeBand(left, right, bottom, top), stone),
    triMeshOf(`${id}-cap`, "retainingWall", `${label} Coping`, extrudeBand(offsetPolyline(centre, half + 0.07), offsetPolyline(centre, -half - 0.07), top, (x, z) => top(x, z) + 0.1), { color: shade(STONE, 1.18), roughness: 0.85, metalness: 0.02 }),
  ];

  // Buttress piers, spaced along the wall and jittered so the run doesn't look mechanical.
  const length = polylineLength(centre);
  if (config.height >= 1) {
    const count = Math.floor(length / 4.5);
    for (let i = 1; i <= count; i++) {
      const { p, tangent } = pointAlong(centre, (i - 0.5) / count);
      const rot = -Math.atan2(tangent[1], tangent[0]);
      const px = p[0] + tangent[1] * (half + 0.15);
      const pz = p[1] - tangent[0] * (half + 0.15);
      const h = config.height + 0.2 + (hash01(i + index * 7) - 0.5) * 0.06;
      out.push(box(`${id}-buttress-${i}`, "retainingWall", `${label} Buttress`, [px, g(px, pz) + h / 2 - BURIED / 2, pz], [0.34, h + BURIED, 0.5], { color: shade(STONE, 0.95), roughness: 0.92, metalness: 0.02 }, [0, rot, 0]));
    }
  }
  return out;
}
