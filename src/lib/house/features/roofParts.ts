import type { CrossGableConfig, DormerConfig, HouseConfig, WallSide } from "@/types/house";
import type { HousePrimitive } from "../types";
import { CROSS_GABLE_LIMITS, DORMER_LIMITS, MATERIAL_COLORS } from "../constants";
import { resolveMaterial } from "../materials";
import { box, paintOf, shade, wallFrame, type WallFrame } from "../architecture/parts";
import { getArchitectureProfile } from "../architecture/profiles";
import { pitchedRoof, roofDistanceAt, roofHeightAt, type PitchedRoof } from "../architecture/roofPlane";
import { quadVerts, triMeshOf } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

type RoofPartConfig = DormerConfig | CrossGableConfig;

/**
 * Shared validation for parts that stand on the roof. They need a gable or hip roof; on anything else the item is
 * kept (so it survives a later roof change) but draws nothing. The wall is snapped to a wall the roof slopes toward.
 */
function validateRoofPart(raw: unknown, house: HouseConfig, limits: { min: number; max: number }): FeatureValidation<RoofPartConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["offset", "width"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);
  let side: WallSide = wall.value;

  const roof = pitchedRoof(house);
  if (!roof) warnings.push(`Needs a "gable" or "hip" roof — nothing is drawn on a "${house.roof}" roof.`);
  else if (!roof.slopeWalls.includes(side)) {
    side = roof.slopeWalls[0];
    warnings.push(`The roof only slopes toward the ${roof.slopeWalls.join(" and ")} walls — moved to "${side}".`);
  }
  const wallLength = side === "north" || side === "south" ? house.width : house.depth;
  const width = clampNumber(values.width, limits.min, Math.min(limits.max, wallLength), "width", warnings);
  const [lo, hi] = roof ? roof.usable : [0, wallLength];
  const offset = clampNumber(values.offset, lo, Math.max(lo, hi - width), "offset", warnings);
  return { value: { wall: side, offset, width }, errors: [], warnings };
}

export function validateDormer(raw: unknown, house: HouseConfig): FeatureValidation<DormerConfig> {
  return validateRoofPart(raw, house, DORMER_LIMITS.width);
}

export function validateCrossGable(raw: unknown, house: HouseConfig): FeatureValidation<CrossGableConfig> {
  return validateRoofPart(raw, house, CROSS_GABLE_LIMITS.width);
}

interface Projection {
  /** Front face's distance out from the wall (negative = set back up the slope). */
  vFront: number;
  /** Height of the gable's eave line. */
  eaveY: number;
  /** Height of the vertical wall below the gable, measured down to `wallBottomY`. */
  wallBottomY: number;
  /** Rise of the gable's own roof per metre across it. */
  gableSlope: number;
  withWindow: boolean;
  /** Wall run between the front face and the wall plane (cross gables fill the eave overhang). */
  returnDepth: number;
}

