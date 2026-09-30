import { z } from "zod";
import { COMPASS_SIDES, SITE_ENVIRONMENTS } from "@/lib/house/siteSettings";

/**
 * Mirrors `IntentGoal` in designEngine.ts. Kept as a literal list here since zod needs a runtime enum.
 * Exported so the foundation prompt can disclose the exact closed vocabulary: with `strictJsonSchema: false`
 * (see model.ts), OpenAI does not grammar-constrain output to this enum, so a prompt that never states the
 * allowed values reliably produces off-vocabulary strings ("connection" instead of "indoor-outdoor") that
 * fail schema validation — the model can only match a closed set it's actually shown.
 */
export const INTENT_GOALS = [
  "privacy", "openness", "views", "shelter", "cross-ventilation", "daylight", "indoor-outdoor", "resort-feeling",
  "formality", "informality", "symmetry", "asymmetry", "horizontal-emphasis", "vertical-emphasis", "calm", "drama",
  "intimacy", "grand-entertaining", "family-living", "guest-private-service-separation",
] as const;

/** Same disclosure rationale as `INTENT_GOALS` above. */
export const COMPOSITION_BIAS_OPTIONS = ["symmetrical", "asymmetrical", "linear", "stepped"] as const;

/** Mirrors `MassRole` in document.ts. */
export const MASS_ROLES = ["main-living", "bedroom-wing", "guest-pavilion", "garage", "service", "connector", "terrace"] as const;

/**
 * Every kind `resolveMasses` (compiler.ts) resolves into a concrete position, rotation or elevation —
 * `surrounds-courtyard`, `view-facing` and `arrival-facing` place/orient a mass exactly like the rest, so
 * the mass-expansion loop can choose any of them and every accepted mass still ends up geometrically
 * resolved.
 */
export const MASS_EXPANSION_RELATIONSHIP_KINDS = ["adjacent-to", "connected-to", "offset-from", "separated-from", "surrounds-courtyard", "bridge-between", "stepped-above", "stepped-below", "view-facing", "arrival-facing"] as const;
/** The subset above that requires a `side` to move a mass in x/z (stepped-* only ever adjust elevation; view/arrival-facing only ever rotate). */
export const SIDE_RESOLVED_KINDS = ["adjacent-to", "connected-to", "offset-from", "separated-from", "surrounds-courtyard", "bridge-between"] as const;

export const ROOF_RECIPE_KINDS = ["flat", "floating-flat", "shed", "mono-pitch", "gable", "hip", "butterfly", "pavilion", "cross-gable", "mixed"] as const;

const compassSideSchema = z.enum(COMPASS_SIDES);
const siteEnvironmentSchema = z.enum(SITE_ENVIRONMENTS);

export const intentStageOutputSchema = z.object({
  mood: z.array(z.enum(INTENT_GOALS)).min(1).max(3).describe("The emotional register of the design, e.g. calm, drama, intimacy."),
  spatialGoals: z.array(z.enum(INTENT_GOALS)).min(1).max(4).describe("What the spaces must achieve: privacy, views, indoor-outdoor connection, etc."),
  environmentalGoals: z.array(z.enum(INTENT_GOALS)).min(1).max(3).describe("Climate/site response goals: shelter, cross-ventilation, daylight."),
  hierarchyGoals: z.array(z.string().min(1)).min(1).max(4).describe("Short statements of which volumes should dominate and which should recede."),
  compositionBias: z.enum(COMPOSITION_BIAS_OPTIONS).describe("The overall organizing logic of the massing."),
  style: z.string().min(1).describe("A short architectural style label, e.g. 'modern tropical', 'contemporary hillside'."),
});
export type IntentStageOutput = z.infer<typeof intentStageOutputSchema>;

export const siteStrategyStageOutputSchema = z.object({
  environment: siteEnvironmentSchema,
  viewDirection: compassSideSchema.describe("The compass side the primary view/outlook faces."),
  arrivalDirection: compassSideSchema.describe("The compass side vehicles/guests arrive from."),
  terrain: z.enum(["level", "stepped"]).describe("Whether masses should step with the land or sit at one level."),
  terrainResponse: z.string().min(1).describe("One or two sentences on how the massing should respond to this site."),
});
export type SiteStrategyStageOutput = z.infer<typeof siteStrategyStageOutputSchema>;

