import type { SiteConfig } from "@/types/house";
import { createRng, hashSeed } from "./rng";
import { getWallAnchor, offsetOutward, pointOnWall } from "@/lib/house/wallAnchor";
import { PAVING_THICKNESS } from "@/lib/house/constants";

export interface FurnitureCluster {
  id: string;
  center: [number, number, number];
  rotationY: number;
}

/** One table + chairs cluster per patio and per balcony, roughly centered on each. */
export function generateFurnitureClusters(site: SiteConfig): FurnitureCluster[] {
  const seed = hashSeed("furniture", site.house.width, site.house.depth, site.patios.length, site.balconies.length);
  const rng = createRng(seed);
  const clusters: FurnitureCluster[] = [];

  site.patios.forEach((patio, i) => {
    const anchor = getWallAnchor(site.house, patio.wall, 0);
    const base = pointOnWall(anchor, patio.offset + patio.width / 2);
    const center = offsetOutward(base, anchor, patio.depth / 2);
    clusters.push({
      id: `patio-furniture-${i}`,
      center: [center[0], PAVING_THICKNESS, center[2]],
      rotationY: rng() * Math.PI * 2,
    });
  });

  site.balconies.forEach((balcony, i) => {
    const anchor = getWallAnchor(site.house, balcony.wall, balcony.level);
    const base = pointOnWall(anchor, balcony.offset + balcony.width / 2);
    const center = offsetOutward(base, anchor, balcony.depth / 2);
    clusters.push({
      id: `balcony-furniture-${i}`,
      center: [center[0], anchor.origin[1], center[2]],
      rotationY: rng() * Math.PI * 2,
    });
  });

  return clusters;
}
