import type { SiteConfig } from "@/types/house";
import { createRng, hashSeed, rngPick, rngRange } from "./rng";
import { collectOccupiedFootprints, isInsideAnyFootprint, yardHalfExtent } from "./footprints";

export interface TreePlacement {
  id: string;
  position: [number, number];
  trunkHeight: number;
  trunkRadius: number;
  foliageRadius: number;
  foliageColor: string;
  rotationY: number;
}

const FOLIAGE_COLORS = ["#4a7c3f", "#3f6b35", "#5a8a47", "#456e3a"] as const;
const TREE_COUNT = 14;
const MIN_SPACING = 3;
const MAX_ATTEMPTS_PER_TREE = 40;

/** Scatters a stable set of trees around the yard, avoiding the house and every site feature. */
export function generateTrees(site: SiteConfig): TreePlacement[] {
  const seed = hashSeed("trees", site.house.width, site.house.depth, site.house.floors, site.house.roof);
  const rng = createRng(seed);
  const footprints = collectOccupiedFootprints(site);
  const half = yardHalfExtent(site);

  const placed: TreePlacement[] = [];

  for (let i = 0; i < TREE_COUNT; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TREE; attempt++) {
      const x = rngRange(rng, -half, half);
      const z = rngRange(rng, -half, half);

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
        trunkHeight: rngRange(rng, 1.8, 3.2),
        trunkRadius: rngRange(rng, 0.12, 0.22),
        foliageRadius: rngRange(rng, 1.1, 1.9),
        foliageColor: rngPick(rng, FOLIAGE_COLORS),
        rotationY: rng() * Math.PI * 2,
      });
      break;
    }
  }

  return placed;
}
