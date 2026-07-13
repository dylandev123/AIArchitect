import type { WallSide } from "@/types/house";
import type { Vec3 } from "./geometryUtils";
import type { HousePrimitive } from "./types";
import { WALL_THICKNESS } from "./constants";
import type { ResolvedMaterial } from "./materials";

export interface RoomFootprint {
  /** [x, z] center of the room footprint. */
  center: [number, number];
  width: number;
  depth: number;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Shifts a primitive on the XZ plane. The roof builders generate geometry
 * centered at the world origin (since the main house always sits there);
 * freestanding structures (resort buildings) reuse those same builders and
 * then translate the result to their own site position.
 */
export function translatePrimitive(primitive: HousePrimitive, dx: number, dz: number): HousePrimitive {
  if (primitive.kind === "box") {
    return {
      ...primitive,
      position: [primitive.position[0] + dx, primitive.position[1], primitive.position[2] + dz],
    };
  }
  const vertices = primitive.vertices.map((value, i) => {
    const axis = i % 3;
    if (axis === 0) return value + dx;
    if (axis === 2) return value + dz;
    return value;
  });
  return { ...primitive, vertices };
}

export function buildFloorSlabPrimitive(
  footprint: RoomFootprint,
  baseY: number,
  thickness: number,
  id: string,
  label: string,
  color: string,
  finish?: Partial<ResolvedMaterial>
): HousePrimitive {
  return {
    kind: "box",
    id,
    category: "floor",
    label,
    position: [footprint.center[0], baseY + thickness / 2, footprint.center[1]],
    rotation: [0, 0, 0],
    size: [footprint.width, thickness, footprint.depth],
    color,
    roughness: finish?.roughness,
    metalness: finish?.metalness,
    transparent: finish?.transparent,
    opacity: finish?.opacity,
    assetId: finish?.assetId,
    uvScale: finish?.uvScale,
  };
}

/**
 * Four perimeter walls for a rectangular footprint, baseY = wall bottom.
 * `skipSides` omits walls (e.g. the side flush against a parent structure).
 */
export function buildWallRingPrimitives(
  footprint: RoomFootprint,
  baseY: number,
  wallHeight: number,
  idPrefix: string,
  labelPrefix: string,
  color: string,
  skipSides: WallSide[] = [],
  finish?: Partial<ResolvedMaterial>
): HousePrimitive[] {
  const halfW = footprint.width / 2;
  const halfD = footprint.depth / 2;
  const [cx, cz] = footprint.center;
  const wallY = baseY + wallHeight / 2;

  const sides: { side: WallSide; position: Vec3; size: Vec3 }[] = [
    {
      side: "north",
      position: [cx, wallY, cz - halfD + WALL_THICKNESS / 2],
      size: [footprint.width, wallHeight, WALL_THICKNESS],
    },
    {
      side: "south",
      position: [cx, wallY, cz + halfD - WALL_THICKNESS / 2],
      size: [footprint.width, wallHeight, WALL_THICKNESS],
    },
    {
      side: "east",
      position: [cx + halfW - WALL_THICKNESS / 2, wallY, cz],
      size: [WALL_THICKNESS, wallHeight, footprint.depth],
    },
    {
      side: "west",
      position: [cx - halfW + WALL_THICKNESS / 2, wallY, cz],
      size: [WALL_THICKNESS, wallHeight, footprint.depth],
    },
  ];

  return sides
    .filter((s) => !skipSides.includes(s.side))
    .map((s) => ({
      kind: "box" as const,
      id: `${idPrefix}-${s.side}`,
      category: "wall" as const,
      label: `${labelPrefix} (${capitalize(s.side)})`,
      position: s.position,
      rotation: [0, 0, 0] as Vec3,
      size: s.size,
      color,
      roughness: finish?.roughness,
      metalness: finish?.metalness,
      transparent: finish?.transparent,
      opacity: finish?.opacity,
      assetId: finish?.assetId,
      uvScale: finish?.uvScale,
    }));
}
