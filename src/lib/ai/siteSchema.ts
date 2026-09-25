import { z } from "zod";
import {
  ARCH_LIMITS,
  BALCONY_LIMITS,
  BAY_LIMITS,
  BUILDING_LIMITS,
  CHIMNEY_LIMITS,
  CROSS_GABLE_LIMITS,
  CURVED_WALL_LIMITS,
  DORMER_LIMITS,
  FOUNDATION_LIMITS,
  PATH_LIMITS,
  RETAINING_WALL_LIMITS,
  ROCK_LIMITS,
  SLOPE_LIMITS,
  STAIRS_LIMITS,
  WATERWAY_LIMITS,
  DECK_LIMITS,
  DOOR_LIMITS,
  DRIVEWAY_LIMITS,
  GARAGE_LIMITS,
  HOUSE_LIMITS,
  LANDSCAPE_LIMITS,
  PARKING_LIMITS,
  PATIO_LIMITS,
  POOL_LIMITS,
  PORCH_LIMITS,
  ROAD_LIMITS,
  ROOM_LIMITS,
  SITE_OFFSET_LIMIT,
  SITE_POSITION_LIMIT,
  WINDOW_LIMITS,
} from "@/lib/house/constants";
import { FEATURE_TYPES, type FeatureType } from "@/lib/house/features/featureTypes";
import { COMPASS_SIDES, SITE_ENVIRONMENTS, TERRAIN_SLOPES } from "@/lib/house/siteSettings";
import { DESIGN_TIERS } from "@/lib/house/tiers";
import type { EditScope } from "./targeting";
import {
  BAY_FORMS,
  BUILDING_KINDS,
  DECK_SHAPES,
  EXTERIOR_ASSET_OPTIONS,
  EXTERIOR_ENUM_OPTIONS,
  LANDSCAPE_KINDS,
  PATH_SURFACES,
  POOL_SHAPES,
  SLOPE_FORMS,
  STAIR_FORMS,
  WATERWAY_KINDS,
  MATERIAL_TYPE_LIST,
  ROOF_TYPES,
  ROOM_TYPES,
} from "./capabilities";

/**
 * Per-feature shapes mirroring `src/types/house.ts` field-for-field. These are
 * reused two ways below: as-is for "add" ops (a brand new item must be fully
 * specified) and via `.partial()` for "update" ops (only the changed fields).
 */
const wallSchema = z
  .enum(["north", "south", "east", "west"])
  .describe("Which exterior wall of the house this is mounted on or measured from.");

const houseShape = {
  width: z.number().min(HOUSE_LIMITS.width.min).max(HOUSE_LIMITS.width.max),
  depth: z.number().min(HOUSE_LIMITS.depth.min).max(HOUSE_LIMITS.depth.max),
  floors: z.number().int().min(HOUSE_LIMITS.floors.min).max(HOUSE_LIMITS.floors.max),
  roof: z.enum(ROOF_TYPES),
};

function houseFieldsSchema(fields: readonly string[]) {
  const picked = Object.fromEntries(Object.entries(houseShape).filter(([key]) => fields.includes(key)));
  return z.object(picked).partial().describe("Only include the house fields you're changing.");
}

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
  shape: z.enum(POOL_SHAPES).optional().describe("Outline of the pool. rectangle is the default; rounded, oval and kidney are curved and read as more premium."),
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
  bend: z.number().min(-30).max(30).optional().describe("Sideways bow in meters (signed) that curves the driveway. Omit or 0 for a straight one."),
});

const buildingSchema = z.object({
  kind: z
    .enum(BUILDING_KINDS)
    .describe("What kind of structure this is. gazebo = open pavilion with posts and hip roof. outdoor_bar = open-air counter with pergola. shed / detached_garage = small outbuildings that take on the project style (log walls and steep gable on a cabin, plate roof on a modern house)."),
  x: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max)
    .describe("Absolute site X position (positive = east of main house center)."),
  z: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max)
    .describe("Absolute site Z position (positive = south of main house center)."),
  width: z.number().min(BUILDING_LIMITS.width.min).max(BUILDING_LIMITS.width.max),
  depth: z.number().min(BUILDING_LIMITS.depth.min).max(BUILDING_LIMITS.depth.max),
  floors: z.number().int().min(BUILDING_LIMITS.floors.min).max(BUILDING_LIMITS.floors.max),
  roof: z.enum(ROOF_TYPES),
});

