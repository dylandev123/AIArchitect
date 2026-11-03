/** Whole-house design strategies, end to end and offline: retrieval -> provider-facing text -> canonical composition -> compiled,
 * editable geometry -> measured fidelity. Fixtures are developer-authored and show what the contract can carry; none is Terra
 * output or evidence that a model designs well. No model call, database or network is used. */
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {compileArchitecturalPlan,type ArchitecturalPlan} from './plan';
import {strategyFixture,type StrategyFixture} from './strategies.fixture';
import {conceptFidelity,CENTRAL_OFFSET} from './fidelity';
import {WHOLE_HOUSE_STRATEGIES,STRATEGY_FIXTURES} from '@/lib/library/architecture/strategies';
import {knowledgeInputSchema} from '@/lib/library/architecture/model';
import {latestKnowledge} from '@/lib/library/architecture/service';
import {legacyRecipeKnowledge} from '@/lib/library/architecture/legacyRecipes';
import {retrieveArchitecturalKnowledge} from '@/lib/library/architecture/retrieval';
import {canonicalKnowledgeChunk,isWholeHouseStrategy,unbuildableRoofForm} from '@/lib/library/architecture/canonicalKnowledge';
import {physicalEvidence} from '../experimental/semantic-building/physical';
import {applySceneOperations,validateScene} from '../scene/model';
const snapshot=JSON.parse(readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
const library=[...latestKnowledge(snapshot.architecturalKnowledge),...legacyRecipeKnowledge(snapshot.recipes)];
const RETIRED=/scene[- ]operations?|supported operations?|place-on|component-registry|scene\/terra|direct-scene|exterior scope/i;
const clone=(n:StrategyFixture)=>structuredClone(strategyFixture(n));
const retrieve=(brief:string)=>retrieveArchitecturalKnowledge(library,brief,'generate',{canonical:true});
const BRIEFS:Record<string,{brief:string;strategy:string;fixture:StrategyFixture}>={
 waterfront:{strategy:'strategy-waterfront-central-pavilion',fixture:'waterfront-pavilion',brief:'Design a contemporary Caribbean waterfront estate with six bedroom suites, a memorable entrance, shaded terraces facing the ocean and a rectangular pool. US$25 million.'},
 tropical:{strategy:'strategy-tropical-pavilion-court',fixture:'tropical-pavilion-court',brief:'Design a modern tropical pavilion villa in Barbados with four bedrooms, a shaded outdoor living court and a pool, with deep eaves and breezes.'},
 courtyard:{strategy:'strategy-courtyard-residence',fixture:'courtyard-residence',brief:'Design a private courtyard house on a narrow urban lot in Lisbon with three bedrooms, an inner court and strong privacy from the street.'},
 hillside:{strategy:'strategy-hillside-stepped-levels',fixture:'stepped-multilevel',brief:'Design a dramatic multilevel hillside home overlooking the sea with four bedrooms, view terraces and a pool.'},
 compact:{strategy:'strategy-compact-two-volume',fixture:'compact-two-volume',brief:'Design a compact but architecturally sophisticated family home with three bedrooms on a small lot, modest budget.'},
};
describe('strategy records',()=>{
 it('are valid approved knowledge, developer-authored by their own provenance, and each names the fixture that proves its expression',()=>{
  expect(WHOLE_HOUSE_STRATEGIES).toHaveLength(5);
  expect(new Set(WHOLE_HOUSE_STRATEGIES.map(e=>e.id)).size).toBe(5);
  for(const e of WHOLE_HOUSE_STRATEGIES){
   const {version,updatedAt,...input}=e;void version;void updatedAt;
   expect(knowledgeInputSchema.safeParse(input).success,e.id).toBe(true);
   expect(e.status).toBe('approved');expect(isWholeHouseStrategy(e)).toBe(true);
   expect(e.sources.every(s=>/DEVELOPER-AUTHORED/.test(s.note)),e.id).toBe(true);
   expect(e.construction!.supports.length).toBeGreaterThan(200);expect(e.construction!.unsupported.length).toBeGreaterThan(80);
   expect(STRATEGY_FIXTURES[e.id]).toBeTruthy();
  }
 });
 it('carry the ten parts of a strategy: when, concept and hierarchy, organisation, roof/facade/material, expression and limits',()=>{
  const chunk=JSON.parse(canonicalKnowledgeChunk(WHOLE_HOUSE_STRATEGIES[0],'composition').line);
  expect(Object.keys(chunk).sort()).toEqual(['category','combinations','expression','id','limits','placement','principles','title','version','when']);
  expect(chunk.principles).toMatch(/Concept:/);expect(chunk.principles).toMatch(/Hierarchy|hierarchy/);
  expect(chunk.expression).toMatch(/composition\.volumes/);expect(chunk.limits).toMatch(/Not expressible/);
  for(const e of WHOLE_HOUSE_STRATEGIES)expect(canonicalKnowledgeChunk(e,'composition').line.match(RETIRED),e.id).toBeNull();
 });
 it('ordinary records still send only the design fields',()=>{
  const ordinary=library.find(e=>e.id==='composition-hierarchy')!;
  expect(Object.keys(JSON.parse(canonicalKnowledgeChunk(ordinary,'composition').line)).sort()).toEqual(['category','combinations','id','placement','principles','title','version','when']);
 });
 it('every expression quotes only fields that the contract has',()=>{
  const fields=['composition.volumes','roofSpan','facades','entrance','heightStep','constraints'];
  for(const e of WHOLE_HOUSE_STRATEGIES)expect(fields.some(f=>e.construction!.supports.includes(f)),e.id).toBe(true);
 });
});
describe('retrieval of a whole-house strategy',()=>{
 it.each(Object.entries(BRIEFS))('%s brief receives its own strategy, once, within budget',(_,c)=>{
  const r=retrieve(c.brief),ids=r.selected.map(s=>s.id);
  expect(ids.filter(id=>id.startsWith('strategy-'))).toEqual([c.strategy]);
  expect(r.chars).toBeLessThanOrEqual(r.budget.chars);expect(r.selected.length).toBeLessThanOrEqual(r.budget.entries);
  expect(r.text).toContain(`"id":"${c.strategy}"`);expect(r.text.match(RETIRED)).toBeNull();
 });
 it('selects no strategy when the brief does not call for one (a style, or no brief detail)',()=>{
  for(const brief of ['Design a contemporary luxury villa with five bedrooms, a pool and refined materials.','Design a house.'])
   expect(retrieve(brief).selected.some(s=>isWholeHouseStrategy(s)),brief).toBe(false);
 });
 it('never offers a strategy to the retired operations-author path',()=>{
  for(const c of Object.values(BRIEFS))expect(retrieveArchitecturalKnowledge(library,c.brief,'generate').selected.some(s=>isWholeHouseStrategy(s))).toBe(false);
 });
 it('respects scale: the estate strategy is not offered to a compact brief',()=>{
  expect(retrieve('Design a compact waterfront cottage with two bedrooms.').selected.some(s=>s.id==='strategy-waterfront-central-pavilion')).toBe(false);
 });
 it('drops recipes that rest on roof forms the contract cannot build, only for canonical Generate',()=>{
  const unbuildable=library.filter(unbuildableRoofForm).map(e=>e.title);
  expect(unbuildable).toEqual(expect.arrayContaining(['Modern Tropical Lantern Roof 01','Modern Tropical Ventilated Mono-Pitch Roof 01']));
  const ids=retrieve(BRIEFS.tropical.brief+' with a lantern roof').metrics.excluded;
  expect(ids.some(e=>e.reason==='roof form outside flat/gable/hip')).toBe(true);
  expect(retrieveArchitecturalKnowledge(library,BRIEFS.tropical.brief,'generate').metrics.excluded.some(e=>e.reason==='roof form outside flat/gable/hip')).toBe(false);
 });
});
describe('each strategy is carried by the canonical composition into editable geometry (developer fixtures)',()=>{
 const names:StrategyFixture[]=['waterfront-pavilion','tropical-pavilion-court','courtyard-residence','stepped-multilevel','compact-two-volume'];
 it.each(names)('%s: compiles deterministically, passes physical evidence and keeps the declaration',name=>{
  const p=clone(name),r=compileArchitecturalPlan(p);
  expect(compileArchitecturalPlan(p).scene).toEqual(r.scene);
  expect(r.scene.architecturalPlan).toEqual(p);
  expect(physicalEvidence(r).failures).toEqual([]);
  expect(r.access.reachable).toEqual(expect.arrayContaining(p.spaces.filter(s=>!s.outdoor).map(s=>s.id)));
  expect(r.composition!.entrance).toMatchObject({roofed:true});
 });
 it.each(names)('%s: the height hierarchy is built, one roof element stands over each declared span, bays exist',name=>{
  const p=clone(name),r=compileArchitecturalPlan(p),rank:Record<string,number>={primary:3,secondary:2,subordinate:1};
  const built=r.composition!.volumes.filter(v=>v.top>0).sort((a,b)=>b.top-a.top);
  expect(built.map(v=>rank[v.tier])).toEqual([...built.map(v=>rank[v.tier])].sort((a,b)=>b-a));
  expect(built[0].tier).toBe('primary');
  for(const span of p.composition!.roofSpans)expect(r.scene.elements.filter(e=>e.id===span.id&&e.kind==='roof')).toHaveLength(1);
  expect(r.scene.elements.filter(e=>e.kind==='roof').length).toBeLessThan(p.spaces.filter(s=>!s.outdoor).length);
  for(const f of p.composition!.facades)expect(r.composition!.facades.find(x=>x.id===f.id)!.openings).toHaveLength(f.bays);
 });
 it.each(names)('%s: components stay individually editable (resize a roof, then the scene still validates)',name=>{
  const p=clone(name),r=compileArchitecturalPlan(p),span=p.composition!.roofSpans[0],roof=r.scene.elements.find(e=>e.id===span.id)!;
  const edited=applySceneOperations(r.scene,[{op:'resize',id:span.id,size:[roof.size[0]+1,roof.size[1],roof.size[2]]}]);
  expect(edited.elements.find(e=>e.id===span.id)!.size[0]).toBeCloseTo(roof.size[0]+1);
  expect(validateScene(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
  expect(edited.elements).toHaveLength(r.scene.elements.length);
 });
 it('the strategy claim that fails is rejected, not built: hierarchy by label, an open court, a tier inversion',()=>{
  // the wings are 2.4 m lower; a declared step of 3 m is therefore a hierarchy the built house does not have
  const flat=clone('waterfront-pavilion');flat.composition!.heightStep=3;
  expect(()=>compileArchitecturalPlan(flat)).toThrow('hierarchy needs at least');
  const open=clone('courtyard-residence');open.spaces.find(s=>s.id==='east-bed-a')!.placement.gap=4;
  expect(()=>compileArchitecturalPlan(open)).toThrow();
  const sameHeight=clone('compact-two-volume');for(const s of sameHeight.spaces.filter(q=>q.mass==='night'))s.height=4;
  expect(()=>compileArchitecturalPlan(sameHeight)).toThrow('hierarchy needs at least');
 });
});
describe('concept-to-construction fidelity (measured, not scored)',()=>{
 const waterfront=()=>{const p=clone('waterfront-pavilion');return {p,r:compileArchitecturalPlan(p)};};
 it('the example concept — dominant central pavilion, two subordinate wings, dramatic entrance, deep shade — is evidenced in the built house',()=>{
  const {p,r}=waterfront(),f=conceptFidelity(p,r),v=Object.fromEntries(f.volumes.map(x=>[x.id,x]));
  // hierarchy: primary is tallest by the declared step, largest, central; wings are lower, smaller, off-centre, one roof each
  expect(v['living-pavilion'].top-v['west-range'].top).toBeGreaterThanOrEqual(p.composition!.heightStep!);
  expect(v['living-pavilion'].interiorAreaM2).toBeGreaterThan(v['west-range'].interiorAreaM2);
  expect(v['living-pavilion'].areaShare).toBeGreaterThan(.4);
  expect(v['living-pavilion'].centreOffset).toBeLessThanOrEqual(CENTRAL_OFFSET);
  expect(v['west-range'].tier).toBe('subordinate');expect(v['east-range'].tier).toBe('subordinate');
  expect(v['west-range'].roofElements).toBe(1);expect(v['east-range'].roofElements).toBe(1);
  // roofs express the organisation: a hip over the pavilion with a deep overhang, gables over the wings
  expect(v['living-pavilion'].roofForms).toContain('hip');expect(v['living-pavilion'].maxOverhang).toBeGreaterThanOrEqual(1);
  expect(v['west-range'].roofForms).toEqual(['gable']);
  // the entrance is developed: tall door in a double-height room, under a roofed porch belonging to the primary volume
  expect(f.entrance).toMatchObject({porchRoofed:true,volume:'living-pavilion',volumeTier:'primary',doorHeightM:3.8,hostRoomHeightM:6});
  // facade decisions: composed bays on the water elevation; every volume opens to the outside
  expect(v['living-pavilion'].exteriorOpenings.fromComposedBays).toBeGreaterThanOrEqual(5);
  expect(f.volumes.every(x=>x.exteriorOpenings.windows+x.exteriorOpenings.doors>0)).toBe(true);
  expect(f.claims.map(c=>c.claim).sort()).toEqual(['central','entrance','shade']);
  expect(f.claims.every(c=>c.supported),JSON.stringify(f.claims)).toBe(true);
  expect(f.observations).toEqual([]);
  expect(f.notMeasurable.length).toBeGreaterThan(3);
 });
 it('reports the same concept as unverifiable prose when no composition is declared',()=>{
  const {p}=waterfront();
  // identical rooms and thesis, but the building-scale decisions are not stated: give every room its own roof as a room-by-room plan would
  delete p.composition;
  for(const s of p.spaces.filter(q=>!q.outdoor))p.roofs.push({space:s.id,form:'flat',rise:.2});
  const r=compileArchitecturalPlan(p),f=conceptFidelity(p,r);
  expect(f.declared).toBe(false);expect(f.volumes).toEqual([]);expect(f.entrance).toBeNull();
  expect(f.observations[0]).toMatch(/No composition is declared/);
  // the thesis still claims a dramatic entrance and deep shade; the entrance claim now has nothing behind it
  expect(f.claims.find(c=>c.claim==='entrance')).toMatchObject({supported:false});
  expect(r.scene.elements.filter(e=>e.kind==='roof').length).toBeGreaterThan(waterfront().r.scene.elements.filter(e=>e.kind==='roof').length);
 });
 it('flags claims the built house does not support, in measurements rather than a score',()=>{
  const p=clone('courtyard-residence');
  p.thesis='A central living pavilion with a dramatic entrance and a courtyard.';
  const f=conceptFidelity(p,compileArchitecturalPlan(p));
  const central=f.claims.find(c=>c.claim==='central')!;
  expect(central.supported).toBe(false);expect(central.measured).toMatch(/0\.39/);
  expect(f.claims.find(c=>c.claim==='court')).toMatchObject({supported:true});
  // the dramatic-entrance claim IS backed by a declared roofed porch; it is judged only for being declared and roofed
  expect(f.claims.find(c=>c.claim==='entrance')).toMatchObject({supported:true});
  expect(f.observations.some(o=>/central/.test(o))).toBe(true);
  expect(f.observations.every(o=>typeof o==='string')).toBe(true);
 });
 it('notes when primary dominance rests on height alone, and never alters the plan',()=>{
  const p=clone('tropical-pavilion-court'),before=JSON.stringify(p),f=conceptFidelity(p,compileArchitecturalPlan(p));
  expect(f.observations.join(' ')).toMatch(/dominance rests on height alone/);
  expect(JSON.stringify(p)).toBe(before);
 });
 it('every fixture is measured without a hard failure',()=>{
  for(const n of ['waterfront-pavilion','tropical-pavilion-court','courtyard-residence','stepped-multilevel','compact-two-volume'] as StrategyFixture[]){
   const p:ArchitecturalPlan=clone(n),f=conceptFidelity(p,compileArchitecturalPlan(p));
   expect(f.declared).toBe(true);expect(f.volumes.length).toBe(p.composition!.volumes.length);expect(f.entrance?.porchRoofed).toBe(true);
  }
 });
});
