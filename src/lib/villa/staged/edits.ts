import {derivePoolMove} from './poolEdit';
import {z} from 'zod';
import type {ArchitecturalScene, SceneElement} from '../scene/model';
import {compileHouse} from './compile';
import {allRooms, area, blockRect, overlapArea, rectDiff, type R} from './layout';
import {measure, type Usage} from './pipeline';
import {BLOCK_HEIGHTS, blockSchema, exteriorDoorSchema, entranceSchema, facadeStyleSchema, houseSpecSchema, linkSchema, roofSchema, sideSchema, type Block, type HouseSpec, type PlanNode} from './spec';
import {siteObstacles, verandaRect, type Finding} from './validate';
import {deriveSite} from './site';
import {requirePool} from './poolGeometry';
import {siteDesignSchema} from './siteContract';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
/** Constrained semantic operations. Models choose among these; software derives all geometry. */
export const editOpSchema = z.discriminatedUnion('op', [
  z.object({op:z.literal('move-pool-relative'),pool:z.literal('pool'),veranda:z.string().min(1).max(80),direction:z.enum(['towards','away']),distance:z.number().positive().max(10)}).strict(),
  z.object({op:z.literal('set-site-design'),design:siteDesignSchema}).strict(),
  z.object({op:z.literal('move-site-item'),id,dx:z.number().min(-20).max(20),dz:z.number().min(-20).max(20)}).strict(),
  z.object({op: z.literal('resize-room'), room: id, edge: sideSchema, delta: z.number().min(-10).max(10)}).strict(),
  z.object({op: z.literal('set-roof'), blocks: z.array(id).min(1).max(12), roof: roofSchema}).strict(),
  /** Change one volume's wall height; software re-derives walls, openings, eaves, verandas and trim. */
  z.object({op: z.literal('set-block-height'), block: id, height: z.enum(BLOCK_HEIGHTS)}).strict(),
  z.object({op: z.literal('add-block'), block: blockSchema, links: z.array(linkSchema).max(12), facades: z.record(z.string(), facadeStyleSchema).optional()}).strict(),
  z.object({op: z.literal('move-pool'), veranda: id, gap: z.number().min(0).max(12)}).strict(),
  z.object({op: z.literal('set-entrance'), entrance: entranceSchema, door: exteriorDoorSchema}).strict(),
  z.object({op: z.literal('set-facade'), key: z.string(), style: facadeStyleSchema}).strict(),
  z.object({op: z.literal('set-finish'), block: id, wall: z.enum(['ivory', 'limestone', 'timber', 'bronze', 'sage']), wallColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()}).strict(),
]);
export type EditOp = z.infer<typeof editOpSchema>;
export const editPlanSchema = z.object({summary: z.string().max(300), ops: z.array(editOpSchema).min(1).max(8)}).strict();
export type EditPlan = z.infer<typeof editPlanSchema>;

export interface EditPlanner {
  readonly label: string;
  plan(instruction: string, spec: HouseSpec, selectedId?: string): Promise<{plan: unknown; usage?: Usage}>;
}

const toR = (r: {x: number; z: number; w: number; d: number}): R => ({x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2});
const fromR = (r: R) => ({x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, w: r.x1 - r.x0, d: r.z1 - r.z0});
const round = (v: number) => Math.round(v * 1000) / 1000;

export class EditError extends Error {constructor(readonly code: string, message: string) { super(message); }}

