import { v3EstatePlanSchema, V3_ESTATE_PLAN_PROMPT, V3_CREATIVE_ARCHITECTURE_PROMPT } from './estatePlan';
import { V3_LUXURY_SCALE_PROMPT } from "./luxuryScale";
import { V3_BLUEPRINT_FIRST_PROMPT } from './blueprintGeneration';
import { v3CompositionSchema, v3GenerationCompositionSchema, V3_COMPOSITION_PROMPT } from "./composition";
import { z } from "zod";

const n = z.number().finite();
const vector = z.array(n).length(3);
const material = z.object({ id: z.string().min(1).max(48), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), roughness: n.min(0).max(1).optional(), metalness: n.min(0).max(1).optional(), opacity: n.min(0).max(1).optional(), surface: z.enum(["concrete", "stone", "wood", "glass", "metal", "stucco", "paving", "water", "grass"]).optional() }).strict();
const region = z.object({ x: n, z: n, width: n.positive(), depth: n.positive(), rotation: n.optional() }).strict();
const siteLevel = z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), elevation: n, region, role: z.string().min(1).max(80).optional(), supportType: z.enum(["terrain", "pad", "terrace", "slab", "deck", "roof", "object"]), access: z.enum(["entry", "arrival"]).optional(), openEdges: z.array(z.enum(["north", "south", "west", "east"])).optional() }).strict();
// New Terra output is always world-space [x, y, z]. Legacy [x, z] input is
// deliberately accepted only by the runtime compatibility normalizer.
const routePoint = z.array(n).length(3);
const siteConnection = z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), fromLevelId: z.string(), toLevelId: z.string(), type: z.enum(["driveway", "path", "stair", "ramp"]), route: z.array(routePoint).min(2), width: n.positive(), maxGrade: n.positive().optional(), surfaceObjectId: z.string().optional(), profile: z.enum(["graded", "authored"]).optional() }).strict();
const siteTransition = z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/), fromLevelId: z.string(), toLevelId: z.string(), type: z.enum(["natural-slope", "graded-slope", "retaining-edge", "stair", "ramp"]), objectId: z.string().optional() }).strict();
const hierarchy = z.object({ levels: z.array(siteLevel).min(1), connections: z.array(siteConnection), transitions: z.array(siteTransition).optional() }).strict();
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
const geometryKind = z.enum(["box", "slab", "plane", "cylinder", "path", "extrusion", "water", "proxy"]);
const facadeIntent = z.enum(["glass-heavy", "punched", "solid", "privacy"]);
const roofForm = z.enum(["flat", "floating-flat", "mono-pitch", "hip", "gable", "butterfly", "terrace"]);
const architecture = z.object({ x: n, z: n, baseElevation: n, width: n.positive(), depth: n.positive(), height: n.positive(), rotationY: n.optional() }).strict();
const architecturePatch = z.object({ x: n.optional(), z: n.optional(), baseElevation: n.optional(), width: n.positive().optional(), depth: n.positive().optional(), height: n.positive().optional(), rotationY: n.optional() }).strict();
const object = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  type: z.string().min(1).max(80), geometryKind: geometryKind.optional(),
  semanticRole: z.string().min(1).max(80), label: z.string().min(1).max(100),
  architecture: architecture.optional(), transform: z.object({ position: vector, rotation: vector, scale: vector }).strict(), dimensions: vector,
  material, collision: z.enum(["solid", "walkable", "passable", "water", "none"]).optional(),
  parentId: z.string().optional(), groupId: z.string().optional(), hostId: z.string().optional(),
  source: z.object({ kind: z.enum(["proxy", "glb", "native"]), assetId: z.string().optional(), replaceable: z.boolean().optional() }).strict().optional(),
  terrain: z.object({ operation: z.enum(["slopeRegion", "raiseRegion", "lowerRegion", "createTerrace", "cutIntoSlope", "gradePath"]), rise: n.optional(), direction: z.enum(["x", "z", "-x", "-z"]).optional() }).strict().optional(),
  support: supportRef.optional(),
  fromSupportId: z.string().optional(), toSupportId: z.string().optional(),
  metadata: z.record(z.string(), z.union([z.string(), n, z.boolean()])).optional(),
  composition: v3CompositionSchema.optional(),
  canopyStyle: z.enum(["solid", "slatted"]).optional(),
  railing: z.enum(["auto", "none"]).optional(),
  terraceOpenEdges: z.array(z.enum(["north", "south", "east", "west"])).optional(),
  unsupportedIntent: z.object({ roofForm: z.string().min(1).max(160).optional() }).strict().optional(),
  levels: z.number().int().min(1).max(20).optional(), facadePreset: facadeIntent.optional(), facadeNorth: facadeIntent.optional(), facadeEast: facadeIntent.optional(), facadeSouth: facadeIntent.optional(), facadeWest: facadeIntent.optional(), roofForm: roofForm.optional(), overhang: n.min(0).optional(), pitch: n.min(0).max(89).optional(), pitchUnit: z.enum(["degrees", "ratio"]).optional(),
}).strict().superRefine((value, ctx) => {
  // Support is a grounding opportunity, not a rendering prerequisite.
  if (value.support?.relationship && value.support.relationship !== "terrain-following" && !value.support.hostId && !value.support.objectId) ctx.addIssue({ code: "custom", message: "A physical support relationship needs a hostId.", path: ["support", "hostId"] });
  if (((value.type === "stair" || value.type === "ramp") || value.geometryKind === "path") && (value.fromSupportId || value.toSupportId) && (!value.fromSupportId || !value.toSupportId)) ctx.addIssue({ code: "custom", message: "Vertical connectors must declare both support endpoints.", path: ["fromSupportId"] });
});

