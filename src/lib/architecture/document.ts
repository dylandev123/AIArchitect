import type { CompassSide, MaterialsConfig, SiteEnvironment } from "@/types/house";
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

export type MassRole = "main-living" | "bedroom-wing" | "guest-pavilion" | "garage" | "service" | "connector" | "terrace" | "veranda" | "entry";
export type MassRelationshipKind = "adjacent-to" | "connected-to" | "separated-from" | "surrounds-courtyard" | "bridge-between" | "view-facing" | "arrival-facing" | "offset-from" | "stepped-above" | "stepped-below";
export interface MassRelationship { kind: MassRelationshipKind; target: string; distance?: number; side?: "north" | "south" | "east" | "west"; rotationOffset?: number; }

export type MassFacade = "north" | "south" | "east" | "west";
export type FootprintScope = "ground" | "upper" | "all";

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
export type VolumeForm = "bar" | "l-shape" | "prow" | "setback";
export type VolumeHeight = "low" | "standard" | "lofty" | "double-height";
export type VolumeHierarchy = "dominant" | "supporting" | "recessive";
export type FacadeTreatment = "solid" | "punched" | "slot" | "ribbon" | "glass-wall" | "framed-glass" | "shaded-glass" | "fin-screened" | "screened";
export type EntryTreatment = "none" | "flush" | "recessed" | "canopied";
export type OutdoorTransition = "none" | "veranda" | "colonnade" | "covered-terrace";
export type OutdoorSide = "view" | "courtyard" | "flank" | "arrival";
export type RoofEdge = "parapet" | "thin-eave" | "deep-eave" | "floating";
export type StructuralExpression = "bearing-walls" | "post-and-beam" | "cantilever" | "pilotis";
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

export type RoofRecipeKind = "flat" | "floating-flat" | "shed" | "mono-pitch" | "gable" | "hip" | "butterfly" | "pavilion" | "cross-gable" | "mixed";
/** Recipe-level roof intent is deterministic geometry, not an AI-generated mesh. */
export interface RoofRecipe {
  id: string; massId: string; kind: RoofRecipeKind; overhang?: number; pitch?: number; orientation?: number; expression?: RoofExpressionParameters;
  /** flat/floating-flat only: a low wall around the roof's own (overhang-grown) perimeter — the classic modern-house parapet silhouette instead of a bare roof edge. `height` is meters above the roof deck. Opt-in, never a per-kind default. */
  parapet?: { height: number; thickness?: number };
}
/**
 * The house's roof covering, as Roof System ids (see roofSystems/). Absent = derived from the roof zone's
 * material. `counterpoint` is a deliberate second system on the named masses, with the reason for the break.
 */
export interface RoofSystemChoice { primary: string; counterpoint?: { system: string; massIds: readonly string[]; reason: string } }
/** Durable evidence that an approved library recipe informed this executable V2 roof document. */
export interface AppliedRoofLibraryRecipe { id: string; name: string; system: string; parameters: Record<string, number | string | boolean>; status: "applied"; }
export interface RoofComposition { recipes: readonly RoofRecipe[]; system?: RoofSystemChoice; libraryRecipe?: AppliedRoofLibraryRecipe; }

export function validateArchitecturalDesignDocument(doc: ArchitecturalDesignDocument): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const mass of doc.massing.masses) {
    if (ids.has(mass.id)) errors.push(`duplicate mass id: ${mass.id}`); ids.add(mass.id);
    if (mass.width <= 0 || mass.depth <= 0 || mass.floors < 1 || (mass.height !== undefined && mass.height <= 0)) errors.push(`invalid dimensions: ${mass.id}`);
    for (const relation of mass.relationships ?? []) if (!ids.has(relation.target) && !doc.massing.masses.some((m) => m.id === relation.target)) errors.push(`unknown relation target: ${relation.target}`);
  }
  for (const roof of doc.roofs.recipes) if (!ids.has(roof.massId)) errors.push(`roof ${roof.id} references unknown mass ${roof.massId}`);
  return errors;
}

export function isArchitecturalDesignDocument(value: unknown): value is ArchitecturalDesignDocument {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 1 && "massing" in value && "roofs" in value;
}

/**
 * `mode` drives the debug panel's Massing → Articulated Geometry → Roofs → Openings → Full progression:
 * "massing-only" = the real shell plus a bright debug-footprint marker per mass (legacy behavior, unchanged);
 * "geometry-only" = the real articulated shell alone, no marker, no roof — what the Geometry Pass actually
 * built; "roofs-only" = roof primitives only; "openings-only" = window/glazing primitives only (shell walls
 * suppressed, capability-plugin openings like corner-glazing still included); "full" = everything.
 */
export type ArchitectureCompileOptions = { materials: MaterialsConfig; mode?: "full" | "massing-only" | "geometry-only" | "roofs-only" | "openings-only" };
