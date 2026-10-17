/**
 * Offline V3 terrain / elevation / site-integration audit. No provider calls.
 * Measures physical integration facts; the asserted invariants are the ones V3 already guarantees,
 * while known terrain gaps are recorded as measured findings (see docs/architecture/v3-terrain-site-audit.md).
 */
import { describe, expect, it } from 'vitest';
import { compileV3Scene, buildV3TerrainSurface, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from '../scene';
import { auditV3SiteHierarchy, resolveSiteHierarchy } from '../siteHierarchy';
import { createV3TerrainSampler, getObjectBaseY, getObjectTopY, scaledDimensionsOf, v3TerrainGrid } from '../elevation';
import { TERRAIN_FIXTURES, type TerrainFixtureName } from '../parity/terrain';

const r = (v: number) => Math.round(v * 100) / 100;
const footprintRing = (o: V3SceneObject, offset: number) => {
  const [w, , d] = scaledDimensionsOf(o), [x, , z] = o.transform.position, pts: [number, number][] = [];
  for (let t = 0; t <= 1.0001; t += .125) {
    pts.push([x - w / 2 - offset + (w + 2 * offset) * t, z - d / 2 - offset], [x - w / 2 - offset + (w + 2 * offset) * t, z + d / 2 + offset]);
    pts.push([x - w / 2 - offset, z - d / 2 - offset + (d + 2 * offset) * t], [x + w / 2 + offset, z - d / 2 - offset + (d + 2 * offset) * t]);
  }
  return pts;
};

export function measureTerrainSite(scene: V3Scene) {
  const terrain = buildV3TerrainSurface(scene), h = terrain.heightAt, grid = v3TerrainGrid(scene), grading = terrain.grading!, nat = grading.natural;
  // 1. Mesh continuity: steepest triangle, spikes and site-edge lip.
  let steepest = 0;
  for (let i = 0; i < terrain.vertices.length; i += 9) {
    const ys = [terrain.vertices[i + 1], terrain.vertices[i + 4], terrain.vertices[i + 7]];
    // Horizontal extent of the triangle (feature-line slivers are a few cm wide by design).
    const xs = [terrain.vertices[i], terrain.vertices[i + 3], terrain.vertices[i + 6]], zs = [terrain.vertices[i + 2], terrain.vertices[i + 5], terrain.vertices[i + 8]];
    const run = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    if (run > .5) steepest = Math.max(steepest, (Math.max(...ys) - Math.min(...ys)) / run);
  }
  // Unretained grade steps: any mesh cell rising ≥ 0.6 m steeper than 45° that is not a natural cliff,
  // a pool shell, or within one mesh cell of a derived or authored retaining wall (the mesh cannot be vertical).
  const model0 = compileV3Scene(scene);
  const wallLines = [
    ...grading.walls.flatMap(w => { const pts = [w.start, ...w.samples.map(x => x.at), w.end]; return pts.slice(1).map((p, i) => [pts[i], p] as const); }),
    ...scene.objects.filter(o => o.type === 'retaining-wall').map(o => { const [w, , d] = scaledDimensionsOf(o), [x, , z] = o.transform.position; return w >= d ? [[x - w / 2, z], [x + w / 2, z]] as const : [[x, z - d / 2], [x, z + d / 2]] as const; }),
  ];
  const nearWall = (x: number, z: number) => wallLines.some(([a, b]) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t) < grid.step; });
  const nearPool = (x: number, z: number) => scene.objects.some(o => o.type === 'pool' && Math.abs(x - o.transform.position[0]) <= scaledDimensionsOf(o)[0] / 2 + .2 && Math.abs(z - o.transform.position[2]) <= scaledDimensionsOf(o)[2] / 2 + .2);
  const unretained: { at: [number, number]; rise: number }[] = [];
  for (let i = 0; i < terrain.vertices.length; i += 9) {
    const pts = [0, 3, 6].map(k => [terrain.vertices[i + k], terrain.vertices[i + k + 1], terrain.vertices[i + k + 2]]);
    for (const [a, b] of [[0, 1], [1, 2], [0, 2]]) {
      const rise = Math.abs(pts[a][1] - pts[b][1]), run = Math.hypot(pts[a][0] - pts[b][0], pts[a][2] - pts[b][2]);
      if (rise < .6 || rise < run) continue;
      const mx = (pts[a][0] + pts[b][0]) / 2, mz = (pts[a][2] + pts[b][2]) / 2, naturalRise = Math.abs(nat(pts[a][0], pts[a][2]) - nat(pts[b][0], pts[b][2]));
      if (naturalRise >= rise * .8 || nearPool(mx, mz) || nearWall(mx, mz)) continue;
      unretained.push({ at: [r(mx), r(mz)], rise: r(rise) });
    }
  }
  // Site-edge jump: a lip in the last metre at the boundary, beyond the natural ground's own trend.
  let edgeJump = 0, edgeJumpAt: number[] = [];
  // Graded corridors (and their walls' mesh cell) that reach the boundary are grading on purpose, not a lip.
  const inCorridor = (x: number, z: number) => grading.connections.some(c => c.graded && c.profile.some(p => Math.hypot(p[0] - x, p[2] - z) < c.halfWidth + grid.step * 2.45 + 1));
  for (let t = -.45; t <= .45; t += .05) for (const [ex, ez, ix, iz] of [[t * scene.site.width, -scene.site.depth / 2, t * scene.site.width, -scene.site.depth / 2 + 1], [t * scene.site.width, scene.site.depth / 2, t * scene.site.width, scene.site.depth / 2 - 1], [-scene.site.width / 2, t * scene.site.depth, -scene.site.width / 2 + 1, t * scene.site.depth], [scene.site.width / 2, t * scene.site.depth, scene.site.width / 2 - 1, t * scene.site.depth]]) {
    if (!inCorridor(ex, ez) && Math.abs((h(ex, ez) - h(ix, iz)) - (nat(ex, ez) - nat(ix, iz))) > edgeJump) edgeJumpAt = [r(ex), r(ez)];
    if (!inCorridor(ex, ez)) edgeJump = Math.max(edgeJump, Math.abs((h(ex, ez) - h(ix, iz)) - (nat(ex, ez) - nat(ix, iz))));
  }
  let edgeLip = 0;
  for (let t = -.45; t <= .45; t += .05) for (const [ex, ez, ix, iz] of [[t * scene.site.width, -scene.site.depth / 2, t * scene.site.width, -scene.site.depth / 2 + 6], [t * scene.site.width, scene.site.depth / 2, t * scene.site.width, scene.site.depth / 2 - 6]])
    edgeLip = Math.max(edgeLip, Math.abs(h(ex, ez) - h(ix, iz)));
  // Interior seams: compare each 1 m step along the fall line with the local trend.
  let seam = 0;
  for (let x = -scene.site.width * .4; x <= scene.site.width * .4; x += 10) for (let z = -scene.site.depth / 2 + 8; z < scene.site.depth / 2 - 8; z += 1) {
    const second = h(x, z - 1) - 2 * h(x, z) + h(x, z + 1); seam = Math.max(seam, Math.abs(second));
  }
  // 2. Masses: terrain 1 m outside the footprint vs the mass base.
  const masses = scene.objects.filter(o => o.type === 'building-mass').map(o => {
    const base = getObjectBaseY(o), ring = footprintRing(o, 1).map(([x, z]) => h(x, z) - base);
    return { id: o.id, base: r(base), terrainAbove: r(Math.max(0, ...ring)), terrainBelow: r(Math.max(0, ...ring.map(v => -v))), grounding: o.support?.grounding ?? 'grounded' };
  });
  // 3. Connections: the compiled ribbon (minus its .055 surfacing) vs the graded terrain, sampled inside every triangle.
  const { hierarchy } = resolveSiteHierarchy(scene);
  const connections = hierarchy.connections.map(c => {
    const ribbon = model0.primitives.find(p => p.id === `v3-connection-${c.id}`), g = grading.connections.find(x => x.id === c.id)!;
    let float = 0, bury = 0, worst: number[] = [];
    if (ribbon?.kind === 'triMesh') for (let i = 0; i < ribbon.vertices.length; i += 9) for (const [wa, wb, wc] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1 / 3, 1 / 3, 1 / 3], [.5, .5, 0], [0, .5, .5], [.5, 0, .5]]) {
      const v = (k: number) => wa * ribbon.vertices[i + k] + wb * ribbon.vertices[i + 3 + k] + wc * ribbon.vertices[i + 6 + k];
      const d = v(1) - .055 - h(v(0), v(2)); if (Math.abs(d) > Math.max(float, bury)) worst = [r(v(0)), r(v(2))]; float = Math.max(float, d); bury = Math.max(bury, -d);
    }
    return { id: c.id, type: c.type, graded: g.graded, ...(g.reason ? { reason: g.reason } : {}), maxFloat: r(float), maxBury: r(bury), worstAt: worst, profileGrade: r(g.maxGrade), maxCut: r(g.maxCut), maxFill: r(g.maxFill) };
  });
  // 4. Pools: rim vs surrounding terrain/deck; shell exposure below.
  const pools = scene.objects.filter(o => o.type === 'pool').map(o => {
    const rim = getObjectTopY(o), base = getObjectBaseY(o), ring = footprintRing(o, .6).map(([x, z]) => h(x, z));
    const deck = scene.objects.find(d => d.type === 'terrace' && d.id !== o.id && Math.abs(d.transform.position[0] - o.transform.position[0]) < scaledDimensionsOf(d)[0] / 2 && Math.abs(d.transform.position[2] - o.transform.position[2]) < scaledDimensionsOf(d)[2] / 2);
    return { id: o.id, rim: r(rim), deckTop: deck ? r(getObjectTopY(deck)) : null, terrainAboveRim: r(Math.max(0, ...ring.map(g => g - rim))), terrainBelowRim: r(Math.max(0, ...ring.map(g => rim - g))), terrainBelowShellBottom: r(Math.max(0, ...ring.map(g => base - g))) };
  });
  // 5. Level steps: grade difference across each level edge, and whether a retaining wall sits there.
  const walls = scene.objects.filter(o => o.type === 'retaining-wall');
  const levelEdges = hierarchy.levels.filter(l => l.supportType !== 'terrain').flatMap(l => {
    const { x, z, width, depth } = l.region;
    return ([['north', x, z - depth / 2, 0, -1], ['south', x, z + depth / 2, 0, 1], ['west', x - width / 2, z, -1, 0], ['east', x + width / 2, z, 1, 0]] as const).map(([side, ex, ez, nx, nz]) => {
      const inside = h(ex - nx * 1.2, ez - nz * 1.2), outside = h(ex + nx * 3, ez + nz * 3), drop = inside - outside;
      const retained = grading.walls.some(w => w.levelId === l.id && w.side === side) || walls.some(w => Math.hypot(w.transform.position[0] - ex, w.transform.position[2] - ez) < Math.max(...scaledDimensionsOf(w)) / 2 + 1.5);
      return { level: l.id, side, step: r(drop), retained };
    }).filter(e => Math.abs(e.step) >= .6);
  });
  const model = model0, compiled = validateV3CompiledGeometry(scene, model, { lenient: true });
  const issues = auditV3SiteHierarchy(scene).map(i => `${i.severity}:${i.code}:${i.targetId}`);
  const walls3 = walls.map(w => ({ id: w.id, segments: model.primitives.filter(p => p.id === w.id || p.id.startsWith(w.id + '-')).length, heights: [...new Set(model.primitives.filter(p => p.id === w.id || p.id.startsWith(w.id + '-')).map(p => p.kind === 'box' ? r(p.size[1]) : 0))] }));
  const derivedWalls = grading.walls.map(w => ({ id: w.id, kind: w.kind, length: r(Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1])), maxHeight: r(w.maxHeight) }));
  const ocean = model.primitives.find(p => p.id === 'v3-ocean-water');
  return { fixture: scene.metadata?.fixture, mesh: { step: r(grid.step), steepestTriangleGrade: r(steepest), siteEdgeLip: r(edgeLip), siteEdgeJump: r(edgeJump), edgeJumpAt, maxCurvature: r(seam) }, unretainedSteps: unretained.slice(0, 8), unretainedCount: unretained.length, derivedWalls, ocean: ocean?.kind === 'triMesh' ? r(ocean.vertices[1]) : null, masses, connections, pools, levelEdges, walls: walls3, issues, compiled: { ok: compiled.ok, errors: compiled.errors, warnings: compiled.warnings.length } };
}

