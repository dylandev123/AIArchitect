import {resolvedPoolIntent} from './intentions';
import {poolReservation} from './poolGeometry';
import {sceneRelationshipIssues} from '../scene/relationships';
import type {ArchitecturalScene} from '../scene/model';
import {SIDES, allRooms, area, blockRect, layoutRooms, overlapArea, rectDiff, roomEdges, roomSideInterval, sideLine, type R, type Room} from './layout';
import type {Block, HouseSpec} from './spec';

export interface Finding {stage: 2 | 3 | 4 | 5; code: string; subject: string; message: string}
const f = (stage: Finding['stage'], code: string, subject: string, message: string): Finding => ({stage, code, subject, message});
const SITE_MARGIN = 1.0;
export const MIN_DIM: Record<string, number> = {gallery: 1.8, hall: 1.8, bath: 1.8, stair: 3};

/** Stage 2: massing is a set of real volumes; check position, size, relationships, site containment. */
export function validateMassing(spec: Pick<HouseSpec, 'site' | 'blocks'> & {openSpaces?: HouseSpec['openSpaces']}): Finding[] {
  const out: Finding[] = [], {site, blocks} = spec;
  const seen = new Set<string>();
  for (const b of blocks) {
    if (seen.has(b.id)) out.push(f(2, 'duplicate-block', b.id, `Block id ${b.id} is used twice.`));
    seen.add(b.id);
    const r = blockRect(b);
    if (r.x0 < -site.width / 2 + SITE_MARGIN || r.x1 > site.width / 2 - SITE_MARGIN || r.z0 < -site.depth / 2 + SITE_MARGIN || r.z1 > site.depth / 2 - SITE_MARGIN)
      out.push(f(2, 'outside-site', b.id, `${b.id} footprint [${r.x0},${r.x1}]×[${r.z0},${r.z1}] is not inside the ${site.width}×${site.depth} m site with a ${SITE_MARGIN} m margin.`));
  }
  for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
    if (blocks[i].level === blocks[j].level && overlapArea(blockRect(blocks[i]), blockRect(blocks[j])) > 0.01)
      out.push(f(2, 'block-overlap', `${blocks[i].id},${blocks[j].id}`, `${blocks[i].id} and ${blocks[j].id} overlap in plan on the same level.`));
  }
  const lower = blocks.filter(b => b.level === 0).map(blockRect);
  for (const b of blocks.filter(b => b.level === 1)) {
    const r = blockRect(b), unsupported = rectDiff(r, lower);
    const missing = unsupported.reduce((s, p) => s + area(p), 0);
    if (missing / area(r) > 0.4) out.push(f(2, 'unsupported-upper', b.id, `${b.id} (level 1) is only ${Math.round(100 * (1 - missing / area(r)))}% supported by ground-level blocks; at most 40% may cantilever.`));
    for (const p of unsupported) if (Math.min(p.x1 - p.x0, p.z1 - p.z0) > 3.0 + 1e-6) out.push(f(2, 'cantilever-too-deep', b.id, `${b.id} cantilevers ${Math.min(p.x1 - p.x0, p.z1 - p.z0).toFixed(1)} m beyond its support; maximum 3 m.`));
  }
  for (const o of spec.openSpaces ?? []) {
    const r = {x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, z0: o.cz - o.d / 2, z1: o.cz + o.d / 2};
    if (r.x0 < -site.width / 2 + SITE_MARGIN || r.x1 > site.width / 2 - SITE_MARGIN || r.z0 < -site.depth / 2 + SITE_MARGIN || r.z1 > site.depth / 2 - SITE_MARGIN) out.push(f(2, 'outside-site', o.id, `Open space ${o.id} is not inside the site with a ${SITE_MARGIN} m margin.`));
    if (!blocks.some(b => b.id === o.host && b.level === 0)) out.push(f(2, 'open-space-host', o.id, `Open space ${o.id} has no enclosed ground-level host ${o.host}.`));
  }
  // Connectivity: every block touches (shares an edge) or is stacked on another.
  if (blocks.length > 1) {
    const touch = (a: Block, b: Block) => a.level === b.level
      ? SIDES.some(s => { const ra = blockRect(a), rb = blockRect(b); return Math.abs(sideLine(ra, s) - sideLine(rb, ({n: 's', s: 'n', e: 'w', w: 'e'} as const)[s])) < 0.02 && (s === 'n' || s === 's' ? Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0) : Math.min(ra.z1, rb.z1) - Math.max(ra.z0, rb.z0)) > 1.2; })
      : overlapArea(blockRect(a), blockRect(b)) > 1;
    const reached = new Set([blocks[0].id]); let grew = true;
    while (grew) { grew = false; for (const a of blocks) if (!reached.has(a.id) && blocks.some(b => reached.has(b.id) && touch(a, b))) { reached.add(a.id); grew = true; } }
    for (const b of blocks) if (!reached.has(b.id)) out.push(f(2, 'disconnected-block', b.id, `${b.id} neither shares a wall (≥1.2 m) nor stacks with the rest of the building.`));
  }
  return out;
}