const roadSchema = z.object({
  x1: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe("Road start X."),
  z1: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe("Road start Z."),
  x2: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe("Road end X."),
  z2: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe("Road end Z."),
  width: z.number().min(ROAD_LIMITS.width.min).max(ROAD_LIMITS.width.max),
  bend: z.number().min(-60).max(60).optional().describe("Sideways bow in meters (signed) that curves the road. Omit or 0 for a straight one."),
});

const parkingSchema = z.object({
  x: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max),
  z: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max),
  width: z.number().min(PARKING_LIMITS.width.min).max(PARKING_LIMITS.width.max),
  depth: z.number().min(PARKING_LIMITS.depth.min).max(PARKING_LIMITS.depth.max),
});

const landscapeSchema = z.object({
  kind: z.enum(LANDSCAPE_KINDS).describe("Garden is a planted area; lawn is open grass; clearing is an oval opening among trees (use it in forest or woodland sites)."),
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
  shape: z.enum(DECK_SHAPES).optional().describe("Outline of the platform. rectangle is the default; rounded, oval and arc (one bowed edge, for a view terrace) are curved."),
});

const porchSchema = z.object({
  wall: wallSchema.describe("Ground-floor wall the porch is attached to (the entrance wall)."),
  offset: z.number().min(0).describe("Distance in meters from the wall's start corner to the porch's left edge."),
  width: z.number().min(PORCH_LIMITS.width.min).max(PORCH_LIMITS.width.max).describe("Length of the porch along the wall. Must fit within the wall."),
  depth: z.number().min(PORCH_LIMITS.depth.min).max(PORCH_LIMITS.depth.max).describe("How far the porch projects from the wall, in meters."),
});

const chimneySchema = z.object({
  wall: wallSchema.describe("Wall the chimney stack is built against — normally a gable-end wall."),
  offset: z.number().min(0).describe("Distance in meters from the wall's start corner to the chimney's left edge."),
  width: z.number().min(CHIMNEY_LIMITS.width.min).max(CHIMNEY_LIMITS.width.max).describe("Chimney width along the wall."),
  depth: z.number().min(CHIMNEY_LIMITS.depth.min).max(CHIMNEY_LIMITS.depth.max).describe("How far the stack projects from the wall."),
});


// ── Architectural richness: curved, arched and layered parts ──

const siteXZ = (what: string) => ({
  x: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe(`${what} — absolute site X (positive = east of the main house center).`),
  z: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe(`${what} — absolute site Z (positive = south of the main house center).`),
});
const siteLine = (what: string) => ({
  x1: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe(`${what} start X.`),
  z1: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe(`${what} start Z.`),
  x2: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe(`${what} end X.`),
  z2: z.number().min(SITE_POSITION_LIMIT.min).max(SITE_POSITION_LIMIT.max).describe(`${what} end Z.`),
});

const curvedWallSchema = z.object({
  ...siteXZ("Centre of the circle the wall curves around"),
  radius: z.number().min(CURVED_WALL_LIMITS.radius.min).max(CURVED_WALL_LIMITS.radius.max).describe("Outer radius in meters."),
  startAngle: z.number().min(-360).max(360).describe("Where the arc starts in degrees: 0 = east, 90 = south."),
  sweep: z.number().min(CURVED_WALL_LIMITS.sweep.min).max(CURVED_WALL_LIMITS.sweep.max).describe("How far the arc sweeps, in degrees (360 = a full ring)."),
  height: z.number().min(CURVED_WALL_LIMITS.height.min).max(CURVED_WALL_LIMITS.height.max),
  thickness: z.number().min(CURVED_WALL_LIMITS.thickness.min).max(CURVED_WALL_LIMITS.thickness.max),
});