function resizeRoom(spec: HouseSpec, roomId: string, edge: 'n' | 's' | 'e' | 'w', delta: number): HouseSpec {
  const block = spec.blocks.find(b => allRooms({blocks: [b]}).some(r => r.id === roomId));
  if (!block) throw new EditError('unknown-room', `Room ${roomId} does not exist.`);
  let done = false;
  const walk = (node: PlanNode, r: R): {node: PlanNode; has: boolean} => {
    if ('room' in node) return {node, has: node.room.id === roomId};
    const m = node.split === 'x' ? round(r.x0 + node.at) : round(r.z0 + node.at);
    const ra = node.split === 'x' ? {...r, x1: m} : {...r, z1: m}, rb = node.split === 'x' ? {...r, x0: m} : {...r, z0: m};
    const a = walk(node.a, ra), b = walk(node.b, rb);
    let at = node.at;
    // The room's edge must lie on this split line for this split to control it.
    const sub = a.has ? 'a' : b.has ? 'b' : undefined;
    if (sub && !done) {
      const room = allRooms({blocks: [block]}).find(x => x.id === roomId)!;
      if (node.split === 'x' && ((edge === 'e' && sub === 'a' && Math.abs(room.x1 - m) < 1e-4) || (edge === 'w' && sub === 'b' && Math.abs(room.x0 - m) < 1e-4))) { at = round(at + (edge === 'e' ? delta : -delta)); done = true; }
      if (node.split === 'z' && ((edge === 's' && sub === 'a' && Math.abs(room.z1 - m) < 1e-4) || (edge === 'n' && sub === 'b' && Math.abs(room.z0 - m) < 1e-4))) { at = round(at + (edge === 's' ? delta : -delta)); done = true; }
    }
    return {node: {...node, at, a: a.node, b: b.node}, has: a.has || b.has};
  };
  const res = walk(block.plan, blockRect(block));
  if (!done) throw new EditError('edge-on-block-boundary', `The ${edge} edge of ${roomId} is the ${block.id} block boundary; changing it needs a massing change, not a room resize.`);
  return {...spec, blocks: spec.blocks.map(b => b.id === block.id ? {...b, plan: res.node} : b)};
}

/** Remove or trim site items that a new building/pool/court now overlaps. Returns human-readable notes. */
export function reconcileSite(spec: HouseSpec): {spec: HouseSpec; notes: string[]} {
  const notes: string[] = [], obstacles = siteObstacles(spec);
  const shrink = <T extends {id: string; rect: {x: number; z: number; w: number; d: number}}>(items: T[], kind: string, ignore: string[] = []): T[] => items.flatMap(item => {
    const r = toR(item.rect), hit = obstacles.filter(o => !ignore.includes(o.id) && overlapArea(r, o.rect) > 0.01);
    if (!hit.length) return [item];
    const pieces = rectDiff(r, hit.map(h => h.rect)).sort((a, b) => area(b) - area(a));
    if (!pieces.length || area(pieces[0]) < 0.4 * area(r)) { notes.push(`removed ${kind} ${item.id} (covered by ${hit.map(h => h.id).join(', ')})`); return []; }
    notes.push(`trimmed ${kind} ${item.id} to clear ${hit.map(h => h.id).join(', ')}`);
    return [{...item, rect: fromR(pieces[0])}];
  });
  const s = spec.siteWork;
  const trees = s.trees.filter(t => {
    const bad = obstacles.filter(o => overlapArea({x0: t.x - 0.8, x1: t.x + 0.8, z0: t.z - 0.8, z1: t.z + 0.8}, o.rect) > 0.01);
    if (bad.length) notes.push(`removed tree ${t.id} (clashes with ${bad.map(b => b.id).join(', ')})`);
    return !bad.length;
  });
  return {spec: {...spec, siteWork: {...s, lawns: shrink(s.lawns, 'lawn'), beds: shrink(s.beds, 'bed'), hedges: shrink(s.hedges, 'hedge'), paths: shrink(s.paths, 'path', ['entrance-court']), trees}}, notes};
}

