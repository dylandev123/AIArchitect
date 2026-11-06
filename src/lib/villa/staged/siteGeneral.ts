/**
 * Orientation-general Stage 5 site derivation (automatic generation, `staged-site-2`).
 *
 * Terra supplies only design intent (`siteDesignV2Schema`). Software measures the accepted Stage 4 house and
 * derives every coordinate. It reuses the methods proven on the Breezeway villa (`site.ts`: measured pool
 * envelope, terrace remnants by rectangle difference, disjoint paving, full-crown tree clearance, lawn masks,
 * fixtures fitted between real door routes) but has no fixed coordinates or fixed orientation.
 *
 * The garden side is decided by the house itself: the retained pool intention, else the main veranda, else
 * the living room. Derivation runs in a frame where that garden faces +z, then maps back. Unsupported or
 * contradictory compositions return findings; nothing in the accepted house is moved or removed.
 */
import {allRooms, blockRect, overlapArea, rectDiff, roomSideInterval, sideLine, snap, type R} from './layout';
import {exteriorWalls} from './exterior';
import {outdoorKind} from './intentions';
import {poolWaterNorth} from './poolGeometry';
import {POOL_SCALES, siteDesignV2Schema, type SiteDesignV2} from './siteContract';
import type {HouseSpec, Side} from './spec';
import {poolFootprint, verandaRect, type Finding} from './validate';
import {fromRect, mergeSiteRectangles, toRect} from './site';
import {poolRequirement} from './requirements';

const finding = (code: string, subject: string, message: string): Finding => ({stage: 5, code, subject, message});
const inflate = (r: R, m: number): R => ({x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m});
const contains = (a: R, b: R) => b.x0 >= a.x0 - 1e-5 && b.x1 <= a.x1 + 1e-5 && b.z0 >= a.z0 - 1e-5 && b.z1 <= a.z1 + 1e-5;
const hit = (a: R, bs: R[]) => bs.some(b => overlapArea(a, b) > .001);
const r0 = (v: number) => Math.max(0, v);
const width = (r: R) => r.x1 - r.x0, depth = (r: R) => r.z1 - r.z0;
const union = (rs: R[]): R => ({x0: Math.min(...rs.map(r => r.x0)), x1: Math.max(...rs.map(r => r.x1)), z0: Math.min(...rs.map(r => r.z0)), z1: Math.max(...rs.map(r => r.z1))});
const OUT: Record<Side, [number, number]> = {n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0]};

/** Quarter-turn frame in which the garden faces +z. Rectangles stay axis-aligned. */
export function gardenFrame(g: Side) {
  const fwd = (x: number, z: number): [number, number] => g === 's' ? [x, z] : g === 'n' ? [-x, -z] : g === 'e' ? [-z, x] : [z, -x];
  const back = (x: number, z: number): [number, number] => g === 's' ? [x, z] : g === 'n' ? [-x, -z] : g === 'e' ? [z, -x] : [-z, x];
  const map = (f: typeof fwd) => (r: R): R => { const [a, b] = f(r.x0, r.z0), [c, d] = f(r.x1, r.z1); return {x0: Math.min(a, c), x1: Math.max(a, c), z0: Math.min(b, d), z1: Math.max(b, d)}; };
  const side = (s: Side): Side => { const [x, z] = fwd(...OUT[s]); return x > .5 ? 'e' : x < -.5 ? 'w' : z > .5 ? 's' : 'n'; };
  return {toLocal: map(fwd), toWorld: map(back), point: back, side};
}

/** Exterior-door clearances on every side (furniture and planting must leave them free). */
export function doorClearances(spec: HouseSpec): {id: string; rect: R; landing: R}[] {
  const rooms = allRooms(spec);
  return spec.exterior.doors.flatMap(d => {
    const room = rooms.find(r => r.id === d.room);
    if (!room || room.level !== 0) return [];
    const b = spec.blocks.find(x => x.id === room.block)!, br = blockRect(b), iv = roomSideInterval(room, br, d.side);
    if (!iv) return [];
    const c = Math.min(iv[1] - d.width / 2 - .6, Math.max(iv[0] + d.width / 2 + .6, iv[0] + d.t * (iv[1] - iv[0]))), line = sideLine(br, d.side);
    const reach = spec.exterior.verandas.some(v => v.block === b.id && v.side === d.side && c > v.from && c < v.to) ? 4.5 : 3, [ox, oz] = OUT[d.side];
    const half = d.width / 2 + .3, a = line, e = line + (ox + oz) * reach, l = line + (ox + oz) * 2;
    const box = (p: number, q: number): R => ox ? {x0: Math.min(p, q), x1: Math.max(p, q), z0: c - half, z1: c + half} : {x0: c - half, x1: c + half, z0: Math.min(p, q), z1: Math.max(p, q)};
    return [{id: d.id, rect: box(a, e), landing: box(a, l)}];
  });
}

