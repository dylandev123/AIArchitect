import type { HouseConfig, WallSide } from "@/types/house";
import { LEVEL_HEIGHT, ROOF_OVERHANG } from "../constants";
import type { ArchitectureProfile } from "./profiles";

/**
 * The main roof's pitched slopes, described once so dormers, cross gables and chimneys can sit on them.
 * Mirrors the gable / hip builders: the ridge runs along the longer footprint axis, the slopes face the two long
 * walls, and `pitch` is rise ÷ full span.
 */
export interface PitchedRoof {
  kind: "gable" | "hip";
  /** Walls the two slopes face — the walls parallel to the ridge. */
  slopeWalls: [WallSide, WallSide];
  /** Length of the wall those slopes face. */
  wallLength: number;
  span: number;
  baseY: number;
  rise: number;
  ridgeY: number;
  overhang: number;
  /** Rise per metre travelled across the slope. */
  slope: number;
  /** Stretch of a slope wall (offset range) where the slope is a full, planar face. */
  usable: [number, number];
}

const DEFAULT_PITCH = 0.35;

/** Returns undefined for roofs a dormer cannot stand on (flat, shed, butterfly, sawtooth, mansard, floating plate). */
export function pitchedRoof(house: HouseConfig, profile?: ArchitectureProfile): PitchedRoof | undefined {
  let kind: PitchedRoof["kind"];
  let pitch = DEFAULT_PITCH;
  let overhang = ROOF_OVERHANG;
  if (profile) {
    if (profile.roof.character === "floating-plate") return undefined;
    kind = profile.roof.character === "veranda-hip" ? "hip" : "gable";
    pitch = profile.roof.pitch;
    overhang = profile.roof.overhang;
  } else if (house.roof === "gable" || house.roof === "hip") {
    kind = house.roof;
  } else {
    return undefined;
  }

  const ridgeAlongX = house.width >= house.depth;
  const span = ridgeAlongX ? house.depth : house.width;
  const long = ridgeAlongX ? house.width : house.depth;
  const baseY = house.floors * LEVEL_HEIGHT;
  const rise = Math.max(0.6, span * pitch);
  const halfSpan = span / 2 + overhang;
  // A hip's end faces slope away too, so only the straight stretch of the long slope is a clean plane.
  const usable: [number, number] = kind === "hip" ? [span / 2, long - span / 2] : [0, long];
  return {
    kind,
    slopeWalls: ridgeAlongX ? ["north", "south"] : ["east", "west"],
    wallLength: long,
    span,
    baseY,
    rise,
    ridgeY: baseY + rise,
    overhang,
    slope: rise / halfSpan,
    usable,
  };
}

/** Roof surface height above a point `v` metres out from a slope wall's face (negative = up-slope, inside the plan). */
export function roofHeightAt(roof: PitchedRoof, v: number): number {
  return roof.ridgeY - roof.slope * (v + roof.span / 2);
}

/** The `v` at which the roof surface reaches height `y` (the inverse of roofHeightAt). */
export function roofDistanceAt(roof: PitchedRoof, y: number): number {
  return (roof.ridgeY - y) / roof.slope - roof.span / 2;
}
