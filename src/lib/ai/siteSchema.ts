import { z } from "zod";
import {
  BALCONY_LIMITS,
  BUILDING_LIMITS,
  DECK_LIMITS,
  DOOR_LIMITS,
  DRIVEWAY_LIMITS,
  GARAGE_LIMITS,
  HOUSE_LIMITS,
  LANDSCAPE_LIMITS,
  PARKING_LIMITS,
  PATIO_LIMITS,
  POOL_LIMITS,
  ROAD_LIMITS,
  ROOM_LIMITS,
  SITE_OFFSET_LIMIT,
  SITE_POSITION_LIMIT,
  WINDOW_LIMITS,
} from "@/lib/house/constants";

/**
 * Per-feature shapes mirroring `src/types/house.ts` field-for-field. These are
 * reused two ways below: as-is for "add" ops (a brand new item must be fully
 * specified) and via `.partial()` for "update" ops (only the changed fields).
 */
const wallSchema = z
  .enum(["north", "south", "east", "west"])
  .describe("Which exterior wall of the house this is mounted on or measured from.");

const houseFieldsSchema = z
  .object({
    width: z.number().min(HOUSE_LIMITS.width.min).max(HOUSE_LIMITS.width.max),
    depth: z.number().min(HOUSE_LIMITS.depth.min).max(HOUSE_LIMITS.depth.max),
    floors: z.number().int().min(HOUSE_LIMITS.floors.min).max(HOUSE_LIMITS.floors.max),
    roof: z.enum(["flat", "gable", "hip"]),
  })
  .partial()
  .describe("Only include the house fields you're changing.");

const windowSchema = z.object({
  wall: wallSchema,
  level: z.number().int().min(0).describe("0-indexed floor this window sits on."),
  offset: z
    .number()
    .min(0)
    .describe("Distance in meters from the wall's start corner to the window's left edge."),
  width: z.number().min(WINDOW_LIMITS.width.min).max(WINDOW_LIMITS.width.max),
  height: z.number().min(WINDOW_LIMITS.height.min).max(WINDOW_LIMITS.height.max),
  sill: z
    .number()
    .min(WINDOW_LIMITS.sill.min)
    .max(WINDOW_LIMITS.sill.max)
    .describe("Height of the windowsill above the floor, in meters."),
});

const doorSchema = z.object({
  wall: wallSchema,
  level: z.number().int().min(0),
  offset: z.number().min(0),
  width: z.number().min(DOOR_LIMITS.width.min).max(DOOR_LIMITS.width.max),
  height: z.number().min(DOOR_LIMITS.height.min).max(DOOR_LIMITS.height.max),
});

const garageSchema = z.object({
  wall: wallSchema.describe("Which house wall the garage is attached flush against."),
  offset: z.number().min(SITE_OFFSET_LIMIT.min).max(SITE_OFFSET_LIMIT.max),
  width: z.number().min(GARAGE_LIMITS.width.min).max(GARAGE_LIMITS.width.max),
  depth: z.number().min(GARAGE_LIMITS.depth.min).max(GARAGE_LIMITS.depth.max),
  height: z.number().min(GARAGE_LIMITS.height.min).max(GARAGE_LIMITS.height.max),
});

const balconySchema = z.object({
  wall: wallSchema,
  level: z.number().int().min(0).describe("Floor the balcony projects from; usually 1 or higher."),
  offset: z.number().min(0),
  width: z.number().min(BALCONY_LIMITS.width.min).max(BALCONY_LIMITS.width.max),
  depth: z
    .number()
    .min(BALCONY_LIMITS.depth.min)
    .max(BALCONY_LIMITS.depth.max)
    .describe("How far the balcony projects outward from the wall, in meters."),
  railingHeight: z
    .number()
    .min(BALCONY_LIMITS.railingHeight.min)
    .max(BALCONY_LIMITS.railingHeight.max),
});

