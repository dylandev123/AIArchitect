import { describe, expect, it } from 'vitest';
import { applySceneOperations, elementSchema, validateScene, type ArchitecturalScene } from './model';
import { spatialCoordinationFindings, waterObstructions } from './spatial';
import { resolveSceneResult, SceneConstructionError } from './terra';
const e=(id:string,kind:string,at:number[],size:number[],extra={})=>elementSchema.parse({id,label:id,kind,at,size,...extra});
const scene=(elements:ArchitecturalScene['elements']):ArchitecturalScene=>({version:'architectural-scene-1',name:'spatial contract regression',elements});
describe('shared construction coordinates',()=>{
 it('rejects a terrace cutting water and identifies both operations, without repairing the candidate',()=>{
  const elements=[e('water','water',[0,.1,0],[10,.05,4]),e('deck','plate',[0,.1,0],[12,.2,6])];
  expect(waterObstructions(scene(elements))).toHaveLength(1);
  try { resolveSceneResult({mode:'generate',prompt:'pool terrace'},{name:'conflict',summary:'offline test',unsupported:[],operations:elements.map(element=>({op:'add',element}))});throw Error('expected rejection'); }
  catch(error){expect(error).toBeInstanceOf(SceneConstructionError);expect(String(error)).toContain('0:add:water, 1:add:deck');expect((error as SceneConstructionError).recoverableDraft.elements).toEqual(elements);}
 });
 it('keeps pool floors, edge walls, coping, overhead bridges and shade valid',()=>{
  const s=scene([e('water','water',[0,.2,0],[10,.05,4]),e('bottom','plate',[0,-1,0],[10,.2,4]),e('edge','wall',[0,-.4,2],[10,1.2,.15]),e('coping','plate',[0,.1,2.5],[10,.2,.8]),e('bridge','plate',[0,1,0],[2,.2,6]),e('shade','roof',[0,3,0],[12,.2,6])]);
  expect(waterObstructions(s)).toEqual([]);
 });
 it('uses rotated parent coordinates, and catches a moved obstacle even if water is unchanged',()=>{
  const s=scene([e('frame','volume',[20,0,10],[.1,.1,.1],{rotation:Math.PI/3}),e('water','water',[0,.1,0],[10,.05,4],{parent:'frame'}),e('deck','plate',[0,.1,0],[2,.2,2],{parent:'frame'})]);
  expect(waterObstructions(s)).toHaveLength(1);
  expect(validateScene(s)).toEqual(s); // Legacy load stays lossless.
  expect(applySceneOperations(s,[{op:'finish',id:'deck',material:'timber'}])).toBeTruthy();
  expect(()=>applySceneOperations(s,[{op:'move',id:'deck',at:[1,.1,0]}])).toThrow('water');
  expect(applySceneOperations(s,[{op:'move',id:'deck',at:[12,.1,0]}])).toBeTruthy();
 });
 it('checks declared view/coverage/clearance without restricting unasserted architecture',()=>{
  const s=scene([e('roof','roof',[0,3,0],[12,.2,8]),e('deck','plate',[0,.1,0],[10,.2,6]),e('lounge','volume',[0,.5,10],[2,1,2])]);
  s.architecturalPlan={spatialRelationships:[{subject:'roof',target:'deck',relation:'covering',clearance:0,reason:'shade'},{subject:'lounge',target:'deck',relation:'facing',clearance:0,reason:'approach'}]};
  expect(spatialCoordinationFindings(s).map(f=>f.code)).toEqual(['spatial-intent-mismatch']);
  s.elements[2]={...s.elements[2],rotation:Math.PI};
  expect(spatialCoordinationFindings(s)).toEqual([]);
 });
});

it('uses the pinned pavilion floor origin and overhanging roof in spatial bounds',async()=>{
 const {sceneSpatialGeometry}=await import('./spatial');
 const pavilion=e('pavilion','pavilion',[0,.2,0],[12,4.2,8]);
 const g=sceneSpatialGeometry(scene([pavilion]));
 expect(g.bottom(pavilion)).toBeCloseTo(-.7);
 expect(g.top(pavilion)).toBeCloseTo(4.69);
 expect(g.separation(pavilion,e('nearby','plate',[7,.1,0],[1,.2,1]))).toBeLessThan(0);
});
