import {outdoorKind,resolvedPoolIntent} from './intentions';
import {poolNearDeck} from './poolGeometry';
import {assemblyOperations} from '../scene/assemblies';
import {validateScene, type ArchitecturalScene, type SceneElement} from '../scene/model';
import {elementCap, groupBoxes, chunks} from './grouping';
import {
  SIDES, allRooms, blockRect, layoutRooms, rectDiff, roomEdges, roomSideInterval, sideLine, sideRun, snap, subtractIntervals,
  type R, type Room,
} from './layout';
import {buildTrimBudgeted, type OpeningRec} from './exteriorTrim';
import {SLAB, STOREY, WALL_H, levelTop, wallHeight, wallTopOf, type Block, type FacadeStyle, type HouseSpec, type Mat, type RoofSpec, type Side} from './spec';
import {neighbourStopsEave} from './heights';

export type Stage = 2 | 3 | 4 | 5;
export {ELEMENT_CAP, elementCap, groupBoxes, chunks} from './grouping';
export interface ElementBudget {cap: number; total: number; architecture: number; site: number; trimRequested: number; trimPlaced: number; trimDropped: number}
/** Required architecture (and site) cannot fit the scene: never silently dropped, always reported. */
export class ElementBudgetError extends Error {constructor(readonly budget: Omit<ElementBudget, 'total' | 'trimPlaced' | 'trimDropped'>) { super(`Element budget exceeded: required architecture ${budget.architecture} + site ${budget.site} elements exceed the ${budget.cap}-element scene limit. Simplify the composition (fewer volumes, rooms or landscape pieces).`); }}
export interface Compiled {
  /** Present from Stage 4 (when decorative trim is budgeted). */
  budget?: ElementBudget;
  scene: ArchitecturalScene;
  /** elementId -> component id (`room:x`, `block:x`, `roof:x`, `stair:x`, `entrance`, `veranda:x`, `pool`, `landscape:x`). */
  components: Record<string, string>;
}

const EXT = 0.3, PARTY = 0.12, DOOR_W = 1.0, DOOR_H = 2.2;
const TREAD_GOING = 0.27, TREADS = 17;

type Extra = Partial<SceneElement>;

