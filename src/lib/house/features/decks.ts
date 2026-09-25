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
import { extrudeOutline, translateOutline, triMeshOf } from "../geometry/mesh";
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

  const curved = config.shape !== undefined && config.shape !== "rectangle";

  // Main platform slab: a box for a rectangular deck, an extruded outline for a curved one.
  if (curved) {
    // Rotated to match a box's own Y rotation, so switching shape never spins the deck.
    const outline = translateOutline(deckOutline(config.shape!, width, depth), x, z, -rotRad);
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
