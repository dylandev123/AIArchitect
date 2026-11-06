import {z} from 'zod';
import type {ArchitecturalScene} from '../scene/model';
import {SIDES, allRooms, blockRect, roomEdges, roomSideInterval, sideLine, sideRun, type R, type Room} from './layout';
import {WALL_H, levelTop, sideSchema, type Block, type HouseSpec, type Side, type Trim} from './spec';
import {validateExterior, verandaRect, type Finding} from './validate';
import {outdoorKind} from './intentions';

/**
 * STAGE 4: exterior architectural design.
 * Terra decides the architectural CHARACTER (roof forms and pitch, finishes, facade styles, entrance, veranda, railings, trim).
 * Software measures the existing building and derives every coordinate: eave projections (clamped to what is physically valid),
 * roof rise from pitch, opening positions and sizes, door widths, veranda spans and column rhythm, entrance court, trim.
 * The wire schema is flat, strict-compatible, coordinate-free; range/identity rules are checked locally (`exteriorIssues`).
 */
export const ROOF_FINISHES = ['terracotta', 'aged-terracotta', 'warm-bronze'] as const;
export const WALL_FINISHES = ['cream-stucco', 'warm-white-stucco', 'sand-stucco'] as const;
export const STONES = ['pale-limestone', 'honey-stone', 'coral-stone'] as const;
export const TIMBERS = ['teak', 'dark-walnut', 'honey-oak'] as const;
export const EAVES = ['shallow', 'deep', 'very-deep'] as const;
export const EAVE_M: Record<(typeof EAVES)[number], number> = {shallow: 0.5, deep: 0.9, 'very-deep': 1.3};
export const PITCH_RANGE = [12, 38] as const;
const COLORS = {
  roof: {terracotta: {material: 'timber', color: '#B65A36'}, 'aged-terracotta': {material: 'timber', color: '#A04A2B'}, 'warm-bronze': {material: 'bronze', color: '#7A5B3A'}, 'slate-grey': {material: 'bronze', color: '#4C5154'}},
  wall: {'cream-stucco': '#EDE1C4', 'warm-white-stucco': '#F2ECDD', 'sand-stucco': '#E2D0A8'},
  stone: {'pale-limestone': '#D6C8A8', 'honey-stone': '#C9AA77', 'coral-stone': '#D4B497'},
  timber: {teak: '#7A5230', 'dark-walnut': '#4E3523', 'honey-oak': '#A27A48'},
} as const;

export const exteriorDesignSchema = z.object({
  statement: z.string(),
  roofFinish: z.enum(ROOF_FINISHES), wallFinish: z.enum(WALL_FINISHES), stone: z.enum(STONES), timber: z.enum(TIMBERS),
  blockFinishes: z.array(z.object({block: z.string(), finish: z.enum(['stucco', 'stone', 'timber-clad'])}).strict()),
  roofs: z.array(z.object({block: z.string(), form: z.enum(['hip', 'gable', 'flat']), pitchDeg: z.number(), eaves: z.enum(EAVES)}).strict()),
  facades: z.array(z.object({block: z.string(), side: sideSchema, style: z.enum(['glass-wall', 'large-windows', 'punched', 'solid'])}).strict()),
  windowTrim: z.enum(['plain', 'stone-surrounds', 'stone-and-shutters']),
  railing: z.enum(['glass', 'parapet']),
  details: z.object({plinth: z.boolean(), cornice: z.boolean()}).strict(),
  entrance: z.object({room: z.string(), side: sideSchema, canopy: z.enum(['none', 'shallow', 'deep']), portal: z.boolean(), court: z.enum(['compact', 'generous'])}).strict(),
  doors: z.array(z.object({room: z.string(), side: sideSchema, kind: z.enum(['garden', 'terrace'])}).strict()),
  veranda: z.object({openSpace: z.string(), columns: z.enum(['slender-bronze', 'stone-piers', 'timber-posts']), spacing: z.enum(['tight', 'generous']), ceiling: z.enum(['timber-beams', 'plain-slab']), roof: z.enum(['limestone', 'timber', 'bronze']), deck: z.enum(['limestone', 'timber'])}).strict(),
  intentions: z.array(z.string()),
}).strict();
export type ExteriorDesign = z.infer<typeof exteriorDesignSchema>;

/**
 * Version 2, used by automatic generation: the same measured, coordinate-free vocabulary, but any number of
 * verandas (including none) so houses without a covered open space, or with several, are representable.
 * Every field is required (strict structured output). v1 above stays byte-identical for historical replays.
 */
