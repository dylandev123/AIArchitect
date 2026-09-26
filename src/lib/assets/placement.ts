import type { BuildingKind } from "@/types/house";
import type { CuratedAsset } from "@/types/assets";
import type { AssetCategory } from "@/types/library";
import type { ModelStatus } from "./modelCache";
import { validateBuilding } from "@/lib/house/features/buildings";

/**
 * Semantic replacement, GLB side. A project feature keeps its own type, id and config; an optional `assetId` on it
 * says "draw this library model instead of the procedural version". Nothing here removes the procedural geometry:
 * the renderer swaps it out only while the model is actually loaded.
 */

/**
 * Which library family stands in for which feature kind. Only kinds the generator already builds procedurally can
 * appear here: a GLB replaces an existing feature, it never creates one. Pergola, cabana and fire pit have no
 * feature kind yet (their procedural parts exist only inside other features), so they have no entry to wire.
 */
export const GLB_BUILDING_CATEGORY: Partial<Record<BuildingKind, AssetCategory>> = {
  gazebo: "gazebo",
  outdoor_bar: "outdoor-bar",
};

export const GLB_WIRED_CATEGORIES: readonly AssetCategory[] = Object.values(GLB_BUILDING_CATEGORY);

export interface AssetPlacement {
  /** The feature's id in the scene (`building-2`): the same key selection and editing use. */
  featureId: string;
  assetId: string;
  kind: BuildingKind;
  category: AssetCategory;
  x: number;
  z: number;
  /** Radians about Y; matches how the procedural version of the feature is turned. */
  yaw: number;
  /** The feature's own footprint: the space the model must fit inside. */
  width: number;
  depth: number;
}

/** Feature ids are the array index in the project JSON, so a dropped (invalid) entry never shifts the others. */
export function placementsFromBuildings(rawBuildings: unknown): AssetPlacement[] {
  if (!Array.isArray(rawBuildings)) return [];
  const out: AssetPlacement[] = [];
  rawBuildings.forEach((raw, index) => {
    const { value } = validateBuilding(raw);
    const category = value ? GLB_BUILDING_CATEGORY[value.kind] : undefined;
    if (!value || !category || !value.assetId) return;
    out.push({
      featureId: `building-${index}`,
      assetId: value.assetId,
      kind: value.kind,
      category,
      x: value.x,
      z: value.z,
      yaw: ((value.rotation ?? 0) * Math.PI) / 180,
      width: value.width,
      depth: value.depth,
    });
  });
  return out;
}

/** A model may be drawn between these multiples of its natural size; retrieval already keeps requests inside 0.5–2×. */
export const FIT_SCALE_RANGE = [0.4, 2.5] as const;

/**
 * Uniform scale that fits a model's stored collision footprint inside the feature's footprint, so the GLB never
 * pokes past the space site planning reserved for the procedural version. Proportions are preserved.
 * Without a usable footprint the model is drawn at its natural size.
 */
export function fitScale(target: { width: number; depth: number }, footprint?: { width: number; depth: number }): number {
  if (!footprint || !(footprint.width > 0) || !(footprint.depth > 0) || !(target.width > 0) || !(target.depth > 0)) return 1;
  const raw = Math.min(target.width / footprint.width, target.depth / footprint.depth);
  return Math.min(Math.max(raw, FIT_SCALE_RANGE[0]), FIT_SCALE_RANGE[1]);
}

/** True when an asset may be shown in a project: approved, a GLB model, and not known to have failed validation. */
export function isRenderableAsset(asset: CuratedAsset | undefined): asset is CuratedAsset {
  return !!asset && asset.status === "approved" && asset.type === "glb-model" && asset.validation?.passed !== false;
}

/** Placements whose asset is (still) an approved model in the catalog. Everything else is simply procedural. */
export function usablePlacements(placements: readonly AssetPlacement[], catalog: readonly CuratedAsset[]): AssetPlacement[] {
  return placements.filter((p) => isRenderableAsset(catalog.find((a) => a.id === p.assetId)));
}

/**
 * The fallback rule in one place: a feature's procedural geometry is hidden only while its model is loaded and
 * ready. Loading, failed, missing or removed all leave the procedural version drawing.
 */
export function replacedFeatureIds(usable: readonly AssetPlacement[], statusOf: (assetId: string) => ModelStatus): Set<string> {
  return new Set(usable.filter((p) => statusOf(p.assetId) === "ready").map((p) => p.featureId));
}
