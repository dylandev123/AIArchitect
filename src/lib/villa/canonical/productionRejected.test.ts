import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {architecturalPlanSchema,compileArchitecturalPlan,PlanRejection} from './plan';
import {diagnosePlan} from './diagnose';
import {rejectedGeneration} from './rejection';
/** The retained production rejection (caribbean-beach-estate-01, 3 Nov 2026): the real model-authored plan, never edited. */
const FILE='docs/architecture/production-rejected-2026-11-03/caribbean-beach-estate-01.rejected.json';
const raw=readFileSync(FILE);
const exported=JSON.parse(raw.toString());
const plan=()=>architecturalPlanSchema.parse(structuredClone(exported.plan));
describe('the retained production rejected plan is diagnosed completely, without artefacts and without being altered',()=>{
 it('the export is the preserved original',()=>{
  expect(createHash('sha256').update(raw).digest('hex')).toBe('468a0e5bd47d3ceb30d3d3a97997b0c7fdcd8bcffd63e1874b0a669f1519395a');
 });
 it('the compiler stops in derive and names every independent roof-span and facade-rhythm problem, not only the first',()=>{
  let decisions:string[]=[];
  try{compileArchitecturalPlan(plan());}catch(e){expect(e).toBeInstanceOf(PlanRejection);decisions=(e as PlanRejection).decisions;}
  expect(decisions).toHaveLength(8); // 2 roof-span problems + 6 facade rhythms no run of their wall can hold
  expect(decisions[0]).toMatch(/ocean-veranda is listed in this span \(hip.*its own different roof \(flat.*differs in form, rise, overhang, material/);
  expect(decisions[1]).toMatch(/do not tile one rectangle \(318\.00 m² .* 342\.00 m²/);
  expect(decisions.slice(2).map(d=>d.split(':')[0]).sort()).toEqual(['dining-sea-doors','great-hall-west-light','guest-one-east-windows','guest-two-east-windows','kitchen-west-windows','library-east-windows']);
 });
 it('the "great hall has no roof" finding was an artefact of the ownership failure and is gone; the hidden span conflicts are reported',()=>{
  const errors=diagnosePlan(plan()).findings.filter(f=>f.severity==='error');
  expect(errors.find(f=>f.stage==='roofs'&&f.id==='great-hall')).toBeUndefined();
  expect(errors.some(f=>/one roof needs one envelope height; great-hall 6\.6 m, ocean-veranda 3\.8 m/.test(f.message))).toBe(true);
  // A volume's roof claim no longer means "everything under it": the kitchen, dining room, scullery and powder room keep their room-owned roofs.
  expect(errors.some(f=>f.id==='living-volume')).toBe(false);
 });
 it('every roof-pair and roof-projection finding comes from overhangs alone; edges wholly against a neighbour are now built flush and the rest are named',()=>{
  const p=plan();p.composition!.roofSpans[0].spaces=['great-hall'];
  const all=diagnosePlan(p).findings,roofs=all.filter(f=>f.stage==='roofs'&&f.severity==='error');
  expect(roofs).toHaveLength(25); // 40 before eaves were resolved per edge
  expect(all.filter(f=>f.stage==='roofs'&&f.severity==='observation')).toHaveLength(29); // edges built flush, each stated
  // every remaining one says why the eave could not be made flush: the neighbour stands against only part of the edge
  expect(roofs.every(f=>/stands against only part of that|does not stand against/.test(f.message))).toBe(true);
  p.roofs.forEach(r=>{r.overhang=0;});p.composition!.roofSpans.forEach(s=>{s.overhang=0;});
  expect(diagnosePlan(p).findings.filter(f=>f.stage==='roofs'&&f.severity==='error')).toEqual([]);
 });
 it('17 facade-rhythm findings become 6 rhythm-level decisions (plus one conflict with an authored opening); none is made valid by guessing',()=>{
  const findings=diagnosePlan(plan()).findings.filter(f=>f.stage==='openings'&&f.cause?.startsWith('facade:'));
  expect(findings.map(f=>f.id).sort()).toEqual(['dining-sea-doors','great-hall-west-light','guest-one-east-windows','guest-two-east-windows','hall-to-veranda/great-hall-sea-glazing-2','kitchen-west-windows','library-east-windows']);
 });
 it('the rejection groups the findings by decision and never claims a later phase passed',()=>{
  const r=rejectedGeneration({plan:exported.plan,error:new PlanRejection(['x'],'derive'),brief:''});
  const reach=r.rootCauses.filter(c=>c.key.startsWith('roof-reach:'));
  expect(reach.map(c=>c.count).sort((a,b)=>a-b)).toEqual([5,20]);
  expect(r.rootCauses.length).toBeLessThan(r.diagnostics.errors/2);
  expect(r.rootCauses.reduce((n,c)=>n+c.count,0)).toBe(r.diagnostics.errors);
  expect(r.notReached).toEqual(['construction','exterior','composition','site','validate']);
  expect(r.completedHouse).toBe(false);expect(r.plan).toEqual(plan());
 });
});