export function compileHouse(spec: HouseSpec, stage: Stage): Compiled {
  const elements: SceneElement[] = [];
  const components: Record<string, string> = {};
  const add = (comp: string, id: string, kind: SceneElement['kind'], at: [number, number, number], size: [number, number, number], extra: Extra = {}) => {
    if (components[id]) throw Error(`Duplicate staged element id ${id}`);
    components[id] = comp;
    elements.push({id, label: id.replaceAll('-', ' '), kind, at: at.map(snap) as [number, number, number], size: size.map(v => snap(v)) as [number, number, number], rotation: 0, material: 'ivory', panels: 4, ...extra} as SceneElement);
  };
  const blocks = spec.blocks, byId = new Map(blocks.map(b => [b.id, b]));
  const T = spec.trim, openings: OpeningRec[] = [], G = spec.construction === 'scale-1', CAP = elementCap(spec);
  /** One grouped component element (scale-1): repetitive boxes under a single selectable identity. */
  const addGroup = (comp: string, id: string, boxes: {at: [number, number, number]; size: [number, number, number]}[], extra: Extra = {}) => {
    const g = groupBoxes(boxes);
    add(comp, id, 'volume', g.at, g.size, {...extra, parts: g.parts});
  };
  const revised = T?.visualRevision === 'stage4-v2';
  // Trim previously used global ordinal IDs. Keep those ordinals tied to the original wall ID,
  // so a merged/added window cannot transfer a saved lintel selection to a different block.
  const originalWindows = revised ? compileHouse({...spec, trim: {...T, visualRevision: undefined}}, stage).scene.elements.filter(e => e.kind === 'wall' && e.opening?.glazed) : [];
  const trimIndices = new Map(originalWindows.map((e, i) => [e.id, i]));
  let newTrimIndex = originalWindows.length;
  const finish = (b: Block): Extra => stage >= 5 || T ? {material: b.wall, ...(b.wallColor ? {color: b.wallColor} : {}),
    ...(revised && b.wall === 'limestone' ? {appearance: 'cut-limestone', color: '#B9A486'} : revised && b.wall === 'ivory' ? {appearance: 'painted-stucco'} : {})} : {};

  if (stage === 2) {
    for (const b of blocks) {
      const base = levelTop(b.level) - SLAB, h = SLAB + wallHeight(b);
      add(`block:${b.id}`, `mass-${b.id}`, 'volume', [b.cx, base + h / 2, b.cz], [b.w, h, b.d], {material: b.level ? 'limestone' : 'ivory', semanticType: 'mass', aliases: [b.role.slice(0, 80)]});
    }
    for (const o of spec.openSpaces ?? []) add(`open:${o.id}`, `open-${o.id}`, 'plate', [o.cx, 0.03, o.cz], [o.w, 0.06, o.d], {material: 'limestone', semanticType: 'terrace', aliases: [o.role.slice(0, 80)],...(stage<5&&outdoorKind(o)==='pool'?{label:`Pool intention ${o.id} — reserved, not constructed`}:{})});
    return finalize(spec, elements, components);
  }

  // Open architectural spaces keep their position/size/identity as a ground-level pad until stage 4 builds them.
  for (const o of spec.openSpaces ?? []) if ((stage < 5 || resolvedPoolIntent(spec)?.id!==o.id) && (stage < 4 || !spec.exterior.verandas.some(v => v.id === o.id)))
    add(`open:${o.id}`, `open-${o.id}`, 'plate', [o.cx, 0.03, o.cz], [o.w, 0.06, o.d], {material: 'limestone', semanticType: 'terrace', aliases: [o.role.slice(0, 80)],...(stage<5&&outdoorKind(o)==='pool'?{label:`Pool intention ${o.id} — reserved, not constructed`}:{})});

  const rooms = allRooms(spec), roomById = new Map(rooms.map(r => [r.id, r]));
  const edges = roomEdges(rooms);
  const linkOf = (a: string, b: string) => spec.links.find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
  const roomBlock = (r: Room) => byId.get(r.block)!;

  // ---- Stair geometry (needed by slab voids) ----
  const stairs = spec.stairs.map(s => {
    const room = roomById.get(s.room)!, b = roomBlock(room), r = blockRect(b);
    const clear = (side: Side) => Math.abs(sideLine(room, side) - sideLine(r, side)) < 1e-4 ? EXT + 0.02 : PARTY / 2 + 0.02;
    const alongZ = s.start === 'n' || s.start === 's';
    const rise = STOREY / (TREADS + 1);
    const m = 0.4;
    let strip: R, void_: R, landing: R;
    if (alongZ) {
      const x0 = s.hug === 'e' ? room.x1 - m - s.width : room.x0 + m, run = TREADS * TREAD_GOING;
      const z0 = s.start === 'n' ? room.z0 + m : room.z1 - m - run;
      strip = {x0, x1: x0 + s.width, z0, z1: z0 + run};
      void_ = {x0: room.x0 + clear('w'), x1: room.x1 - clear('e'), z0: s.start === 'n' ? room.z0 + clear('n') : strip.z0, z1: s.start === 'n' ? strip.z1 : room.z1 - clear('s')};
      landing = {x0: room.x0, x1: room.x1, z0: s.start === 'n' ? strip.z1 : room.z0, z1: s.start === 'n' ? room.z1 : strip.z0};
    } else {
      const z0 = s.hug === 's' ? room.z1 - m - s.width : room.z0 + m, run = TREADS * TREAD_GOING;
      const x0 = s.start === 'w' ? room.x0 + m : room.x1 - m - run;
      strip = {x0, x1: x0 + run, z0, z1: z0 + s.width};
      void_ = {x0: s.start === 'w' ? room.x0 + clear('w') : strip.x0, x1: s.start === 'w' ? strip.x1 : room.x1 - clear('e'), z0: room.z0 + clear('n'), z1: room.z1 - clear('s')};
      landing = {x0: s.start === 'w' ? strip.x1 : room.x0, x1: s.start === 'w' ? room.x1 : strip.x0, z0: room.z0, z1: room.z1};
    }
    return {...s, room, strip, void: void_, landing, alongZ, rise};
  });

  // ---- Slabs ----
  const upper = blocks.filter(b => b.level === 1), lower = blocks.filter(b => b.level === 0);
  const voids = stairs.map(s => s.void);
  const covered = (b: Block) => upper.some(u => overlap(blockRect(u), blockRect(b)) > 0.01);
  const slab = (comp: string, id: string, r: R, top: number, b: Block, mat?: Mat) => add(comp, id, 'plate', [(r.x0 + r.x1) / 2, top - SLAB / 2, (r.z0 + r.z1) / 2], [r.x1 - r.x0, SLAB, r.z1 - r.z0], {semanticType: 'floor', material: mat ?? 'limestone', ...(stage >= 5 && !mat ? {} : {})});
  for (const b of lower) slab(`block:${b.id}`, `slab-${b.id}`, blockRect(b), levelTop(0), b);
  const lowerRects = lower.map(blockRect);
  for (const b of lower.filter(covered)) rectDiff(blockRect(b), voids).forEach((p, i) => slab(`block:${b.id}`, `slab-up-${b.id}${i ? `-${i}` : ''}`, p, levelTop(1), b));
  for (const b of upper) rectDiff(blockRect(b), [...lowerRects, ...voids]).forEach((p, i) => slab(`block:${b.id}`, `slab-up-${b.id}-c${i}`, p, levelTop(1), b));

  // ---- Walls ----
  const owner = (a: Room, b: Room) => a.block <= b.block ? a : b;
  const wall = (comp: string, id: string, level: number, axis: 'x' | 'z', line: number, lo: number, hi: number, thick: number, b: Block, opening?: {c: number; sill: number; width: number; height: number; glazed: boolean}, door?: {width: number; height: number; material?: Mat}, extra: Extra = {}, H = wallHeight(b)) => {
    const centre = (lo + hi) / 2, y = levelTop(level) + H / 2;
    add(comp, id, 'wall', axis === 'x' ? [centre, y, line] : [line, y, centre], [hi - lo, H, thick], {
      rotation: axis === 'x' ? 0 : -Math.PI / 2, semanticType: 'wall', ...(T && id.startsWith('p-') ? {} : finish(b)), ...extra,
      ...(opening ? {opening: {x: snap(opening.c - centre), sill: opening.sill, width: snap(opening.width), height: opening.height, glazed: opening.glazed}} : {}),
      ...(revised && id.startsWith('w-') && opening?.glazed ? {panels: opening.width < 1.4 ? 1 : 2} : {}),
    });
    if (opening && stage >= 4) openings.push({level, axis, line, c: opening.c, sill: opening.sill, width: opening.width, height: opening.height, door: !!door, block: b.id, main: comp === 'entrance', ...(revised && !door ? {trimIndex: trimIndices.get(id) ?? newTrimIndex++} : {})});
    if (opening && door) add(comp, `${id}-door`, 'entrance', [snap(opening.c - centre), (-H + door.height) / 2, 0], [door.width, door.height, 0.06], {
      parent: id, material: door.material ?? 'timber', semanticType: comp === 'entrance' ? 'front-door' : id.startsWith('p-') ? 'interior-door' : 'exterior-door',
      ...(revised && id.startsWith('w-') ? {appearance: comp === 'entrance' ? 'timber-door' : 'glazed-door', panels: 2, color: comp === 'entrance' ? T.timberColor : '#62594B'} : {}),
    });
  };

  // Party walls and doors between rooms.
  for (const e of edges) {
    const a = roomById.get(e.a)!, b = roomById.get(e.b)!, link = linkOf(e.a, e.b);
    const o = e.sameBlock ? a : owner(a, b), ob = roomBlock(o), or = blockRect(ob);
    const thick = e.sameBlock ? PARTY : EXT;
    let line = e.line;
    if (!e.sameBlock) { const toward = e.axis === 'x' ? (o === a ? -1 : 1) : (o === a ? -1 : 1); line = e.line + toward * EXT / 2; }
    const [bl, bh] = e.axis === 'x' ? [or.z0, or.z1] : [or.x0, or.x1];
    const lo = e.lo <= bl + 1e-4 ? e.lo + EXT : e.lo, hi = e.hi >= bh - 1e-4 ? e.hi - EXT : e.hi;
    // Volumes of different heights: the shared wall rises to the lower eave; the taller volume's exposed upper
    // wall (its facade above the lower roof) is a separate band inside the taller block, in its own finish.
    const ha = wallHeight(roomBlock(a)), hb = wallHeight(roomBlock(b)), lowH = Math.min(ha, hb);
    if (!e.sameBlock && Math.abs(ha - hb) > 1e-6 && hi - lo >= 0.2) {
      const tall = ha > hb ? a : b, tb = roomBlock(tall), toward = e.axis === 'x' ? (tall === a ? -1 : 1) : (tall === a ? -1 : 1), bandLine = e.line + toward * EXT / 2;
      const bandH = Math.max(ha, hb) - lowH, c = (lo + hi) / 2, y = levelTop(a.level) + lowH + bandH / 2, axis = e.axis === 'x' ? 'z' : 'x';
      add(`block:${tb.id}`, `band-${a.id}-${b.id}`, 'wall', axis === 'x' ? [c, y, bandLine] : [bandLine, y, c], [hi - lo, bandH, EXT], {rotation: axis === 'x' ? 0 : -Math.PI / 2, semanticType: 'wall', ...finish(tb)});
    }
    if (link?.kind === 'open') continue;
    if (hi - lo < 0.2) continue;
    const door = link?.kind === 'door' ? {c: snap(Math.min(hi - DOOR_W / 2 - 0.15, Math.max(lo + DOOR_W / 2 + 0.15, lo + link.t * (hi - lo))))} : undefined;
    if (link?.kind === 'door' && hi - lo < DOOR_W + 0.3) continue;
    wall(`room:${a.id}`, `p-${a.id}-${b.id}`, a.level, e.axis === 'x' ? 'z' : 'x', line, lo, hi, thick, ob,
      door ? {c: door.c, sill: 0, width: DOOR_W, height: DOOR_H, glazed: false} : undefined, door ? {width: DOOR_W - 0.06, height: DOOR_H - 0.04} : undefined,
      e.sameBlock ? {} : {}, e.sameBlock ? wallHeight(ob) : lowH);
  }

  // Exterior walls per room run, with openings from facade styles (stage 4+).
  for (const b of blocks) {
    const br = blockRect(b);
    for (const room of layoutRooms(b)) for (const side of SIDES) {
      const iv = roomSideInterval(room, br, side);
      if (!iv) continue;
      const axisEdge = side === 'n' || side === 's' ? 'z' : 'x';
      const covers = edges.filter(e => (e.a === room.id || e.b === room.id) && e.axis === axisEdge && Math.abs(e.line - sideLine(br, side)) < 1e-4).map(e => [e.lo, e.hi] as [number, number]);
      const free = subtractIntervals(iv[0], iv[1], covers);
      const style: FacadeStyle = spec.exterior.facades[`${b.id}:${side}`] ?? 'large-windows';
      const doors = stage >= 4 ? spec.exterior.doors.filter(d => d.room === room.id && d.side === side) : [];
      let n = 0;
      for (const [flo, fhi] of free) {
        // Corner trim: east/west walls stop at the north/south walls.
        const [lo0, hi0] = side === 'n' || side === 's' ? [flo, fhi] : [Math.abs(flo - br.z0) < 1e-4 ? flo + EXT : flo, Math.abs(fhi - br.z1) < 1e-4 ? fhi - EXT : fhi];
        const pieces = splitForDoors(lo0, hi0, doors, G);
        for (const p of pieces) {
          const line = side === 'n' ? br.z0 + EXT / 2 : side === 's' ? br.z1 - EXT / 2 : side === 'e' ? br.x1 - EXT / 2 : br.x0 + EXT / 2;
          const axis = side === 'n' || side === 's' ? 'x' : 'z';
          const legacyCount = bays(p, style, room, stage >= 4, side, b, !!T).length;
          const nextBays = heightBays(bays(p, style, room, stage >= 4, side, b, !!T, revised, G), b, style, G);
          for (const [i, [lo, hi, opening, door]] of nextBays.entries()) {
            wall(p.door?.kind === 'main' ? 'entrance' : `room:${room.id}`, `w-${room.id}-${side}-${n + i}`, b.level, axis, line, lo, hi, EXT, b, opening, door);
          }
          // Reserve the original slots so downstream doors retain their element IDs when windows merge.
          n += Math.max(legacyCount, nextBays.length);
        }
      }
    }
  }

  // ---- Stairs (treads + void guard) ----
  for (const s of stairs) {
    const treads: {at: [number, number, number]; size: [number, number, number]}[] = [];
    for (let i = 1; i <= TREADS; i++) {
      const h = i * s.rise, g = TREAD_GOING;
      const cx = s.alongZ ? (s.strip.x0 + s.strip.x1) / 2 : (s.start === 'w' ? s.strip.x0 + (i - 0.5) * g : s.strip.x1 - (i - 0.5) * g);
      const cz = s.alongZ ? (s.start === 'n' ? s.strip.z0 + (i - 0.5) * g : s.strip.z1 - (i - 0.5) * g) : (s.strip.z0 + s.strip.z1) / 2;
      if (G) treads.push({at: [cx, SLAB + h / 2, cz], size: s.alongZ ? [s.width, h, g] : [g, h, s.width]});
      else add(`stair:${s.id}`, `stair-${s.id}-${i}`, 'volume', [cx, SLAB + h / 2, cz], s.alongZ ? [s.width, h, g] : [g, h, s.width], {semanticType: 'stair', material: 'timber'});
    }
    // scale-1: the whole flight is one stair component (17 treads as parts).
    if (G) addGroup(`stair:${s.id}`, `stair-${s.id}`, treads, {semanticType: 'stair', material: 'timber'});
    // Guard on the open landing edge, leaving the stair exit clear.
    const gh = 1.0, y = levelTop(1) + gh / 2;
    if (s.alongZ) {
      const z = s.start === 'n' ? s.void.z1 + 0.05 : s.void.z0 - 0.05;
      const [x0, x1] = s.hug === 'e' ? [s.void.x0, s.strip.x0 - 0.1] : [s.strip.x1 + 0.1, s.void.x1];
      if (x1 - x0 > 0.3) add(`stair:${s.id}`, `guard-${s.id}`, 'balcony', [(x0 + x1) / 2, y, z], [x1 - x0, gh, 0.03]);
    } else {
      const x = s.start === 'w' ? s.void.x1 + 0.05 : s.void.x0 - 0.05;
      const [z0, z1] = s.hug === 's' ? [s.void.z0, s.strip.z0 - 0.1] : [s.strip.z1 + 0.1, s.void.z1];
      if (z1 - z0 > 0.3) add(`stair:${s.id}`, `guard-${s.id}`, 'balcony', [x, y, (z0 + z1) / 2], [z1 - z0, gh, 0.03], {rotation: -Math.PI / 2});
    }
  }

  // Roof terrace guards on exposed edges of covered lower blocks.
  if (stage >= 3) for (const b of lower.filter(covered)) {
    const br = blockRect(b);
    for (const side of SIDES) {
      const [a0, a1] = sideRun(br, side), line = sideLine(br, side);
      const cover: [number, number][] = [];
      for (const o of blocks) {
        if (o.id === b.id) continue;
        const or = blockRect(o);
        if (o.level === 0 && abuts(br, or, side)) cover.push(side === 'n' || side === 's' ? [or.x0, or.x1] : [or.z0, or.z1]);
        if (o.level === 1) {
          // Upper walls standing on this line, or the line lying inside the upper volume.
          if (Math.abs(sideLine(or, side) - line) < 0.05) cover.push(side === 'n' || side === 's' ? [or.x0, or.x1] : [or.z0, or.z1]);
          else if (side === 'n' || side === 's' ? (line > or.z0 && line < or.z1) : (line > or.x0 && line < or.x1)) cover.push(side === 'n' || side === 's' ? [or.x0, or.x1] : [or.z0, or.z1]);
        }
      }
      subtractIntervals(a0, a1, cover).filter(([x, y]) => y - x > 0.4).forEach(([x, y], i) => {
        const inset = side === 'n' || side === 'w' ? 0.08 : -0.08, c = (x + y) / 2, y0 = levelTop(1) + 0.5;
        if (T?.railing === 'parapet') {
          // Masonry parapet in the block finish with a limestone coping (thick, so it reads as architecture, not a rail).
          const p = side === 'n' || side === 's' ? {at: [c, y0, line + inset * 2.2] as [number, number, number], sz: [y - x, 1.0, 0.22] as [number, number, number], rot: 0} : {at: [line + inset * 2.2, y0, c] as [number, number, number], sz: [y - x, 1.0, 0.22] as [number, number, number], rot: -Math.PI / 2};
          add(`block:${b.id}`, `rail-${b.id}-${side}-${i}`, 'volume', p.at, p.sz, {rotation: p.rot, material: 'ivory', color: T.plasterColor});
          add(`block:${b.id}`, `coping-${b.id}-${side}-${i}`, 'volume', [p.at[0], y0 + 0.54, p.at[2]], side === 'n' || side === 's' ? [y - x + 0.1, 0.08, 0.32] : [0.32, 0.08, y - x + 0.1], {material: 'limestone', color: T.stoneColor});
        }
        else if (side === 'n' || side === 's') add(`block:${b.id}`, `rail-${b.id}-${side}-${i}`, 'balcony', [c, y0, line + inset], [y - x, 1.0, 0.03]);
        else add(`block:${b.id}`, `rail-${b.id}-${side}-${i}`, 'balcony', [line + inset, y0, c], [y - x, 1.0, 0.03], {rotation: -Math.PI / 2});
      });
    }
  }

  if (stage >= 4) {
    // ---- Roofs ----
    for (const b of blocks) {
      if (b.level === 0 && covered(b)) continue;
      const caps = canopyCaps(spec)[b.id];
      const [rat, rsz] = roofGeometry(b, blocks, b.roof, caps);
      const presentation: Extra = revised && b.roof.form !== 'flat' ? {
        appearance: b.roof.material === 'bronze' ? 'bronze-roof' : 'clay-roof',
        color: b.roof.material === 'bronze' ? '#887457' : b.roof.color,
        roofWallFinish: {appearance: b.wall === 'limestone' ? 'cut-limestone' : 'painted-stucco', color: b.wall === 'limestone' ? '#B9A486' : b.wallColor ?? T.plasterColor},
      } : {};
      add(`roof:${b.id}`, `roof-${b.id}`, 'roof', rat, rsz, {semanticType: 'roof', ...roofFields(b.roof), ...(b.roof.form !== 'flat' ? {roofForm: b.roof.form, ...pitchedEaves(b, blocks, caps)} : {}), ...presentation});
    }
    // ---- Verandas ----
    for (const v of spec.exterior.verandas) {
      const b = byId.get(v.block)!, br = blockRect(b), line = sideLine(br, v.side);
      const dir = v.side === 'n' || v.side === 'w' ? -1 : 1, horiz = v.side === 'n' || v.side === 's';
      const len = v.to - v.from, c = (v.from + v.to) / 2, mid = line + dir * v.depth / 2;
      // A veranda never rises above its host's eave (a low host lowers it); taller hosts keep the 3 m veranda.
      const vh = Math.min(3.0, wallTopOf(b) - SLAB - 0.1);
      const at = (along: number, across: number, y: number): [number, number, number] => horiz ? [along, y, across] : [across, y, along];
      const sz = (l: number, h: number, dp: number): [number, number, number] => horiz ? [l, h, dp] : [dp, h, l];
      add(`veranda:${v.id}`, `veranda-${v.id}-deck`, 'plate', at(c, mid, SLAB / 2), sz(len, SLAB, v.depth), {material: v.deckMaterial, semanticType: 'terrace'});
      const columnFinish: Extra = {material: v.columnMaterial ?? 'bronze', ...(v.columnMaterial === 'limestone' && T ? {color: T.stoneColor} : v.columnMaterial === 'timber' && T ? {color: T.timberColor} : {})};
      const columns = Array.from({length: v.columns}, (_, i) => ({at: at(v.from + 0.25 + i * (len - 0.5) / (v.columns - 1), line + dir * (v.depth - 0.25), SLAB + vh / 2), size: sz(0.3, vh, 0.3)}));
      // scale-1: a colonnade is one component; its rhythm stays derived from the span.
      if (G) chunks(columns).forEach((c, k) => addGroup(`veranda:${v.id}`, `veranda-${v.id}-columns${k ? `-${k}` : ''}`, c, columnFinish));
      else columns.forEach((c, i) => add(`veranda:${v.id}`, `veranda-${v.id}-column-${i}`, 'volume', c.at, c.size, columnFinish));
      if (v.beams) {
        const nb = Math.max(2, Math.round(len / 1.5)), beamFinish: Extra = {material: 'timber', ...(T ? {color: T.timberColor} : {})};
        const beams = Array.from({length: nb}, (_, i) => ({at: at(v.from + 0.3 + i * (len - 0.6) / (nb - 1), line + dir * (v.depth + 0.3) / 2, SLAB + vh - 0.1 - 0.05), size: sz(0.16, 0.2, v.depth - 0.2)}));
        if (G) chunks(beams).forEach((c, k) => addGroup(`veranda:${v.id}`, `veranda-${v.id}-beams${k ? `-${k}` : ''}`, c, beamFinish));
        else beams.forEach((c, i) => add(`veranda:${v.id}`, `veranda-${v.id}-beam-${i}`, 'volume', c.at, c.size, beamFinish));
      }
      add(`veranda:${v.id}`, `veranda-${v.id}-roof`, 'roof', at(c, line + dir * (v.depth + 0.3) / 2, SLAB + vh + 0.15), sz(len + 0.6, 0.3, v.depth + 0.3), {material: v.roofMaterial, semanticType: 'roof', ...(revised && v.roofMaterial === 'bronze' ? {appearance: 'bronze-roof', color: '#887457'} : {})});
    }
    // ---- Main entrance forecourt and canopy ----
    const door = spec.exterior.doors.find(d => d.id === spec.exterior.entrance.door);
    if (door) {
      const room = roomById.get(door.room)!, b = roomBlock(room), br = blockRect(b), en = spec.exterior.entrance;
      const iv = roomSideInterval(room, br, door.side)!, c = doorCentre(iv, door), line = sideLine(br, door.side), dir = door.side === 'n' || door.side === 'w' ? -1 : 1;
      const horiz = door.side === 'n' || door.side === 's';
      const at = (along: number, across: number, y: number): [number, number, number] => horiz ? [along, y, across] : [across, y, along];
      const sz = (l: number, h: number, dp: number): [number, number, number] => horiz ? [l, h, dp] : [dp, h, l];
      if (en.canopy.depth > 0) {
        // Standard hosts keep the original canopy line; taller/lower hosts follow their real door and eave.
        const custom = !!b.height && b.height !== 'standard', mainH = custom ? (G ? GRAND_DOOR_HEIGHTS : DOOR_HEIGHTS)[b.height as keyof typeof DOOR_HEIGHTS].main : 0;
        const cy = custom && T ? Math.min(levelTop(0) + mainH + 0.45, wallTopOf(b) - 0.15) : T ? 3.26 : SLAB + 2.9 + 0.15 + 0.1, ct = T ? 0.22 : 0.3;
        add('entrance', 'entrance-canopy', 'roof', at(c, line + dir * en.canopy.depth / 2, cy), sz(en.canopy.width, ct, en.canopy.depth), {material: en.canopy.material, semanticType: 'roof', ...(T && en.canopy.material === 'timber' ? {color: T.timberColor} : {})});
        for (const k of [-1, 1]) add('entrance', `entrance-column-${k > 0 ? 'b' : 'a'}`, 'volume', at(c + k * (en.canopy.width / 2 - 0.3), line + dir * (en.canopy.depth - 0.3), T ? (cy - ct / 2 + SLAB) / 2 : SLAB + 1.55), sz(T ? 0.4 : 0.3, T ? cy - ct / 2 - SLAB : 3.1, T ? 0.4 : 0.3), T ? {material: 'limestone', color: T.stoneColor} : {material: 'bronze'});
      }
      add('entrance', 'entrance-court', 'plate', at(c, line + dir * (en.court.d / 2), SLAB / 2), sz(en.court.w, SLAB, en.court.d), {material: 'limestone', semanticType: 'terrace'});
    }
  }

  // Decorative trim is the only geometry that yields to the element budget, and the site is reserved first,
  // so required architecture and landscape are never displaced. What was dropped is reported, never silent.
  let budget: ElementBudget | undefined, trimElements: ReturnType<typeof buildTrimBudgeted>['elements'] = [];
  if (stage >= 4) {
    const architecture = elements.length, site = stage >= 5 ? siteElementCount(spec) : 0;
    if (architecture + site > CAP) throw new ElementBudgetError({cap: CAP, architecture, site, trimRequested: 0});
    const trim = T ? buildTrimBudgeted(spec, {openings, nExisting: architecture + site}) : {elements: [], requested: 0};
    trimElements = trim.elements;
    budget = {cap: CAP, total: architecture + site + trim.elements.length, architecture, site, trimRequested: trim.requested, trimPlaced: trim.elements.length, trimDropped: trim.requested - trim.elements.length};
  }
  if (budget) for (const t of trimElements) add(t.comp, t.id, t.kind, t.at, t.size, {...t.extra, ...(revised && t.extra.material === 'limestone' ? {appearance: 'cut-limestone', color: '#B9A486'} : {})});

  if (stage >= 5) {
    const sw = spec.siteWork, p = sw.pool;
    if (p) for (const op of assemblyOperations({kind: 'rectangular-pool', parameters: {id: 'pool', at: [p.x, SLAB / 2, p.z + 0.75], width: p.w, depth: p.d, basinDepth: p.basinDepth, material: 'limestone'}})) {
      if (op.op !== 'add') continue;
      components[op.element.id] = 'pool';
      const el:SceneElement=p.nearDeckDepth===undefined?op.element:{...op.element,...(op.element.id==='pool'?{at:[p.x,SLAB/2,p.z+poolNearDeck(p)/2],size:[op.element.size[0],op.element.size[1],poolNearDeck(p)]}:{at:[op.element.at[0],op.element.at[1],op.element.at[2]-(1.5-poolNearDeck(p))/2]})};
      elements.push({...el,...(resolvedPoolIntent(spec)?{aliases:[resolvedPoolIntent(spec)!.id,resolvedPoolIntent(spec)!.role.slice(0,80)]}:{}), at: el.at.map(snap) as [number, number, number], ...(spec.sitePresentation ? op.element.kind === 'water' ? {color:spec.sitePresentation.design.pool.water==='turquoise'?'#1A838F':'#236E68'} : {siteAsset:'paving' as const,color:op.element.id==='pool-floor'?'#267B81':op.element.id.includes('coping')?'#C5B28F':'#D4C6AA'} : {})});
    }
    if (spec.sitePresentation) {
      const design=spec.sitePresentation.design,layered=design.planting.beds==='layered-tropical'||design.planting.beds==='layered';
      for(const l of sw.paths)add(`landscape:${l.id}`,`path-${l.id}`,'plate',[l.rect.x,SLAB/2,l.rect.z],[l.rect.w,SLAB,l.rect.d],{material:'limestone',siteAsset:'paving',color:(l.id==='arrival-drive'?design.arrival.finish:design.terrace.finish)==='limestone'?'#D4C6AA':'#C3B495',semanticType:l.id==='arrival-drive'?'driveway':l.id.startsWith('terrace-')?'terrace':'path'});
      for(const l of sw.lawns)add(`landscape:${l.id}`,`lawn-${l.id}`,'plate',[l.rect.x,.025,l.rect.z],[l.rect.w,.05,l.rect.d],{material:'sage',siteAsset:'lawn',color:'#58734A',semanticType:'garden',...(l.patches?{sitePatches:l.patches.map(p=>[(p.x-l.rect.x)/l.rect.w,(p.z-l.rect.z)/l.rect.d,p.w/l.rect.w,p.d/l.rect.d])}:{})});
      for(const l of sw.beds)add(`landscape:${l.id}`,`bed-${l.id}`,'volume',[l.rect.x,.5,l.rect.z],[l.rect.w,1,l.rect.d],{siteAsset:'planting',color:'#8FA579',panels:Math.min(40,Math.max(3,Math.round(l.rect.w*l.rect.d/(layered?1:1.8)))),semanticType:'planting-bed'});
      for(const l of sw.hedges)add(`landscape:${l.id}`,`hedge-${l.id}`,'volume',[l.rect.x,.7,l.rect.z],[l.rect.w,1.4,l.rect.d],{siteAsset:'hedge',panels:Math.min(40,Math.round(Math.max(l.rect.w,l.rect.d)/.65)),color:'#789065',semanticType:'plant'});
      for(const t of sw.trees)add(`landscape:${t.id}`,`tree-${t.id}`,'volume',[t.x,t.height*1.1/2,t.z],[t.height,t.height*1.1,t.height],{material:'timber',siteAsset:t.kind==='canopy'&&spec.sitePresentation.version==='staged-site-2'?'canopy-tree':'palm',panels:Number(t.id.match(/\d+/)?.[0]??0)%2+1,semanticType:'tree'});
      for(const f of spec.sitePresentation.fixtures){
        const base=f.support==='ground'?0:SLAB;
        add(`landscape:${f.id}`,`site-${f.id}`,'volume',[f.rect.x,base+f.height/2,f.rect.z],[f.rect.w,f.height,f.rect.d],{siteAsset:f.asset,rotation:f.rotation,material:f.asset==='bollard'?'bronze':'timber',semanticType:f.asset==='bollard'?'lighting':'outdoor-furniture'});
      }
      return finalize(spec,elements,components,budget);
    }
    for (const l of sw.lawns) add(`landscape:${l.id}`, `lawn-${l.id}`, 'plate', [l.rect.x, 0.04, l.rect.z], [l.rect.w, 0.08, l.rect.d], {material: l.material, color: l.material === 'sage' ? '#6c9a58' : undefined, semanticType: 'garden'});
    for (const l of sw.beds) add(`landscape:${l.id}`, `bed-${l.id}`, 'plate', [l.rect.x, 0.1, l.rect.z], [l.rect.w, 0.2, l.rect.d], {color: '#3f6b3a', semanticType: 'planting-bed'});
    for (const l of sw.hedges) add(`landscape:${l.id}`, `hedge-${l.id}`, 'volume', [l.rect.x, 0.7, l.rect.z], [l.rect.w, 1.4, l.rect.d], {color: '#2f6b3a', semanticType: 'plant'});
    for (const l of sw.paths) add(`landscape:${l.id}`, `path-${l.id}`, 'plate', [l.rect.x, 0.07, l.rect.z], [l.rect.w, 0.14, l.rect.d], {material: 'limestone', semanticType: 'path'});
    for (const t of sw.trees) {
      add(`landscape:${t.id}`, `tree-${t.id}-trunk`, 'volume', [t.x, t.height / 2, t.z], [0.35, t.height, 0.35], {color: '#7a5c3c', semanticType: 'tree'});
      if (t.kind === 'palm') for (const [i, rot] of [0, Math.PI / 3, 2 * Math.PI / 3].entries())
        add(`landscape:${t.id}`, `tree-${t.id}-frond-${i}`, 'volume', [t.x, t.height + 0.1, t.z], [4.6, 0.16, 0.9], {rotation: rot, color: '#4f8f3d', semanticType: 'tree'});
      else add(`landscape:${t.id}`, `tree-${t.id}-crown`, 'volume', [t.x, t.height + 1.2, t.z], [4.2, 2.6, 4.2], {color: '#4f8f3d', semanticType: 'tree'});
    }
  }
  return finalize(spec, elements, components, budget);
}

