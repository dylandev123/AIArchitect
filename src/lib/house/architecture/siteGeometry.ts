import type { WallSide } from "@/types/house";
import type { PatchOp } from "../applyPatch";

/**
 * Ground geometry shared by the placement rules: world rectangles for what already stands on the site, and the
 * mapping from a wall coordinate to a world point. Kept free of any rule so the site plan, the scale rules and the
 * tier and terrain rules can all read the same picture of the ground without importing each other.
 */

export type Vec = [number, number];
export interface Rect { x: number; z: number; w: number; d: number }
type Shell = { width: number; depth: number };
type Rec = Record<string, unknown>;

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const valueOf = (op: PatchOp): Rec => (isRecord(op.value) ? op.value : {});
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/** World x/z of a point `u` along a wall (from its start corner) and `out` metres out from its face. */
export function wallPoint(h: Shell, wall: WallSide, u: number, out: number): Vec {
  switch (wall) {
    case "north": return [-h.width / 2 + u, -h.depth / 2 - out];
    case "south": return [-h.width / 2 + u, h.depth / 2 + out];
    case "east": return [h.width / 2 + out, -h.depth / 2 + u];
    case "west": return [-h.width / 2 - out, -h.depth / 2 + u];
  }
}

/** Ground rectangle of a wall-mounted item, `out0`…`out1` metres out from the wall. */
export function wallRect(h: Shell, wall: WallSide, offset: number, width: number, out0: number, out1: number): Rect {
  const [x1, z1] = wallPoint(h, wall, offset, out0);
  const [x2, z2] = wallPoint(h, wall, offset + width, out1);
  return { x: (x1 + x2) / 2, z: (z1 + z2) / 2, w: Math.abs(x2 - x1), d: Math.abs(z2 - z1) };
}

/** Everything already occupying the ground, as rectangles. */
export function groundRects(house: Shell, ops: readonly PatchOp[], withDrive = true): Rect[] {
  const rects: Rect[] = [{ x: 0, z: 0, w: house.width, d: house.depth }];
  for (const op of ops) {
    const v = valueOf(op);
    const wall = v.wall as WallSide;
    switch (op.op) {
      case "addBuilding": case "addDeck": case "addParking": case "addLandscape":
        rects.push(turnedRect(num(v.x), num(v.z), num(v.width), num(v.depth), op.op === "addBuilding" ? num(v.rotation) : 0));
        break;
      case "addPatio": case "addGarage": case "addPorch":
        rects.push(wallRect(house, wall, num(v.offset), num(v.width), 0, num(v.depth)));
        break;
      case "addPool":
        if (typeof v.siteX === "number") rects.push({ x: v.siteX, z: num(v.siteZ), w: num(v.width), d: num(v.depth) });
        else rects.push(wallRect(house, wall, num(v.offset), num(v.width), num(v.distance), num(v.distance) + num(v.depth)));
        break;
      case "addDriveway":
        if (withDrive) rects.push(wallRect(house, wall, num(v.offset), num(v.width), 0, num(v.length)));
        break;
    }
  }
  return rects;
}

/** The axis-aligned box around a `w` × `d` rectangle turned `degrees` about its centre (exact for quarter turns). */
export function turnedRect(x: number, z: number, w: number, d: number, degrees = 0): Rect {
  const t = (degrees * Math.PI) / 180;
  const c = Math.abs(Math.cos(t));
  const s = Math.abs(Math.sin(t));
  const eps = 1e-9;
  return { x, z, w: Math.abs(c) < eps ? d : Math.abs(s) < eps ? w : w * c + d * s, d: Math.abs(c) < eps ? w : Math.abs(s) < eps ? d : w * s + d * c };
}