/**
 * The exact `SiteStrategy` (document.ts) shape every downstream stage depends on — mass-expansion,
 * architectural-geometry, roof-composition and the compiler all read `viewDirection`/`arrivalDirection`
 * directly, unguarded, on the assumption Foundation already normalized a complete value. Checked once, right
 * after Foundation runs (`assertValidSiteStrategy` in pipeline.ts) instead of re-guarded at every read site.
 */
export const siteStrategyInvariantSchema = z.object({
  environment: siteEnvironmentSchema,
  viewDirection: compassSideSchema,
  arrivalDirection: compassSideSchema,
  terrain: z.enum(["level", "stepped"]),
});

// ── Volume plan (see `VolumePlan` in document.ts) ────────────────────────────────────────────────────
// Closed vocabularies disclosed verbatim in the prompts, same reasoning as INTENT_GOALS above.
export const VOLUME_FORMS = ["bar", "l-shape", "prow", "setback"] as const;
export const VOLUME_HEIGHTS = ["low", "standard", "lofty", "double-height"] as const;
export const VOLUME_HIERARCHIES = ["dominant", "supporting", "recessive"] as const;
export const FACADE_TREATMENTS = ["solid", "punched", "slot", "ribbon", "glass-wall", "framed-glass", "shaded-glass", "fin-screened"] as const;
export const ENTRY_TREATMENTS = ["none", "flush", "recessed", "canopied"] as const;
export const OUTDOOR_TRANSITIONS = ["none", "veranda", "colonnade", "covered-terrace"] as const;
export const OUTDOOR_SIDES = ["view", "courtyard", "flank", "arrival"] as const;
export const ROOF_EDGES = ["parapet", "thin-eave", "deep-eave", "floating"] as const;
export const STRUCTURAL_EXPRESSIONS = ["bearing-walls", "post-and-beam", "cantilever", "pilotis"] as const;

/**
 * Every field optional: a missing field is never architecturally ambiguous enough to be worth a repair
 * retry — `completeVolumePlan` (volumePlan.ts) fills it from the mass's role. An off-vocabulary value is
 * stripped by `sanitizeVolumePlan` in the stage's `normalize` hook for the same reason.
 */
export const volumePlanSchema = z.object({
  form: z.enum(VOLUME_FORMS).optional(),
  height: z.enum(VOLUME_HEIGHTS).optional(),
  hierarchy: z.enum(VOLUME_HIERARCHIES).optional(),
  viewFacade: z.enum(FACADE_TREATMENTS).optional(),
  arrivalFacade: z.enum(FACADE_TREATMENTS).optional(),
  flankFacades: z.enum(FACADE_TREATMENTS).optional(),
  courtyardFacade: z.enum(FACADE_TREATMENTS).optional(),
  entry: z.enum(ENTRY_TREATMENTS).optional(),
  outdoor: z.enum(OUTDOOR_TRANSITIONS).optional(),
  outdoorSide: z.enum(OUTDOOR_SIDES).optional(),
  roofEdge: z.enum(ROOF_EDGES).optional(),
  structure: z.enum(STRUCTURAL_EXPRESSIONS).optional(),
});
export type VolumePlanOutput = z.infer<typeof volumePlanSchema>;

/** The prompt text every placing stage shares, so Foundation and Mass Expansion plan volumes in the same terms. */
export const VOLUME_PLAN_GUIDE = `Plan every volume as architecture before it has geometry, via "plan" (use only these literal values):
- form: ${VOLUME_FORMS.join(", ")} — bar = a plain long volume; l-shape = a corner carved out toward the view to make a sheltered outdoor room; prow = one view-side corner cut at an angle; setback = upper floor stepped back from the view facade (2+ floors only).
- height: ${VOLUME_HEIGHTS.join(", ")} — double-height = one soaring floor; low = a subordinate service height.
- hierarchy: ${VOLUME_HIERARCHIES.join(", ")} — how strongly this volume should read against the others.
- viewFacade / arrivalFacade / flankFacades / courtyardFacade (courtyard wings only): ${FACADE_TREATMENTS.join(", ")} — the facade facing the view, the facade facing arrival, the two remaining sides. fin-screened = glazing shaded by vertical sun fins.
- entry: ${ENTRY_TREATMENTS.join(", ")} — how this volume is entered from the arrival side.
- outdoor: ${OUTDOOR_TRANSITIONS.join(", ")}, with outdoorSide: ${OUTDOOR_SIDES.join(", ")} — the covered transition from inside to outside.
- roofEdge: ${ROOF_EDGES.join(", ")} — parapet = crisp box edge with no eave; floating = a thin roof plane hovering on a glass reveal.
- structure: ${STRUCTURAL_EXPRESSIONS.join(", ")} — cantilever = upper floor overhangs the view side (2+ floors) or a raised box on props; pilotis = columns under a raised volume.
Make the plan specific to what this volume does: contrast solid arrival faces with open view faces, and do not give every volume the same plan.`;