const archSchema = z.object({
  wall: wallSchema.describe("Wall the archway is framed on."),
  level: z.number().int().min(0).describe("0-indexed floor the arch stands on."),
  offset: z.number().min(0).describe("Distance in meters from the wall's start corner to the arch's left edge."),
  width: z.number().min(ARCH_LIMITS.width.min).max(ARCH_LIMITS.width.max).describe("Overall width including piers. Several side by side make an arcade."),
  height: z.number().min(ARCH_LIMITS.height.min).max(ARCH_LIMITS.height.max).describe("Height of the opening from the floor to the top of the curve."),
  depth: z.number().min(ARCH_LIMITS.depth.min).max(ARCH_LIMITS.depth.max).describe("How far the arch surround projects from the wall."),
});

const baySchema = z.object({
  wall: wallSchema.describe("Wall the bay or turret is attached to."),
  level: z.number().int().min(0).describe("0-indexed floor it starts on."),
  offset: z.number().min(0).describe("Distance in meters from the wall's start corner to its left edge. Use 0 (or wall length − width) for a corner turret."),
  width: z.number().min(BAY_LIMITS.width.min).max(BAY_LIMITS.width.max).describe("Width along the wall (a turret's diameter)."),
  depth: z.number().min(BAY_LIMITS.depth.min).max(BAY_LIMITS.depth.max).describe("How far it projects from the wall. A turret's projection cannot exceed its width."),
  levels: z.number().int().min(BAY_LIMITS.levels.min).max(BAY_LIMITS.levels.max).describe("Storeys it climbs. A turret may rise one storey above the house."),
  form: z.enum(BAY_FORMS).describe("angled = three-sided bay window; round = half-round bay; turret = full round tower with a conical roof."),
});

const foundationSchema = z.object({
  steps: z.number().int().min(FOUNDATION_LIMITS.steps.min).max(FOUNDATION_LIMITS.steps.max).describe("Number of stepped tiers around the base of the house."),
  riser: z.number().min(FOUNDATION_LIMITS.riser.min).max(FOUNDATION_LIMITS.riser.max).describe("Height of each tier in meters (total stays under 1 m)."),
  projection: z.number().min(FOUNDATION_LIMITS.projection.min).max(FOUNDATION_LIMITS.projection.max).describe("How far each tier steps out from the one above."),
});

const stairsSchema = z.object({
  wall: wallSchema.describe("Wall the stairs climb to — the wall with the door."),
  offset: z.number().min(0).describe("Distance in meters from the wall's start corner to the stairs' left edge; line it up with the door."),
  width: z.number().min(STAIRS_LIMITS.width.min).max(STAIRS_LIMITS.width.max),
  rise: z.number().min(STAIRS_LIMITS.rise.min).max(STAIRS_LIMITS.rise.max).describe("Total height climbed, in meters."),
  form: z.enum(STAIR_FORMS).describe("straight flight, curved fan of treads, or angled dog-leg with a landing."),
  turn: z.enum(["left", "right"]).describe("Which way a curved or angled flight turns as it descends."),
});

const dormerSchema = z.object({
  wall: wallSchema.describe("Wall the roof slope faces. Only the two long walls of a gable or hip roof have slopes."),
  offset: z.number().min(0).describe("Distance in meters along that wall to the dormer's left edge."),
  width: z.number().min(DORMER_LIMITS.width.min).max(DORMER_LIMITS.width.max),
});

const crossGableSchema = z.object({
  wall: wallSchema.describe("Wall the cross gable faces. Only the two long walls of a gable or hip roof have slopes."),
  offset: z.number().min(0).describe("Distance in meters along that wall to the cross gable's left edge."),
  width: z.number().min(CROSS_GABLE_LIMITS.width.min).max(CROSS_GABLE_LIMITS.width.max).describe("Width of the gabled wing; it is trimmed so it never rises above the main ridge."),
});

const retainingWallSchema = z.object({
  ...siteLine("Wall"),
  height: z.number().min(RETAINING_WALL_LIMITS.height.min).max(RETAINING_WALL_LIMITS.height.max),
  thickness: z.number().min(RETAINING_WALL_LIMITS.thickness.min).max(RETAINING_WALL_LIMITS.thickness.max),
  bend: z.number().min(RETAINING_WALL_LIMITS.bend.min).max(RETAINING_WALL_LIMITS.bend.max).describe("Sideways bow in meters (signed). 0 = straight."),
});