function finalize(spec: HouseSpec, elements: SceneElement[], components: Record<string, string>, budget?: ElementBudget): Compiled {
  const scene = validateScene({version: 'architectural-scene-1', name: spec.direction.name, elements});
  return budget ? {scene, components, budget} : {scene, components};
}

/** Exact number of site elements Stage 5 will add (pool assembly, landscape, fixtures), reserved before trim. */
export function siteElementCount(spec: HouseSpec): number {
  const sw = spec.siteWork, p = sw.pool;
  const pool = p ? assemblyOperations({kind: 'rectangular-pool', parameters: {id: 'pool', at: [p.x, SLAB / 2, p.z + 0.75], width: p.w, depth: p.d, basinDepth: p.basinDepth, material: 'limestone'}}).filter(o => o.op === 'add').length : 0;
  const base = sw.paths.length + sw.lawns.length + sw.beds.length + sw.hedges.length;
  if (spec.sitePresentation) return pool + base + sw.trees.length + spec.sitePresentation.fixtures.length;
  return pool + base + sw.trees.reduce((n, t) => n + (t.kind === 'palm' ? 4 : 2), 0);
}

const overlap = (a: R, b: R) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));
function abuts(a: R, b: R, side: Side) {
  const o = side === 'n' ? [b.z1 - a.z0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)] : side === 's' ? [b.z0 - a.z1, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)]
    : side === 'e' ? [b.x0 - a.x1, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)] : [b.x1 - a.x0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)];
  return Math.abs(o[0]) < 0.02 && o[1] > 0.05;
}