// Flat on purpose: terrain/source are optional primitives rather than optional nested objects, `metadata`
// (a free-form map) is not offered to Terra, and there are no refinements the provider cannot see.
const generationObject = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  type: z.string().min(1).max(80).optional(), geometryKind: geometryKind.optional(),
  semanticRole: z.string().min(1).max(80), label: z.string().min(1).max(100),
  // High-level architecture uses named base-referenced geometry. Generic and
  // legacy objects retain canonical runtime arrays.
  architecture: architecture.optional(), transform: z.object({ position: vector, rotation: vector, scale: vector }).strict().optional(), dimensions: vector.optional(),
  material, collision: z.enum(["solid", "walkable", "passable", "water", "none"]).optional(),
  parentId: z.string().optional(), groupId: z.string().optional(), hostId: z.string().optional(),
  sourceKind: z.enum(["proxy", "glb", "native"]).optional(), sourceAssetId: z.string().optional(), sourceReplaceable: z.boolean().optional(),
  terrainOperation: z.enum(["slopeRegion", "raiseRegion", "lowerRegion", "createTerrace", "cutIntoSlope", "gradePath"]).optional(), terrainRise: n.optional(), terrainDirection: z.enum(["x", "z", "-x", "-z"]).optional(),
  support: generationSupportRef.optional(),
  fromSupportId: z.string().optional(), toSupportId: z.string().optional(),
  // Flat optional architectural intent: one object schema remains provider-friendly and union-free.
  composition: v3GenerationCompositionSchema.optional(),
  canopyStyle: z.enum(["solid", "slatted"]).optional(),
  railing: z.enum(["auto", "none"]).optional(),
  terraceOpenEdges: z.array(z.enum(["north", "south", "east", "west"])).optional(),
  unsupportedIntent: z.object({ roofForm: z.string().min(1).max(160).optional() }).strict().optional(),
  levels: z.number().int().min(1).max(20).optional(), facadePreset: facadeIntent.optional(), facadeNorth: facadeIntent.optional(), facadeEast: facadeIntent.optional(), facadeSouth: facadeIntent.optional(), facadeWest: facadeIntent.optional(), roofForm: roofForm.optional(), overhang: n.min(0).optional(), pitch: n.min(0).max(89).optional(), pitchUnit: z.enum(["degrees", "ratio"]).optional(),
}).strict().superRefine((value, ctx) => {
  if (!["path", "driveway"].includes(value.type ?? "") && !value.architecture && (!value.transform || !value.dimensions)) ctx.addIssue({ code: "custom", message: "Use architecture for a high-level object, or canonical transform and dimensions arrays for generic geometry.", path: ["architecture"] });
});

// Vertical circulation is compact authored intent: host, storeys, a world-space plan rectangle and a stair type.
// V3 derives treads, landings, the floor opening, guards and lift shafts; nobody authors stair geometry.
const generationCirculation = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{1,63}$/), type: z.enum(["stair", "lift"]), hostId: z.string(),
  fromLevel: z.number().int().min(0).max(20), toLevel: z.number().int().min(1).max(20),
  x: n, z: n, width: n.positive(), depth: n.positive(),
  stairType: z.enum(["straight", "l-shaped", "u-shaped", "spiral"]).optional(),
  direction: z.enum(["north", "south", "east", "west"]).optional(), turn: z.enum(["left", "right"]).optional(),
  label: z.string().min(1).max(100).optional(),
}).strict();

