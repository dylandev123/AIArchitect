import {describe,it,expect} from 'vitest';
import {architecturalFreedomStudies} from './architectural-freedom-studies';
import {resolveArchitecturalLevels,validateFootprint,footprintBounds,footprintFacadeBays} from './footprint';
import {resolveVillaResult,villaProviderOutputSchema,compositionSystemPrompt} from './terra';
import {executeCompositionPatch,validateCompositionPreview,wingEnvelope} from './composition';
import {architectureCandidateDraft,previewArchitectureCandidate,validateArchitectureCandidate} from './creation/architecture-candidate';
import {stageReviewEdit} from './visual-review';
const studies=architecturalFreedomStudies();
describe('expressive architectural support graphs',()=>{
 it('makes each offline study available through generation and real targeted edits',()=>{
  for(const current of studies){
   const envelope={changes:current,summary:current.character,unsupported:[]};
   const request={mode:'generate' as const,prompt:current.character};
   expect(resolveVillaResult(request,villaProviderOutputSchema(request).parse(envelope)).config).toEqual(current);
   const before=structuredClone(current),form=current.forms?.[0];
   const changes=form?{forms:[{type:'put' as const,form:{...form,material:'sand' as const}}]}:{wings:[{type:'adjust' as const,id:current.wings[1].id,changes:{eave:1.5}}]};
   const editRequest={mode:'edit' as const,prompt:'Change this finish or eave only',current};
   const result=resolveVillaResult(editRequest,villaProviderOutputSchema(editRequest).parse({changes,summary:'Targeted change',unsupported:[]}));
   expect(result.config).not.toEqual(current);expect(current).toEqual(before);
   expect(result.config.pool).toEqual(current.pool);expect('version' in result.config&&result.config.terraces).toEqual(current.terraces);
  }
 });
 it('retains branching volumes, a fourth storey, differing materials and double-height arrival',()=>{
  const form=studies[0].forms![0],levels=resolveArchitecturalLevels(form);
  expect(form.points.length).toBe(7);expect(form.height).toBe(6.8);
  expect(levels.filter(l=>l.parentId==='base')).toHaveLength(2);
  expect(levels.at(-1)?.level).toBe(3);expect(new Set(levels.map(l=>l.material)).size).toBe(3);
  expect(footprintFacadeBays(form)).toBeLessThan(300);expect(footprintBounds(form).right).toBeGreaterThan(19);
 });
 it('rejects cyclic or missing parents, excessive storeys and intersecting siblings atomically',()=>{
  const current=studies[0],before=structuredClone(current),form=structuredClone(current.forms![0]);
  for(const mutate of [
   ()=>{form.levels![0].parentId='missing';},
   ()=>{form.levels![0].parentId='sky-room';},
   ()=>{form.levels!.push({...form.levels!.at(-1)!,id:'fifth',parentId:'sky-room'});},
   ()=>{form.levels![1].points=structuredClone(form.levels![0].points);},
  ]){
   Object.assign(form,structuredClone(before.forms![0]));mutate();
   expect(()=>executeCompositionPatch(current,{forms:[{type:'put',form}]})).toThrow();expect(current).toEqual(before);
  }
 });
 it('rejects unsupported floating or self-crossing outlines without substituting a box',()=>{
  const f=structuredClone(studies[2].forms![0]);f.levels![0].points=f.levels![0].points.map(q=>({...q,x:q.x+18}));
  expect(()=>validateFootprint(f)).toThrow(/projection|supported/);
  f.levels![0].points=[{x:-10,z:-5},{x:10,z:5},{x:10,z:-5},{x:-10,z:5}];
  expect(()=>validateFootprint(f)).toThrow(/crossing|touching/);
 });
 it('rejects ambiguous old/new grammar combinations and invalid facade edges',()=>{
  const f=structuredClone(studies[0].forms![0]);f.stack=[];expect(()=>validateFootprint(f)).toThrow(/exclusively/);delete f.stack;
  f.levels![0].facades=[{edges:[15],treatment:'entrance'}];expect(()=>validateFootprint(f)).toThrow(/Facade edges/);
 });
 it('includes per-wing mixed roofs and deep eaves in collision and site validation',()=>{
  const current=studies[1],w=current.wings[1];expect(w.eave).toBe(1.8);expect(w.appearance?.roof).toBe('gable');
  const expanded=wingEnvelope(w,current),normal=wingEnvelope({...w,eave:.3},current);expect(normal.rear-expanded.rear).toBeCloseTo(1.5);
  expect(()=>validateCompositionPreview({...current,siteMode:'fixed',garden:{x:0,z:0,width:12,depth:12}})).toThrow();
  expect(()=>executeCompositionPatch(current,{wings:[{type:'adjust',id:w.id,changes:{appearance:{...w.appearance!,style:'modern',roof:'hip'}}}]})).toThrow(/incompatible/);
 });
 it('uses the bounded existing visual-review executor for individual new-level facades',()=>{
  const current=studies[0],form=structuredClone(current.forms![0]);form.levels![0].facades![0].treatment='glass';
  const changes={forms:[{type:'put',form}]};
  const result=stageReviewEdit(current,'Open the west suite facade',{changes,summary:'One facade',unsupported:[]},['forms.0.levels.0.facades.0.treatment']);
  expect(result.config).not.toEqual(current);
  expect(()=>stageReviewEdit(current,'Open the west suite facade',{changes,summary:'One facade',unsupported:[]},['forms.0.material'])).toThrow(/scope/);
 });
 it('advertises expressive levels, independent wing appearance and honest limitations',()=>{
  const prompt=compositionSystemPrompt('generate');expect(prompt).toContain('Preferred expressive multi-storey grammar');expect(prompt).toContain('eave:.3..3');expect(prompt).toContain('No stairs or internal access');
 });
});
describe('reusable enclosed architecture candidates',()=>{
 it('pins validated local data and previews through the property executor without changing source',()=>{
  const current=studies[0],form=current.forms![0],candidate=architectureCandidateDraft(form,current.character);
  const next=architectureCandidateDraft({...form,material:'sand'},'Second version',candidate);
  expect(candidate.version).toBe(1);expect(next.version).toBe(2);expect(candidate.form.material).toBe('ivory');
  const preview=previewArchitectureCandidate(next,current,{id:form.id,x:form.x,z:form.z,orientation:form.orientation});
  expect(preview.forms![0].material).toBe('sand');expect(current.forms![0].material).toBe('ivory');
  expect(preview.forms![0].levels).toEqual(form.levels);
 });
 it('rejects executable fields, unverified review status and invalid geometry or placement',()=>{
  const c=architectureCandidateDraft(studies[0].forms![0],'Reusable tower and salon');
  expect(()=>validateArchitectureCandidate({...c,code:'alert(1)'})).toThrow();
  expect(()=>validateArchitectureCandidate({...c,status:'reviewed'})).toThrow(/three captured/);
  expect(()=>validateArchitectureCandidate({...c,form:{...c.form,x:3}})).toThrow(/local origin/);
  expect(()=>previewArchitectureCandidate(c,studies[0],{id:'other',x:0,z:0,orientation:0})).toThrow();
 });
});
