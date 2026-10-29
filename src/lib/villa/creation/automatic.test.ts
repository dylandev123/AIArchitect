import { describe,it,expect,vi,afterEach } from 'vitest';
import { mkdtemp,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { assembleAutomaticComponents,automaticCreationInstructions,creationBudget } from './automatic';
import { mockProposal,defaultPlacement } from './model';
import { automaticCandidateDraft,candidateDraft } from './candidate';
import { saveCandidate,listCandidates } from './store';
import { COMPOSITION_EXAMPLES } from '../composition-examples';
import { buildComposition,executeCompositionPatch,landscapeAcceptance } from '../composition';
import { resolveVillaResult } from '../terra';
const input={mode:'generate' as const,prompt:'Design a Caribbean house with an original wave canopy beside its terrace.'};
const output=()=>({changes:{...COMPOSITION_EXAMPLES[0],siteMode:'derived'},summary:'A house and experimental wave canopy.',unsupported:[],componentRequests:[{type:'create',id:'terrace-wave',missingCapability:'A banked wave canopy absent from the approved library.',proposal:mockProposal(),placement:defaultPlacement}]});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
describe('automatic component assembly through normal villa generation',()=>{
 it('identifies, constructs, renders, saves and reloads the experimental component with immutable identity',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'auto-villa-'));vi.spyOn(process,'cwd').mockReturnValue(dir);
  try {
   const result=await assembleAutomaticComponents(input,output(),1);
   expect(result.componentStages.map(s=>s.stage)).toEqual(['missing-capability','geometry-validated','experimental-candidate-saved','property-assembled']);
   const c=result.config;if(!('version' in c))throw Error('Expected composition');
   expect(buildComposition(c).createdComponents).toEqual(c.createdComponents);
   const stored=await listCandidates();expect(stored).toHaveLength(1);expect(stored[0]).toMatchObject({status:'experimental',evidence:[],originalIntent:input.prompt,proposal:{geometry:{builder:'swept-ribbon@1'}}});
   expect(c.createdComponents![0]).toMatchObject({candidateId:stored[0].id,candidateVersion:stored[0].version,proposal:stored[0].proposal});
   const replay=resolveVillaResult(input,{changes:c,summary:result.summary,unsupported:[]});expect(replay.config).toEqual(c);
   const edited=executeCompositionPatch(c,{createdComponents:[{type:'adjust',id:'terrace-wave',placement:{orientation:25}}]});
   expect(edited.createdComponents![0].proposal).toEqual(c.createdComponents![0].proposal);
   expect(edited.createdComponents![0].candidateVersion).toBe(stored[0].version);
   expect(executeCompositionPatch(edited,{createdComponents:[{type:'remove',id:'terrace-wave'}]}).createdComponents).toEqual([]);
   await expect(saveCandidate(stored[0],true)).rejects.toThrow(/reviewed/);
  }finally{vi.restoreAllMocks();await rm(dir,{recursive:true,force:true});}
 });
 it('reuses an exact approved private version with zero creation/save calls',async()=>{
  const image='data:image/png;base64,'+Buffer.from('\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\x02\x80\0\0\x01\x68','binary').toString('base64');
  const candidate={...candidateDraft(mockProposal(),input.prompt,COMPOSITION_EXAMPLES.slice(0,2).map((villa,i)=>({villa,placement:i?{x:15,z:8,orientation:25}:defaultPlacement,image,view:'Poolside',reviewed:true}))),status:'approved' as const,version:7};
  const deps={list:vi.fn(async()=>[candidate]),save:vi.fn()};
  const result=await assembleAutomaticComponents(input,{...output(),componentRequests:[{type:'reuse',id:'wave-reuse',candidateId:candidate.id,candidateVersion:7,placement:defaultPlacement}]},0,deps);
  expect(deps.save).not.toHaveBeenCalled();expect(result.componentStages[0].stage).toBe('approved-reuse');
  expect('version' in result.config&&result.config.createdComponents![0].candidateVersion).toBe(7);
  expect(automaticCreationInstructions([candidate],1)).toContain('"version":7');
 });
 it('ordinary houses and unsupported forms cause no component creation or library reads',async()=>{
  const deps={list:vi.fn(),save:vi.fn()};
  const base={changes:COMPOSITION_EXAMPLES[0],summary:'A normal villa.',unsupported:[]};
  const result=await assembleAutomaticComponents(input,base,1,deps);expect(result.componentStages).toEqual([]);
  const gap=await assembleAutomaticComponents(input,{...base,componentRequests:[{type:'gap',capabilityGap:'Enclosed branching glass shells are unavailable.'}]},1,deps);
  expect(gap.unsupported).toContain('Enclosed branching glass shells are unavailable.');
  expect(deps.list).not.toHaveBeenCalled();expect(deps.save).not.toHaveBeenCalled();
 });
 it('does not expose experimental designs in the approved provider catalogue',()=>{
  const draft=automaticCandidateDraft(mockProposal(),input.prompt);
  expect(automaticCreationInstructions([draft],1)).not.toContain('"id":"tidal-ribbon"');
 });
 it('rejects budgets, unsupported builders, bad clearances, forged snapshots and fixed-site overflow before saving',async()=>{
  const deps={list:vi.fn(async()=>[]),save:vi.fn()};
  await expect(assembleAutomaticComponents(input,output(),0,deps)).rejects.toThrow(/budget/);
  const invalid=output();invalid.componentRequests[0].proposal.geometry.builder='code@1' as 'swept-ribbon@1';
  await expect(assembleAutomaticComponents(input,invalid,1,deps)).rejects.toThrow();
  const collision=output();collision.componentRequests[0].placement={x:0,z:-5,orientation:0};
  await expect(assembleAutomaticComponents(input,collision,1,deps)).rejects.toThrow(/clearance/);
  const remote=output();remote.componentRequests[0].placement={x:70,z:0,orientation:90};
  await expect(assembleAutomaticComponents({...input,site:COMPOSITION_EXAMPLES[0].garden},remote,1,deps)).rejects.toThrow(/garden/);
  const derived=await assembleAutomaticComponents(input,remote,1,{...deps,save:async c=>c as ReturnType<typeof automaticCandidateDraft>});
  expect('version' in derived.config && derived.config.garden.width).toBeGreaterThan(COMPOSITION_EXAMPLES[0].garden.width);
  const forged={...output(),changes:{...output().changes,createdComponents:[{id:'fake',candidateId:'tidal-ribbon',candidateVersion:1,status:'approved',originalIntent:input.prompt,proposal:mockProposal(),placement:defaultPlacement}]}};
  await expect(assembleAutomaticComponents(input,forged,1,deps)).rejects.toThrow(/snapshots/);
  expect(deps.save).not.toHaveBeenCalled();
 });
 it('rejects reuse of unapproved or unavailable versions and preserves the input',async()=>{
  const source=output();const copy=structuredClone(source);
  const draft=automaticCandidateDraft(mockProposal(),input.prompt);
  const reuse={...source,componentRequests:[{type:'reuse',id:'wave',candidateId:draft.id,candidateVersion:1,placement:defaultPlacement}]};
  await expect(assembleAutomaticComponents(input,reuse,1,{list:async()=>[draft],save:vi.fn()})).rejects.toThrow(/approved/);
  await expect(assembleAutomaticComponents(input,source,1,{list:vi.fn(),save:async()=>{throw Error('disk full');}})).rejects.toThrow('disk full');
  expect(source).toEqual(copy);
 });
 it('retains valid created architecture while a conflicting minor landscape bed remains an editable draft',async()=>{
  const source=output();
  const changes={...source.changes,estateLandscape:{builder:'estate-landscape@1',routes:[{id:'garden-walk',kind:'walk',width:1,points:[{x:-15,z:0},{x:-15,z:8}],planting:'none'}],beds:[{id:'draft-bed',x:14,z:6,width:3,depth:3}]}};
  const result=await assembleAutomaticComponents(input,{...source,changes},1,{list:async()=>[],save:async c=>c as ReturnType<typeof automaticCandidateDraft>});
  if(!('version' in result.config))throw Error('Expected composition');
  expect(buildComposition(result.config).createdComponents).toHaveLength(1);
  expect(landscapeAcceptance(result.config).rendered?.beds).toEqual([]);
  expect(landscapeAcceptance(result.config).unresolved.length).toBeGreaterThan(0);
  expect(executeCompositionPatch(result.config,{appearance:{exterior:'limestone'}}).createdComponents).toEqual(result.config.createdComponents);
 });
 it('enforces the configurable single-call V1 budget',()=>{
  vi.stubEnv('VILLA_MAX_NEW_COMPONENTS','2');expect(creationBudget()).toMatchObject({maxProviderCalls:1,maxNewComponents:2});
  for(const value of ['3','-1','oops','1.5']) {vi.stubEnv('VILLA_MAX_NEW_COMPONENTS',value);expect(()=>creationBudget()).toThrow();}
 });
});
