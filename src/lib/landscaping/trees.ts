import type { LandscapeZoneConfig, SiteConfig } from "@/types/house";
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

type Purpose = NonNullable<LandscapeZoneConfig["purpose"]>;

/**
 * Where a purposeful zone's trees stand, as fractions along the zone's long axis (-0.5…0.5 of its usable length) and
 * across it. A privacy screen is a staggered row running the zone's full length (one tree per ~3.5 m); entrance
 * planting and view-framing are a pair at the two ends, flanking the approach or the view; pool planting is a loose
 * row (one per ~4 m) along the pool side.
 */
function zoneLayout(purpose: Purpose, long: number): { along: number; across: number }[] {
  const row = (count: number, stagger: number) => Array.from({ length: count }, (_, i) => ({ along: count === 1 ? 0 : i / (count - 1) - 0.5, across: count > 2 ? (i % 2 ? stagger : -stagger) : 0 }));
  switch (purpose) {
    case "privacy": return row(Math.max(2, Math.min(8, Math.round(long / 3.5) + 1)), 0.2);
    case "pool-planting": return row(Math.max(1, Math.min(4, Math.round(long / 4))), 0.15);
    case "entrance-planting":
    case "view-framing": return row(2, 0);
  }
}

/**
 * The planting a Site Plan zone asks for, laid along the zone's own geometry. A spot that lands on a building or a
 * built feature slides across the zone to the nearest clear position; one with no clear position is skipped.
 */
function plantZone(zone: LandscapeZoneConfig & { purpose: Purpose }, footprints: ReturnType<typeof collectOccupiedFootprints>): [number, number][] {
  const alongX = zone.width >= zone.depth;
  const long = alongX ? zone.width : zone.depth, short = alongX ? zone.depth : zone.width;
  const usable = Math.max(0, long - 2);
  const out: [number, number][] = [];
  for (const { along, across } of zoneLayout(zone.purpose, long)) {
    const a = along * usable;
    for (const shift of [across, 0, 0.3, -0.3]) {
      const c = shift * Math.max(0, short - 1);
      const [x, z] = alongX ? [zone.x + a, zone.z + c] : [zone.x + c, zone.z + a];
      if (isInsideAnyFootprint(x, z, footprints)) continue;
      out.push([x, z]);
      break;
    }
  }
  return out;
}

/** Scatters a stable set of trees around the yard, avoiding the house and every site feature.
 * Site Plan zones are planted first, by purpose and along their geometry; then `count` ambient trees are scattered,
 * the first 8 biased toward the yard perimeter and the rest more freely. */
export function generateTrees(site: SiteConfig, style?: TreeStyle): TreePlacement[] {
  const TREE_COUNT = style?.count ?? DEFAULT_TREE_COUNT;
  const colors = style?.colors ?? FOLIAGE_COLORS;
  const trunk = style?.trunk ?? [1.8, 3.2];
  const seed = hashSeed("trees", site.house.width, site.house.depth, site.house.floors, site.house.roof);
  const rng = createRng(seed);
  // Planting zones are destinations for trees, not obstacles to them; every built/circulation footprint
  // remains a keep-out.
  const footprints = collectOccupiedFootprints({ ...site, landscaping: [] });
  const half = yardHalfExtent(site);

  const placed: TreePlacement[] = [];

  // Site Plan zones establish the first planting moves: deterministic, laid along each zone's own geometry, and not
  // counted against the ambient scatter below.
  for (const zone of site.landscaping) {
    if (!zone.purpose || zone.kind === "clearing") continue;
    for (const [x, z] of plantZone(zone as LandscapeZoneConfig & { purpose: Purpose }, footprints)) {
      placed.push({ id: `tree-${placed.length}`, position: [x, z], trunkHeight: rngRange(rng, trunk[0], trunk[1]), trunkRadius: rngRange(rng, 0.12, 0.22), foliageRadius: rngRange(rng, 1.1, 1.9), foliageColor: rngPick(rng, colors), rotationY: rng() * Math.PI * 2 });
    }
  }

  const planted = placed.length;
  for (let i = planted; i < planted + TREE_COUNT; i++) {
    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_TREE; attempt++) {
      let x: number, z: number;

      if (i - planted < 8) {
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

export interface ShrubPlacement {
  id: string;
  position: [number, number];
  y?: number;
  height: number;
  color: string;
  flowering: boolean;
  variant: number;
  rotationY: number;
}

const SHRUB_COLORS = ["#4f9a3c", "#5aa640", "#468c38", "#62ad48"] as const;

/** Understorey planting: a shrub (sometimes flowering) tucked beside about two thirds of the trees, clear of every footprint. */
export function generateShrubs(site: SiteConfig, trees: TreePlacement[]): ShrubPlacement[] {
  const rng = createRng(hashSeed("shrubs", site.house.width, site.house.depth, trees.length));
  // Like trees, shrubs belong in planting beds: a landscape zone is a destination, not a keep-out.
  const footprints = collectOccupiedFootprints({ ...site, landscaping: [] });
  const shrubs: ShrubPlacement[] = [];
  for (const tree of trees) {
    if (rng() > 0.66) continue;
    const count = rng() > 0.6 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = tree.foliageRadius * rngRange(rng, 0.9, 1.5);
      const x = tree.position[0] + Math.cos(angle) * dist;
      const z = tree.position[1] + Math.sin(angle) * dist;
      if (isInsideAnyFootprint(x, z, footprints)) continue;
      shrubs.push({
        id: `shrub-${shrubs.length}`,
        position: [x, z],
        y: tree.y,
        height: rngRange(rng, 0.7, 1.35),
        color: rngPick(rng, SHRUB_COLORS),
        flowering: rng() > 0.72,
        variant: Math.floor(rng() * 4),
        rotationY: rng() * Math.PI * 2,
      });
    }
  }
  return shrubs;
}
