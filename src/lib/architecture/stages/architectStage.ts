import { z } from "zod";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import { compileArchitecture, facadeSpanWarnings } from "../compiler";
import { CORNER_VALUES, ENTRY_TREATMENT_VALUES, FACADE_TREATMENT_VALUES, FOOTPRINT_SCOPE_VALUES, MASS_FACADE_VALUES, MASS_RELATIONSHIP_KIND_VALUES, MASS_ROLE_VALUES, OUTDOOR_SIDE_VALUES, OUTDOOR_TRANSITION_VALUES, ROOF_EDGE_VALUES, AUTHORED_ROOF_RECIPE_KINDS, STRUCTURAL_EXPRESSION_VALUES, VOLUME_FORM_VALUES, VOLUME_HEIGHT_VALUES, VOLUME_HIERARCHY_VALUES, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument, type DocumentValidationOptions } from "../document";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { COMPASS_SIDES, SIDE_VECTOR, SITE_ENVIRONMENTS } from "@/lib/house/siteSettings";
import { SHARED_WALL_GAP_M } from "../volumePlan";
import { v2SiteFrameForDocument } from "../siteFrame";
import { runDesignQualityGate } from "./qualityGate";
import { runStage } from "./runStage";
import { fingerprint } from "@/lib/ai/usage/diagnostics";
import { architecturalDocumentFingerprintInput, architecturalEditDiff, describeArchitecturalEditDiff, editScopeDeclarationErrors, editScopeSchema, scopeMassIds, scopeSiteTargets, type ArchitecturalEditScope } from "./architectEditDiff";
import { normalizeSitePlan, sitePlanSchema, type SitePlan } from "./sitePlanStage";
import { changedSitePlanElements, spatialReflowErrors, spatialReflowSchema, type SpatialReflow } from "./spatialReflow";
import { sitePlanContextForDocument } from "../sitePlanContext";
import { executeSceneEditPlan, sceneEditPlanSchema, targetCatalog, type SceneEditPlan, type SceneOperation } from "../sceneOperations";
import type { OutdoorAssetPlacement, OutdoorAssetTombstone } from "@/lib/outdoor/placements";
import { editPlanCoverage, INCOMPLETE_PLAN_PREFIX, type EditCapabilityNeed, type EditCoverageReport } from "../editGoals";
import { introducedCirculationIssues } from "../circulationAudit";
import { buildArchitectEditContext, buildArchitectRepairContext, classifyArchitectEditContext, createArchitectEditUsage, recordArchitectEditUsage, type ArchitectEditContext, type ArchitectEditUsage } from "../architectEditContext";

const compositionKinds = ["rectangular-pavilion", "l-shaped", "u-shaped", "h-shaped", "courtyard", "pavilion-cluster", "rotated-wings", "stepped-terraces"] as const;
const finiteNumber = z.number().finite();
const scope = z.enum(FOOTPRINT_SCOPE_VALUES).optional();
const identified = { id: z.string().min(1).optional() };
/**
 * `start`/`end` are what `facadePointAt` reads: a fraction of the owning facade's length (u=0 at the west end of a
 * north/south facade, the north end of an east/west one), never meters. Out of range is rejected, not converted.
 */