const pathSchema = z.object({
  ...siteLine("Path"),
  width: z.number().min(PATH_LIMITS.width.min).max(PATH_LIMITS.width.max),
  bend: z.number().min(PATH_LIMITS.bend.min).max(PATH_LIMITS.bend.max).describe("Sideways bow in meters (signed). 0 = straight; 2–6 gives a natural curve."),
  surface: z.enum(PATH_SURFACES).describe("gravel, flagstone stepping slabs, dirt, or a boardwalk of planks."),
});

const waterwaySchema = z.object({
  kind: z.enum(WATERWAY_KINDS).describe("river is wide and slow; stream is narrow."),
  ...siteLine("Waterway"),
  width: z.number().min(WATERWAY_LIMITS.width.min).max(WATERWAY_LIMITS.width.max).describe("Water width in meters (river 5–12, stream 1.5–4)."),
  bend: z.number().min(WATERWAY_LIMITS.bend.min).max(WATERWAY_LIMITS.bend.max).describe("Overall sideways bow in meters (signed)."),
  meander: z.number().min(WATERWAY_LIMITS.meander.min).max(WATERWAY_LIMITS.meander.max).describe("How much it wanders, 0 (straight) to 1 (very winding)."),
});

const rockClusterSchema = z.object({
  ...siteXZ("Centre of the rock group"),
  radius: z.number().min(ROCK_LIMITS.radius.min).max(ROCK_LIMITS.radius.max).describe("How widely the rocks are spread, in meters."),
  count: z.number().int().min(ROCK_LIMITS.count.min).max(ROCK_LIMITS.count.max),
  size: z.number().min(ROCK_LIMITS.size.min).max(ROCK_LIMITS.size.max).describe("Diameter of the largest boulder in meters."),
});

const slopeSchema = z.object({
  ...siteXZ("Centre of the shaped ground"),
  width: z.number().min(SLOPE_LIMITS.width.min).max(SLOPE_LIMITS.width.max),
  depth: z.number().min(SLOPE_LIMITS.depth.min).max(SLOPE_LIMITS.depth.max),
  rise: z.number().min(SLOPE_LIMITS.rise.min).max(SLOPE_LIMITS.rise.max).describe("Height gained, in meters."),
  rotation: z.number().min(-180).max(180).describe("Rotation about the vertical axis in degrees."),
  form: z.enum(SLOPE_FORMS).describe("mound = grassy hill, ramp = eased incline, terraced = stepped stone-faced tiers."),
});