/** Measured fixed context for the general site: building, covered/open outdoor spaces, arrival court. */
export function siteContext(spec: HouseSpec) {
  const blocks = spec.blocks.filter(b => b.level === 0).map(b => ({id: b.id, rect: blockRect(b)}));
  const verandas = spec.exterior.verandas.map(v => ({id: v.id, side: v.side, rect: verandaRect(spec, v.id)!}));
  const pools = spec.openSpaces.filter(o => outdoorKind(o) === 'pool');
  const terraces = spec.openSpaces.filter(o => outdoorKind(o) !== 'pool' && !verandas.some(v => v.id === o.id)).map(o => ({id: o.id, rect: fromRect({x: o.cx, z: o.cz, w: o.w, d: o.d})}));
  const main = spec.exterior.doors.find(d => d.id === spec.exterior.entrance.door);
  const court = (() => {
    const room = main && allRooms(spec).find(r => r.id === main.room); if (!main || !room) return undefined;
    const br = blockRect(spec.blocks.find(b => b.id === room.block)!), iv = roomSideInterval(room, br, main.side); if (!iv) return undefined;
    const c = Math.min(iv[1] - main.width / 2 - .6, Math.max(iv[0] + main.width / 2 + .6, iv[0] + main.t * (iv[1] - iv[0]))), line = sideLine(br, main.side), [ox, oz] = OUT[main.side], {w, d} = spec.exterior.entrance.court;
    const a = line, e = line + (ox + oz) * d;
    return ox ? {x0: Math.min(a, e), x1: Math.max(a, e), z0: c - w / 2, z1: c + w / 2} : {x0: c - w / 2, x1: c + w / 2, z0: Math.min(a, e), z1: Math.max(a, e)};
  })();
  const site = {x0: -spec.site.width / 2, x1: spec.site.width / 2, z0: -spec.site.depth / 2, z1: spec.site.depth / 2};
  return {blocks, verandas, pools, terraces, court, entranceSide: main?.side, doors: doorClearances(spec), site};
}

/** Garden side and its anchor, decided by accepted architecture (never by a fixed template). */
export function gardenAnchor(spec: HouseSpec, prefer: SiteDesignV2['pool']['anchor'] = 'pool-intention'): {side: Side; rect: R; source: string} | undefined {
  const ctx = siteContext(spec), pool = ctx.pools[0];
  const living = () => {
    const walls = exteriorWalls(spec).filter(w => w.type === 'living' && w.level === 0 && w.side !== ctx.entranceSide).sort((a, b) => b.free - a.free)[0];
    const room = walls && allRooms(spec).find(r => r.id === walls.room);
    if (!walls || !room) return undefined;
    const line = sideLine(blockRect(spec.blocks.find(b => b.id === room.block)!), walls.side), [ox] = OUT[walls.side];
    return {side: walls.side, rect: ox ? {x0: line - .01, x1: line + .01, z0: room.z0, z1: room.z1} : {x0: room.x0, x1: room.x1, z0: line - .01, z1: line + .01}, source: `living room ${room.id}`};
  };
  const veranda = () => { const v = [...ctx.verandas].sort((a, b) => width(b.rect) * depth(b.rect) - width(a.rect) * depth(a.rect))[0]; return v && {side: v.side, rect: v.rect, source: `veranda ${v.id}`}; };
  const intention = () => pool && {side: pool.side, rect: fromRect({x: pool.cx, z: pool.cz, w: pool.w, d: pool.d}), source: `pool intention ${pool.id}`};
  const order = prefer === 'veranda' ? [veranda, intention, living] : prefer === 'living-room' ? [living, intention, veranda] : [intention, veranda, living];
  for (const f of order) { const a = f(); if (a) return a; }
  return undefined;
}

/** Edge contact of at least 1 m (the dry-route rule), or overlap. */
const sharesEdge = (a: R, b: R) => overlapArea(a, b) > .001 || ((Math.abs(a.x0 - b.x1) < .002 || Math.abs(a.x1 - b.x0) < .002) && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) >= .998) || ((Math.abs(a.z0 - b.z1) < .002 || Math.abs(a.z1 - b.z0) < .002) && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) >= .998);

/**
 * Turn-penalised shortest path on a 0.5 m grid, from inside the court to any goal surface, keeping a 1.5 m walk
 * (plus 0.3 m clearance) off every blocked rectangle and inside the property. Returns one rectangle per straight run.
 */
export function routeWalk(start: R, goals: R[], blocked: R[], bounds: R, walk = 1.5): R[] | undefined {
  const step = .5, half = walk / 2, nx = Math.floor((bounds.x1 - bounds.x0) / step), nz = Math.floor((bounds.z1 - bounds.z0) / step);
  const cx = (i: number) => bounds.x0 + (i + .5) * step, cz = (j: number) => bounds.z0 + (j + .5) * step;
  const keepOut = blocked.map(r => inflate(r, half + .3));
  const free = (i: number, j: number) => { const x = cx(i), z = cz(j); return x - half >= bounds.x0 && x + half <= bounds.x1 && z - half >= bounds.z0 && z + half <= bounds.z1 && !keepOut.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1); };
  const inR = (r: R, i: number, j: number) => cx(i) > r.x0 && cx(i) < r.x1 && cz(j) > r.z0 && cz(j) < r.z1;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]], key = (i: number, j: number, d: number) => (j * nx + i) * 4 + d;
  const dist = new Map<number, number>(), prev = new Map<number, number>(), queue: [number, number, number, number][] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) if (inR(start, i, j) && free(i, j)) for (let d = 0; d < 4; d++) { dist.set(key(i, j, d), 0); queue.push([0, i, j, d]); }
  let end: number | undefined;
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [c, i, j, d] = queue.shift()!, k = key(i, j, d);
    if (c > (dist.get(k) ?? Infinity)) continue;
    if (goals.some(g => inR(g, i, j))) { end = k; break; }
    for (let e = 0; e < 4; e++) {
      const a = i + DIRS[e][0], b = j + DIRS[e][1];
      if (a < 0 || b < 0 || a >= nx || b >= nz || !free(a, b)) continue;
      const nk = key(a, b, e), nc = c + 1 + (e === d ? 0 : 8);
      if (nc < (dist.get(nk) ?? Infinity)) { dist.set(nk, nc); prev.set(nk, k); queue.push([nc, a, b, e]); }
    }
    if (queue.length > 200000) return undefined;
  }
  if (end === undefined) return undefined;
  const cells: [number, number][] = [];
  for (let k: number | undefined = end; k !== undefined; k = prev.get(k)) { const c = Math.floor(k / 4); cells.unshift([c % nx, Math.floor(c / nx)]); }
  // Split the cell path into straight runs; consecutive runs share their corner cell, so they overlap.
  const runs: R[] = [], box = (seg: [number, number][]): R => ({x0: Math.min(...seg.map(c => cx(c[0]))) - half, x1: Math.max(...seg.map(c => cx(c[0]))) + half, z0: Math.min(...seg.map(c => cz(c[1]))) - half, z1: Math.max(...seg.map(c => cz(c[1]))) + half});
  let from = 0;
  for (let t = 2; t < cells.length; t++) {
    const horizontal = (u: number) => cells[u][1] === cells[u - 1][1];
    if (horizontal(t) !== horizontal(from + 1)) { runs.push(box(cells.slice(from, t))); from = t - 1; }
  }
  runs.push(box(cells.slice(from)));
  return runs.filter(r => width(r) > .05 && depth(r) > .05);
}

