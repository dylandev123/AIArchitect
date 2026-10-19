import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import original from './fixtures/canopy-meridian-attempt-0.json';
import repaired from './fixtures/canopy-meridian-attempt-1.json';
import { ingestV3GenerationOutput } from '../ingestion';
import { normalizeV3GenerationOutput, type V3GenerationNote } from '../generation';
import { canonicalizeV3ProviderIntent } from '../intentCanonicalization';
import { compileV3Scene, validateV3CompiledGeometry } from '../scene';
import { reviewV3Architecture } from '../designReview';
import { assessV3ObjectiveRevision } from '../safeRevision';
import { resolveV3Circulation } from '../circulation';
import { validateV3Scene } from '../validation';
import { auditV3EstatePlan } from '../estatePlan';

export function replayMansion(raw: unknown) {
 const canonicalNotes:V3GenerationNote[]=[];
 const canonical=canonicalizeV3ProviderIntent(structuredClone(raw),canonicalNotes);
 const normalized=normalizeV3GenerationOutput(structuredClone(raw),'flat');
 const result=ingestV3GenerationOutput(structuredClone(raw),'flat');
 const compiled=compileV3Scene(result.scene);
 return {canonical,canonicalNotes,normalized,result,geometry:validateV3CompiledGeometry(result.scene,compiled,{lenient:true}),review:reviewV3Architecture(result.scene),circulation:resolveV3Circulation(result.scene),inventory:result.scene.objects.map(o=>({id:o.id,type:o.type,parts:compiled.primitives.filter(p=>p.sourceObjectId===o.id).map(p=>({id:p.id,label:p.label,...(p.kind==='box'?{position:p.position,size:p.size}:{bounds:{min:[0,1,2].map(axis=>Math.min(...p.vertices.filter((_,i)=>i%3===axis))),max:[0,1,2].map(axis=>Math.max(...p.vertices.filter((_,i)=>i%3===axis)))}})}))}))};
}
describe('recovered Canopy Meridian live generation',()=>{
 it('replays both complete provider responses without a provider',()=>{
  const a=replayMansion(original),b=replayMansion(repaired);
  const assessment=assessV3ObjectiveRevision(a.result.scene,b.result.scene,a.result.validation.issues);
  if(process.env.MANSION_AUDIT_OUTPUT)writeFileSync(process.env.MANSION_AUDIT_OUTPUT,JSON.stringify({attempts:[a,b],assessment},null,2));
  expect(a.result.scene.objects).toHaveLength(19);
  expect(b.result.scene.objects).toHaveLength(19);
  expect(a.result.validation.issues.filter(i=>i.severity==='fatal').length).toBeGreaterThan(1);
 });
 it.each([original,repaired])('preserves authored identifiers and usable circulation, and bounds only derived canopy padding',raw=>{
  const snapshot=JSON.stringify(raw),result=ingestV3GenerationOutput(raw,'flat');
  expect(JSON.stringify(raw)).toBe(snapshot);
  expect(result.notes.some(n=>n.code==='CIRCULATION_OMITTED')).toBe(false);
  const stair=resolveV3Circulation(result.scene).find(c=>c.entry.id==='mainStair');
  expect(stair).toMatchObject({usable:true,entry:{footprint:{x:-15,z:0,width:2.5,depth:4.2}}});
  const main=result.scene.objects.find(o=>o.id==='mainResidence')!;
  expect(main.composition?.openings).toEqual(raw.objects.find(o=>o.id==='mainResidence')!.composition!.openings);
  const compiled=compileV3Scene(result.scene);
  const canopy=compiled.primitives.find(p=>p.id==='mainResidence-assembly-entry-mainEntryDoor-canopy');
  expect(canopy?.kind).toBe('box');
  if(canopy?.kind==='box')expect(canopy.size[0]).toBeCloseTo(8);
  expect(compiled.primitives.some(p=>p.id.startsWith('mainStair:tread-'))).toBe(true);
 });
 it('reports estate failures alongside every independent footprint failure',()=>{
  const result=ingestV3GenerationOutput(original,'flat');
  expect(result.validation.issues.map(i=>i.code)).toEqual(expect.arrayContaining(['FOOTPRINT_FACADE_AMBIGUOUS','ESTATE_FORM_UNBUILT','ESTATE_ACCESS_DISCONNECTED']));
  const audit=validateV3CompiledGeometry(result.scene,compileV3Scene(result.scene),{lenient:true});
  expect(audit.ok).toBe(false);
  expect(audit.errors).toHaveLength(3);
 });
 it('constructs repaired geometry without concealing remaining authored access blockers',()=>{
  const replay=replayMansion(repaired);
  expect(replay.geometry).toMatchObject({ok:true,errors:[]});
  expect(replay.result.ok).toBe(false);
  expect(replay.result.validation.errors).toEqual(['arch-water-garden: declared connected composition lacks touching authored objects.']);
  expect(replay.review.diagnostics.some(d=>d.code==='NO_OUTDOOR_LIVING_ACCESS'&&d.targetIds.includes('meditationCourt'))).toBe(true);
  for(const id of ['mainRoof','guestRoof','wellnessRoof'])expect(replay.inventory.find(o=>o.id===id)!.parts.some(p=>/roof/i.test(p.label))).toBe(true);
  expect(replay.result.notes.filter(n=>n.code.endsWith('_OMITTED'))).toEqual([]);
  const withoutFixes=structuredClone(replay.result.scene);
  delete withoutFixes.objects.find(o=>o.id==='mainResidence')!.composition!.mainEntry;
  withoutFixes.interior!.circulation=[];
  const unrelated=(parts:ReturnType<typeof compileV3Scene>['primitives'])=>parts.filter(p=>p.sourceObjectId!=='mainResidence');
  expect(unrelated(compileV3Scene(replay.result.scene).primitives)).toEqual(unrelated(compileV3Scene(withoutFixes).primitives));
 });
 it('does not demand self-edges or building dimensions on grouped roofs and terraces',()=>{
  const scene=ingestV3GenerationOutput(repaired,'flat').scene;
  const issues=auditV3EstatePlan(scene);
  expect(issues.filter(d=>d.code==='ESTATE_ACCESS_MISSING')).toEqual([]);
  expect(issues.filter(d=>d.code==='ESTATE_REQUIREMENT_CONFLICT')).toEqual([]);
  expect(issues.filter(d=>d.code==='ESTATE_ACCESS_DISCONNECTED')).toHaveLength(5);
  scene.estatePlan!.program[0].objectIds=['mainRoof'];
  expect(auditV3EstatePlan(scene).some(d=>d.code==='ESTATE_REQUIREMENT_CONFLICT')).toBe(true);
 });
 it('permits only diagnosed assembly attachment repairs and rejects lost or undiagnosed architectural change',()=>{
  // The authored balcony now constructs. A deliberately unresolved attachment is
  // the only way to exercise the diagnosed-repair path against this fixture.
  const fixed=ingestV3GenerationOutput(original,'flat').scene;
  const broken=structuredClone(fixed);
  const anchor=broken.objects.find(o=>o.id==='mainResidence')!.composition!.assemblies![0].parts[0];
  if(anchor.type==='slab')anchor.start=.4;
  const issues=validateV3Scene(broken,{lenient:true}).issues;
  expect(issues.some(i=>i.code==='FOOTPRINT_ASSEMBLY_UNRESOLVED')).toBe(true);
  expect(assessV3ObjectiveRevision(broken,fixed,issues).accepted).toBe(true);
  // Without a diagnostic for that part the same attachment change is unrelated.
  const a=ingestV3GenerationOutput(original,'flat');
  const undiagnosed=structuredClone(a.scene);
  const slab=undiagnosed.objects.find(o=>o.id==='mainResidence')!.composition!.assemblies![0].parts[0];
  if(slab.type==='slab'){slab.start=.4;slab.end=.6;}
  expect(assessV3ObjectiveRevision(a.scene,undiagnosed,a.validation.issues).accepted).toBe(false);
  const lost=structuredClone(fixed);
  lost.objects.find(o=>o.id==='mainResidence')!.composition!.assemblies!.splice(0,1);
  expect(assessV3ObjectiveRevision(broken,lost,issues).accepted).toBe(false);
  expect(assessV3ObjectiveRevision(a.scene,ingestV3GenerationOutput(repaired,'flat').scene,a.validation.issues).accepted).toBe(false);
 });
 it('retains actionable structural errors rather than inventing numeric requirement bounds',()=>{
  const raw=structuredClone(original);
  raw.estatePlan.requirements[0].range={value:'USD 15000000',min:2} as typeof raw.estatePlan.requirements[0]['range'];
  const normalized=normalizeV3GenerationOutput(raw,'flat');
  expect(validateV3Scene(normalized.scene,{lenient:true}).errors.some(e=>e.includes('estatePlan.requirements.0.range.max'))).toBe(true);
 });

});
