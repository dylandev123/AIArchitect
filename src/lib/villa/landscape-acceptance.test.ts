import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {buildComposition,validateCompositionPreview,landscapeAcceptance,executeCompositionPatch} from './composition';
import {estateExamples} from './estate-examples';
import {resolveVillaResult} from './terra';

describe('scoped landscape previews',()=>{
 it('recovers the retained curved villa without changing architecture or original drafts',()=>{
  const raw=readFileSync('docs/villa-playground/landscape-recovery/original.response.json','utf8');
  const original=JSON.parse(raw);
  const {config:c}=resolveVillaResult({mode:'generate',prompt:'Offline recovery'},original);
  expect('version' in c).toBe(true);if(!('version' in c))return;
  for(const key of ['wings','forms','components','pool','terraces','estateLandscape'] as const)expect(c[key]).toEqual(original.changes[key]);
  const a=landscapeAcceptance(c);
  expect(a.accessWarning).toBe(true);
  expect(a.unresolved.some(f=>f.path==='estateLandscape.routes.arrival-walk')).toBe(true);
  expect(a.unresolved.some(f=>f.path==='estateLandscape.beds.pavilion-garden')).toBe(true);
  expect(buildComposition(c).forms).toEqual(c.forms);
  expect(a.rendered?.routes.some(r=>r.id==='arrival-walk')).toBe(false);
  expect(a.rendered?.beds.some(b=>b.id==='pavilion-garden')).toBe(false);
  expect(executeCompositionPatch(c,{appearance:{exterior:'sand'}}).estateLandscape).toEqual(c.estateLandscape);
 });
 it('retains an overlapping decorative bed and an obstructed minor path as editable drafts',()=>{
  const c=estateExamples()[0],w=c.wings[0];
  c.estateLandscape!.beds.push({id:'flower-bed',x:w.x,z:w.z,width:3,depth:3});
  c.estateLandscape!.routes.push({id:'minor-garden-path',kind:'walk',width:1,planting:'none',points:[{x:w.x-3,z:w.z},{x:w.x+3,z:w.z}]});
  const accepted=validateCompositionPreview(c),a=landscapeAcceptance(accepted);
  expect(a.unresolved.some(f=>f.path==='estateLandscape.flower-bed')).toBe(true);
  expect(a.unresolved.some(f=>f.path==='estateLandscape.routes.minor-garden-path')).toBe(true);
  expect(a.rendered?.beds.some(b=>b.id==='flower-bed')).toBe(false);
  expect(accepted.estateLandscape).toEqual(c.estateLandscape);
 });
 it('blocks architectural overlaps and fixed boundaries even with unresolved landscape',()=>{
  const c=estateExamples()[0],before=structuredClone(c);
  expect(()=>executeCompositionPatch(c,{wings:[{type:'adjust',id:c.wings[1].id,changes:{x:c.wings[0].x,z:c.wings[0].z}}]})).toThrow();
  expect(c).toEqual(before);
  expect(()=>validateCompositionPreview({...c,siteMode:'fixed',garden:{x:0,z:0,width:12,depth:12}})).toThrow();
 });
 it('keeps valid estate examples fully accepted',()=>{
  for(const c of estateExamples())expect(landscapeAcceptance(c).unresolved).toEqual([]);
 });
});
