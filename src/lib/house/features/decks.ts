import type { DeckConfig, MaterialsConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import {
  DECK_LIMITS,
  FLOOR_THICKNESS,
  LEVEL_HEIGHT,
  PAVING_THICKNESS,
  SITE_POSITION_LIMIT,
} from "../constants";
import { resolveMaterial } from "../materials";
import { clampNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

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
  return { value, errors: [], warnings };
}

export function buildDeck(config: DeckConfig, materials: MaterialsConfig, index: number): HousePrimitive[] {
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

  // Main platform slab
  primitives.push({
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
    const hw = width / 2;
    const hd = depth / 2;
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
