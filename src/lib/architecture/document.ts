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

export type MassRole = "main-living" | "bedroom-wing" | "guest-pavilion" | "garage" | "service" | "connector" | "terrace";
export type MassRelationshipKind = "adjacent-to" | "connected-to" | "separated-from" | "surrounds-courtyard" | "bridge-between" | "view-facing" | "arrival-facing" | "offset-from" | "stepped-above" | "stepped-below";
export interface MassRelationship { kind: MassRelationshipKind; target: string; distance?: number; side?: "north" | "south" | "east" | "west"; rotationOffset?: number; }
export interface MassVolume {
  id: string; name: string; role: MassRole;
  /** World position is retained after relationship resolution for deterministic re-compiles. */
  position: { x: number; z: number }; width: number; depth: number; height?: number; floors: number; elevation: number; rotation: number;
  parentId?: string; relationships?: readonly MassRelationship[];
  cantilever?: { direction: "north" | "south" | "east" | "west"; distance: number };
}
export interface MassingPlan { composition: "rectangular-pavilion" | "l-shaped" | "u-shaped" | "h-shaped" | "courtyard" | "pavilion-cluster" | "rotated-wings" | "stepped-terraces"; masses: readonly MassVolume[]; }

export type RoofRecipeKind = "flat" | "floating-flat" | "shed" | "mono-pitch" | "gable" | "hip" | "butterfly" | "pavilion" | "cross-gable" | "mixed";
/** Recipe-level roof intent is deterministic geometry, not an AI-generated mesh. */
export interface RoofRecipe { id: string; massId: string; kind: RoofRecipeKind; overhang?: number; pitch?: number; orientation?: number; expression?: RoofExpressionParameters; }
export interface RoofComposition { recipes: readonly RoofRecipe[]; }

export function validateArchitecturalDesignDocument(doc: ArchitecturalDesignDocument): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const mass of doc.massing.masses) {
    if (ids.has(mass.id)) errors.push(`duplicate mass id: ${mass.id}`); ids.add(mass.id);
    if (mass.width <= 0 || mass.depth <= 0 || mass.floors < 1) errors.push(`invalid dimensions: ${mass.id}`);
    for (const relation of mass.relationships ?? []) if (!ids.has(relation.target) && !doc.massing.masses.some((m) => m.id === relation.target)) errors.push(`unknown relation target: ${relation.target}`);
  }
  for (const roof of doc.roofs.recipes) if (!ids.has(roof.massId)) errors.push(`roof ${roof.id} references unknown mass ${roof.massId}`);
  return errors;
}

export function isArchitecturalDesignDocument(value: unknown): value is ArchitecturalDesignDocument {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === 1 && "massing" in value && "roofs" in value;
}

/** Kept separate from document material intent until material strategy becomes a real stage. */
export type ArchitectureCompileOptions = { materials: MaterialsConfig; mode?: "full" | "massing-only" | "roofs-only" };