/** Stage 3: rooms tile the blocks, fit minimum sizes, connect, and are reachable from the entrance. */
export function validateInterior(spec: HouseSpec, requiredBedrooms = 0, requiredBaths = 0): Finding[] {
  const out: Finding[] = [];
  const rooms = allRooms(spec), ids = new Map<string, Room>();
  for (const r of rooms) {
    if (ids.has(r.id)) out.push(f(3, 'duplicate-room', r.id, `Room id ${r.id} is used twice.`));
    ids.set(r.id, r);
    const w = r.x1 - r.x0, d = r.z1 - r.z0, min = MIN_DIM[r.type] ?? 2.4;
    if (w < min - 1e-6 || d < min - 1e-6) out.push(f(3, 'room-too-small', r.id, `${r.id} (${r.type}) is ${w.toFixed(2)}×${d.toFixed(2)} m; minimum dimension ${min} m.`));
  }
  for (const b of spec.blocks) {
    const total = layoutRooms(b).reduce((s, r) => s + Math.max(0, area(r)), 0);
    if (Math.abs(total - b.w * b.d) > 0.05) out.push(f(3, 'plan-does-not-tile', b.id, `Rooms of ${b.id} cover ${total.toFixed(2)} m² of its ${(b.w * b.d).toFixed(2)} m² footprint; a split offset is outside the block.`));
  }
  const edges = roomEdges(rooms);
  const adj = new Map<string, Set<string>>(rooms.map(r => [r.id, new Set()]));
  for (const l of spec.links) {
    const a = ids.get(l.a), b = ids.get(l.b);
    if (!a || !b) { out.push(f(3, 'unknown-link-room', `${l.a},${l.b}`, `Link ${l.a}—${l.b} references a room that does not exist.`)); continue; }
    const shared = edges.filter(e => (e.a === l.a && e.b === l.b) || (e.a === l.b && e.b === l.a));
    const longest = Math.max(0, ...shared.map(e => e.hi - e.lo - (e.sameBlock ? 0 : 0)));
    if (!longest) out.push(f(3, 'link-without-wall', `${l.a},${l.b}`, `${l.a} and ${l.b} do not share a wall, so no ${l.kind} can connect them.`));
    else if (l.kind === 'door' && longest < 1.5) out.push(f(3, 'door-wall-too-short', `${l.a},${l.b}`, `Shared wall between ${l.a} and ${l.b} is ${longest.toFixed(2)} m; a door needs ≥1.5 m.`));
    else { adj.get(l.a)!.add(l.b); adj.get(l.b)!.add(l.a); }
  }
  // Stairs: must fit, and a level-1 room must exist above the landing.
  for (const s of spec.stairs) {
    const room = ids.get(s.room);
    if (!room) { out.push(f(3, 'stair-room-missing', s.id, `Stair ${s.id} references unknown room ${s.room}.`)); continue; }
    const run = 17 * 0.27, alongZ = s.start === 'n' || s.start === 's', length = alongZ ? room.z1 - room.z0 : room.x1 - room.x0, width = alongZ ? room.x1 - room.x0 : room.z1 - room.z0;
    if (length < run + 0.8 + 1.2) out.push(f(3, 'stair-does-not-fit', s.id, `${room.id} is ${length.toFixed(2)} m long; a 17-tread stair needs ${(run + 2).toFixed(2)} m including landing.`));
    if (width < s.width + 0.8) out.push(f(3, 'stair-too-wide', s.id, `${room.id} is ${width.toFixed(2)} m wide for a ${s.width} m stair.`));
    const upper = rooms.filter(r => r.level === 1 && overlapArea(r, room) > 0.5);
    if (!upper.length) out.push(f(3, 'stair-leads-nowhere', s.id, `No level-1 room sits above ${room.id}; the stair has no arrival floor.`));
    else for (const u of upper) { adj.get(room.id)!.add(u.id); adj.get(u.id)!.add(room.id); }
  }
  // Reachability from the main entrance room.
  const mainDoor = spec.exterior.doors.find(d => d.id === spec.exterior.entrance.door);
  const entryRoom = mainDoor ? mainDoor.room : rooms.find(r => r.type === 'foyer')?.id;
  if (!entryRoom || !ids.has(entryRoom)) out.push(f(3, 'no-entrance', 'entrance', mainDoor ? `Entrance door ${mainDoor.id} names unknown room ${mainDoor.room}.` : 'Stage 3 needs a foyer room to anchor the main entrance.'));
  else {
    const reach = new Set([entryRoom]), queue = [entryRoom];
    while (queue.length) for (const n of adj.get(queue.shift()!) ?? []) if (!reach.has(n)) { reach.add(n); queue.push(n); }
    for (const r of rooms) if (!reach.has(r.id)) out.push(f(3, 'unreachable-room', r.id, `${r.id} cannot be reached from the main entrance through doors, openings and stairs.`));
  }
  const bedrooms = rooms.filter(r => r.type === 'bedroom').length;
  if (bedrooms < requiredBedrooms) out.push(f(3, 'programme-bedrooms', 'programme', `Programme needs ${requiredBedrooms} bedrooms; plan has ${bedrooms}.`));
  const baths = rooms.filter(r => r.type === 'bath').length;
  if (baths < requiredBaths) out.push(f(3, 'programme-baths', 'programme', `Programme needs ≥${requiredBaths} bathrooms; plan has ${baths}.`));
  return out;
}