const patioSchema = z.object({
  wall: wallSchema,
  offset: z.number().min(SITE_OFFSET_LIMIT.min).max(SITE_OFFSET_LIMIT.max),
  width: z.number().min(PATIO_LIMITS.width.min).max(PATIO_LIMITS.width.max),
  depth: z.number().min(PATIO_LIMITS.depth.min).max(PATIO_LIMITS.depth.max),
});

const poolSchema = z.object({
  wall: wallSchema.describe("Wall the pool is positioned out from. Ignored if siteX/siteZ are provided."),
  offset: z.number().min(SITE_OFFSET_LIMIT.min).max(SITE_OFFSET_LIMIT.max),
  distance: z
    .number()
    .min(POOL_LIMITS.distance.min)
    .max(POOL_LIMITS.distance.max)
    .describe("Gap between the wall and the near edge of the pool, in meters."),
  width: z.number().min(POOL_LIMITS.width.min).max(POOL_LIMITS.width.max),
  depth: z.number().min(POOL_LIMITS.depth.min).max(POOL_LIMITS.depth.max),
  waterDepth: z
    .number()
    .min(POOL_LIMITS.waterDepth.min)
    .max(POOL_LIMITS.waterDepth.max)
    .describe("How deep the pool basin is, in meters."),
  siteX: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).optional()
    .describe("Absolute site X position — overrides wall/offset/distance for resort-scale pools."),
  siteZ: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).optional()
    .describe("Absolute site Z position — overrides wall/offset/distance for resort-scale pools."),
});

const drivewaySchema = z.object({
  wall: wallSchema,
  offset: z.number().min(SITE_OFFSET_LIMIT.min).max(SITE_OFFSET_LIMIT.max),
  width: z.number().min(DRIVEWAY_LIMITS.width.min).max(DRIVEWAY_LIMITS.width.max),
  length: z
    .number()
    .min(DRIVEWAY_LIMITS.length.min)
    .max(DRIVEWAY_LIMITS.length.max)
    .describe("How far the driveway extends outward from the wall, in meters."),
});

const materialAssignmentFieldsSchema = z
  .object({
    material: z
      .enum(["concrete", "stone", "wood", "glass", "metal", "stucco", "tile"])
      .describe("The material type for this surface."),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .describe("Hex color, e.g. #f5f3ee. Omit to use the new material's natural color."),
  })
  .partial();

const materialsFieldsSchema = z
  .object({
    exterior: materialAssignmentFieldsSchema.describe("Exterior wall material."),
    roof: materialAssignmentFieldsSchema.describe("Roof material."),
    trim: materialAssignmentFieldsSchema.describe("Window frame, door frame, and railing material."),
    decking: materialAssignmentFieldsSchema.describe("Patio, balcony platform, and pool deck material."),
  })
  .partial()
  .describe("Only include the zones you're changing.");

const buildingSchema = z.object({
  kind: z
    .enum(["villa", "restaurant", "reception", "gazebo", "outdoor_bar"])
    .describe("What kind of structure this is. gazebo = open pavilion with posts and hip roof. outdoor_bar = open-air counter with pergola."),
  x: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max)
    .describe("Absolute site X position (positive = east of main house center)."),
  z: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max)
    .describe("Absolute site Z position (positive = south of main house center)."),
  width: z.number().min(BUILDING_LIMITS.width.min).max(BUILDING_LIMITS.width.max),
  depth: z.number().min(BUILDING_LIMITS.depth.min).max(BUILDING_LIMITS.depth.max),
  floors: z.number().int().min(BUILDING_LIMITS.floors.min).max(BUILDING_LIMITS.floors.max),
  roof: z.enum(["flat", "gable", "hip"]),
});

const roadSchema = z.object({
  x1: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe("Road start X."),
  z1: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe("Road start Z."),
  x2: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe("Road end X."),
  z2: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe("Road end Z."),
  width: z.number().min(ROAD_LIMITS.width.min).max(ROAD_LIMITS.width.max),
});