const FACADE_SPAN = "a normalized fraction 0..1 along the owning facade, NOT meters: 0 = the facade's beginning (the west end of a north/south facade, the north end of an east/west facade), 1 = its end. A centered element covering the middle 20% is start 0.4, end 0.6";
const facadeFraction = (field: "start" | "end") => finiteNumber.min(0, `${field} must be ${FACADE_SPAN}.`).max(1, `${field} must be ${FACADE_SPAN}.`).describe(`${field === "start" ? "Start" : "End"} of the span: ${FACADE_SPAN}.`);
const span = { start: facadeFraction("start"), end: facadeFraction("end") };
const facade = z.enum(MASS_FACADE_VALUES).describe("The mass's own side. At rotation 0 it faces that world direction: north = -Z, south = +Z, east = +X, west = -X.");
const operationSchema = z.discriminatedUnion("type", [
  z.object({ ...identified, type: z.literal("recess"), facade, ...span, depth: finiteNumber, floors: scope, open: z.boolean().optional(), postSpacing: finiteNumber.positive().optional() }).strict(),
  z.object({ ...identified, type: z.literal("projection"), facade, ...span, depth: finiteNumber, floors: scope, open: z.boolean().optional(), postSpacing: finiteNumber.positive().optional() }).strict(),
  z.object({ ...identified, type: z.literal("balcony"), facade, ...span, depth: finiteNumber.positive(), floors: z.literal("upper") }).strict(),
  z.object({ ...identified, type: z.literal("notch"), corner: z.enum(CORNER_VALUES), width: finiteNumber, depth: finiteNumber, floors: scope }).strict(),
  z.object({ ...identified, type: z.literal("entry-recess"), facade, width: finiteNumber, depth: finiteNumber, floors: scope }).strict(),
  z.object({ ...identified, type: z.literal("chamfer"), corner: z.enum(CORNER_VALUES), size: finiteNumber, floors: scope, glazed: z.boolean().optional() }).strict(),
]);
const openingSchema = z.discriminatedUnion("type", [
  z.object({ ...identified, type: z.literal("glazing-zone"), facade, ...span, heightRatio: finiteNumber, floors: scope, frame: z.boolean().optional(), reveal: finiteNumber.optional() }).strict(),
  z.object({ ...identified, type: z.literal("opening-rhythm"), facade, count: finiteNumber.int().positive(), width: finiteNumber, height: finiteNumber, sill: finiteNumber, floors: scope }).strict(),
  z.object({ ...identified, type: z.literal("door"), facade, ...span, height: finiteNumber.optional(), floors: scope, frame: z.boolean().optional(), reveal: finiteNumber.optional() }).strict(),
]);
/** Additive construction is intentionally a short vocabulary. It is distinct from shell operations and roofs. */
const assemblyHostSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("floor"), level: finiteNumber.int().nonnegative(), offset: finiteNumber.optional() }).strict(),
  z.object({ kind: z.literal("facade"), facade, level: finiteNumber.int().nonnegative(), offset: finiteNumber.optional() }).strict(),
  z.object({ kind: z.literal("entrance"), facade, level: finiteNumber.int().nonnegative().optional(), offset: finiteNumber.optional() }).strict(),
  z.object({ kind: z.literal("terrace"), level: finiteNumber.int().nonnegative().optional(), offset: finiteNumber.optional() }).strict(),
  z.object({ kind: z.literal("roof"), offset: finiteNumber.optional() }).strict(),
  z.object({ kind: z.literal("slab"), slabId: z.string().min(1), offset: finiteNumber.optional() }).strict(),
]);
const assemblyPartSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1), type: z.literal("slab"), facade, ...span, depth: finiteNumber.positive(), level: finiteNumber.int().nonnegative().optional(), elevation: finiteNumber.optional(), host: assemblyHostSchema.optional(), thickness: finiteNumber.positive().optional() }).strict(),
  z.object({ id: z.string().min(1), type: z.literal("railing"), slabId: z.string().min(1), edges: z.array(z.enum(["outer", "start", "end"])).min(1), height: finiteNumber.positive(), thickness: finiteNumber.positive().optional() }).strict(),
  z.object({ id: z.string().min(1), type: z.literal("post"), facade, at: facadeFraction("start"), depth: finiteNumber, level: finiteNumber.int().nonnegative().optional(), elevation: finiteNumber.optional(), host: assemblyHostSchema.optional(), height: finiteNumber.positive(), size: finiteNumber.positive().optional() }).strict(),
  z.object({ id: z.string().min(1), type: z.literal("beam"), facade, ...span, depth: finiteNumber, level: finiteNumber.int().nonnegative().optional(), elevation: finiteNumber.optional(), host: assemblyHostSchema.optional(), height: finiteNumber.positive(), thickness: finiteNumber.positive().optional() }).strict(),
]);
const assemblySchema = z.object({ id: z.string().min(1), intent: z.string().min(1), parts: z.array(assemblyPartSchema).min(1).max(16) }).strict();
const volumePlanSchema = z.object({ form: z.enum(VOLUME_FORM_VALUES), height: z.enum(VOLUME_HEIGHT_VALUES), hierarchy: z.enum(VOLUME_HIERARCHY_VALUES), viewFacade: z.enum(FACADE_TREATMENT_VALUES), arrivalFacade: z.enum(FACADE_TREATMENT_VALUES), flankFacades: z.enum(FACADE_TREATMENT_VALUES), courtyardFacade: z.enum(FACADE_TREATMENT_VALUES).optional(), entry: z.enum(ENTRY_TREATMENT_VALUES), outdoor: z.enum(OUTDOOR_TRANSITION_VALUES), outdoorSide: z.enum(OUTDOOR_SIDE_VALUES), roofEdge: z.enum(ROOF_EDGE_VALUES), structure: z.enum(STRUCTURAL_EXPRESSION_VALUES) }).strict();
const roofExpressionSchema = z.object({
  overhang: finiteNumber.optional(), verticalGap: finiteNumber.optional(), horizontalOffset: z.object({ x: finiteNumber.optional(), z: finiteNumber.optional() }).strict().optional(), thickness: finiteNumber.optional(), fasciaDepth: finiteNumber.optional(), soffitMaterial: z.enum(["roof", "exterior", "dark"]).optional(), supportStyle: z.enum(["reveal", "clerestory", "band"]).optional(), clerestoryHeight: finiteNumber.optional(), secondary: z.object({ width: finiteNumber.optional(), depth: finiteNumber.optional(), elevation: finiteNumber.optional(), offsetX: finiteNumber.optional(), offsetZ: finiteNumber.optional() }).strict().optional(),
}).strict();
/** The canonical `AuthoredRoofRecipe`: the same kinds, overhang and pitch that `roofConflicts` requires of a complete roof. */
const roofRecipeSchema = z.object({ id: z.string().min(1), massId: z.string().min(1), kind: z.enum(AUTHORED_ROOF_RECIPE_KINDS), overhang: finiteNumber.nonnegative().describe("Meters, >= 0. Required."), pitch: finiteNumber.nonnegative().describe("Degrees, >= 0. Required."), orientation: finiteNumber.optional(), expression: roofExpressionSchema.optional(), parapet: z.object({ height: finiteNumber.positive(), thickness: finiteNumber.positive().optional() }).strict().optional() }).strict();
const sceneMaterialSchema = z.object({ color: z.string().regex(/^#[0-9a-fA-F]{6}$/), roughness: finiteNumber.optional(), metalness: finiteNumber.optional(), opacity: finiteNumber.optional() }).strict();
const sceneHostSchema = z.discriminatedUnion("kind", [z.object({ kind: z.literal("world") }).strict(), z.object({ kind: z.literal("mass"), massId: z.string().min(1), anchor: z.enum(["center", "roof"]).optional() }).strict()]);
const sceneVector3Schema = z.array(finiteNumber).min(3).max(3);
const sceneSize3Schema = z.array(finiteNumber.positive()).min(3).max(3);
const sceneObjectSchema = z.object({ id: z.string().min(1), kind: z.enum(["mass", "wall", "surface", "slab", "post", "beam", "railing", "roof", "path", "asset-proxy"]), label: z.string().min(1), position: sceneVector3Schema, rotation: sceneVector3Schema.optional(), size: sceneSize3Schema, host: sceneHostSchema.optional(), material: sceneMaterialSchema.optional(), intent: z.string().optional() }).strict();
/**
 * The Architect writes the executable MassVolume directly.  In particular, dimensions are flat
 * `width`/`depth` (and optional `height`), and world placement is flat `position`, `elevation`, and
 * `rotation`; there is deliberately no semantic `dimensions` or `placement` DTO to translate.
 */
const executableMassSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), role: z.enum(MASS_ROLE_VALUES),
  position: z.object({ x: finiteNumber, z: finiteNumber }).strict().describe("The mass's CENTER in world meters: +X = east, -X = west, +Z = south, -Z = north."),
  width: finiteNumber.positive().describe("Meters along X (the north and south facades' length)."), depth: finiteNumber.positive().describe("Meters along Z (the east and west facades' length)."),
  height: finiteNumber.positive().optional(), floors: finiteNumber.int().positive(), elevation: finiteNumber, rotation: finiteNumber.describe("Radians about the vertical axis, turning the mass and its named facades together; 0 = every facade faces its named world direction."),
  placementLocked: z.boolean().optional(), parentId: z.string().min(1).optional(),
  relationships: z.array(z.object({ kind: z.enum(MASS_RELATIONSHIP_KIND_VALUES), target: z.string().min(1), distance: finiteNumber.nonnegative().optional(), side: z.enum(MASS_FACADE_VALUES).optional(), rotationOffset: finiteNumber.optional() }).strict()).optional(),
  cantilever: z.object({ direction: z.enum(MASS_FACADE_VALUES), distance: finiteNumber.positive() }).strict().optional(),
  operations: z.array(operationSchema).optional(), openings: z.array(openingSchema).optional(), assemblies: z.array(assemblySchema).max(8).optional(), plan: volumePlanSchema.optional(),
}).strict();
/** The structured-output boundary requires the compiler's roof container, not merely a `roofs` key. */
/**
 * The persisted architectural record. Edit-only evidence deliberately does not belong here: this schema is
 * strict so an accidental `document.scope` is rejected at the structured-output boundary instead of being
 * silently persisted with the design.
 */
export const architecturalDesignDocumentSchema = z.object({
    version: z.literal(1), brief: z.string(),
    siteStrategy: z.object({ environment: z.enum(SITE_ENVIRONMENTS), viewDirection: z.enum(COMPASS_SIDES), arrivalDirection: z.enum(COMPASS_SIDES), terrain: z.enum(["level", "stepped"]) }).strict(),
    massing: z.object({ composition: z.enum(compositionKinds), masses: z.array(executableMassSchema).min(1) }).strict(),
    roofs: z.object({ recipes: z.array(roofRecipeSchema) }).strict(),
    facade: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), architecturalStyle: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), outdoorPlan: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), materialStrategy: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), components: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), furnishings: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(),
    sceneObjects: z.array(sceneObjectSchema).optional(), materialOverrides: z.array(z.object({ target: z.string().regex(/^mass:[\w-]+$|^scene:[\w-]+$/), material: sceneMaterialSchema }).strict()).optional(),
    metadata: z.object({ createdAt: z.string(), source: z.enum(["fixture", "stage-pipeline", "live-generation"]), compiler: z.literal("procedural-architecture-v1") }).strict(),
  }).strict();

/** Generation has no edit metadata. */
export const architectOutputSchema = z.object({ document: architecturalDesignDocumentSchema }).strict();

/**
 * The one V2 Architect-edit response contract. Scope is transient authorization evidence at the response
 * envelope, never a field on the persisted ArchitecturalDesignDocument. Keep this separate from generation:
 * optional scope in a shared schema lets a structurally valid edit bypass the edit's mandatory permission.
 */
export const architectEditOutputSchema = z.object({
  document: architecturalDesignDocumentSchema,
  /** Present only for a controlled Architect edit that needs to reflow existing site geometry. */
  sitePlan: sitePlanSchema.optional(),
  reflow: spatialReflowSchema.optional(),
  /** Mandatory transient authorization for every V2 Architect edit. */
  scope: editScopeSchema,
}).strict();
export type ArchitectEditOutput = z.infer<typeof architectEditOutputSchema>;
/** The canonical V2 follow-up contract. */
export const architectOperationPlanSchema = sceneEditPlanSchema;
/**
 * One object-root response schema for the provider. The normal live path is the operation plan; the explicit
 * legacy envelope stays parseable only for already-established compatibility callers. This replaces the
 * provider-rejected root union and does not route or synthesize a document replacement.
 */