const generationHierarchy = z.object({ levels: z.array(siteLevel).min(1), connections: z.array(siteConnection), transitions: z.array(siteTransition) }).strict();

export const v3SceneOutputSchema = z.object({
  version: z.literal(3),
  // Natural ground is high-level intent only (flat primitives): fall direction + grade, optional cliff line, sea level.
  // V3 derives the surface, pads, cut/fill, driveway profiles and retaining walls. Nobody authors terrain vertices.
  site: z.object({ width: n.positive(), depth: n.positive(), baseElevation: n.optional(), groundColor: generationHex.optional(),
    naturalFall: z.enum(["x", "-x", "z", "-z"]).optional(), naturalGrade: n.min(0).max(1.5).optional(), cliffAt: n.optional(), cliffDrop: n.positive().optional(), seaLevel: n.optional() }).strict(),
  estatePlan: v3EstatePlanSchema.optional(),
  siteHierarchy: generationHierarchy.optional(),
  // Count is not an aesthetic validity rule: every structurally valid object
  // is independently renderable, including large estates and detailed sites.
  objects: z.array(generationObject).min(1),
  circulation: z.array(generationCirculation).max(24).optional(),
  relationships: z.array(z.object({ from: z.string(), to: z.string(), kind: z.enum(["supports", "contains", "aligns", "connects", "hosts"]) }).strict()),
}).strict();

/** What Terra emits for a new scene; `normalizeV3GenerationOutput` turns it into the runtime `V3Scene`. */
export type V3GenerationOutput = z.infer<typeof v3SceneOutputSchema>;

export const v3EditOutputSchema = z.object({
  intent: z.string().min(1).max(300),
  operations: z.array(z.object({
    op: z.enum(["create", "delete", "move", "rotate", "resize", "editArchitecture", "changeMaterial", "attach", "detach", "duplicate", "setSupport", "setConnectorEndpoints", "replaceSiteHierarchy", "replaceEstatePlan", "setComposition"]), target: z.string().optional(), object: object.optional(), position: vector.optional(), rotation: vector.optional(), dimensions: vector.optional(), architecture: architecturePatch.optional(), composition: v3CompositionSchema.optional(), material: material.optional(), hostId: z.string().optional(), support: supportRef.optional(), fromSupportId: z.string().optional(), toSupportId: z.string().optional(), id: z.string().optional(), hierarchy: hierarchy.optional(), estatePlan: v3EstatePlanSchema.optional(),
  }).strict()).min(1).max(12),
}).strict();

/** Stored with usage so contract growth is observable without retaining model content. */
export const V3_SCENE_SCHEMA_BYTES = JSON.stringify(z.toJSONSchema(v3SceneOutputSchema)).length;

/** Functional principles, not templates: every authored space must be usable, without prescribing a layout. */
export const V3_FUNCTIONAL_COMPLETENESS_PROMPT = `FUNCTIONAL COMPLETENESS: Design a building people can actually move through, automatically, even when the brief does not ask. These are functional principles, not a layout or style; you choose where and how.
- Every storey above ground needs vertical circulation. Author top-level circulation:[{id,type:"stair"|"lift",hostId,fromLevel,toLevel,x,z,width,depth,stairType?,direction?,turn?}]. hostId is the building-mass containing it; levels are that mass's zero-based storeys and toLevel equal to its levels count reaches its roof (a rooftop terrace or a mass stacked on it). x,z is the world-space plan centre; width (local X) and depth (local Z) bound all stair geometry and must fit inside the host. stairType straight|l-shaped|u-shaped|spiral; direction (north/south/east/west, host-local) is the way the first flight climbs, or the side lift doors face; turn left|right for L/U stairs. Size it honestly: a straight stair needs about 1.0–1.2 m width and ~0.27 m of run per 0.18 m riser (≈4.5 m for 3.2 m floor-to-floor); a U stair ≈2.4×3.2 m; a lift ≥1.6×1.6 m. One stair in a connected mass serves wings joined to it at the same floor level. Stacked masses are reached by a stair in the mass below with toLevel equal to its levels, placed inside the stacked mass footprint.
- Balconies need a walkable door from the storey they serve: on the same facade and floor, author a door or glazed-door opening overlapping the balcony slab span (serves may name the assembly). A glazing-zone is a window, never access.
- Rooftop terraces need access: a stair/lift in the host reaching its roof (V3 builds the stair head enclosure), or a glazed-door from an adjoining storey at terrace level with that terrace edge listed in terraceOpenEdges.
- Main outdoor living areas (terraces, decks, lanais, pool terraces, courtyards) need a walkable door from the house that opens onto them; connected masses need a door or an open connection between them.
- glazed-door: {id,type:"glazed-door",facade,floors?,start,end,height?,operation?:"hinged"|"sliding",serves?}. It is floor-level glazing (a glass door or sliding door wall) and is walkable; use it for living rooms opening to terraces, pools and balconies.
Do not author furniture or a full room-by-room interior; author only what makes the spaces reachable.`;

