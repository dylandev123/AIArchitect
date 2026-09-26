import type { FeatureType } from "./featureTypes";

export interface FieldSchema {
  key: string;
  label: string;
  type: "wallSelect" | "number" | "roomTypeSelect" | "buildingKindSelect" | "landscapeKindSelect" | "roofTypeSelect" | "select";
  step?: number;
  /** The choices of a plain `select` field. */
  options?: readonly string[];
  /** Shown when an optional field is absent from the item (older projects). */
  fallback?: string | number;
}

const WALL_FIELD: FieldSchema = { key: "wall", label: "Wall", type: "wallSelect" };
const LEVEL_FIELD: FieldSchema = { key: "level", label: "Level", type: "number", step: 1 };
const OFFSET_FIELD: FieldSchema = { key: "offset", label: "Offset (m)", type: "number", step: 0.1 };
const WIDTH_FIELD: FieldSchema = { key: "width", label: "Width (m)", type: "number", step: 0.1 };

const select = (key: string, label: string, options: readonly string[], fallback: string): FieldSchema => ({ key, label, type: "select", options, fallback });
const num = (key: string, label: string, step = 0.1, fallback?: number): FieldSchema => ({ key, label, type: "number", step, fallback });
const X_FIELD = (label = "X Position (m)"): FieldSchema => num("x", label, 0.5);
const Z_FIELD = (label = "Z Position (m)"): FieldSchema => num("z", label, 0.5);

