/** The original brief governs the programme; an authorized redesign is stated to the model and applied by the gate.
 * Plans below are developer edits of Terra's retained rejected revision (read only), not model output. */
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {analysePlan,programmeCounts} from './analysis';
import {checkProgramme} from './evaluate';
import {deriveBriefProgramme,checkBriefProgramme,isBedroomSpace,countFor} from './briefProgramme';
import {assessRevision,authorizeRevisionExperiment,buildRevisionRequest,REDESIGN_AUTHORIZATION,revisionResponseSchema} from './revise';
import {rejectedRevision,originalMansion} from '../coordination.fixture';
import type {ArchitecturalPlan} from '../plan';
import {compactTwoLevelFaulty,compactTwoLevelRepairMock} from './revision.fixture';
const brief:string=JSON.parse(readFileSync('docs/architecture/canonical-second-revision-2026-11-02/request.context.json','utf8')).brief;
const without=(p:ArchitecturalPlan,drop:(s:ArchitecturalPlan['spaces'][number])=>boolean)=>{const q=structuredClone(p);q.spaces=q.spaces.filter(s=>!drop(s));return q;};
const isBath=(s:{id:string;use:string})=>/\bbath|ensuite/i.test(s.id+s.use);
const isBed=isBedroomSpace;
/** Six bedroom suites and no separate baths: far below the failed plan's 9 suites and 16 baths, yet within the brief. */
const leanDesign=()=>{const p=rejectedRevision();let kept=0;return without(p,s=>isBath(s)||(isBed(s)&&++kept>6));};

describe('the brief is authoritative for the programme',()=>{
 const reqs=deriveBriefProgramme(brief);
 it('derives only what the brief says, each with its own words',()=>{
  expect(reqs.map(r=>[r.id,r.minimum])).toEqual([['bedrooms',5],['living-entertainment',2],['entrance',1],['service',1],['terraces',2],['pool',1]]);
  for(const r of reqs)expect(brief).toContain(r.briefPhrase);
  expect(reqs.find(r=>r.id==='bedrooms')).toMatchObject({approximate:6,briefPhrase:'approximately six generous bedroom suites'});
  // Nothing the brief does not request: no bathroom, kitchen or dining obligation.
  expect(reqs.map(r=>r.category)).not.toContain('bathroom');expect(reqs.map(r=>r.category)).not.toContain('kitchen');expect(reqs.map(r=>r.category)).not.toContain('dining');
 });
 it('invents nothing from a brief that states nothing countable, and respects exact numbers',()=>{
  expect(deriveBriefProgramme('Design something beautiful.')).toEqual([]);
  expect(deriveBriefProgramme('A house with three bedrooms.')).toMatchObject([{id:'bedrooms',minimum:3}]);
  expect(deriveBriefProgramme('A house with three bedrooms.')[0].approximate).toBeUndefined();
 });
 it('the failed plan carries inflated counts the brief never asked for',()=>{
  const c=programmeCounts(rejectedRevision());expect(c.bedroom).toBe(12);expect(c.bathroom).toBe(16);
  // Brief-gate count: suite-wing halls and the gallery are not bedrooms; the failed plan has nine real suites.
  expect(countFor(rejectedRevision(),'bedroom')).toBe(9);
 });
 it('accepts a design that satisfies the brief without keeping the failed plan\'s inflated counts',()=>{
  const lean=leanDesign(),c=programmeCounts(lean);
  expect(countFor(lean,'bedroom')).toBe(6);expect(c.bathroom).toBeLessThan(programmeCounts(rejectedRevision()).bathroom);
  expect(checkProgramme(rejectedRevision(),lean).preserved).toBe(false); // the old floor would have stopped it
  const r=checkBriefProgramme(reqs,lean);expect(r.preserved).toBe(true);expect(r.missing).toEqual([]);
 });
 it('still rejects genuinely missing required accommodation, naming the brief phrase',()=>{
  const base=rejectedRevision();
  let n=0;const fewBeds=without(base,s=>isBed(s)&&++n>4);
  expect(checkBriefProgramme(reqs,fewBeds).missing.map(m=>m.id)).toEqual(['bedrooms']);
  expect(checkBriefProgramme(reqs,fewBeds).missing[0]).toMatchObject({minimum:5,found:4,briefPhrase:'approximately six generous bedroom suites'});
  const noPool=structuredClone(base);noPool.pools=[];expect(checkBriefProgramme(reqs,noPool).missing.map(m=>m.id)).toEqual(['pool']);
  const noTerrace=structuredClone(base);noTerrace.terraces=noTerrace.terraces.slice(0,1);expect(checkBriefProgramme(reqs,noTerrace).missing.map(m=>m.id)).toEqual(['terraces']);
  const noService=without(base,s=>/pantry|laundry|store|utility|service/i.test(s.use+s.id));expect(checkBriefProgramme(reqs,noService).missing.map(m=>m.id)).toContain('service');
  const noEntry=without(base,s=>/entry|foyer|arrival|vestibule/i.test(s.use+s.id)&&!s.outdoor);expect(checkBriefProgramme(reqs,noEntry).missing.map(m=>m.id)).toContain('entrance');
  const noLiving=without(base,s=>!s.outdoor&&/living|salon|lounge|family room|entertain|media|cinema|games/i.test(s.use+s.id));expect(checkBriefProgramme(reqs,noLiving).missing.map(m=>m.id)).toContain('living-entertainment');
 });
 it('assessRevision applies the brief gate, and falls back to preservation only when the brief states nothing countable',()=>{
  const resp=(plan:ArchitecturalPlan)=>({status:'revised',revisionKind:'redesign',concept:'mock',plan,addressed:[],changes:[],retained:[],limitations:[]});
  const original=rejectedRevision(),a0=analysePlan(original);
  const prog=(a:ReturnType<typeof assessRevision>)=>a.checks.find(c=>c.id==='programme-preserved')!;
  expect(prog(assessRevision(original,resp(leanDesign()),'redesign-permitted',a0,{brief,redesign:true})).ok).toBe(true);
  expect(prog(assessRevision(original,resp(leanDesign()),'redesign-permitted',a0)).ok).toBe(false); // legacy gate, no brief
  expect(prog(assessRevision(original,resp(leanDesign()),'redesign-permitted',a0,{brief:'Design something beautiful.'})).ok).toBe(false);
  const noPool=leanDesign();noPool.pools=[];
  const bad=assessRevision(original,resp(noPool),'redesign-permitted',a0,{brief,redesign:true});
  expect(prog(bad).ok).toBe(false);expect(prog(bad).detail).toContain('rectangular swimming pool');expect(bad.stopReasons).toContain('programme-not-preserved');
 });
 it('the request obliges only the brief\'s requirements and shows the plan\'s counts as information',async()=>{
  const plan=rejectedRevision(),req=await buildRevisionRequest({brief,plan,analysis:analysePlan(plan,originalMansion()),redesign:true});
  const r=(req.context as {requirements:Record<string,unknown>}).requirements;
  expect(r.mustRetain).toBeUndefined();
  expect((r.derivedRequirements as {id:string}[]).map(d=>d.id)).toEqual(['bedrooms','living-entertainment','entrance','service','terraces','pool']);
  expect((r.currentPlanCounts as Record<string,number>).bedroom).toBe(9);expect((r.currentPlanCounts as Record<string,number>).bathroom).toBe(16);
  expect(String(r.note)).toContain('may be merged, reorganised, differentiated or removed');
  expect(req.system).not.toContain('and the planned programme');
 });
});

