import type {EditPlanner} from './edits';
import type {HouseSpec} from './spec';

/**
 * OFFLINE TEST DOUBLE for the model's edit planning: keyword-maps the five proof
 * instructions to constrained operations. It stands in for a model; the same
 * operations are then applied, validated and measured by the real software path.
 */
export class MockEditPlanner implements EditPlanner {
  readonly label = 'mock (developer-authored mapping, no model)';
  async plan(instruction: string, spec: HouseSpec) {
    const t = instruction.toLowerCase();
    const free = {model: 'mock', inputTokens: 0, outputTokens: 0, costUsd: 0};
    if (/enlarge.*(primary|master).*bedroom/.test(t))
      return {plan: {summary: 'Move the primary bedroom\'s east partition 2 m east.', ops: [{op: 'resize-room', room: 'primary-bedroom', edge: 'e', delta: 2}]}, usage: free};
    if (/mediterranean/.test(t)) {
      const terracotta = {material: 'timber' as const, color: '#b5593a'};
      return {plan: {summary: 'Terracotta hip roofs with moderate eaves on every roofed block.', ops: [
        {op: 'set-roof', blocks: ['suite'], roof: {form: 'hip', rise: 2.4, overhang: 1.1, ...terracotta}},
        {op: 'set-roof', blocks: ['east-wing'], roof: {form: 'hip', rise: 1.9, overhang: 1.0, ...terracotta}},
        {op: 'set-roof', blocks: ['tower'], roof: {form: 'hip', rise: 1.8, overhang: 1.0, ...terracotta}},
      ]}, usage: free};
    }
    if (/second (floor|storey|story).*(east|cabana)/.test(t)) {
      const east = spec.blocks.find(b => b.id === 'east-wing')!;
      return {plan: {summary: 'Stack a sky lounge and bath over the cabana wing.', ops: [{op: 'add-block',
        block: {id: 'east-upper', role: 'cabana sky lounge', cx: east.cx, cz: east.cz, w: east.w, d: east.d, level: 1, wall: 'ivory',
          roof: {form: 'hip', rise: 1.8, overhang: 1.2, material: 'timber', color: '#6b4a36'},
          plan: {split: 'z', at: 7, a: {room: {id: 'sky-lounge', name: 'Sky lounge', type: 'lounge'}}, b: {room: {id: 'sky-bath', name: 'Sky bath', type: 'bath'}}}},
        links: [{a: 'sky-lounge', b: 'family-lounge', kind: 'open', t: 0.5}, {a: 'sky-lounge', b: 'sky-bath', kind: 'door', t: 0.5}], facades: {'east-upper:e': 'glass-wall'}}]}, usage: free};
    }
    if (/move.*pool.*veranda|pool.*closer/.test(t))
      return {plan: {summary: 'Butt the pool terrace against the veranda edge.', ops: [{op: 'move-pool', veranda: 'south', gap: 0}]}, usage: free};
    if (/redesign.*entrance/.test(t))
      return {plan: {summary: 'Taller, wider entrance: 2.1 m pivot door, deeper bronze-framed canopy and a larger forecourt.', ops: [{op: 'set-entrance',
        door: {id: 'main-door', room: 'foyer', side: 'n', kind: 'main', width: 2.1, t: 0.45},
        entrance: {door: 'main-door', canopy: {depth: 4.6, width: 9, material: 'bronze'}, court: {w: 10, d: 9}}}]}, usage: free};
    return {plan: {summary: 'unsupported', ops: []}, usage: free};
  }
}