/** No `reasoning` field: the pipeline never reads one for the primary mass, so it isn't asked for — one less thing the model can get wrong. */
export const primaryMassStageOutputSchema = z.object({
  name: z.string().min(1).max(60),
  width: z.number().min(5).max(40),
  depth: z.number().min(4).max(30),
  floors: z.number().int().min(1).max(3),
  position: z.object({ x: z.number().min(-80).max(80), z: z.number().min(-80).max(80) }).optional(),
  elevation: z.number().min(-10).max(30).optional(), rotation: z.number().min(-Math.PI).max(Math.PI).optional(),
  plan: volumePlanSchema.optional(),
});
export type PrimaryMassStageOutput = z.infer<typeof primaryMassStageOutputSchema>;

/**
 * Intent, site strategy and primary mass are three sequential decisions, but all three are visible-progress
 * updates only — none needs its own model round trip. One structured call returns all three; the pipeline
 * still emits the same three "stage" events from slicing this one response.
 */
export const foundationStageOutputSchema = z.object({
  intent: intentStageOutputSchema,
  siteStrategy: siteStrategyStageOutputSchema,
  primaryMass: primaryMassStageOutputSchema,
});
export type FoundationStageOutput = z.infer<typeof foundationStageOutputSchema>;

const massExpansionRelationshipSchema = z.object({
  kind: z.enum(MASS_EXPANSION_RELATIONSHIP_KINDS),
  target: z.string().min(1).describe("The id of an already-placed mass, exactly as given in the current design."),
  distance: z.number().min(0).max(15).optional().describe("Gap (side-resolved kinds) or elevation change in meters (stepped kinds)."),
  side: compassSideSchema.optional().describe("Required for adjacent-to, connected-to, offset-from, separated-from, surrounds-courtyard and bridge-between."),
  rotationOffset: z.number().min(-Math.PI).max(Math.PI).optional(),
});

/** east/west relationships only ever move `x`; north/south only ever move `z` — see `resolveMasses` in compiler.ts. */
const SIDE_AXIS: Record<"north" | "south" | "east" | "west", "x" | "z"> = { east: "x", west: "x", north: "z", south: "z" };

const massExpansionMassSchema = z.object({
  name: z.string().min(1).max(60),
  role: z.enum(MASS_ROLES),
  width: z.number().min(3).max(30),
  depth: z.number().min(3).max(25),
  floors: z.number().int().min(1).max(3),
  position: z.object({ x: z.number().min(-80).max(80), z: z.number().min(-80).max(80) }).optional(),
  elevation: z.number().min(-10).max(30).optional(), rotation: z.number().min(-Math.PI).max(Math.PI).optional(),
  plan: volumePlanSchema.optional(),
});

/**
 * A single flat object, never a discriminated union: the provider (OpenAI structured outputs) requires the
 * root JSON Schema to be `type: "object"`. `z.discriminatedUnion` converts to a root `oneOf` with no
 * top-level `type` at all, which the provider rejects outright ("schema must be a JSON Schema of
 * 'type: \"object\"', got 'type: \"None\"'") — every mass-expansion turn failed on this before a single
 * mass could ever be added. `add`-only fields are optional here and required conditionally via
 * `superRefine` below, which still validates locally (through zod) without affecting the JSON Schema shape
 * sent to the provider.
 */