describe('an authorized redesign is explicit and checked',()=>{
 const plan=rejectedRevision();
 it('states redesign authority, keeps every diagnostic and the image, and records the measured disposition',async()=>{
  const a=analysePlan(plan,originalMansion());expect(a.disposition.kind).toBe('repair');
  const plain=await buildRevisionRequest({brief,plan,analysis:a,image:true}),red=await buildRevisionRequest({brief,plan,analysis:a,image:true,redesign:true});
  const w=(req:typeof red)=>(req.context as {architecturalWeaknesses:{disposition:Record<string,unknown>;signals:unknown}}).architecturalWeaknesses;
  expect(w(plain).disposition.kind).toBe('repair');
  expect(w(red).disposition).toMatchObject({kind:'redesign',measuredKind:'repair',source:'explicit user authorization'});
  expect(String(w(red).disposition.note)).toContain('existing repetitive composition is not to be preserved');
  expect(red.system.endsWith(REDESIGN_AUTHORIZATION)).toBe(true);expect(plain.system).not.toContain('REDESIGN AUTHORIZED');
  for(const k of ['measured','dependencies','findings','currentPlan','drawing'])expect(JSON.stringify((red.context as Record<string,unknown>)[k])).toBe(JSON.stringify((plain.context as Record<string,unknown>)[k]));
  expect(red.sha256.image).toBe(plain.sha256.image);expect(red.png!.length).toBeGreaterThan(1000);
  for(const w of ['wing arrangement','massing','floors','circulation','suite','roof','identity'])expect(REDESIGN_AUTHORIZATION).toContain(w);
  expect(REDESIGN_AUTHORIZATION).toContain('not merely fewer validation findings');
 });
 it('needs a redesign-permitted scope',()=>{
  expect(()=>authorizeRevisionExperiment({experimentId:'e',authorizedBy:'t',scope:'repair-only',directive:'redesign'})).toThrow();
  expect(authorizeRevisionExperiment({experimentId:'e',authorizedBy:'t',scope:'redesign-permitted',directive:'redesign'}).directive).toBe('redesign');
 });
 it('judges a measured-repair original by concept signals when redesign is authorized',()=>{
  const original=compactTwoLevelFaulty(),a0=analysePlan(original);expect(a0.disposition.kind).toBe('repair');
  const resp={status:'revised',revisionKind:'repair',concept:'mock',plan:compactTwoLevelRepairMock(),addressed:[],changes:[],retained:[],limitations:[]};
  const off=assessRevision(original,resp,'redesign-permitted',a0),on=assessRevision(original,resp,'redesign-permitted',a0,{redesign:true});
  expect(off.checks.find(c=>c.id==='improvement-demonstrated')!.detail).toContain('Original measured as repair');
  expect(on.checks.find(c=>c.id==='improvement-demonstrated')!.detail).toContain('Redesign was authorized by the user');
 });
 it('an unchanged plan is never an improvement, authorized redesign or not',()=>{
  const a0=analysePlan(plan,originalMansion()),resp={status:'revised',revisionKind:'redesign',concept:'x',plan,addressed:[],changes:[],retained:[],limitations:[]};
  expect(revisionResponseSchema.safeParse(resp).success).toBe(true);
  const r=assessRevision(plan,resp,'redesign-permitted',a0,{brief,redesign:true});
  expect(r.status).toBe('stopped');expect(r.stopReasons).toContain('no-demonstrated-improvement');
 });
});