/** Locality is judged on the analytic graded surface: the mesh re-cuts whole grid lines when a pad edge moves. */
const sampleGrid = (scene: V3Scene, step = 2) => {
  const h = createV3TerrainSampler(scene).gradedAt, out: [number, number, number][] = [];
  for (let x = -scene.site.width / 2; x <= scene.site.width / 2; x += step) for (let z = -scene.site.depth / 2; z <= scene.site.depth / 2; z += step) out.push([x, z, h(x, z)]);
  return out;
};
/** Fraction of terrain samples that changed, and their bounding box. */
export function terrainDiff(a: V3Scene, b: V3Scene) {
  const A = sampleGrid(a), B = sampleGrid(b), changed = A.filter((p, i) => Math.abs(p[2] - B[i][2]) > .02);
  const xs = changed.map(p => p[0]), zs = changed.map(p => p[1]);
  return { changedFraction: r(changed.length / A.length), bbox: changed.length ? [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)] : null };
}
const clone = (s: V3Scene): V3Scene => JSON.parse(JSON.stringify(s));
const moveArch = (o: V3SceneObject, dz: number, dy: number) => {
  o.architecture = { ...o.architecture!, z: o.architecture!.z + dz, baseElevation: o.architecture!.baseElevation + dy };
  o.transform.position = [o.transform.position[0], o.transform.position[1] + dy, o.transform.position[2] + dz];
};