export const V3_SCENE_ARCHITECT_PROMPT = `You are Terra, the single V3 Scene Architect. Return one compact persistent scene, never a V2 document.

Coordinate contract: X is left/right (east/west), Y is vertical elevation, and Z is forward/back (north/south). Canonical runtime transform.position is [x,y,z]. Canonical runtime dimensions are [width,height,depth]. Never put plan depth in the Y slot.

For high-level architectural objects—building-mass, slab, terrace, roof-form, balcony, pool, canopy, courtyard, and landscape-zone—do not calculate centre Y or author positional geometry arrays. Author architecture: {x,z,baseElevation,width,depth,height,rotationY?}. baseElevation is the object's bottom surface. The deterministic compiler derives centre Y as baseElevation + height/2, runtime position [x,centreY,z], dimensions [width,height,depth], construction slabs/walls/facades/roof, and pool/canopy vertical parts. A building-mass may additionally author levels, facade intent, roofForm, overhang and pitch. For a driveway/path surface owned by siteHierarchy.connections[].surfaceObjectId, author its stable object id, type (path or driveway), label and material, plus the connection route, width and endpoint level ids. Omit box geometry for these surfaces: V3 derives compatibility bounds and graded render geometry from the connection. Generic/unusual geometry without semantic geometry instead uses canonical transform and dimensions arrays.

Top-level shape: {version:3, site, estatePlan, siteHierarchy?, objects, circulation?, relationships?}. site: {width, depth (metres, origin-centred), naturalFall (downhill axis: "z" = toward south/+Z, "-z" = north, "x" = east, "-x" = west), naturalGrade?, cliffAt?, cliffDrop?, seaLevel?}. All elevations are absolute metres on one datum; V3 anchors the natural slope to your authored level elevations. siteHierarchy: {levels:[{id, elevation, region?:{x,z,width,depth}, supportType?: pad|terrace|terrain, access?: entry|arrival}], connections:[{id, type: driveway|path|stair|ramp, fromLevelId, toLevelId, route:[[x,y,z],...], width, surfaceObjectId?}]}. A level region may be omitted when the level's own objects (same baseElevation) and connection endpoints define it. A building-mass's levels, roofForm, overhang and pitch sit on the object (not inside architecture); massHierarchy, facadeRoles, roofDatumGroup and mainEntry sit inside its composition. material is {id, color:"#rrggbb", surface?} or a short finish description string. collision is solid|walkable|passable|water|none.

Each object needs a stable id, semanticRole, label, geometryKind and material. geometryKind is one of box, slab, plane, cylinder, path, extrusion, water, proxy. Use semanticRole freely; Use type:"building-mass" for inhabitable buildings and type:"roof-form" for separate roofs; geometryKind alone does not construct architecture. Supply the matching supported type for specialized amenities (pool, courtyard, terrace, canopy, veranda). Unknown types are only generic/proxy previews, not faithful fountains, sports equipment or other custom amenities. Do not present such proxies as fully constructed features.

Support metadata is optional. Do not invent obvious support graphs. Omit support for buildings, slabs, roofs, balconies, canopies, pools/water, and landscape objects unless there is an unusual intentional condition such as suspension or cantilevering; deterministic geometry infers ordinary terrain/slab/host support and rejects incompatible hints. A stair/ramp may use fromSupportId and toSupportId. Keep object identity stable: edits address authored ids, never generated children. Include site hierarchy when useful; every route is world-space [x,y,z]. For sloped sites describe natural ground only at a high level (site.naturalFall = downhill axis, naturalGrade, optional cliffAt/cliffDrop distance downhill of centre, seaLevel) instead of stacking terrain regions; author pad/terrace level elevations and driveway route intent, and V3 grades the ground, driveway profiles and retaining walls. Use collision classes when known. Return one JSON object representing the V3 scene only, with no Markdown fences and no commentary before or after.

${V3_COMPOSITION_PROMPT}

${V3_ESTATE_PLAN_PROMPT}\n${V3_CREATIVE_ARCHITECTURE_PROMPT}

${V3_FUNCTIONAL_COMPLETENESS_PROMPT}

${V3_LUXURY_SCALE_PROMPT}`;

