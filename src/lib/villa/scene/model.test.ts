import { describe,it,expect } from 'vitest';
import { laderaScene } from './example';
import { applySceneOperations,validateScene } from './model';
describe('architectural scene transactions',()=>{
 it('edits only the requested element and preserves the source',()=>{
  const next=applySceneOperations(laderaScene,[{op:'resize',id:'bridge-roof',size:[17,.3,10]}]);
  expect(next.elements.find(e=>e.id==='bridge-roof')?.size).toEqual([17,.3,10]);
  expect(next.elements.find(e=>e.id==='salon-floor')).toBe(laderaScene.elements.find(e=>e.id==='salon-floor'));
  expect(laderaScene.elements.find(e=>e.id==='bridge-roof')?.size).toEqual([14.4,.3,8.4]);
 });
 it('rejects invalid geometry, code, unknown IDs and unsafe attachment graphs atomically',()=>{
  for(const ops of [[{op:'move',id:'missing',at:[0,0,0]}],[{op:'resize',id:'salon-floor',size:[-1,1,1]}],[{op:'execute',code:'alert(1)'}],[{op:'attach',id:'bridge-roof',parent:'bridge-roof',at:[0,0,0]}],[{op:'remove',id:'bridge-roof'},{op:'move',id:'missing',at:[0,0,0]}]])expect(()=>applySceneOperations(laderaScene,ops)).toThrow();
  expect(laderaScene.elements.some(e=>e.id==='bridge-roof')).toBe(true);
 });
 it('allows attached geometry but rejects removal of a referenced parent',()=>{
  const next=applySceneOperations(laderaScene,[{op:'attach',id:'suite-screen',parent:'bridge-floor',at:[0,1.65,3.5]}]);
  expect(()=>applySceneOperations(next,[{op:'remove',id:'bridge-floor'}])).toThrow();
 });
 it('rejects overlapping IDs and openings outside their wall',()=>{
  expect(()=>validateScene({...laderaScene,elements:[...laderaScene.elements,laderaScene.elements[0]]})).toThrow();
  expect(()=>applySceneOperations(laderaScene,[{op:'resize',id:'salon-back',size:[2,2,.3]}])).toThrow();
 });
});
