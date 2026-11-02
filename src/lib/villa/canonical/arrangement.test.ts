/** Wing anchoring, collision explanation, composition measurement and the concept diagram. Fixtures are developer-authored
 * and prove mechanics only: nothing here shows that a model designs better. */
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {compileArchitecturalPlan,type ArchitecturalPlan} from './plan';
import {diagnosePlan} from './diagnose';
import {resolveRects,volumeCollisions,explainCollisions,compositionOf,renderConceptSvg,conceptDrift,displacedBy} from './arrangement';
import {conceptFixtures,spineParti,twoWingHouse} from './arrangement.fixture';
import {physicalEvidence} from '../experimental/semantic-building/physical';
import {DesignConflict} from '../experimental/semantic-building/compiler';
const plain=(plan:ArchitecturalPlan)=>volumeCollisions(plan,resolveRects(plan).rects);
const decisions=(plan:ArchitecturalPlan)=>{try{compileArchitecturalPlan(plan);return [] as string[];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};
const lcg=(seed:number)=>()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
const retained=(f:string)=>{const j=JSON.parse(readFileSync(f,'utf8'));return (j.revised?.plan??j.plan??j) as ArchitecturalPlan;};
describe('wing anchoring',()=>{
 it('places a wing against the bounding rectangle of another wing and compiles through the unchanged canonical compiler',()=>{
  const p=twoWingHouse(),{rects,problems}=resolveRects(p);
  expect(problems).toEqual([]);
  expect(rects.get('corridor')).toMatchObject({x:14,z:0,width:3,depth:12});      // east of entry-wing's 14×6 envelope, south-aligned
  expect(decisions(p)).toEqual([]);
  const r=compileArchitecturalPlan(p);
  expect(physicalEvidence(r).failures).toEqual([]);
  expect(r.access.reachable).toEqual(expect.arrayContaining(['foyer','living','corridor','bed-one','bed-two']));
  expect(r.scene.elements.some(e=>e.id==='sleep-lawn')).toBe(true);               // site item anchored to a wing
  expect(diagnosePlan(p).findings.filter(f=>f.severity==='error')).toEqual([]);
  expect(compileArchitecturalPlan(p).scene).toEqual(r.scene);                      // deterministic
 });
 it('follows the wing when its size changes: the neighbour needs no recalculation',()=>{
  const p=twoWingHouse();p.spaces.find(s=>s.id==='living')!.width=13;
  expect(resolveRects(p).rects.get('corridor')).toMatchObject({x:18});
  expect(diagnosePlan(p).findings.filter(f=>f.stage==='volumes')).toEqual([]);
 });
 it('refuses uses it cannot honour and says why, without guessing',()=>{
  const own=twoWingHouse();own.spaces.find(s=>s.id==='bed-two')!.placement.relativeTo='sleep-wing';
  expect(decisions(own).join(' ')).toMatch(/bed-two: cannot be placed relative to its own wing sleep-wing/);
  const same=twoWingHouse();Object.assign(same.spaces.find(s=>s.id==='bed-two')!.placement,{relativeTo:'entry-wing',side:'same'});
  expect(decisions(same).join(' ')).toMatch(/stacked placement \("same"\) needs a space, not the wing entry-wing/);
  const unknown=twoWingHouse();unknown.spaces.find(s=>s.id==='bed-two')!.placement.relativeTo='no-such-wing';
  expect(decisions(unknown).join(' ')).toMatch(/bed-two: placement anchor no-such-wing is missing, cyclic or itself unresolved/);
  const mutual=twoWingHouse();mutual.spaces.find(s=>s.id==='foyer')!.placement={relativeTo:'sleep-wing',side:'west',alignment:'start',gap:0};
  expect(decisions(mutual).length).toBeGreaterThan(0);
  expect(diagnosePlan(mutual).findings.some(f=>f.stage==='resolution')).toBe(true);
 });
 it('leaves every plan that names only spaces exactly as before',()=>{
  for(const f of ['docs/architecture/canonical-roof-retrieval-2026-11-02/proposal.normalized.json','docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json']){
   const plan=retained(f),a=resolveRects(plan);
   expect(a.problems.length+plan.spaces.filter(s=>!a.rects.has(s.id)).length).toBe(0);
  }
 });
});
describe('why separate chains collide, and that wing anchoring removes the class',()=>{
 it('the retained spine-and-halls parti reproduces the corner-overhang collision from sizes alone',()=>{
  const {roomAnchored,wingAnchored}=spineParti({gallery:[8,10],salon:[16,10],hall:[4,20],suite:[10,6]});
  const cs=plain(roomAnchored);
  expect(cs.map(c=>`${c.a}/${c.b}`)).toContain('salon/east-hall');
  const d=explainCollisions(roomAnchored).find(x=>x.pair.join('/')==='salon/east-hall')!;
  expect(d.cause).toBe('adjacent-overhang');expect(d.host).toBe('gallery');
  expect(d.explanation).toMatch(/both anchored to gallery on adjacent sides/);
  expect(d.judgement).toMatch(/architectural decision/);
  expect(plain(wingAnchored)).toEqual([]);
 });
 it('options are verified offers: each clears the pair alone, reports side effects, and nothing is applied',()=>{
  const {roomAnchored}=spineParti({gallery:[8,10],salon:[16,10],hall:[4,20],suite:[10,6]}),before=JSON.stringify(roomAnchored);
  const d=explainCollisions(roomAnchored).find(x=>x.pair.join('/')==='salon/east-hall')!;
  expect(d.options.length).toBeGreaterThan(0);
  for(const o of d.options){
   const copy=structuredClone(roomAnchored);(copy.spaces.find(s=>s.id===o.space)!.placement as Record<string,unknown>)[o.field]=o.to;
   const after=plain(copy).map(c=>`${c.a}/${c.b}`);
   expect(after).not.toContain('salon/east-hall');
   expect(after.filter(k=>!plain(roomAnchored).some(c=>`${c.a}/${c.b}`===k))).toEqual(o.newCollisions);
  }
  expect(d.options.some(o=>o.field==='relativeTo'&&o.to==='social')).toBe(true);   // anchoring to the wing is offered, not imposed
  expect(JSON.stringify(roomAnchored)).toBe(before);
 });
 it('property: over 300 random size sets, wing anchoring never collides across wings; room anchoring does for a sizeable share',()=>{
  const rnd=lcg(20261102);let roomFail=0,wingFail=0;
  for(let i=0;i<300;i++){
   const pick=(a:number,b:number)=>Math.round((a+rnd()*(b-a))*2)/2;
   const sizes={gallery:[pick(6,12),pick(6,14)] as [number,number],salon:[pick(10,22),pick(8,14)] as [number,number],hall:[pick(3,5),pick(12,26)] as [number,number],suite:[pick(6,12),pick(4,7)] as [number,number]};
   const {roomAnchored,wingAnchored}=spineParti(sizes);
   if(plain(roomAnchored).length)roomFail++;
   if(plain(wingAnchored).some(c=>wingAnchored.spaces.find(s=>s.id===c.a)!.mass!==wingAnchored.spaces.find(s=>s.id===c.b)!.mass))wingFail++;
  }
  expect(wingFail).toBe(0);expect(roomFail).toBeGreaterThan(60);
 });
 it('every collision in the retained plans is classified; findings now carry the cause and verified options',()=>{
  const plan=retained('docs/architecture/canonical-plan-revision-2026-11-02/revision-record.json');
  const found=diagnosePlan(plan).findings.filter(f=>f.stage==='volumes'),ds=explainCollisions(plan);
  expect(ds.length).toBe(found.length);expect(ds.length).toBeGreaterThan(0);
  for(const f of found)expect(f.message).toMatch(/Cause: /);
  for(const d of ds){expect(['adjacent-overhang','same-side-siblings','branch-crossing']).toContain(d.cause);expect(d.judgement.length).toBeGreaterThan(0);}
 });
 it('the same class recurs between wings anchored on adjacent sides of one wing, and is explained the same way',()=>{
  const p=conceptFixtures['pinwheel']();
  const arm=(id:string)=>p.spaces.find(s=>s.id===`${id}-envelope`)!;
  arm('sleep-arm').width=14;arm('sleep-arm').placement.alignment='start';arm('living-arm').depth=30;   // each projects past the core's corner
  const d=explainCollisions(p).find(x=>x.pair.includes('living-arm-envelope')&&x.pair.includes('sleep-arm-envelope'));
  expect(d).toBeDefined();expect(d!.cause).toBe('adjacent-overhang');expect(d!.host).toBe('core');
  expect(d!.judgement).toMatch(/architectural decision/);
 });
 it('in every retained proposal that fails to compile, each collision lies between two different wings',()=>{
  let total=0;
  for(const f of ['docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json','docs/architecture/canonical-plan-revision-2026-11-02/revision-record.json']){
   const plan=retained(f);
   for(const c of plain(plan)){total++;expect(plan.spaces.find(s=>s.id===c.a)!.mass,`${c.a}/${c.b}`).not.toBe(plan.spaces.find(s=>s.id===c.b)!.mass);}
  }
  expect(total).toBeGreaterThan(0);
 });
 it('dependants reports what moves with a room',()=>{
  const {roomAnchored}=spineParti({gallery:[8,10],salon:[16,10],hall:[4,20],suite:[10,6]});
  expect(displacedBy(roomAnchored,'east-hall').sort()).toEqual(['east-suite-centre','east-suite-end','east-suite-start']);
  expect(displacedBy(roomAnchored,'gallery')).toEqual(expect.arrayContaining(['salon','east-hall','east-suite-end']));
 });
});
describe('concept diagrams and composition measurement on different arrangements',()=>{
 it.each(Object.keys(conceptFixtures))('%s: wings are collision-free, measurable and drawn without rooms',name=>{
  const p=conceptFixtures[name]();
  expect(plain(p)).toEqual([]);
  const c=compositionOf(p);expect(c.wings.length).toBe(p.masses.length);
  const svg=renderConceptSvg(p);
  expect(svg).toContain('CONCEPT DIAGRAM');
  for(const m of p.masses)expect(svg).toContain(`>${m.id}<`);
  expect(svg).not.toMatch(/stair|door/i);
 });
 it('the arrangements measurably differ (this is a measurement of composition, not of quality)',()=>{
  const m=Object.fromEntries(['linear-bar','courtyard-u','pinwheel'].map(n=>[n,compositionOf(conceptFixtures[n]())]));
  expect(m.pinwheel.mirrorShare).toBeLessThan(.6);
  expect(new Set(Object.values(m).map(c=>c.footprintFill)).size).toBe(3);
  expect(m['linear-bar'].wings[0].bounds.width).toBeGreaterThan(40);
 });
 it('detects mirror symmetry and repeated cells in the retained parti',()=>{
  const c=compositionOf(spineParti({gallery:[8,10],salon:[16,10],hall:[4,20],suite:[10,6]}).wingAnchored);
  expect(c.mirrorAxis).toBe('x');expect(c.mirrorShare).toBeGreaterThan(.9);
  expect(c.repeated).toMatchObject({count:6,width:10,depth:6});
  expect(c.bilateral.length).toBeGreaterThan(0);
 });
 it('conceptDrift reports how an elaboration departs from its concept, without altering either',()=>{
  const concept=conceptFixtures['linear-bar'](),before=JSON.stringify(concept);
  expect(conceptDrift(concept,concept).wings.every(w=>w.within)).toBe(true);
  const grown=structuredClone(concept);grown.spaces.find(s=>s.id==='pavilion-envelope')!.depth+=3;
  const drift=conceptDrift(concept,grown);
  expect(drift.wings.find(w=>w.wing==='pavilion')).toMatchObject({dSize:[0,3],within:false});
  expect(drift.missing).toEqual([]);expect(JSON.stringify(concept)).toBe(before);
 });
});