export const massExpansionStageOutputSchema = z.object({
  decision: z.enum(["add", "done"]).describe('"add" to place one more mass, "done" once the composition is complete.'),
  reasoning: z.string().min(1).optional().describe("Required when decision is \"add\": why this piece belongs next — what it connects to, what it serves, whether it contrasts or reinforces."),
  mass: massExpansionMassSchema.optional().describe("Required when decision is \"add\"."),
  relationships: z.array(massExpansionRelationshipSchema).max(4).optional().describe("Required (at least one) when decision is \"add\". Up to 4, as long as they describe unambiguous, non-conflicting placement — see the conflict rules below."),
  cantilever: z.object({ direction: compassSideSchema, distance: z.number().min(0.5).max(6) }).optional(),
  /** A geometry operation this mass needs that may not exist yet (e.g. "atrium", "courtyard cut"). Never blocks placement. */
  requestedOperation: z.string().min(1).max(60).optional(),
}).superRefine((value, ctx) => {
  if (value.decision !== "add") return;
  if (!value.reasoning) ctx.addIssue({ code: "custom", path: ["reasoning"], message: 'reasoning is required when decision is "add".' });
  if (!value.mass) ctx.addIssue({ code: "custom", path: ["mass"], message: 'mass is required when decision is "add".' });
  if (!value.relationships || value.relationships.length === 0) { ctx.addIssue({ code: "custom", path: ["relationships"], message: 'relationships (at least one) is required when decision is "add".' }); return; }
  // Two relationships must never fight over the same axis/rotation: side-resolved kinds with the same
  // SIDE_AXIS ("east"/"west" both move x, "north"/"south" both move z) would silently have the later one
  // win in resolveMasses; view-facing and arrival-facing both set rotation outright. Caught here so the
  // model corrects it in the same call instead of the resolver silently discarding one relationship's intent.
  const axesUsed = new Set<"x" | "z">();
  let rotationSetters = 0;
  value.relationships.forEach((rel, i) => {
    if ((SIDE_RESOLVED_KINDS as readonly string[]).includes(rel.kind) && rel.side) {
      const axis = SIDE_AXIS[rel.side];
      if (axesUsed.has(axis)) ctx.addIssue({ code: "custom", path: ["relationships", i, "side"], message: `Two relationships both place this mass along the ${axis === "x" ? "east/west" : "north/south"} axis — pick one.` });
      axesUsed.add(axis);
    }
    if (rel.kind === "view-facing" || rel.kind === "arrival-facing") rotationSetters++;
  });
  if (rotationSetters > 1) ctx.addIssue({ code: "custom", path: ["relationships"], message: "At most one of view-facing/arrival-facing may be used — both set this mass's rotation outright." });
});
export type MassExpansionStageOutput = z.infer<typeof massExpansionStageOutputSchema>;

/**
 * One roof per mass, decided together in one call: by the time roofs are chosen every mass is already
 * placed, so there is no reason to ask the model once per mass — it can coordinate the whole roofscape
 * (which volumes should read as dominant, which should recede, which should intentionally repeat) better
 * seeing every mass at once than seeing only the neighbors decided so far.
 *
 * The architect owns the executable roof recipe; the compiler only validates it and supplies defaults on
 * a failed/partial response.
 */
const roofCompositionEntrySchema = z.object({
  massId: z.string().min(1).describe("Must exactly match one of the mass ids given, once each."),
  kind: z.enum(ROOF_RECIPE_KINDS),
  overhang: z.number().min(0).max(4).optional().describe("Meters; required for an authored complete recipe, defaulted only for recovery/legacy responses."),
  pitch: z.number().min(0).max(45).optional().describe("Degrees; required for an authored complete recipe, defaulted only for recovery/legacy responses."),
  // A rotation is periodic. Normalize finite authored angles at the stage boundary instead of rejecting them.
  orientation: z.number().finite().optional(),
  parapet: z.object({ height: z.number().min(.1).max(1.5), thickness: z.number().min(.08).max(.5).optional() }).optional(),
  expression: z.object({ verticalGap: z.number().min(0).max(1).optional(), thickness: z.number().min(.08).max(.6).optional() }).optional(),
  counterpoint: z.string().min(12).max(200).optional().describe("Only for a roof that deliberately breaks the whole-house language: the architectural reason. Omit for every coordinated roof."),
});