/** A gabled projection standing on a slope: a front wall with gable, two cheek walls and two roof planes. */
function buildProjection(f: WallFrame, roof: PitchedRoof, config: RoofPartConfig, p: Projection, id: string, label: string, ctx: BuildContext): HousePrimitive[] {
  const exterior = resolveMaterial(ctx.materials.exterior);
  const roofMat = resolveMaterial(ctx.materials.roof);
  const trim = resolveMaterial(ctx.materials.trim);
  const uc = config.offset + config.width / 2;
  const half = config.width / 2;
  const ridgeY = p.eaveY + p.gableSlope * half;
  const wallPaint = paintOf(exterior);
  const out: HousePrimitive[] = [];

  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => [...a, ...b, ...c];
  const at = (u: number, y: number, v: number) => f.at(u, y, v);
  const face = p.vFront + 0.1;

  // Front wall, from the roof line (or the wall top) up to the eave.
  const wallH = p.eaveY - p.wallBottomY;
  if (wallH > 0.02) {
    out.push(box(`${id}-front`, "roof", `${label} Front`, at(uc, p.wallBottomY + wallH / 2, p.vFront), f.size(config.width, wallH, 0.2), wallPaint));
  }
  // Gable triangle with a slightly larger trim triangle behind it as barge boards.
  const rake = 0.12;
  out.push(
    triMeshOf(`${id}-barge`, "roof", `${label} Barge Board`, tri(at(uc - half - rake, p.eaveY - 0.05, face - 0.015), at(uc + half + rake, p.eaveY - 0.05, face - 0.015), at(uc, ridgeY + rake * 0.9, face - 0.015)), paintOf(trim)),
    triMeshOf(`${id}-gable`, "roof", `${label} Gable`, tri(at(uc - half, p.eaveY, face), at(uc + half, p.eaveY, face), at(uc, ridgeY, face)), wallPaint)
  );

  if (p.withWindow) {
    // Tall walls carry the window on the wall; a shallow one (a cross gable) puts it in the gable itself.
    const gableH = ridgeY - p.eaveY;
    const inWall = wallH >= 0.9;
    const wh = inWall ? Math.min(wallH * 0.62, 1.1) : Math.min(0.9, gableH * 0.5);
    const wy = inWall ? p.wallBottomY + wallH * 0.5 : p.eaveY + gableH * 0.36;
    const ww = Math.min(config.width * (inWall ? 0.5 : 0.4), 1.4);
    const wv = face + 0.02;
    const panel = (w: number, h: number, v: number) => {
      const verts: number[] = [];
      quadVerts(verts, at(uc - w / 2, wy - h / 2, v), at(uc + w / 2, wy - h / 2, v), at(uc + w / 2, wy + h / 2, v), at(uc - w / 2, wy + h / 2, v));
      return verts;
    };
    out.push(
      triMeshOf(`${id}-window-frame`, "roof", `${label} Window Frame`, panel(ww + 0.14, wh + 0.14, wv), paintOf(trim)),
      triMeshOf(`${id}-window`, "roof", `${label} Window`, panel(ww, wh, wv + 0.01), { color: MATERIAL_COLORS.glass, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.4 })
    );
  }

  // Cheek walls: triangles closing each side between the front wall and where the eave line meets the main roof.
  const vEave = roofDistanceAt(roof, p.eaveY);
  for (const [sign, name] of [[-1, "l"], [1, "r"]] as const) {
    const u = uc + sign * half;
    const bottomFront = Math.min(p.eaveY, roofHeightAt(roof, p.vFront));
    out.push(triMeshOf(`${id}-cheek-${name}`, "roof", `${label} Cheek`, tri(at(u, bottomFront - 0.1, p.vFront), at(u, p.eaveY, p.vFront), at(u, p.eaveY, vEave)), wallPaint));
    if (p.returnDepth > 0.02) {
      // Cross gables come out flush with the eave line; fill the run back to the wall plane.
      out.push(box(`${id}-return-${name}`, "roof", `${label} Return`, at(u, (p.wallBottomY + p.eaveY) / 2, p.vFront - p.returnDepth / 2), f.size(0.2, Math.max(0.05, p.eaveY - p.wallBottomY), p.returnDepth), wallPaint));
    }
  }

  // Roof planes: from the eave line up to the ridge, running back until they meet the main roof.
  const oh = 0.2;
  const eaveLow = p.eaveY - 0.12;
  const vEaveLow = roofDistanceAt(roof, eaveLow);
  const vRidge = roofDistanceAt(roof, ridgeY);
  const vFrontEave = p.vFront + 0.22;
  for (const [sign, name] of [[-1, "l"], [1, "r"]] as const) {
    const uEdge = uc + sign * (half + oh);
    const verts: number[] = [];
    quadVerts(verts, at(uEdge, eaveLow, vFrontEave), at(uc, ridgeY, vFrontEave), at(uc, ridgeY, vRidge), at(uEdge, eaveLow, vEaveLow));
    out.push(triMeshOf(`${id}-roof-${name}`, "roof", `${label} Roof`, verts, paintOf(roofMat)));
  }
  out.push(box(`${id}-ridge`, "roof", `${label} Ridge Cap`, at(uc, ridgeY + 0.03, (vFrontEave + vRidge) / 2), f.size(0.14, 0.09, Math.abs(vFrontEave - vRidge)), paintOf(roofMat, shade(roofMat.color, 0.85))));
  return out;
}

/** A small gabled dormer, set back up the slope, with a window in its face. */
export function buildDormer(config: DormerConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const roof = pitchedRoof(ctx.house, getArchitectureProfile(ctx.opts?.style));
  if (!roof) return [];
  const f = wallFrame(ctx.house, config.wall);
  const vFront = -Math.min(1.2, roof.span * 0.14);
  const yFront = roofHeightAt(roof, vFront);
  // The dormer must stay below the ridge: shrink it if the slope is too shallow to fit.
  const gableSlope = 0.75;
  const headroom = roof.ridgeY - 0.25 - yFront;
  const wallH = Math.min(1.55, headroom - gableSlope * (config.width / 2 + 0.05));
  if (wallH < 0.7) return [];
  return buildProjection(f, roof, config, { vFront, eaveY: yFront + wallH, wallBottomY: yFront - 0.15, gableSlope, withWindow: true, returnDepth: 0 }, `dormer-${index}`, `Dormer ${index + 1}`, ctx);
}

/**
 * A cross gable: a gabled wing across the main roof whose face stands flush with the eave line. Its roof keeps the
 * main roof's pitch, so a wider gable is a taller one — the width is trimmed so it never overtops the main ridge.
 */
export function buildCrossGable(config: CrossGableConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const roof = pitchedRoof(ctx.house, getArchitectureProfile(ctx.opts?.style));
  if (!roof) return [];
  const f = wallFrame(ctx.house, config.wall);
  const eaveY = roof.baseY + 0.3;
  const maxHalf = (roof.ridgeY - 0.3 - eaveY) / roof.slope;
  if (maxHalf < 1.1) return [];
  const half = Math.min(config.width / 2, maxHalf);
  const trimmed: CrossGableConfig = { ...config, offset: config.offset + (config.width / 2 - half), width: half * 2 };
  return buildProjection(f, roof, trimmed, { vFront: roof.overhang, eaveY, wallBottomY: roof.baseY - 0.35, gableSlope: roof.slope, withWindow: true, returnDepth: roof.overhang }, `crossGable-${index}`, `Cross Gable ${index + 1}`, ctx);
}
