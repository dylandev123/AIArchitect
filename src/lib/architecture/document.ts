import type { CompassSide, MaterialsConfig, SiteEnvironment } from "@/types/house";
import { COMPASS_SIDES, SITE_ENVIRONMENTS } from "@/lib/house/siteSettings";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import type { RoofExpressionParameters } from "@/lib/house/roof/expression";

/** The durable, stage-owned source of truth for new architecture projects. */
export interface ArchitecturalDesignDocument {
  version: 1;
  brief: string;
  siteStrategy: SiteStrategy;
  massing: MassingPlan;
  roofs: RoofComposition;
  /** Stage intent, not geometry. The compiler resolves these through the capability engine. */
  capabilities?: readonly CapabilityIntent[];
  facade: StagePlaceholder;
  architecturalStyle: StagePlaceholder;
  outdoorPlan: StagePlaceholder;
  materialStrategy: StagePlaceholder;
  components: StagePlaceholder;
  furnishings: StagePlaceholder;
  metadata: DesignProvenance;
}

export interface StagePlaceholder { status: "pending"; notes?: string[] }
export interface DesignProvenance { createdAt: string; source: "fixture" | "stage-pipeline" | "live-generation"; compiler: "procedural-architecture-v1"; }
export interface SiteStrategy { environment: SiteEnvironment; viewDirection: CompassSide; arrivalDirection: CompassSide; terrain: "level" | "stepped"; }

export const MASS_ROLE_VALUES = ["main-living", "bedroom-wing", "guest-pavilion", "garage", "service", "connector", "terrace", "veranda", "entry"] as const;
export type MassRole = typeof MASS_ROLE_VALUES[number];
export const MASS_RELATIONSHIP_KIND_VALUES = ["adjacent-to", "connected-to", "separated-from", "surrounds-courtyard", "bridge-between", "view-facing", "arrival-facing", "offset-from", "stepped-above", "stepped-below"] as const;
export type MassRelationshipKind = typeof MASS_RELATIONSHIP_KIND_VALUES[number];
export interface MassRelationship { kind: MassRelationshipKind; target: string; distance?: number; side?: "north" | "south" | "east" | "west"; rotationOffset?: number; }

export const MASS_FACADE_VALUES = ["north", "south", "east", "west"] as const;
export type MassFacade = typeof MASS_FACADE_VALUES[number];
export const FOOTPRINT_SCOPE_VALUES = ["ground", "upper", "all"] as const;
export type FootprintScope = typeof FOOTPRINT_SCOPE_VALUES[number];
export const CORNER_VALUES = ["nw", "ne", "se", "sw"] as const;

/**
 * The articulated-geometry vocabulary (see architecture-engine-v2 plan): a small set of composable,
 * rectilinear footprint edits, applied in local (unrotated) mass space before world placement. Never
 * boolean geometry — each op edits the floor's boundary as a vertex loop (see geometry/footprint.ts).
 * `chamfer` is the one deliberate exception to "rectilinear": it cuts a corner with a single angled edge
 * (a wedge form) instead of an L-shaped step — every other op still only ever produces horizontal/vertical
 * edges.
 */
/**
 * `id` is the element's stable identity through the Geometry merge (see planBaseline.ts): `<massId>:plan:…` for a
 * mandatory element compiled from the VolumePlan, `<massId>:geometry:…` for one the Geometry Pass added. The
 * compiler never reads it; it is absent on fixtures and pre-baseline documents.
 */
type Identified = { id?: string };
export type MassGeometryOperation = Identified & (
  | { type: "recess"; facade: MassFacade; start: number; end: number; depth: number; floors?: FootprintScope; open?: boolean; postSpacing?: number }
  | { type: "projection"; facade: MassFacade; start: number; end: number; depth: number; floors?: FootprintScope; open?: boolean; postSpacing?: number }
  | { type: "notch"; corner: "nw" | "ne" | "se" | "sw"; width: number; depth: number; floors?: FootprintScope }
  | { type: "entry-recess"; facade: MassFacade; width: number; depth: number; floors?: FootprintScope }
  /** `glazed: true` makes the angled cut a full-height glass wall (a glazed prow toward a view) instead of solid wall. */
  | { type: "chamfer"; corner: "nw" | "ne" | "se" | "sw"; size: number; floors?: FootprintScope; glazed?: boolean });

