/** Scenes saved by earlier versions (retained evidence on disk) still load, and recompiling their stored plan reproduces them exactly. */
import {describe,expect,it} from 'vitest';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {compileArchitecturalPlan} from './plan';
import {validateScene} from '../scene/model';
const found:string[]=[];
const walk=(d:string)=>{for(const n of readdirSync(d)){const p=join(d,n),s=statSync(p);if(s.isDirectory()){if(!n.startsWith('canonical-whole-building'))walk(p);}else if(/scene.*\.json$/.test(n)&&s.size<6e6)found.push(p);}};
walk('docs/architecture');
const scenes=found.flatMap(f=>{try{const j=JSON.parse(readFileSync(f,'utf8'));const s=j.scene??j;return s?.architecturalPlan?.version==='architectural-plan-1'&&Array.isArray(s.elements)?[{f,scene:s}]:[];}catch{return [];}});
describe('saved canonical scenes from earlier versions',()=>{
 it('finds retained saved scenes',()=>{expect(scenes.length).toBeGreaterThanOrEqual(5);});
 it.each(scenes.map(s=>[s.f,s.scene]))('%s loads and its stored plan recompiles to identical geometry',(_f,scene)=>{
  const loaded=validateScene(scene);expect(loaded.elements.length).toBe(scene.elements.length);
  const recompiled=compileArchitecturalPlan(scene.architecturalPlan);   // every retained saved scene still compiles from its plan
  expect(recompiled.scene.elements).toEqual(loaded.elements);
 });
});
