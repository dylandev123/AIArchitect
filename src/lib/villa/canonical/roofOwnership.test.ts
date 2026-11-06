import {describe,expect,it} from 'vitest';
import {compileArchitecturalPlan,architecturalPlanSchema,type ArchitecturalPlan} from './plan';
import {compositionFirstFixture,type CompositionFixture} from './compositionFirst.fixture';
import {expandComposition,expandCompositionLenient,roofDeclarationRelation} from './composition';
import type {Rect} from './layout';
import {diagnosePlan} from './diagnose';
import {DesignConflict} from '../experimental/semantic-building/compiler';
const clone=(n:CompositionFixture)=>structuredClone(compositionFirstFixture(n));
const rects=(p:ArchitecturalPlan)=>new Map(Object.entries(diagnosePlan(p).rects as Record<string,Rect>));
const resolution=(p:ArchitecturalPlan)=>diagnosePlan(p).findings.filter(f=>f.severity==='error'&&f.id==='composition').map(f=>f.message);
const rejectedBy=(p:ArchitecturalPlan)=>{try{compileArchitecturalPlan(p);return [] as string[];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};

describe('roof ownership: a space has exactly one roof, and the rejection says which design conflicts',()=>{
 it('a roofs entry identical to the span that lists it is identified as a redundant duplicate',()=>{
  const p=clone('pavilion-court');const s=p.composition!.roofSpans[0];
  p.roofs.push({space:'living',form:s.form,rise:s.rise,overhang:s.overhang,material:s.material});
  const msgs=resolution(p);
  expect(msgs).toHaveLength(1);expect(msgs[0]).toMatch(/redundant duplicate.*Delete the roofs entry for living/);
  expect(rejectedBy(p)).toEqual(msgs);
 });
 it('a different roof on a listed space is a conflict that names what differs and both ways to resolve it',()=>{
  const p=clone('pavilion-court');p.roofs.push({space:'living',form:'flat',overhang:.4});
  const [m]=resolution(p);
  expect(m).toMatch(/its own different roof/);expect(m).toMatch(/differs in form, rise, overhang, material/);
  expect(m).toMatch(/delete its roofs entry, or remove living from the span/);
  expect(rejectedBy(p)).toEqual([m]);
 });
 it('every independent problem of one span is reported together, not one per attempt',()=>{
  const p=clone('pavilion-court');
  p.composition!.roofSpans[0].spaces=['living','dining','porch'];p.roofs.push({space:'porch',form:'flat',rise:.3});
  const joined=resolution(p).join('\n');
  expect(joined).toMatch(/porch is listed in this span/);
  expect(joined).toMatch(/do not tile one rectangle|one level/);
 });
 it('the lenient form agrees with the strict form on problems and keeps the spans that are valid',()=>{
  const p=clone('pavilion-court');p.roofs.push({space:'living',form:'flat'});
  const lenient=expandCompositionLenient(p,p.composition,rects(p));
  expect(lenient.invalid.map(i=>i.id)).toEqual(['pavilion-roof']);
  expect(lenient.spans.map(s=>s.id)).toEqual(['bar-roof']);
  expect(()=>expandComposition(p,p.composition,rects(p))).toThrow(lenient.problems[0]);
 });
 it('rooms of a span that failed validation are not reported as having no roof',()=>{
  const p=clone('pavilion-court');p.roofs.push({space:'living',form:'flat'});
  const ids=diagnosePlan(p).findings.filter(f=>f.severity==='error'&&f.stage==='roofs').map(f=>f.id);
  expect(ids).not.toContain('dining');
 });
 it('separate porch and deck roofs beside a span remain supported',()=>{
  const p=clone('pavilion-court');expect(p.roofs.map(r=>r.space)).toEqual(['porch','deck']);
  expect(()=>compileArchitecturalPlan(p)).not.toThrow();
 });
 it('relation: equal and unequal declarations',()=>{
  expect(roofDeclarationRelation({space:'a',form:'hip',rise:2},{form:'hip',rise:2,overhang:0})).toEqual({redundant:true,differs:[]});
  expect(roofDeclarationRelation({space:'a',form:'hip',rise:2,material:'timber'},{form:'hip',rise:2,material:'bronze'}).differs).toEqual(['material']);
 });
 it('a span may name a single room (built once); a volume claiming one roof must still have all its rooms under it',()=>{
  const p=clone('pavilion-court');
  p.composition!.roofSpans[0]={...p.composition!.roofSpans[0],spaces:['living'],overhang:0};
  p.composition!.roofSpans.push({id:'dining-roof',spaces:['dining'],form:'hip',rise:3.2,overhang:0,material:'bronze'});
  expect(architecturalPlanSchema.safeParse(p).success).toBe(true);
  const v=expandCompositionLenient(p,p.composition,rects(p));
  expect(v.problems).toEqual([]);expect(v.spans.find(s=>s.id==='pavilion-roof')!.members).toEqual(['living']);
  // Built end to end: one editable roof element per one-room span, nothing built twice.
  delete p.composition!.volumes[0].roof;
  const built=compileArchitecturalPlan(p);
  expect(built.scene.elements.filter(e=>e.kind==='roof'&&built.provenance[e.id].sources[0]==='living')).toHaveLength(1);
 });
});

describe('the diagnosis measures the same roof geometry the compiler constructs',()=>{
 it('an overhang that reaches an abutting roof is rejected by both, naming the same pair',()=>{
  const p=clone('pavilion-court');
  const abut=diagnosePlan(p).rects as Record<string,Rect>;
  const a=abut.porch,b=abut.deck;
  expect(a&&b).toBeTruthy();
  p.roofs.forEach(r=>{r.overhang=1.2;});
  const clash=diagnosePlan(p).findings.filter(f=>f.stage==='roofs'&&/intersect/.test(f.message)).map(f=>f.id);
  const compiler=rejectedBy(p).filter(m=>/intersecting roof bounds/.test(m)).map(m=>m.split(':')[0]);
  if(compiler.length||clash.length){expect(new Set(clash.map(c=>c.split('/').sort().join('/')))).toEqual(new Set(compiler.map(c=>c.split('/').sort().join('/'))));}
 });
});

describe('a volume\'s roof claim is checked from the declaration, with the built-house rule',()=>{
 it('a volume names its principal building-scale roof; its other rooms keep room-owned roofs without any finding',()=>{
  const p=clone('pavilion-court');p.composition!.roofSpans[0].spaces=['living'];p.composition!.roofSpans[0].overhang=0;p.roofs.push({space:'dining',form:'flat'});
  expect(diagnosePlan(p).findings.filter(f=>f.id==='living-pavilion')).toEqual([]);
  const built=compileArchitecturalPlan(p);
  expect(built.scene.elements.filter(e=>e.kind==='roof'&&['living','dining'].includes(built.provenance[e.id].sources[0])).map(e=>built.provenance[e.id].sources[0]).sort()).toEqual(['dining','living']);
 });
 it('a volume\'s principal roof may not cover another volume\'s rooms',()=>{
  const p=clone('pavilion-court');const other=p.spaces.find(s=>s.mass!==p.spaces.find(q=>q.id==='living')!.mass&&!s.outdoor&&s.level===p.spaces.find(q=>q.id==='living')!.level)!;
  expect(other).toBeTruthy();
  const m=diagnosePlan({...p,composition:{...p.composition!,roofSpans:p.composition!.roofSpans.map((s,i)=>i===0?{...s,spaces:[...s.spaces,other.id]}:s)}}).findings.filter(f=>f.severity==='error').map(f=>f.message).join(' ');
  expect(m).toMatch(/belong to other volumes|already belongs|rectangle|level/);
 });
});