type Door = HouseSpec['exterior']['doors'][number];
const doorCentre = (iv: [number, number], d: Door) => snap(Math.min(iv[1] - d.width / 2 - 0.6, Math.max(iv[0] + d.width / 2 + 0.6, iv[0] + d.t * (iv[1] - iv[0]))));
interface Piece {lo: number; hi: number; door?: Door}
function splitForDoors(lo: number, hi: number, doors: Door[], exact = false): Piece[] {
  // scale-1: a wall exactly as long as door + 1.2 m (what Stage 4 derives) holds its door; the original strict test lost it.
  const d = doors.find(x => exact ? hi - lo >= x.width + 1.2 - 1e-6 : hi - lo > x.width + 1.2);
  if (!d) return [{lo, hi}];
  const c = doorCentre([lo, hi], d), half = d.width / 2 + (d.kind === 'main' ? 0.9 : 0.5);
  const l = Math.max(lo, c - half), h = Math.min(hi, c + half);
  return [...(l - lo > 0.3 ? [{lo, hi: l}] : []), {lo: l, hi: h, door: d}, ...(hi - h > 0.3 ? [{lo: h, hi}] : [])];
}

type Bay = [number, number, {c: number; sill: number; width: number; height: number; glazed: boolean} | undefined, {width: number; height: number; material?: Mat} | undefined];
function bays(p: Piece, style: FacadeStyle, room: Room, openings: boolean, side: Side, b: Block, refined = false, revised = false, grand = false): Bay[] {
  const L = p.hi - p.lo;
  if (!openings) return [[p.lo, p.hi, undefined, undefined]];
  if (p.door) {
    // scale-1: the main door keeps its derived width (a wide double door in a grand hall), not the 1.8 m ceiling.
    const d = p.door, main = d.kind === 'main', h = main ? (refined ? 2.7 : 3.0) : 2.4, w = main ? Math.min(d.width, grand ? 3.0 : refined ? 1.8 : 1.6) : d.width, c = (p.lo + p.hi) / 2;
    return [[p.lo, p.hi, {c, sill: 0, width: w, height: h, glazed: false}, {width: w - 0.06, height: h - 0.04, material: main ? 'timber' : 'bronze'}]];
  }
  if (style === 'solid' || L < 1.4) return [[p.lo, p.hi, undefined, undefined]];
  if (revised) {
    // Fit each actual exposed run. Baths retain a high privacy sill; circulation gets daylight-height windows.
    const bath = room.type === 'bath', circulation = ['hall', 'gallery', 'stair'].includes(room.type);
    const glass = style === 'glass-wall' && !bath && !circulation;
    const sill = bath ? 1.45 : glass ? 0 : circulation ? 0.8 : 0.7;
    const height = bath ? 0.95 : glass ? 2.65 : style === 'punched' ? 1.8 : 2.1;
    const target = bath ? 0.95 : glass ? 2.2 : circulation ? 1.1 : style === 'punched' ? 1.25 : 1.5;
    const pier = glass ? 0.65 : 0.8;
    const legacy = bays(p, style, room, openings, side, b, refined).length;
    const count = Math.min(legacy, Math.max(1, Math.floor((L + 0.01) / (target + pier))));
    const run = L / count, width = snap(Math.min(target, run - pier));
    return Array.from({length: count}, (_, i): Bay => [p.lo + i * run, p.lo + (i + 1) * run,
      width < 0.7 ? undefined : {c: p.lo + (i + 0.5) * run, sill, width, height, glazed: true}, undefined]);
  }
  const wet = room.type === 'bath' || room.type === 'hall';
  const spec = wet ? {max: 6, margin: 1.6, sill: 1.5, h: 0.7, glazed: true}
    : style === 'glass-wall' ? {max: 4.2, margin: 0.55, sill: 0, h: WALL_H - 0.35, glazed: true}
    : style === 'punched' ? {max: 5, margin: 1.6, sill: 1.0, h: 1.2, glazed: true}
    : {max: 3.4, margin: 1.3, sill: room.type === 'bedroom' || room.type === 'lounge' ? 0.7 : 0.45, h: room.type === 'bedroom' ? 1.9 : 2.2, glazed: true};
  if (refined && !wet) {
    // Refined proportions: taller, vertical windows above the plinth; French-door bays with piers between.
    const upperLevel = b.level === 1, tall = style === 'glass-wall' ? {max: 3.2, margin: 0.7, sill: 0, h: 2.65} : style === 'punched' ? {max: 3.0, margin: 1.7, sill: upperLevel ? 0.9 : 0.85, h: 1.55}
      : {max: 2.9, margin: 1.35, sill: upperLevel ? (room.type === 'bedroom' ? 0.55 : 0.45) : 0.8, h: upperLevel ? 2.15 : 2.0};
    const nn = Math.max(1, Math.round(L / tall.max)), ln = L / nn;
    return Array.from({length: nn}, (_, i): Bay => {
      const lo = p.lo + i * ln, hi = lo + ln, w = ln - tall.margin;
      return w < 0.7 ? [lo, hi, undefined, undefined] : [lo, hi, {c: (lo + hi) / 2, sill: tall.sill, width: w, height: tall.h, glazed: true}, undefined];
    });
  }
  const n = Math.max(1, Math.ceil(L / spec.max)), len = L / n;
  return Array.from({length: n}, (_, i): Bay => {
    const lo = p.lo + i * len, hi = lo + len, w = Math.min(len - spec.margin, wet ? 1.1 : 99);
    return w < 0.6 ? [lo, hi, undefined, undefined] : [lo, hi, {c: (lo + hi) / 2, sill: spec.sill, width: w, height: spec.h, glazed: spec.glazed}, undefined];
  });
}

