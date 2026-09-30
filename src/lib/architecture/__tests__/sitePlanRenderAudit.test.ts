import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "@/lib/architecture/fixtures";
import { validateArchitecturalDesignDocument, type ArchitecturalDesignDocument } from "@/lib/architecture/document";
import { compileArchitecture, pickDominantMass, ROOF_KIND_TO_LEGACY_TYPE } from "@/lib/architecture/compiler";
import { applyV2OnlyMode } from "@/lib/architecture/v2OnlyMode";
import { sitePlanContextForDocument } from "@/lib/ai/finalAssembly";
import { assembleGeneratedProject } from "@/lib/ai/generation";
import { createTimings } from "@/lib/ai/timing";
import { insideMass, v2SiteFrameForDocument, type MassFootprint } from "@/lib/architecture/siteFrame";
import { pointInPolygon, type P2 } from "@/lib/house/geometry/mesh";
import { geometricGraphErrors, normalizeSitePlan, sitePlanOperations, sitePlanSchema, type SitePlan } from "@/lib/architecture/stages/sitePlanStage";
import { attachOutdoorAssets, placementBounds, type OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { COMPONENTS } from "@/lib/outdoor/components";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { pathCurve } from "@/lib/house/features/paths";
import { getPoolDeckOutline } from "@/lib/house/features/pools";
import { planTerrain } from "@/lib/landscaping/terrain";
import { generateShrubs, generateTrees } from "@/lib/landscaping/trees";
import { generateCars } from "@/lib/landscaping/cars";
import { generateFurnitureClusters } from "@/lib/landscaping/furniture";
import { DEFAULT_MATERIALS_CONFIG, type PathConfig, type SiteConfig } from "@/types/house";
import type { HousePrimitive } from "@/lib/house/types";
import type { AssetIndexEntry } from "@/lib/library/retrieval";

/**
 * Deterministic, AI-free regression audit of the accepted Site Plan → Final Assembly → rendered property path. It
 * replays `runFinalAssembly` exactly (sitePlanOperations → assembleGeneratedProject → attachOutdoorAssets) with a fixed
 * authored plan, then renders the result the way HouseRenderer + Scenery do, and checks what actually renders.
 */
const BRIEF = "A luxury modern villa with a large swimming pool, pool deck, generous terrace, long driveway and guest parking, countryside site facing south.";
const SITE = { environment: "countryside", viewDirection: "south", terrainSlope: "flat", approachSide: "north", designTier: "luxury", projectScale: "luxury" };

/** One 24×14 m two-storey pavilion at the origin, front door centred on the north (arrival) facade. */
const VILLA: ArchitecturalDesignDocument = {
  ...ARCHITECTURE_FIXTURES.cantileverHouse,
  brief: BRIEF,
  siteStrategy: { environment: "countryside", viewDirection: "south", arrivalDirection: "north", terrain: "level" },
  massing: { composition: "rectangular-pavilion", masses: [{ id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 24, depth: 14, floors: 2, elevation: 0, rotation: 0, openings: [{ type: "door", facade: "north", start: 0.46, end: 0.54, height: 2.5 }] }] },
  roofs: { recipes: [{ id: "living-roof", massId: "living", kind: "flat" }] },
};

/** North wall z=-7, south wall z=+7; north/south offsets run east from x=-12. Path endpoints are left for snapping. */
const AUTHORED = {
  entrance: { wall: "north", offset: 12 },
  driveway: { wall: "north", offset: 16, width: 5, length: 26, bend: 3 },
  parking: [{ x: 17, z: -20, width: 10, depth: 11 }],
  pool: { wall: "south", offset: 5, distance: 9, width: 14, depth: 5, waterDepth: 1.6, shape: "rounded" },
  terrace: { wall: "south", offset: 2, width: 20, depth: 6 },
  poolDeck: { x: 0, z: 18.5, width: 22, depth: 10 },
  paths: [
    { from: "arrival", to: "parking", x1: 0, z1: 0, x2: 0, z2: 0, width: 1.6, bend: 0, surface: "flagstone" },
    { from: "parking", to: "entrance", x1: 0, z1: 0, x2: 0, z2: 0, width: 1.8, bend: 2, surface: "flagstone" },
    { from: "entrance", to: "outdoor-living", x1: 0, z1: 0, x2: 0, z2: 0, width: 1.4, bend: 6, surface: "gravel" },
    { from: "outdoor-living", to: "pool", x1: 0, z1: 0, x2: 0, z2: 0, width: 1.6, bend: 0, surface: "flagstone" },
  ],
  landscape: [
    { purpose: "privacy", kind: "garden", x: -24, z: 0, width: 6, depth: 20 },
    { purpose: "entrance-planting", kind: "garden", x: -7, z: -12, width: 8, depth: 4 },
    { purpose: "pool-planting", kind: "garden", x: 16, z: 18, width: 6, depth: 8 },
    { purpose: "view-framing", kind: "garden", x: -18, z: 24, width: 8, depth: 5 },
  ],
};

const LIBRARY: AssetIndexEntry[] = Object.values(COMPONENTS).map((d) => ({ id: `approved-${d.key}`, name: d.name, family: d.category, dimensions: d.dimensions, styleTags: ["modern"], tags: d.tags }));

type Box = { x: [number, number]; y: [number, number]; z: [number, number] };
function boundsOf(primitives: readonly HousePrimitive[]): Box {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const add = (x: number, y: number, z: number) => { lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], y); lo[2] = Math.min(lo[2], z); hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], y); hi[2] = Math.max(hi[2], z); };
  for (const p of primitives) {
    if (p.kind === "box") {
      const c = Math.abs(Math.cos(p.rotation[1])), s = Math.abs(Math.sin(p.rotation[1]));
      const hw = (p.size[0] * c + p.size[2] * s) / 2, hd = (p.size[2] * c + p.size[0] * s) / 2;
      add(p.position[0] - hw, p.position[1] - p.size[1] / 2, p.position[2] - hd); add(p.position[0] + hw, p.position[1] + p.size[1] / 2, p.position[2] + hd);
    } else if ("vertices" in p) for (let i = 0; i < p.vertices.length; i += 3) add(p.vertices[i], p.vertices[i + 1], p.vertices[i + 2]);
  }
  return { x: [lo[0], hi[0]], y: [lo[1], hi[1]], z: [lo[2], hi[2]] };
}
const inside = (x: number, z: number, b: Box, margin = 0) => x > b.x[0] - margin && x < b.x[1] + margin && z > b.z[0] - margin && z < b.z[1] + margin;
const overlapArea = (a: Box, b: Box) => Math.max(0, Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0])) * Math.max(0, Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]));
const wallsOf = (model: { primitives: HousePrimitive[] }, massId: string) => boundsOf(model.primitives.filter((p) => p.id.startsWith(`architecture-${massId}-`) && p.category === "wall"));

