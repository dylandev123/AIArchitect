import { z } from "zod";
import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import { compileArchitecture, facadeSpanWarnings } from "../compiler";
import { CORNER_VALUES, ENTRY_TREATMENT_VALUES, FACADE_TREATMENT_VALUES, FOOTPRINT_SCOPE_VALUES, MASS_FACADE_VALUES, MASS_RELATIONSHIP_KIND_VALUES, MASS_ROLE_VALUES, OUTDOOR_SIDE_VALUES, OUTDOOR_TRANSITION_VALUES, ROOF_EDGE_VALUES, AUTHORED_ROOF_RECIPE_KINDS, STRUCTURAL_EXPRESSION_VALUES, VOLUME_FORM_VALUES, VOLUME_HEIGHT_VALUES, VOLUME_HIERARCHY_VALUES, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument, type DocumentValidationOptions } from "../document";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { COMPASS_SIDES, SIDE_VECTOR, SITE_ENVIRONMENTS } from "@/lib/house/siteSettings";
import { SHARED_WALL_GAP_M } from "../volumePlan";
import { runDesignQualityGate } from "./qualityGate";
import { runStage } from "./runStage";

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
  z.object({ ...identified, type: z.literal("notch"), corner: z.enum(CORNER_VALUES), width: finiteNumber, depth: finiteNumber, floors: scope }).strict(),
  z.object({ ...identified, type: z.literal("entry-recess"), facade, width: finiteNumber, depth: finiteNumber, floors: scope }).strict(),
  z.object({ ...identified, type: z.literal("chamfer"), corner: z.enum(CORNER_VALUES), size: finiteNumber, floors: scope, glazed: z.boolean().optional() }).strict(),
]);
const openingSchema = z.discriminatedUnion("type", [
  z.object({ ...identified, type: z.literal("glazing-zone"), facade, ...span, heightRatio: finiteNumber, floors: scope, frame: z.boolean().optional(), reveal: finiteNumber.optional() }).strict(),
  z.object({ ...identified, type: z.literal("opening-rhythm"), facade, count: finiteNumber.int().positive(), width: finiteNumber, height: finiteNumber, sill: finiteNumber, floors: scope }).strict(),
  z.object({ ...identified, type: z.literal("door"), facade, ...span, height: finiteNumber.optional(), floors: scope, frame: z.boolean().optional(), reveal: finiteNumber.optional() }).strict(),
]);
const volumePlanSchema = z.object({ form: z.enum(VOLUME_FORM_VALUES), height: z.enum(VOLUME_HEIGHT_VALUES), hierarchy: z.enum(VOLUME_HIERARCHY_VALUES), viewFacade: z.enum(FACADE_TREATMENT_VALUES), arrivalFacade: z.enum(FACADE_TREATMENT_VALUES), flankFacades: z.enum(FACADE_TREATMENT_VALUES), courtyardFacade: z.enum(FACADE_TREATMENT_VALUES).optional(), entry: z.enum(ENTRY_TREATMENT_VALUES), outdoor: z.enum(OUTDOOR_TRANSITION_VALUES), outdoorSide: z.enum(OUTDOOR_SIDE_VALUES), roofEdge: z.enum(ROOF_EDGE_VALUES), structure: z.enum(STRUCTURAL_EXPRESSION_VALUES) }).strict();
const roofExpressionSchema = z.object({
  overhang: finiteNumber.optional(), verticalGap: finiteNumber.optional(), horizontalOffset: z.object({ x: finiteNumber.optional(), z: finiteNumber.optional() }).strict().optional(), thickness: finiteNumber.optional(), fasciaDepth: finiteNumber.optional(), soffitMaterial: z.enum(["roof", "exterior", "dark"]).optional(), supportStyle: z.enum(["reveal", "clerestory", "band"]).optional(), clerestoryHeight: finiteNumber.optional(), secondary: z.object({ width: finiteNumber.optional(), depth: finiteNumber.optional(), elevation: finiteNumber.optional(), offsetX: finiteNumber.optional(), offsetZ: finiteNumber.optional() }).strict().optional(),
}).strict();
/** The canonical `AuthoredRoofRecipe`: the same kinds, overhang and pitch that `roofConflicts` requires of a complete roof. */
const roofRecipeSchema = z.object({ id: z.string().min(1), massId: z.string().min(1), kind: z.enum(AUTHORED_ROOF_RECIPE_KINDS), overhang: finiteNumber.nonnegative().describe("Meters, >= 0. Required."), pitch: finiteNumber.nonnegative().describe("Degrees, >= 0. Required."), orientation: finiteNumber.optional(), expression: roofExpressionSchema.optional(), parapet: z.object({ height: finiteNumber.positive(), thickness: finiteNumber.positive().optional() }).strict().optional() }).strict();
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
  operations: z.array(operationSchema).optional(), openings: z.array(openingSchema).optional(), plan: volumePlanSchema.optional(),
}).strict();
/** The structured-output boundary requires the compiler's roof container, not merely a `roofs` key. */
export const architectOutputSchema = z.object({
  document: z.object({
    version: z.literal(1), brief: z.string(),
    siteStrategy: z.object({ environment: z.enum(SITE_ENVIRONMENTS), viewDirection: z.enum(COMPASS_SIDES), arrivalDirection: z.enum(COMPASS_SIDES), terrain: z.enum(["level", "stepped"]) }).strict(),
    massing: z.object({ composition: z.enum(compositionKinds), masses: z.array(executableMassSchema).min(1) }).strict(),
    roofs: z.object({ recipes: z.array(roofRecipeSchema) }).strict(),
    facade: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), architecturalStyle: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), outdoorPlan: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), materialStrategy: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), components: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(), furnishings: z.object({ status: z.literal("pending"), notes: z.array(z.string()).optional() }).strict(),
    metadata: z.object({ createdAt: z.string(), source: z.enum(["fixture", "stage-pipeline", "live-generation"]), compiler: z.literal("procedural-architecture-v1") }).strict(),
  }).strict(),
}).strict();

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

