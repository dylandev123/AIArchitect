import { describe, expect, it } from 'vitest';
import { expressiveCottage } from '../parity/cottage';
import { compileV3Scene, type V3Scene } from '../scene';
import { executeV3SceneOperations } from '../operations';
import { facadeBays, roofFinish } from '../compositionPolicies';

const of = (scene: V3Scene, id: string) => compileV3Scene(scene).primitives.filter(p => p.sourceObjectId === id);

describe('V3 composition material authority', () => {
  it('roof children use roof finish; infill and facade walls keep the mass finish; glazing stays independent', () => {
    const scene = expressiveCottage();
    for (const id of ['bedroom', 'living-roof']) {
      const roof = of(scene, id).filter(p => p.category === 'roof');
      // The roof finish is the authored metal laid as the shared standing-seam system; flashing is its darker fold.
      expect(roof.filter(p => !['roof wall infill', 'roof flashing', 'junction roof flashing', 'roof soffit'].includes(p.componentRole!)).every(p => p.color === '#42494a' && /metal/.test(p.surface ?? ''))).toBe(true);
      expect(roof.some(p => p.componentRole === 'roof seams')).toBe(true);
      expect(roof.filter(p => p.componentRole === 'roof wall infill').every(p => p.surface === 'stone')).toBe(true);
    }
    const living = of(scene, 'living');
    expect(living.filter(p => p.componentRole === 'facade wall' && p.color === '#d3c9b8').every(p => p.surface === 'stone')).toBe(true);
    expect(living.filter(p => p.componentRole === 'facade glazing').every(p => p.color === '#8fbdc9')).toBe(true);
    expect(living.every(p => p.sourceObjectId === 'living' && p.semanticRole === 'living')).toBe(true);
  });

  it('an explicit roof that merely repeats its host wall joins the roof family; an authored counterpoint is kept', () => {
    const scene = expressiveCottage(), roof = scene.objects.find(o => o.id === 'living-roof')!;
    const inherited = { ...roof, material: { ...scene.objects.find(o => o.id === 'living')!.material } };
    expect(roofFinish({ ...scene, objects: scene.objects.map(o => o.id === roof.id ? inherited : o) }, inherited)).toMatchObject({ surface: 'metal', color: '#42494a' });
    const counterpoint = { ...roof, material: { id: 'cedar', color: '#7a5a3a', surface: 'wood' as const } };
    expect(roofFinish(scene, counterpoint).id).toBe('cedar');
    expect(inherited.material.id).toBe('stone'); // semantic object never rewritten
  });

  it('veranda reads as a light timber frame: smooth slender members, textured deck only', () => {
    const v = of(expressiveCottage(), 'veranda');
    const members = v.filter(p => p.category !== 'floor');
    expect(members.every(p => p.surface === undefined)).toBe(true);
    expect(v.find(p => p.category === 'floor')?.surface).toBe('wood');
    const posts = members.filter(p => p.componentRole === 'colonnade post');
    expect(posts.length).toBe(5);
    // Slender but structurally believable: V2's ~16 cm colonnade proportion, never wire-thin or massive.
    expect(posts.every(p => p.kind === 'box' && p.size[0] >= .12 && p.size[0] <= .2)).toBe(true);
    expect(members.filter(p => p.componentRole === 'veranda canopy').every(p => p.kind === 'box' && p.size[1] <= .12)).toBe(true);
  });
});