const parkingSchema = z.object({
  x: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max),
  z: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max),
  width: z.number().min(PARKING_LIMITS.width.min).max(PARKING_LIMITS.width.max),
  depth: z.number().min(PARKING_LIMITS.depth.min).max(PARKING_LIMITS.depth.max),
});

const landscapeSchema = z.object({
  kind: z.enum(["garden", "lawn"]).describe("Garden is a planted area; lawn is open grass."),
  x: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max),
  z: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max),
  width: z.number().min(LANDSCAPE_LIMITS.width.min).max(LANDSCAPE_LIMITS.width.max),
  depth: z.number().min(LANDSCAPE_LIMITS.depth.min).max(LANDSCAPE_LIMITS.depth.max),
});

const deckSchema = z.object({
  x: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max)
    .describe("Absolute site X position (positive = east of main house center)."),
  z: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max)
    .describe("Absolute site Z position (positive = south of main house center)."),
  level: z.number().int().min(0).max(12)
    .describe("0 = ground level platform, 1+ = elevated to match that floor level."),
  width: z.number().min(DECK_LIMITS.width.min).max(DECK_LIMITS.width.max),
  depth: z.number().min(DECK_LIMITS.depth.min).max(DECK_LIMITS.depth.max),
  rotation: z.number().min(-180).max(180).optional()
    .describe("Y rotation in degrees. Optional."),
});

const roomSchema = z.object({
  type: z.enum(["kitchen", "living", "bedroom", "bathroom", "hallway", "dining", "office", "laundry", "gym"]).describe("What kind of room this is. gym renders with rubber flooring and equipment."),
  level: z.number().int().min(0).describe("0-indexed floor this room is on."),
  x: z
    .number()
    .min(0)
    .describe("Distance in meters from the house's interior west edge to the room's west edge."),
  z: z
    .number()
    .min(0)
    .describe("Distance in meters from the house's interior north edge to the room's north edge."),
  width: z.number().min(ROOM_LIMITS.width.min).max(ROOM_LIMITS.width.max),
  depth: z.number().min(ROOM_LIMITS.depth.min).max(ROOM_LIMITS.depth.max),
});

/** One feature type's add/update/remove op trio, keyed off a literal name (e.g. "Window"). */
function featureOps<Schema extends z.ZodObject<z.ZodRawShape>>(name: string, schema: Schema) {
  return [
    z.object({
      op: z.literal(`add${name}`),
      value: schema.describe("Full definition of the new item."),
    }),
    z.object({
      op: z.literal(`update${name}`),
      index: z.number().int().min(0).describe("Index of the existing item in the current JSON's array."),
      fields: schema.partial().describe("Only the fields you're changing on this item."),
    }),
    z.object({
      op: z.literal(`remove${name}`),
      index: z.number().int().min(0).describe("Index of the item to remove from the current JSON's array."),
    }),
  ] as const;
}

const patchOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("setHouse"), fields: houseFieldsSchema }),
  z.object({ op: z.literal("setMaterials"), fields: materialsFieldsSchema }),
  ...featureOps("Window", windowSchema),
  ...featureOps("Door", doorSchema),
  ...featureOps("Garage", garageSchema),
  ...featureOps("Balcony", balconySchema),
  ...featureOps("Patio", patioSchema),
  ...featureOps("Pool", poolSchema),
  ...featureOps("Driveway", drivewaySchema),
  ...featureOps("Room", roomSchema),
  ...featureOps("Building", buildingSchema),
  ...featureOps("Road", roadSchema),
  ...featureOps("Parking", parkingSchema),
  ...featureOps("Landscape", landscapeSchema),
  ...featureOps("Deck", deckSchema),
]);

export const aiPatchResponseSchema = z.object({
  summary: z
    .string()
    .describe("One short sentence (under ~20 words) telling the user what you changed, in plain language."),
  operations: z
    .array(patchOpSchema)
    .min(1)
    .describe(
      "The minimal set of operations needed to satisfy the instruction. Do not include any operation for something the instruction didn't ask you to change."
    ),
});

export type AiPatchOp = z.infer<typeof patchOpSchema>;