export const FEATURE_FIELDS: Record<FeatureType, FieldSchema[]> = {
  window: [
    WALL_FIELD,
    LEVEL_FIELD,
    OFFSET_FIELD,
    WIDTH_FIELD,
    { key: "height", label: "Height (m)", type: "number", step: 0.1 },
    { key: "sill", label: "Sill Height (m)", type: "number", step: 0.1 },
  ],
  door: [
    WALL_FIELD,
    LEVEL_FIELD,
    OFFSET_FIELD,
    WIDTH_FIELD,
    { key: "height", label: "Height (m)", type: "number", step: 0.1 },
  ],
  garage: [
    { ...WALL_FIELD, label: "Attached Wall" },
    OFFSET_FIELD,
    WIDTH_FIELD,
    { key: "depth", label: "Depth (m)", type: "number", step: 0.1 },
    { key: "height", label: "Height (m)", type: "number", step: 0.1 },
  ],
  balcony: [
    WALL_FIELD,
    LEVEL_FIELD,
    OFFSET_FIELD,
    WIDTH_FIELD,
    { key: "depth", label: "Projection (m)", type: "number", step: 0.1 },
    { key: "railingHeight", label: "Railing Height (m)", type: "number", step: 0.1 },
  ],
  patio: [WALL_FIELD, OFFSET_FIELD, WIDTH_FIELD, { key: "depth", label: "Depth (m)", type: "number", step: 0.1 }],
  pool: [
    { ...WALL_FIELD, label: "Near Wall" },
    OFFSET_FIELD,
    { key: "distance", label: "Distance From Wall (m)", type: "number", step: 0.1 },
    WIDTH_FIELD,
    { key: "depth", label: "Depth (m)", type: "number", step: 0.1 },
    { key: "waterDepth", label: "Water Depth (m)", type: "number", step: 0.1 },
    select("shape", "Shape", ["rectangle", "rounded", "oval", "kidney"], "rectangle"),
  ],
  driveway: [
    WALL_FIELD,
    OFFSET_FIELD,
    WIDTH_FIELD,
    { key: "length", label: "Length (m)", type: "number", step: 0.5 },
    num("bend", "Curve (m)", 0.5, 0),
  ],
  room: [
    { key: "type", label: "Room Type", type: "roomTypeSelect" },
    LEVEL_FIELD,
    { key: "x", label: "X Position (m)", type: "number", step: 0.1 },
    { key: "z", label: "Z Position (m)", type: "number", step: 0.1 },
    WIDTH_FIELD,
    { key: "depth", label: "Depth (m)", type: "number", step: 0.1 },
  ],
  building: [
    { key: "kind", label: "Kind", type: "buildingKindSelect" },
    { key: "x", label: "X Position (m)", type: "number", step: 0.5 },
    { key: "z", label: "Z Position (m)", type: "number", step: 0.5 },
    WIDTH_FIELD,
    { key: "depth", label: "Depth (m)", type: "number", step: 0.1 },
    { key: "floors", label: "Floors", type: "number", step: 1 },
    { key: "roof", label: "Roof", type: "roofTypeSelect" },
    { key: "rotation", label: "Rotation (°)", type: "number", step: 5, fallback: 0 },
  ],
  road: [
    { key: "x1", label: "Start X (m)", type: "number", step: 0.5 },
    { key: "z1", label: "Start Z (m)", type: "number", step: 0.5 },
    { key: "x2", label: "End X (m)", type: "number", step: 0.5 },
    { key: "z2", label: "End Z (m)", type: "number", step: 0.5 },
    WIDTH_FIELD,
    num("bend", "Curve (m)", 0.5, 0),
  ],
  parking: [
    { key: "x", label: "X Position (m)", type: "number", step: 0.5 },
    { key: "z", label: "Z Position (m)", type: "number", step: 0.5 },
    WIDTH_FIELD,
    { key: "depth", label: "Depth (m)", type: "number", step: 0.1 },
  ],
  landscape: [
    { key: "kind", label: "Kind", type: "landscapeKindSelect" },
    { key: "x", label: "X Position (m)", type: "number", step: 0.5 },
    { key: "z", label: "Z Position (m)", type: "number", step: 0.5 },
    WIDTH_FIELD,
    { key: "depth", label: "Depth (m)", type: "number", step: 0.1 },
  ],
  deck: [
    { key: "x", label: "X Position (m)", type: "number", step: 0.5 },
    { key: "z", label: "Z Position (m)", type: "number", step: 0.5 },
    LEVEL_FIELD,
    WIDTH_FIELD,
    { key: "depth", label: "Depth (m)", type: "number", step: 0.1 },
    { key: "rotation", label: "Rotation (°)", type: "number", step: 5, fallback: 0 },
    select("shape", "Shape", ["rectangle", "rounded", "oval", "arc"], "rectangle"),
  ],
  porch: [WALL_FIELD, OFFSET_FIELD, WIDTH_FIELD, { key: "depth", label: "Depth (m)", type: "number", step: 0.1 }],
  chimney: [WALL_FIELD, OFFSET_FIELD, { key: "width", label: "Width (m)", type: "number", step: 0.1 }, { key: "depth", label: "Projection (m)", type: "number", step: 0.1 }],
  curvedWall: [
    X_FIELD("Centre X (m)"),
    Z_FIELD("Centre Z (m)"),
    num("radius", "Radius (m)", 0.5),
    num("startAngle", "Start Angle (°)", 5),
    num("sweep", "Sweep (°)", 5),
    num("height", "Height (m)", 0.1),
    num("thickness", "Thickness (m)", 0.05),
  ],
  arch: [WALL_FIELD, LEVEL_FIELD, OFFSET_FIELD, WIDTH_FIELD, num("height", "Height (m)"), num("depth", "Reveal Depth (m)", 0.05)],
  bay: [
    WALL_FIELD,
    LEVEL_FIELD,
    OFFSET_FIELD,
    WIDTH_FIELD,
    num("depth", "Projection (m)"),
    num("levels", "Storeys", 1),
    select("form", "Form", ["angled", "round", "turret"], "angled"),
  ],
  foundation: [num("steps", "Steps", 1), num("riser", "Step Height (m)", 0.01), num("projection", "Step Projection (m)", 0.02)],
  stairs: [
    WALL_FIELD,
    OFFSET_FIELD,
    WIDTH_FIELD,
    num("rise", "Rise (m)", 0.1),
    select("form", "Form", ["straight", "curved", "angled"], "straight"),
    select("turn", "Turns", ["right", "left"], "right"),
  ],
  dormer: [WALL_FIELD, OFFSET_FIELD, WIDTH_FIELD],
  crossGable: [WALL_FIELD, OFFSET_FIELD, WIDTH_FIELD],
  retainingWall: [
    num("x1", "Start X (m)", 0.5),
    num("z1", "Start Z (m)", 0.5),
    num("x2", "End X (m)", 0.5),
    num("z2", "End Z (m)", 0.5),
    num("height", "Height (m)", 0.1),
    num("thickness", "Thickness (m)", 0.05),
    num("bend", "Curve (m)", 0.5, 0),
  ],
  path: [
    num("x1", "Start X (m)", 0.5),
    num("z1", "Start Z (m)", 0.5),
    num("x2", "End X (m)", 0.5),
    num("z2", "End Z (m)", 0.5),
    WIDTH_FIELD,
    num("bend", "Curve (m)", 0.5, 0),
    select("surface", "Surface", ["gravel", "flagstone", "dirt", "boardwalk"], "gravel"),
  ],
  waterway: [
    select("kind", "Kind", ["river", "stream"], "stream"),
    num("x1", "Start X (m)", 0.5),
    num("z1", "Start Z (m)", 0.5),
    num("x2", "End X (m)", 0.5),
    num("z2", "End Z (m)", 0.5),
    WIDTH_FIELD,
    num("bend", "Curve (m)", 0.5, 0),
    num("meander", "Meander (0–1)", 0.05),
  ],
  rockCluster: [X_FIELD(), Z_FIELD(), num("radius", "Spread (m)", 0.5), num("count", "Rocks", 1), num("size", "Largest Rock (m)", 0.1)],
  slope: [
    X_FIELD(),
    Z_FIELD(),
    WIDTH_FIELD,
    num("depth", "Depth (m)", 0.5),
    num("rise", "Rise (m)", 0.1),
    num("rotation", "Rotation (°)", 5, 0),
    select("form", "Form", ["mound", "ramp", "terraced"], "mound"),
  ],
};