/** Stage 4: doors, verandas and facade keys must refer to real exterior geometry. */
export function validateExterior(spec: HouseSpec): Finding[] {
  const out: Finding[] = [], rooms = allRooms(spec), byId = new Map(rooms.map(r => [r.id, r])), blocks = new Map(spec.blocks.map(b => [b.id, b]));
  const main=spec.exterior.doors.filter(d=>d.kind==='main'),entrance=spec.exterior.doors.find(d=>d.id===spec.exterior.entrance.door);
  if(main.length!==1||!entrance||entrance.kind!=='main'||byId.get(entrance.room)?.type!=='foyer'||byId.get(entrance.room)?.level!==0)
   out.push(f(4,'invalid-main-entrance','entrance','Exactly one main entrance must reference the ground-floor foyer.'));
  const ids=new Set<string>();
  for(const component of [...spec.exterior.doors,...spec.exterior.verandas]){if(ids.has(component.id))out.push(f(4,'duplicate-component',component.id,'Exterior component IDs must be unique.'));ids.add(component.id);}
  for (const key of Object.keys(spec.exterior.facades)) if (!/^[a-z][a-z0-9-]*:[nsew]$/.test(key)||!blocks.has(key.split(':')[0])) out.push(f(4, 'facade-unknown-block', key, `Facade key ${key} names an unknown block.`));
  for (const d of spec.exterior.doors) {
    const room = byId.get(d.room);
    if (!room) { out.push(f(4, 'door-unknown-room', d.id, `Door ${d.id} names unknown room ${d.room}.`)); continue; }
    const iv = roomSideInterval(room, blockRect(blocks.get(room.block)!), d.side);
    if (!iv) out.push(f(4, 'door-not-exterior', d.id, `${room.id} has no exterior wall on its ${d.side} side for door ${d.id}.`));
    else {
      // Only walls parallel to this facade can occupy it (a perpendicular wall at the same coordinate cannot).
      const edges = roomEdges(rooms).filter(e => (e.a === room.id || e.b === room.id) && e.axis === (d.side === 'n' || d.side === 's' ? 'z' : 'x') && Math.abs(e.line - sideLine(blockRect(blocks.get(room.block)!), d.side)) < 1e-4);
      const free = iv[1] - iv[0] - edges.reduce((s, e) => s + (e.hi - e.lo), 0);
      if (free < d.width + 1.2) out.push(f(4, 'door-wall-too-short', d.id, `Exterior wall of ${room.id} (${d.side}) has ${free.toFixed(2)} m free; door ${d.id} needs ${(d.width + 1.2).toFixed(2)} m.`));
    }
  }
  for (const v of spec.exterior.verandas) {
    const b = blocks.get(v.block);
    if (!b) { out.push(f(4, 'veranda-unknown-block', v.id, `Veranda ${v.id} names an unknown block.`)); continue; }
    const r = blockRect(b), [lo, hi] = v.side === 'n' || v.side === 's' ? [r.x0, r.x1] : [r.z0, r.z1];
    if (v.from < lo - 1e-6 || v.to > hi + 1e-6 || v.to - v.from < 3) out.push(f(4, 'veranda-span', v.id, `Veranda ${v.id} spans ${v.from}..${v.to} but ${b.id}'s ${v.side} side runs ${lo}..${hi} (needs ≥3 m).`));
    const deck = verandaRect(spec, v.id)!;
    for (const o of spec.blocks) if (o.level === 0 && overlapArea(deck, blockRect(o)) > 0.01) out.push(f(4, 'veranda-collides', v.id, `Veranda ${v.id} overlaps block ${o.id}.`));
  }
  return out;
}

