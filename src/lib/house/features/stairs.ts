import type { HouseConfig, StairForm, StairsConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { STAIRS_LIMITS } from "../constants";
import { resolveMaterial } from "../materials";
import { box, paintOf, shade, wallFrame } from "../architecture/parts";
import { arcPoints, extrudeOutline, triMeshOf, type P2 } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readEnum, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

const STAIR_FORMS: StairForm[] = ["straight", "curved", "angled"];
const TURNS = ["left", "right"] as const;
const RISER = 0.18;
const TREAD = 0.3;

export function validateStairs(raw: unknown, house: HouseConfig): FeatureValidation<StairsConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["offset", "width", "rise"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);
  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;
  const width = clampNumber(values.width, STAIRS_LIMITS.width.min, Math.min(STAIRS_LIMITS.width.max, wallLength), "width", warnings);
  const rise = clampNumber(values.rise, STAIRS_LIMITS.rise.min, STAIRS_LIMITS.rise.max, "rise", warnings);
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);
  const form = readEnum(o, "form", STAIR_FORMS, "straight", warnings);
  const turn = readEnum(o, "turn", TURNS, "right", warnings);
  return { value: { wall: wall.value, offset, width, rise, form, turn }, errors: [], warnings };
}

/**
 * Entry stairs climbing to a ground-floor door. Treads are solid masses from the ground up, so there is never a gap
 * beneath a step. The top tread sits flush against the wall, in front of the door; the flight descends away from it.
 */
export function buildStairs(config: StairsConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const f = wallFrame(ctx.house, config.wall);
  const exterior = resolveMaterial(ctx.materials.exterior);
  const stone = paintOf(exterior, shade(exterior.color, 0.88));
  const id = `stairs-${index}`;
  const label = `Stairs ${index + 1}`;
  const n = Math.max(1, Math.round(config.rise / RISER));
  const riser = config.rise / n;
  const { offset, width } = config;
  const right = config.turn === "right";
  const out: HousePrimitive[] = [];

  /** Height of the top of step k (0 = the top step, against the wall). */
  const topOf = (k: number) => config.rise - k * riser;

  if (config.form === "curved" && n > 1) {
    // A fan of treads swinging around a centre on the wall line: the flight curves away from the door.
    const inner = Math.max(0.8, width * 0.5);
    const dTheta = Math.min(14, Math.max(8, (TREAD / (inner + width / 2)) * (180 / Math.PI)));
    const uc = right ? offset - inner : offset + width + inner;
    const s = right ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const a0 = k * dTheta;
      const seg = Math.max(2, Math.ceil(dTheta / 4));
      const outerArc = arcPoints(0, 0, inner + width, a0, dTheta, seg);
      const innerArc = arcPoints(0, 0, inner, a0 + dTheta, -dTheta, seg);
      const toWorld = ([x, y]: P2): P2 => {
        const p = f.at(uc + s * x, 0, y);
        return [p[0], p[2]];
      };
      out.push(triMeshOf(`${id}-tread-${k}`, "stairs", `${label} Tread`, extrudeOutline([...outerArc, ...innerArc].map(toWorld), -0.2, topOf(k)), stone));
    }
    return out;
  }

  if (config.form === "angled" && n >= 4) {
    // A dog-leg: a straight flight out from the door, a square landing, then a flight turning along the wall.
    const n1 = Math.ceil((n - 1) / 2);
    const n2 = n - n1 - 1;
    for (let k = 0; k < n1; k++) {
      out.push(box(`${id}-tread-${k}`, "stairs", `${label} Tread`, f.at(offset + width / 2, (topOf(k) - 0.2) / 2, TREAD * (k + 0.5)), f.size(width, topOf(k) + 0.2, TREAD), stone));
    }
    const landingTop = topOf(n1);
    const v0 = n1 * TREAD;
    out.push(box(`${id}-landing`, "stairs", `${label} Landing`, f.at(offset + width / 2, (landingTop - 0.2) / 2, v0 + width / 2), f.size(width, landingTop + 0.2, width), stone));
    for (let j = 0; j < n2; j++) {
      const top = topOf(n1 + 1 + j);
      const u = right ? offset + width + TREAD * (j + 0.5) : offset - TREAD * (j + 0.5);
      out.push(box(`${id}-tread-${n1 + j}`, "stairs", `${label} Tread`, f.at(u, (top - 0.2) / 2, v0 + width / 2), f.size(TREAD, top + 0.2, width), stone));
    }
    return out;
  }

  for (let k = 0; k < n; k++) {
    out.push(box(`${id}-tread-${k}`, "stairs", `${label} Tread`, f.at(offset + width / 2, (topOf(k) - 0.2) / 2, TREAD * (k + 0.5)), f.size(width, topOf(k) + 0.2, TREAD), stone));
  }
  return out;
}
