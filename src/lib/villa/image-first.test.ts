import { describe,it,expect } from 'vitest';
import { constructImageSpec,offlineImageSpec,conceptStage } from './image-first';
import { executeCompositionPatch } from './composition';
describe('offline image-first boundary',()=>{
 it('uses the existing validator and remains editable without mutating the specification',()=>{
  const original=JSON.stringify(offlineImageSpec), result=constructImageSpec(offlineImageSpec);
  expect(result.config.wings[0].storeys).toBe(1);
  const edited=executeCompositionPatch(result.config,{wings:[{type:'adjust',id:'residence',changes:{width:19}}]});
  expect(edited.wings[0].width).toBe(19);
  expect(JSON.stringify(offlineImageSpec)).toBe(original);
  expect(conceptStage.enabled).toBe(false);
 });
 it('rejects silent substitutes, missing mappings and undisclosed approximations',()=>{
  for(const change of [{disposition:'unsupported',target:'wings.0'},{target:'wings.99'},{disposition:'approximate',limitation:''}]) {
   const s=structuredClone(offlineImageSpec);Object.assign(s.features[0],change);
   expect(()=>constructImageSpec(s)).toThrow();
  }
 });
 it('rejects invalid construction rather than repairing it into a template',()=>{
  const s=structuredClone(offlineImageSpec);s.architecture.wings[0].width=-1;
  expect(()=>constructImageSpec(s)).toThrow();
 });
});