/** Door heights by block height (standard blocks keep the original 2.7 m main / 2.4 m garden doors). */
export const DOOR_HEIGHTS = {low: {main: 2.3, garden: 2.2}, tall: {main: 3.3, garden: 3.0}, double: {main: 3.3, garden: 3.4}} as const;
/** scale-1: a double-height hall carries a correspondingly tall entrance door (still well below its 6.5 m wall). */
export const GRAND_DOOR_HEIGHTS = {...DOOR_HEIGHTS, tall: {main: 3.4, garden: 3.0}, double: {main: 4.2, garden: 3.6}} as const;
/** Openings follow the volume's real wall height: taller rooms get taller glazing and doors, low rooms lower ones. */
function heightBays(list: Bay[], b: Block, style: FacadeStyle, grand = false): Bay[] {
  if (!b.height || b.height === 'standard') return list;
  const H = wallHeight(b), extra = H - WALL_H, doors = (grand ? GRAND_DOOR_HEIGHTS : DOOR_HEIGHTS)[b.height];
  return list.map(([lo, hi, o, d]): Bay => {
    if (!o) return [lo, hi, o, d];
    if (d) { /* main entrance doors are timber, garden doors bronze */ const h = d.material === 'timber' ? doors.main : doors.garden; return [lo, hi, {...o, height: h}, {...d, height: h - 0.04}]; }
    const height = o.sill < 0.05 ? H - 0.45 : o.sill >= 1.4 ? Math.min(o.height, H - o.sill - 0.3) : Math.min(H - o.sill - 0.35, o.height + Math.max(extra, -1) * (style === 'punched' ? 0.45 : 0.7));
    return [lo, hi, {...o, height: snap(height)}, d];
  });
}