export function applyOps(spec: HouseSpec, ops: EditOp[]): {spec: HouseSpec; notes: string[]} {
  let next = spec;
  for (const op of ops) {
    switch (op.op) {
      case 'move-pool-relative': next=derivePoolMove(next,op);break;
      case 'set-site-design': {
        const r=deriveSite(next,op.design);if(r.findings.length)throw new EditError('site-design',r.findings.map(f=>f.message).join('; '));next=r.spec;break;
      }
      case 'move-site-item': {
        let found=false;
        const rectItem=<T extends {id:string;rect:{x:number;z:number;w:number;d:number}}>(item:T):T=>{
          if(item.id!==op.id)return item;found=true;
          const withPatches=item as T & {patches?:{x:number;z:number;w:number;d:number}[]};
          return {...item,rect:{...item.rect,x:round(item.rect.x+op.dx),z:round(item.rect.z+op.dz)},...(withPatches.patches?{patches:withPatches.patches.map(p=>({...p,x:round(p.x+op.dx),z:round(p.z+op.dz)}))}:{})};
        };
        const s=next.siteWork;
        next={...next,siteWork:{...s,trees:s.trees.map(t=>{if(t.id!==op.id)return t;found=true;return {...t,x:round(t.x+op.dx),z:round(t.z+op.dz)};}),beds:s.beds.map(rectItem),hedges:s.hedges.map(rectItem),paths:s.paths.map(rectItem),lawns:s.lawns.map(rectItem)},...(next.sitePresentation?{sitePresentation:{...next.sitePresentation,fixtures:next.sitePresentation.fixtures.map(rectItem)}}:{})};
        if(!found)throw new EditError('unknown-site-item',`Site component ${op.id} does not exist.`);break;
      }
      case 'resize-room': next = resizeRoom(next, op.room, op.edge, op.delta); break;
      case 'set-roof': {
        for (const b of op.blocks) if (!next.blocks.some(x => x.id === b)) throw new EditError('unknown-block', `Block ${b} does not exist.`);
        next = {...next, blocks: next.blocks.map(b => op.blocks.includes(b.id) ? {...b, roof: op.roof} : b)}; break;
      }
      case 'add-block': {
        if (next.blocks.some(b => b.id === op.block.id)) throw new EditError('duplicate-block', `Block ${op.block.id} already exists.`);
        next = {...next, blocks: [...next.blocks, op.block], links: [...next.links, ...op.links], exterior: {...next.exterior, facades: {...next.exterior.facades, ...(op.facades ?? {})}}}; break;
      }
      case 'move-pool': {
        const v = verandaRect(next, op.veranda), vs = next.exterior.verandas.find(x => x.id === op.veranda);
        if (!v || !vs || vs.side !== 's') throw new EditError('unsupported-veranda', 'Pool placement currently supports south-facing verandas.');
        next = {...next, siteWork: {...next.siteWork, pool: {...requirePool(next.siteWork.pool), z: round(v.z1 + op.gap)}}}; break;
      }
      case 'set-entrance': {
        const doors = next.exterior.doors.filter(d => d.id !== next.exterior.entrance.door && d.id !== op.door.id);
        next = {...next, exterior: {...next.exterior, entrance: op.entrance, doors: [op.door, ...doors]}}; break;
      }
      case 'set-block-height': {
        if (!next.blocks.some(b => b.id === op.block)) throw new EditError('unknown-block', `Block ${op.block} does not exist.`);
        next = {...next, blocks: next.blocks.map(b => { if (b.id !== op.block) return b; const rest = {...b}; delete rest.height; return op.height === 'standard' ? rest : {...rest, height: op.height}; })}; break;
      }
      case 'set-facade': next = {...next, exterior: {...next.exterior, facades: {...next.exterior.facades, [op.key]: op.style}}}; break;
      case 'set-finish': next = {...next, blocks: next.blocks.map(b => b.id === op.block ? {...b, wall: op.wall, wallColor: op.wallColor} : b)}; break;
    }
  }
  // Rich-site layouts reject conflicting edits atomically; do not trim away a lawn mask or furniture silently.
  return next.sitePresentation?{spec:next,notes:[]}:reconcileSite(next);
}

// ---- Measured diff between two compiled houses ----
export interface Diff {
  added: string[]; removed: string[]; changed: string[]; unchanged: number;
  /** component id -> {added, removed, changed} counts */
  byComponent: Record<string, {added: number; removed: number; changed: number}>;
}
const key = (e: SceneElement) => JSON.stringify(e);
export function diffScenes(before: {scene: ArchitecturalScene; components: Record<string, string>}, after: {scene: ArchitecturalScene; components: Record<string, string>}): Diff {
  const b = new Map(before.scene.elements.map(e => [e.id, e])), a = new Map(after.scene.elements.map(e => [e.id, e]));
  const d: Diff = {added: [], removed: [], changed: [], unchanged: 0, byComponent: {}};
  const bump = (comp: string, k: 'added' | 'removed' | 'changed') => { (d.byComponent[comp] ??= {added: 0, removed: 0, changed: 0})[k]++; };
  for (const [elementId, e] of a) {
    const old = b.get(elementId);
    if (!old) { d.added.push(elementId); bump(after.components[elementId], 'added'); }
    else if (key(old) !== key(e)) { d.changed.push(elementId); bump(after.components[elementId], 'changed'); }
    else d.unchanged++;
  }
  for (const elementId of b.keys()) if (!a.has(elementId)) { d.removed.push(elementId); bump(before.components[elementId], 'removed'); }
  return d;
}

