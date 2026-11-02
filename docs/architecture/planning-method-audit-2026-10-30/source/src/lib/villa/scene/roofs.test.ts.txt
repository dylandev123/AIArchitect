import { describe,it,expect } from 'vitest';
import { buildSceneRoof } from './roofs';
import { validateScene } from './model';
const material={color:'#cccbbb',roughness:.7,metalness:0};
describe('reused roof construction in direct scenes',()=>{
 for(const roofForm of ['gable','hip'] as const)it(`constructs ${roofForm} geometry with stable element-derived IDs`,()=>{
  const scene=validateScene({version:'architectural-scene-1',name:'Roof',elements:[{id:'roof',label:'Roof',kind:'roof',at:[0,5,0],size:[12,2,8],roofForm,overhang:.5}]});
  const parts=buildSceneRoof(scene.elements[0],material);
  expect(parts.some(p=>p.kind==='triMesh')).toBe(true);expect(parts.every(p=>p.id.startsWith('roof-'))).toBe(true);
  const vertices=parts.flatMap(p=>p.kind==='triMesh'?p.vertices:[]);expect(Math.max(...vertices.filter((_,i)=>i%3===1))).toBe(1);
 });
 it('rejects invalid rises and roof parameters on walls',()=>{
  const scene={version:'architectural-scene-1',name:'Roof',elements:[{id:'roof',label:'Roof',kind:'roof',at:[0,5,0],size:[12,.2,8],roofForm:'gable'}]};
  expect(()=>validateScene(scene)).toThrow('rise');scene.elements[0].kind='wall';expect(()=>validateScene(scene)).toThrow('Roof parameters');
 });
});
