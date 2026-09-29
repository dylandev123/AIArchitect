import type { HouseGenerationResult } from "@/lib/house/generateHouse";
import type { HouseModel, PrimitiveCategory } from "@/lib/house/types";
import type { SiteConfig } from "@/types/house";

/**
 * Categories that represent genuine site features (pools, driveways, landscaping, terrain-adjacent
 * walls) rather than the house/building shell itself. "building" (secondary structures placed
 * elsewhere on the lot, e.g. sheds/guest houses) is included because it is not part of the
 * primary massing that `architecturalDesignDocument` describes.
 */
export const SITE_FEATURE_CATEGORIES: ReadonlySet<PrimitiveCategory> = new Set<PrimitiveCategory>([
  "pool",
  "driveway",
  "patio",
  "deck",
  "road",
  "parking",
  "landscape",
  "curvedWall",
  "retainingWall",
  "path",
  "waterway",
  "rock",
  "slope",
  "building",
]);

export interface V2OnlyViolation {
  /** What accessed the legacy data. */
  what: string;
  /** Which part of the app the dependency can affect. */
  effect: "rendering" | "generation" | "placement" | "compatibility-data";
  detail: string;
}

export function logV2OnlyViolation(violation: V2OnlyViolation): void {
  if (process.env.NODE_ENV === "production") return;
  console.warn(`[V2-ONLY VIOLATION] ${violation.what}`, { effect: violation.effect, detail: violation.detail });
}

export interface ApplyV2OnlyModeInput {
  /** Full legacy generation result, used only for its `site` (materials/settings) and, in V2-only mode, its site-feature primitives. */
  legacy: HouseGenerationResult;
  /** The already-compiled V2 building model (`compileArchitecture(document, ...).model`). */
  v2Model: HouseModel;
  v2OnlyMode: boolean;
  /** Whether a cutaway level is currently active — the legacy-house-footprint dependency in `cutawayHiddenIds` only actually affects pixels while this is true. */
  cutawayActive: boolean;
}

export interface ApplyV2OnlyModeResult {
  model: HouseModel;
  site: SiteConfig | null;
  violations: V2OnlyViolation[];
}

/**
 * When V2-only mode is off, behavior is unchanged from the historical branch: the V2 model alone is
 * the building, and legacy site features are (as before this diagnostic) not merged back in.
 *
 * When V2-only mode is on and a valid document exists, this is the enforcement point: the returned
 * model is the V2 building plus ONLY the legacy primitives whose category is a genuine site feature
 * (never a house/building-shell category), so pools/driveways/landscaping/terrain-adjacent walls keep
 * rendering while the legacy house shell itself cannot leak into the visible building. Known
 * remaining legacy dependencies that this function does not (and, per scope, should not) fix are
 * reported as violations instead of silently tolerated.
 */
export function applyV2OnlyMode({ legacy, v2Model, v2OnlyMode: _v2OnlyMode, cutawayActive }: ApplyV2OnlyModeInput): ApplyV2OnlyModeResult {
  // A valid V2 document is always rendered with its authored site.  This used to be
  // hidden behind the diagnostic toggle, which made ordinary V2 renders silently lose
  // their Site Plan.  Deliberately filter by category: legacy building geometry never
  // becomes part of a V2 render.
  const siteFeaturePrimitives = (legacy.model?.primitives ?? []).filter((p) => SITE_FEATURE_CATEGORIES.has(p.category));
  const model: HouseModel = { id: v2Model.id, primitives: [...v2Model.primitives, ...siteFeaturePrimitives] };

  const violations: V2OnlyViolation[] = [
    {
      what: "legacy.site.materials -> compileArchitecture materials option & surfaceOf() tinting",
      effect: "compatibility-data",
      detail: "Wall/roof/trim/decking colors are still sourced from the legacy MaterialsConfig zones (there is no V2-native materials stage yet). Geometry itself is unaffected — this only changes paint, and MaterialsPanel edits this same shared data on purpose.",
    },
    cutawayActive
      ? {
          what: "legacy.site.house (width/depth) -> cutawayHiddenIds",
          effect: "rendering",
          detail: "The active cutaway's footprint box is sized from the legacy house config, not the V2 document's mass footprints. For a multi-mass design (or one whose synthesized legacy house drifted via a later setHouse edit), this can mis-hide or fail to hide geometry outside that box.",
        }
      : {
          what: "legacy.site.house (width/depth) -> cutawayHiddenIds",
          effect: "compatibility-data",
          detail: "Same dependency as above, currently dormant because no cutaway level is active.",
        },
    {
      what: "legacy SiteConfig.house -> planTerrain / collectOccupiedFootprints (Terrain.tsx, Scenery.tsx, GroundPlane.tsx, footprints.ts, siteBounds.ts)",
      effect: "generation",
      detail: "Terrain grading, scenery scatter keep-out zones, pool-deck outlines and camera-framing bounds are all shaped around the single legacy house rectangle, with no awareness of the V2 document's massing footprint. Out of scope for this diagnostic — flagged for the subVolumes work.",
    },
  ];

  return { model, site: legacy.site, violations };
}
