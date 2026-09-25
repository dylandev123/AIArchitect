import type { CurvedWallConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { CURVED_WALL_LIMITS, SITE_POSITION_LIMIT } from "../constants";
import { resolveMaterial } from "../materials";
import { box, paintOf, shade } from "../architecture/parts";
import { arcPoints, arcSegments, extrudeBand, triMeshOf } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validateCurvedWall(raw: unknown): FeatureValidation<CurvedWallConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x", "z", "radius", "sweep"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const x = clampNumber(values.x, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x", warnings);
  const z = clampNumber(values.z, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z", warnings);
  const radius = clampNumber(values.radius, CURVED_WALL_LIMITS.radius.min, CURVED_WALL_LIMITS.radius.max, "radius", warnings);
  const sweep = clampNumber(values.sweep, CURVED_WALL_LIMITS.sweep.min, CURVED_WALL_LIMITS.sweep.max, "sweep", warnings);
  const startAngle = readNumber(o, "startAngle", 0, -360, 360, warnings);
  const height = readNumber(o, "height", 2.4, CURVED_WALL_LIMITS.height.min, CURVED_WALL_LIMITS.height.max, warnings);
  // A wall can't be thicker than the circle it bends around.
  const thickness = readNumber(o, "thickness", 0.4, CURVED_WALL_LIMITS.thickness.min, Math.min(CURVED_WALL_LIMITS.thickness.max, radius * 0.6), warnings);
  return { value: { x, z, radius, startAngle, sweep, height, thickness }, errors: [], warnings };
}

const BURIED = 0.3;

/**
 * A freestanding curved wall: an arc of masonry with a wider plinth, a projecting coping and a pier at each end.
 * `radius` is the outer face; the wall's thickness eats inward. A full 360° sweep is a round tower or well wall.
 */
export function buildCurvedWall(config: CurvedWallConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const { x, z, radius, startAngle, sweep, height, thickness } = config;
  const exterior = resolveMaterial(ctx.materials.exterior);
  const trim = resolveMaterial(ctx.materials.trim);
  const id = `curvedWall-${index}`;
  const label = `Curved Wall ${index + 1}`;
  const segs = arcSegments(sweep, 6);
  const arc = (r: number) => arcPoints(x, z, r, startAngle, sweep, segs);
  const inner = radius - thickness;
  const wallPaint = paintOf(exterior);

  const out: HousePrimitive[] = [
    triMeshOf(`${id}-wall`, "wall", `${label}`, extrudeBand(arc(inner), arc(radius), -BURIED, height), wallPaint),
    triMeshOf(`${id}-plinth`, "wall", `${label} Plinth`, extrudeBand(arc(inner - 0.06), arc(radius + 0.06), -BURIED, 0.4), paintOf(exterior, shade(exterior.color, 0.8))),
    triMeshOf(`${id}-cap`, "wall", `${label} Coping`, extrudeBand(arc(inner - 0.07), arc(radius + 0.07), height, height + 0.09), paintOf(trim)),
  ];

  // Piers at both ends, turned to face along the wall.
  if (sweep < 359) {
    const pier = thickness + 0.22;
    for (const [end, angle] of [["a", startAngle], ["b", startAngle + sweep]] as const) {
      const rad = (angle * Math.PI) / 180;
      const r = radius - thickness / 2;
      out.push(
        box(`${id}-pier-${end}`, "wall", `${label} Pier`, [x + Math.cos(rad) * r, (height + 0.25 - BURIED) / 2, z + Math.sin(rad) * r], [pier, height + 0.25 + BURIED, pier], paintOf(exterior, shade(exterior.color, 0.92)), [0, -rad, 0])
      );
    }
  }
  return out;
}
