import type { PavilionPlacement } from '@/lib/villa/experimental/curved-pavilion';
import type { EstateLandscape } from '@/lib/villa/estate-landscape';
import { defaultVilla, type VillaConfig } from '@/lib/villa/design';

/** Shared metre-based wing model. Terra authors validated component configurations. */
export interface Wing {
  id: string;
  x: number; z: number;
  width: number; depth: number;
  orientation: number;
  storeys: 1 | 2;
  storeyHeight: number;
  role: 'main' | 'living' | 'guest' | 'gallery';
  veranda?: number;
  balcony?: number;
  connects?: [string, string];
  connectionWidth?: number;
}
export interface Terrace { id: string; x: number; z: number; width: number; depth: number; timber?: boolean }
export interface WingComposition {
  authored?: boolean;
  components?: PavilionPlacement[];
  experimentalForms?: PavilionPlacement[];
  estateLandscape?: EstateLandscape;
  id: string; name: string; character: string;
  config: VillaConfig;
  wings: Wing[];
  terraces: Terrace[];
  pool: { x: number; z: number; width: number; depth: number; enabled?: boolean };
  garden: { x: number; z: number; width: number; depth: number };
}
export function wingBounds(w: Wing) {
  const a = w.orientation * Math.PI / 180;
  const c = w.orientation % 90 === 0 ? Math.abs(Math.round(Math.cos(a))) : Math.abs(Math.cos(a));
  const s = w.orientation % 90 === 0 ? Math.abs(Math.round(Math.sin(a))) : Math.abs(Math.sin(a));
  const width = c * w.width + s * w.depth;
  const depth = s * w.width + c * w.depth;
  return { left: w.x - width / 2, right: w.x + width / 2, rear: w.z - depth / 2, front: w.z + depth / 2 };
}
export type WingOperation =
  | { type: 'add'; wing: Wing }
  | { type: 'remove'; id: string }
  | { type: 'adjust'; id: string; changes: Partial<Pick<Wing, 'x' | 'z' | 'width' | 'depth' | 'orientation' | 'storeys' | 'storeyHeight' | 'veranda' | 'balcony'>> }
  | { type: 'connect'; id: string; from: string; to: string; width: number };

