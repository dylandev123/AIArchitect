import { z } from "zod";
import { COMPASS_SIDES, SITE_ENVIRONMENTS } from "@/lib/house/siteSettings";

/** Mirrors `IntentGoal` in designEngine.ts. Kept as a literal list here since zod needs a runtime enum. */
const INTENT_GOALS = [
  "privacy", "openness", "views", "shelter", "cross-ventilation", "daylight", "indoor-outdoor", "resort-feeling",
  "formality", "informality", "symmetry", "asymmetry", "horizontal-emphasis", "vertical-emphasis", "calm", "drama",
  "intimacy", "grand-entertaining", "family-living", "guest-private-service-separation",
] as const;

/** Mirrors `MassRole` in document.ts. */
export const MASS_ROLES = ["main-living", "bedroom-wing", "guest-pavilion", "garage", "service", "connector", "terrace"] as const;

/**
 * Placement-effective subset of `MassRelationshipKind`: every kind here is one `resolveMasses` (compiler.ts)
 * already resolves into a concrete position or elevation. The full document type allows more kinds
 * (`view-facing`, `arrival-facing`, `surrounds-courtyard`) for the deterministic bridge/fixtures, but the
 * recursive mass-expansion loop is restricted to this subset so every accepted mass is geometrically
 * resolved without extending the compiler further.
 */
export const MASS_EXPANSION_RELATIONSHIP_KINDS = ["adjacent-to", "connected-to", "offset-from", "separated-from", "bridge-between", "stepped-above", "stepped-below"] as const;
/** The subset above that requires a `side` to move a mass in x/z (stepped-* only ever adjust elevation). */
export const SIDE_RESOLVED_KINDS = ["adjacent-to", "connected-to", "offset-from", "separated-from", "bridge-between"] as const;

export const ROOF_RECIPE_KINDS = ["flat", "floating-flat", "shed", "mono-pitch", "gable", "hip", "butterfly", "pavilion", "cross-gable", "mixed"] as const;

const compassSideSchema = z.enum(COMPASS_SIDES);
const siteEnvironmentSchema = z.enum(SITE_ENVIRONMENTS);

export const intentStageOutputSchema = z.object({
  mood: z.array(z.enum(INTENT_GOALS)).min(1).max(3).describe("The emotional register of the design, e.g. calm, drama, intimacy."),
  spatialGoals: z.array(z.enum(INTENT_GOALS)).min(1).max(4).describe("What the spaces must achieve: privacy, views, indoor-outdoor connection, etc."),
  environmentalGoals: z.array(z.enum(INTENT_GOALS)).min(1).max(3).describe("Climate/site response goals: shelter, cross-ventilation, daylight."),
  hierarchyGoals: z.array(z.string().min(3).max(80)).min(1).max(4).describe("Short statements of which volumes should dominate and which should recede."),
  compositionBias: z.enum(["symmetrical", "asymmetrical", "linear", "stepped"]).describe("The overall organizing logic of the massing."),
  style: z.string().min(2).max(60).describe("A short architectural style label, e.g. 'modern tropical', 'contemporary hillside'."),
});
export type IntentStageOutput = z.infer<typeof intentStageOutputSchema>;

export const siteStrategyStageOutputSchema = z.object({
  environment: siteEnvironmentSchema,
  viewDirection: compassSideSchema.describe("The compass side the primary view/outlook faces."),
  arrivalDirection: compassSideSchema.describe("The compass side vehicles/guests arrive from."),
  terrain: z.enum(["level", "stepped"]).describe("Whether masses should step with the land or sit at one level."),
  terrainResponse: z.string().min(10).max(240).describe("One or two sentences on how the massing should respond to this site."),
});
export type SiteStrategyStageOutput = z.infer<typeof siteStrategyStageOutputSchema>;

export const primaryMassStageOutputSchema = z.object({
  name: z.string().min(3).max(60),
  width: z.number().min(5).max(40),
  depth: z.number().min(4).max(30),
  floors: z.number().int().min(1).max(3),
  reasoning: z.string().min(10).max(240).describe("Why this is the anchor volume of the composition."),
});
export type PrimaryMassStageOutput = z.infer<typeof primaryMassStageOutputSchema>;

const massExpansionRelationshipSchema = z.object({
  kind: z.enum(MASS_EXPANSION_RELATIONSHIP_KINDS),
  target: z.string().min(1).describe("The id of an already-placed mass, exactly as given in the current design."),
  distance: z.number().min(0).max(15).optional().describe("Gap (side-resolved kinds) or elevation change in meters (stepped kinds)."),
  side: compassSideSchema.optional().describe("Required for adjacent-to, connected-to, offset-from, separated-from and bridge-between."),
  rotationOffset: z.number().min(-Math.PI).max(Math.PI).optional(),
});

const massExpansionAddSchema = z.object({
  decision: z.literal("add"),
  reasoning: z.string().min(10).max(240).describe("Why this piece belongs next: what it connects to, what it serves, whether it contrasts or reinforces."),
  mass: z.object({
    name: z.string().min(3).max(60),
    role: z.enum(MASS_ROLES),
    width: z.number().min(3).max(30),
    depth: z.number().min(3).max(25),
    floors: z.number().int().min(1).max(3),
  }),
  relationships: z.array(massExpansionRelationshipSchema).min(1).max(2),
  cantilever: z.object({ direction: compassSideSchema, distance: z.number().min(0.5).max(6) }).optional(),
  /** A geometry operation this mass needs that may not exist yet (e.g. "atrium", "courtyard cut"). Never blocks placement. */
  requestedOperation: z.string().min(2).max(60).optional(),
});

const massExpansionDoneSchema = z.object({
  decision: z.literal("done"),
  reasoning: z.string().min(10).max(240).describe("Why the composition is complete."),
});

export const massExpansionStageOutputSchema = z.discriminatedUnion("decision", [massExpansionAddSchema, massExpansionDoneSchema]);
export type MassExpansionStageOutput = z.infer<typeof massExpansionStageOutputSchema>;

export const roofStageOutputSchema = z.object({
  kind: z.enum(ROOF_RECIPE_KINDS),
  overhang: z.number().min(0.2).max(2.5).optional(),
  pitch: z.number().min(0).max(45).optional(),
  reasoning: z.string().min(10).max(200).describe("Why this roof family suits this mass and how it relates to its neighbors' roofs."),
});
export type RoofStageOutput = z.infer<typeof roofStageOutputSchema>;