export const ROOF_FINISHES_V2 = [...ROOF_FINISHES, 'slate-grey'] as const;
export const verandaChoiceSchema = exteriorDesignSchema.shape.veranda;
export const exteriorDesignV2Schema = exteriorDesignSchema.omit({veranda: true, roofFinish: true}).extend({roofFinish: z.enum(ROOF_FINISHES_V2), verandas: z.array(verandaChoiceSchema)}).strict();
export type ExteriorDesignV2 = z.infer<typeof exteriorDesignV2Schema>;
export type AnyExteriorDesign = ExteriorDesign | ExteriorDesignV2;
export const verandaChoices = (d: AnyExteriorDesign) => 'verandas' in d ? d.verandas : [d.veranda];

const f = (code: string, subject: string, message: string): Finding => ({stage: 4, code, subject, message});
const inR = (r: R, x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
const probe = (r: R, s: Side, along: number, d: number): [number, number] => s === 'n' ? [along, r.z0 - d] : s === 's' ? [along, r.z1 + d] : s === 'e' ? [r.x1 + d, along] : [r.x0 - d, along];

/** Blocks whose top is exposed to the sky (their roof is designed); lower blocks under an upper block become roof terraces. */
export function roofableBlocks(spec: HouseSpec): Block[] {
  const upper = spec.blocks.filter(b => b.level === 1).map(blockRect);
  return spec.blocks.filter(b => b.level === 1 || !upper.some(u => Math.min(u.x1, blockRect(b).x1) > Math.max(u.x0, blockRect(b).x0) + 0.01 && Math.min(u.z1, blockRect(b).z1) > Math.max(u.z0, blockRect(b).z0) + 0.01));
}
export const terraceBlocks = (spec: HouseSpec) => spec.blocks.filter(b => b.level === 0 && !roofableBlocks(spec).includes(b));

export interface ExteriorWall {room: string; name: string; type: string; block: string; level: number; side: Side; run: number; free: number; outside: string}
/** Every exterior wall run of every room, with the free length (no neighbour) and what lies outside. Measured, not designed. */
export function exteriorWalls(spec: HouseSpec): ExteriorWall[] {
  const rooms = allRooms(spec), edges = roomEdges(rooms), out: ExteriorWall[] = [], terraces = terraceBlocks(spec).map(blockRect);
  for (const room of rooms) {
    const b = spec.blocks.find(x => x.id === room.block)!, br = blockRect(b);
    for (const side of SIDES) {
      const iv = roomSideInterval(room, br, side);
      if (!iv) continue;
      const covers = edges.filter(e => (e.a === room.id || e.b === room.id) && e.axis === (side === 'n' || side === 's' ? 'z' : 'x') && Math.abs(e.line - sideLine(br, side)) < 1e-4);
      const free = iv[1] - iv[0] - covers.reduce((s, e) => s + (e.hi - e.lo), 0);
      if (free < 0.3) continue;
      const [px, pz] = probe(br, side, (iv[0] + iv[1]) / 2, 0.8);
      const open = (spec.openSpaces ?? []).find(o => inR({x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, z0: o.cz - o.d / 2, z1: o.cz + o.d / 2}, px, pz));
      const terrace = terraceBlocks(spec).find((t, i) => inR(terraces[i], px, pz));
      const outside = open ? `covered ${open.id} (open space)` : room.level === 1 ? (terrace ? `roof terrace on ${terrace.id}` : 'open air, no terrace below') : 'garden / forecourt at ground level';
      out.push({room: room.id, name: room.name, type: room.type, block: room.block, level: room.level, side, run: +(iv[1] - iv[0]).toFixed(1), free: +free.toFixed(1), outside});
    }
  }
  return out;
}

export function exteriorIssues(spec: HouseSpec, d: AnyExteriorDesign): Finding[] {
  const out: Finding[] = [], blocks = new Map(spec.blocks.map(b => [b.id, b])), rooms = new Map(allRooms(spec).map(r => [r.id, r])), walls = exteriorWalls(spec);
  const roofable = roofableBlocks(spec).map(b => b.id), seen = new Set<string>();
  for (const r of d.roofs) {
    if (!blocks.has(r.block)) { out.push(f('roof-unknown-block', r.block, `Roof names unknown block ${r.block}.`)); continue; }
    if (seen.has(r.block)) out.push(f('roof-duplicate', r.block, `Block ${r.block} has two roofs.`));
    seen.add(r.block);
    if (r.form !== 'flat' && !(r.pitchDeg >= PITCH_RANGE[0] && r.pitchDeg <= PITCH_RANGE[1])) out.push(f('roof-pitch', r.block, `Pitch ${r.pitchDeg}° for ${r.block} is outside ${PITCH_RANGE[0]}-${PITCH_RANGE[1]}°.`));
  }
  for (const id of roofable) if (!seen.has(id)) out.push(f('roof-missing', id, `Block ${id} has an exposed top and needs a roof decision.`));
  for (const b of d.blockFinishes) if (!blocks.has(b.block)) out.push(f('finish-unknown-block', b.block, `Finish names unknown block ${b.block}.`));
  for (const fa of d.facades) if (!blocks.has(fa.block)) out.push(f('facade-unknown-block', fa.block, `Facade names unknown block ${fa.block}.`));
  const wallOf = (room: string, side: Side) => walls.find(w => w.room === room && w.side === side);
  const e = d.entrance, er = rooms.get(e.room);
  if (!er) out.push(f('entrance-unknown-room', e.room, `Entrance names unknown room ${e.room}.`));
  else if (er.level !== 0 || er.type !== 'foyer') out.push(f('entrance-not-foyer', e.room, `The main entrance must be on the ground-level foyer; ${e.room} is a ${er.type} on level ${er.level}.`));
  else if (!wallOf(e.room, e.side)) out.push(f('entrance-no-wall', e.room, `${e.room} has no exterior wall on side ${e.side}.`));
  const seenDoors = new Set<string>();
  for (const dr of d.doors) {
    const k = `${dr.room}:${dr.side}`, w = wallOf(dr.room, dr.side);
    if (seenDoors.has(k) || (dr.room === e.room && dr.side === e.side)) { out.push(f('door-duplicate', k, `Two doors on ${k}.`)); continue; }
    seenDoors.add(k);
    if (!rooms.get(dr.room)) out.push(f('door-unknown-room', dr.room, `Door names unknown room ${dr.room}.`));
    else if (!w) out.push(f('door-no-wall', k, `${dr.room} has no exterior wall on side ${dr.side}.`));
    else if (dr.kind === 'terrace' && !w.outside.startsWith('roof terrace')) out.push(f('terrace-door-no-terrace', k, `Terrace door ${k} would open onto: ${w.outside}.`));
    else if (dr.kind === 'garden' && (w.level !== 0)) out.push(f('garden-door-upstairs', k, `Garden door ${k} is on level ${w.level}; use kind terrace for a roof terrace.`));
    else if (w.free < 2.1) out.push(f('door-wall-short', k, `Exterior wall ${k} has only ${w.free} m free; a door needs 2.1 m.`));
  }
  if (d.doors.length > 7) out.push(f('too-many-doors', 'doors', 'At most 7 doors besides the main entrance.'));
  const covered = new Set<string>();
  for (const v of verandaChoices(d)) {
    const os = (spec.openSpaces ?? []).find(o => o.id === v.openSpace);
    if (!os) out.push(f('veranda-unknown-space', v.openSpace, `Veranda names unknown open space ${v.openSpace}.`));
    else if (covered.has(os.id)) out.push(f('veranda-duplicate', os.id, `Open space ${os.id} is covered twice.`));
    else if (/\bpool\b/i.test(os.role) && !/\bpool\s+(?:deck|terrace)\b/i.test(os.role)) out.push(f('veranda-on-pool', os.id, `${os.id} is a pool reservation; it cannot become a covered veranda.`));
    else if ('verandas' in d && outdoorKind(os) !== 'veranda') out.push(f('veranda-on-terrace', os.id, `${os.id} is an open terrace intention (${os.role}); only veranda, loggia, porch or pergola spaces are covered.`));
    covered.add(v.openSpace);
  }
  if ('verandas' in d) for (const o of spec.openSpaces ?? []) {
    const noun = o.role.match(/\b(pool|veranda|verandah|loggia|porch|pergola|terrace|patio|deck)\b/i)?.[1].toLowerCase();
    if (noun && ['veranda', 'verandah', 'loggia', 'porch', 'pergola'].includes(noun) && !covered.has(o.id)) out.push(f('veranda-missing', o.id, `Open space ${o.id} is a covered outdoor intention (${noun}); include it in verandas.`));
  }
  if (verandaChoices(d).length > 4) out.push(f('too-many-verandas', 'verandas', 'At most four verandas.'));
  if (d.statement.length > 900) out.push(f('text-too-long', 'statement', 'statement is longer than 900 characters.'));
  return out;
}

export interface Adjustment {subject: string; what: string}
export interface Derivation {adjustments: Adjustment[]; roofs: {block: string; form: string; pitchDeg: number; rise: number; eave: number; requestedEave: number}[]; doors: {id: string; room: string; side: Side; kind: string; width: number}[]; veranda?: {from: number; to: number; depth: number; columns: number}}

/** Largest eave projection that stays inside the site and clear of other volumes on every free side. */
function eaveClearance(spec: HouseSpec, b: Block): number {
  const br = blockRect(b), site = {x0: -spec.site.width / 2 + 1, x1: spec.site.width / 2 - 1, z0: -spec.site.depth / 2 + 1, z1: spec.site.depth / 2 - 1};
  let best = 3;
  for (const s of SIDES) {
    const abutted = spec.blocks.some(o => o.id !== b.id && o.level >= b.level && (() => { const r = blockRect(o), gap = s === 'n' ? r.z1 - br.z0 : s === 's' ? r.z0 - br.z1 : s === 'e' ? r.x0 - br.x1 : r.x1 - br.x0, [lo, hi] = s === 'n' || s === 's' ? [Math.max(br.x0, r.x0), Math.min(br.x1, r.x1)] : [Math.max(br.z0, r.z0), Math.min(br.z1, r.z1)]; return Math.abs(gap) < 0.02 && hi - lo > 0.05; })());
    if (abutted) continue;
    const edge = s === 'n' ? br.z0 - site.z0 : s === 's' ? site.z1 - br.z1 : s === 'e' ? site.x1 - br.x1 : br.x0 - site.x0;
    best = Math.min(best, edge);
    for (const o of spec.blocks) {
      if (o.id === b.id || o.level < b.level) continue;
      const r = blockRect(o), overlapAlong = s === 'n' || s === 's' ? Math.min(br.x1, r.x1) - Math.max(br.x0, r.x0) : Math.min(br.z1, r.z1) - Math.max(br.z0, r.z0);
      const gap = s === 'n' ? br.z0 - r.z1 : s === 's' ? r.z0 - br.z1 : s === 'e' ? r.x0 - br.x1 : br.x0 - r.x1;
      if (overlapAlong > 0.05 && gap > 0.02) best = Math.min(best, gap - 0.3);
    }
  }
  return Math.max(0, best);
}

/** Software turns Terra's decisions into the complete, measured Stage 4 spec. Never moves a wall or changes a room. */
export function deriveStage4(base: HouseSpec, d: AnyExteriorDesign): {spec: HouseSpec; derivation: Derivation; findings: Finding[]} {
  const findings = exteriorIssues(base, d), adjustments: Adjustment[] = [], derivation: Derivation = {adjustments, roofs: [], doors: []};
  if (findings.length) return {spec: base, derivation, findings};
  const roofable = new Set(roofableBlocks(base).map(b => b.id)), fin = new Map(d.blockFinishes.map(x => [x.block, x.finish]));
  const roofOf = new Map(d.roofs.map(r => [r.block, r])), walls = exteriorWalls(base);
  const rf = COLORS.roof[d.roofFinish], plaster = COLORS.wall[d.wallFinish], stone = COLORS.stone[d.stone], timber = COLORS.timber[d.timber];
  for (const r of d.roofs) if (!roofable.has(r.block)) adjustments.push({subject: r.block, what: 'Roof ignored: this block lies under an upper volume and is a roof terrace.'});
  const blocks = base.blocks.map(b => {
    const r = roofOf.get(b.id), finish = fin.get(b.id) ?? 'stucco';
    const wall = finish === 'stone' ? {wall: 'limestone' as const, wallColor: stone} : finish === 'timber-clad' ? {wall: 'timber' as const, wallColor: timber} : {wall: 'ivory' as const, wallColor: plaster};
    if (!r || !roofable.has(b.id)) return {...b, ...wall};
    const requestedEave = EAVE_M[r.eaves], clearance = eaveClearance(base, b), eave = +Math.min(requestedEave, clearance).toFixed(2);
    if (eave < requestedEave) adjustments.push({subject: b.id, what: `Eaves reduced from ${requestedEave} m to ${eave} m: only ${clearance.toFixed(2)} m of clear space (site edge or neighbouring volume).`});
    const half = Math.min(b.w, b.d) / 2, rise = r.form === 'flat' ? undefined : +Math.min(5, Math.max(0.6, Math.tan(r.pitchDeg * Math.PI / 180) * half)).toFixed(2);
    derivation.roofs.push({block: b.id, form: r.form, pitchDeg: r.form === 'flat' ? 0 : r.pitchDeg, rise: rise ?? 0, eave, requestedEave});
    return {...b, ...wall, roof: {form: r.form, ...(rise ? {rise} : {}), overhang: eave, material: r.form === 'flat' ? ('limestone' as const) : rf.material, color: r.form === 'flat' ? stone : rf.color}};
  });
  const facades: Record<string, 'glass-wall' | 'large-windows' | 'punched' | 'solid'> = {};
  for (const x of d.facades) facades[`${x.block}:${x.side}`] = x.style;
  // Doors: widths are derived from the measured free wall, never authored.
  const mainWall = walls.find(w => w.room === d.entrance.room && w.side === d.entrance.side)!;
  const doors: HouseSpec['exterior']['doors'] = [{id: 'main-entrance', room: d.entrance.room, side: d.entrance.side, kind: 'main', width: Math.min(1.8, +(mainWall.free - 1.2).toFixed(2)), t: 0.5}];
  for (const dr of d.doors) {
    const w = walls.find(x => x.room === dr.room && x.side === dr.side)!, want = dr.kind === 'garden' ? 2.4 : 1.8, width = +Math.min(want, w.free - 1.2).toFixed(2);
    if (width < want) adjustments.push({subject: `${dr.room}:${dr.side}`, what: `Door width reduced from ${want} m to ${width} m to fit the ${w.free} m free wall.`});
    doors.push({id: `door-${dr.room}-${dr.side}`, room: dr.room, side: dr.side, kind: 'garden', width, t: 0.5});
  }
  doors.forEach(x => derivation.doors.push({id: x.id, room: x.room, side: x.side, kind: x.kind, width: x.width}));
  // Entrance: canopy and court sizes derive from the foyer's measured wall.
  const canopyDepth = {none: 0, shallow: 1.8, deep: 3.2}[d.entrance.canopy], canopyWidth = Math.min({none: 2, shallow: 3.6, deep: 5.4}[d.entrance.canopy], Math.max(2, mainWall.run - 0.2));
  const entrance = {door: 'main-entrance', canopy: {depth: canopyDepth, width: canopyWidth, material: 'timber' as const}, court: d.entrance.court === 'generous' ? {w: 7, d: 6} : {w: 5, d: 4}};
  // Each veranda spans exactly the measured open space on its host block.
  const verandas = verandaChoices(d).map(choice => {
    const os = base.openSpaces.find(o => o.id === choice.openSpace)!, host = base.blocks.find(b => b.id === os.host)!, hr = blockRect(host), [hlo, hhi] = sideRun(hr, os.side);
    const alongC = os.side === 'n' || os.side === 's' ? os.cx : os.cz, alongW = os.side === 'n' || os.side === 's' ? os.w : os.d;
    const from = Math.max(hlo, alongC - alongW / 2), to = Math.min(hhi, alongC + alongW / 2), depth = os.side === 'n' || os.side === 's' ? os.d : os.w;
    const columns = Math.max(2, Math.min(10, Math.round((to - from) / (choice.spacing === 'tight' ? 2.4 : 3.6)) + 1));
    return {id: os.id, block: host.id, side: os.side, from: +from.toFixed(2), to: +to.toFixed(2), depth, columns, roofMaterial: choice.roof, deckMaterial: choice.deck, columnMaterial: ({'slender-bronze': 'bronze', 'stone-piers': 'limestone', 'timber-posts': 'timber'} as const)[choice.columns], beams: choice.ceiling === 'timber-beams'};
  });
  if (verandas[0]) derivation.veranda = {from: verandas[0].from, to: verandas[0].to, depth: verandas[0].depth, columns: verandas[0].columns};
  const trim: Trim = {windowTrim: d.windowTrim, railing: d.railing, plinth: d.details.plinth, cornice: d.details.cornice, portal: d.entrance.portal, stoneColor: stone, timberColor: timber, plasterColor: plaster, canopy: d.entrance.canopy};
  const spec: HouseSpec = {...base, blocks, exterior: {facades, doors, entrance, verandas}, trim};
  const post = [...validateExterior(spec)];
  for (const v of verandas) {
    const os = base.openSpaces.find(o => o.id === v.id)!, deck = verandaRect(spec, os.id);
    const r = {x0: os.cx - os.w / 2, x1: os.cx + os.w / 2, z0: os.cz - os.d / 2, z1: os.cz + os.d / 2};
    // v1 kept its original north/south rule; v2 requires the constructed deck to equal the open space on every side.
    const off = !deck ? false : 'verandas' in d ? Math.max(Math.abs(deck.x0 - r.x0), Math.abs(deck.x1 - r.x1), Math.abs(deck.z0 - r.z0), Math.abs(deck.z1 - r.z1)) > 0.06
      : Math.abs(deck.z0 - r.z0) > 0.06 && (os.side === 's' || os.side === 'n');
    if (off) post.push(f('veranda-offset', os.id, `Open space ${os.id} does not touch its host wall; veranda would not sit against the building.`));
  }
  return {spec, derivation, findings: post};
}

// ---------------------------------------------------------------------------------------------
// Quality measurement: geometry is valid != design is good. These are measured design indicators.
// ---------------------------------------------------------------------------------------------
export interface Warning {area: 'roof' | 'openings' | 'facade-depth' | 'massing' | 'room-plan'; severity: 'note' | 'warning'; subject: string; message: string}
const rule = (type: string) => ({bedroom: {min: 12, dim: 3.2}, media: {min: 18, dim: 3.4}, lounge: {min: 16, dim: 3.2}, bath: {min: 4.5, dim: 2.0}, living: {min: 28, dim: 4.5}} as Record<string, {min: number; dim: number}>)[type];

/** Stage 3 plan-quality warnings. They are NOT fixed by Stage 4; walls are never moved to beautify the exterior. */
export function roomPlanWarnings(spec: HouseSpec, requested: Record<string, number> = {}): Warning[] {
  const out: Warning[] = [];
  for (const r of allRooms(spec)) {
    const w = r.x1 - r.x0, d = r.z1 - r.z0, a = w * d, lo = Math.min(w, d), hi = Math.max(w, d), q = rule(r.type), tag = `${r.id} (${r.type}, ${w.toFixed(1)}×${d.toFixed(1)} m = ${a.toFixed(1)} m²)`;
    const want = requested[r.id];
    if (want && a < want * 0.75) out.push({area: 'room-plan', severity: 'warning', subject: r.id, message: `${tag} received only ${Math.round(100 * a / want)}% of the ${want} m² Terra asked for (the block could not give more).`});
    if (q && a < q.min) out.push({area: 'room-plan', severity: 'warning', subject: r.id, message: `${tag} is small for a ${r.type} in a luxury villa (comfortable minimum ${q.min} m²).`});
    if (q && lo < q.dim) out.push({area: 'room-plan', severity: 'warning', subject: r.id, message: `${tag} is narrow: shorter side ${lo.toFixed(1)} m (comfortable ${q.dim} m).`});
    if ((r.type === 'hall' || r.type === 'gallery') && hi / lo > 3.2) out.push({area: 'room-plan', severity: 'warning', subject: r.id, message: `${tag} is a long thin circulation space (${(hi / lo).toFixed(1)}:1).`});
    else if (!['hall', 'gallery'].includes(r.type) && hi / lo > 2.6) out.push({area: 'room-plan', severity: 'warning', subject: r.id, message: `${tag} is awkwardly elongated (${(hi / lo).toFixed(1)}:1).`});
  }
  return out;
}

type Placed = {id: string; kind: string; at: number[]; size: number[]; rotation: number; roofForm?: string; eaves?: Record<string, number>; opening?: {width: number; height: number; sill: number; glazed: boolean}};
export interface ExteriorMetrics {
  roofs: {block: string; form: string; nominalPitchDeg: number; rise: number; ridgeHeight: number; riseToWallHeight: number; eaves: Record<string, number>; maxEave: number}[];
  openings: {total: number; glazed: number; minWidth: number; minHeight: number; slits: number; medianHeightToWidth: number; byFacade: Record<string, {windows: number; doors: number; glazedAreaRatio: number; wallArea: number; maxRelief: number; reliefLayers: string[]}>};
  massing: {distinctRoofForms: string[]; distinctRidgeHeights: number; tallestRoofBlock: string; largestMassBlock: string; materials: string[]; trimElements: number; elementCount: number};
  entrance: {canopyDepth: number; portal: boolean; stoneColumns: boolean; roofFormOverEntrance: string};
  warnings: Warning[];
}

export function measureExterior(spec: HouseSpec, scene: ArchitecturalScene, stage3Warnings: Warning[] = roomPlanWarnings(spec)): ExteriorMetrics {
  const els = scene.elements as unknown as Placed[], warnings: Warning[] = [];
  const roofs = els.filter(e => e.kind === 'roof' && e.id.startsWith('roof-')).map(e => {
    const b = spec.blocks.find(x => `roof-${x.id}` === e.id)!, eaves = Object.fromEntries(Object.entries(e.eaves ?? {})) as Record<string, number>, wallTop = levelTop(b.level) + WALL_H;
    const pitched = e.roofForm && e.roofForm !== 'flat', rise = pitched ? e.size[1] : 0, nominal = pitched ? Math.atan(rise / (Math.min(b.w, b.d) / 2)) * 180 / Math.PI : 0;
    const maxEave = Math.max(0, ...Object.values(eaves), pitched ? 0 : b.roof.overhang);
    const m = {block: b.id, form: e.roofForm ?? 'flat', nominalPitchDeg: +nominal.toFixed(1), rise: +rise.toFixed(2), ridgeHeight: +(wallTop + rise).toFixed(2), riseToWallHeight: +(rise / WALL_H).toFixed(2), eaves, maxEave};
    if (pitched && (nominal < 17 || nominal > 36)) warnings.push({area: 'roof', severity: 'warning', subject: b.id, message: `Pitch ${nominal.toFixed(0)}° is outside the 17-36° Mediterranean range.`});
    if (pitched && maxEave < 0.7) warnings.push({area: 'roof', severity: 'warning', subject: b.id, message: `Eaves reach only ${maxEave.toFixed(2)} m; the brief asks for deep eaves (≥0.7 m).`});
    if (pitched && Object.values(eaves).some(v => v === 0) && Object.values(eaves).every(v => v === 0)) warnings.push({area: 'roof', severity: 'warning', subject: b.id, message: 'This roof has no eaves on any side.'});
    return m;
  });
  // Facade statistics from the actual cut openings and relief elements.
  const faces: ExteriorMetrics['openings']['byFacade'] = {}, hw: number[] = [];
  const walls = els.filter(e => e.kind === 'wall' && /^w-/.test(e.id));
  let total = 0, glazed = 0, minW = 99, minH = 99, slits = 0;
  const sideOf = (e: Placed, b: Block) => { const horiz = Math.abs(e.rotation) < 0.01, br = blockRect(b); return horiz ? (e.at[2] < (br.z0 + br.z1) / 2 ? 'n' : 's') : (e.at[0] < (br.x0 + br.x1) / 2 ? 'w' : 'e'); };
  const blockOfRoom = new Map(allRooms(spec).map(r => [r.id, r.block]));
  for (const w of walls) {
    const room = w.id.split('-').slice(1, -2).join('-'), blockId = blockOfRoom.get(room);
    const b = spec.blocks.find(x => x.id === blockId);
    if (!b) continue;
    const key = `${b.id}:${sideOf(w, b)}`, face = faces[key] ??= {windows: 0, doors: 0, glazedAreaRatio: 0, wallArea: 0, maxRelief: 0, reliefLayers: []};
    face.wallArea += w.size[0] * w.size[1];
    if (w.opening) {
      const o = w.opening, isDoor = o.sill < 0.05 && o.height >= 2.3;
      face.glazedAreaRatio += o.width * o.height;
      if (isDoor) face.doors++; else { face.windows++; total++; if (o.glazed) glazed++; minW = Math.min(minW, o.width); minH = Math.min(minH, o.height); hw.push(o.height / o.width); if (o.width < 0.9 || o.height < 1.2) slits++; }
    }
  }
  for (const v of Object.values(faces)) { v.glazedAreaRatio = +(v.glazedAreaRatio / Math.max(1, v.wallArea)).toFixed(2); v.wallArea = +v.wallArea.toFixed(1); }
  // Relief (depth) layers per block side from trim and structural elements.
  const relief = (id: string, depth: number, layer: string) => {
    const m = /^(?:plinth|cornice)-(.+)-([nsew])-\d+$/.exec(id); if (!m) return;
    const f2 = faces[`${m[1]}:${m[2]}`]; if (!f2) return; f2.maxRelief = Math.max(f2.maxRelief, depth); if (!f2.reliefLayers.includes(layer)) f2.reliefLayers.push(layer);
  };
  for (const e of els) { if (e.id.startsWith('plinth-')) relief(e.id, 0.12, 'plinth'); if (e.id.startsWith('cornice-')) relief(e.id, 0.18, 'cornice'); }
  for (const [k, v] of Object.entries(faces)) {
    const b = spec.blocks.find(x => x.id === k.split(':')[0])!, s = k.split(':')[1] as Side, br = blockRect(b), run = sideRun(br, s);
    const eave = roofs.find(r => r.block === b.id)?.eaves[{n: 'north', s: 'south', e: 'east', w: 'west'}[s]] ?? 0;
    if (eave > 0) { v.maxRelief = Math.max(v.maxRelief, eave); v.reliefLayers.push('eave'); }
    const lintels = els.some(e => e.id.startsWith('lintel-')); if (lintels && v.windows) { v.maxRelief = Math.max(v.maxRelief, 0.2); v.reliefLayers.push('window surrounds'); }
    if (run[1] - run[0] > 4 && v.maxRelief < 0.15) warnings.push({area: 'facade-depth', severity: 'warning', subject: k, message: `The ${run[1] - run[0]} m ${s} facade of ${b.id} has almost no relief (${v.maxRelief.toFixed(2)} m): it will read as a flat plane.`});
    if (v.wallArea > 25 && v.glazedAreaRatio < 0.1) warnings.push({area: 'openings', severity: 'note', subject: k, message: `Mostly blank facade (${Math.round(v.glazedAreaRatio * 100)}% glazed).`});
    if (v.glazedAreaRatio > 0.75) warnings.push({area: 'openings', severity: 'note', subject: k, message: `Almost fully glazed (${Math.round(v.glazedAreaRatio * 100)}%).`});
  }
  if (slits) warnings.push({area: 'openings', severity: 'warning', subject: 'openings', message: `${slits} windows are slit-like (<0.9 m wide or <1.2 m tall).`});
  const sortedHW = hw.sort((a, b) => a - b), medHW = sortedHW[Math.floor(sortedHW.length / 2)] ?? 0;
  if (medHW < 0.9) warnings.push({area: 'openings', severity: 'warning', subject: 'openings', message: `Median window is wider than tall (h/w ${medHW.toFixed(2)}); Mediterranean proportion is vertical.`});
  const forms = [...new Set(roofs.map(r => r.form))], ridges = new Set(roofs.map(r => r.ridgeHeight.toFixed(1)));
  const tallest = [...roofs].sort((a, b) => b.ridgeHeight - a.ridgeHeight)[0], largest = [...spec.blocks].sort((a, b) => b.w * b.d - a.w * a.d)[0];
  if (forms.length < 2 && roofs.length > 2) warnings.push({area: 'roof', severity: 'warning', subject: 'roofs', message: 'Every roof has the same form: weak roof hierarchy.'});
  if (ridges.size < 2 && roofs.length > 1) warnings.push({area: 'roof', severity: 'warning', subject: 'roofs', message: 'All ridges are at the same height: no vertical hierarchy.'});
  const mat = [...new Set(els.filter(e => ['wall', 'volume'].includes(e.kind)).map(e => (e as unknown as {material: string}).material))];
  const en = els.find(e => e.id === 'entrance-canopy'), entranceBlock = spec.blocks.find(b => b.id === allRooms(spec).find(r => r.id === spec.exterior.doors.find(d => d.id === spec.exterior.entrance.door)?.room)?.block);
  const trimCount = els.filter(e => /^(plinth|cornice|lintel|sill|shutter|entrance-pier|entrance-lintel|coping)/.test(e.id)).length;
  if (els.length > 380) warnings.push({area: 'facade-depth', severity: 'note', subject: 'scene', message: `Scene uses ${els.length} of 400 allowed elements; some trim (e.g. shutters) may have been dropped.`});
  const bigTerraces = terraceBlocks(spec);
  for (const t of bigTerraces) warnings.push({area: 'roof', severity: 'note', subject: t.id, message: `${t.id} lies under an upper volume and has no pitched roof: it reads as a flat roof terrace (renderer limitation: no pitched roof over an L-shaped uncovered area).`});
  return {
    roofs, openings: {total, glazed, minWidth: +minW.toFixed(2), minHeight: +minH.toFixed(2), slits, medianHeightToWidth: +medHW.toFixed(2), byFacade: faces},
    massing: {distinctRoofForms: forms, distinctRidgeHeights: ridges.size, tallestRoofBlock: tallest?.block ?? '', largestMassBlock: largest.id, materials: mat, trimElements: trimCount, elementCount: els.length},
    entrance: {canopyDepth: en?.size[2] ?? 0, portal: els.some(e => e.id === 'entrance-pier-a'), stoneColumns: els.some(e => e.id === 'entrance-column-a' && (e as unknown as {material: string}).material === 'limestone'), roofFormOverEntrance: roofs.find(r => r.block === entranceBlock?.id)?.form ?? 'none'},
    warnings: [...warnings, ...stage3Warnings],
  };
}
export type {Room};