function gallery(wings: Wing[], id: string, from: string, to: string, width: number): Wing {
  const a = wings.find(w => w.id === from), b = wings.find(w => w.id === to);
  if (!a || !b || a.role === 'gallery' || b.role === 'gallery') throw new Error('Connections need two building wings');
  if(a.orientation % 90 || b.orientation % 90) throw new Error('Rotated wings are detached; diagonal gallery joins are unsupported');
  const A = wingBounds(a), B = wingBounds(b);
  const commonX = [Math.max(A.left, B.left), Math.min(A.right, B.right)];
  const commonZ = [Math.max(A.rear, B.rear), Math.min(A.front, B.front)];
  const base = { id, connectionWidth: width, orientation: 0 as const, storeys: 1 as const, storeyHeight: Math.min(3.3, a.storeyHeight, b.storeyHeight), role: 'gallery' as const, connects: [from, to] as [string, string] };
  if (commonX[1] - commonX[0] >= width && (A.front < B.rear || B.front < A.rear)) {
    const start = Math.min(A.front, B.front), end = Math.max(A.rear, B.rear);
    return { ...base, x: (commonX[0] + commonX[1]) / 2, z: (start + end) / 2, width, depth: end - start };
  }
  if (commonZ[1] - commonZ[0] >= width && (A.right < B.left || B.right < A.left)) {
    const start = Math.min(A.right, B.right), end = Math.max(A.left, B.left);
    return { ...base, x: (start + end) / 2, z: (commonZ[0] + commonZ[1]) / 2, width: end - start, depth: width };
  }
  throw new Error('A straight gallery needs aligned, separated faces and a fitting width');
}
export function validateWings(wings: Wing[]) {
  if (new Set(wings.map(w => w.id)).size !== wings.length) throw new Error('Wing IDs must be unique');
  for (const w of wings) {
    if (![w.x, w.z, w.width, w.depth, w.storeyHeight].every(Number.isFinite) ||
      !Number.isFinite(w.orientation) || w.orientation < 0 || w.orientation > 345 || w.orientation % 15 !== 0 || ![1, 2].includes(w.storeys) ||
      w.width < (w.role === 'gallery' ? 1 : w.storeys === 2 ? 8 : 4) || w.depth < (w.role === 'gallery' ? 1 : 4) ||
      Math.max(w.width, w.depth) > 32 || w.storeyHeight < 3 || w.storeyHeight > 4.5 ||
      (w.veranda !== undefined && (w.veranda < 0 || w.veranda > 3)) ||
      (w.balcony !== undefined && (w.balcony < 0 || w.balcony > Math.min(2.4, w.depth / 3)))) throw new Error(`Unsupported wing proportions: ${w.id}`);
    for (const other of wings) {
      if (other === w) continue;
      const a = wingBounds(w), b = wingBounds(other);
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > .01 && Math.min(a.front, b.front) - Math.max(a.rear, b.rear) > .01) throw new Error(`Overlapping wings: ${w.id}, ${other.id}`);
    }
  }
  return wings;
}
/** Connections regenerate after edits; removing a wing also removes its dependent galleries. */
export function operateWings(wings: Wing[], op: WingOperation): Wing[] {
  let next = wings.map(w => ({ ...w }));
  if (op.type === 'add') next.push({ ...op.wing });
  if (op.type === 'remove') {
    if (!next.some(w => w.id === op.id)) throw new Error('Unknown wing');
    next = next.filter(w => w.id !== op.id && !w.connects?.includes(op.id));
  }
  if (op.type === 'adjust') {
    const target = next.find(w => w.id === op.id && w.role !== 'gallery');
    if (!target) throw new Error('Adjust a building wing; galleries follow their connections');
    Object.assign(target, op.changes);
  }
  if (op.type === 'connect') next.push(gallery(next, op.id, op.from, op.to, op.width));
  next = next.map(w => w.connects ? gallery(next, w.id, ...w.connects, w.connectionWidth ?? Math.min(w.width, w.depth)) : w);
  return validateWings(next);
}

/** In a wing's local coordinates, find only the wall spans touched by a neighbour. */
export function wallContacts(wing: Wing, wings: Wing[], face: 'front' | 'rear' | 'left' | 'right') {
  // Non-cardinal wings deliberately have no shared-wall or gallery attachment contract.
  if(wing.orientation % 90) return [];
  const angle = wing.orientation * Math.PI / 180, c = Math.round(Math.cos(angle)), s = Math.round(Math.sin(angle));
  const side = face === 'left' || face === 'right', sign = face === 'rear' || face === 'left' ? -1 : 1;
  const edge = sign * (side ? wing.width : wing.depth) / 2;
  return wings.filter(w => w.id !== wing.id && w.orientation % 90 === 0).flatMap(other => {
    const b = wingBounds(other);
    const corners = [[b.left, b.rear], [b.left, b.front], [b.right, b.rear], [b.right, b.front]].map(([x,z]) => [c * (x-wing.x) - s * (z-wing.z), s * (x-wing.x) + c * (z-wing.z)]);
    const xs = corners.map(p => p[0]), zs = corners.map(p => p[1]);
    const normal = side ? xs : zs, tangent = side ? zs : xs;
    if (Math.abs((sign > 0 ? Math.min(...normal) : Math.max(...normal)) - edge) > .02) return [];
    const half = (side ? wing.depth : wing.width) / 2;
    const start = Math.max(-half, Math.min(...tangent)), end = Math.min(half, Math.max(...tangent));
    return end - start > .02 ? [{ start, end, height: other.storeys * other.storeyHeight }] : [];
  }).sort((a,b) => a.start-b.start);
}
const wing = (id: string, x: number, z: number, width: number, depth: number, role: Wing['role'], storeys: 1 | 2 = 1, orientation: Wing['orientation'] = 0, extra: Partial<Wing> = {}): Wing =>
  ({ id, x, z, width, depth, role, storeys, orientation, storeyHeight: 3.8, ...extra });
