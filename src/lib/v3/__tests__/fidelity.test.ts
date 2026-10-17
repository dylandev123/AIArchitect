import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveV3Fidelity } from '../fidelity';
import { compileV3Scene, type V3Scene } from '../scene';
const fixture = (): V3Scene => JSON.parse(readFileSync('docs/architecture/parity/flat-mansion/scene-f2149916.json','utf8')).v3Scene;
describe('architectural fidelity', () => {
 it('repairs site-proven reversed facades without transforming any object', () => {
  const original=fixture(), copy=JSON.stringify(original), {scene,diagnostics}=resolveV3Fidelity(original);
  expect(diagnostics.some(d=>d.code==='FACADE_MAPPING_REPAIRED')).toBe(true);
  const main=scene.objects[0];
  expect(main.composition?.openings?.find(o=>o.id==='arrival-door')?.facade).toBe('north');
  expect(main.composition?.openings?.find(o=>o.id==='great-room-view')?.facade).toBe('south');
  expect(scene.objects.map(o=>o.transform)).toEqual(original.objects.map(o=>o.transform));
  expect(JSON.stringify(original)).toBe(copy);
 });
 it('preserves mixed or ambiguous orientation', () => {
  const s=fixture();s.objects[1].composition!.facadeRoles!.north='arrival';
  const r=resolveV3Fidelity(s);
  expect(r.diagnostics.some(d=>d.code==='ORIENTATION_CONFLICT')).toBe(true);
  expect(r.scene.objects[0].composition?.openings).toEqual(s.objects[0].composition?.openings);
 });
 it('resolves legacy ratio-like height and prevents double eaves', () => {
  const {scene}=resolveV3Fidelity(fixture()), roof=scene.objects.find(o=>o.id==='main-roof')!;
  expect(roof.overhang).toBe(0);
  expect(Math.tan(roof.pitch!*Math.PI/180)*6.6).toBeCloseTo(1.65);
  expect(roof.architecture?.width).toBe(18.2);
  const s=fixture(), r=s.objects.find(o=>o.id==='main-roof')!;r.pitchUnit='degrees';r.pitch=20;
  expect(resolveV3Fidelity(s).scene.objects.find(o=>o.id===r.id)?.pitch).toBe(20);
  r.pitchUnit='ratio';r.pitch=.25;
  expect(resolveV3Fidelity(s).scene.objects.find(o=>o.id===r.id)?.pitch).toBeCloseTo(Math.atan(.25)*180/Math.PI);
 });
 it('repairs entry-court balcony and flags ambiguous shared private facade', () => {
  const r=resolveV3Fidelity(fixture());
  expect(r.diagnostics.some(d=>d.code==='BALCONY_FACADE_REPAIRED'&&d.targetId==='west-upper-balcony')).toBe(true);
  expect(r.diagnostics.some(d=>d.code==='BALCONY_SHARED_WALL'&&d.targetId==='east-upper-balcony')).toBe(true);
 });
 it('retains contradictory descriptive double height, opens explicit whole volume', () => {
  const s=fixture();
  expect(resolveV3Fidelity(s).diagnostics.some(d=>d.code==='DOUBLE_HEIGHT_CONFLICT')).toBe(true);
  s.objects[0].composition!.spaceHeight='double-height';
  const model=compileV3Scene(s);
  expect(model.primitives.filter(p=>p.sourceObjectId===s.objects[0].id&&p.componentRole==='floor slab')).toHaveLength(2);
 });
 it('retains all authored roof owners and builds connected abutments', () => {
  const s=fixture(),model=compileV3Scene(s);
  for(const roof of s.objects.filter(o=>o.type==='roof-form')) expect(model.primitives.some(p=>p.sourceObjectId===roof.id&&p.category==='roof')).toBe(true);
  expect(model.primitives.some(p=>p.componentRole==='junction abutment flashing')).toBe(true);
  const main=model.primitives.filter(p=>p.sourceObjectId==='main-roof'&&p.kind==='triMesh').flatMap(p=>p.kind==='triMesh'?p.vertices.filter((_,i)=>i%3===1):[]);
  expect(Math.max(...main)).toBeGreaterThan(10);
  if(process.env.FIDELITY_REPORT) writeFileSync('/tmp/fidelity-diagnostics.json',JSON.stringify(resolveV3Fidelity(s).diagnostics,null,2));
 });
});

