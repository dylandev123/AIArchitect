import type { HouseConfig, WallSide } from "@/types/house";
import type { Vec3 } from "../geometryUtils";
import type { BoxPrimitive, PrimitiveCategory } from "../types";
import { materialProps, type ResolvedMaterial } from "../materials";
import { getWallAnchor } from "../wallAnchor";

/** Small, dependency-free building blocks shared by every architectural part builder. */

export type Paint = Pick<ResolvedMaterial, "color" | "roughness" | "metalness"> &
  Partial<Pick<ResolvedMaterial, "transparent" | "opacity" | "assetId" | "uvScale">>;

export function paintOf(material: ResolvedMaterial, color?: string): Paint {
  return { ...materialProps(material), color: color ?? material.color };
}

export function box(
  id: string,
  category: PrimitiveCategory,
  label: string,
  position: Vec3,
  size: Vec3,
  paint: Paint,
  rotation: Vec3 = [0, 0, 0]
): BoxPrimitive {
  return { kind: "box", id, category, label, position, rotation, size, ...paint };
}

/** Deterministic pseudo-random value in [0, 1) — parts must look the same on every render. */
export function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Multiplies each RGB channel by `factor` (<1 darkens, >1 lightens). */
export function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const channel = (shift: number) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * factor)));
  return `#${((1 << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).slice(1)}`;
}

/** A door opening on a ground-floor wall, so foundations and plinths can leave it clear. */
export interface DoorSpan {
  wall: WallSide;
  from: number;
  to: number;
}

export function overlapsDoor(spans: readonly DoorSpan[], wall: WallSide, from: number, to: number, margin = 0.15): boolean {
  return spans.some((s) => s.wall === wall && from < s.to + margin && to > s.from - margin);
}

/**
 * Coordinates local to one wall of the house: `u` runs along the wall from its start corner, `v` runs outward
 * from the wall's outer face and `y` is an absolute height. Porches, chimneys and window surrounds are described
 * in this frame so the same code serves all four walls.
 */
export interface WallFrame {
  wall: WallSide;
  length: number;
  at(u: number, y: number, v: number): Vec3;
  /** Box size for extents (along, height, outward). */
  size(along: number, height: number, out: number): Vec3;
  /** Euler rotation that tilts a vertical member so it leans along the wall (dy up while moving du along it). */
  lean(du: number, dy: number): Vec3;
}

export function wallFrame(house: HouseConfig, wall: WallSide): WallFrame {
  const anchor = getWallAnchor(house, wall, 0);
  const alongX = wall === "north" || wall === "south";
  return {
    wall,
    length: anchor.length,
    at: (u, y, v) => [
      anchor.origin[0] + anchor.axis[0] * u + anchor.outwardNormal[0] * v,
      y,
      anchor.origin[2] + anchor.axis[2] * u + anchor.outwardNormal[2] * v,
    ],
    size: (along, height, out) => (alongX ? [along, height, out] : [out, height, along]),
    // Rotating about Z takes +Y toward -X; about X it takes +Y toward +Z.
    lean: (du, dy) => (alongX ? [0, 0, Math.atan2(-du, dy)] : [Math.atan2(du, dy), 0, 0]),
  };
}

/** Euler rotation for a member lying in a vertical plane, spanning (d, dy) in that plane's horizontal axis. */
export function tiltInPlane(plane: "yz" | "xy", d: number, dy: number): Vec3 {
  return plane === "yz" ? [Math.atan2(d, dy), 0, 0] : [0, 0, Math.atan2(-d, dy)];
}

export function planeLength(d: number, dy: number): number {
  return Math.hypot(d, dy);
}
