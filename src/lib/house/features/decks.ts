import type { DeckConfig, DeckShape, MaterialsConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import {
  DECK_LIMITS,
  FLOOR_THICKNESS,
  LEVEL_HEIGHT,
  PAVING_THICKNESS,
  SITE_POSITION_LIMIT,
} from "../constants";
import { resolveMaterial } from "../materials";
import { clampNumber, readEnum, requireNumbers, type FeatureValidation } from "./validateHelpers";
import { convexHull, extrudeOutline, flatPolygon, polygonArea, quadVerts, segmentOutsideConvex, subtractConvex, translateOutline, triMeshOf, type P2 } from "../geometry/mesh";
import { deckOutline } from "../geometry/shapes";

const DECK_SHAPES: DeckShape[] = ["rectangle", "rounded", "oval", "arc"];

const DECK_SLAB_THICKNESS = 0.14;
const POST_SIZE = 0.12;

export function validateDeck(raw: unknown): FeatureValidation<DeckConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x", "z", "width", "depth"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const level = clampNumber(
    Math.round(typeof o.level === "number" ? o.level : 0),
    0, 12, "level", warnings
  );
  const width = clampNumber(values.width, DECK_LIMITS.width.min, DECK_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, DECK_LIMITS.depth.min, DECK_LIMITS.depth.max, "depth", warnings);
  const x = clampNumber(values.x, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x", warnings);
  const z = clampNumber(values.z, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z", warnings);
  const rotation = typeof o.rotation === "number" ? o.rotation : undefined;

  const value: DeckConfig = { x, z, level, width, depth };
  if (rotation !== undefined) value.rotation = rotation;
  // Only written when given, so a rectangular deck's JSON stays exactly as it was.
  if (o.shape !== undefined) value.shape = readEnum(o, "shape", DECK_SHAPES, "rectangle", warnings);
  return { value, errors: [], warnings };
}

/**
 * The deck's walking surface once every pool it overlaps is cut out of it: disjoint pieces covering the outline minus
 * each pool's coping outline (taken as its convex hull), plus the slab's side walls — the outer edges that remain,
 * and the edges of each cut that fall inside the deck. `null` when no pool reaches the deck.
 */
function cutAroundPools(outline: readonly P2[], pools: readonly (readonly P2[])[], y0: number, y1: number): { top: number[]; sides: number[] } | null {
  const holes = pools.map((pool) => convexHull(pool));
  let pieces: P2[][] = [[...outline]];
  for (const hole of holes) pieces = pieces.flatMap((piece) => subtractConvex(piece, hole));
  const kept = pieces.reduce((sum, piece) => sum + polygonArea(piece), 0);
  if (polygonArea(outline) - kept < 0.01) return null;
  const top = pieces.flatMap((piece) => flatPolygon(piece, y1));
  const sides: number[] = [];
  const wall = (a: P2, b: P2) => quadVerts(sides, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]);
  // Outer edges, minus the stretches that now open onto a pool.
  outline.forEach((a, i) => {
    let runs: [P2, P2][] = [[a, outline[(i + 1) % outline.length]]];
    for (const hole of holes) runs = runs.flatMap(([p, q]) => segmentOutsideConvex(p, q, hole));
    runs.forEach(([p, q]) => wall(p, q));
  });
  // The cut's own edges, where they run across the deck (and not across another pool).
  holes.forEach((hole, h) => hole.forEach((a, i) => {
    const b = hole[(i + 1) % hole.length];
    const mid: P2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const onDeck = pieces.some((piece) => piece.length >= 3 && polygonArea(piece) > 0 && pointNearPolygon(mid, piece));
    const inOther = holes.some((other, k) => k !== h && convexContains(other, mid));
    if (onDeck && !inOther) wall(b, a);
  }));
  return { top, sides };
}

/** On or inside a polygon (with a small tolerance, since a cut edge is exactly a piece's boundary). */
function pointNearPolygon(p: P2, poly: readonly P2[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2)) : 0;
    if (Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t)) < 1e-3) return true;
  }
  return false;
}

