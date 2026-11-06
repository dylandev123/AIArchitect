import {describe,it,expect} from 'vitest';
import {compileArchitecturalPlan} from './plan';
import {compositionFixture} from './compositions.fixture';
import {physicalEvidence} from '../experimental/semantic-building/physical';
import {validateScene} from '../scene/model';
describe('developer-authored exterior compositions (not AI quality evidence)',()=>{
 it.each(['compact','waterfront','courtyard'] as const)('%s preserves intent, geometry, provenance and physical thresholds',name=>{
  const p=compositionFixture(name),r=compileArchitecturalPlan(p);
  expect(r.scene.architecturalPlan).toEqual(p);expect(compileArchitecturalPlan(p).scene).toEqual(r.scene);
  expect(validateScene(JSON.parse(JSON.stringify(r.scene)))).toEqual(r.scene);
  expect(Object.keys(r.provenance).sort()).toEqual(r.scene.elements.map(e=>e.id).sort());
  expect(r.access.reachable).toEqual(expect.arrayContaining(p.spaces.filter(s=>!s.outdoor).map(s=>s.id)));
  expect(physicalEvidence(r).failures).toEqual([]);
 });
 it('preserves rotated stepped roofs and multiple elevated windows',()=>{
  const p=compositionFixture('waterfront');p.orientation=.37;const r=compileArchitecturalPlan(p);
  expect(physicalEvidence(r).failures).toEqual([]);
  for(const id of ['salon-east-a','salon-east-b'])expect(r.portalEvidence.find(e=>(e as {id:string}).id===id)).toMatchObject({sill:.8,passable:false});
  expect(r.scene.elements.find(e=>e.id==='upper-gallery-roof')!.size[0]).toBeCloseTo(5.8);
  expect(r.scene.elements.find(e=>e.id==='salon-sun-filter')!.panels).toBe(32);
 });
 it('rejects unresolved roof junctions, vertical wall duplication and opening junction crossings',()=>{
  const roofs=compositionFixture('compact');roofs.roofs[0].overhang=1;const flush=compileArchitecturalPlan(roofs).scene.elements.find(e=>e.id==='gallery-roof')!;expect(flush.size[0]).toBeCloseTo(4);expect(flush.size[2]).toBeCloseTo(10); // east edge flush against sleep-room; west, south, north keep 1 m
  const gap=compositionFixture('compact');gap.roofs[0].overhang=1;gap.spaces.find(s=>s.id==='sleep-room')!.depth=6;expect(()=>compileArchitecturalPlan(gap)).toThrow(/gallery|roof/);
  const walls=compositionFixture('waterfront');walls.spaces.find(s=>s.id==='salon')!.height=4.8;expect(()=>compileArchitecturalPlan(walls)).toThrow('overlapping wall sections');
  const opening=compositionFixture('courtyard');opening.portals.find(p=>p.id==='east-door')!.width=6;expect(()=>compileArchitecturalPlan(opening)).toThrow('opening');
 });
 it('rejects unsupported or physically conflicting intent without changing it',()=>{
  const p=compositionFixture('compact');p.portals.find(p=>p.id==='front-door')!.sill=.3;expect(()=>compileArchitecturalPlan(p)).toThrow();
  const overlap=compositionFixture('waterfront');overlap.portals.find(p=>p.id==='salon-east-b')!.alignment='start';expect(()=>compileArchitecturalPlan(overlap)).toThrow('opening');
  const roof=compositionFixture('courtyard');roof.roofs[1].form='gable';delete roof.roofs[1].rise;expect(()=>compileArchitecturalPlan(roof)).toThrow('selected rise');
  const screen=compositionFixture('compact');screen.screens![0].side='north';expect(()=>compileArchitecturalPlan(screen)).toThrow('obstructs');
  const curve=compositionFixture('compact');Object.assign(curve.spaces[0],{curveRadius:4});expect(()=>compileArchitecturalPlan(curve)).toThrow();
 });
});