// This deliberately reuses the plan field schemas rather than calling `.partial()` on the refined plan
// schema (Zod 4 disallows partial objects with refinements). The canonical plan is checked again below.
export const architectEditResponseSchema = z.object({
  intent: sceneEditPlanSchema.shape.intent.optional(),
  operations: sceneEditPlanSchema.shape.operations.optional(),
  status: sceneEditPlanSchema.shape.status.optional(),
  rationale: sceneEditPlanSchema.shape.rationale.optional(),
  siteReflow: sceneEditPlanSchema.shape.siteReflow.optional(),
  capabilityNeeds: sceneEditPlanSchema.shape.capabilityNeeds.optional(),
  goals: sceneEditPlanSchema.shape.goals.optional(),
  document: architecturalDesignDocumentSchema.optional(),
  sitePlan: sitePlanSchema.optional(),
  reflow: spatialReflowSchema.optional(),
  scope: editScopeSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.operations !== undefined || value.intent !== undefined) {
    if (!value.intent) ctx.addIssue({ code: "custom", path: ["intent"], message: "Operation plan needs intent." });
    return;
  }
  if (!value.document) ctx.addIssue({ code: "custom", path: ["document"], message: "Expected an operation plan." });
  if (!value.scope) ctx.addIssue({ code: "custom", path: ["scope"], message: "Legacy document envelope needs scope." });
});

/**
 * What the provider is asked to fill for an edit: the operation plan only. The legacy replacement envelope stays
 * locally parseable for historical fixtures, but it is never offered to the model, so it cannot be a live fallback
 * (and its ~40k-character document schema is not billed on every edit call).
 */
export const architectEditWireSchema = sceneEditPlanSchema;

/** What the Architect's document must satisfy before it is compiled: a complete `AuthoredRoofRecipe` on every mass. */
export const ARCHITECT_DOCUMENT_CONTRACT: DocumentValidationOptions = { requireRoofForEveryMass: true, requireCompleteRoofRecipes: true };

/** The compiler's world frame, read from `SIDE_VECTOR` so the prompt cannot drift from it: "north = -Z, east = +X, …". */
const COMPASS_AXES = COMPASS_SIDES.map((side) => {
  const [x, z] = SIDE_VECTOR[side];
  return `${side} = ${x ? `${x > 0 ? "+" : "-"}X` : `${z > 0 ? "+" : "-"}Z`}`;
}).join(", ");

/** The shared-wall distance the quality gate enforces, read from `SHARED_WALL_GAP_M` so the prompt cannot drift from it. */
const GAP = `${SHARED_WALL_GAP_M}m`;

export const ARCHITECT_SYSTEM_PROMPT = `You are the sole AI Architect for a residential property. Author ONE complete, persistent, executable ArchitecturalDesignDocument. You have sole architectural authority: decide the coherent massing, exact world positions, dimensions, rotations, elevations, floors, footprint operations, openings, entry, terraces/screens, and a roof recipe for every mass.

Return only { document }. document must have version=1, brief, siteStrategy, massing, roofs, facade, architecturalStyle, outdoorPlan, materialStrategy, components, furnishings, and metadata. siteStrategy uses environment=${SITE_ENVIRONMENTS.join(", ")}, compass view/arrival directions, and terrain=level|stepped. Metadata is source=live-generation and compiler=procedural-architecture-v1; every placeholder is {status:"pending", notes?:string[]}.

Each mass uses executable id, name, role, position {x,z}, width, depth, optional height, floors, elevation, rotation, placementLocked:true, and real operations/openings. Operation variants are exact discriminated unions: recess/projection {facade,start,end,depth,floors?,open?,postSpacing?}; legacy balcony {facade,start,end,depth,floors:"upper"} is accepted only for saved-project compatibility; notch {corner,width,depth,floors?}; entry-recess {facade,width,depth,floors?}; chamfer {corner,size,floors?,glazed?}. "projection" is an enclosed full-height footprint extension, never a balcony. A corner is ONLY one of ${CORNER_VALUES.join(", ")} — never "southeast" or a compass word. Opening variants are glazing-zone {facade,start,end,heightRatio,...}, opening-rhythm {facade,count,width,height,sill,...}, or door {facade,start,end,...}.

For additive exterior architecture use assemblies, never a shell projection: assemblies:[{id,intent,parts}]. intent is unrestricted descriptive metadata and never selects a renderer template. Parts are slab, railing, post, beam; their facade span/depth defines local horizontal placement. Each non-railing part may name host {kind:"floor"|"facade"|"entrance"|"terrace",level,...}, {kind:"roof",offset?}, or {kind:"slab",slabId,offset?}; the compiler resolves the vertical position from that semantic support. Legacy level/elevation fields remain readable, but author a host for new work and never calculate a world Y. Assemblies are additive and keep the wall, openings and roof intact. Compose any requested exterior construction from these primitives; do not request or assume a feature-specific compiler recipe. If the vocabulary cannot express the request, report a Capability Need instead of substituting geometry. If you supply plan, it is the closed VolumePlan enum vocabulary, never prose. Do not use geometry, program, footprintOperations, dimensions, placement, operation/face/centerOffset, or arbitrary fields; this is not a DTO.

roofs must be exactly { recipes: [...] }. Author exactly one executable recipe for every mass: {id,massId,kind,overhang,pitch,orientation?,parapet?,expression?}. kind is one of ${AUTHORED_ROOF_RECIPE_KINDS.join(", ")} — one buildable family per roof, never "mixed". overhang (meters, >= 0; 0 is a flush edge) and pitch (DEGREES, >= 0) are required on every roof and never defaulted; flat and floating-flat roofs are built level, so give them their nominal low pitch (e.g. 2); orientation is a NUMBER in radians, never a compass string; parapet is {height,thickness?}, never prose; floating roof expression is expression {verticalGap?,thickness?,supportStyle?,clerestoryHeight?,...}, never floatingExpression prose. These recipes are architectural intent for the procedural Roof Systems compiler, never GLB assets or mesh instructions. Keep one coherent whole-house roof language. Every roof must reference a real mass. Do not hand off decisions to another AI, emit a semantic plan for later translation, or use a generic 12m x 9m gable house.

COORDINATES — the compiler's world frame; follow it exactly. World axes: ${COMPASS_AXES}; Y is up. position {x,z} is the mass's CENTER in world meters, so a mass north of another has a SMALLER z and one east of it a LARGER x. width is the mass's extent along X and depth its extent along Z. Facade names (north/south/east/west) and corners (nw/ne/se/sw) are the mass's own sides: at rotation 0 each faces its named world direction — the north facade is the -Z side (its length is width), the east facade is the +X side (its length is depth), nw is the -X/-Z corner. rotation (radians about Y) turns the mass and its named facades together: rotation 1.5708 turns the south facade to face east (+X) and the north facade to face west (-X); keep rotation 0 unless the design needs a turned volume. siteStrategy.arrivalDirection and viewDirection are world directions. The front/arrival side is the side facing arrivalDirection: the entry, entry door and approach belong on the facade facing it. The rear/garden/view side faces viewDirection: rear or garden terraces, garden glazing and view openings belong there, and a rear terrace mass sits beyond the house in the viewDirection. Example: arrivalDirection=north, viewDirection=south → the entry door is on the north (-Z) facade, and a rear/garden terrace is at a LARGER z than the house (south of it), never at a smaller z (that is the arrival side).

UNITS. Every length is meters: position x/z, width, depth, height, elevation, recess/projection depth, notch width/depth, chamfer size, entry-recess width/depth, opening-rhythm width/height/sill, door height, reveal, postSpacing, cantilever and relationship distances, roof overhang, parapet and expression dimensions. Roof pitch is degrees; rotation and roof orientation are radians; glazing-zone heightRatio is a ratio of the wall height. FACADE SPANS ARE NOT METERS: start and end on recess, projection, glazing-zone and door are normalized fractions from 0 to 1 along the owning facade — 0 = the beginning of that facade (the west end of a north/south facade, the north end of an east/west facade), 1 = the end of that facade. A value outside 0..1 is rejected. Example: a centered element covering the middle 20% of a facade is start 0.4, end 0.6 — on a 12m north facade that is a 2.4m-wide door centered on the facade, never start 4.8, end 7.2.

SHARED FACADES — ${GAP} CLEARANCE. A neighboring volume whose solid wall stands within ${GAP} of a facade (a gap of ${GAP} or less, overlapping that facade along its length and in height) closes that stretch of the facade: it is a shared wall, never an exposed facade, and every feature authored on the closed stretch is rejected — door, entry-recess, glazing-zone, opening-rhythm, projection or solid recess. Therefore:
- Do not place an opaque neighboring volume within ${GAP} of a facade stretch that carries an entrance, door, window, glazing zone, opening rhythm, projection, a recess that must be reached, or any other exposed facade feature. This binds both volumes: each one's features on the facing sides are checked against the other's wall.
- A tiny gap is not separation. 0.1m, 0.3m or exactly ${GAP} still makes a shared wall. To keep a facade independently exposed, leave MORE than ${GAP} of clear space between it and the neighbor's solid wall — unless the neighbor's facing edge is explicitly open: the post edge of an open:true recess or projection (see below) is not a wall and closes nothing.
- If two volumes are intentionally attached or shared, author no exterior openings or entrance features on the blocked portion of their shared solid wall, on either volume. The only element accepted there is an open:true recess, because it removes wall rather than adding a feature.
- How the composition satisfies this is your architectural decision: moving or separating a volume, changing the composition, or changing which facade carries the exposed features are all yours to choose.

SOLID MASSES VS OPEN OUTDOOR SPACE. Every mass is built as an enclosed, solid volume by default: a floor slab, a full-height solid wall along every edge of its footprint, and its roof. role (terrace, veranda, entry, connector, …), name and notes are descriptive only — a mass called "rear terrace", "entry forecourt", "open porch", "colonnade" or "canopy" is still a walled box; naming something open never removes a wall. Geometry alone decides what is open.
- Do not author an ordinary mass for a covered open terrace, veranda, porch, canopy, colonnade or forecourt unless enclosing walls are actually intended. This document has no mass type for unroofed open ground (a paved forecourt or open-air terrace): never stand in for one with a walled volume.
- The executable open geometry is exactly this:
  (a) recess or projection with open:true. Its outward edge — the line parallel to the facade at its depth — is built as a header beam with posts every postSpacing meters instead of a wall (without postSpacing it is one unbroken open span under the header). An open projection extends the volume's floor and roof out over its span and removes the facade wall behind it, but it is open only on that outer face: its two side returns (each as long as its depth) are solid walls. An open recess sets that stretch of the facade back by its depth and builds the set-back line as posts; its short returns are solid.
  (b) Covered space beneath an upper volume: on a volume of 2+ floors, a recess with floors:"ground" sets only the ground floor back beneath the full upper floor, leaving covered outdoor space under it; add open:true to make its set-back line posts instead of a wall.
  Only the edges these operations open are open; every other edge of the volume stays a solid wall. To open a covered volume on several sides, give each of those facades its own open:true recess, and stop adjacent spans short of their shared corner (e.g. start 0.05, end 0.95) — short solid corner piers remain.
- A covered terrace that stands against a glazed living facade must be genuinely open on the side facing that glazing (an open:true recess along it), author no openings of its own on that side, and keep its remaining solid walls out of the glazing's way — never another solid wall in front of the glass.

The deterministic compiler may validate, ground, snap, and reject objective errors, but it will not add architecture for you. On a repair request, preserve unaffected ids, positions, geometry, openings, and roofs; change only the specified objective failures.`;

