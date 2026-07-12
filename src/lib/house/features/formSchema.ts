import type { FeatureType } from "./featureTypes";

export interface FieldSchema {
  key: string;
  label: string;
  type: "wallSelect" | "number" | "roomTypeSelect" | "buildingKindSelect" | "landscapeKindSelect" | "roofTypeSelect";
  step?: number;
}

const WALL_FIELD: FieldSchema = { key: "wall", label: "Wall", type: "wallSelect" };
const LEVEL_FIELD: FieldSchema = { key: "level", label: "Level", type: "number", step: 1 };
const OFFSET_FIELD: FieldSchema = { key: "offset", label: "Offset (m)", type: "number", step: 0.1 };
const WIDTH_FIELD: FieldSchema = { key: "width", label: "Width (m)", type: "number", step: 0.1 };

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
  ],
  driveway: [
    WALL_FIELD,
    OFFSET_FIELD,
    WIDTH_FIELD,
    { key: "length", label: "Length (m)", type: "number", step: 0.5 },
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
  ],
  road: [
    { key: "x1", label: "Start X (m)", type: "number", step: 0.5 },
    { key: "z1", label: "Start Z (m)", type: "number", step: 0.5 },
    { key: "x2", label: "End X (m)", type: "number", step: 0.5 },
    { key: "z2", label: "End Z (m)", type: "number", step: 0.5 },
    WIDTH_FIELD,
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
    { key: "rotation", label: "Rotation (°)", type: "number", step: 5 },
  ],
};
