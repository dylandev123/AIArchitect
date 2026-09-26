import type { HousePrimitive } from "../types";
import { FLOOR_THICKNESS, FRAME_BORDER, FRAME_THICKNESS } from "../constants";
import { getWallAnchorForFootprint, offsetOutward, pointOnWall, wallMountedSize } from "../wallAnchor";

// ── Per-kind window/door helpers ──────────────────────────────────────────────

export function addWindow(
  primitives: HousePrimitive[],
  anchor: ReturnType<typeof getWallAnchorForFootprint>,
  offset: number,
  winWidth: number,
  winHeight: number,
  sill: number,
  idKey: string,
  label: string,
  trim: { color: string; roughness?: number; metalness?: number },
  glass: { color: string; roughness?: number; metalness?: number; transparent?: boolean; opacity?: number },
  /** Floor level the window sits on; defaults to the ground floor. */
  baseY = FLOOR_THICKNESS
) {
  const base = pointOnWall(anchor, offset);
  const y = baseY + sill + winHeight / 2;
  const framePos = offsetOutward([base[0], y, base[2]], anchor, FRAME_THICKNESS / 2);
  const glassPos = offsetOutward([base[0], y, base[2]], anchor, FRAME_THICKNESS + 0.02);

  // Infer wall side from anchor outwardNormal
  const wall = anchor.outwardNormal[2] === 1 ? "south" : anchor.outwardNormal[2] === -1 ? "north" : anchor.outwardNormal[0] === 1 ? "east" : "west";

  primitives.push(
    {
      kind: "box",
      id: `${idKey}-frame`,
      category: "building",
      label: `${label} Frame`,
      position: framePos,
      rotation: [0, 0, 0],
      size: wallMountedSize(wall, winWidth + FRAME_BORDER * 2, winHeight + FRAME_BORDER * 2, FRAME_THICKNESS),
      color: trim.color,
      roughness: trim.roughness,
      metalness: trim.metalness,
    },
    {
      kind: "box",
      id: `${idKey}-glass`,
      category: "building",
      label: `${label} Glass`,
      position: glassPos,
      rotation: [0, 0, 0],
      size: wallMountedSize(wall, winWidth, winHeight, 0.03),
      color: glass.color,
      roughness: glass.roughness,
      metalness: glass.metalness,
      transparent: glass.transparent,
      opacity: glass.opacity,
    }
  );
}
