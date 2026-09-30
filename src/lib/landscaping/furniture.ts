import type { SiteConfig } from "@/types/house";
import { createRng, hashSeed } from "./rng";
import { getWallAnchor, offsetOutward, pointOnWall } from "@/lib/house/wallAnchor";
import { FLOOR_THICKNESS, LEVEL_HEIGHT, PAVING_THICKNESS } from "@/lib/house/constants";
import { getPoolDeckFootprint } from "@/lib/house/features/pools";

export interface FurnitureCluster {
  id: string;
  center: [number, number, number];
  rotationY: number;
}

/** A table-and-four-chairs set (see PatioFurnitureSet) spans ~2.5 m whichever way it turns; this leaves a margin. */
const CLUSTER_ROOM = 3;

export type Rect = { x0: number; x1: number; z0: number; z1: number };
const touches = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;

/**
 * The largest part of a surface a furniture set fits on once every pool (coping included) is left out: the whole
 * surface when no pool reaches it, else the best of the bands around the pools that fits a set. Null when none does.
 */
function seatingArea(surface: Rect, pools: readonly Rect[], furnished: readonly Rect[]): Rect | null {
  const hit = pools.filter((p) => touches(p, surface));
  // A surface with no pool keeps its set whatever its size, as it always has — unless library furniture already
  // dresses it.
  if (hit.length === 0) return furnished.some((f) => touches(f, surface)) ? null : surface;
  const candidates: Rect[] = (() => {
    const u = { x0: Math.min(...hit.map((p) => p.x0)), x1: Math.max(...hit.map((p) => p.x1)), z0: Math.min(...hit.map((p) => p.z0)), z1: Math.max(...hit.map((p) => p.z1)) };
    return [
      { ...surface, z1: Math.min(surface.z1, u.z0) }, { ...surface, z0: Math.max(surface.z0, u.z1) },
      { ...surface, x1: Math.min(surface.x1, u.x0) }, { ...surface, x0: Math.max(surface.x0, u.x1) },
    ];
  })();
  const fits = candidates.filter((r) => r.x1 - r.x0 >= CLUSTER_ROOM && r.z1 - r.z0 >= CLUSTER_ROOM && !furnished.some((f) => touches(f, r)));
  return fits.sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0))[0] ?? null;
}

/**
 * One table + chairs cluster per patio, ground or raised deck and balcony, centred on the surface's usable area —
 * never over a pool that the terrace or deck surrounds, and never where placed library furniture (`furnished`, the
 * footprints of the project's outdoorAssetPlacements) already dresses that part of the surface.
 */
export function generateFurnitureClusters(site: SiteConfig, furnished: readonly Rect[] = []): FurnitureCluster[] {
  const seed = hashSeed("furniture", site.house.width, site.house.depth, site.patios.length, site.balconies.length);
  const rng = createRng(seed);
  const clusters: FurnitureCluster[] = [];
  const pools: Rect[] = site.pools.map((pool) => {
    const f = getPoolDeckFootprint(pool, site.house);
    return { x0: f.center[0] - f.width / 2, x1: f.center[0] + f.width / 2, z0: f.center[1] - f.depth / 2, z1: f.center[1] + f.depth / 2 };
  });

  site.patios.forEach((patio, i) => {
    const anchor = getWallAnchor(site.house, patio.wall, 0);
    const base = pointOnWall(anchor, patio.offset + patio.width / 2);
    const center = offsetOutward(base, anchor, patio.depth / 2);
    const isNS = patio.wall === "north" || patio.wall === "south";
    const hw = (isNS ? patio.width : patio.depth) / 2, hd = (isNS ? patio.depth : patio.width) / 2;
    const area = seatingArea({ x0: center[0] - hw, x1: center[0] + hw, z0: center[2] - hd, z1: center[2] + hd }, pools, furnished);
    if (!area) return;
    clusters.push({
      id: `patio-furniture-${i}`,
      center: [(area.x0 + area.x1) / 2, PAVING_THICKNESS, (area.z0 + area.z1) / 2],
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

  site.decks.forEach((deck, i) => {
    const top = deck.level === 0 ? PAVING_THICKNESS : deck.level * LEVEL_HEIGHT + FLOOR_THICKNESS;
    const turned = (deck.rotation ?? 0) !== 0;
    // A turned deck keeps its set at its centre (its own frame is not axis-aligned); only when it holds no pool.
    const area = turned
      ? (seatingArea({ x0: deck.x - deck.width / 2, x1: deck.x + deck.width / 2, z0: deck.z - deck.depth / 2, z1: deck.z + deck.depth / 2 }, pools, furnished) === null ? null : { x0: deck.x, x1: deck.x, z0: deck.z, z1: deck.z })
      : seatingArea({ x0: deck.x - deck.width / 2, x1: deck.x + deck.width / 2, z0: deck.z - deck.depth / 2, z1: deck.z + deck.depth / 2 }, pools, furnished);
    if (!area) return;
    clusters.push({
      id: `deck-furniture-${i}`,
      center: [(area.x0 + area.x1) / 2, top, (area.z0 + area.z1) / 2],
      rotationY: rng() * Math.PI * 2,
    });
  });

  return clusters;
}