export interface GlazingZoneOpening extends Identified { type: "glazing-zone"; facade: MassFacade; start: number; end: number; heightRatio: number; floors?: FootprintScope; frame?: boolean; reveal?: number }
export interface OpeningRhythm extends Identified { type: "opening-rhythm"; facade: MassFacade; count: number; width: number; height: number; sill: number; floors?: FootprintScope }
/** A real pass-through rather than a short window: the compiler leaves the sill at grade and gives it a framed door assembly. */
export interface DoorOpening extends Identified { type: "door"; facade: MassFacade; start: number; end: number; height?: number; floors?: FootprintScope; frame?: boolean; reveal?: number }
export type MassOpening = GlazingZoneOpening | OpeningRhythm | DoorOpening;

/**
 * The architectural plan for one volume, authored when the volume is placed (Foundation for the primary
 * mass, Mass Expansion for every other) — before any geometry exists, and completely: a missing field is a
 * repair request to the architect, never a role-based default. The compiler never reads it:
 * `realizeVolumePlan` (volumePlan.ts) turns it into a REFERENCE realization that the Architectural Geometry
 * Pass is shown and measured against; the geometry that is built (`operations`/`openings`/capabilities) is
 * what that pass authors. Facade treatments are keyed by what a side FACES (view, arrival, courtyard,
 * flanks), not by local compass facade, so the plan survives placement/rotation and is resolved against the
 * mass's final orientation and neighbors only at realization time.
 */
export const VOLUME_FORM_VALUES = ["bar", "l-shape", "prow", "setback"] as const;
export type VolumeForm = typeof VOLUME_FORM_VALUES[number];
export const VOLUME_HEIGHT_VALUES = ["low", "standard", "lofty", "double-height"] as const;
export type VolumeHeight = typeof VOLUME_HEIGHT_VALUES[number];
export const VOLUME_HIERARCHY_VALUES = ["dominant", "supporting", "recessive"] as const;
export type VolumeHierarchy = typeof VOLUME_HIERARCHY_VALUES[number];
export const FACADE_TREATMENT_VALUES = ["solid", "punched", "slot", "ribbon", "glass-wall", "framed-glass", "shaded-glass", "fin-screened", "screened"] as const;
export type FacadeTreatment = typeof FACADE_TREATMENT_VALUES[number];
export const ENTRY_TREATMENT_VALUES = ["none", "flush", "recessed", "canopied"] as const;
export type EntryTreatment = typeof ENTRY_TREATMENT_VALUES[number];
export const OUTDOOR_TRANSITION_VALUES = ["none", "veranda", "colonnade", "covered-terrace"] as const;
export type OutdoorTransition = typeof OUTDOOR_TRANSITION_VALUES[number];
export const OUTDOOR_SIDE_VALUES = ["view", "courtyard", "flank", "arrival"] as const;
export type OutdoorSide = typeof OUTDOOR_SIDE_VALUES[number];
export const ROOF_EDGE_VALUES = ["parapet", "thin-eave", "deep-eave", "floating"] as const;
export type RoofEdge = typeof ROOF_EDGE_VALUES[number];
export const STRUCTURAL_EXPRESSION_VALUES = ["bearing-walls", "post-and-beam", "cantilever", "pilotis"] as const;
export type StructuralExpression = typeof STRUCTURAL_EXPRESSION_VALUES[number];
export interface VolumePlan {
  form: VolumeForm; height: VolumeHeight; hierarchy: VolumeHierarchy;
  viewFacade: FacadeTreatment; arrivalFacade: FacadeTreatment; flankFacades: FacadeTreatment;
  /** Only meaningful for a mass enclosing a courtyard; ignored otherwise. */
  courtyardFacade?: FacadeTreatment;
  entry: EntryTreatment; outdoor: OutdoorTransition; outdoorSide: OutdoorSide;
  roofEdge: RoofEdge; structure: StructuralExpression;
}

export interface MassVolume {
  id: string; name: string; role: MassRole;
  /** World position is retained after relationship resolution for deterministic re-compiles. */
  position: { x: number; z: number }; width: number; depth: number;
  /** Total height (grade to roofline), in meters. Absent = `floors * LEVEL_HEIGHT` (today's default). Set to give this mass its own floor-to-floor height instead of the global level height — a soaring double-height volume (e.g. an entry hall) on a single floor, or a deliberately lower service block. Floors split it evenly. */
  height?: number; floors: number; elevation: number; rotation: number;
  /** True when the architect supplied executable world placement; relationships remain semantic only. */
  placementLocked?: boolean;
  parentId?: string; relationships?: readonly MassRelationship[];
  cantilever?: { direction: "north" | "south" | "east" | "west"; distance: number };
  /** Footprint articulation, decided by the Architectural Geometry Pass. Absent/empty = a plain rectangle (today's behavior, unchanged). */
  operations?: readonly MassGeometryOperation[];
  /** Mass-aware facade openings, decided by the Architectural Geometry Pass. */
  openings?: readonly MassOpening[];
  /** The design intent `operations`/`openings` were realized from. Absent on fixtures and pre-plan documents. */
  plan?: VolumePlan;
}
export interface MassingPlan { composition: "rectangular-pavilion" | "l-shaped" | "u-shaped" | "h-shaped" | "courtyard" | "pavilion-cluster" | "rotated-wings" | "stepped-terraces"; masses: readonly MassVolume[]; }