/** Horizontal triangles of a triMesh at height `y` (its walking surface). */
function topTriangles(p: HousePrimitive, y: number): [P2, P2, P2][] {
  if (p.kind === "box" || !("vertices" in p)) return [];
  const out: [P2, P2, P2][] = [];
  for (let i = 0; i < p.vertices.length; i += 9) {
    const v = [0, 3, 6].map((k) => p.vertices.slice(i + k, i + k + 3));
    if (v.every((q) => Math.abs(q[1] - y) < 1e-6)) out.push(v.map((q) => [q[0], q[2]] as P2) as [P2, P2, P2]);
  }
  return out;
}
const triArea = ([a, b, c]: [P2, P2, P2]) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;

/** Every rendered path's centre line, sampled finely. */
const pathSamples = (site: SiteConfig): P2[] => (site.paths ?? []).flatMap((p) => {
  const c = pathCurve(p), out: P2[] = [];
  for (let i = 0; i < c.length - 1; i++) for (let k = 0; k < 8; k++) out.push([c[i][0] + ((c[i + 1][0] - c[i][0]) * k) / 8, c[i][1] + ((c[i + 1][1] - c[i][1]) * k) / 8]);
  return out;
});

/** `runFinalAssembly` minus the model call: the model's own site ops must be ignored in favour of the plan's. */
function assemble(document: ArchitecturalDesignDocument, raw: unknown) {
  const ctx = sitePlanContextForDocument(BRIEF, document)!;
  const plan: SitePlan = sitePlanSchema.parse(normalizeSitePlan(raw, ctx));
  const dominant = pickDominantMass(document.massing.masses)!;
  const house = { width: dominant.width, depth: dominant.depth, floors: dominant.floors, roof: ROOF_KIND_TO_LEGACY_TYPE[document.roofs.recipes.find((r) => r.massId === dominant.id)?.kind ?? "flat"] };
  const output = { summary: "Fixture", house, site: SITE, operations: [
    { op: "setExteriorOptions", fields: { style: "modern-luxury" } },
    { op: "addPool", value: { wall: "north", offset: 1, distance: 3, width: 4, depth: 3, waterDepth: 1.2 } },
    { op: "addParking", value: { x: -30, z: -30, width: 6, depth: 6 } },
  ] };
  const frame = v2SiteFrameForDocument(document)!;
  const result = assembleGeneratedProject(output as never, [], BRIEF, true, createTimings(), sitePlanOperations(plan, frame.masses));
  if (!result.ok) throw new Error(result.errors.join("\n"));
  const conceived = JSON.stringify({ ...JSON.parse(result.json), sitePlan: plan, architecturalDesignDocument: document });
  const json = attachOutdoorAssets(conceived, BRIEF, LIBRARY);
  const legacy = generateHouseFromJson(json);
  const v2 = compileArchitecture(document, { materials: legacy.site?.materials ?? DEFAULT_MATERIALS_CONFIG });
  const { model, site } = applyV2OnlyMode({ legacy, v2Model: v2.model, v2OnlyMode: false, cutawayActive: false });
  const root = JSON.parse(json) as Record<string, unknown> & { outdoorAssetPlacements: OutdoorAssetPlacement[] };
  const prims = (prefix: string) => model.primitives.filter((p) => p.id === prefix || p.id.startsWith(`${prefix}-`));
  const furnished = root.outdoorAssetPlacements.map(placementBounds).map((b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }));
  return { ctx, plan, frame, result, root, legacy, v2, model, site: site!, prims, furnished };
}