Each mass uses executable id, name, role, position {x,z}, width, depth, optional height, floors, elevation, rotation, placementLocked:true, and real operations/openings. Operation variants are exact discriminated unions: recess/projection {facade,start,end,depth,floors?,open?,postSpacing?}; notch {corner,width,depth,floors?}; entry-recess {facade,width,depth,floors?}; chamfer {corner,size,floors?,glazed?}. A corner is ONLY one of ${CORNER_VALUES.join(", ")} — never "southeast" or a compass word. Opening variants are glazing-zone {facade,start,end,heightRatio,...}, opening-rhythm {facade,count,width,height,sill,...}, or door {facade,start,end,...}. If you supply plan, it is the closed VolumePlan enum vocabulary, never prose. Do not use geometry, program, footprintOperations, dimensions, placement, operation/face/centerOffset, or arbitrary fields; this is not a DTO.

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

const documentOf = (raw: unknown): unknown => (typeof raw === "object" && raw !== null && "document" in raw ? (raw as { document: unknown }).document : raw);
const isSpanRangeIssue = (issue: z.core.$ZodIssue) => (issue.code === "too_big" || issue.code === "too_small") && (issue.path.at(-1) === "start" || issue.path.at(-1) === "end");

/**
 * The repair errors for a response the schema rejected. A structurally sound document whose facade spans fall
 * outside 0..1 gets the compiler's own span diagnostic (element id, facade length, what would be built) instead of
 * zod's bare range message; any other schema issue keeps its schema detail.
 */
function schemaRepairErrors(raw: unknown): string[] {
  const document = documentOf(raw);
  const errors = validateArchitecturalDesignDocument(document, ARCHITECT_DOCUMENT_CONTRACT);
  if (errors.length) return errors;
  const parsed = architectOutputSchema.safeParse(raw);
  if (parsed.success || !parsed.error.issues.some(isSpanRangeIssue)) return [];
  const spans = (document as ArchitecturalDesignDocument).massing.masses.flatMap((mass) => facadeSpanWarnings(mass).map((warning) => `"${mass.id}" facade span rejected — ${warning}`));
  if (!spans.length) return [];
  return [...spans, ...parsed.error.issues.filter((issue) => !isSpanRangeIssue(issue)).map((issue) => `${issue.path.join(".")}: ${issue.message}`)];
}

export interface ArchitectStageResult {
  ok: boolean;
  document?: ArchitecturalDesignDocument;
  attempts: number;
  durationMs: number;
  errors?: string[];
  repairRequests?: string[];
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
    validate: ({ document }) => {
      const errors = validateArchitecturalDesignDocument(document, ARCHITECT_DOCUMENT_CONTRACT);
      if (errors.length) return errors;
      const compiled = compileArchitecture(document as unknown as ArchitecturalDesignDocument, { materials: DEFAULT_MATERIALS_CONFIG });
      if (compiled.errors.length || !compiled.diagnostics) return compiled.errors.length ? compiled.errors : ["The document produced no compiler diagnostics."];
      const gate = runDesignQualityGate(document as unknown as ArchitecturalDesignDocument, compiled.diagnostics);
      return gate.blocking.filter((check) => !check.passed).map((check) => `${check.id}: ${check.detail}`);
    },
  });
  if (!result.ok) return { ok: false, attempts: result.attempts, durationMs: result.durationMs, errors: result.errors, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
  return { ok: true, document: result.value.document as unknown as ArchitecturalDesignDocument, attempts: result.attempts, durationMs: result.durationMs, ...(result.repairRequests ? { repairRequests: result.repairRequests } : {}) };
}
