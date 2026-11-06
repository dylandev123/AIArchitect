import {z} from 'zod';
import {blockRect, overlapArea, roomEdgesBetween, type R} from './layout';
import {roomTypeSchema, type HouseSpec} from './spec';

/**
 * Stage 3, new contract. Terra designs the room RELATIONSHIPS; software solves the geometry.
 * The schema is deliberately flat: arrays of small objects with stable ids, no recursion, no
 * coordinates, no optional/default fields (every field is required, so OpenAI strict structured
 * output can enforce it). Range/format rules are checked locally (`programmeIssues`), not in the
 * provider schema, so the wire schema is only types + enums.
 */
export const PRIORITIES = ['core', 'normal', 'flex'] as const;
export const FACINGS = ['n', 's', 'e', 'w', 'any'] as const;

export const programmeRoomSchema = z.object({
  id: z.string(), block: z.string(), type: roomTypeSchema, name: z.string(),
  /** Approximate floor area in m². Software scales all rooms of a block to fill it exactly. */
  area: z.number(),
  /** core = keep near this size; flex = absorbs the block's spare area. */
  priority: z.enum(PRIORITIES),
  /** Preferred exterior side (garden view, arrival…); `any` = no preference. */
  facing: z.enum(FACINGS),
}).strict();
export const programmeConnectionSchema = z.object({a: z.string(), b: z.string(), kind: z.enum(['door', 'open'])}).strict();
/** A stair: the ground-level stair room and the upper room that is its landing. Software sizes and orients the flight. */
export const programmeStairSchema = z.object({id: z.string(), room: z.string(), landing: z.string()}).strict();
export const programmeSchema = z.object({
  rooms: z.array(programmeRoomSchema),
  connections: z.array(programmeConnectionSchema),
  stairs: z.array(programmeStairSchema),
  /** Short statements of architectural intent (kept with the checkpoint; not geometry). */
  intentions: z.array(z.string()),
}).strict();
export type Programme = z.infer<typeof programmeSchema>;
export type ProgRoom = Programme['rooms'][number];
export type ProgConnection = Programme['connections'][number];
export type Facing = (typeof FACINGS)[number];

export interface Conflict {code: string; subject: string; message: string}
const c = (code: string, subject: string, message: string): Conflict => ({code, subject, message});

/** Per-type hard minimums: shorter side (m), area (m²), and maximum aspect ratio. */
export const ROOM_RULES: Record<string, {minDim: number; minArea: number; maxAspect: number}> = {
  foyer: {minDim: 2.4, minArea: 6, maxAspect: 3}, living: {minDim: 3.6, minArea: 16, maxAspect: 3}, dining: {minDim: 2.8, minArea: 9, maxAspect: 3},
  kitchen: {minDim: 2.4, minArea: 8, maxAspect: 3.2}, bedroom: {minDim: 3, minArea: 10, maxAspect: 2.6}, bath: {minDim: 1.8, minArea: 4, maxAspect: 3.2},
  hall: {minDim: 1.8, minArea: 4, maxAspect: 12}, gallery: {minDim: 1.8, minArea: 4, maxAspect: 12}, stair: {minDim: 3, minArea: 19.8, maxAspect: 3},
  lounge: {minDim: 3, minArea: 12, maxAspect: 3}, media: {minDim: 3, minArea: 12, maxAspect: 3},
};
/** Rooms that need daylight/ventilation: a real exterior wall. */
export const NEEDS_EXTERIOR = new Set(['bedroom', 'living', 'dining', 'kitchen', 'lounge', 'media', 'foyer']);
/** Doors need 1.5 m of shared wall; an open link needs at least this much. */
export const DOOR_WALL = 1.5, OPEN_WALL = 1.2;
/** A 17-tread flight plus margins: the stair room's long side. */
export const STAIR_LONG = 6.6, STAIR_SHORT = 3.0;

const idOk = (s: string) => /^[a-z][a-z0-9-]{0,39}$/.test(s);

export interface BlockInfo {id: string; level: number; rect: R; area: number}
export const blockInfo = (spec: Pick<HouseSpec, 'blocks'>): BlockInfo[] => spec.blocks.map(b => ({id: b.id, level: b.level, rect: blockRect(b), area: b.w * b.d}));

/**
 * Static, geometry-free feasibility of a programme against the fixed massing. Every message
 * names the rooms/blocks in conflict. Nothing is invented or auto-corrected here.
 */