/** The whole-house roof language, chosen BEFORE the individual roofs. Required (by validation) whenever there is more than one mass. */
const roofLanguageSchema = z.object({
  dominantMassId: z.string().min(1).describe("The mass whose roof sets the language — the planned dominant volume."),
  family: z.enum(ROOF_RECIPE_KINDS).describe("The one dominant roof family every other roof is subordinate to."),
  concept: z.string().max(240).optional().describe("One sentence: the whole-house roof idea (shared datums, pitch, hierarchy)."),
});

export const roofCompositionStageOutputSchema = z.object({
  language: roofLanguageSchema.optional(),
  roofs: z.array(roofCompositionEntrySchema).min(1),
});
export type RoofCompositionStageOutput = z.infer<typeof roofCompositionStageOutputSchema>;

// ── Architectural Geometry Pass ──────────────────────────────────────────────────────────────────────

/** Mirrors `MassFacade`/footprint-op `corner` in document.ts. */
export const MASS_FACADES = ["north", "south", "east", "west"] as const;
export const MASS_CORNERS = ["nw", "ne", "se", "sw"] as const;
export const FOOTPRINT_SCOPES = ["ground", "upper", "all"] as const;
/**
 * The whole articulated-geometry vocabulary this stage may choose from, disclosed here for the same reason
 * as every other closed enum in this file: `strictJsonSchema: false` means the provider never grammar-
 * constrains generation to it. `recess`/`projection`/`notch`/`entry-recess`/`chamfer` reshape the footprint;
 * `glazing-zone`/`opening-rhythm` place facade openings. `corner-glazing` is not part of this vocabulary —
 * it's requested the same way mass-expansion requests any other capability, via `requestedOperation`.
 */
export const GEOMETRY_OPERATION_TYPES = ["recess", "projection", "notch", "entry-recess", "chamfer", "glazing-zone", "opening-rhythm", "door"] as const;
/** The known-good capability plugin ids the model may name via `requestedOperation`/mass-expansion's same field — disclosed for the same reason as every closed vocabulary here: matching against unlisted free text reliably misses. */
export const KNOWN_CAPABILITY_IDS = ["courtyard-edge-wall", "corner-glazing", "bridge-masses", "entry-canopy", "brise-soleil", "pilotis"] as const;

/**
 * One flat schema for every operation kind, same reasoning as `massExpansionStageOutputSchema`: a
 * discriminated union produces a non-object-rooted (`oneOf`) JSON Schema the provider rejects, so every
 * field is optional here and required conditionally by `superRefine`, which still validates locally.
 */