const errorsFor = (s: V3Scene, ids: (id: string) => boolean) => auditV3SiteHierarchy(s).filter(i => i.severity === 'error' && ids(i.targetId)).map(i => `${i.code}:${i.targetId}`);
const objectBase = (s: V3Scene, id: string) => getObjectBaseY(compileEffective(s).find(o => o.id === id)!);
import { effectiveV3Scene } from '../derivedSupport';
import { normalizeV3GenerationOutput } from '../generation';
import { v3SceneOutputSchema } from '../schema';
const compileEffective = (s: V3Scene) => effectiveV3Scene(s).objects;
const bboxWithin = (bbox: number[] | null, region: number[]) => !bbox || (bbox[0] >= region[0] && bbox[1] >= region[1] && bbox[2] <= region[2] && bbox[3] <= region[3]);

describe('V3 graded site v1 (offline audit + acceptance)', () => {
  const results = Object.fromEntries((Object.keys(TERRAIN_FIXTURES) as TerrainFixtureName[]).map(name => [name, measureTerrainSite(TERRAIN_FIXTURES[name]())]));

  it('compiles every site type to finite geometry', () => {
    for (const result of Object.values(results)) expect(result.compiled.errors).toEqual([]);
  });

  it('records measured site findings', () => {
    // Printed so the audit report can cite exact figures.
    console.log(JSON.stringify(results, null, 1));
    expect(Object.keys(results)).toHaveLength(5);
  });

  it.each(Object.keys(TERRAIN_FIXTURES))('%s: no site-edge jump and no unretained grade step ≥ 0.6 m', (name) => {
    expect(results[name].mesh.siteEdgeJump).toBeLessThanOrEqual(.1);
    expect(results[name].unretainedSteps).toEqual([]);
  });

  it.each(Object.keys(TERRAIN_FIXTURES))('%s: driveways are graded and stay within 0.15 m of the graded surface', (name) => {
    for (const c of results[name].connections.filter(c => c.type === 'driveway')) {
      expect(c.graded, c.id).toBe(true);
      expect(c.maxFloat, c.id).toBeLessThanOrEqual(.15);
      expect(c.maxBury, c.id).toBeLessThanOrEqual(.15);
      expect(c.profileGrade, c.id).toBeLessThanOrEqual(.15 + 1e-6);
    }
  });

  it.each(Object.keys(TERRAIN_FIXTURES))('%s: no pool or deck support errors; terrain never enters the pool shell', (name) => {
    const scene = TERRAIN_FIXTURES[name as TerrainFixtureName]();
    const decks = new Set(scene.objects.filter(o => o.type === 'pool' || o.type === 'terrace').map(o => o.id));
    expect(results[name].issues.filter(i => i.startsWith('error') && decks.has(i.split(':').at(-1)!))).toEqual([]);
    for (const pool of results[name].pools) expect(pool.terrainAboveRim, pool.id).toBe(0);
  });

  it('flat and gentle sites have no errors at all', () => {
    for (const name of ['flat', 'gentle']) expect(results[name].issues.filter(i => i.startsWith('error'))).toEqual([]);
  });

  it('cliff: a real natural drop, with an independent sea plane below it', () => {
    const cliff = TERRAIN_FIXTURES.cliff(), h = buildV3TerrainSurface(cliff).heightAt;
    expect(h(0, 15) - h(0, 40)).toBeGreaterThan(25);
    expect(results.cliff.ocean).toBe(-32);
    expect(h(0, 50)).toBeLessThan(-32);
    // Sea level never shapes terrain.
    const raised = clone(cliff); raised.site.sea = { level: -10 };
    expect(terrainDiff(cliff, raised).changedFraction).toBe(0);
  });

  it('AI authors only high-level natural ground: flat fields normalize into the runtime model', () => {
    const site = { width: 120, depth: 120, naturalFall: 'z', naturalGrade: .2, cliffAt: 30, cliffDrop: 25, seaLevel: -30 };
    expect(v3SceneOutputSchema.shape.site.safeParse(site).success).toBe(true);
    const { scene } = normalizeV3GenerationOutput({ version: 3, site, siteHierarchy: { levels: [{ id: 'pad', elevation: 0, region: { x: 0, z: 0, width: 10, depth: 10 }, supportType: 'pad' }], connections: [], transitions: [] }, objects: [], relationships: [] });
    expect(scene.site.naturalGround).toEqual({ fall: 'z', grade: .2, cliff: { at: 30, drop: 25 } });
    expect(scene.site.sea).toEqual({ level: -30 });
  });

  it('retaining walls carry stable derived ids', () => {
    const ids = (s: V3Scene) => createV3TerrainSampler(s).grading.walls.map(w => w.id);
    expect(ids(TERRAIN_FIXTURES.hillside())).toEqual(ids(TERRAIN_FIXTURES.hillside()));
    expect(new Set(ids(TERRAIN_FIXTURES.hillside())).size).toBe(ids(TERRAIN_FIXTURES.hillside()).length);
  });

  describe('terrace dependants and locality (hillside)', () => {
    const hill = TERRAIN_FIXTURES.hillside();
    it('raising the pool terrace moves its deck and pool, and only its own grading', () => {
      const s = clone(hill); s.siteHierarchy!.levels.find(l => l.id === 'pool-terrace')!.elevation += 1;
      expect(objectBase(s, 'pool-deck') - objectBase(hill, 'pool-deck')).toBeCloseTo(1, 6);
      expect(objectBase(s, 'pool') - objectBase(hill, 'pool')).toBeCloseTo(1, 6);
      for (const id of ['upper-wing', 'lower-wing', 'garden-west', 'arrival-court']) expect(objectBase(s, id)).toBe(objectBase(hill, id));
      expect(errorsFor(s, id => ['pool', 'pool-deck'].includes(id))).toEqual([]);
      // pool-terrace region x -13..13, z 12.5..21.5 plus batter / wall margin.
      expect(bboxWithin(terrainDiff(hill, s).bbox, [-20, 6, 20, 30])).toBe(true);
    });
    it('moving a building does not reshape terrain', () => {
      const s = clone(hill); for (const o of s.objects.filter(o => o.type === 'building-mass')) moveArch(o, -4, 1);
      expect(terrainDiff(hill, s).changedFraction).toBe(0);
    });
    it('rerouting the driveway re-grades only its old and new corridors', () => {
      const s = clone(hill); s.siteHierarchy!.connections[0].route = [[-45, 14, -57], [40, 9, -51], [44, 8, -39], [14, 4, -31], [0, 2.2, -26]];
      const diff = terrainDiff(hill, s);
      expect(diff.changedFraction).toBeGreaterThan(0);
      expect(bboxWithin(diff.bbox, [-60, -60, 60, -14])).toBe(true);
      const g = measureTerrainSite(s).connections.find(c => c.id === 'drive')!;
      expect(g.maxFloat).toBeLessThanOrEqual(.15); expect(g.maxBury).toBeLessThanOrEqual(.15);
    });
    it('pool terrace edits do not move landscape zones', () => {
      const s = clone(hill); const l = s.siteHierarchy!.levels.find(l => l.id === 'pool-terrace')!; l.region.width += 10;
      const d = s.objects.find(o => o.id === 'pool-deck')!; d.architecture = { ...d.architecture!, width: d.architecture!.width + 10 };
      expect(objectBase(s, 'garden-west')).toBe(objectBase(hill, 'garden-west'));
      expect(bboxWithin(terrainDiff(hill, s).bbox, [-25, 6, 25, 30])).toBe(true);
    });
  });
});