/**
 * The generation contract sections that also govern operation-plan edits (assembly vocabulary, world frame, units,
 * shared facades, solid vs open space). The document envelope, mass-field and roof-authoring sections are omitted:
 * an edit never returns a document, so sending them only cost input tokens and contradicted the plan contract.
 */
const EDIT_CONTRACT_SECTIONS = ["For additive exterior architecture", "COORDINATES", "UNITS.", "SHARED FACADES", "SOLID MASSES VS OPEN OUTDOOR SPACE"];
const ARCHITECT_EDIT_CONTRACT = ARCHITECT_SYSTEM_PROMPT.split("\n\n").filter((section) => EDIT_CONTRACT_SECTIONS.some((lead) => section.startsWith(lead))).join("\n\n");

const documentOf = (raw: unknown): unknown => (typeof raw === "object" && raw !== null && "document" in raw ? (raw as { document: unknown }).document : raw);
const isSpanRangeIssue = (issue: z.core.$ZodIssue) => (issue.code === "too_big" || issue.code === "too_small") && (issue.path.at(-1) === "start" || issue.path.at(-1) === "end");

/**
 * The repair errors for a response the schema rejected. A structurally sound document whose facade spans fall
 * outside 0..1 gets the compiler's own span diagnostic (element id, facade length, what would be built) instead of
 * zod's bare range message; any other schema issue keeps its schema detail.
 */
function schemaRepairErrors(raw: unknown, schema: z.ZodType = architectOutputSchema): string[] {
  const document = documentOf(raw);
  const errors = validateArchitecturalDesignDocument(document, ARCHITECT_DOCUMENT_CONTRACT);
  if (errors.length) return errors;
  const parsed = schema.safeParse(raw);
  if (parsed.success) return [];
  const spans = (document as ArchitecturalDesignDocument).massing.masses.flatMap((mass) => facadeSpanWarnings(mass).map((warning) => `"${mass.id}" facade span rejected — ${warning}`));
  const structural = parsed.error.issues.filter((issue) => !isSpanRangeIssue(issue)).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  return [...spans, ...structural];
}

/** The Architect's objective acceptance test: the document contract, then the compiler, then the blocking design-quality checks. */
export function architectDocumentErrors(document: unknown): string[] {
  const errors = validateArchitecturalDesignDocument(document, ARCHITECT_DOCUMENT_CONTRACT);
  if (errors.length) return errors;
  const compiled = compileArchitecture(document as ArchitecturalDesignDocument, { materials: DEFAULT_MATERIALS_CONFIG });
  if (compiled.errors.length || !compiled.diagnostics) return compiled.errors.length ? compiled.errors : ["The document produced no compiler diagnostics."];
  const gate = runDesignQualityGate(document as ArchitecturalDesignDocument, compiled.diagnostics);
  return gate.blocking.filter((check) => !check.passed).map((check) => `${check.id}: ${check.detail}`);
}

export interface ArchitectStageResult {
  ok: boolean;
  document?: ArchitecturalDesignDocument;
  sitePlan?: SitePlan;
  reflow?: SpatialReflow;
  scope?: ArchitecturalEditScope;
  plan?: SceneEditPlan;
  capabilityNeeds?: readonly { capability: string; reason: string }[];
  outdoorAssetPlacements?: OutdoorAssetPlacement[];
  outdoorAssetTombstones?: OutdoorAssetTombstone[];
  /** True only when an older caller explicitly returned the retired replacement-document envelope. */
  legacyDocumentReplacement?: boolean;
  attempts: number;
  durationMs: number;
  errors?: string[];
  repairRequests?: string[];
  usage?: ArchitectEditUsage;
}