function eaves(b: Block, blocks: Block[], roof: RoofSpec, caps: Partial<Record<Side, number>> = {}): Record<Side, number> {
  const br = blockRect(b), out = {} as Record<Side, number>;
  for (const s of SIDES) out[s] = blocks.some(o => o.id !== b.id && abuts(br, blockRect(o), s) && neighbourStopsEave(b, o)) ? 0 : Math.min(roof.overhang, caps[s] ?? Infinity);
  return out;
}
/** Eave caps where the entrance canopy meets a roof edge: the canopy replaces the eave on that side. */
export function canopyCaps(spec: HouseSpec): Record<string, Partial<Record<Side, number>>> {
  const door = spec.trim && spec.trim.canopy !== 'none' ? spec.exterior.doors.find(d => d.id === spec.exterior.entrance.door) : undefined;
  const room = door && allRooms(spec).find(r => r.id === door.room);
  return room && door ? {[room.block]: {[door.side]: 0}} : {};
}

function roofGeometry(b: Block, blocks: Block[], roof: RoofSpec, caps: Partial<Record<Side, number>> = {}): [[number, number, number], [number, number, number]] {
  const e = eaves(b, blocks, roof, caps), wallTop = wallTopOf(b);
  if (roof.form === 'flat') {
    const w = b.w + e.w + e.e, d = b.d + e.n + e.s;
    return [[b.cx + (e.e - e.w) / 2, wallTop + 0.15, b.cz + (e.s - e.n) / 2], [w, 0.3, d]];
  }
  const rise = roof.rise ?? 1.8;
  return [[b.cx, wallTop + rise / 2, b.cz], [b.w, rise, b.d]];
}

function roofFields(roof: RoofSpec): Extra {
  return {material: roof.material, ...(roof.color ? {color: roof.color} : {})};
}

/** Pitched eaves must be derived from the block's edge conditions. */
export function pitchedEaves(b: Block, blocks: Block[], caps: Partial<Record<Side, number>> = {}): Extra {
  const e = eaves(b, blocks, b.roof, caps);
  return {overhang: Math.max(e.n, e.e, e.s, e.w), eaves: {north: e.n, east: e.e, south: e.s, west: e.w}};
}
