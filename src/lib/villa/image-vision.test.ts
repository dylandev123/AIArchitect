import retained from './__tests__/fixtures/first-live-vision.json';
import {describe,it,expect,vi} from 'vitest';
import {offlineImageSpec} from './image-first';
import {constructVision,interpretSavedImage,visionInstructions} from './image-vision';
import {executeCompositionPatch} from './composition';
export function mockVisionSpec() {
 return {...structuredClone(offlineImageSpec),provenance:'terra-vision',evidence:offlineImageSpec.features.map(f=>({featureId:f.id,basis:f.disposition==='hidden'?'inferred':f.disposition==='unsupported'?'unsupported':'visible',explanation:f.observation})),camera:{position:[30,16,40],target:[0,3,0],fov:39,uncertainty:'Mock camera estimate; live visual match untested.'}};
}
describe('single-call image interpretation',()=>{
 it('sends one provider request, retains before parsing, builds and edits locally',async()=>{
  const raw={text:JSON.stringify(mockVisionSpec()),response:{body:{mock:true}},usage:{outputTokens:100}};
  const retain=vi.fn(async()=>{}),provider=vi.fn(async()=>raw);
  const proof=await interpretSavedImage(provider,retain);
  expect(provider).toHaveBeenCalledTimes(1);expect(retain).toHaveBeenCalledWith(raw);
  expect(executeCompositionPatch(proof.config,{wings:[{type:'adjust',id:'residence',changes:{width:19}}]}).wings[0].width).toBe(19);
 });
 it('retains malformed and invalid output, with no retries or fallback',async()=>{
  for(const text of ['{',JSON.stringify({...mockVisionSpec(),architecture:{}})]) {
   const retain=vi.fn(async()=>{}),provider=vi.fn(async()=>({text,response:{},usage:{}}));
   await expect(interpretSavedImage(provider,retain)).rejects.toThrow();
   expect(provider).toHaveBeenCalledTimes(1);expect(retain).toHaveBeenCalledTimes(1);
  }
 });
 it('does not retry provider errors or proceed after retention failure',async()=>{
  const provider=vi.fn(async()=>{throw new Error('quota');});
  await expect(interpretSavedImage(provider,vi.fn())).rejects.toThrow('quota');expect(provider).toHaveBeenCalledTimes(1);
  await expect(interpretSavedImage(async()=>({text:'{}',response:{},usage:{}}),async()=>{throw new Error('disk');})).rejects.toThrow('disk');
 });
 it('requires evidence for every feature and honest hidden geometry',()=>{
  const raw=mockVisionSpec();raw.evidence[0].featureId='absent';expect(()=>constructVision(raw)).toThrow();
  const other=mockVisionSpec();other.evidence.find(e=>e.featureId==='entrance')!.basis='visible';expect(()=>constructVision(other)).toThrow();
  expect(visionInstructions()).toContain('authoritative visual reference');
 });
 it('constructs provider dimensions and floor levels rather than fixture geometry',()=>{
  const raw=mockVisionSpec();raw.floorLevels=2;
  Object.assign(raw.architecture.wings[0],{width:22,depth:12,storeys:2});
  raw.architecture.appearance.roof='gable';
  const proof=constructVision(raw);
  expect(proof.config.wings[0]).toMatchObject({width:22,depth:12,storeys:2});
  expect(proof.config.appearance.roof).toBe('gable');
 });
});

describe('retained first live vision metadata recovery',()=>{
 it('replays the exact retained interpretation, preserving geometry and raw metadata',()=>{
  const before=JSON.stringify(retained), proof=constructVision(retained);
  expect(proof.spec.architecture).toEqual(retained.architecture);
  expect(proof.config.wings).toEqual(retained.architecture.wings);
  expect(proof.config.terraces).toEqual(retained.architecture.terraces);
  expect(proof.config.pool).toEqual(retained.architecture.pool);
  expect(proof.spec.features[0].target).toBe('wings.0');
  expect(proof.spec.features[1].target).toBe('wings.0.storeys');
  expect(JSON.stringify(retained)).toBe(before);
  expect(executeCompositionPatch(proof.config,{wings:[{type:'adjust',id:'main-house',changes:{width:24}}]}).wings[0].width).toBe(24);
 });
 it('accepts observed or inferred unsupported features without substitute geometry',()=>{
  for(const basis of ['visible','inferred','unsupported'] as const){
   const raw=structuredClone(retained);
   raw.evidence.find(e=>e.featureId==='garden-trees')!.basis=basis;
   expect(constructVision(raw).unsupported.join(' ')).toContain('garden-trees');
  }
 });
 it('rejects contradictory evidence and unsupported geometry',()=>{
  const raw=structuredClone(retained);
  raw.evidence[0].basis='unsupported';expect(()=>constructVision(raw)).toThrow('Evidence disposition mismatch');
  const hidden=structuredClone(retained);
  hidden.evidence.find(e=>e.featureId==='interior-layout')!.basis='visible';
  expect(()=>constructVision(hidden)).toThrow('Evidence disposition mismatch');
  const substitute=structuredClone(retained);
  substitute.features.find(f=>f.id==='garden-trees')!.target='architecture.wings[0]';
  expect(()=>constructVision(substitute)).toThrow('Unsupported feature cannot have substitute geometry');
  const invalid=structuredClone(retained);invalid.architecture.wings[0].width=-1;
  expect(()=>constructVision(invalid)).toThrow();
 });
 it('normalizes only equivalent paths and rejects malformed, inherited and absent targets',()=>{
  for(const target of ['wings.0','wings[0]','architecture.wings.0','architecture.wings[0]']){
   const raw=structuredClone(retained);raw.features[0].target=target;
   expect(constructVision(raw).spec.features[0].target).toBe('wings.0');
  }
  for(const target of ['architecture.wings[99]','architecture.wings[-1]','wings[00]','wings..0','architecture.constructor','architecture.__proto__','wings.0.toString','architecture.wings[0].missing','architecture.wings[0]junk']){
   const raw=structuredClone(retained);raw.features[0].target=target;
   expect(()=>constructVision(raw)).toThrow();
  }
 });
});
