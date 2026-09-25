import type { SlopeConfig, SlopeForm } from "@/types/house";
import type { HousePrimitive } from "../types";
import { SITE_POSITION_LIMIT, SLOPE_LIMITS } from "../constants";
import { box, shade } from "../architecture/parts";
import { quadVerts, triMeshOf } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readEnum, readNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

const FORMS: SlopeForm[] = ["mound", "ramp", "terraced"];

export function validateSlope(raw: unknown): FeatureValidation<SlopeConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x", "z", "width", "depth", "rise"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const x = clampNumber(values.x, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x", warnings);
  const z = clampNumber(values.z, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z", warnings);
  const width = clampNumber(values.width, SLOPE_LIMITS.width.min, SLOPE_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, SLOPE_LIMITS.depth.min, SLOPE_LIMITS.depth.max, "depth", warnings);
  const rise = clampNumber(values.rise, SLOPE_LIMITS.rise.min, SLOPE_LIMITS.rise.max, "rise", warnings);
  const rotation = readNumber(o, "rotation", 0, -180, 180, warnings);
  const form = readEnum(o, "form", FORMS, "mound", warnings);
  return { value: { x, z, width, depth, rise, rotation, form }, errors: [], warnings };
}

const GRID = 12;
const LIFT = 0.02;

/**
 * Shaped ground: a grassy mound (a smooth bell), a ramp (an eased wedge rising along the depth) or stepped terraces
 * (stone-faced tiers with grass tops). Mounds and ramps meet the ground at height zero, so they blend in at the rim.
 */
export function buildSlope(config: SlopeConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const { x, z, width, depth, rise, form } = config;
  const rot = (config.rotation * Math.PI) / 180;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const id = `slope-${index}`;
  const label = `${form === "terraced" ? "Terraces" : form === "ramp" ? "Ramp" : "Mound"} ${index + 1}`;
  const grass = ctx.groundColor;

  if (form === "terraced") {
    const tiers = 3;
    const out: HousePrimitive[] = [];
    for (let k = 0; k < tiers; k++) {
      const shrink = 1 - k * 0.24;
      const w = width * shrink;
      const d = (depth / tiers) * (tiers - k) * 0.9 + depth * 0.1;
      const h = (rise * (k + 1)) / tiers;
      const back = -depth / 2 + d / 2; // tiers step back toward the −depth side
      const cx = x + back * -s;
      const cz = z + back * c;
      out.push(
        box(`${id}-tier-${k}`, "slope", `${label} Wall`, [cx, h / 2 - 0.05, cz], [w, h + 0.1, d], { color: shade("#8a8478", 0.92 + k * 0.05), roughness: 0.92, metalness: 0.02 }, [0, -rot, 0]),
        box(`${id}-turf-${k}`, "slope", `${label} Lawn`, [cx, h + 0.03, cz], [w - 0.3, 0.06, d - 0.3], { color: grass, roughness: 0.95, metalness: 0 }, [0, -rot, 0])
      );
    }
    return out;
  }

  const height = (u: number, v: number): number => {
    // u, v in [-0.5, 0.5] across width and depth.
    if (form === "ramp") {
      const t = v + 0.5;
      const edge = Math.min(1, (0.5 - Math.abs(u)) * 6);
      return rise * (t * t * (3 - 2 * t)) * edge;
    }
    return rise * Math.pow(Math.cos(u * Math.PI) * Math.cos(v * Math.PI), 2);
  };
  const point = (i: number, j: number): [number, number, number] => {
    const u = i / GRID - 0.5;
    const v = j / GRID - 0.5;
    const lx = u * width;
    const lz = v * depth;
    return [x + lx * c + lz * -s, height(u, v) + LIFT, z + lx * s + lz * c];
  };
  const verts: number[] = [];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) quadVerts(verts, point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1));
  }
  return [triMeshOf(`${id}-surface`, "slope", label, verts, { color: grass, roughness: 0.95, metalness: 0 })];
}
