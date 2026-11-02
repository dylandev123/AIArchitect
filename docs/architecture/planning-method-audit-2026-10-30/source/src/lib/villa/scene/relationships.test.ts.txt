import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySceneOperations, validateScene, type ArchitecturalScene } from './model';
import { assertSceneRelationships, sceneRelationshipIssues } from './relationships';
import { laderaScene } from './example';
import { resolveSceneResult } from './terra';
const empty: ArchitecturalScene = {version:'architectural-scene-1',name:'Test',elements:[]};
const element = (id: string, kind: string, at: number[], size: number[], extra = {}) => ({id,label:id,kind,at,size,...extra});
const build = (elements: unknown[]) => applySceneOperations(empty,elements.map(element=>({op:'add',element})));
const retained = validateScene(JSON.parse(readFileSync('docs/villa-playground/flat-main-house/original.scene.json','utf8')));

describe('shared direct-scene construction relationships',()=>{
 it('identifies every exact retained terrace, railing-as-floor and swapped-axis case without altering saved terrain',()=>{
  const copy=JSON.stringify(retained), issues=sceneRelationshipIssues(retained);
  for(const id of ['arrival-court','main-terrace','pool-deck','lower-west-deck','lower-east-deck','pavilion-platform','pavilion-bridge'])
   expect(issues.some(i=>i.id===id&&i.rule==='support'),id).toBe(true);
  for(const id of ['west-master-terrace','east-suite-terrace']) expect(issues.some(i=>i.id===id&&i.rule==='railing-depth'),id).toBe(true);
  for(const id of ['salon-west-glazing','salon-east-glazing']) expect(issues.some(i=>i.id===id&&i.rule==='glazing-depth'),id).toBe(true);
  for(const id of ['entry-screen-west','entry-screen-east','west-breeze-screen','east-breeze-screen']) expect(issues.some(i=>i.id===id&&i.rule==='screen-axis'),id).toBe(true);
  expect(()=>resolveSceneResult({mode:'generate',prompt:'Offline retained failure'},{name:retained.name,summary:'Retained',unsupported:[],operations:retained.elements.map(element=>({op:'add',element}))})).toThrow('needs contact');
  const edited=applySceneOperations(retained,[{op:'finish',id:'salon-roof',material:'timber'}]);
  expect(edited.terrain).toBe(retained.terrain);expect(validateScene(JSON.parse(copy))).toEqual(retained);expect(JSON.stringify(retained)).toBe(copy);
 });
 it('accepts Casa Ladera exactly, arbitrary yaw, bridges, side cantilevers and split levels with geometric support',()=>{
  expect(sceneRelationshipIssues(laderaScene)).toEqual([]);expect(()=>assertSceneRelationships(laderaScene)).not.toThrow();
  const scene=build([
   element('root','volume',[7,2,-4],[2,4,2],{rotation:.73}),
   element('upper','plate',[0,2.15,0],[18,.3,8],{parent:'root',rotation:.29}),
   element('extension','plate',[12,2.15,0],[8,.3,8],{parent:'root',rotation:.29}),
   element('rail','balcony',[0,.7,3.9],[16,1.1,.04],{parent:'upper'}),
  ]);
  expect(sceneRelationshipIssues(scene)).toEqual([]);
 });
 it('accepts suspended terraces and multi-storey cantilevers through real overhead contact',()=>{
  const elements=[
   element('core','volume',[0,3,0],[2,6,2],{rotation:.47}),
   element('beam','volume',[4*Math.cos(.47),5.8,-4*Math.sin(.47)],[10,.4,1],{rotation:.47}),
   // Hanger meets the rooted beam at its top, rather than resting on it.
   element('hanger','wall',[7*Math.cos(.47),3.8,-7*Math.sin(.47)],[.3,3.6,.3]),
   element('terrace','plate',[7*Math.cos(.47),1.9,-7*Math.sin(.47)],[4,.2,4]),
   element('upper','plate',[0,6.1,0],[12,.2,8],{rotation:.81}),
   element('upper-wall','wall',[0,7.7,0],[6,3,.2],{rotation:.81}),
   element('top-deck','plate',[0,9.3,0],[14,.2,8],{rotation:1.13}),
  ];
  expect(()=>build(elements)).not.toThrow();
  expect(()=>build([...elements].reverse())).not.toThrow();
  const scene=build(elements);
  expect(()=>applySceneOperations(scene,[{op:'remove',id:'beam'}])).toThrow('needs contact');
 });
 it('accepts a floating roof effect on clerestory glazing with an elevated roof terrace',()=>{
  const elements=[
   element('floor','plate',[0,.1,0],[10,.2,8]),
   element('clerestory','glazing',[0,1.7,0],[8,3,.1]),
   element('roof','roof',[0,3.3,0],[12,.2,10]),
   element('terrace','plate',[0,3.5,0],[8,.2,6]),
   element('rail','balcony',[0,4.15,2.9],[8,1.1,.03]),
  ];
  expect(()=>build(elements)).not.toThrow();
  expect(()=>build(elements.map(e=>e.id==='clerestory'?{...e,at:[0,2,0]}:e))).toThrow('needs contact');
 });
 it('rejects floating attachments and mutually floating support cycles, even with a valid ground floor',()=>{
  const floor=element('ground','plate',[0,.1,0],[10,.2,10]);
  for(const extras of [
   [element('floating','plate',[0,8,0],[5,.2,5],{parent:'ground'})],
   [element('pier','volume',[20,6,0],[1,4,1]),element('floating','plate',[20,8.1,0],[5,.2,5])],
   [element('a','plate',[20,8,0],[5,.2,5]),element('b','plate',[24,8,0],[5,.2,5])],
  ]) expect(()=>build([floor,...extras])).toThrow('needs contact');
 });
 it('requires a full railing span and deck datum; a wall or roof cannot substitute for its floor',()=>{
  for(const [kind,at,size] of [['plate',[0,.1,0],[4,.2,3]],['roof',[0,.1,0],[12,.2,3]],['wall',[0,1,0],[12,2,.2]]] as const)
   expect(()=>build([element('base',kind,[...at],[...size]),element('rail','balcony',[0,.75,0],[10,1.1,.03])])).toThrow('supporting deck');
 });
 it('accepts railings spanning multiple deck plates and standalone deep slat fins',()=>{
  expect(()=>build([element('west','plate',[-2,.1,0],[4,.2,4]),element('east','plate',[2,.1,0],[4,.2,4]),element('rail','balcony',[0,.75,1.9],[8,1.1,.03]),element('fin','screen',[20,2,0],[.2,4,6])])).not.toThrow();
  expect(()=>build([element('west','plate',[-3,.1,0],[4,.2,4]),element('east','plate',[3,.1,0],[4,.2,4]),element('rail','balcony',[0,.75,1.9],[10,1.1,.03])])).toThrow('supporting deck');
 });
 it('recognizes unparented panels lying on an actual wall face',()=>{
  const wall=element('wall','wall',[0,2,0],[10,4,.3]);
  for(const kind of ['glazing','screen']) {
   const face=element('face',kind,[0,2,.2],[5,3,.1]);
   expect(()=>build([wall,face])).not.toThrow();
   expect(()=>build([wall,{...face,rotation:Math.PI/2}])).toThrow('parallel');
  }
 });
 it('checks inherited facade yaw and location, allows reversed parallel faces and explicitly deep fins',()=>{
  const wall=element('wall','wall',[6,2,3],[10,4,.3],{rotation:.71});
  for(const kind of ['glazing','screen']) {
   const face=element('face',kind,[0,0,.2],[5,3,.1],{parent:'wall'});
   expect(()=>build([wall,face])).not.toThrow();
   expect(()=>build([wall,{...face,rotation:Math.PI}])).not.toThrow();
   expect(()=>build([wall,{...face,rotation:Math.PI/2}])).toThrow('parallel');
   expect(()=>build([wall,{...face,at:[0,0,4]}])).toThrow('facade');
  }
  expect(()=>build([wall,element('fin','screen',[0,0,.4],[.2,3,2],{parent:'wall'})])).not.toThrow();
 });
 it('validates indirect support loss and ancestor transforms atomically across all edit operations',()=>{
  const base=build([element('pier','volume',[0,2,0],[2,4,2]),element('deck','plate',[0,4.1,0],[8,.2,6]),element('rail','balcony',[0,4.85,2.9],[8,1.3,.03])]);
  const json=JSON.stringify(base);
  for(const ops of [
   [{op:'remove',id:'pier'}], [{op:'move',id:'pier',at:[30,2,0]}],
   [{op:'resize',id:'pier',size:[2,1,2]}], [{op:'move',id:'deck',at:[0,8,0]}],
   [{op:'rotate',id:'rail',rotation:Math.PI/2}], [{op:'resize',id:'rail',size:[12,1.3,.03]}],
   [{op:'attach',id:'deck',parent:'pier',at:[20,2.1,0]}],
  ]) expect(()=>applySceneOperations(base,ops)).toThrow();
  expect(JSON.stringify(base)).toBe(json);
  const moved=applySceneOperations(base,[{op:'move',id:'pier',at:[20,2,0]},{op:'move',id:'deck',at:[20,4.1,0]},{op:'move',id:'rail',at:[20,4.85,2.9]}]);
  expect(validateScene(JSON.parse(JSON.stringify(moved)))).toEqual(moved);
 });
});