export function verandaRect(spec: HouseSpec, id: string): R | undefined {
  const v = spec.exterior.verandas.find(x => x.id === id), b = v && spec.blocks.find(x => x.id === v.block);
  if (!v || !b) return undefined;
  const r = blockRect(b), line = sideLine(r, v.side), dir = v.side === 'n' || v.side === 'w' ? -1 : 1, [a, c] = [line, line + dir * v.depth].sort((x, y) => x - y);
  return v.side === 'n' || v.side === 's' ? {x0: v.from, x1: v.to, z0: a, z1: c} : {x0: a, x1: c, z0: v.from, z1: v.to};
}

export function poolFootprint(p: NonNullable<HouseSpec['siteWork']['pool']>): R {
  return poolReservation(p);
}

/** Everything that must stay clear of lawns, beds, trees, hedges and paths. */
export function siteObstacles(spec: HouseSpec): {id: string; rect: R}[] {
  const out = spec.blocks.filter(b => b.level === 0).map(b => ({id: b.id, rect: blockRect(b)}));
  for (const o of spec.openSpaces ?? []) if (resolvedPoolIntent(spec)?.id!==o.id&&!spec.exterior.verandas.some(v => v.id === o.id)) out.push({id: o.id, rect: {x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, z0: o.cz - o.d / 2, z1: o.cz + o.d / 2}});
  for (const v of spec.exterior.verandas) out.push({id: v.id, rect: verandaRect(spec, v.id)!});
  if (spec.siteWork.pool) out.push({id: 'pool', rect: poolFootprint(spec.siteWork.pool)});
  const door = spec.exterior.doors.find(d => d.id === spec.exterior.entrance.door), room = door && allRooms(spec).find(r => r.id === door.room);
  if (door && room) {
    const b = spec.blocks.find(x => x.id === room.block)!, br = blockRect(b), iv = roomSideInterval(room, br, door.side);
    if (iv) {
      const c = Math.min(iv[1] - door.width / 2 - 0.6, Math.max(iv[0] + door.width / 2 + 0.6, iv[0] + door.t * (iv[1] - iv[0]))), line = sideLine(br, door.side), dir = door.side === 'n' || door.side === 'w' ? -1 : 1, {w, d} = spec.exterior.entrance.court;
      const [a, e] = [line, line + dir * d].sort((x, y) => x - y);
      out.push({id: 'entrance-court', rect: door.side === 'n' || door.side === 's' ? {x0: c - w / 2, x1: c + w / 2, z0: a, z1: e} : {x0: a, x1: e, z0: c - w / 2, z1: c + w / 2}});
    }
  }
  return out;
}

