import {describe,it,expect} from 'vitest';
import {z} from 'zod';
import {estateExamples} from './estate-examples';
import {executeCompositionPatch} from './composition';
import {resolveVillaResult,villaProviderOutputSchema,compositionSystemPrompt} from './terra';

const response=(changes:unknown)=>({changes,summary:'Offline estate',unsupported:[]});
describe('Terra estate authoring without a provider',()=>{
 it.each([0,1,2])('generates estate %i through the response contract',i=>{
  const current=estateExamples()[i],request={mode:'generate' as const,prompt:'An unconstrained estate'};
  expect(villaProviderOutputSchema(request).safeParse(response(current)).success).toBe(true);
  expect(()=>z.toJSONSchema(villaProviderOutputSchema(request))).not.toThrow();
  expect(resolveVillaResult(request,response(current)).config).toEqual(current);
 });
 it('applies targeted court edits identically to manual operations, preserving unrelated features',()=>{
  const current=estateExamples()[0],before=structuredClone(current);
  const changes={estateLandscapeChanges:{court:{z:-24}}};
  const request={mode:'edit' as const,prompt:'Move the fountain closer to the entrance',current};
  const result=resolveVillaResult(request,response(changes)).config;
  expect(result).toEqual(executeCompositionPatch(current,changes));
  expect('estateLandscape' in result && result.estateLandscape?.court?.z).toBe(-24);
  expect('estateLandscape' in result && result.estateLandscape?.routes).toEqual(current.estateLandscape?.routes);
  expect('wings' in result && result.wings).toEqual(current.wings);expect(result.pool).toEqual(current.pool);expect(current).toEqual(before);
 });
 it('rotates a detached guest wing without replacing architecture',()=>{
  const current=estateExamples()[1];
  const result=resolveVillaResult({mode:'edit',prompt:'Rotate the guest pavilion toward the ocean',current},response({wings:[{type:'adjust',id:'east-retreat',changes:{orientation:15}}]})).config;
  expect('wings' in result && result.wings[2].orientation).toBe(15);expect('wings' in result && result.wings[0]).toEqual(current.wings[0]);
 });
 it('adds arrival to an existing property without changing architecture',()=>{
  const target=estateExamples()[0],current=structuredClone(target);delete current.estateLandscape;
  const result=resolveVillaResult({mode:'edit',prompt:'Add a winding driveway and circular arrival court',current},response({estateLandscape:target.estateLandscape})).config;
  expect(result).toEqual(target);
 });
 it('edits garden beds and walking routes by ID while preserving the rest of the landscape',()=>{
  const current=estateExamples()[2],landscape=current.estateLandscape!;
  const bed={...landscape.beds[0],width:4.4},route={...landscape.routes[2],planting:'none' as const};
  const changes={estateLandscapeChanges:{beds:[{type:'put',bed}],routes:[{type:'put',route}]}};
  const result=executeCompositionPatch(current,changes);
  expect(resolveVillaResult({mode:'edit',prompt:'Refine the formal courtyard garden',current},response(changes)).config).toEqual(result);
  expect(result.estateLandscape?.beds).toEqual([bed,...landscape.beds.slice(1)]);
  expect(result.estateLandscape?.court).toEqual(landscape.court);
  expect(result.estateLandscape?.routes.filter(r=>r.id!==route.id)).toEqual(landscape.routes.filter(r=>r.id!==route.id));
  expect(result.wings).toEqual(current.wings);
 });
 it('rejects bad geometry and fixed lots without mutating the property',()=>{
  const current=estateExamples()[0],before=structuredClone(current);
  const request={mode:'edit' as const,prompt:'Edit arrival',current};
  for(const changes of [{estateLandscapeChanges:{court:{islandWidth:20}}},{estateLandscapeChanges:{routes:[{type:'remove',id:'missing'}]}},{wings:[{type:'adjust',id:'great-house',changes:{orientation:15}}]},{garden:{x:0,z:0,width:12,depth:12}}]) {
   expect(()=>resolveVillaResult(request,response(changes))).toThrow();expect(current).toEqual(before);
  }
  expect(()=>resolveVillaResult({mode:'generate',prompt:'Explicit tiny lot',site:{x:0,z:0,width:12,depth:12}},response(current))).toThrow();
 });
 it('keeps optional capabilities and instructs original, proportional design',()=>{
  const p=compositionSystemPrompt('generate');expect(p).toContain('modest');expect(p).toContain('15 million');expect(p).toContain('never mandatory');expect(p).toContain('estate-landscape@1');
 });
});