const roomSchema = z.object({
  type: z.enum(ROOM_TYPES).describe("What kind of room this is. gym renders with rubber flooring and equipment."),
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

// ── Materials & exterior options (built per request so imported assets can be enumerated) ──

function materialAssignmentSchema(assetIds: readonly string[]) {
  return z
    .object({
      material: z.enum(MATERIAL_TYPE_LIST).describe("The material type for this surface."),
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .describe("Hex color, e.g. #f5f3ee. Omit to use the new material's natural color."),
      roughness: z.number().min(0).max(1),
      metalness: z.number().min(0).max(1),
      ...(assetIds.length > 0
        ? {
            assetId: z.enum(assetIds as [string, ...string[]]).describe("Imported PBR texture set to use instead of a flat color."),
            uvScale: z.number().min(0.1).max(20).describe("Texture repeat scale across the face."),
          }
        : {}),
    })
    .partial();
}

function materialsFieldsSchema(zones: readonly string[], assetIds: readonly string[]) {
  const zoneDescriptions: Record<string, string> = {
    exterior: "Exterior wall material.",
    roof: "Roof material.",
    trim: "Window frame, door frame, and railing material.",
    decking: "Patio, balcony platform, and pool deck material.",
  };
  const assignment = materialAssignmentSchema(assetIds);
  return z
    .object(Object.fromEntries(zones.map((zone) => [zone, assignment.optional().describe(zoneDescriptions[zone] ?? zone)])))
    .describe("Only include the zones you're changing.");
}

function exteriorFieldsSchema(assetIds: readonly string[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, values] of Object.entries(EXTERIOR_ENUM_OPTIONS)) {
    shape[key] = z.enum(values as [string, ...string[]]).nullable().optional();
  }
  if (assetIds.length > 0) {
    for (const [assetKey, scaleKey] of EXTERIOR_ASSET_OPTIONS) {
      shape[assetKey] = z.enum(assetIds as [string, ...string[]]).nullable().optional();
      shape[scaleKey] = z.number().min(0.1).max(20).nullable().optional();
    }
  }
  return z.object(shape).describe("Only include the options you're changing. null clears an option.");
}

// ── Site environment ──

const siteShape = {
  environment: z.enum(SITE_ENVIRONMENTS).describe("The kind of land the house sits on; drives the terrain and scenery around it."),
  viewDirection: z.enum(COMPASS_SIDES).describe("Compass side the main view faces (ocean, valley, sunrise, garden)."),
  terrainSlope: z.enum(TERRAIN_SLOPES).describe("How much the land rises behind the house, away from the view."),
  approachSide: z.enum(COMPASS_SIDES).describe("Compass side the access road and entrance arrive from."),
  designTier: z.enum(DESIGN_TIERS).describe("How elaborate the project is: starter (simple, compact), comfort (well-rounded family home), luxury (layered silhouette, premium materials, shaped outdoor spaces) or estate (grand, richly layered, with turrets, arches and formal grounds). A design steer, not a cost estimate."),
};

const siteFieldsSchema = z.object(siteShape).partial().describe("Only include the site fields you're changing.");

// ── Feature ops ─────────────────────────────────────────────────────────────

/** One feature type's add/update/remove op trio. Existing items are addressed by stable id. */
function featureOps<Schema extends z.ZodObject<z.ZodRawShape>>(name: string, schema: Schema) {
  const id = z.string().min(1).describe("Stable id of the existing item, copied exactly from TARGETS.");
  return [
    z.object({
      op: z.literal(`add${name}`),
      value: schema.describe("Full definition of the new item."),
    }),
    z.object({
      op: z.literal(`update${name}`),
      id,
      fields: schema.partial().describe("Only the fields you're changing on this item."),
    }),
    z.object({
      op: z.literal(`remove${name}`),
      id,
    }),
  ] as const;
}

const FEATURE_SCHEMAS: Record<FeatureType, z.ZodObject<z.ZodRawShape>> = {
  window: windowSchema,
  door: doorSchema,
  garage: garageSchema,
  balcony: balconySchema,
  patio: patioSchema,
  pool: poolSchema,
  driveway: drivewaySchema,
  room: roomSchema,
  building: buildingSchema,
  road: roadSchema,
  parking: parkingSchema,
  landscape: landscapeSchema,
  deck: deckSchema,
  porch: porchSchema,
  chimney: chimneySchema,
  curvedWall: curvedWallSchema,
  arch: archSchema,
  bay: baySchema,
  foundation: foundationSchema,
  stairs: stairsSchema,
  dormer: dormerSchema,
  crossGable: crossGableSchema,
  retainingWall: retainingWallSchema,
  path: pathSchema,
  waterway: waterwaySchema,
  rockCluster: rockClusterSchema,
  slope: slopeSchema,
};

const FEATURE_OP_SCHEMAS = Object.fromEntries(
  FEATURE_TYPES.map((type) => [type, featureOps(type.charAt(0).toUpperCase() + type.slice(1), FEATURE_SCHEMAS[type])])
) as Record<FeatureType, ReturnType<typeof featureOps>>;

/** Shape of one operation as it leaves the model (loosely typed; validated per scope before applying). */
export interface AiOperation {
  op: string;
  id?: string;
  value?: Record<string, unknown>;
  fields?: Record<string, unknown>;
}

export interface AiPatchResponse {
  summary: string;
  operations: AiOperation[];
}

/** Per-op Zod schemas for one scope. Used only for local validation; never sent to the model. */
function buildOperationSchemas(scope: EditScope, assetIds: readonly string[]) {
  const ops: z.ZodObject<z.ZodRawShape>[] = [];
  if (scope.houseFields.length > 0) ops.push(z.object({ op: z.literal("setHouse"), fields: houseFieldsSchema(scope.houseFields) }));
  if (scope.materialZones.length > 0) {
    ops.push(z.object({ op: z.literal("setMaterials"), fields: materialsFieldsSchema(scope.materialZones, assetIds) }));
  }
  if (scope.site) ops.push(z.object({ op: z.literal("setSite"), fields: siteFieldsSchema }));
  if (scope.exterior) ops.push(z.object({ op: z.literal("setExteriorOptions"), fields: exteriorFieldsSchema(assetIds) }));
  for (const type of scope.featureTypes) ops.push(...FEATURE_OP_SCHEMAS[type]);
  return ops;
}

const isAddOrSet = (o: z.ZodObject<z.ZodRawShape>) => !/^(update|remove)/.test(opName(o));
const opName = (o: z.ZodObject<z.ZodRawShape>) => (o.shape.op as z.ZodLiteral<string>).value;

/** Ops offered for the initial generation: the house/site shell are top-level fields, and a blank project has nothing to update or remove. */
function generationOperationSchemas(scope: EditScope, assetIds: readonly string[]) {
  return buildOperationSchemas({ ...scope, houseFields: [], site: false }, assetIds).filter(isAddOrSet);
}

/**
 * The operation shape sent to OpenAI: ONE flat object, no oneOf/anyOf. `op` is a closed enum of
 * the ops the scope permits; `value`/`fields` are free-form objects whose contents are validated
 * locally (see validateOperations) against the per-op schemas.
 */
function flatOperationSchema(opNames: readonly string[]) {
  return z.object({
    op: z.enum(opNames as [string, ...string[]]).describe("The operation to perform."),
    id: z.string().optional().describe("Stable id of the existing item, copied exactly from TARGETS. Only for update*/remove* ops."),
    value: z.record(z.string(), z.unknown()).optional().describe("add* ops only: the complete definition of the new item (every field)."),
    fields: z.record(z.string(), z.unknown()).optional().describe("set* and update* ops only: just the fields being changed."),
  });
}

type JsonSchemaNode = { type?: string; pattern?: string; enum?: unknown[]; minimum?: number; maximum?: number; properties?: Record<string, JsonSchemaNode>; required?: string[]; anyOf?: JsonSchemaNode[]; items?: JsonSchemaNode };

function describeNode(node: JsonSchemaNode): string {
  if (node.anyOf) return node.anyOf.map(describeNode).filter((d) => d !== "null").join("|");
  if (node.enum) return node.enum.map((v) => JSON.stringify(v)).join("|");
  if (node.type === "object" && node.properties) return describeObject(node);
  if (node.type === "string" && node.pattern) return `string matching ${node.pattern}`;
  const range = node.minimum !== undefined || node.maximum !== undefined ? `(${node.minimum ?? ""}..${node.maximum ?? ""})` : "";
  return `${node.type === "integer" ? "int" : (node.type ?? "any")}${range}`;
}

function describeObject(node: JsonSchemaNode): string {
  const required = new Set(node.required ?? []);
  const parts = Object.entries(node.properties ?? {}).map(([key, child]) => `${key}${required.has(key) ? "" : "?"}: ${describeNode(child)}`);
  return `{ ${parts.join(", ")} }`;
}

/**
 * One compact line per permitted op describing its `value`/`fields` payload, derived from the same
 * Zod schemas that validate it locally. The flat model-facing schema carries no payload shape, so
 * this is how the model learns field names, enums and limits.
 */
export function describeOperationPayloads(scope: EditScope, assetIds: readonly string[] = [], generation = false): string {
  const schemas = generation ? generationOperationSchemas(scope, assetIds) : buildOperationSchemas(scope, assetIds);
  return schemas
    .map((schema) => {
      const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as JsonSchemaNode;
      const { op, ...rest } = json.properties ?? {};
      void op;
      const payload = Object.entries(rest).filter(([key]) => key !== "id").map(([key, child]) => `${key} ${describeNode(child)}`);
      return `- ${opName(schema)}${rest.id ? " (id)" : ""}: ${payload.join("; ")}`;
    })
    .join("\n");
}

function validateAgainst(
  operations: readonly AiOperation[],
  schemas: readonly z.ZodObject<z.ZodRawShape>[]
): { valid: AiOperation[]; invalid: string[] } {
  const byName = new Map(schemas.map((s) => [opName(s), s]));
  const valid: AiOperation[] = [];
  const invalid: string[] = [];
  for (const op of operations) {
    const schema = byName.get(op.op);
    if (!schema) {
      invalid.push(`"${op.op}" is not an operation available here`);
      continue;
    }
    // Only the keys the op defines are passed on; parse strips anything else and rejects bad payloads.
    const candidate = Object.fromEntries(
      Object.entries({ op: op.op, id: op.id, value: op.value, fields: op.fields }).filter(([, v]) => v !== undefined && v !== null)
    );
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      invalid.push(`"${op.op}" has an invalid payload at ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      continue;
    }
    valid.push(parsed.data as unknown as AiOperation);
  }
  return { valid, invalid };
}

/** Local validation of model-produced ops for a scoped edit. Invalid ops are reported, never applied. */
export function validateOperations(operations: readonly AiOperation[], scope: EditScope, assetIds: readonly string[] = []) {
  return validateAgainst(operations, buildOperationSchemas(scope, assetIds));
}

/** Local validation of model-produced ops for the initial generation (add and set ops only). */
export function validateGenerationOperations(operations: readonly AiOperation[], scope: EditScope, assetIds: readonly string[] = []) {
  return validateAgainst(operations, generationOperationSchemas(scope, assetIds));
}

/**
 * Builds the structured-output schema for one request. The model-facing schema is flat (see
 * flatOperationSchema); scope is enforced by the closed `op` enum here and again, with full
 * per-field payload validation, by validateOperations before anything is applied.
 */
export function buildPatchResponseSchema(scope: EditScope, assetIds: readonly string[] = []) {
  const schema = z.object({
    summary: z
      .string()
      .describe("One short sentence (under ~20 words) telling the user what you changed, in plain language."),
    operations: z
      .array(flatOperationSchema(buildOperationSchemas(scope, assetIds).map(opName)))
      .min(1)
      .describe(
        "The minimal set of operations needed to satisfy the instruction. Do not include any operation for something the instruction didn't ask you to change."
      ),
  });
  return schema as unknown as z.ZodType<AiPatchResponse>;
}

/** Shape of a new-project generation: the required house shell plus add/set ops for everything else. */
export interface AiGenerationResponse {
  summary: string;
  timeOfDay?: "morning" | "midday" | "sunset" | "night";
  house: { width: number; depth: number; floors: number; roof: string };
  site: { environment: string; viewDirection: string; terrainSlope: string; approachSide: string; designTier?: string };
  operations: AiOperation[];
}

/**
 * Schema for the initial generation. The house shell is a required top-level object (so a
 * result without footprint, floors or roof cannot exist); everything else is expressed with
 * the same typed add/set ops as scoped edits (flat on the wire, validated locally).
 */
export function buildGenerationResponseSchema(scope: EditScope, assetIds: readonly string[] = []) {
  const schema = z.object({
    summary: z.string().describe("One or two plain-language sentences describing the design you created."),
    timeOfDay: z.enum(["morning", "midday", "sunset", "night"]).optional()
      .describe("Lighting that best shows off the design or matches the brief. Omit if the brief doesn't imply one."),
    house: z.object(houseShape).describe("The main building's footprint (meters), number of floors and roof form."),
    site: z.object(siteShape).describe("The land around the house: environment, view direction, slope and approach side."),
    operations: z
      .array(flatOperationSchema(generationOperationSchemas(scope, assetIds).map(opName)))
      .min(1)
      .describe("setMaterials, setExteriorOptions and add* operations that build out the design."),
  });
  return schema as unknown as z.ZodType<AiGenerationResponse>;
}