const connect = (wings: Wing[], id: string, from: string, to: string, width: number) => operateWings(wings, { type: 'connect', id, from, to, width });
const compact = connect([
  wing('island-house', 0, -6, 16, 7, 'main', 2, 0, { balcony: 1.6, veranda: 1.6 }),
  wing('garden-salon', -4.5, 4.5, 10, 7, 'living', 1, 90, { veranda: 2 }),
], 'breeze-gallery', 'island-house', 'garden-salon', 3.4);
let courtyard = [
  wing('great-house', 0, -9, 22, 8, 'main', 2, 0, { balcony: 1.5, veranda: 2.5, storeyHeight: 4.2 }),
  wing('west-residence', -11.5, 4, 13, 7, 'living', 1, 90, { veranda: 2.2, storeyHeight: 4 }),
  wing('east-residence', 11.5, 4, 13, 7, 'living', 1, 270, { veranda: 2.2, storeyHeight: 4 }),
];
courtyard = connect(courtyard, 'west-gallery', 'great-house', 'west-residence', 2.8);
courtyard = connect(courtyard, 'east-gallery', 'great-house', 'east-residence', 2.8);
const pavilions = connect([
  wing('sky-house', -7, -6, 13, 9, 'main', 2, 0, { balcony: 1.8, veranda: 2.4, storeyHeight: 4.1 }),
  wing('glass-salon', 8, -3, 10, 7, 'living', 1, 0, { veranda: 2.5, storeyHeight: 4.4 }),
  wing('guest-retreat', 13, 10.5, 7, 6, 'guest', 1, 270, { veranda: 1.8, storeyHeight: 3.6 }),
  wing('garden-studio', -12, 9, 6, 5, 'guest', 1, 0, { veranda: 1.6, storeyHeight: 3.4 }),
], 'glass-link', 'sky-house', 'glass-salon', 2.6);
export const COMPOSITIONS: Record<string, WingComposition> = {
  'compact-l': { id: 'compact-l', name: 'Villa Canopée', character: 'An intimate island courtyard.', config: defaultVilla('caribbean'), wings: compact,
    terraces: [{ id:'court',x:2.5,z:4.5,width:12,depth:10 },{ id:'pool-approach',x:2.5,z:9.8,width:12,depth:.6 },{ id:'pool-west',x:-6,z:13,width:4,depth:7 },{ id:'pool-east',x:8,z:13,width:4,depth:7 },{ id:'pool-end',x:1,z:17,width:18,depth:1.5 }],
    pool:{x:1,z:13,width:10,depth:5.4}, garden:{x:0,z:3,width:31,depth:34} },
  'courtyard-u': { id:'courtyard-u',name:'Palacio del Agua',character:'Three wings. One grand garden.',config:defaultVilla('spanish'),wings:courtyard,
    terraces:[{id:'court',x:0,z:3.4,width:16,depth:17.3},{id:'pool-west',x:-11.5,z:15,width:8,depth:6.5},{id:'pool-east',x:11.5,z:15,width:8,depth:6.5},{id:'pool-end',x:0,z:19,width:31,depth:2}],
    pool:{x:0,z:15,width:14,depth:5.5},garden:{x:0,z:3,width:40,depth:41} },
  'pavilion-estate': { id:'pavilion-estate',name:'Villa Latitude',character:'A landscape of rooms and gardens.',config:{...defaultVilla('modern'),exterior:'limestone'},wings:pavilions,
    terraces:[{id:'salon-terrace',x:4,z:4,width:18,depth:6},{id:'pool-approach',x:2.5,z:8.3,width:13,depth:2.8},{id:'west-walk',x:-7,z:5,width:2.5,depth:12},{id:'guest-walk',x:10.5,z:5.5,width:12,depth:2},{id:'pool-west',x:-6,z:13,width:3.5,depth:7},{id:'pool-east',x:7,z:13,width:3.5,depth:7},{id:'pool-end',x:.5,z:17.5,width:17,depth:2},{id:'studio-deck',x:-12,z:14,width:7,depth:3,timber:true}],
    pool:{x:.5,z:12.8,width:9.5,depth:6},garden:{x:0,z:3,width:43,depth:38} },
};