export async function runArchitectStage(brief: string, timings: Timings, budgetMs: number, usageMeta: UsageMeta): Promise<ArchitectStageResult> {
  let previousDocument: unknown;
  const result = await runStage({
    stageName: "architect",
    system: ARCHITECT_SYSTEM_PROMPT,
    buildMessage: (previousErrors) => [
      `BRIEF:\n${brief}`,
      "Author the executable architecture now. Do not omit geometry, openings, or roofs.",
      previousErrors.length ? `Objective Architect-owned failures to repair without redesigning unaffected architecture:\n${previousErrors.map((error) => `- ${error}`).join("\n")}\n\nPrevious document; return this same document corrected only for those failures:\n${JSON.stringify(previousDocument)}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: architectOutputSchema,
    timings,
    remainingBudgetMs: budgetMs,
    usageMeta,
    maxOutputTokens: 5000,
    normalize: (raw) => {
      if (typeof raw === "object" && raw !== null && "document" in raw) previousDocument = (raw as { document: unknown }).document;
      return raw;
    },
    schemaError: schemaRepairErrors,
    validate: ({ document }) => architectDocumentErrors(document),
  });
  if (!result.ok) return { ok: false, attempts: result.attempts, durationMs: result.durationMs, errors: result.errors, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
  return { ok: true, document: result.value.document as unknown as ArchitecturalDesignDocument, attempts: result.attempts, durationMs: result.durationMs, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
}

/**
 * Edit mode of the same Architect: the same document contract and acceptance test, plus a dedicated response
 * envelope that carries transient edit authorization.
 * The edited document replaces the saved one only if it passes everything a newly authored document must pass.
 */
export const LEGACY_ARCHITECT_EDIT_INSTRUCTIONS = `EDIT MODE — legacy document replacement instructions retained only for historical fixtures; it is never sent to the live Architect.
- RESPONSE ENVELOPE — this edit-only response contract supersedes the generation instruction to return { document }. Return exactly { document: ArchitecturalDesignDocument, scope: EditScope, sitePlan?: SitePlan, reflow?: SpatialReflow }. scope is REQUIRED on every edit, including a repair. Put scope at the TOP LEVEL beside document, NEVER inside document. document is the persisted architectural record and must never contain scope or other transient edit metadata. sitePlan and reflow remain top-level optional edit metadata and may appear only when the edit actually needs a controlled Site Plan reflow. Do not return any other keys. If the request cannot be expressed, return the unchanged document with scope:{intent:"...",targets:[]} so the system can record the unmet capability; targets may be empty only in that no-change case.
- You receive the complete current ArchitecturalDesignDocument and the owner's exact edit request. Return the complete document in that response envelope with the requested edit applied.
- Change any architectural fields genuinely required to accomplish the request — masses, dimensions, positions, footprint operations, facade geometry, openings, entrance geometry, projections/recesses, roofs — and nothing else.
- Everything unrelated to the request stays exactly as it is: the same ids, names, roles, positions, dimensions, rotations, elevations, floors, operations, openings and roof recipes, value for value. Change an unrelated field only when it is objectively necessary to keep the architecture valid under the contracts above.
- Preserve siteStrategy. Preserve every existing architectural and site element by default. When the requested architectural change needs space or creates a collision/access conflict, you may minimally reflow directly affected existing masses and Site Plan elements. Return \`sitePlan\` only when it changes, and return \`reflow:{elements:[{id,action,dependsOn,reason}]}\` for EVERY moved/resized/rotated/rerouted element. IDs are \`mass:<mass-id>\`, \`site:driveway\`, \`site:parking:0\`, \`site:pool\`, \`site:terrace\`, \`site:poolDeck\`, \`site:path:<from>><to>:<index>\`, \`site:landscape:<purpose>:<index>\`, and \`site:feature:<id>\`. A reflow element dependsOn the directly changed mass or preceding affected element. Keep semantic identity (path endpoints/surface, landscape purpose/kind, wall attachment, feature id) intact. Reflow only the smallest connected neighborhood; at most three dependency hops are supported. Never move outdoor assets, delete/substitute site elements, silently squeeze an element, or redesign the property. If this vocabulary cannot express a valid solution, return the unchanged document and a Capability Need in your reasoning rather than inventing a substitute.
- Do not remove or rename masses, openings or roofs the request does not concern. Do not swap the roof system unless the request is about the roof.
- Localized exterior edits are authorized by target mass, local facade, semantic host/level, and affected primitive fields — never by a named feature recipe. Select the correct existing mass and compose only the primitives needed there. Use semantic assembly hosts so floor, facade, roof, slab, entrance, and terrace attachments resolve deterministically. Do not resize, move, rotate, or rewrite nearby openings merely because they locate the requested work. \`components\` is a stage placeholder and must remain exactly unchanged. If the request cannot be faithfully represented by the available primitive vocabulary, preserve the document and report a Capability Need rather than substitute a different design.
- DECLARE YOUR EDIT SCOPE. Always return \`scope:{intent,targets:[...]}\` describing exactly what your edit changes; it is the only edit permission and every change is verified against it. Each target is \`{element, action, fields?, facade?, level?, openingTypes?}\`: \`element\` is \`mass:<id>\` (architecture) or a Site Plan id as listed above (site); \`action\` is \`modify\`, \`add\` or \`remove\`; a modified mass declares \`fields\` from \`openings\`, \`operations\`, \`assemblies\`, \`roof\`, \`geometry\` (position/size/rotation/elevation — also needs a reflow entry) and \`form\` (floors, height, form and other non-identity mass fields); \`facade\` is the mass-LOCAL facade and \`level\` (\`ground\`/\`upper\`) the storey band the openings/operations/assemblies sit on; \`openingTypes\` narrows openings to door/glazing-zone/opening-rhythm. A new mass is declared \`add\` and must be attached (parentId or relationship) to an existing mass. A directly requested site change (moving the pool, extending the driveway, adding a planting zone) is a site target, not a reflow; its knock-on moves are reflow entries depending on it. Declare the narrowest scope that covers your edit: a declared target or field your edit does not change is rejected, and so is any change outside the declaration.
- On a repair request, the "previous response envelope" is your edited candidate: correct only the listed failures, keep the requested edit, and keep scope at the required top level.`;

/** V2 follow-up edits are executable operation plans, never replacement documents. */
export const ARCHITECT_EDIT_INSTRUCTIONS = `EDIT MODE — operate on your own saved V2 design; do not regenerate or return a replacement document.
- Return exactly { intent, goals?, operations, status?, rationale?, siteReflow?, capabilityNeeds? }. This operation plan is the only response contract on the initial call and on a repair. Do not return document, scope, or arbitrary fields.
- GOALS. First read the owner's whole request and list every distinct design goal it asks for as goals:[{id,intent,request,status,...}]; request quotes the owner's words that goal answers. Each goal ends in exactly one status: "planned" with operationIds ["operation:<zero-based index>", ...] (several operations may serve one goal, and one operation may serve several related goals); "already-satisfied" with evidence and evidenceTargetIds naming the existing targets that prove it; or "capability-needed" with capabilityNeedIds naming entries of capabilityNeeds (give each need an id). Every operation must serve at least one declared goal. goals is mandatory when the request asks for several things or for whole-property work; a single local edit may omit it. Never silently drop a goal: the edit is reported to the owner goal by goal.
- COORDINATED PLANS. For a broad request inspect the whole requested scope and author one coordinated plan that achieves every goal the vocabulary can express — use as many operations as the design needs; do not shrink the request to the smallest change. Prefer modifying existing stable targets over deleting and recreating them, and never delete an element unless a goal requires its removal. Report the remainder as Capability Needs; achievable goals still execute.
- Use stable targets from the CURRENT AUTHORITATIVE EDIT CONTEXT. Operations are create, delete, move, rotate, resize, changeMaterial, attach, detach, duplicate, extrude, and cut. Use create {kind:"assembly",massId,assembly} for hosted architectural construction, and create {kind:"scene",scene} for free-standing primitives. extrude and cut are not executable yet: they only record a Capability Need. There is no operation that adds or edits doors, windows, interior walls, stairs or floor openings; goals that need them are capability-needed.
- XYZ position, rotation, and size are arrays of exactly three finite numbers [x,y,z]. Size components must be positive. Use position's x/z for site placement and a rotation's y component for yaw.
- A support surface is not a structural attachment. Move an asset directly to its new position and the executor will resolve and persist its support metadata. Use attach/detach only for structurally hosted scene objects; never detach an asset merely because it is sitting on a surface.
- OCCUPIABLE CONSTRUCTION. An elevated slab people stand on needs a railing on its outer edge, a real host (facade/floor/roof/slab), and, on an upper floor, a door on that facade opening onto it. If you cannot provide the access, report it as a Capability Need instead of building an unreachable platform.
- Inspect the current semantic objects and assemblies before creating anything. If a requested condition already exists, mark that goal already-satisfied (and for a single-goal request return { status:"already-satisfied", rationale:"...", operations:[] }); do not create a duplicate. When changing, improving, or enlarging an existing object, target its stable ID rather than creating a second object.
- Preserve every unrelated stable identity. A direct site edit is an operation against its site target; declare consequential local moves in siteReflow. Do not move outdoor assets, substitute unrelated elements, or use request nouns as routing rules.
- If nothing in the request can be expressed, keep the world unchanged and return { status:"capability-needed", operations:[], capabilityNeeds:[{id,capability,reason}] }. Empty operations are valid only for that outcome or already-satisfied with rationale. Never add an operation just to avoid an empty plan. The executor applies the complete plan atomically and rejects invalid targets or geometry.
- On a repair, keep the goals and operations that were valid, fix every reported failure (including INCOMPLETE_PLAN coverage gaps), and return the same operation-plan contract.`;

/** The edit call's system prompt: the same Architect and shared geometry contract, with the plan-only edit contract. */
export const ARCHITECT_EDIT_SYSTEM_PROMPT = `You are the sole AI Architect for a residential property, editing your own saved, executable design through an operation plan.\n\n${ARCHITECT_EDIT_CONTRACT}\n\n${ARCHITECT_EDIT_INSTRUCTIONS}`;

export interface ArchitectEditInput {
  current: ArchitecturalDesignDocument;
  currentSitePlan?: SitePlan;
  outdoorAssetPlacements?: readonly OutdoorAssetPlacement[];
  outdoorAssetTombstones?: readonly OutdoorAssetTombstone[];
  request: string;
  /** Stable catalog identities supplied by the UI selection, if it has one. */
  selectedTargetIds?: readonly string[];
  timings: Timings;
  budgetMs: number;
  usageMeta: UsageMeta;
  /** Objective checks the caller owns on a candidate that already passed the Architect acceptance test (e.g. the final project integrity gate). */
  checkCandidate?: (document: ArchitecturalDesignDocument, sitePlan?: SitePlan, outdoorAssetPlacements?: readonly OutdoorAssetPlacement[]) => string[];
}

/** Compact, machine-readable feedback for a rejected executable edit plan. */
export type ArchitectPlanErrorCode =
  | "TARGET_NOT_FOUND" | "INVALID_HOST" | "COLLISION" | "UNSUPPORTED_OPERATION"
  | "OUT_OF_BOUNDS" | "INVALID_DIMENSIONS" | "SUPPORT_SURFACE_INVALID"
  | "SITE_REFLOW_INVALID" | "ACCESS_BLOCKED" | "DUPLICATE_SEMANTIC_OBJECT"
  | "COMPILER_INVALID" | "INTEGRITY_INVALID" | "SCHEMA_INVALID" | "INCOMPLETE_PLAN" | "CIRCULATION_INVALID";
export interface ArchitectPlanValidationError {
  code: ArchitectPlanErrorCode;
  operationId?: string;
  targetId?: string;
  message: string;
  relatedTargetIds?: string[];
}
export interface ArchitectPlanValidationResult {
  status: "invalid-plan";
  errors: ArchitectPlanValidationError[];
  warnings: string[];
  capabilityNeeds: readonly EditCapabilityNeed[];
  /** Present when the plan does not account for every goal of the request. */
  coverage?: Pick<EditCoverageReport, "code" | "message" | "unaccountedGoalIds" | "unaccountedRequestItems" | "unmappedOperationIds">;
}

const isOperationPlan = (value: unknown): value is SceneEditPlan => typeof value === "object" && value !== null && Array.isArray((value as { operations?: unknown }).operations);
/** Includes malformed operation responses so schema failures enter the same repair context as executor failures. */
const looksLikeOperationPlan = (value: unknown) => typeof value === "object" && value !== null && (
  "operations" in value || "intent" in value || "status" in value || "capabilityNeeds" in value || "siteReflow" in value
);
const operationMassRoots = (operations: readonly SceneOperation[]) => new Set(operations.flatMap((operation) => {
  if (operation.op === "create" && operation.object.kind === "assembly") return [operation.object.massId];
  if ("target" in operation && operation.target.startsWith("mass:")) return [operation.target.slice(5)];
  if ("target" in operation && (operation.target.startsWith("assembly:") || operation.target.startsWith("part:"))) return [operation.target.split(":")[1]];
  return [];
}));
const operationSiteRoots = (operations: readonly SceneOperation[]) => operations.flatMap((operation) => "target" in operation && operation.target.startsWith("site:") ? [{ element: operation.target, action: "modify" as const }] : []);

const operationTarget = (operation: SceneOperation): string | undefined => {
  if ("target" in operation) return operation.target;
  return operation.op === "create" && operation.object.kind === "assembly" ? `mass:${operation.object.massId}` : undefined;
};

/** Prefix for circulation findings an edit introduced; see `introducedCirculationIssues`. */
export const CIRCULATION_PREFIX = "CIRCULATION:";

const validationCode = (message: string): ArchitectPlanErrorCode => {
  if (message.startsWith(INCOMPLETE_PLAN_PREFIX)) return "INCOMPLETE_PLAN";
  if (message.startsWith(CIRCULATION_PREFIX)) return "CIRCULATION_INVALID";
  const text = message.toLowerCase();
  if (/collision|clear-of-building|overlap/.test(text)) return "COLLISION";
  if (/nonexistent|cannot resolve|unknown (host )?mass|unknown target/.test(text)) return "TARGET_NOT_FOUND";
  if (/does not support|unsupported/.test(text)) return "UNSUPPORTED_OPERATION";
  if (/host|wall-hosted|detach/.test(text)) return "INVALID_HOST";
  if (/already exists|duplicate/.test(text)) return "DUPLICATE_SEMANTIC_OBJECT";
  if (/positive size|invalid geometry|dimension|finite|transform/.test(text)) return "INVALID_DIMENSIONS";
  if (/support|ground|floating/.test(text)) return "SUPPORT_SURFACE_INVALID";
  if (/reflow|site frame|site plan/.test(text)) return "SITE_REFLOW_INVALID";
  if (/access|path/.test(text)) return "ACCESS_BLOCKED";
  if (/compiler|roof|document produced/.test(text)) return "COMPILER_INVALID";
  if (/integrity|scene-assets|protected outdoor/.test(text)) return "INTEGRITY_INVALID";
  if (/bound/.test(text)) return "OUT_OF_BOUNDS";
  return "SCHEMA_INVALID";
};

const errorTarget = (message: string, plan?: SceneEditPlan): string | undefined => {
  const match = message.match(/(?:mass|assembly|part|scene|asset|site):[\w:-]+/);
  // A coverage gap concerns the whole plan, not whichever operation happens to come first.
  if (message.startsWith(INCOMPLETE_PLAN_PREFIX)) return match?.[0];
  return match?.[0] ?? plan?.operations.map(operationTarget).find((target): target is string => Boolean(target));
};

/** Keeps provider/schema/executor/compiler failures useful to the Architect without leaking application logs. */
export function architectPlanValidationResult(candidate: unknown, errors: readonly string[], capabilityNeeds: readonly EditCapabilityNeed[] = [], coverage?: EditCoverageReport): ArchitectPlanValidationResult {
  const plan = isOperationPlan(candidate) ? candidate : undefined;
  return {
    status: "invalid-plan",
    errors: errors.map((message) => {
      const targetId = errorTarget(message, plan);
      const operationIndex = plan?.operations.findIndex((operation) => operationTarget(operation) === targetId);
      const relatedTargetIds = [...new Set(message.match(/(?:mass|assembly|part|scene|asset|site):[\w:-]+/g) ?? [])];
      return {
        code: validationCode(message),
        ...(operationIndex !== undefined && operationIndex >= 0 ? { operationId: `operation:${operationIndex}` } : {}),
        ...(targetId ? { targetId } : {}),
        message,
        ...(relatedTargetIds.length ? { relatedTargetIds } : targetId ? { relatedTargetIds: [targetId] } : {}),
      };
    }),
    warnings: [],
    capabilityNeeds,
    ...(coverage ? { coverage: { code: coverage.code, message: coverage.message, unaccountedGoalIds: coverage.unaccountedGoalIds, unaccountedRequestItems: coverage.unaccountedRequestItems, unmappedOperationIds: coverage.unmappedOperationIds } } : {}),
  };
}

/** Operation targets are the authorization evidence; only operated mass/site identities can seed a reflow graph. */
export function architectOperationSpatialErrors(current: ArchitecturalDesignDocument, edited: ArchitecturalDesignDocument, beforePlan: SitePlan, afterPlan: SitePlan, plan: SceneEditPlan): string[] {
  const before = v2SiteFrameForDocument(current), after = v2SiteFrameForDocument(edited);
  if (!plan.siteReflow && before && after && (before.anchor.id !== after.anchor.id || before.center.x !== after.center.x || before.center.z !== after.center.z || before.anchor.width !== after.anchor.width || before.anchor.depth !== after.anchor.depth || before.anchor.rotation !== after.anchor.rotation)) {
    return ["The site frame moved without a declared siteReflow."];
  }
  return spatialReflowErrors({ beforeDocument: current, afterDocument: edited, beforePlan, afterPlan, reflow: plan.siteReflow, directMassIds: operationMassRoots(plan.operations), siteTargets: operationSiteRoots(plan.operations) });
}

const reflowMassIdsOf = (reflow?: SpatialReflow) => new Set(reflow?.elements.filter((entry) => entry.id.startsWith("mass:")).map((entry) => entry.id.slice(5)) ?? []);

/** The Site Plan validation for a scoped edit: declared direct targets are roots; everything else must be a local reflow. */
export function architectEditSpatialErrors(current: ArchitecturalDesignDocument, edited: ArchitecturalDesignDocument, beforePlan: SitePlan, afterPlan: SitePlan, scope: ArchitecturalEditScope | undefined, reflow?: SpatialReflow): string[] {
  const siteChanged = changedSitePlanElements(beforePlan, afterPlan).length > 0;
  if (!scope && siteChanged) return ["Declare the edit scope: a Site Plan change needs `scope.targets` naming the site elements the edit changes directly."];
  return spatialReflowErrors({ beforeDocument: current, afterDocument: edited, beforePlan, afterPlan, reflow, directMassIds: scopeMassIds(scope), siteTargets: scopeSiteTargets(scope) });
}

/** Objective preservation findings for an edit: the site strategy and the site frame the existing Site Plan is anchored to. */
export function architectEditPreservationErrors(current: ArchitecturalDesignDocument, edited: ArchitecturalDesignDocument, scope: ArchitecturalEditScope | undefined, reflow?: SpatialReflow): string[] {
  const errors: string[] = [];
  if (JSON.stringify(edited.siteStrategy) !== JSON.stringify(current.siteStrategy)) errors.push("siteStrategy changed: the existing Site Plan is authored against it; keep siteStrategy exactly as it was.");
  const before = v2SiteFrameForDocument(current), after = v2SiteFrameForDocument(edited);
  if (!reflow && before && after) {
    const same = before.anchor.id === after.anchor.id && Math.abs(before.center.x - after.center.x) < 1e-6 && Math.abs(before.center.z - after.center.z) < 1e-6
      && Math.abs(before.anchor.width - after.anchor.width) < 1e-6 && Math.abs(before.anchor.depth - after.anchor.depth) < 1e-6 && Math.abs(before.anchor.rotation - after.anchor.rotation) < 1e-6;
    if (!same) errors.push(`The site frame moved without a controlled Site Plan reflow: dominant mass "${before.anchor.id}" was ${before.anchor.width}x${before.anchor.depth}m at (${before.center.x}, ${before.center.z}) rotation ${before.anchor.rotation} and is now "${after.anchor.id}" ${after.anchor.width}x${after.anchor.depth}m at (${after.center.x}, ${after.center.z}) rotation ${after.anchor.rotation}. Return the affected Site Plan and its auditable reflow graph, or keep the frame unchanged.`);
  }
  const reflowMassIds = reflowMassIdsOf(reflow);
  // An untouched document needs no declaration: the caller reports it as an unmet capability, not a scope failure.
  if (!scope && !architecturalEditDiff(current, edited, undefined, reflowMassIds).length) return errors;
  const declarationErrors = editScopeDeclarationErrors(current, edited, scope, reflowMassIds);
  if (!scope || declarationErrors.some((error) => !error.includes("changed nothing there"))) return [...errors, ...declarationErrors];
  const changes = architecturalEditDiff(current, edited, scope, reflowMassIds);
  for (const change of changes.filter((change) => change.unrelated)) errors.push(`Change outside the declared edit scope: ${describeArchitecturalEditDiff([change])[0]}. Keep it identical, or declare it only if the request genuinely requires it.`);
  return [...errors, ...declarationErrors];
}

export async function runArchitectEditStage(input: ArchitectEditInput): Promise<ArchitectStageResult> {
  const { current, request } = input;
  const initialContext: ArchitectEditContext | undefined = input.currentSitePlan
    ? buildArchitectEditContext({ document: current, sitePlan: input.currentSitePlan, outdoorAssetPlacements: input.outdoorAssetPlacements, request, selectedTargetIds: input.selectedTargetIds })
    : undefined;
  const breadth = initialContext?.contextTier ?? classifyArchitectEditContext(request);
  const editUsage = createArchitectEditUsage(breadth);
  const knownTargetIds = new Set(input.currentSitePlan ? targetCatalog({ document: current, sitePlan: input.currentSitePlan, outdoorAssetPlacements: input.outdoorAssetPlacements }).map((target) => target.id) : []);
  /** Goal bookkeeping only: the Architect declared the goals; this checks each one is accounted for. */
  const coverageOf = (plan: SceneEditPlan) => editPlanCoverage({ goals: plan.goals, operations: plan.operations, capabilityNeeds: plan.capabilityNeeds, breadth, request, knownTargetIds });
  if (initialContext) {
    const d = initialContext.diagnostics;
    console.info(`[architect-edit-context]\ntier: ${initialContext.contextTier}\ntargets: ${initialContext.targets.length}\nnearby: ${initialContext.nearby.length}\ncontextChars: ${d.contextChars}\nestimatedTokens: ${d.estimatedTokens}\nfullDocumentIncluded: ${d.fullDocumentIncluded}`);
  }
  // Every candidate is executed from `current`; no rejected plan is ever carried into the next attempt.
  let previousOutput: unknown;
  let previousValidation: ArchitectPlanValidationResult | undefined;
  const rejectedFingerprints = new Set<string>();
  const attemptEvidence = (candidate: unknown, errors: readonly string[], attempt: number) => {
    if (looksLikeOperationPlan(candidate)) {
      const executed = input.currentSitePlan && isOperationPlan(candidate)
        ? executeSceneEditPlan({ document: current, sitePlan: input.currentSitePlan, outdoorAssetPlacements: input.outdoorAssetPlacements, outdoorAssetTombstones: input.outdoorAssetTombstones }, candidate)
        : undefined;
      previousValidation = architectPlanValidationResult(candidate, errors, executed?.capabilityNeeds ?? [], isOperationPlan(candidate) ? coverageOf(candidate) : undefined);
      return { diagnostic: errors.join("; "), candidate: JSON.stringify({ kind: "architectural-operation-edit-rejection", attempt, original: { fingerprint: fingerprint(architecturalDocumentFingerprintInput(current)) }, plan: candidate, validation: previousValidation }) };
    }
    const candidateDocument = documentOf(candidate);
    const candidateFingerprint = fingerprint(architecturalDocumentFingerprintInput(candidateDocument));
    const contractErrors = architectDocumentErrors(candidateDocument);
    let preservationErrors: string[] = [];
    let integrityErrors: string[] = [];
    let diff: ReturnType<typeof architecturalEditDiff> = [];
    const candidateOutput = (typeof candidate === "object" && candidate !== null ? candidate : {}) as { sitePlan?: SitePlan; reflow?: SpatialReflow; scope?: ArchitecturalEditScope };
    if (!contractErrors.length) {
      const edited = candidateDocument as ArchitecturalDesignDocument;
      const plan = candidateOutput.sitePlan ?? input.currentSitePlan;
      preservationErrors = architectEditPreservationErrors(current, edited, candidateOutput.scope, candidateOutput.reflow);
      if (plan && input.currentSitePlan) preservationErrors.push(...architectEditSpatialErrors(current, edited, input.currentSitePlan, plan, candidateOutput.scope, candidateOutput.reflow));
      diff = architecturalEditDiff(current, edited, candidateOutput.scope, reflowMassIdsOf(candidateOutput.reflow));
      if (!preservationErrors.length) integrityErrors = input.checkCandidate?.(edited, plan) ?? [];
    }
    return {
      diagnostic: errors.join("; "),
      candidate: JSON.stringify({
        kind: "architectural-edit-rejection",
        attempt,
        original: { fingerprint: fingerprint(architecturalDocumentFingerprintInput(current)) },
        candidate: { fingerprint: candidateFingerprint, document: candidateDocument },
        errors: { rejection: [...errors], validation: contractErrors, preservation: preservationErrors, integrity: integrityErrors },
        scope: candidateOutput.scope,
        diff,
      }),
    };
  };
  const result = await runStage({
    stageName: "architect-edit",
    usageStage: "architect",
    system: ARCHITECT_EDIT_SYSTEM_PROMPT,
    buildMessage: (previousErrors) => {
      const context = initialContext ?? buildArchitectEditContext({ document: current, sitePlan: input.currentSitePlan!, outdoorAssetPlacements: input.outdoorAssetPlacements, request });
      const planRepair = previousValidation && looksLikeOperationPlan(previousOutput);
      // An incomplete plan is repaired by planning more, so it keeps the whole authoritative world it was planned from.
      const replan = Boolean(previousValidation?.coverage);
      return [
        `EDIT REQUEST (the owner's exact words):\n${request}`,
        planRepair
          ? `REPAIR CONTEXT — preserve the owner's intent. Revise the failed plan: keep its valid goals and operations, fix each reported failure, and add what is missing. Do not invent unrelated geometry or work around a true capability failure; report it as a Capability Need.\n${JSON.stringify(buildArchitectRepairContext(context, previousValidation!.errors.flatMap((error) => error.relatedTargetIds ?? (error.targetId ? [error.targetId] : [])), previousValidation, previousOutput, { includeWorld: replan }))}`
          : `CURRENT AUTHORITATIVE EDIT CONTEXT — operate only on these stable, executable targets.${context.contextTier === "global-architecture" ? "" : " This compact context is authoritative for this request; unrelated saved state is intentionally omitted."}\n${JSON.stringify(input.currentSitePlan ? context : { targetCatalog: [] })}`,
        "Return the operation-plan contract from EDIT MODE.",
        previousErrors.length && !planRepair ? `Objective failures in your edit response to repair without touching unrelated state:\n${previousErrors.map((error) => `- ${error}`).join("\n")}\n\nPrevious response:\n${JSON.stringify(previousOutput)}\n\nFor a historical legacy envelope, scope stays top-level and is required.` : "",
      ].filter(Boolean).join("\n\n");
    },
    schema: architectEditResponseSchema,
    wireSchema: architectEditWireSchema,
    timings: input.timings,
    remainingBudgetMs: input.budgetMs,
    usageMeta: input.usageMeta,
    maxOutputTokens: 5000,
    maxAttempts: 3,
    onAttemptUsage: (attempt, usage) => recordArchitectEditUsage(editUsage, attempt, usage),
    normalize: (raw) => {
      previousOutput = raw;
      if (isOperationPlan(raw) || typeof raw !== "object" || raw === null || !("document" in raw) || !("sitePlan" in raw)) return raw;
      const candidate = raw as { document: ArchitecturalDesignDocument; sitePlan?: unknown };
      const context = sitePlanContextForDocument(candidate.document.brief, candidate.document);
      return context && candidate.sitePlan ? { ...candidate, sitePlan: normalizeSitePlan(candidate.sitePlan, context) } : raw;
    },
    schemaError: (raw) => {
      if (looksLikeOperationPlan(raw)) {
        const parsed = sceneEditPlanSchema.safeParse(raw);
        return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      }
      if (typeof raw === "object" && raw !== null && "document" in raw) return schemaRepairErrors(raw, architectEditOutputSchema);
      return schemaRepairErrors(raw, architectEditResponseSchema);
    },
    validate: (value) => {
      if (isOperationPlan(value)) {
        if (!input.currentSitePlan) return ["The saved V2 project has no canonical Site Plan."];
        const plan = value as unknown as SceneEditPlan;
        // Coverage is reported together with execution failures so one repair can address both.
        const coverage = coverageOf(plan)?.issues ?? [];
        const executed = executeSceneEditPlan({ document: current, sitePlan: input.currentSitePlan, outdoorAssetPlacements: input.outdoorAssetPlacements, outdoorAssetTombstones: input.outdoorAssetTombstones }, plan);
        if (!executed.ok) return [...executed.errors, ...coverage];
        const architectural = architectDocumentErrors(executed.document);
        if (architectural.length) return [...architectural, ...coverage];
        const spatial = architectOperationSpatialErrors(current, executed.document, input.currentSitePlan, executed.sitePlan, plan);
        if (spatial.length) return [...spatial, ...coverage];
        const circulation = introducedCirculationIssues(current, executed.document).map((issue) => `${CIRCULATION_PREFIX} ${issue.message}`);
        return [...circulation, ...(input.checkCandidate?.(executed.document, executed.sitePlan, executed.outdoorAssetPlacements) ?? []), ...coverage];
      }
      const { document, sitePlan, reflow, scope: declared } = value as unknown as z.infer<typeof architectEditOutputSchema>;
      const errors = architectDocumentErrors(document);
      if (errors.length) return errors;
      const edited = document as unknown as ArchitecturalDesignDocument;
      const preserved = architectEditPreservationErrors(current, edited, declared, reflow);
      if (preserved.length) return preserved;
      const plan = sitePlan ?? input.currentSitePlan;
      if (plan && input.currentSitePlan) {
        const spatial = architectEditSpatialErrors(current, edited, input.currentSitePlan, plan, declared, reflow);
        if (spatial.length) return spatial;
      }
      return input.checkCandidate?.(edited, plan) ?? [];
    },
    rejectedAttemptEvidence: ({ candidate, errors, attempt }) => attemptEvidence(candidate, errors, attempt),
    // A verbatim repeat cannot add evidence. Distinct candidates, including ones
    // that still hit the same target or integrity rule, retain the full bounded
    // repair budget.
    stopRetry: ({ candidate }) => {
      const candidateFingerprint = fingerprint(JSON.stringify(candidate) ?? "undefined");
      if (rejectedFingerprints.has(candidateFingerprint)) return "REPAIR_STOPPED: the Architect repeated an identical invalid plan.";
      rejectedFingerprints.add(candidateFingerprint);
      return undefined;
    },
  });
  console.info(`[architect-edit-usage]\nattempts: ${editUsage.architectAttempts}\ninputTokens: ${editUsage.inputTokensTotal}\noutputTokens: ${editUsage.outputTokensTotal}\ntotalTokens: ${editUsage.totalTokens}\nrepaired: ${editUsage.repaired}`);
  if (!result.ok) return { ok: false, attempts: result.attempts, durationMs: result.durationMs, errors: result.errors, usage: editUsage, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
  if (isOperationPlan(result.value)) {
    if (!input.currentSitePlan) return { ok: false, attempts: result.attempts, durationMs: result.durationMs, errors: ["The saved V2 project has no canonical Site Plan."], usage: editUsage };
    const plan = result.value as unknown as SceneEditPlan;
    const executed = executeSceneEditPlan({ document: current, sitePlan: input.currentSitePlan, outdoorAssetPlacements: input.outdoorAssetPlacements, outdoorAssetTombstones: input.outdoorAssetTombstones }, plan);
    if (!executed.ok) return { ok: false, attempts: result.attempts, durationMs: result.durationMs, errors: executed.errors, usage: editUsage };
    return { ok: true, document: { ...executed.document, metadata: current.metadata }, sitePlan: executed.sitePlan, outdoorAssetPlacements: executed.outdoorAssetPlacements, outdoorAssetTombstones: executed.outdoorAssetTombstones, plan, capabilityNeeds: executed.capabilityNeeds, attempts: result.attempts, durationMs: result.durationMs, usage: editUsage, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
  }
  const legacy = result.value as unknown as z.infer<typeof architectEditOutputSchema>;
  const document = { ...(legacy.document as unknown as ArchitecturalDesignDocument), metadata: current.metadata };
  return { ok: true, document, ...(legacy.sitePlan ? { sitePlan: legacy.sitePlan as SitePlan } : {}), ...(legacy.reflow ? { reflow: legacy.reflow as SpatialReflow } : {}), ...(legacy.scope ? { scope: legacy.scope as ArchitecturalEditScope } : {}), legacyDocumentReplacement: true, attempts: result.attempts, durationMs: result.durationMs, usage: editUsage, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
}
