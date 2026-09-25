import type { WallSide } from "@/types/house";
import type { HousePrimitive, PrimitiveCategory } from "../types";
import type { Vec3 } from "../geometryUtils";
import { offsetOutward, pointOnWall, wallMountedSize, type WallAnchor } from "../wallAnchor";
import { box, type Paint } from "./parts";

const REVEAL_THICKNESS = 0.07;

/**
 * A surround that stands proud of an opening's glass or leaf, so the glazing reads as recessed. Walls in this
 * renderer are solid boxes with openings drawn on their faces, so depth is built outward: head, jambs and (for
 * windows) a bottom rail project `recess` metres past the glass, and everything inside them sits back behind that.
 */
export function buildReveal(
  id: string,
  category: PrimitiveCategory,
  label: string,
  anchor: WallAnchor,
  wall: WallSide,
  opening: { center: number; width: number; bottomY: number; height: number },
  glassFront: number,
  recess: number,
  paint: Paint,
  closedBottom: boolean
): HousePrimitive[] {
  if (recess <= 0) return [];
  const back = 0.06;
  const front = glassFront + recess;
  const length = front - back;
  const mid = (front + back) / 2;
  const R = REVEAL_THICKNESS;
  const { center, width, bottomY, height } = opening;

  const place = (along: number, y: number): Vec3 => {
    const base = pointOnWall(anchor, along);
    return offsetOutward([base[0], y, base[2]], anchor, mid);
  };
  const parts: [string, Vec3, Vec3][] = [
    ["head", place(center, bottomY + height + R / 2), wallMountedSize(wall, width + R * 2, R, length)],
    ["jamb-l", place(center - width / 2 - R / 2, bottomY + height / 2), wallMountedSize(wall, R, height, length)],
    ["jamb-r", place(center + width / 2 + R / 2, bottomY + height / 2), wallMountedSize(wall, R, height, length)],
  ];
  if (closedBottom) parts.push(["rail", place(center, bottomY - R / 2), wallMountedSize(wall, width + R * 2, R, length)]);
  return parts.map(([name, position, size]) => box(`${id}-reveal-${name}`, category, `${label} Reveal Trim`, position, size, paint));
}