export const ROOF_RECIPE_KINDS = ["flat", "floating-flat", "shed", "mono-pitch", "gable", "hip", "butterfly", "pavilion", "cross-gable", "mixed"] as const;
export type RoofRecipeKind = typeof ROOF_RECIPE_KINDS[number];
/**
 * The roof kinds an Architect may author: each is one family the compiler builds from the recipe's own overhang and
 * pitch. "mixed" is not — it names no single roof, the compiler can only stand a generic slab in for it, and
 * `roofConflicts` blocks it — so it stays readable on stored documents but is never authored.
 */
export const AUTHORED_ROOF_RECIPE_KINDS = ["flat", "floating-flat", "shed", "mono-pitch", "gable", "hip", "butterfly", "pavilion", "cross-gable"] as const satisfies readonly Exclude<RoofRecipeKind, "mixed">[];
export type AuthoredRoofRecipeKind = typeof AUTHORED_ROOF_RECIPE_KINDS[number];
/** Recipe-level roof intent is deterministic geometry, not an AI-generated mesh. */
export interface RoofRecipe {
  id: string; massId: string; kind: RoofRecipeKind; overhang?: number; pitch?: number; orientation?: number; expression?: RoofExpressionParameters;
  /** flat/floating-flat only: a low wall around the roof's own (overhang-grown) perimeter — the classic modern-house parapet silhouette instead of a bare roof edge. `height` is meters above the roof deck. Opt-in, never a per-kind default. */
  parapet?: { height: number; thickness?: number };
}
/**
 * The canonical roof recipe the Architect authors — exactly what `roofConflicts` accepts as complete. The compiler
 * would otherwise default a missing overhang (0.6m) or pitch (per family), so neither may be left out: `overhang`
 * is meters (>= 0; 0 is a flush edge) and `pitch` is degrees (>= 0; flat families are built level).
 */
export type AuthoredRoofRecipe = RoofRecipe & { kind: AuthoredRoofRecipeKind; overhang: number; pitch: number };
/**
 * The house's roof covering, as Roof System ids (see roofSystems/). Absent = derived from the roof zone's
 * material. `counterpoint` is a deliberate second system on the named masses, with the reason for the break.
 */