describe("Site Plan → rendered property audit (single mass at origin)", () => {
  const run = assemble(VILLA, AUTHORED);
  const { plan, result, root, legacy, v2, model, site, prims, furnished } = run;
  const house = wallsOf(v2.model, "living");
  const deckTop = boundsOf(prims("deck-0")).y[1];

  it("accepts the authored plan and snaps every path to its authored geometry", () => {
    expect(geometricGraphErrors(plan, run.ctx)).toEqual([]);
    expect(plan.paths.map((p) => [p.x1, p.z1, p.x2, p.z2])).toEqual([[6.5, -33, 17, -20], [17, -20, 0, -7], [0, -7, 0, 13], [0, 13, 0, 18.5]]);
  });

  it("executes the plan verbatim through Final Assembly, ignoring the model's own site ops", () => {
    expect(result.ok && result.skipped).toEqual([]);
    expect(result.ok && result.adjusted).toEqual([]);
    const strip = (items: unknown) => (items as Record<string, unknown>[]).map(({ id: _id, ...rest }) => rest);
    expect(strip(root.driveways)).toEqual([AUTHORED.driveway]);
    expect(strip(root.parking)).toEqual(AUTHORED.parking);
    expect(strip(root.pools)).toEqual([AUTHORED.pool]);
    expect(strip(root.patios)).toEqual([AUTHORED.terrace]);
    expect(strip(root.decks)).toEqual([{ ...AUTHORED.poolDeck, level: 0 }]);
    expect(strip(root.landscaping)).toEqual(AUTHORED.landscape);
    // Paths clear of the building are verbatim; the one that would cross it is detoured between the same end points.
    const paths = strip(root.paths) as unknown as PathConfig[];
    const authored = plan.paths.map(({ from: _f, to: _t, ...rest }) => rest);
    expect(paths[0]).toEqual(authored[0]);
    expect(paths[1]).toEqual(authored[1]);
    expect(paths[paths.length - 1]).toEqual(authored[3]);
    const detour = paths.slice(2, -1);
    expect(detour.length).toBeGreaterThan(1);
    expect([detour[0].x1, detour[0].z1, detour[detour.length - 1].x2, detour[detour.length - 1].z2]).toEqual([0, -7, 0, 13]);
    detour.slice(1).forEach((seg, i) => expect([seg.x1, seg.z1]).toEqual([detour[i].x2, detour[i].z2]));
    for (const seg of detour) expect(seg).toMatchObject({ width: 1.4, surface: "gravel" });
    expect(legacy.errors).toEqual([]);
    expect(legacy.warnings).toEqual([]);
    expect(v2.errors).toEqual([]);
  });

  it("renders every site feature beside the V2 building at its authored size and position", () => {
    expect(house).toMatchObject({ x: [-12, 12], z: [-7, 7] });
    const near = (actual: [number, number], expected: [number, number], tol = 0.05) => { expect(Math.abs(actual[0] - expected[0])).toBeLessThanOrEqual(tol); expect(Math.abs(actual[1] - expected[1])).toBeLessThanOrEqual(tol); };
    // Driveway: 5 m wide from x=4, bowed 3 m east; 26 m out from the north wall.
    const drive = boundsOf(prims("driveway-0"));
    near(drive.z, [-34, -6], 1.01);
    expect(drive.x[0]).toBeCloseTo(4.2, 0);
    near(boundsOf(prims("parking-0-lot")).x, [12, 22]); near(boundsOf(prims("parking-0-lot")).z, [-25.5, -14.5]);
    // Pool: 14×5 water (rounded, so a hair inside), 9 m off the south wall.
    const water = boundsOf(prims("pool-0-water"));
    expect(water.x[1] - water.x[0]).toBeGreaterThan(13.5); expect(water.z[0]).toBeGreaterThan(16 - 0.01); expect(water.z[1]).toBeLessThan(21 + 0.01);
    near(boundsOf(prims("patio-0")).x, [-10, 10]); near(boundsOf(prims("patio-0")).z, [7, 13]);
    near(boundsOf(prims("deck-0")).x, [-11, 11]); near(boundsOf(prims("deck-0")).z, [13.5, 23.5]);
    (site.paths ?? []).forEach((path, i) => {
      const b = boundsOf(prims(`path-${i}`));
      expect(prims(`path-${i}`).length).toBeGreaterThan(0);
      expect(inside(path.x1, path.z1, b, path.width)).toBe(true); expect(inside(path.x2, path.z2, b, path.width)).toBe(true);
    });
    AUTHORED.landscape.forEach((zone, i) => { const b = boundsOf(prims(`landscape-${i}-zone`)); near(b.x, [zone.x - zone.width / 2, zone.x + zone.width / 2]); near(b.z, [zone.z - zone.depth / 2, zone.z + zone.depth / 2]); });
    // Nothing from the legacy house shell leaks into the V2 render.
    expect(model.primitives.filter((p) => p.category === "wall" && !p.id.startsWith("architecture-"))).toEqual([]);
  });

  it("#8 parks one car per stall, wholly inside the lot and clear of every stripe", () => {
    const cars = generateCars(site);
    const lot = AUTHORED.parking[0];
    const stripes = prims("parking-0").filter((p) => p.id.includes("stripe")).map((p) => (p.kind === "box" ? p.position[0] : NaN));
    expect(cars).toHaveLength(6);
    // Car body 1.8 × 4.2 m, turned at most 0.03 rad.
    const halfX = (1.8 * Math.cos(0.03) + 4.2 * Math.sin(0.03)) / 2, halfZ = (4.2 * Math.cos(0.03) + 1.8 * Math.sin(0.03)) / 2;
    for (const car of cars) {
      expect(Math.abs(car.rotationY)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(car.position[0] - lot.x) + halfX).toBeLessThanOrEqual(lot.width / 2);
      expect(Math.abs(car.position[1] - lot.z) + halfZ).toBeLessThanOrEqual(lot.depth / 2);
      expect(Math.min(...stripes.map((x) => Math.abs(x - car.position[0])))).toBeGreaterThan(halfX);
    }
    // No two cars share a stall.
    const slots = cars.map((c) => `${Math.floor((c.position[0] - (lot.x - lot.width / 2)) / 2.5)}:${Math.round(c.position[1])}`);
    expect(new Set(slots).size).toBe(cars.length);
  });

  it("#2 cuts the pool deck around the pool, leaving the water open and the rest of the deck intact", () => {
    const slab = prims("deck-0-slab");
    expect(slab).toHaveLength(1);
    const top = topTriangles(slab[0], deckTop);
    const coping = getPoolDeckOutline(site.pools[0], site.house);
    const water = boundsOf(prims("pool-0-water"));
    // No part of the deck's walking surface lies over the water (or the pool's coping).
    for (const tri of top) {
      const c: P2 = [(tri[0][0] + tri[1][0] + tri[2][0]) / 3, (tri[0][1] + tri[1][1] + tri[2][1]) / 3];
      expect(pointInPolygon(c, coping)).toBe(false);
    }
    for (let x = water.x[0] + 0.5; x < water.x[1]; x += 1) for (let z = water.z[0] + 0.5; z < water.z[1]; z += 1) {
      expect(top.some(([a, b, c]) => triArea([a, b, c]) > 0 && Math.abs(triArea([[x, z], b, c]) + triArea([a, [x, z], c]) + triArea([a, b, [x, z]]) - triArea([a, b, c])) < 1e-6)).toBe(false);
    }
    // …while the deck still covers its whole outline minus the pool: 22×10 less the coping (rounded 14.8×5.8).
    const area = top.reduce((sum, t) => sum + triArea(t), 0);
    expect(area).toBeGreaterThan(220 - 14.8 * 5.8 - 0.5);
    expect(area).toBeLessThan(220 - 14.8 * 5.8 * 0.9);
  });

  it("#3 lays out a library dining set on the terrace, off the pool, and procedural sets on each free surface", () => {
    const terrace = boundsOf(prims("patio-0"));
    const coping = getPoolDeckOutline(site.pools[0], site.house);
    const dining = root.outdoorAssetPlacements.filter((p) => ["outdoor-dining", "main-outdoor-living"].includes(p.parentSpaceId));
    expect(dining.map((p) => p.role)).toEqual(expect.arrayContaining(["dining-table", "dining-chair"]));
    for (const p of dining) {
      expect(inside(p.position[0], p.position[2], terrace)).toBe(true);
      expect(p.position[1]).toBeCloseTo(terrace.y[1], 3);
    }
    for (const p of root.outdoorAssetPlacements) expect(pointInPolygon([p.position[0], p.position[2]], coping)).toBe(false);

    // Without library furniture: one set on the terrace and one on the deck's pool-free side.
    const bare = generateFurnitureClusters(site);
    expect(bare.map((c) => c.id)).toEqual(["patio-furniture-0", "deck-furniture-0"]);
    expect(inside(bare[0].center[0], bare[0].center[2], terrace)).toBe(true);
    const deckSet = bare[1];
    expect(inside(deckSet.center[0], deckSet.center[2], boundsOf(prims("deck-0")))).toBe(true);
    expect(deckSet.center[1]).toBeCloseTo(deckTop, 3);
    for (const [dx, dz] of [[1.25, 0], [-1.25, 0], [0, 1.25], [0, -1.25]]) expect(pointInPolygon([deckSet.center[0] + dx, deckSet.center[2] + dz], coping)).toBe(false);

    // With it: procedural sets leave the library's areas to it.
    for (const c of generateFurnitureClusters(site, furnished)) for (const f of furnished) expect(c.center[0] + 1.25 <= f.x0 || c.center[0] - 1.25 >= f.x1 || c.center[2] + 1.25 <= f.z0 || c.center[2] - 1.25 >= f.z1).toBe(true);
  });

  it("#4 stands poolside loungers on the deck surface, wholly on the deck and off the coping", () => {
    const deck = boundsOf(prims("deck-0"));
    const coping = getPoolDeckOutline(site.pools[0], site.house);
    const loungers = root.outdoorAssetPlacements.filter((q) => q.role === "sun-lounger");
    expect(loungers).toHaveLength(2);
    for (const p of loungers) {
      const b = placementBounds(p);
      expect(p.position[1]).toBeCloseTo(deckTop, 3);
      expect(b.x - b.w / 2).toBeGreaterThanOrEqual(deck.x[0]); expect(b.x + b.w / 2).toBeLessThanOrEqual(deck.x[1]);
      expect(b.z - b.d / 2).toBeGreaterThanOrEqual(deck.z[0]); expect(b.z + b.d / 2).toBeLessThanOrEqual(deck.z[1]);
      for (const [x, z] of [[b.x - b.w / 2, b.z - b.d / 2], [b.x + b.w / 2, b.z - b.d / 2], [b.x - b.w / 2, b.z + b.d / 2], [b.x + b.w / 2, b.z + b.d / 2]]) expect(pointInPolygon([x, z], coping)).toBe(false);
    }
  });

  it("#1 keeps each zone's purpose and plants trees along the zone's own geometry", () => {
    expect(site.landscaping.map((z) => z.purpose)).toEqual(AUTHORED.landscape.map((z) => z.purpose));
    const trees = generateTrees(site, planTerrain(site)!.yardTrees);
    const inZone = (zone: typeof AUTHORED.landscape[number]) => trees.filter((t) => Math.abs(t.position[0] - zone.x) <= zone.width / 2 && Math.abs(t.position[1] - zone.z) <= zone.depth / 2);
    const [privacy, entrance, pool, view] = AUTHORED.landscape.map(inZone);
    // A 20 m privacy screen runs its full length (north–south, the zone's long axis), not a clump across it.
    expect(privacy.length).toBeGreaterThanOrEqual(6);
    const zs = privacy.map((t) => t.position[1]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThanOrEqual(16);
    // Entrance and view-framing pairs flank their zones' long axis (east–west); pool planting runs along its 8 m side.
    for (const pair of [entrance, view]) { expect(pair).toHaveLength(2); expect(Math.abs(pair[0].position[0] - pair[1].position[0])).toBeGreaterThanOrEqual(5); }
    expect(pool).toHaveLength(2);
    expect(Math.abs(pool[0].position[1] - pool[1].position[1])).toBeGreaterThanOrEqual(5);
    // The ambient scatter still comes on top of the planted zones.
    expect(trees.length).toBeGreaterThanOrEqual(planTerrain(site)!.yardTrees.count + 13);
  });

  it("#7 carries the entrance → outdoor-living path around the building instead of through it", () => {
    const building: MassFootprint = { id: "living", cx: 0, cz: 0, width: 24, depth: 14, rotation: 0 };
    expect(pathSamples(site).filter(([x, z]) => insideMass(building, x, z, -0.05))).toEqual([]);
    // The detour keeps WALL_CLEARANCE (0.6 m) plus half its width off the walls, except where it leaves the door.
    const detour = (site.paths ?? []).slice(2, -1);
    for (const path of detour) for (const [x, z] of pathSamples({ ...site, paths: [path] })) {
      if (Math.hypot(x, z + 7) > 1.35) expect(insideMass(building, x, z, path.width / 2 + 0.55)).toBe(false);
    }
  });
});

describe("Site Plan → rendered property audit (off-origin / multi-mass V2)", () => {
  const PAVILION: ArchitecturalDesignDocument = { ...ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse, massing: { ...ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse.massing, masses: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse.massing.masses.map((m) => m.id === "living" ? { ...m, openings: [{ type: "door" as const, facade: "north" as const, start: .45, end: .55, height: 2.5 }] } : m) } };
  const plan = { ...AUTHORED, entrance: { wall: "north", offset: 7.5 }, driveway: { wall: "north", offset: 10, width: 4, length: 20 }, parking: [{ x: 16, z: -18, width: 10, depth: 10 }], pool: { wall: "south", offset: 1, distance: 5, width: 12, depth: 5, waterDepth: 1.5 }, terrace: { wall: "south", offset: 2, width: 11, depth: 4 }, poolDeck: { x: 0, z: 16, width: 16, depth: 3 } };
  const run = assemble(PAVILION, plan);
  const { v2, prims, site, ctx } = run;
  const living = wallsOf(v2.model, "living");
  const masses = run.frame.masses;

  it("the living pavilion is not centred on the origin (precondition)", () => {
    expect(living).toMatchObject({ x: [-7.5, 7.5], z: [0, 8] });
    expect(ctx.house.center).toEqual({ x: 0, z: 4 });
    expect(masses.map((m) => m.id)).toEqual(["living", "bedroom", "guest", "garage"]);
  });

  it("#5 anchors wall features to the living pavilion where it actually stands", () => {
    expect(site.house.center).toEqual({ x: 0, z: 4 });
    const terrace = boundsOf(prims("patio-0"));
    expect(terrace.z[0]).toBeCloseTo(living.z[1], 3);
    expect(terrace.x[0]).toBeCloseTo(living.x[0] + 2, 3);
    for (const m of ["living", "bedroom", "guest", "garage"]) expect(overlapArea(terrace, wallsOf(v2.model, m))).toBe(0);
    // Authored 5 m gap between the south facade and the pool; the driveway leaves the real north facade.
    // (Rectangular pool water is inset by its 0.15 m basin wall.)
    expect(boundsOf(prims("pool-0-water")).z[0] - living.z[1]).toBeCloseTo(5.15, 2);
    expect(boundsOf(prims("driveway-0")).z[1]).toBeCloseTo(living.z[0], 3);
    // The Site Plan contract measures from the same footprint, so its entrance anchor is the real door.
    expect(run.plan.paths.find((p) => p.to === "entrance")).toMatchObject({ x2: 0, z2: 0 });
  });

  it("#5 leaves a legacy-recovery V2 site (no authored Site Plan) in its origin frame, but still keeps out of every mass", () => {
    const recovered: Record<string, unknown> = { ...run.root };
    delete recovered.sitePlan;
    const legacySite = generateHouseFromJson(JSON.stringify(recovered)).site!;
    expect(legacySite.house.center).toBeUndefined();
    expect(legacySite.buildingFootprints?.map((m) => m.id)).toEqual(["living", "bedroom", "guest", "garage"]);
  });

  it("#6 keeps trees and shrubs out of every V2 mass", () => {
    const trees = generateTrees(site, planTerrain(site)!.yardTrees);
    const shrubs = generateShrubs(site, trees);
    for (const m of masses) {
      expect(trees.filter((t) => insideMass(m, t.position[0], t.position[1], 0.5))).toEqual([]);
      expect(shrubs.filter((s) => insideMass(m, s.position[0], s.position[1], 0.3))).toEqual([]);
    }
  });

  it("#6 keeps ambient trees out of every mass of every architecture fixture", () => {
    for (const [name, doc] of Object.entries(ARCHITECTURE_FIXTURES)) {
      const frame = v2SiteFrameForDocument(doc);
      if (!frame) continue;
      const json = JSON.stringify({ house: { width: frame.anchor.width, depth: frame.anchor.depth, floors: frame.anchor.floors, roof: "flat" }, site: SITE, architecturalDesignDocument: doc });
      const bare = generateHouseFromJson(json).site!;
      const trees = generateTrees(bare, planTerrain(bare)!.yardTrees);
      const hits = frame.masses.flatMap((m) => trees.filter((t) => insideMass(m, t.position[0], t.position[1], 0.5)).map(() => `${name}/${m.id}`));
      expect(hits).toEqual([]);
    }
  });

  it("#7 routes every path clear of every mass", () => {
    for (const m of masses) expect(pathSamples(site).filter(([x, z]) => insideMass(m, x, z, -0.05)).length).toBe(0);
  });

  it("#5 lays furniture out against the real masses, never inside one", () => {
    const placed = run.root.outdoorAssetPlacements;
    const clusters = generateFurnitureClusters(site);
    expect(clusters.length).toBeGreaterThan(0);
    for (const m of masses) {
      expect(placed.filter((p) => insideMass(m, p.position[0], p.position[2]))).toEqual([]);
      expect(clusters.filter((c) => insideMass(m, c.center[0], c.center[2]))).toEqual([]);
    }
  });
});

it("the audit villa is a valid V2 document", () => {
  expect(validateArchitecturalDesignDocument(VILLA)).toEqual([]);
});
