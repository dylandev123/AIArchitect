import type { SiteConfig } from "@/types/house";
import { createRng, hashSeed, rngPick, rngRange } from "./rng";
import { collectOccupiedFootprints, isInsideAnyFootprint, yardHalfExtent } from "./footprints";

export interface TreePlacement {
  id: string;
  position: [number, number];
  /** Ground height at the tree; 0 when omitted. */
  y?: number;
  trunkHeight: number;
  trunkRadius: number;
  foliageRadius: number;
  foliageColor: string;
  rotationY: number;
}

/** Vibrant Sims-style game greens — saturated and bright, not realistic muddy tones. */
const FOLIAGE_COLORS = ["#38c040", "#2aac38", "#44c84c", "#30b035"] as const;
const DEFAULT_TREE_COUNT = 10;
const MIN_SPACING = 3;
const MAX_ATTEMPTS_PER_TREE = 40;

/** Environment-specific overrides for the yard's ambient trees (see `planTerrain`). */
export interface TreeStyle {
  count: number;
  colors: readonly string[];
  trunk: [number, number];
}

/** Scatters a stable set of trees around the yard, avoiding the house and every site feature.
 * First 8 trees are biased toward the yard perimeter; the rest scatter more freely. */
export function generateTrees(site: SiteConfig, style?: TreeStyle): TreePlacement[] {
  const TREE_COUNT = style?.count ?? DEFAULT_TREE_COUNT;
  const colors = style?.colors ?? FOLIAGE_COLORS;
  const trunk = style?.trunk ?? [1.8, 3.2];
  const seed = hashSeed("trees", site.house.width, site.house.depth, site.house.floors, site.house.roof);
  const rng = createRng(seed);
  const footprints = collectOccupiedFootprints(site);
  const half = yardHalfExtent(site);

  const placed: TreePlacement[] = [];

  for (let i = 0; i < TREE_COUNT; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TREE; attempt++) {
      let x: number, z: number;

      if (i < 8) {
        // Outer ring — trees near the yard perimeter for a framed, planted feel.
        const angle = rng() * Math.PI * 2;
        const dist = rngRange(rng, half * 0.48, half * 0.88);
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
      } else {
        // Inner scatter — a looser ring that keeps the lawn around the house open.
        const angle = rng() * Math.PI * 2;
        const dist = rngRange(rng, half * 0.38, half * 0.85);
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
      }

      if (isInsideAnyFootprint(x, z, footprints)) continue;
      const tooClose = placed.some((t) => {
        const dx = t.position[0] - x;
        const dz = t.position[1] - z;
        return Math.sqrt(dx * dx + dz * dz) < MIN_SPACING;
      });
      if (tooClose) continue;

      placed.push({
        id: `tree-${i}`,
        position: [x, z],
        trunkHeight: rngRange(rng, trunk[0], trunk[1]),
        trunkRadius: rngRange(rng, 0.12, 0.22),
        foliageRadius: rngRange(rng, 1.1, 1.9),
        foliageColor: rngPick(rng, colors),
        rotationY: rng() * Math.PI * 2,
      });
      break;
    }
  }

  return placed;
}