export interface RoofSystemChoice { primary: string; counterpoint?: { system: string; massIds: readonly string[]; reason: string } }
/** Durable evidence that an approved library recipe informed this executable V2 roof document. */
export interface AppliedRoofLibraryRecipe { id: string; name: string; system: string; parameters: Record<string, number | string | boolean>; status: "applied"; }
export interface RoofComposition { recipes: readonly RoofRecipe[]; system?: RoofSystemChoice; libraryRecipe?: AppliedRoofLibraryRecipe; }

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const FOOTPRINT_OPERATION_TYPES = ["recess", "projection", "notch", "entry-recess", "chamfer"] as const;
const isFacade = (value: unknown): value is MassFacade => typeof value === "string" && (MASS_FACADE_VALUES as readonly string[]).includes(value);
const isCorner = (value: unknown): value is "nw" | "ne" | "se" | "sw" => typeof value === "string" && (CORNER_VALUES as readonly string[]).includes(value);
const received = (value: unknown) => value === undefined ? "missing" : JSON.stringify(value);
const enumError = (prefix: string, field: string, value: unknown, allowed: readonly string[]) => `${prefix} ${value === undefined ? "missing" : `invalid ${field} ${received(value)}`}; expected one of: ${allowed.join(", ")}`;
const numberError = (prefix: string, field: string, value: unknown, qualifier = "a finite number") => `${prefix} ${value === undefined ? `missing ${field}` : `invalid ${field} ${received(value)}`}; expected ${qualifier}`;
const finiteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const unsupportedFields = (value: Record<string, unknown>, allowed: readonly string[], prefix: string, aliases: Partial<Record<string, string>> = {}) => {
  const errors: string[] = [];
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${prefix} unsupported field ${key}; ${aliases[key] ? `use ${aliases[key]}` : "remove it"}`);
  return errors;
};

/**
 * Validates untrusted stage output before anything is allowed to dereference it.  This deliberately
 * accepts `unknown`: a malformed partial response is a repairable Architect error, never a JS exception.
 */
export interface DocumentValidationOptions {
  requireRoofForEveryMass?: boolean;
  /** Every recipe is an `AuthoredRoofRecipe`: an authored kind, with overhang and pitch present. */
  requireCompleteRoofRecipes?: boolean;
}
export function validateArchitecturalDesignDocument(doc: unknown, options?: DocumentValidationOptions): string[];
export function validateArchitecturalDesignDocument(doc: ArchitecturalDesignDocument, options?: DocumentValidationOptions): string[];
export function validateArchitecturalDesignDocument(doc: unknown, options: DocumentValidationOptions = {}): string[] {
  const errors: string[] = [];
  if (!record(doc)) return ["document must be an object"];
  if (doc.version !== 1) errors.push("document.version must be 1");
  if (typeof doc.brief !== "string") errors.push("document.brief must be a string");
  for (const section of ["siteStrategy", "facade", "architecturalStyle", "outdoorPlan", "materialStrategy", "components", "furnishings", "metadata"] as const) {
    if (!record(doc[section])) errors.push(`missing or malformed required section: ${section}`);
  }
  if (record(doc.siteStrategy)) {
    if (!(SITE_ENVIRONMENTS as readonly string[]).includes(doc.siteStrategy.environment as string)) errors.push(enumError("siteStrategy", "environment", doc.siteStrategy.environment, SITE_ENVIRONMENTS));
    if (!(COMPASS_SIDES as readonly string[]).includes(doc.siteStrategy.viewDirection as string)) errors.push(enumError("siteStrategy", "viewDirection", doc.siteStrategy.viewDirection, COMPASS_SIDES));
    if (!(COMPASS_SIDES as readonly string[]).includes(doc.siteStrategy.arrivalDirection as string)) errors.push(enumError("siteStrategy", "arrivalDirection", doc.siteStrategy.arrivalDirection, COMPASS_SIDES));
    if (doc.siteStrategy.terrain !== "level" && doc.siteStrategy.terrain !== "stepped") errors.push(enumError("siteStrategy", "terrain", doc.siteStrategy.terrain, ["level", "stepped"]));
  }
  for (const section of ["facade", "architecturalStyle", "outdoorPlan", "materialStrategy", "components", "furnishings"] as const) if (record(doc[section])) {
    if (doc[section].status !== "pending") errors.push(`${section} invalid status ${received(doc[section].status)}; expected "pending"`);
    if (doc[section].notes !== undefined && (!Array.isArray(doc[section].notes) || !doc[section].notes.every((note) => typeof note === "string"))) errors.push(`${section} notes must be an array of strings`);
  }
  if (record(doc.metadata)) {
    if (typeof doc.metadata.createdAt !== "string") errors.push("metadata missing createdAt");
    if (!(["fixture", "stage-pipeline", "live-generation"] as const).includes(doc.metadata.source as never)) errors.push(enumError("metadata", "source", doc.metadata.source, ["fixture", "stage-pipeline", "live-generation"]));
    if (doc.metadata.compiler !== "procedural-architecture-v1") errors.push(`metadata invalid compiler ${received(doc.metadata.compiler)}; expected "procedural-architecture-v1"`);
  }
  if (!record(doc.massing)) {
    errors.push("missing or malformed required section: massing");
    return errors;
  }
  if (!Array.isArray(doc.massing.masses)) {
    errors.push("missing or malformed required section: massing.masses");
    return errors;
  }
  const recipes = record(doc.roofs) && Array.isArray(doc.roofs.recipes) ? doc.roofs.recipes : undefined;
  if (!record(doc.roofs)) {
    errors.push("missing or malformed required section: roofs");
  } else if (!recipes) {
    errors.push("missing or malformed required section: roofs.recipes");
  }
  const ids = new Set<string>();
  // Keep identities from a partly malformed mass.  A roof pointing at an identified-but-invalid
  // mass is a consequence of the mass error, not an independent roof-reference error.
  const declaredMassIds = new Set<string>();
  for (const [index, mass] of doc.massing.masses.entries()) {
    const prefix = record(mass) && typeof mass.id === "string" && mass.id ? `mass ${mass.id}` : `mass at index ${index}`;
    if (!record(mass)) { errors.push(`${prefix} must be an object`); continue; }
    if (typeof mass.id !== "string" || !mass.id) { errors.push(`${prefix} missing id`); continue; }
    declaredMassIds.add(mass.id);
    if (typeof mass.name !== "string" || !mass.name) errors.push(`${prefix} missing name`);
    if (!(MASS_ROLE_VALUES as readonly string[]).includes(mass.role as string)) errors.push(enumError(prefix, "role", mass.role, MASS_ROLE_VALUES));
    if (record(mass.geometry)) {
      if (typeof mass.geometry.height === "number") errors.push(`${prefix} uses unsupported geometry.height; use height`);
      else errors.push(`${prefix} uses unsupported geometry; use optional height directly on the mass`);
    }
    if (mass.footprintOperations !== undefined) errors.push(`${prefix} uses unsupported footprintOperations; use operations`);
    if (ids.has(mass.id)) errors.push(`duplicate mass id: ${mass.id}`); ids.add(mass.id);
    if (!finiteNumber(mass.width)) errors.push(numberError(prefix, "width", mass.width));
    else if (mass.width <= 0) errors.push(`${prefix} width must be greater than 0`);
    if (!finiteNumber(mass.depth)) errors.push(numberError(prefix, "depth", mass.depth));
    else if (mass.depth <= 0) errors.push(`${prefix} depth must be greater than 0`);
    if (!finiteNumber(mass.floors)) errors.push(numberError(prefix, "floors", mass.floors));
    else if (!Number.isInteger(mass.floors) || mass.floors < 1) errors.push(`${prefix} floors must be an integer greater than 0`);
    if (mass.height !== undefined && !finiteNumber(mass.height)) errors.push(numberError(prefix, "height", mass.height));
    else if (typeof mass.height === "number" && mass.height <= 0) errors.push(`${prefix} height must be greater than 0`);
    if (!record(mass.position)) errors.push(`${prefix} missing position`);
    else {
      if (!finiteNumber(mass.position.x)) errors.push(numberError(prefix, "position.x", mass.position.x));
      if (!finiteNumber(mass.position.z)) errors.push(numberError(prefix, "position.z", mass.position.z));
    }
    if (!finiteNumber(mass.elevation)) errors.push(numberError(prefix, "elevation", mass.elevation));
    if (!finiteNumber(mass.rotation)) errors.push(numberError(prefix, "rotation", mass.rotation));
    if (mass.placementLocked !== undefined && typeof mass.placementLocked !== "boolean") errors.push(`${prefix} placementLocked must be a boolean`);
    if (mass.parentId !== undefined && (typeof mass.parentId !== "string" || !mass.parentId)) errors.push(`${prefix} parentId must be a non-empty string`);
    if (mass.cantilever !== undefined) {
      if (!record(mass.cantilever)) errors.push(`${prefix} cantilever must be an object`);
      else {
        if (!isFacade(mass.cantilever.direction)) errors.push(enumError(`${prefix} cantilever`, "direction", mass.cantilever.direction, MASS_FACADE_VALUES));
        if (!finiteNumber(mass.cantilever.distance) || mass.cantilever.distance <= 0) errors.push(numberError(`${prefix} cantilever`, "distance", mass.cantilever.distance, "a positive finite number"));
      }
    }
    if (mass.operations !== undefined && !Array.isArray(mass.operations)) {
      errors.push(`${prefix} operations must be an array`);
    } else for (const [operationIndex, operation] of (mass.operations ?? []).entries()) {
      const operationPrefix = `${prefix} operations[${operationIndex}]`;
      if (!record(operation) || typeof operation.type !== "string" || !(FOOTPRINT_OPERATION_TYPES as readonly string[]).includes(operation.type)) {
        errors.push(`${operationPrefix} missing or invalid type`);
        continue;
      }
      if (operation.type === "notch") {
        if (!isCorner(operation.corner)) errors.push(enumError(operationPrefix, "corner", operation.corner, CORNER_VALUES));
        if (!finiteNumber(operation.width)) errors.push(numberError(operationPrefix, "width", operation.width));
        if (!finiteNumber(operation.depth)) errors.push(numberError(operationPrefix, "depth", operation.depth));
      } else if (operation.type === "chamfer") {
        if (!isCorner(operation.corner)) errors.push(enumError(operationPrefix, "corner", operation.corner, CORNER_VALUES));
        if (!finiteNumber(operation.size)) errors.push(numberError(operationPrefix, "size", operation.size));
      } else if (operation.type === "entry-recess") {
        if (!isFacade(operation.facade)) errors.push(enumError(operationPrefix, "facade", operation.facade, MASS_FACADE_VALUES));
        if (!finiteNumber(operation.width)) errors.push(numberError(operationPrefix, "width", operation.width));
        if (!finiteNumber(operation.depth)) errors.push(numberError(operationPrefix, "depth", operation.depth));
      } else {
        // `buildFloorFootprint` owns one interval list for each valid facade.  Do not let untrusted
        // Architect output index that collection before this boundary has rejected an invalid facade.
        if (!isFacade(operation.facade)) errors.push(enumError(operationPrefix, "facade", operation.facade, MASS_FACADE_VALUES));
        if (!finiteNumber(operation.start)) errors.push(numberError(operationPrefix, "start", operation.start));
        if (!finiteNumber(operation.end)) errors.push(numberError(operationPrefix, "end", operation.end));
        if (!finiteNumber(operation.depth)) errors.push(numberError(operationPrefix, "depth", operation.depth));
      }
      if (operation.floors !== undefined && !(FOOTPRINT_SCOPE_VALUES as readonly string[]).includes(operation.floors as string)) errors.push(enumError(operationPrefix, "floors", operation.floors, FOOTPRINT_SCOPE_VALUES));
      if ((operation.type === "recess" || operation.type === "projection") && operation.open !== undefined && typeof operation.open !== "boolean") errors.push(`${operationPrefix} open must be a boolean`);
      if ((operation.type === "recess" || operation.type === "projection") && operation.postSpacing !== undefined && (!finiteNumber(operation.postSpacing) || operation.postSpacing <= 0)) errors.push(numberError(operationPrefix, "postSpacing", operation.postSpacing, "a positive finite number"));
      if (operation.type === "chamfer" && operation.glazed !== undefined && typeof operation.glazed !== "boolean") errors.push(`${operationPrefix} glazed must be a boolean`);
    }
    if (mass.openings !== undefined && !Array.isArray(mass.openings)) errors.push(`${prefix} openings must be an array`);
    if (Array.isArray(mass.openings)) for (const [openingIndex, opening] of mass.openings.entries()) {
      const openingPrefix = `${prefix} openings[${openingIndex}]`;
      if (!record(opening) || !["door", "glazing-zone", "opening-rhythm"].includes(opening.type as string)) { errors.push(`${openingPrefix} missing or invalid type; expected one of: door, glazing-zone, opening-rhythm`); continue; }
      if (!isFacade(opening.facade)) errors.push(enumError(openingPrefix, "facade", opening.facade, MASS_FACADE_VALUES));
      if (opening.type === "glazing-zone" || opening.type === "door") {
        if (!finiteNumber(opening.start)) errors.push(numberError(openingPrefix, "start", opening.start));
        if (!finiteNumber(opening.end)) errors.push(numberError(openingPrefix, "end", opening.end));
      }
      if (opening.type === "glazing-zone" && !finiteNumber(opening.heightRatio)) errors.push(numberError(openingPrefix, "heightRatio", opening.heightRatio));
      if (opening.type === "opening-rhythm") for (const field of ["count", "width", "height", "sill"] as const) if (!finiteNumber(opening[field])) errors.push(numberError(openingPrefix, field, opening[field]));
      if (opening.type === "door" && opening.height !== undefined && !finiteNumber(opening.height)) errors.push(numberError(openingPrefix, "height", opening.height));
      if (opening.floors !== undefined && !(FOOTPRINT_SCOPE_VALUES as readonly string[]).includes(opening.floors as string)) errors.push(enumError(openingPrefix, "floors", opening.floors, FOOTPRINT_SCOPE_VALUES));
      if ((opening.type === "glazing-zone" || opening.type === "door") && opening.frame !== undefined && typeof opening.frame !== "boolean") errors.push(`${openingPrefix} frame must be a boolean`);
      if ((opening.type === "glazing-zone" || opening.type === "door") && opening.reveal !== undefined && !finiteNumber(opening.reveal)) errors.push(numberError(openingPrefix, "reveal", opening.reveal));
      if (record(opening) && opening.face !== undefined) errors.push(`${openingPrefix} uses unsupported face; use facade`);
      if (record(opening) && opening.centerOffset !== undefined) errors.push(`${openingPrefix} uses unsupported centerOffset; use start and end`);
    }
    if (mass.plan !== undefined) {
      const planPrefix = `${prefix} plan`;
      if (!record(mass.plan)) errors.push(`${planPrefix} must be an object`);
      else {
        const planEnums: Array<[string, unknown, readonly string[]]> = [
          ["form", mass.plan.form, VOLUME_FORM_VALUES], ["height", mass.plan.height, VOLUME_HEIGHT_VALUES], ["hierarchy", mass.plan.hierarchy, VOLUME_HIERARCHY_VALUES],
          ["viewFacade", mass.plan.viewFacade, FACADE_TREATMENT_VALUES], ["arrivalFacade", mass.plan.arrivalFacade, FACADE_TREATMENT_VALUES], ["flankFacades", mass.plan.flankFacades, FACADE_TREATMENT_VALUES],
          ["entry", mass.plan.entry, ENTRY_TREATMENT_VALUES], ["outdoor", mass.plan.outdoor, OUTDOOR_TRANSITION_VALUES], ["outdoorSide", mass.plan.outdoorSide, OUTDOOR_SIDE_VALUES], ["roofEdge", mass.plan.roofEdge, ROOF_EDGE_VALUES], ["structure", mass.plan.structure, STRUCTURAL_EXPRESSION_VALUES],
        ];
        for (const [field, value, values] of planEnums) if (!values.includes(value as string)) errors.push(enumError(planPrefix, field, value, values));
        if (mass.plan.courtyardFacade !== undefined && !(FACADE_TREATMENT_VALUES as readonly string[]).includes(mass.plan.courtyardFacade as string)) errors.push(enumError(planPrefix, "courtyardFacade", mass.plan.courtyardFacade, FACADE_TREATMENT_VALUES));
      }
    }
    if (mass.relationships !== undefined && !Array.isArray(mass.relationships)) errors.push(`malformed relationships: ${mass.id}`);
    else for (const [relationIndex, relation] of (mass.relationships ?? []).entries()) {
      const relationPrefix = `${prefix} relationships[${relationIndex}]`;
      if (!record(relation)) { errors.push(`${relationPrefix} must be an object`); continue; }
      if (!(MASS_RELATIONSHIP_KIND_VALUES as readonly string[]).includes(relation.kind as string)) errors.push(enumError(relationPrefix, "kind", relation.kind, MASS_RELATIONSHIP_KIND_VALUES));
      if (typeof relation.target !== "string" || !relation.target) errors.push(`${relationPrefix} missing target`);
      else if (!doc.massing.masses.some((candidate) => record(candidate) && candidate.id === relation.target)) errors.push(`${relationPrefix} references unknown target ${received(relation.target)}`);
      if (relation.distance !== undefined && (!finiteNumber(relation.distance) || relation.distance < 0)) errors.push(numberError(relationPrefix, "distance", relation.distance, "a non-negative finite number"));
      if (relation.side !== undefined && !isFacade(relation.side)) errors.push(enumError(relationPrefix, "side", relation.side, MASS_FACADE_VALUES));
      if (relation.rotationOffset !== undefined && !finiteNumber(relation.rotationOffset)) errors.push(numberError(relationPrefix, "rotationOffset", relation.rotationOffset));
    }
  }
  const roofedMassIds = new Set<string>();
  for (const [index, roof] of (recipes ?? []).entries()) {
    const roofPrefix = record(roof) && typeof roof.id === "string" && roof.id ? `roof ${roof.id}` : `roof at index ${index}`;
    if (!record(roof)) { errors.push(`${roofPrefix} must be an object`); continue; }
    if (typeof roof.id !== "string" || !roof.id) errors.push(`${roofPrefix} missing id`);
    if (typeof roof.massId !== "string" || !roof.massId) errors.push(`${roofPrefix} missing massId`);
    const kinds: readonly string[] = options.requireCompleteRoofRecipes ? AUTHORED_ROOF_RECIPE_KINDS : ROOF_RECIPE_KINDS;
    if (!kinds.includes(roof.kind as string)) errors.push(enumError(roofPrefix, "kind", roof.kind, kinds));
    if (typeof roof.massId === "string" && roof.massId && !declaredMassIds.has(roof.massId)) errors.push(`${roofPrefix} references unknown mass ${roof.massId}`);
    if (typeof roof.massId === "string" && roof.massId && roofedMassIds.has(roof.massId)) errors.push(`duplicate roof recipe for mass: ${roof.massId}`);
    if ((roof.overhang !== undefined || options.requireCompleteRoofRecipes) && (!finiteNumber(roof.overhang) || roof.overhang < 0)) errors.push(numberError(roofPrefix, "overhang", roof.overhang, "a non-negative finite number in meters"));
    if ((roof.pitch !== undefined || options.requireCompleteRoofRecipes) && (!finiteNumber(roof.pitch) || roof.pitch < 0)) errors.push(numberError(roofPrefix, "pitch", roof.pitch, "a non-negative finite number in degrees"));
    if (roof.orientation !== undefined && !finiteNumber(roof.orientation)) errors.push(numberError(roofPrefix, "orientation", roof.orientation, "a finite number in radians"));
    if (roof.parapet !== undefined) {
      if (!record(roof.parapet)) errors.push(`${roofPrefix} invalid parapet ${received(roof.parapet)}; expected { height: number, thickness?: number }`);
      else {
        if (!finiteNumber(roof.parapet.height) || roof.parapet.height <= 0) errors.push(numberError(`${roofPrefix} parapet`, "height", roof.parapet.height, "a positive finite number in meters"));
        if (roof.parapet.thickness !== undefined && (!finiteNumber(roof.parapet.thickness) || roof.parapet.thickness <= 0)) errors.push(numberError(`${roofPrefix} parapet`, "thickness", roof.parapet.thickness, "a positive finite number in meters"));
      }
    }
    if (roof.expression !== undefined) {
      if (!record(roof.expression)) errors.push(`${roofPrefix} invalid expression ${received(roof.expression)}; expected a procedural roof expression object`);
      else {
        const expression = roof.expression;
        for (const field of ["overhang", "verticalGap", "thickness", "fasciaDepth", "clerestoryHeight"] as const) if (expression[field] !== undefined && !finiteNumber(expression[field])) errors.push(numberError(`${roofPrefix} expression`, field, expression[field], "a finite number in meters"));
        if (expression.soffitMaterial !== undefined && !["roof", "exterior", "dark"].includes(expression.soffitMaterial as string)) errors.push(enumError(`${roofPrefix} expression`, "soffitMaterial", expression.soffitMaterial, ["roof", "exterior", "dark"]));
        if (expression.supportStyle !== undefined && !["reveal", "clerestory", "band"].includes(expression.supportStyle as string)) errors.push(enumError(`${roofPrefix} expression`, "supportStyle", expression.supportStyle, ["reveal", "clerestory", "band"]));
        if (expression.horizontalOffset !== undefined && (!record(expression.horizontalOffset) || (expression.horizontalOffset.x !== undefined && !finiteNumber(expression.horizontalOffset.x)) || (expression.horizontalOffset.z !== undefined && !finiteNumber(expression.horizontalOffset.z)))) errors.push(`${roofPrefix} expression horizontalOffset must be { x?: finite number, z?: finite number }`);
        const secondary = expression.secondary;
        if (secondary !== undefined && (!record(secondary) || !["width", "depth", "elevation", "offsetX", "offsetZ"].every((field) => secondary[field] === undefined || finiteNumber(secondary[field])))) errors.push(`${roofPrefix} expression secondary must contain only finite numeric width/depth/elevation/offsetX/offsetZ fields`);
      }
    }
    errors.push(...unsupportedFields(roof, ["id", "massId", "kind", "overhang", "pitch", "orientation", "expression", "parapet"], roofPrefix, { floatingExpression: "expression" }));
    if (typeof roof.massId === "string" && roof.massId) roofedMassIds.add(roof.massId);
  }
  if (options.requireRoofForEveryMass) for (const massId of ids) if (!roofedMassIds.has(massId)) errors.push(`missing roof recipe for mass: ${massId}`);
  return errors;
}

export function isArchitecturalDesignDocument(value: unknown): value is ArchitecturalDesignDocument {
  return validateArchitecturalDesignDocument(value).length === 0;
}

/**
 * `mode` drives the debug panel's Massing → Articulated Geometry → Roofs → Openings → Full progression:
 * "massing-only" = the real shell plus a bright debug-footprint marker per mass (legacy behavior, unchanged);
 * "geometry-only" = the real articulated shell alone, no marker, no roof — what the Geometry Pass actually
 * built; "roofs-only" = roof primitives only; "openings-only" = window/glazing primitives only (shell walls
 * suppressed, capability-plugin openings like corner-glazing still included); "full" = everything.
 */
export type ArchitectureCompileOptions = { materials: MaterialsConfig; mode?: "full" | "massing-only" | "geometry-only" | "roofs-only" | "openings-only" };
