import type { HouseConfig, WallSide } from "@/types/house";
import type { Vec3 } from "./geometryUtils";
import { FLOOR_THICKNESS, LEVEL_HEIGHT } from "./constants";

export interface WallAnchor {
  /** World-space point at the wall's outer face, offset = 0, y = the wall's base (floor level). */
  origin: Vec3;
  /** Unit vector along the wall, in the direction offset increases. */
  axis: Vec3;
  /** Unit vector pointing away from the house, perpendicular to the wall. */
  outwardNormal: Vec3;
  /** Total wall length (matches house width for north/south, depth for east/west). */
  length: number;
}

/** Locates a wall's outer face for an arbitrary rectangular footprint, centered at `center`. */
export function getWallAnchorForFootprint(
  center: [number, number],
  width: number,
  depth: number,
  baseY: number,
  wall: WallSide
): WallAnchor {
  const halfW = width / 2;
  const halfD = depth / 2;
  const [cx, cz] = center;

  switch (wall) {
    case "north":
      return { origin: [cx - halfW, baseY, cz - halfD], axis: [1, 0, 0], outwardNormal: [0, 0, -1], length: width };
    case "south":
      return { origin: [cx - halfW, baseY, cz + halfD], axis: [1, 0, 0], outwardNormal: [0, 0, 1], length: width };
    case "east":
      return { origin: [cx + halfW, baseY, cz - halfD], axis: [0, 0, 1], outwardNormal: [1, 0, 0], length: depth };
    case "west":
      return { origin: [cx - halfW, baseY, cz - halfD], axis: [0, 0, 1], outwardNormal: [-1, 0, 0], length: depth };
  }
}

/** Locates a wall's outer face for a given house footprint, used to anchor mounted features. */
export function getWallAnchor(house: HouseConfig, wall: WallSide, level: number): WallAnchor {
  const baseY = level * LEVEL_HEIGHT + FLOOR_THICKNESS;
  return getWallAnchorForFootprint([0, 0], house.width, house.depth, baseY, wall);
}

/** Point on the wall's outer face at the given distance along its axis. */
export function pointOnWall(anchor: WallAnchor, alongOffset: number): Vec3 {
  return [
    anchor.origin[0] + anchor.axis[0] * alongOffset,
    anchor.origin[1] + anchor.axis[1] * alongOffset,
    anchor.origin[2] + anchor.axis[2] * alongOffset,
  ];
}

/** Offsets a point outward from the wall face by the given distance. */
export function offsetOutward(point: Vec3, anchor: WallAnchor, distance: number): Vec3 {
  return [
    point[0] + anchor.outwardNormal[0] * distance,
    point[1] + anchor.outwardNormal[1] * distance,
    point[2] + anchor.outwardNormal[2] * distance,
  ];
}

/**
 * Box size for a feature mounted flat against this wall: `along` runs parallel
 * to the wall (matches offset direction), `thickness` runs along the outward normal.
 */
export function wallMountedSize(wall: WallSide, along: number, height: number, thickness: number): Vec3 {
  return wall === "north" || wall === "south" ? [along, height, thickness] : [thickness, height, along];
}