const rectOf = (r: {x: number; z: number; w: number; d: number}): R => ({x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2});

/** Stage 5: flat site, everything inside the property, nothing on the building or pool. */
export function validateSite(spec: HouseSpec): Finding[] {
  const out: Finding[] = [], {site, siteWork: s} = spec, obstacles = siteObstacles(spec).filter(o => o.id !== 'pool' || true);
  const inSite = (r: R) => r.x0 >= -site.width / 2 - 1e-6 && r.x1 <= site.width / 2 + 1e-6 && r.z0 >= -site.depth / 2 - 1e-6 && r.z1 <= site.depth / 2 + 1e-6;
  const check = (id: string, kind: string, r: R, ignore: string[] = []) => {
    if (!inSite(r)) out.push(f(5, 'outside-site', `${kind}:${id}`, `${kind} ${id} extends outside the ${site.width}×${site.depth} m site.`));
    for (const o of obstacles) if (!ignore.includes(o.id) && overlapArea(r, o.rect) > 0.01) out.push(f(5, 'site-overlap', `${kind}:${id}`, `${kind} ${id} overlaps ${o.id}.`));
  };
  if (s.pool && !inSite(poolFootprint(s.pool))) out.push(f(5, 'outside-site', 'pool', 'The swimming pool and its deck extend outside the site.'));
  for (const o of obstacles) if (s.pool && o.id !== 'pool' && overlapArea(poolFootprint(s.pool), o.rect) > 0.01) out.push(f(5, 'site-overlap', 'pool', `The swimming pool overlaps ${o.id}.`));
  for (const l of s.lawns) for(const r of l.patches??[l.rect])check(l.id, 'lawn', rectOf(r));
  for (const l of s.beds) check(l.id, 'bed', rectOf(l.rect));
  for (const l of s.hedges) check(l.id, 'hedge', rectOf(l.rect));
  for (const l of s.paths) check(l.id, 'path', rectOf(l.rect), ['entrance-court']);
  for (const t of s.trees) check(t.id, 'tree', {x0: t.x - 0.8, x1: t.x + 0.8, z0: t.z - 0.8, z1: t.z + 0.8});
  return out;
}

/** The existing, independently written hard geometry audit (support, water, roofs, glazing, railings). */
export function relationshipFindings(scene: ArchitecturalScene, stage: Finding['stage']): Finding[] {
  return sceneRelationshipIssues(scene).map(i => f(stage, `relationship-${i.rule}`, i.id, i.message));
}

export function validateStage(spec: HouseSpec, stage: Finding['stage'], scene: ArchitecturalScene, requiredBedrooms = 0): Finding[] {
  const own = stage === 2 ? validateMassing(spec) : stage === 3 ? validateInterior(spec, requiredBedrooms) : stage === 4 ? validateExterior(spec) : validateSite(spec);
  return [...(stage === 2 ? [] : relationshipFindings(scene, stage)), ...own];
}
