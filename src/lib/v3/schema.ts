import { z } from "zod";

const n = z.number().finite();
const vector = z.array(n).length(3);
const material = z.object({ id: z.string().min(1).max(48), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), roughness: n.min(0).max(1).optional(), metalness: n.min(0).max(1).optional(), opacity: n.min(0).max(1).optional(), surface: z.enum(["concrete", "stone", "wood", "glass", "metal", "stucco", "paving", "water", "grass"]).optional() }).strict();
const region = z.object({ x: n, z: n, width: n.positive(), depth: n.positive(), rotation: n.optional() }).strict();
const siteLevel = z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), elevation: n, region, role: z.string().min(1).max(80).optional(), supportType: z.enum(["terrain", "pad", "terrace", "slab", "deck", "roof", "object"]), access: z.enum(["entry", "arrival"]).optional() }).strict();
// New Terra output is always world-space [x, y, z]. Legacy [x, z] input is
// deliberately accepted only by the runtime compatibility normalizer.
const routePoint = z.array(n).length(3);
const siteConnection = z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), fromLevelId: z.string(), toLevelId: z.string(), type: z.enum(["driveway", "path", "stair", "ramp"]), route: z.array(routePoint).min(2).max(24), width: n.positive().max(30), maxGrade: n.positive().max(1).optional(), surfaceObjectId: z.string().optional() }).strict();
const siteTransition = z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), fromLevelId: z.string(), toLevelId: z.string(), type: z.enum(["natural-slope", "graded-slope", "retaining-edge", "stair", "ramp"]), objectId: z.string().optional() }).strict();
const hierarchy = z.object({ levels: z.array(siteLevel).min(1).max(24), connections: z.array(siteConnection).max(32), transitions: z.array(siteTransition).max(32).optional() }).strict();
const supportKind = z.enum(["terrain", "pad", "terrace", "slab", "deck", "roof", "object"]);
const supportRelationship = z.enum(["rests-on", "attached-to", "edge-hosted", "terrain-following", "embedded-in", "cantilevered-from", "suspended-from"]);
const supportGrounding = z.enum(["grounded", "embedded", "floating", "suspended", "cantilevered"]);
// Runtime and edit compatibility for persisted V3 scenes. `objectId` and host-less
// terrain/level support predate the new-generation contract below.
const supportRef = z.object({ kind: supportKind, levelId: z.string().optional(), objectId: z.string().optional(), hostId: z.string().optional(), relationship: supportRelationship.optional(), grounding: supportGrounding.optional() }).strict();
// Model-facing support is ONE flat, fully-required object: no anyOf/oneOf, no optional nesting, no
// conditional logic. Unused fields carry neutral values ("" / "none" / "grounded") and are folded into
// the richer runtime `V3SupportRef` by `normalizeV3GenerationOutput` immediately after parsing.
const generationSupportRef = z.object({
  kind: z.enum(["none", ...supportKind.options]),
  levelId: z.string(),
  hostId: z.string(),
  relationship: z.enum(["none", ...supportRelationship.options]),
  grounding: supportGrounding,
}).strict();
const generationHex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const object = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  type: z.enum(["volume", "wall", "slab", "surface", "glass-panel", "opening", "column", "beam", "railing", "stair", "ramp", "roof", "canopy", "path", "retaining-wall", "fence", "gate", "terrain-region", "pool", "water-surface", "proxy-asset", "native-asset", "light"]),
  semanticRole: z.string().min(1).max(80), label: z.string().min(1).max(100),
  transform: z.object({ position: vector, rotation: vector, scale: vector }).strict(), dimensions: vector,
  material, collision: z.enum(["solid", "walkable", "passable", "water", "none"]).optional(),
  parentId: z.string().optional(), groupId: z.string().optional(), hostId: z.string().optional(),
  source: z.object({ kind: z.enum(["proxy", "glb", "native"]), assetId: z.string().optional(), replaceable: z.boolean().optional() }).strict().optional(),
  terrain: z.object({ operation: z.enum(["slopeRegion", "raiseRegion", "lowerRegion", "createTerrace", "cutIntoSlope", "gradePath"]), rise: n.optional(), direction: z.enum(["x", "z", "-x", "-z"]).optional() }).strict().optional(),
  support: supportRef.optional(),
  fromSupportId: z.string().optional(), toSupportId: z.string().optional(),
  metadata: z.record(z.string(), z.union([z.string(), n, z.boolean()])).optional(),
}).strict().superRefine((value, ctx) => {
  const inert = ["terrain-region", "light", "opening", "glass-panel", "roof", "canopy", "wall", "column", "beam"].includes(value.type);
  const intentionallyElevated = value.support?.grounding && value.support.grounding !== "grounded";
  if (!inert && !intentionallyElevated && !value.support && value.type !== "stair" && value.type !== "ramp") ctx.addIssue({ code: "custom", message: "Physical objects must declare support.", path: ["support"] });
  if (value.support?.relationship && value.support.relationship !== "terrain-following" && !value.support.hostId && !value.support.objectId) ctx.addIssue({ code: "custom", message: "A physical support relationship needs a hostId.", path: ["support", "hostId"] });
  if ((value.type === "stair" || value.type === "ramp") && (!value.fromSupportId || !value.toSupportId)) ctx.addIssue({ code: "custom", message: "Vertical connectors must declare both support endpoints.", path: ["fromSupportId"] });
});

