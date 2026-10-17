import { expect, it } from 'vitest';
import { expressiveCottage, cottageObject } from '../parity/cottage';
import { compileV3Scene } from '../scene';
import { getObjectTopY } from '../elevation';
import { roofClearanceOverhangs } from '../roofClearance';
import { compileDetailedRoof } from '../construction';

it('keeps compiler child identity unique across materials, edits and reloads', () => {
  const scene=expressiveCottage();
  for(const subject of [scene, {...scene,objects:scene.objects.map(o => ({...o,material:{...o.material,id:'same-material'}}))}]) {
    const model=compileV3Scene(subject);
    expect(new Set(model.primitives.map(p=>p.id)).size).toBe(model.primitives.length);
    expect(model.primitives.map(p=>p.id)).toEqual(compileV3Scene(scene).primitives.map(p=>p.id));
    expect(model).toEqual(compileV3Scene(JSON.parse(JSON.stringify(subject))));
  }
});

it('keeps pitched bearings and top slabs at the authored wall top', () => {
  const scene=expressiveCottage(),model=compileV3Scene(scene);
  for(const mass of scene.objects.filter(o=>o.type==='building-mass')) {
    const cap=model.primitives.find(p=>p.id===`${mass.id}-slab-2`);
    expect(cap?.kind).toBe('box');
    if(cap?.kind==='box') expect(cap.position[1]+cap.size[1]/2).toBeCloseTo(getObjectTopY(mass));
  }
  const roof=scene.objects.find(o=>o.id==='living-roof')!;
  const infill=compileDetailedRoof(roof)!.find(p=>p.componentRole==='roof wall infill');
  expect(infill?.kind).toBe('triMesh');
  if(infill?.kind==='triMesh') expect(Math.min(...infill.vertices.filter((_,i)=>i%3===1))).toBeCloseTo(roof.architecture!.baseElevation);
});

it('limits neighboring eaves deterministically without rewriting authored intent', () => {
  const scene=expressiveCottage(),saved=JSON.stringify(scene),limits=roofClearanceOverhangs(scene);
  expect(limits.get('living-roof')).toBe(.25);
  expect(limits.get('bedroom')).toBe(.25);
  expect(JSON.stringify(scene)).toBe(saved);
  expect(roofClearanceOverhangs({...scene,objects:[...scene.objects].reverse()})).toEqual(limits);
  const separated={...scene,objects:[cottageObject('a','building-mass',0,0,5,5,3,0,{overhang:1}),cottageObject('b','building-mass',6,0,5,5,3,20,{overhang:1})]};
  expect([...roofClearanceOverhangs(separated).values()]).toEqual([1,1]);
});

it('has no opaque host wall behind the centre of any cottage glazing pane', () => {
  const model=compileV3Scene(expressiveCottage());
  const panes=model.primitives.filter(p=>p.category==='window'&&p.transparent);
  expect(panes).toHaveLength(13); // 12 intact boxes and one exposed, junction-clipped pane.
  for(const pane of panes) {
    if(pane.kind!=='box') continue;
    const blocked=model.primitives.filter(p=>p.kind==='box'&&p.sourceObjectId===pane.sourceObjectId&&p.componentRole==='facade wall').some(p=>p.kind==='box'&&p.position.every((v,i)=>Math.abs(v-pane.position[i]) < p.size[i]/2-1e-6));
    expect(blocked,pane.id).toBe(false);
  }
});
