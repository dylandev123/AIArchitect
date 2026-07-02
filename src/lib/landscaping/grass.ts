import type { SiteConfig } from "@/types/house";
import { createRng, hashSeed, rngPick, rngRange } from "./rng";
import { collectOccupiedFootprints, isInsideAnyFootprint } from "./footprints";

export interface GrassTuft {
  position: [number, number];
  rotationY: number;
  scale: number;
  color: string;
}

const GRASS_COLORS = ["#5f8a4a", "#6b9654", "#557d42"] as const;
const TUFT_COUNT = 450;
const MAX_ATTEMPTS = TUFT_COUNT * 6;

/** Scatters a stable field of grass tufts in a band around the house, avoiding every site feature. */
export function generateGrassTufts(site: SiteConfig): GrassTuft[] {
  const seed = hashSeed("grass", site.house.width, site.house.depth, site.house.floors);
  const rng = createRng(seed);
  const footprints = collectOccupiedFootprints(site);
  const half = Math.max(site.house.width, site.house.depth) * 0.9 + 8;

  const tufts: GrassTuft[] = [];
  let attempts = 0;
  while (tufts.length < TUFT_COUNT && attempts < MAX_ATTEMPTS) {
    attempts++;
    const x = rngRange(rng, -half, half);
    const z = rngRange(rng, -half, half);
    if (isInsideAnyFootprint(x, z, footprints)) continue;
    tufts.push({
      position: [x, z],
      rotationY: rng() * Math.PI * 2,
      scale: rngRange(rng, 0.7, 1.3),
      color: rngPick(rng, GRASS_COLORS),
    });
  }
  return tufts;
}