function convexContains(hull: readonly P2[], p: P2): boolean {
  let sign = 0;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

export function buildDeck(config: DeckConfig, materials: MaterialsConfig, index: number, poolCutouts: readonly (readonly P2[])[] = []): HousePrimitive[] {
  const { x, z, level, width, depth } = config;
  const rotDeg = config.rotation ?? 0;
  const rotRad = rotDeg * (Math.PI / 180);

  const decking = resolveMaterial(materials.decking);
  const trim = resolveMaterial(materials.trim);
  const idPrefix = `deck-${index}`;
  const label = `Deck ${index + 1}`;

  // Top surface Y — matches floor level of the given level (like a room floor)
  const surfaceTopY =
    level === 0 ? PAVING_THICKNESS : level * LEVEL_HEIGHT + FLOOR_THICKNESS;
  const slabCenterY = surfaceTopY - DECK_SLAB_THICKNESS / 2;

  const primitives: HousePrimitive[] = [];

  const curved = config.shape !== undefined && config.shape !== "rectangle";
  const paint = { color: decking.color, roughness: decking.roughness, metalness: decking.metalness };
  // Rotated to match a box's own Y rotation, so switching shape never spins the deck.
  const outline = translateOutline(deckOutline(config.shape ?? "rectangle", width, depth), x, z, -rotRad);
  const cut = level === 0 && poolCutouts.length ? cutAroundPools(outline, poolCutouts, slabCenterY - DECK_SLAB_THICKNESS / 2, surfaceTopY) : null;

  // Main platform slab: a box for a rectangular deck, an extruded outline for a curved one, and an outline with the
  // pool cut out of it where the deck surrounds (or meets) a pool.
  if (cut) {
    primitives.push(triMeshOf(`${idPrefix}-slab`, "deck", `${label} Platform`, [...cut.sides, ...cut.top], paint));
  } else if (curved) {
    primitives.push(triMeshOf(`${idPrefix}-slab`, "deck", `${label} Platform`, extrudeOutline(outline, slabCenterY - DECK_SLAB_THICKNESS / 2, surfaceTopY), {
      color: decking.color,
      roughness: decking.roughness,
      metalness: decking.metalness,
    }));
  } else primitives.push({
    kind: "box",
    id: `${idPrefix}-slab`,
    category: "deck",
    label: `${label} Platform`,
    position: [x, slabCenterY, z],
    rotation: [0, rotRad, 0],
    size: [width, DECK_SLAB_THICKNESS, depth],
    color: decking.color,
    roughness: decking.roughness,
    metalness: decking.metalness,
  });

  // Support posts for elevated decks — rotated with the deck
  if (level > 0) {
    const postH = surfaceTopY - DECK_SLAB_THICKNESS;
    const postCenterY = postH / 2;
    // Curved decks pull their posts in from the bounding corners, which would otherwise stick out past the edge.
    const inset = curved ? 0.62 : 1;
    const hw = (width / 2) * inset;
    const hd = (depth / 2) * inset;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    ([
      [-(hw - POST_SIZE), -(hd - POST_SIZE), "nw"],
      [ (hw - POST_SIZE), -(hd - POST_SIZE), "ne"],
      [ (hw - POST_SIZE),  (hd - POST_SIZE), "se"],
      [-(hw - POST_SIZE),  (hd - POST_SIZE), "sw"],
    ] as [number, number, string][]).forEach(([lx, lz, dir]) => {
      const wx = x + lx * cos - lz * sin;
      const wz = z + lx * sin + lz * cos;
      primitives.push({
        kind: "box",
        id: `${idPrefix}-post-${dir}`,
        category: "deck",
        label: `${label} Post`,
        position: [wx, postCenterY, wz],
        rotation: [0, 0, 0],
        size: [POST_SIZE, postH, POST_SIZE],
        color: trim.color,
        roughness: trim.roughness,
        metalness: trim.metalness,
      });
    });
  }

  return primitives;
}
