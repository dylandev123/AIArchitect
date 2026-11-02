import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {applySceneOperations,validateScene,type SceneOperation} from './model';
import {auditArchitecturalPlan} from './planning';
const read=(name:string)=>JSON.parse(readFileSync(`docs/villa-playground/plan-to-construction/${name}.json`,'utf8'));
const before=validateScene(JSON.parse(readFileSync('docs/villa-playground/25m-mansion-recovery/corrected.scene.json','utf8')));
it('replays the coordinated allocation without growing the scene or hiding plan errors',()=>{
 const after=applySceneOperations(before,read('operations'));
 expect(after).toEqual(read('corrected.scene'));expect(after.elements).toHaveLength(65);
 expect(auditArchitecturalPlan(after,read('plan')).status).toBe('consistent');
 expect(validateScene(JSON.parse(JSON.stringify(after)))).toEqual(after);
});
it('seats relative to a rotated nested support and follows support moves; resize requires explicit reseating',()=>{
 const ops:SceneOperation[]=[{op:'place-on',id:'east-terrace-rail',support:'east-terrace-deck',offset:[0,-4.8],rotation:0}];
 const seated=applySceneOperations(before,ops);
 expect(seated.elements.find(e=>e.id==='east-terrace-rail')?.at[1]).toBeCloseTo(.65);
 const moved=applySceneOperations(seated,[{op:'move',id:'east-terrace-deck',at:[12,3.6,0]},{op:'rotate',id:'east-terrace-deck',rotation:.1}]);
 expect(moved.elements.find(e=>e.id==='east-terrace-rail')).toEqual(seated.elements.find(e=>e.id==='east-terrace-rail'));
 const resized=applySceneOperations(seated,[{op:'resize',id:'east-terrace-deck',size:[8,.3,10]},...ops]);
 expect(resized.elements.find(e=>e.id==='east-terrace-rail')?.at[1]).toBeCloseTo(.7);
 expect(seated.elements.filter(e=>e.id!=='east-terrace-rail')).toEqual(before.elements.filter(e=>e.id!=='east-terrace-rail'));
 expect(()=>applySceneOperations(before,[{...ops[0],support:'missing'}])).toThrow('existing horizontal');
 expect(()=>applySceneOperations(before,[{...ops[0],support:'east-terrace-rail'}])).toThrow();
 expect(()=>applySceneOperations(before,[{...ops[0],support:'salon-south-wall'}])).toThrow('existing horizontal');
 expect(()=>applySceneOperations(before,[{...ops[0],support:'east-terrace-rail',id:'east-terrace-deck'}])).toThrow();
});
it('seats walls and flat roofs, rejects cycles and pitched surfaces atomically',()=>{
 const wall=applySceneOperations(before,[{op:'place-on',id:'lounge-north-wall',support:'lounge-floor',offset:[0,5]}]);
 expect(wall.elements.find(e=>e.id==='lounge-north-wall')?.at).toEqual([0,1.7000000000000002,5]);
 expect(()=>applySceneOperations(before,[{op:'place-on',id:'lounge-roof',support:'lounge-north-wall',offset:[0,-5]}])).toThrow('existing horizontal');
 expect(()=>applySceneOperations(before,[{op:'place-on',id:'lounge-floor',support:'lounge-floor',offset:[0,0]}])).toThrow('Cyclic');
 const pitched=structuredClone(before);const r=pitched.elements.find(e=>e.id==='lounge-roof')!;r.roofForm='hip';r.size[1]=1;
 expect(()=>applySceneOperations(pitched,[{op:'place-on',id:'east-terrace-rail',support:'lounge-roof',offset:[0,0]}])).toThrow('existing horizontal');
 expect(before.elements.find(e=>e.id==='lounge-north-wall')?.parent).toBeUndefined();
});
