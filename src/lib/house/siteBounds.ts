import type { SiteConfig } from "@/types/house";

export interface SiteBounds {
  halfWidth: number;
  halfDepth: number;
}

/**
 * The bounding extent of everything on the site, not just the main house —
 * used to size the camera fit and ground plane so a resort with buildings
 * scattered far from the main house still fits in view by default.
 */
export function computeSiteBounds(site: SiteConfig): SiteBounds {
  let halfWidth = site.house.width / 2;
  let halfDepth = site.house.depth / 2;

  const expand = (x: number, z: number, halfW: number, halfD: number) => {
    halfWidth = Math.max(halfWidth, Math.abs(x) + halfW);
    halfDepth = Math.max(halfDepth, Math.abs(z) + halfD);
  };

  for (const b of site.buildings) expand(b.x, b.z, b.width / 2, b.depth / 2);
  for (const p of site.parking) expand(p.x, p.z, p.width / 2, p.depth / 2);
  for (const l of site.landscaping) expand(l.x, l.z, l.width / 2, l.depth / 2);
  for (const r of site.roads) {
    expand(r.x1, r.z1, r.width / 2, r.width / 2);
    expand(r.x2, r.z2, r.width / 2, r.width / 2);
  }
  // Ground-following features count toward the site's extent; waterways don't — a river may run off to the horizon.
  for (const w of site.curvedWalls ?? []) expand(w.x, w.z, w.radius, w.radius);
  for (const w of site.retainingWalls ?? []) {
    expand(w.x1, w.z1, w.thickness, w.thickness);
    expand(w.x2, w.z2, w.thickness, w.thickness);
  }
  for (const p of site.paths ?? []) {
    expand(p.x1, p.z1, p.width / 2, p.width / 2);
    expand(p.x2, p.z2, p.width / 2, p.width / 2);
  }
  for (const r of site.rocks ?? []) expand(r.x, r.z, r.radius, r.radius);
  for (const s of site.slopes ?? []) expand(s.x, s.z, Math.max(s.width, s.depth) / 2, Math.max(s.width, s.depth) / 2);
  for (const pool of site.pools) {
    if (typeof pool.siteX === "number" && typeof pool.siteZ === "number") {
      expand(pool.siteX, pool.siteZ, pool.width / 2 + 2, pool.depth / 2 + 2);
    }
  }

  return { halfWidth, halfDepth };
}