export const geometryOperationSchema = z.object({
  type: z.enum(GEOMETRY_OPERATION_TYPES),
  facade: z.enum(MASS_FACADES).optional().describe("Required for every type except notch and chamfer."),
  corner: z.enum(MASS_CORNERS).optional().describe("Required for notch and chamfer only."),
  start: z.number().min(0).max(1).optional().describe("Normalized position (0=west/north end, 1=east/south end) along the facade. Required for recess, projection and glazing-zone."),
  end: z.number().min(0).max(1).optional().describe("Required for recess, projection and glazing-zone. Must be greater than start."),
  depth: z.number().min(0.3).max(4).optional().describe("Meters the facade steps in/out. Required for recess, projection and notch."),
  width: z.number().min(0.5).max(8).optional().describe("Meters. Required for notch (the corner cut's other extent) and entry-recess; for opening-rhythm, the width of each window; for chamfer, the corner cut's size (an angled cut, not an L-shaped step)."),
  floors: z.enum(FOOTPRINT_SCOPES).optional().describe('Which floors this applies to. Omit or "all" for every floor.'),
  heightRatio: z.number().min(0.2).max(0.95).optional().describe("Fraction of wall height the glazing occupies, centered vertically. Required for glazing-zone."),
  count: z.number().int().min(2).max(6).optional().describe("Number of evenly-spaced windows. Required for opening-rhythm."),
  height: z.number().min(0.6).max(3).optional().describe("Window height in meters. Required for opening-rhythm."),
  sill: z.number().min(0).max(1.5).optional().describe("Sill height above the floor in meters. Required for opening-rhythm."),
  frame: z.boolean().optional().describe("For glazing-zone or door: adds a deliberate structural surround."),
  open: z.boolean().optional().describe("recess/projection only: true makes this interval wall-less (a veranda, colonnade or covered outdoor room) instead of solid wall — the roof still covers it since the footprint still steps there. Never valid on notch or entry-recess."),
  postSpacing: z.number().min(1.2).max(4).optional().describe("recess/projection with open:true only: meters between structural posts along the opening (a colonnade rhythm). Omit for a single unbroken open span (a plain veranda)."),
  reveal: z.number().min(0).max(1.2).optional().describe("glazing-zone only: meters the glass is set back from the wall's outer face, for a shaded/recessed reveal instead of flush glazing."),
  glazed: z.boolean().optional().describe("chamfer only: true makes the angled cut a full-height glass wall (a glazed prow toward a view) instead of solid wall."),
}).superRefine((op, ctx) => {
  const need = (cond: unknown, field: string) => { if (cond === undefined || cond === null) ctx.addIssue({ code: "custom", path: [field], message: `${field} is required for ${op.type}.` }); };
  if (op.glazed !== undefined && op.type !== "chamfer") ctx.addIssue({ code: "custom", path: ["glazed"], message: "glazed only applies to chamfer." });
  if (op.type === "notch") { need(op.corner, "corner"); need(op.width, "width"); need(op.depth, "depth"); return; }
  if (op.type === "chamfer") { need(op.corner, "corner"); need(op.width, "width"); return; }
  if (op.type === "entry-recess") { need(op.facade, "facade"); need(op.width, "width"); need(op.depth, "depth"); return; }
  if (op.type === "recess" || op.type === "projection") { need(op.facade, "facade"); need(op.start, "start"); need(op.end, "end"); need(op.depth, "depth"); }
  if (op.type === "glazing-zone") { need(op.facade, "facade"); need(op.start, "start"); need(op.end, "end"); need(op.heightRatio, "heightRatio"); }
  if (op.type === "opening-rhythm") { need(op.facade, "facade"); need(op.count, "count"); need(op.width, "width"); need(op.height, "height"); need(op.sill, "sill"); }
  if (op.type === "door") { need(op.facade, "facade"); need(op.start, "start"); need(op.end, "end"); }
  if ((op.type === "recess" || op.type === "projection" || op.type === "glazing-zone") && op.start !== undefined && op.end !== undefined && op.end <= op.start) {
    ctx.addIssue({ code: "custom", path: ["end"], message: "end must be greater than start." });
  }
  if (op.postSpacing !== undefined && !op.open) ctx.addIssue({ code: "custom", path: ["open"], message: "postSpacing only applies when open is true." });
  if ((op.open !== undefined || op.postSpacing !== undefined) && op.type !== "recess" && op.type !== "projection") {
    ctx.addIssue({ code: "custom", path: ["open"], message: "open/postSpacing only apply to recess and projection." });
  }
  if (op.frame !== undefined && op.type !== "glazing-zone" && op.type !== "door") {
    ctx.addIssue({ code: "custom", path: ["frame"], message: "frame only applies to glazing-zone or door." });
  }
  if (op.reveal !== undefined && op.type !== "glazing-zone" && op.type !== "door") {
    ctx.addIssue({ code: "custom", path: ["reveal"], message: "reveal only applies to glazing-zone or door." });
  }
});
export type GeometryOperationOutput = z.infer<typeof geometryOperationSchema>;

const geometryMassEntrySchema = z.object({
  massId: z.string().min(1).describe("Must exactly match one of the mass ids given, once each."),
  operations: z.array(geometryOperationSchema).max(8).describe("0-8 operations. A mass with a plain rectangular form (perfectly fine for a quiet secondary volume) can have none. A genuine stepped/setback upper floor typically needs several floors:\"upper\" recesses at once."),
  /** Same mechanism `massExpansionStage` uses for `requestedOperation` — never blocks the pass. */
  requestedOperation: z.string().min(1).max(60).optional().describe("An articulation this mass needs that isn't in the supported vocabulary (e.g. curved facade)."),
});

export const geometryStageOutputSchema = z.object({
  results: z.array(geometryMassEntrySchema).min(1),
});
export type GeometryStageOutput = z.infer<typeof geometryStageOutputSchema>;