// Small independent scenes prevent fixes from depending on mansion ids or dimensions.
const mass = (id:string,x=0,z=0): V3Scene['objects'][number] => ({id,type:'building-mass',semanticRole:'residence',label:id,geometryKind:'box',transform:{position:[x,3,z],rotation:[0,0,0],scale:[1,1,1]},dimensions:[10,6,8],levels:2,material:{id:'stone',color:'#aaaaaa'},composition:{massHierarchy:'primary',facadeRoles:{north:'view',south:'arrival'},openings:[{id:'entry',type:'door',facade:'south',floors:'ground',start:.4,end:.6}],mainEntry:{openingId:'entry',canopyDepth:1}}});
const small = ():V3Scene => ({version:3,site:{width:80,depth:80},relationships:[],metadata:{},objects:[mass('residence'),{...mass('approach',0,-15),type:'driveway',composition:undefined},{...mass('water',0,15),type:'pool',composition:undefined}]});
describe('general fidelity invariants',()=>{
 it('repairs a reversed independent site, remains idempotent, and preserves site objects',()=>{
  const s=small(),a=resolveV3Fidelity(s),b=resolveV3Fidelity(a.scene);
  expect(a.scene.objects[0].composition?.facadeRoles).toEqual({north:'arrival',south:'view'});
  expect(b.scene).toEqual(a.scene);
  expect(a.scene.objects.slice(1)).toEqual(s.objects.slice(1));
 });
 it('flags contradictory arrival objects without remapping',()=>{
  const s=small();s.objects.push({...s.objects[1],id:'second-approach',transform:{...s.objects[1].transform,position:[0,0,20]}});
  const r=resolveV3Fidelity(s);
  expect(r.diagnostics.some(d=>d.code==='ORIENTATION_CONFLICT')).toBe(true);
  expect(r.scene.objects[0].composition).toEqual(s.objects[0].composition);
 });
 it('does not infer ratio units without supporting roof height',()=>{
  const s=small();s.objects=[{...mass('roof'),type:'roof-form',roofForm:'hip',pitch:.3,dimensions:[10,.02,8],composition:undefined}];
  const r=resolveV3Fidelity(s);
  expect(r.scene.objects[0].pitch).toBe(.3);
  expect(r.diagnostics.some(d=>d.code==='ROOF_PITCH_CONFLICT')).toBe(true);
 });
 it('keeps a bearing footprint overhang but removes an exactly included one',()=>{
  const s=small();s.objects.push({...mass('roof'),type:'roof-form',hostId:'residence',roofForm:'hip',overhang:1,dimensions:[10,2,8],pitch:25,composition:undefined});
  expect(resolveV3Fidelity(s).scene.objects.at(-1)?.overhang).toBe(1);
  s.objects.at(-1)!.dimensions=[12,2,10];
  expect(resolveV3Fidelity(s).scene.objects.at(-1)?.overhang).toBe(0);
 });
 it('uses explicit whole-volume semantics for continuous glazing and no intermediate slab',()=>{
  const s=small();s.objects=[s.objects[0]];s.objects[0].composition={spaceHeight:'double-height',openings:[{id:'tall-glass',facade:'south',floors:'all',type:'glazing-zone',start:.1,end:.9,heightRatio:.9}]};
  const p=compileV3Scene(s).primitives.filter(p=>p.sourceObjectId==='residence');
  expect(p.filter(p=>p.componentRole==='floor slab')).toHaveLength(2);
  expect(p.some(p=>p.id.includes('level-1'))).toBe(false);
  expect(p.some(p=>p.kind==='box'&&p.category==='window'&&p.size[1]>4)).toBe(true);
 });
 it('retains connected roof intent and removes roof triangles within adjacent occupied mass',()=>{
  const s=small();s.objects=[{...mass('tall'),roofForm:'hip',pitch:25},{...mass('wing',9,0),dimensions:[8,4,8],transform:{position:[9,2,0],rotation:[0,0,0],scale:[1,1,1]},levels:1,roofForm:'hip',pitch:22,composition:{massHierarchy:'secondary'}}];
  const p=compileV3Scene(s).primitives;
  expect(p.some(p=>p.sourceObjectId==='wing'&&p.category==='roof')).toBe(true);
  for(const t of p.filter(p=>p.sourceObjectId==='wing'&&p.category==='roof'&&p.kind==='triMesh')) if(t.kind==='triMesh') for(let i=0;i<t.vertices.length;i+=9){
   const x=(t.vertices[i]+t.vertices[i+3]+t.vertices[i+6])/3,y=(t.vertices[i+1]+t.vertices[i+4]+t.vertices[i+7])/3,z=(t.vertices[i+2]+t.vertices[i+5]+t.vertices[i+8])/3;
   expect(Math.abs(x)<4.999&&Math.abs(z)<3.999&&y<5.999&&y>0).toBe(false);
  }
 });
});