export interface SiteDerivation {spec: HouseSpec; findings: Finding[]; adjustments: string[]}

/**
 * Tries the pool at its nearest valid position first, then set back from the house in 1.5 m steps (up to 4.5 m),
 * accepting the first fully valid composition. The setback, if any, is recorded as an adjustment.
 */
export function deriveSiteGeneral(base: HouseSpec, input: unknown, brief = ''): SiteDerivation {
  let first: SiteDerivation | undefined;
  for (const setback of [0, 1.5, 3, 4.5]) {
    const r = deriveAt(base, input, brief, setback);
    if (!r.findings.length) return setback ? {...r, adjustments: [`Pool set back ${setback} m from the house so the terrace furniture fits.`, ...r.adjustments]} : r;
    first ??= r;
    // Only furniture/terrace fit can improve with distance; contract, intention and route problems cannot.
    if (!r.findings.every(f => /clearance|support/.test(f.code))) break;
  }
  return first!;
}

function deriveAt(base: HouseSpec, input: unknown, brief: string, setback: number): SiteDerivation {
  const parsed = siteDesignV2Schema.safeParse(input);
  if (!parsed.success) return {spec: base, findings: [finding('site-design-schema', 'design', parsed.error.message)], adjustments: []};
  const d = parsed.data, findings: Finding[] = [], adjustments: string[] = [];
  if (d.statement.length > 900 || d.intentions.length > 6 || d.intentions.some(s => s.length > 250)) return {spec: base, findings: [finding('site-text-budget', 'design', 'Statement must be <=900 chars; at most six intentions <=250 chars each.')], adjustments};
  const ctx = siteContext(base), intent = ctx.pools[0];
  if (ctx.pools.length > 1) findings.push(finding('pool-intentions', 'pool', 'Only one swimming pool is supported; the massing declared several pool intentions.'));
  if (!ctx.court || !ctx.entranceSide) findings.push(finding('site-entrance', 'entrance', 'The accepted house has no constructed entrance court.'));
  const wantsPool = d.pool.scale !== 'none', required = brief ? poolRequirement(brief) : 'optional';
  // A brief that excludes a pool overrides a massing pool reservation; otherwise "none" may not discard it.
  if (!wantsPool && intent && required !== 'excluded') findings.push(finding('pool-intention-dropped', intent.id, `Massing retained pool intention ${intent.id}; scale none would silently discard it.`));
  if (!wantsPool && required === 'required') findings.push(finding('pool-required', 'pool', 'The brief asks for a pool; pool scale none is not permitted.'));
  if (wantsPool && required === 'excluded') findings.push(finding('pool-excluded', 'pool', 'The brief excludes a swimming pool; choose pool scale none.'));
  if (d.pool.anchor === 'pool-intention' && wantsPool && !intent) findings.push(finding('pool-anchor', 'pool', 'Pool anchor pool-intention was chosen, but the massing has no pool intention; use veranda or living-room.'));
  const anchor = gardenAnchor(base, d.pool.anchor);
  if (!anchor) findings.push(finding('garden-side', 'site', 'No veranda, pool intention or living-room exterior wall identifies a garden side.'));
  if (findings.length) return {spec: base, findings, adjustments};
  const F = gardenFrame(anchor!.side), L = F.toLocal, W = F.toWorld;
  const site = L(ctx.site), inner = inflate(site, -1), court = L(ctx.court!), arrival = F.side(ctx.entranceSide!);
  const blocks = ctx.blocks.map(b => L(b.rect)), verandas = ctx.verandas.map(v => L(v.rect)), terraces = ctx.terraces.map(t => L(t.rect)), doors = ctx.doors.map(x => L(x.rect)), landings = ctx.doors.map(x => L(x.landing));
  const house = union([...blocks, ...verandas, ...terraces]), a = L(anchor!.rect);
  const fixed = [...blocks, ...verandas, ...terraces, court];

  // ---- Pool: measured envelope, centred on the anchor, clear of the house front; slid only along the facade. ----
  let env: R | undefined, pool: HouseSpec['siteWork']['pool'] | undefined;
  if (wantsPool) {
    const [long, short] = POOL_SCALES[d.pool.scale as keyof typeof POOL_SCALES], gap = d.pool.separation === 'close' ? .6 : 1.2;
    // The assembly's deck is 1.6 m at its sides (world x) and 2.2 m at its ends (world z); rotation changes which is which.
    const alongX = anchor!.side === 'n' || anchor!.side === 's', ew = alongX ? long + 3.2 : long + 4.4, ed = alongX ? short + 4.4 : short + 3.2, cx = (a.x0 + a.x1) / 2;
    for (const off of Array.from({length: 61}, (_, i) => (i % 2 ? 1 : -1) * Math.ceil(i / 2) * .5)) {
      const x0 = cx + off - ew / 2, x1 = x0 + ew;
      // A pool reservation IS the pool's place: start at its host wall (its inner edge), not beyond it.
      // Veranda/living anchors start beyond their outer edge. Built architecture in the way always wins.
      const front = setback + Math.max(anchor!.source.startsWith('pool intention') ? a.z0 : a.z1, ...fixed.filter(r => Math.min(r.x1, x1) - Math.max(r.x0, x0) > .01 && r.z0 < house.z1 + .01).map(r => r.z1));
      const c = {x0, x1, z0: front + gap, z1: front + gap + ed};
      // Decks are walkable, so a door may open onto them; only the water must stay out of a door's path.
      const water = {x0: c.x0 + (alongX ? 1.6 : 2.2), x1: c.x1 - (alongX ? 1.6 : 2.2), z0: c.z0 + (alongX ? 2.2 : 1.6), z1: c.z1 - (alongX ? 2.2 : 1.6)};
      if (contains(inflate(site, -.5), c) && !hit(c, fixed) && !hit(water, landings)) { env = c; if (off) adjustments.push(`Pool slid ${off.toFixed(1)} m along the garden facade to clear ${anchor!.source}'s neighbouring architecture.`); break; }
    }
    if (!env) return {spec: base, findings: [finding('pool-space', 'pool', `No ${d.pool.scale} pool (${ew.toFixed(1)} × ${ed.toFixed(1)} m with deck) fits beside ${anchor!.source}: only ${(site.z1 - .5 - house.z1).toFixed(1)} m of garden depth remains. Choose a smaller scale or close separation.`)], adjustments};
    const w = W(env);
    const [pw, pd] = alongX ? [long, short] : [short, long];
    pool = {x: snap((w.x0 + w.x1) / 2), z: snap(w.z0), w: pw, d: pd, basinDepth: 1.4};
    if (intent) {
      const r = fromRect({x: intent.cx, z: intent.cz, w: intent.w, d: intent.d}), e = poolFootprint(pool);
      const same = Math.max(Math.abs(e.x0 - r.x0), Math.abs(e.x1 - r.x1), Math.abs(e.z0 - r.z0), Math.abs(e.z1 - r.z1)) < .02;
      pool.sourceIntent = intent.id;
      if (!same) pool.intentResolution = `Stage 5 resolves conceptual reservation ${intent.id} (${intent.w}×${intent.d} m at ${intent.cx}, ${intent.cz}) as one ${d.pool.scale} ${pw}×${pd} m pool whose full deck envelope is ${(e.x1 - e.x0).toFixed(1)}×${(e.z1 - e.z0).toFixed(1)} m, centred at ${((e.x0 + e.x1) / 2).toFixed(1)}, ${((e.z0 + e.z1) / 2).toFixed(1)}; ${d.pool.separation} separation clears the accepted house front.`.slice(0, 500);
    }
  } else pool = undefined;

  // ---- Terrace: paved remnants between the house front and the pool envelope. ----
  const terraceZone: R = env
    // Sun decks of 4 m beside the pool envelope along the facade (the Breezeway terrace method, generalized):
    // wide enough for a 3.6 m four-seat dining group or a lounger row without moving the pool off its place.
    ? {x0: Math.max(inner.x0, Math.min(env.x0, a.x0) - 4), x1: Math.min(inner.x1, Math.max(env.x1, a.x1) + 4), z0: Math.max(inner.z0, Math.min(a.z0, house.z1 - .01)), z1: Math.min(inner.z1, env.z1 + .5)}
    : {x0: Math.max(inner.x0, a.x0 - 1.5), x1: Math.min(inner.x1, a.x1 + 1.5), z0: Math.max(inner.z0, a.z0), z1: Math.min(inner.z1, Math.max(a.z1, house.z1) + 4)};
  const paved: {id: string; r: R}[] = rectDiff(terraceZone, [...fixed, ...(env ? [env] : [])]).filter(r => width(r) > .3 && depth(r) > .3).map((r, i) => ({id: `terrace-${i + 1}`, r}));

  // ---- Arrival drive: straight from the court to the property boundary on the entrance side. ----
  const [ax, az] = OUT[arrival], cc = [(court.x0 + court.x1) / 2, (court.z0 + court.z1) / 2], half = 2.4;
  // An accepted open terrace lying on the entrance court across the full drive width is paved ground directly in front
  // of the door: it is the arrival forecourt, so the drive starts at its outer edge instead of crossing it. Enclosed
  // blocks, verandas and the pool are never treated this way.
  const across = (r: R) => ax ? [r.z0, r.z1] : [r.x0, r.x1], shared = (p: number[], q: number[]) => Math.min(p[1], q[1]) - Math.max(p[0], q[0]);
  const forecourt = terraces.filter(t => overlapArea(t, court) > .01 && shared(across(t), across(court)) >= 2 * half);
  const reach = forecourt.reduce((u, t) => ({x0: Math.min(u.x0, t.x0), x1: Math.max(u.x1, t.x1), z0: Math.min(u.z0, t.z0), z1: Math.max(u.z1, t.z1)}), court);
  const others = [...blocks, ...verandas, ...terraces.filter(t => !forecourt.includes(t)), ...(env ? [env] : [])];
  let drive: R | undefined;
  for (const shift of [0, -1, 1, -2, 2, -3, 3]) {
    const r = ax ? {x0: ax > 0 ? reach.x1 : site.x0, x1: ax > 0 ? site.x1 : reach.x0, z0: cc[1] + shift - half, z1: cc[1] + shift + half}
      : {x0: cc[0] + shift - half, x1: cc[0] + shift + half, z0: az > 0 ? reach.z1 : site.z0, z1: az > 0 ? site.z1 : reach.z0};
    if ((ax ? width(r) : depth(r)) < .05) { drive = undefined; break; }
    // Through a forecourt terrace, the drive must land fully on the terrace's outer edge.
    if (forecourt.length && !forecourt.some(t => shared(across(t), across(r)) >= 2 * half - .01)) continue;
    if (!hit(r, others)) { drive = r; break; }
  }
  if (drive && forecourt.length) adjustments.push(`Arrival drive ends at the outer edge of ${forecourt.map(t => ctx.terraces[terraces.indexOf(t)].id).join(', ')}, which covers the entrance court.`);
  if (!drive && (ax ? (ax > 0 ? site.x1 - reach.x1 : reach.x0 - site.x0) : (az > 0 ? site.z1 - reach.z1 : reach.z0 - site.z0)) > .05) return {spec: base, findings: [finding('arrival-space', 'driveway', 'No straight driveway from the property boundary reaches the entrance court without crossing the accepted house or pool.')], adjustments};
  if (drive) paved.push({id: 'arrival-drive', r: drive});

  // ---- Garden walk: shortest dry route (few turns) from the arrival court to the garden terrace. ----
  const terraceNear = paved.filter(p => p.id.startsWith('terrace-'));
  const walkGoals = [...terraceNear.map(t => t.r), ...verandas, ...terraces];
  if (walkGoals.length && !walkGoals.some(t => sharesEdge(t, court))) {
    const route = routeWalk(court, walkGoals, [...blocks, ...(env ? [env] : [])], inner);
    if (!route) return {spec: base, findings: [finding('garden-route', 'site', 'No dry garden walk fits between the arrival court and the garden terrace inside the property.')], adjustments};
    // Walks never pave over architecture: covered/open decks they cross are already dry surfaces.
    const cut = [...blocks, ...verandas, ...terraces, court, ...(env ? [env] : [])];
    route.forEach((r, i) => rectDiff(r, cut).filter(q => width(q) > .05 && depth(q) > .05).forEach((q, j) => paved.push({id: `garden-walk-${i + 1}${j ? `-${j + 1}` : ''}`, r: q})));
  }
  // Exact union without stacked slabs (the Breezeway method).
  const disjoint: {id: string; r: R}[] = [];
  for (const p of paved) for (const [i, r] of rectDiff(p.r, disjoint.map(x => x.r)).entries()) if (width(r) > .05 && depth(r) > .05) disjoint.push({id: i ? `${p.id}-${i + 1}` : p.id, r});
  if (disjoint.length > 16) return {spec: base, findings: [finding('site-path-budget', 'terraces', `${disjoint.length} hardscape patches exceed the sixteen-path construction budget.`)], adjustments};
  const hardLocal = [...fixed, ...(env ? [env] : []), ...disjoint.map(p => p.r), ...doors];

  // ---- Boundary planting: arrival frontage becomes a clipped hedge screen; other edges planted beds. ----
  const band = (s: Side, depthM: number): R => s === 'n' ? {x0: inner.x0, x1: inner.x1, z0: inner.z0, z1: inner.z0 + depthM} : s === 's' ? {x0: inner.x0, x1: inner.x1, z0: inner.z1 - depthM, z1: inner.z1}
    : s === 'w' ? {x0: inner.x0, x1: inner.x0 + depthM, z0: inner.z0 + 2.4, z1: inner.z1 - 2.4} : {x0: inner.x1 - depthM, x1: inner.x1, z0: inner.z0 + 2.4, z1: inner.z1 - 2.4};
  const cuts = hardLocal.map(h => inflate(h, .25));
  const bedSides = (['s', 'w', 'e', 'n'] as Side[]).filter(s => s !== arrival).slice(0, d.planting.beds === 'layered' ? 3 : 2);
  const boundaryBeds = bedSides.flatMap(s => rectDiff(band(s, d.planting.beds === 'layered' ? 2.6 : 2), cuts)).filter(r => width(r) * depth(r) > 2).sort((p, q) => width(q) * depth(q) - width(p) * depth(p)).slice(0, 6);
  // Foundation planting along exposed ground-floor walls (never across doors, decks, paving or the court).
  const fd = d.planting.beds === 'layered' ? 1.4 : 1.0, foundationCuts = [...verandas, ...terraces, court, ...(env ? [inflate(env, .3)] : []), ...disjoint.map(p => inflate(p.r, .25)), ...doors.map(x => inflate(x, .4)), ...boundaryBeds];
  const foundation = blocks.flatMap(b => [{x0: b.x0, x1: b.x1, z0: b.z0 - fd, z1: b.z0}, {x0: b.x0, x1: b.x1, z0: b.z1, z1: b.z1 + fd}, {x0: b.x0 - fd, x1: b.x0, z0: b.z0, z1: b.z1}, {x0: b.x1, x1: b.x1 + fd, z0: b.z0, z1: b.z1}])
    .flatMap(r => rectDiff(r, [...blocks, ...foundationCuts])).filter(r => Math.max(width(r), depth(r)) >= 3 && contains(inner, r))
    .sort((p, q) => width(q) * depth(q) - width(p) * depth(p));
  const bedRects: R[] = [...boundaryBeds];
  for (const r of foundation) if (bedRects.length < 10 && !hit(r, bedRects)) bedRects.push(r);
  const hedgeRects = rectDiff(band(arrival, 1.2), cuts).filter(r => Math.max(width(r), depth(r)) > 2.5).slice(0, 6);
  const plantedLocal = [...bedRects, ...hedgeRects];

  // ---- Trees: measured candidate slots, full-crown clearance (never shrunk below a credible tree). ----
  const count = {four: 4, six: 6, eight: 8, ten: 10}[d.planting.count], nominal = d.planting.stature === 'medium' ? 6.2 : 7.2;
  const slots: [number, number][] = [];
  if (d.arrival.character === 'tree-avenue' && drive) {
    const along = ax ? [drive.x0, drive.x1] : [drive.z0, drive.z1], off = 2.4 + nominal / 2 + .3;
    for (let t = along[0] + nominal / 2 + .5; t <= along[1] - nominal / 2; t += 7) for (const sgn of [-1, 1]) slots.push(ax ? [t, cc[1] + sgn * off] : [cc[0] + sgn * off, t]);
  }
  // Garden trees: farthest-point selection over every measured free position, so trees spread across the lawn
  // (not in boundary rows), favour the garden side and keep the pool's view axis from the house open.
  const fitAt = (x: number, z: number, placed: {x: number; z: number; h: number}[]) => {
    const blocked = [...hardLocal.map(r => inflate(r, .4)), ...plantedLocal.filter(p => Math.min(width(p), depth(p)) > 2.4), ...placed.map(t => ({x0: t.x - t.h / 2, x1: t.x + t.h / 2, z0: t.z - t.h / 2, z1: t.z + t.h / 2}))];
    return Math.min(x - site.x0, site.x1 - x, z - site.z0, site.z1 - z, ...blocked.map(r => Math.max(r.x0 - x, x - r.x1, r.z0 - z, z - r.z1)));
  };
  const viewAxis = env ? {x0: env.x0, x1: env.x1, z0: house.z1, z1: site.z1} : undefined;
  const treesLocal: {x: number; z: number; h: number}[] = [];
  const target = () => nominal + (d.planting.stature === 'varied-tall' ? (treesLocal.length % 3) * .6 : 0);
  const place = (x: number, z: number) => { const h = snap(Math.min(target(), 2 * fitAt(x, z, treesLocal) - .02)); if (h < 5) return false; if (h < target() - .02) adjustments.push(`Tree at (${x.toFixed(1)}, ${z.toFixed(1)}) fitted to ${h.toFixed(2)} m for full-crown clearance.`); treesLocal.push({x, z, h}); return true; };
  for (const [x, z] of slots) if (treesLocal.length < count) place(x, z);
  const grid: [number, number][] = [];
  for (let x = site.x0 + 3; x <= site.x1 - 3; x += 1.5) for (let z = site.z0 + 3; z <= site.z1 - 3; z += 1.5) if (!(viewAxis && x > viewAxis.x0 && x < viewAxis.x1 && z > viewAxis.z0)) grid.push([x, z]);
  while (treesLocal.length < count) {
    let best: [number, number] | undefined, score = -Infinity;
    for (const [x, z] of grid) {
      if (2 * fitAt(x, z, treesLocal) - .02 < 5) continue;
      const spread = Math.min(14, ...treesLocal.map(t => Math.hypot(t.x - x, t.z - z)), ...[house].map(r => 4 + Math.max(r.x0 - x, x - r.x1, r.z0 - z, z - r.z1, 0)));
      const sc = spread + (z > house.z1 ? 2.5 : 0) - Math.abs(Math.max(r0(x - house.x1), r0(house.x0 - x))) * .02;
      if (sc > score) { score = sc; best = [x, z]; }
    }
    if (!best || !place(...best)) break;
  }
  if (treesLocal.length < count) return {spec: base, findings: [finding('tree-clearance', 'trees', `Only ${treesLocal.length} of ${count} trees have full-crown clearance on this site; choose fewer trees or medium stature.`)], adjustments};

  // ---- Lawn masks: everything left, grouped into editable garden regions. ----
  const lawnPieces = mergeSiteRectangles(rectDiff(inflate(site, -.3), [...hardLocal, ...plantedLocal])).filter(r => width(r) * depth(r) > .25);
  const groups = new Map<string, R[]>();
  for (const r of lawnPieces) {
    const x = (r.x0 + r.x1) / 2, z = (r.z0 + r.z1) / 2;
    const key = d.planting.lawn === 'open-lawn' ? 'estate' : z > house.z1 ? 'garden' : z < house.z0 ? 'front' : x < house.x0 ? 'west' : x > house.x1 ? 'east' : 'garden';
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  if ([...groups.values()].some(g => g.length > 64)) return {spec: base, findings: [finding('lawn-budget', 'lawn', 'Lawn regions fragment into more than 64 editable patches.')], adjustments};

  // ---- Back to world coordinates. ----
  const rectW = (r: R) => toRect(W(r));
  const paths = disjoint.map(p => ({id: p.id, rect: rectW(p.r)}));
  const beds = bedRects.map((r, i) => ({id: `border-${i + 1}`, rect: rectW(r)}));
  const hedges = hedgeRects.map((r, i) => ({id: `frontage-hedge-${i + 1}`, rect: rectW(r)}));
  const trees = treesLocal.map((t, i) => { const [x, z] = F.point(t.x, t.z); return {id: `tree-${i + 1}`, x: snap(x), z: snap(z), height: t.h, kind: (d.planting.trees === 'mixed' ? (i % 2 ? 'canopy' : 'palm') : d.planting.trees) as 'palm' | 'canopy'}; });
  const lawns = [...groups].map(([key, patches]) => { const ps = patches.map(W); return {id: `lawn-${key}`, material: 'sage' as const, rect: toRect(union(ps)), patches: ps.map(toRect)}; });

  // ---- Fixtures in world axes (furniture keeps its natural orientation). ----
  const fixtures: NonNullable<HouseSpec['sitePresentation']>['fixtures'] = [];
  const worldHard = [...ctx.blocks.map(b => b.rect), ...ctx.terraces.map(t => t.rect), ctx.court!, ...(pool ? [poolFootprint(pool)] : [])];
  const worldPlanted = [...beds, ...hedges].map(b => fromRect(b.rect)), doorR = ctx.doors.map(x => x.rect), taken = () => fixtures.map(f => fromRect(f.rect));
  const clear = (r: R, extra: R[] = []) => !hit(r, [...doorR, ...worldPlanted, ...taken(), ...extra]);
  const supports = paths.filter(p => p.id.startsWith('terrace-')).map(p => fromRect(p.rect)).sort((p, q) => width(q) * depth(q) - width(p) * depth(p));
  const scan = (zones: R[], w: number, dd: number, ok: (r: R) => boolean): R | undefined => {
    for (const z of zones) for (let x = z.x0 + w / 2; x <= z.x1 - w / 2 + 1e-6; x += .2) for (let y = z.z0 + dd / 2; y <= z.z1 - dd / 2 + 1e-6; y += .2) { const r = {x0: x - w / 2, x1: x + w / 2, z0: y - dd / 2, z1: y + dd / 2}; if (contains(z, r) && ok(r)) return r; }
    return undefined;
  };
  const add = (id: string, asset: typeof fixtures[number]['asset'], r: R, height: number, support: string, rotation = 0) => fixtures.push({id, asset, rect: {x: snap((r.x0 + r.x1) / 2), z: snap((r.z0 + r.z1) / 2), w: snap(width(r)), d: snap(depth(r))}, height, support, rotation});
  const primary = ctx.verandas.find(v => anchor!.source === `veranda ${v.id}`) ?? ctx.verandas[0];
  if (d.terrace.social !== 'none') {
    const group = (zones: R[], extra: R[]) => scan(zones, 3.6, 2.7, r => clear(r, extra));
    const onVeranda = primary && group([inflate(primary.rect, -.25)], []);
    const g = onVeranda ?? group(supports, worldHard);
    if (!g) findings.push(finding('dining-clearance', 'dining', 'No four-seat dining arrangement clears the door routes on the veranda or terrace.'));
    else {
      const support = onVeranda ? `veranda-${primary!.id}-deck` : 'terrace', cx = (g.x0 + g.x1) / 2, cz = (g.z0 + g.z1) / 2;
      add('dining-table', 'table', {x0: cx - 1.15, x1: cx + 1.15, z0: cz - .5, z1: cz + .5}, .78, support);
      for (let i = 0; i < 4; i++) { const x = cx + (i % 2 ? .7 : -.7), z = cz + (i < 2 ? -1.05 : 1.05); add(`dining-chair-${i + 1}`, 'chair', {x0: x - .325, x1: x + .325, z0: z - .3, z1: z + .3}, 1, support, i < 2 ? Math.PI : 0); }
      if (!onVeranda && !supports.some(s => contains(s, g))) findings.push(finding('dining-support', 'dining', 'Dining must stand on one terrace patch.'));
    }
  }
  if (d.terrace.sunbeds !== 'none') {
    const n = d.terrace.sunbeds === 'four' ? 4 : 2, rowW = n * 1.45 - .6;
    const row = scan(supports, rowW, 2.2, r => clear(r, worldHard));
    if (!row) findings.push(finding('sunbed-clearance', 'sunbeds', `No ${n}-lounger row fits on one dry terrace patch beside the pool.`));
    else for (let i = 0; i < n; i++) add(`sunbed-${i + 1}`, 'lounger', {x0: row.x0 + i * 1.45, x1: row.x0 + i * 1.45 + .85, z0: row.z0, z1: row.z1}, .65, 'terrace');
  }
  if (d.terrace.social === 'dining-and-lounge') {
    const g = scan(supports, 3, 2.8, r => clear(r, worldHard));
    if (!g) findings.push(finding('lounge-clearance', 'lounge', 'No garden lounge fits on the terrace.'));
    else { add('garden-sofa', 'sofa', {x0: g.x0, x1: g.x1, z0: g.z0, z1: g.z0 + 1.15}, 1.1, 'terrace'); add('garden-coffee-table', 'coffee-table', {x0: (g.x0 + g.x1) / 2 - .65, x1: (g.x0 + g.x1) / 2 + .65, z0: g.z0 + 1.6, z1: g.z0 + 2.4}, .45, 'terrace'); }
  }
  // Bollards: measured slots beside the court and along every walk; each must clear paving, planting and doors.
  const lightSlots: [number, number][] = [];
  const cw = ctx.court!;
  lightSlots.push([cw.x0 - .5, cw.z0 + .5], [cw.x1 + .5, cw.z0 + .5], [cw.x0 - .5, cw.z1 - .5], [cw.x1 + .5, cw.z1 - .5]);
  for (const p of paths.filter(p => /walk|link|terrace/.test(p.id))) { const r = fromRect(p.rect); lightSlots.push([r.x0 - .4, (r.z0 + r.z1) / 2], [r.x1 + .4, (r.z0 + r.z1) / 2], [(r.x0 + r.x1) / 2, r.z1 + .4]); }
  let lights = 0;
  const wantLights = d.lighting === 'arrival-and-garden' ? 6 : 2, pavedW = paths.map(p => fromRect(p.rect));
  for (const [x, z] of lightSlots) {
    if (lights >= wantLights) break;
    const r = {x0: x - .11, x1: x + .11, z0: z - .11, z1: z + .11};
    if (contains(ctx.site, r) && clear(r, [...worldHard, ...ctx.verandas.map(v => v.rect), ...pavedW, ...trees.map(t => ({x0: t.x - .6, x1: t.x + .6, z0: t.z - .6, z1: t.z + .6}))])) add(`path-light-${++lights}`, 'bollard', r, .65, 'ground');
  }

  const sitePresentation: NonNullable<HouseSpec['sitePresentation']> = {version: 'staged-site-2', design: d, fixtures, routes: [...(drive ? [{id: 'arrival', from: 'site-boundary', to: 'entrance-court', width: 4.8}] : []), {id: 'garden', from: 'entrance-court', to: pool ? 'pool' : 'garden-terrace', width: 1.5}]};
  const candidate: HouseSpec = {...base, siteWork: {...(pool ? {pool} : {}), paths, beds, hedges, trees, lawns} as HouseSpec['siteWork'], sitePresentation};
  findings.push(...generalSiteIssues(candidate));
  return {spec: findings.length ? base : candidate, findings, adjustments};
}

/** Independent checks for `staged-site-2`: overlaps, crowns, fixture support/clearance and the dry route graph. */
export function generalSiteIssues(spec: HouseSpec): Finding[] {
  const out: Finding[] = [], ctx = siteContext(spec), s = spec.siteWork;
  const hard = [...ctx.blocks, ...ctx.terraces, ...ctx.verandas.map(v => ({id: v.id, rect: v.rect})), ...(ctx.court ? [{id: 'entrance-court', rect: ctx.court}] : []), ...(s.pool ? [{id: 'pool', rect: poolFootprint(s.pool)}] : [])];
  const planted = [...s.beds, ...s.hedges].map(b => ({id: b.id, rect: fromRect(b.rect)})), paths = s.paths.map(p => ({id: p.id, rect: fromRect(p.rect)}));
  for (let i = 0; i < paths.length; i++) for (const o of paths.slice(i + 1)) if (overlapArea(paths[i].rect, o.rect) > .01) out.push(finding('paving-overlap', paths[i].id, `Paving overlaps ${o.id}; split it rather than stack slabs.`));
  for (const p of paths) for (const h of hard) if (overlapArea(p.rect, h.rect) > .01) out.push(finding('paving-on-architecture', p.id, `Paving covers ${h.id}.`));
  for (const p of planted) if (hit(p.rect, [...paths.map(x => x.rect), ...hard.map(h => h.rect), ...ctx.doors.map(x => x.rect)])) out.push(finding('planting-on-route', p.id, 'Planting crosses paving, architecture or a door route.'));
  for (const t of s.trees) { const r = {x0: t.x - t.height / 2, x1: t.x + t.height / 2, z0: t.z - t.height / 2, z1: t.z + t.height / 2}; if (!contains(ctx.site, r) || hit(r, [...hard.map(o => o.rect), ...paths.map(p => p.rect)])) out.push(finding('crown-clearance', t.id, 'Full tree crown must fit inside the site and clear built areas.')); }
  for (const f of spec.sitePresentation?.fixtures ?? []) {
    const r = fromRect(f.rect), onVeranda = ctx.verandas.find(v => f.support === `veranda-${v.id}-deck`);
    if (!contains(ctx.site, r)) out.push(finding('fixture-outside', f.id, 'Fixture outside property.'));
    if (hit(r, [...hard.filter(h => h.id !== onVeranda?.id).map(h => h.rect), ...planted.map(p => p.rect), ...ctx.doors.map(x => x.rect)])) out.push(finding('fixture-clearance', f.id, 'Fixture blocks architecture, planting or a real door route.'));
    if (onVeranda && !contains(onVeranda.rect, r)) out.push(finding('fixture-support', f.id, 'Veranda furniture must stand on the veranda deck.'));
    if (f.support === 'terrace' && !paths.some(p => contains(p.rect, r))) out.push(finding('fixture-support', f.id, 'Furniture must stand fully on one dry terrace patch.'));
  }
  for (const l of s.lawns) for (const patch of l.patches ?? [l.rect]) if (hit(fromRect(patch), [...hard.map(o => o.rect), ...paths.map(p => p.rect), ...planted.map(p => p.rect)])) out.push(finding('lawn-mask', l.id, 'A lawn patch covers a reserved building, pool, path or bed.'));
  // Dry route graph: everything walkable must connect to the arrival court by an edge at least 1 m wide.
  if (!ctx.court) return [...out, finding('dry-route', 'site', 'Missing arrival court.')];
  // Open terraces are constructed paved pads (open-{id}); they are walkable surfaces like verandas and paving.
  const surfaces = [{id: 'court', rect: ctx.court}, ...ctx.verandas.map(v => ({id: v.id, rect: v.rect})), ...ctx.terraces, ...paths];
  if (s.pool) { const p = s.pool, pf = poolFootprint(p), wn = poolWaterNorth(p); surfaces.push({id: 'pool-near', rect: {x0: pf.x0, x1: pf.x1, z0: p.z, z1: wn}}, {id: 'pool-far', rect: {x0: pf.x0, x1: pf.x1, z0: wn + p.d, z1: pf.z1}}, {id: 'pool-west', rect: {x0: pf.x0, x1: p.x - p.w / 2, z0: wn, z1: wn + p.d}}, {id: 'pool-east', rect: {x0: p.x + p.w / 2, x1: pf.x1, z0: wn, z1: wn + p.d}}); }
  const near = (x: number, y: number) => Math.abs(x - y) < .002;
  const connected = (a: R, b: R) => overlapArea(a, b) > .001 || ((near(a.x0, b.x1) || near(a.x1, b.x0)) && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) >= 1 - .002) || ((near(a.z0, b.z1) || near(a.z1, b.z0)) && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) >= 1 - .002);
  // Verandas are reached through their host's garden doors as well as by paving.
  const reached = new Set(['court', ...ctx.verandas.filter(v => spec.exterior.doors.some(d => d.side === v.side && spec.exterior.verandas.find(x => x.id === v.id)?.block === allRooms(spec).find(r => r.id === d.room)?.block)).map(v => v.id)]);
  let changed = true;
  while (changed) { changed = false; for (const a of surfaces) if (!reached.has(a.id) && surfaces.some(b => reached.has(b.id) && connected(a.rect, b.rect))) { reached.add(a.id); changed = true; } }
  for (const x of surfaces) if (!reached.has(x.id)) out.push(finding('dry-route', x.id, 'Dry paving is not connected to the arrival court or a garden door by a shared edge at least 1 m wide.'));
  return out;
}