export interface EditOutcome {
  accepted: boolean; instruction: string; summary?: string; ops: EditOp[]; spec: HouseSpec; scene: ArchitecturalScene; components: Record<string, string>;
  diff?: Diff; notes: string[]; findings: Finding[]; violations: string[]; usage?: Usage;
}

/** Full-house check used by every edit: all stage validators plus the hard relationship audit. */
export function validateHouse(spec: HouseSpec, requiredBedrooms = 0) {
  const parsed = houseSpecSchema.safeParse(spec);
  if (!parsed.success) return {findings: parsed.error.issues.slice(0, 10).map(i => ({stage: 4 as const, code: 'schema', subject: i.path.join('.'), message: i.message})), scene: undefined, components: undefined};
  const findings: Finding[] = [];
  let last: ReturnType<typeof measure> | undefined;
  for (const st of [2, 3, 4, 5] as const) { last = measure(spec, st, requiredBedrooms); findings.push(...last.findings); }
  return {findings, scene: last?.scene, components: last?.components};
}

/**
 * Atomic edit: plan -> constrained ops -> deterministic apply -> full validation -> measured diff.
 * `preserve` lists component-id prefixes whose elements must be byte-identical afterwards.
 */
export async function runEdit(o: {planner: EditPlanner; instruction: string; spec: HouseSpec; scene: ArchitecturalScene; components: Record<string, string>; preserve?: string[]; requiredBedrooms?: number; selectedId?: string}): Promise<EditOutcome> {
  const base = {instruction: o.instruction, spec: o.spec, scene: o.scene, components: o.components, notes: [] as string[], findings: [] as Finding[], violations: [] as string[], ops: [] as EditOp[]};
  const raw = await o.planner.plan(o.instruction, o.spec, o.selectedId);
  const plan = editPlanSchema.safeParse(raw.plan);
  if (!plan.success) return {...base, accepted: false, usage: raw.usage, findings: plan.error.issues.slice(0, 8).map(i => ({stage: 4, code: 'plan-schema', subject: i.path.join('.'), message: i.message}))};
  let applied: ReturnType<typeof applyOps>;
  try { applied = applyOps(o.spec, plan.data.ops); }
  catch (e) { return {...base, accepted: false, summary: plan.data.summary, ops: plan.data.ops, usage: raw.usage, findings: [{stage: 4, code: e instanceof EditError ? e.code : 'apply-failed', subject: 'edit', message: (e as Error).message}]}; }
  const check = validateHouse(applied.spec, o.requiredBedrooms);
  if (check.findings.length || !check.scene) return {...base, accepted: false, summary: plan.data.summary, ops: plan.data.ops, notes: applied.notes, usage: raw.usage, findings: check.findings};
  const after = {scene: check.scene, components: check.components!};
  const diff = diffScenes({scene: o.scene, components: o.components}, after);
  const violations: string[] = [];
  for (const prefix of o.preserve ?? []) {
    const before = new Map(o.scene.elements.filter(e => (o.components[e.id] ?? '').startsWith(prefix)).map(e => [e.id, key(e)]));
    for (const [elementId, k] of before) {
      const now = after.scene.elements.find(e => e.id === elementId);
      if (!now || key(now) !== k) violations.push(`${elementId} (${prefix}) changed but must be preserved`);
    }
  }
  if (violations.length) return {...base, accepted: false, summary: plan.data.summary, ops: plan.data.ops, notes: applied.notes, diff, usage: raw.usage, violations, findings: []};
  return {...base, accepted: true, summary: plan.data.summary, ops: plan.data.ops, spec: applied.spec, scene: after.scene, components: after.components, diff, notes: applied.notes, usage: raw.usage};
}

export {compileHouse};
export type {Block};