export function programmeIssues(p: Programme, spec: Pick<HouseSpec, 'blocks'>, req: {bedrooms?: number; baths?: number} = {}): Conflict[] {
  const out: Conflict[] = [], blocks = blockInfo(spec), blockById = new Map(blocks.map(b => [b.id, b]));
  const rooms = new Map<string, ProgRoom>();
  for (const r of p.rooms) {
    if (!idOk(r.id)) out.push(c('bad-id', r.id, `Room id "${r.id}" must be lowercase letters, digits and hyphens (max 40).`));
    if (rooms.has(r.id)) out.push(c('duplicate-room', r.id, `Room id ${r.id} is used twice.`));
    rooms.set(r.id, r);
    if (!blockById.has(r.block)) out.push(c('unknown-block', r.id, `Room ${r.id} is assigned to block "${r.block}", which is not in the massing (${blocks.map(b => b.id).join(', ')}).`));
    if (!(r.area > 0) || r.area > 400) out.push(c('bad-area', r.id, `Room ${r.id} has target area ${r.area} m²; it must be between 0 and 400.`));
    if (r.name.length > 60) out.push(c('name-too-long', r.id, `Room ${r.id} name is ${r.name.length} characters; max 60.`));
  }
  // Area budget per block: the minimums of its rooms must fit its footprint.
  for (const b of blocks) {
    const mine = p.rooms.filter(r => r.block === b.id);
    if (!mine.length) { out.push(c('empty-block', b.id, `Block ${b.id} (${b.area.toFixed(0)} m², level ${b.level}) has no rooms; every existing block must be fully used.`)); continue; }
    const need = mine.reduce((s, r) => s + (ROOM_RULES[r.type]?.minArea ?? 9), 0);
    if (need > b.area + 1e-6) out.push(c('block-too-small', b.id, `Block ${b.id} is ${b.area.toFixed(1)} m² but its ${mine.length} rooms (${mine.map(r => r.id).join(', ')}) need at least ${need.toFixed(1)} m² between them. Move a room to another block or drop one.`));
    const w = b.rect.x1 - b.rect.x0, d = b.rect.z1 - b.rect.z0;
    for (const r of mine) { const m = ROOM_RULES[r.type]; if (m && Math.min(w, d) < m.minDim) out.push(c('block-too-narrow', r.id, `Block ${b.id} is ${w.toFixed(1)}×${d.toFixed(1)} m; a ${r.type} (${r.id}) needs ${m.minDim} m in both directions.`)); }
  }
  // Counts the brief asks for.
  const count = (t: string) => p.rooms.filter(r => r.type === t).length;
  if (req.bedrooms !== undefined && count('bedroom') !== req.bedrooms) out.push(c('programme-bedrooms', 'programme', `The brief requires exactly ${req.bedrooms} bedrooms; the programme has ${count('bedroom')}.`));
  if (req.baths !== undefined && count('bath') < req.baths) out.push(c('programme-baths', 'programme', `The brief requires at least ${req.baths} bathrooms; the programme has ${count('bath')}.`));
  const foyers = p.rooms.filter(r => r.type === 'foyer');
  if (foyers.length !== 1) out.push(c('foyer-count', 'foyer', `Exactly one foyer (the main entrance room) is required; the programme has ${foyers.length}.`));
  else if (blockById.get(foyers[0].block)?.level !== 0) out.push(c('foyer-level', foyers[0].id, `The foyer ${foyers[0].id} must be on the ground level (block ${foyers[0].block} is level ${blockById.get(foyers[0].block)?.level}).`));
  // Stairs.
  const hasUpper = blocks.some(b => b.level === 1);
  if (hasUpper && !p.stairs.length) out.push(c('no-stair', 'stairs', 'The massing has an upper level but the programme has no stair. Add a stair room on the ground level and its landing room above.'));
  if (p.stairs.length > 2) out.push(c('too-many-stairs', 'stairs', 'At most 2 stairs are supported.'));
  const stairRoomIds = new Set<string>();
  for (const s of p.stairs) {
    const sr = rooms.get(s.room), lr = rooms.get(s.landing);
    if (!sr || sr.type !== 'stair') { out.push(c('stair-room', s.id, `Stair ${s.id}: room "${s.room}" must be a programme room of type "stair".`)); continue; }
    stairRoomIds.add(sr.id);
    if (!lr || !['hall', 'gallery'].includes(lr.type)) { out.push(c('stair-landing', s.id, `Stair ${s.id}: landing "${s.landing}" must be a programme room of type hall or gallery.`)); continue; }
    const sb = blockById.get(sr.block), lb = blockById.get(lr.block);
    if (!sb || !lb) continue;
    if (sb.level !== 0 || lb.level !== 1) { out.push(c('stair-levels', s.id, `Stair ${s.id}: room ${sr.id} must be on level 0 and landing ${lr.id} on level 1.`)); continue; }
    const shared = overlapArea(sb.rect, lb.rect);
    const sw = Math.min(sb.rect.x1, lb.rect.x1) - Math.max(sb.rect.x0, lb.rect.x0), sd = Math.min(sb.rect.z1, lb.rect.z1) - Math.max(sb.rect.z0, lb.rect.z0);
    if (shared <= 0 || Math.max(sw, sd) < STAIR_LONG - 1e-6 || Math.min(sw, sd) < STAIR_SHORT - 1e-6)
      out.push(c('stair-no-overlap', s.id, `Stair ${s.id}: ground block ${sb.id} and upper block ${lb.id} overlap only ${sw.toFixed(1)}×${sd.toFixed(1)} m; a stair room needs ${STAIR_LONG}×${STAIR_SHORT} m directly under the upper block.`));
  }
  for (const r of p.rooms) if (r.type === 'stair' && !stairRoomIds.has(r.id)) out.push(c('stair-unlisted', r.id, `Stair room ${r.id} is not listed in "stairs" with a landing room.`));
  // Connections.
  const seen = new Set<string>();
  for (const k of p.connections) {
    const a = rooms.get(k.a), b = rooms.get(k.b);
    if (!a || !b) { out.push(c('unknown-connection-room', `${k.a},${k.b}`, `Connection ${k.a}—${k.b} names a room that is not in the programme.`)); continue; }
    if (a.id === b.id) { out.push(c('self-connection', a.id, `Connection from ${a.id} to itself.`)); continue; }
    const key = [a.id, b.id].sort().join('|');
    if (seen.has(key)) { out.push(c('duplicate-connection', key, `Connection ${a.id}—${b.id} is listed twice.`)); continue; }
    seen.add(key);
    const ba = blockById.get(a.block), bb = blockById.get(b.block);
    if (!ba || !bb) continue;
    if (stairPair(p, a.id, b.id)) continue;
    if (ba.level !== bb.level) { out.push(c('cross-level-connection', key, `${a.id} (level ${ba.level}) and ${b.id} (level ${bb.level}) are on different levels; connect them through a stair (stair room → landing), not a door.`)); continue; }
    if (ba.id !== bb.id) {
      const need = k.kind === 'door' ? DOOR_WALL : OPEN_WALL;
      if (roomEdgesBetween(ba.rect, bb.rect) < need) out.push(c('blocks-not-adjacent', key, `${a.id} (block ${ba.id}) and ${b.id} (block ${bb.id}) cannot be connected: the blocks share only ${roomEdgesBetween(ba.rect, bb.rect).toFixed(1)} m of wall, a ${k.kind} needs ${need} m.`));
    }
    const noBedLiving = (x: ProgRoom, y: ProgRoom) => x.type === 'bedroom' && ['living', 'dining', 'kitchen'].includes(y.type);
    if (noBedLiving(a, b) || noBedLiving(b, a)) out.push(c('bedroom-off-living', key, `Bedroom ${a.type === 'bedroom' ? a.id : b.id} must not open directly onto ${a.type === 'bedroom' ? b.id : a.id}; route it through a hall or gallery.`));
  }
  // Terra designs the relationships: a room with no relation at all is an omission, not something software should guess.
  const linked = new Set(p.connections.flatMap(k => [k.a, k.b]));
  for (const s of p.stairs) { linked.add(s.room); linked.add(s.landing); }
  for (const r of p.rooms) if (!linked.has(r.id) && p.rooms.length > 1) out.push(c('isolated-room', r.id, `Room ${r.id} (${r.type}) has no connection to any other room; say what it opens onto.`));
  return out;
}

export const stairPair = (p: Programme, a: string, b: string) => p.stairs.some(s => (s.room === a && s.landing === b) || (s.room === b && s.landing === a));
