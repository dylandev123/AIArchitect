import type { ArchConfig, HouseConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { ARCH_LIMITS, FLOOR_THICKNESS, LEVEL_HEIGHT } from "../constants";
import { resolveMaterial } from "../materials";
import { box, paintOf, shade, wallFrame, type WallFrame } from "../architecture/parts";
import { quadVerts, triMeshOf, triangulate, type P2 } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validateArch(raw: unknown, house: HouseConfig): FeatureValidation<ArchConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["offset", "width", "height"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);
  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;
  const level = clampNumber(Math.round(readNumber(o, "level", 0, 0, 99, warnings)), 0, Math.max(0, house.floors - 1), "level", warnings);
  const width = clampNumber(values.width, ARCH_LIMITS.width.min, Math.min(ARCH_LIMITS.width.max, wallLength), "width", warnings);
  const height = clampNumber(values.height, ARCH_LIMITS.height.min, ARCH_LIMITS.height.max, "height", warnings);
  const depth = readNumber(o, "depth", 0.35, ARCH_LIMITS.depth.min, ARCH_LIMITS.depth.max, warnings);
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);
  return { value: { wall: wall.value, level, offset, width, height, depth }, errors: [], warnings };
}

const ARCH_SEGMENTS = 14;

/** The band between two (u, y) profiles lying in the wall's plane, extruded outward from v0 to v1. */
function bandAlongWall(f: WallFrame, outer: P2[], inner: P2[], v0: number, v1: number): number[] {
  const out: number[] = [];
  const at = (p: P2, v: number) => f.at(p[0], p[1], v);
  for (let i = 0; i < outer.length - 1; i++) {
    quadVerts(out, at(outer[i], v0), at(outer[i + 1], v0), at(outer[i + 1], v1), at(outer[i], v1)); // extrados
    quadVerts(out, at(inner[i], v0), at(inner[i + 1], v0), at(inner[i + 1], v1), at(inner[i], v1)); // intrados
    quadVerts(out, at(outer[i], v1), at(outer[i + 1], v1), at(inner[i + 1], v1), at(inner[i], v1)); // front face
  }
  return out;
}

/**
 * An archway framed on a wall: two piers, a semicircular arch ring with a keystone, and a dark recessed void behind
 * it. The surround projects `depth` from the wall so the void reads as set back. Everything is described in the
 * wall's own frame, so the same code serves all four walls and every level.
 */
export function buildArch(config: ArchConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const f = wallFrame(ctx.house, config.wall);
  const exterior = resolveMaterial(ctx.materials.exterior);
  const stone = paintOf(exterior, shade(exterior.color, 0.9));
  const id = `arch-${index}`;
  const label = `Arch ${index + 1}`;
  const baseY = config.level * LEVEL_HEIGHT + FLOOR_THICKNESS;

  const pier = Math.min(0.4, config.width * 0.18);
  const clear = config.width - pier * 2;
  const r = clear / 2;
  const height = Math.max(config.height, r + 0.8);
  const springY = baseY + height - r;
  const uMid = config.offset + config.width / 2;
  const ring = pier;

  const out: HousePrimitive[] = [];
  const pierH = springY - baseY;
  out.push(
    box(`${id}-pier-l`, "arch", `${label} Pier`, f.at(config.offset + pier / 2, baseY + pierH / 2, config.depth / 2), f.size(pier, pierH, config.depth), stone),
    box(`${id}-pier-r`, "arch", `${label} Pier`, f.at(config.offset + config.width - pier / 2, baseY + pierH / 2, config.depth / 2), f.size(pier, pierH, config.depth), stone)
  );

  // The arch ring: a half annulus in the wall plane, extruded out to the surround's depth.
  const outer: P2[] = [];
  const inner: P2[] = [];
  for (let i = 0; i <= ARCH_SEGMENTS; i++) {
    const a = Math.PI - (Math.PI * i) / ARCH_SEGMENTS;
    outer.push([uMid + Math.cos(a) * (r + ring), springY + Math.sin(a) * (r + ring)]);
    inner.push([uMid + Math.cos(a) * r, springY + Math.sin(a) * r]);
  }
  out.push(triMeshOf(`${id}-ring`, "arch", `${label} Ring`, bandAlongWall(f, outer, inner, 0, config.depth), stone));
  out.push(box(`${id}-keystone`, "arch", `${label} Keystone`, f.at(uMid, springY + r + ring / 2, config.depth / 2 + 0.03), f.size(Math.max(0.24, ring * 0.7), ring + 0.14, config.depth + 0.06), paintOf(exterior, shade(exterior.color, 0.78))));

  // Recessed void: the opening's outline (rectangle + semicircle) as a dark plane just off the wall face.
  const outline: P2[] = [[uMid - r, baseY], [uMid + r, baseY]];
  for (let i = 0; i <= ARCH_SEGMENTS; i++) {
    const a = (Math.PI * i) / ARCH_SEGMENTS;
    outline.push([uMid + Math.cos(a) * r, springY + Math.sin(a) * r]);
  }
  const verts: number[] = [];
  for (const [i, j, k] of triangulate(outline)) for (const p of [outline[i], outline[j], outline[k]]) verts.push(...f.at(p[0], p[1], 0.02));
  out.push(triMeshOf(`${id}-void`, "arch", `${label} Recess`, verts, { color: "#1f1c1a", roughness: 0.95, metalness: 0 }));
  return out;
}
