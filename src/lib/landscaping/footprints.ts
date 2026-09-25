import type { SiteConfig } from "@/types/house";
import { getWallAnchor, offsetOutward, pointOnWall } from "@/lib/house/wallAnchor";
import { getPoolDeckFootprint } from "@/lib/house/features/pools";
import { computeSiteBounds } from "@/lib/house/siteBounds";
import { arcPoints, arcSegments, polylineLength, type P2 } from "@/lib/house/geometry/mesh";
import { pathCurve } from "@/lib/house/features/paths";
import { retainingWallCurve } from "@/lib/house/features/retainingWalls";
import { waterwayCurve } from "@/lib/house/features/waterways";

export interface Footprint {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
}

const CLEARANCE = 1;

function pointInRect(x: number, z: number, f: Footprint): boolean {
  return Math.abs(x - f.cx) < f.halfW && Math.abs(z - f.cz) < f.halfD;
}

/** Every ground-level footprint scenery placement must avoid. */
export function collectOccupiedFootprints(site: SiteConfig): Footprint[] {
  const house = site.house;
  const footprints: Footprint[] = [
    { cx: 0, cz: 0, halfW: house.width / 2 + CLEARANCE, halfD: house.depth / 2 + CLEARANCE },
  ];

  for (const garage of site.garages) {
    const anchor = getWallAnchor(house, garage.wall, 0);
    const base = pointOnWall(anchor, garage.offset + garage.width / 2);
    const center = offsetOutward(base, anchor, garage.depth / 2);
    const isNS = garage.wall === "north" || garage.wall === "south";
    footprints.push({
      cx: center[0],
      cz: center[2],
      halfW: (isNS ? garage.width : garage.depth) / 2 + CLEARANCE,
      halfD: (isNS ? garage.depth : garage.width) / 2 + CLEARANCE,
    });
  }

  for (const patio of site.patios) {
    const anchor = getWallAnchor(house, patio.wall, 0);
    const base = pointOnWall(anchor, patio.offset + patio.width / 2);
    const center = offsetOutward(base, anchor, patio.depth / 2);
    const isNS = patio.wall === "north" || patio.wall === "south";
    footprints.push({
      cx: center[0],
      cz: center[2],
      halfW: (isNS ? patio.width : patio.depth) / 2 + CLEARANCE,
      halfD: (isNS ? patio.depth : patio.width) / 2 + CLEARANCE,
    });
  }

  for (const driveway of site.driveways) {
    const anchor = getWallAnchor(house, driveway.wall, 0);
    const base = pointOnWall(anchor, driveway.offset + driveway.width / 2);
    const center = offsetOutward(base, anchor, driveway.length / 2);
    const isNS = driveway.wall === "north" || driveway.wall === "south";
    footprints.push({
      cx: center[0],
      cz: center[2],
      halfW: (isNS ? driveway.width : driveway.length) / 2 + CLEARANCE,
      halfD: (isNS ? driveway.length : driveway.width) / 2 + CLEARANCE,
    });
  }

  for (const pool of site.pools) {
    const deck = getPoolDeckFootprint(pool, house);
    footprints.push({
      cx: deck.center[0],
      cz: deck.center[1],
      halfW: deck.width / 2 + CLEARANCE,
      halfD: deck.depth / 2 + CLEARANCE,
    });
  }

  for (const b of site.buildings) {
    footprints.push({ cx: b.x, cz: b.z, halfW: b.width / 2 + CLEARANCE, halfD: b.depth / 2 + CLEARANCE });
  }

  for (const p of site.parking) {
    footprints.push({ cx: p.x, cz: p.z, halfW: p.width / 2 + CLEARANCE, halfD: p.depth / 2 + CLEARANCE });
  }

  for (const l of site.landscaping) {
    footprints.push({ cx: l.x, cz: l.z, halfW: l.width / 2 + CLEARANCE, halfD: l.depth / 2 + CLEARANCE });
  }

  for (const r of site.roads) {
    const cx = (r.x1 + r.x2) / 2;
    const cz = (r.z1 + r.z2) / 2;
    const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
    footprints.push({ cx, cz, halfW: len / 2 + r.width / 2 + CLEARANCE, halfD: r.width / 2 + CLEARANCE });
  }

  return [...footprints, ...shapedFootprints(site)];
}

/** Square footprints laid along a curve, `half` metres either side, so ambient trees keep clear of it. */
function alongCurve(points: readonly P2[], half: number): Footprint[] {
  const step = Math.max(1.5, half);
  const count = Math.max(1, Math.ceil(polylineLength(points) / step));
  const out: Footprint[] = [];
  for (let i = 0; i <= count; i++) {
    const p = points[Math.min(points.length - 1, Math.round((i / count) * (points.length - 1)))];
    out.push({ cx: p[0], cz: p[1], halfW: half, halfD: half });
  }
  return out;
}

/** Footprints of the site features that are not rectangles, so scenery avoids rivers, paths, walls and rocks. */
function shapedFootprints(site: SiteConfig): Footprint[] {
  const out: Footprint[] = [];
  site.waterways?.forEach((w, i) => out.push(...alongCurve(waterwayCurve(w, i), w.width / 2 + 2.5 + CLEARANCE)));
  site.paths?.forEach((p) => out.push(...alongCurve(pathCurve(p), p.width / 2 + CLEARANCE)));
  site.retainingWalls?.forEach((w) => out.push(...alongCurve(retainingWallCurve(w), w.thickness / 2 + CLEARANCE + 0.5)));
  site.curvedWalls?.forEach((w) => out.push(...alongCurve(arcPoints(w.x, w.z, w.radius, w.startAngle, w.sweep, arcSegments(w.sweep, 10)), w.thickness / 2 + CLEARANCE)));
  site.rocks?.forEach((r) => out.push({ cx: r.x, cz: r.z, halfW: r.radius + r.size / 2 + CLEARANCE, halfD: r.radius + r.size / 2 + CLEARANCE }));
  site.slopes?.forEach((s) => {
    const half = Math.max(s.width, s.depth) / 2;
    out.push({ cx: s.x, cz: s.z, halfW: half, halfD: half });
  });
  return out;
}

export function isInsideAnyFootprint(x: number, z: number, footprints: Footprint[]): boolean {
  return footprints.some((f) => pointInRect(x, z, f));
}

/** Half-extent for auto-scenery scattering — covers the full site, not just the main house's immediate yard. */
export function yardHalfExtent(site: SiteConfig): number {
  const { halfWidth, halfDepth } = computeSiteBounds(site);
  const baseExtent = Math.max(site.house.width, site.house.depth) * 1.3 + 6;
  return Math.max(baseExtent, halfWidth + 10, halfDepth + 10);
}