/** Same V3 architecture/scene contract; only new-generation site policy differs. */
export function v3SceneArchitectPrompt(terrainMode: "flat" | "advanced", options: { blueprintFirst?: boolean } = {}): string {
  if (options.blueprintFirst) return `${v3SceneArchitectPrompt(terrainMode)}\n\n${V3_BLUEPRINT_FIRST_PROMPT}`;
  if (terrainMode === "advanced") return V3_SCENE_ARCHITECT_PROMPT;
  return `You are Terra, the single V3 Scene Architect. Return one compact persistent scene, never a V2 document.

FLAT LAND CONTRACT: Natural ground is flat at elevation 0. This generation setting takes precedence over terrain requests in the brief. No cliffs, ocean/sea planes, natural slopes, terrain-region modifiers, graded roads or retaining-wall systems. Do not simulate a hillside by raising buildings on site pads. Keep ground-level building foundations near Y=0. Architectural elevation is independent: multi-storey buildings, stacked masses, balconies, upper-floor terraces, roof gardens, suspended and cantilevered architecture remain fully supported. Keep their intended elevation and use architectural hosts where needed; never put building storeys into siteHierarchy.

Design the architecture and site program together at the scale appropriate to the brief. Explicit user requirements are constraints; everything unspecified is a creative design opportunity. Use coherent proportions, intentional composition, believable construction, functional relationships and design consistency. Develop an original composition from the brief, without fixed house templates.

Coordinate contract: +X east, -X west, +Y up, +Z south, -Z north. Facade names are local to building yaw; site positions are world-space. Place arrival and view facades toward actual arrival courts and pools. Roof pitch is in degrees: author pitchUnit:"degrees" (or explicitly "ratio" for rise/run). Roof-form width/depth include eaves only when they equal host dimensions plus twice overhang; otherwise they are bearing dimensions. Runtime transform.position is [x,y,z] and dimensions is [width,height,depth]. High-level building-mass, slab, terrace, roof-form, balcony, pool, canopy, courtyard and landscape-zone objects use architecture: {x,z,baseElevation,width,depth,height,rotationY?}. baseElevation is the bottom, not the centre. The compiler derives runtime arrays. Preserve upper-floor elevations, storeys, roof pitch and roof geometry. Pools may be embedded below ground with their rim near ground/deck level. Ordinary decks, gardens and driveway surfaces stay near ground level. Generic geometry may use canonical transform and dimensions arrays.

Top-level shape: {version:3, site:{width,depth,baseElevation:0,groundColor?}, estatePlan, objects, circulation?, relationships?}. Omit siteHierarchy unless needed for a driveway/path route. If needed, use only elevation-0 levels, ground routes [[x,0,z],...], and no terrain transitions. Do not create site levels for architectural storeys or terraces. A connection uses {id,type:driveway|path,fromLevelId,toLevelId,route,width,surfaceObjectId?}; its surface owner needs only id, type, label and material because geometry is derived. An ordinary standalone driveway can instead be a thin ground-level slab with named architecture.

Each object needs a stable id, semanticRole, label, material and geometryKind (box, slab, plane, cylinder, path, extrusion, water, proxy). Optional type selects specialized V3 rendering; use building-mass, roof-form, pool, terrace and other architectural types where appropriate. material is {id,color:"#rrggbb",surface?} or a short finish description. collision is solid|walkable|passable|water|none. Building levels, roofForm, overhang, pitch and facade intent belong on the object; massHierarchy, facadeRoles, roofDatumGroup and mainEntry belong inside composition. Use the full architectural composition capabilities below.

Support metadata is optional for ordinary geometry; the compiler infers it. Upper architecture may use hostId or support:{kind:"object",hostId,relationship:"rests-on"}. Preserve intentional suspension/cantilevers using explicit support metadata. Architectural stairs/ramps may use fromSupportId and toSupportId referring to architectural supports. Keep object ids stable. Return one JSON object only, without Markdown or commentary.

${V3_COMPOSITION_PROMPT}

${V3_ESTATE_PLAN_PROMPT}\n${V3_CREATIVE_ARCHITECTURE_PROMPT}

${V3_FUNCTIONAL_COMPLETENESS_PROMPT}

${V3_LUXURY_SCALE_PROMPT}`;
}
