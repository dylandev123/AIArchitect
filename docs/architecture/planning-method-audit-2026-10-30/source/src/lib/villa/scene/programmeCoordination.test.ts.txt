import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {stageSceneOperations,applySceneOperations,type SceneOperation} from './model';
import {occupiedRoofConflicts} from './spatial';
import {reviewProgramme} from './programme';
import {focusedConstructionFindings} from './focusedConstruction';
import {resolveSceneResult,SceneConstructionError} from './terra';
import {laderaScene} from './example';
import {laderaPlan} from './planning.fixture';
const output=JSON.parse(readFileSync('.data/scene-responses/66c57386-4c5c-4f50-a97e-8ec0ec80588b.json','utf8')).output;
const failed=()=>({...stageSceneOperations({version:'architectural-scene-1',name:output.name,elements:[]},output.operations),architecturalPlan:output.architecturalPlan});
it('identifies the exact retained roof/occupied-suite contradiction before committing',()=>{
 const scene=failed(),snapshot=JSON.stringify(scene);
 expect(scene.elements).toHaveLength(88);
 const conflict=occupiedRoofConflicts(scene).find(f=>f.elementIds[0]==='salon-roof'&&f.elementIds[1]==='upper-floor')!;
 expect(conflict.category).toBe('confirmed-technical-defect');
 expect(conflict.message).toContain('world [0, 4.125, 0]');
 expect(conflict.message).toContain('walking Y=3.7');
 expect(JSON.stringify(scene)).toBe(snapshot);
 try{resolveSceneResult({mode:'generate',prompt:'Offline retained replay'},output);expect.fail('must reject');}catch(e){
  expect(e).toBeInstanceOf(SceneConstructionError);
  expect((e as Error).message).toContain('0:assemble:salon');
  expect((e as Error).message).toContain('11:add:upper-floor');
  expect((e as SceneConstructionError).recoverableDraft.elements).toEqual(scene.elements);
 }
});
it('preserves separated layered roofs and treats higher canopy bounds as review evidence',()=>{
 const scene={...laderaScene,architecturalPlan:laderaPlan};
 expect(occupiedRoofConflicts(scene).some(f=>f.category==='confirmed-technical-defect')).toBe(false);
 expect(()=>applySceneOperations(scene,[{op:'finish',id:'bridge-roof',material:'bronze'}])).not.toThrow();
});
it('keeps malformed programme references, volume stair rise gaps and missing allocations visible',()=>{
 const scene=failed();
 expect(reviewProgramme(scene).issues.join(' ')).toContain('stair-08`,`stair-09');
 expect(focusedConstructionFindings(scene).some(f=>f.code==='stair-rise-gap'&&f.message.includes('0.370'))).toBe(true);
 expect(reviewProgramme(scene).spaces.find(s=>s.name==='Upper owner suite')?.walkingDatums).toEqual([3.7,3.7]);
});
it('uses actual recursive world frames and does not certify pitched envelope collisions',()=>{
 const original=failed();
 const parent={...original.elements.find(e=>e.id==='upper-landing-support')!,id:'frame',at:[20,2,30] as [number,number,number],rotation:.63};
 const transformed={...original,elements:[parent,...original.elements.map(e=>e.parent?e:{...e,parent:'frame'})]};
 expect(occupiedRoofConflicts(transformed).some(f=>f.elementIds[0]==='salon-roof'&&f.elementIds[1]==='upper-floor')).toBe(true);
 const pitched=stageSceneOperations(original,[{op:'replace',id:'salon-roof',element:{...original.elements.find(e=>e.id==='salon-roof')!,roofForm:'gable',size:[20,1.2,12]}}] as SceneOperation[]);
 expect(occupiedRoofConflicts(pitched).some(f=>f.elementIds[0]==='salon-roof')).toBe(false);
});
