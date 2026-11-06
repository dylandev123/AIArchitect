import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {compileHouse} from './compile';
import {deriveStage4} from './exterior';
import {loadTerraStage3} from './stage3Checkpoint';
import {allRooms} from './layout';
import {measure} from './pipeline';
import {componentFinish} from '../scene/appearance';
import {buildSceneRoof} from '../scene/roofs';
import {validateScene} from '../scene/model';

const dir = 'docs/architecture/staged-villa/stage4-exterior';
const saved = JSON.parse(readFileSync(`${dir}/terra-stage4.checkpoint.json`, 'utf8'));
const response = JSON.parse(readFileSync(`${dir}/live/result.json`, 'utf8'));
const originalScene = JSON.parse(readFileSync(`${dir}/terra-stage4.scene.json`, 'utf8'));
const base = deriveStage4(loadTerraStage3().spec, response.design).spec;
const spec = {...base, trim: {...base.trim!, visualRevision: 'stage4-v2' as const}};
const built = compileHouse(spec, 4), legacy = compileHouse(saved.spec, 4);

describe('Stage 4 corrections on the actual retained Terra villa (no model)', () => {
  it('retains legacy serialized scene data without the opt-in', () => {
    expect(JSON.stringify(legacy.scene)).toBe(JSON.stringify(originalScene));
    expect(componentFinish(undefined)).toBeUndefined();
    expect(legacy.scene.elements.every(e => !e.appearance && !e.roofWallFinish)).toBe(true);
  });
  it('preserves the 23-room plan, stair, circulation, massing and flat site', () => {
    expect(spec.blocks).toEqual(saved.spec.blocks);
    expect(spec.links).toEqual(saved.spec.links);
    expect(spec.stairs).toEqual(saved.spec.stairs);
    expect(spec.exterior).toEqual(saved.spec.exterior);
    expect(allRooms(spec)).toHaveLength(23);
    expect(built.scene.terrain).toBeUndefined();
    const next = new Map(built.scene.elements.map(e => [e.id, e]));
    for (const e of legacy.scene.elements.filter(e => /^(p-|slab-|stair-|guard-|rail-)/.test(e.id))) expect(next.get(e.id), e.id).toEqual(e);
    for (const e of built.scene.elements) if (legacy.components[e.id]) expect(built.components[e.id], e.id).toBe(legacy.components[e.id]);
    for (const c of new Set(Object.values(legacy.components))) expect(Object.values(built.components)).toContain(c);
    for (const e of legacy.scene.elements.filter(e => e.kind === 'roof')) {
      const n = next.get(e.id)!;
      expect([n.at, n.size, n.rotation, n.roofForm, n.eaves, n.overhang]).toEqual([e.at, e.size, e.rotation, e.roofForm, e.eaves, e.overhang]);
    }
  });
  it('retains real door passages and door IDs while glazing garden and terrace leaves', () => {
    const doors = built.scene.elements.filter(e => e.semanticType === 'exterior-door');
    expect(doors.length).toBeGreaterThan(0);
    for (const d of doors) {
      expect(d.kind).toBe('entrance');
      expect(d.appearance).toBe('glazed-door');
      expect(d.panels).toBe(2);
      const parent = built.scene.elements.find(e => e.id === d.parent)!;
      expect(parent.opening?.glazed).toBe(false); // a door passage, not fixed glass blocking access
      expect(parent.opening?.sill).toBe(0);
      const old = legacy.scene.elements.find(e => e.id === d.id)!;
      expect([d.at, d.size, d.parent]).toEqual([old.at, old.size, old.parent]);
    }
    expect(built.scene.elements.find(e => e.semanticType === 'front-door')?.appearance).toBe('timber-door');
  });
  it('fits function-aware glazing inside actual exposed wall runs, with fewer mullions', () => {
    const rooms = allRooms(spec);
    for (const w of built.scene.elements.filter(e => e.id.startsWith('w-') && e.opening?.glazed)) {
      const o = w.opening!;
      const room = rooms.find(r => w.id.replace(/-[nsew]-\d+$/, '').slice(2) === r.id)!;
      expect(Math.abs(o.x) + o.width / 2).toBeLessThanOrEqual(w.size[0] / 2);
      expect(o.sill + o.height).toBeLessThanOrEqual(w.size[1]);
      expect(w.panels).toBe(o.width < 1.4 ? 1 : 2);
      if (room.type === 'bath') {
        expect(o.sill).toBeGreaterThanOrEqual(1.4);
        expect(o.height).toBeGreaterThanOrEqual(0.9);
      } else {
        expect(o.height).toBeGreaterThanOrEqual(1.8);
        // The two narrow glass-wall sidelights beside a terrace door have only 1.45 m wall runs.
        if (o.width < 0.9) expect(w.size[0]).toBeLessThan(1.5);
      }
    }
    expect(validateScene(built.scene)).toBeDefined();
  });
  it('uses distinct local material settings; clay is not mapped to wood, bronze has seam detail', () => {
    expect(componentFinish('cut-limestone')).toMatchObject({surface: 'stone', metalness: 0});
    expect(componentFinish('painted-stucco')).toMatchObject({surface: 'stucco', metalness: 0});
    expect(componentFinish('bronze-roof')).toMatchObject({surface: 'metal', procedural: {tileMeters: 3, bumpScale: 0.02}});
    expect(componentFinish('clay-roof')).toMatchObject({surface: 'terracotta', metalness: 0});
    const claySpec = {...spec, blocks: spec.blocks.map(b => ({...b, roof: {...b.roof, material: 'timber' as const, color: '#B65A36'}}))};
    for (const roof of compileHouse(claySpec, 4).scene.elements.filter(e => e.roofForm && e.roofForm !== 'flat')) expect(roof.appearance).toBe('clay-roof');
    const gable = built.scene.elements.find(e => e.roofForm === 'gable')!;
    expect(gable.roofWallFinish?.appearance).toBe('cut-limestone');
    const parts = buildSceneRoof(gable, {color: '#A08053', roughness: 0.58, metalness: 0.38}, {color: gable.roofWallFinish!.color, roughness: 0.9, metalness: 0});
    for (const p of parts.filter(p => p.id.includes('-gable-'))) { expect(p.color).toBe('#B9A486'); expect(p.metalness).toBe(0); }
  });
  it('adds meaningful wall-head relief without spending the site budget on small shutters', () => {
    expect(built.scene.elements.some(e => e.id === 'cornice-main-living-plinth-s-0')).toBe(true);
    expect(built.scene.elements.some(e => e.id === 'cornice-upper-bedroom-bar-s-0')).toBe(true);
    expect(built.scene.elements.length).toBeLessThanOrEqual(320);
    expect(measure(spec, 4, 4, 3).findings).toEqual([]);
  });
});