// Flat on purpose: terrain/source are optional primitives rather than optional nested objects, `metadata`
// (a free-form map) is not offered to Terra, and there are no refinements the provider cannot see.
const generationObject = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  type: z.enum(["volume", "wall", "slab", "surface", "glass-panel", "opening", "column", "beam", "railing", "stair", "ramp", "roof", "canopy", "path", "retaining-wall", "fence", "gate", "terrain-region", "pool", "water-surface", "proxy-asset", "native-asset", "light"]),
  semanticRole: z.string().min(1).max(80), label: z.string().min(1).max(100),
  transform: z.object({ position: vector, rotation: vector, scale: vector }).strict(), dimensions: vector,
  material, collision: z.enum(["solid", "walkable", "passable", "water", "none"]).optional(),
  parentId: z.string().optional(), groupId: z.string().optional(), hostId: z.string().optional(),
  sourceKind: z.enum(["proxy", "glb", "native"]).optional(), sourceAssetId: z.string().optional(), sourceReplaceable: z.boolean().optional(),
  terrainOperation: z.enum(["slopeRegion", "raiseRegion", "lowerRegion", "createTerrace", "cutIntoSlope", "gradePath"]).optional(), terrainRise: n.optional(), terrainDirection: z.enum(["x", "z", "-x", "-z"]).optional(),
  support: generationSupportRef,
  fromSupportId: z.string().optional(), toSupportId: z.string().optional(),
}).strict();

const generationHierarchy = z.object({ levels: z.array(siteLevel).min(1).max(24), connections: z.array(siteConnection).max(32), transitions: z.array(siteTransition).max(32) }).strict();

export const v3SceneOutputSchema = z.object({
  version: z.literal(3),
  site: z.object({ width: n.positive().max(1000), depth: n.positive().max(1000), baseElevation: n.optional(), groundColor: generationHex.optional() }).strict(),
  siteHierarchy: generationHierarchy,
  // A first-pass mansion needs dozens of objects, but an unbounded object list
  // is both less coherent and risks exhausting the provider's output cap.
  objects: z.array(generationObject).min(1).max(72),
  relationships: z.array(z.object({ from: z.string(), to: z.string(), kind: z.enum(["supports", "contains", "aligns", "connects", "hosts"]) }).strict()).max(96),
}).strict();

/** What Terra emits for a new scene; `normalizeV3GenerationOutput` turns it into the runtime `V3Scene`. */
export type V3GenerationOutput = z.infer<typeof v3SceneOutputSchema>;

export const v3EditOutputSchema = z.object({
  intent: z.string().min(1).max(300),
  operations: z.array(z.object({
    op: z.enum(["create", "delete", "move", "rotate", "resize", "changeMaterial", "attach", "detach", "duplicate", "setSupport", "setConnectorEndpoints", "replaceSiteHierarchy"]), target: z.string().optional(), object: object.optional(), position: vector.optional(), rotation: vector.optional(), dimensions: vector.optional(), material: material.optional(), hostId: z.string().optional(), support: supportRef.optional(), fromSupportId: z.string().optional(), toSupportId: z.string().optional(), id: z.string().optional(), hierarchy: hierarchy.optional(),
  }).strict()).min(1).max(12),
}).strict();

/** Stored with usage so contract growth is observable without retaining model content. */
export const V3_SCENE_SCHEMA_BYTES = JSON.stringify(z.toJSONSchema(v3SceneOutputSchema)).length;

export const V3_SCENE_ARCHITECT_PROMPT = `You are Terra, the single V3 Scene Architect. Return one complete, compact persistent scene for the request. Compose general primitives; do not use house/villa/mansion-specific schemas. You design the site hierarchy and support graph as one coherent scene: include siteHierarchy with level regions/elevations, physical connections and transitions. Use general roles, not building-specific names. Mark one entry level and any arrival level using access. Every occupiable exterior surface belongs to a level. Every object has a flat support object with all five fields: kind, levelId, hostId, relationship, grounding. Use neutral values for anything unused: levelId "", hostId "", relationship "none", grounding "grounded", and kind "none" when the object needs no support (lights, openings, glass, terrain regions). Direct site support: kind plus levelId, relationship "none". Object support: kind "object", hostId naming an existing object, and a relationship (rests-on, attached-to, edge-hosted, terrain-following, embedded-in, cantilevered-from, suspended-from); never set a relationship without a hostId (terrain-following may leave hostId ""). Objects that rest on something reference that support; edge-mounted objects reference their host; intentionally elevated objects declare why. Every stair or ramp declares fromSupportId and toSupportId (site level or support object ids) and its endpoints physically meet them. Optional fields may be omitted rather than guessed. Every hierarchy connection route is a world-space polyline of [x, y, z] points: x = east/west, y = elevation, z = north/south. Driveway/ramp routes are polylines: keep grade reasonable (driveway normally <= 15%, ramp <= 8.3%) and add route length/switchbacks when needed. Terrain is generated after hierarchy, so model terrain regions as natural grades and level regions as pads/terraces. Retaining edges must separate actual grade differences. Every visible object has a stable id, transform, dimensions, material and semantic role. Use proxy-asset for unavailable furnishings/trees/gates and mark it replaceable. Include collision class: solid for barriers, walkable for floors/decks/stairs/paths/terrain, passable for openings, water for pools. For large homes, aim for 35–60 concise objects and never exceed 72; omit optional metadata/source fields unless needed. Keep ids, labels, semantic roles, and material ids short. Do not explain; output only the schema.`;