describe('V3 facade bays and glazing', () => {
  it('preset bays are equal, centred and share sill/head datums, without inflating opening count', () => {
    const bays = facadeBays(7);
    expect(bays).toHaveLength(2);
    const centres = bays.map(b => (b.start + b.end) / 2), widths = bays.map(b => b.end - b.start);
    expect(centres[0]).toBeCloseTo(.25); expect(centres[1]).toBeCloseTo(.75); expect(widths[0]).toBeCloseTo(widths[1]);
    // Test the preset before connected-envelope clipping; junction tests cover partial and swallowed bays.
    const glass = compileV3Scene(expressiveCottage(), {junctions:false}).primitives.filter(p=>p.sourceObjectId==='bedroom').filter(p => p.componentRole === 'facade glazing' && p.kind === 'box');
    expect(glass).toHaveLength(7);
    const punched = glass.filter(p => p.kind === 'box' && p.size[1] < 2);
    expect(new Set(punched.map(p => p.kind === 'box' ? (p.position[1] - p.size[1] / 2).toFixed(2) : '')).size).toBe(1);
  });

  it('glazing sits behind the exterior wall plane, never proud of it', () => {
    const scene = expressiveCottage(), living = scene.objects.find(o => o.id === 'living')!.architecture!;
    const south = of(scene, 'living').filter(p => p.componentRole === 'facade glazing' && p.kind === 'box' && Math.abs(p.position[2] - (living.z + living.depth / 2)) < .5);
    expect(south.length).toBeGreaterThan(0);
    for (const p of south) if (p.kind === 'box') expect(p.position[2] + p.size[2] / 2).toBeLessThan(living.z + living.depth / 2);
  });
});

describe('V3 composition preserves massing and editability', () => {
  const edit = (scene: V3Scene, operations: unknown[]) => { const r = executeV3SceneOperations(scene, { intent: 'edit', operations }); expect(r.errors).toEqual([]); expect(r.ok).toBe(true); return r.scene; };
  it('authored mass offsets and dimensions are untouched by composition', () => {
    const scene = expressiveCottage(), before = JSON.stringify(scene.objects.map(o => o.architecture));
    compileV3Scene(scene);
    expect(JSON.stringify(scene.objects.map(o => o.architecture))).toBe(before);
  });
  it('widen bedroom, enlarge glazing, deepen veranda, change accent and roof all mutate authored objects and recompile', () => {
    let scene = expressiveCottage();
    scene = edit(scene, [{ op: 'editArchitecture', target: 'bedroom', architecture: { width: 9 } }]);
    expect(scene.objects.find(o => o.id === 'bedroom')!.architecture!.width).toBe(9);
    const living = scene.objects.find(o => o.id === 'living')!;
    scene = edit(scene, [{ op: 'setComposition', target: 'living', composition: { ...living.composition, openings: living.composition!.openings!.map(o => o.id === 'corner' ? { ...o, start: .2 } : o) } }]);
    scene = edit(scene, [{ op: 'editArchitecture', target: 'veranda', architecture: { depth: 4.4 } }]);
    scene = edit(scene, [{ op: 'changeMaterial', target: 'accent', material: { id: 'cedar', color: '#6d4c33', surface: 'wood' } }]);
    scene = edit(scene, [{ op: 'changeMaterial', target: 'living-roof', material: { id: 'zinc', color: '#7d8589', surface: 'metal' } }]);
    const roof = scene.objects.find(o => o.id === 'living-roof')!;
    scene = { ...scene, objects: scene.objects.map(o => o.id === roof.id ? { ...o, roofForm: 'hip' } : o) };
    const model = compileV3Scene(scene);
    expect(model.primitives.filter(p => p.sourceObjectId === 'bedroom' && p.componentRole === 'facade glazing').length).toBeGreaterThan(0);
    expect(model.primitives.filter(p => p.sourceObjectId === 'accent').every(p => p.color === '#6d4c33')).toBe(true);
    expect(model.primitives.filter(p => p.sourceObjectId === 'living-roof' && p.componentRole === 'roof plane').every(p => p.color === '#7d8589')).toBe(true);
    // Secondary implicit roofs follow the primary roof family after a roof finish change.
    expect(model.primitives.filter(p => p.sourceObjectId === 'bedroom' && p.componentRole === 'roof plane').every(p => p.color === '#7d8589')).toBe(true);
    const veranda = model.primitives.filter(p => p.sourceObjectId === 'veranda' && p.componentRole === 'veranda slab');
    expect(veranda[0].kind === 'box' && veranda[0].size[2]).toBeCloseTo(4.4);
  });
});
