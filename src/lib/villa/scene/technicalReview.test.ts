import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {validateScene,applySceneOperations} from './model';
import {sceneRelationshipIssues} from './relationships';
import {reviewSceneArchitecture} from './planning';
const terra=()=>validateScene(JSON.parse(readFileSync('docs/villa-playground/redesign-strict-live/after.UNAPPROVED.json','utf8')));
const fixes=()=>JSON.parse(readFileSync('docs/villa-playground/redesign-technical-review/repair.operations.json','utf8'));
it('identifies all three retained Terra door faults and repairs only those centres',()=>{
 const scene=terra(),raw=JSON.stringify(scene);
 expect(reviewSceneArchitecture(scene).issues.filter(i=>i.includes('panel centre'))).toHaveLength(3);
 const repaired=applySceneOperations(scene,fixes());expect(sceneRelationshipIssues(repaired)).toEqual([]);
 expect(JSON.stringify(scene)).toBe(raw);
 expect(reviewSceneArchitecture(repaired).issues.join(' ')).toContain('vertical circulation is not evidenced');
 expect(reviewSceneArchitecture(repaired).status).toBe('incomplete');
});
it('audits host opening changes and panel overruns without rewriting legacy geometry',()=>{
 const scene=applySceneOperations(terra(),fixes()),host=scene.elements.find(e=>e.id==='salon-north-wall-new')!;
 const changed=applySceneOperations(scene,[{op:'replace',id:host.id,element:{...host,opening:{...host.opening!,x:1}}}]);
 expect(reviewSceneArchitecture(changed).issues.join(' ')).toContain('does not fit an unglazed host opening');
 const oversized=applySceneOperations(scene,[{op:'resize',id:'gallery-salon-door',size:[4,2.8,.16]}]);
 expect(reviewSceneArchitecture(oversized).issues.join(' ')).toContain('does not fit an unglazed host opening');
 expect(()=>applySceneOperations(terra(),[{op:'finish',id:'salon-floor',material:'ivory'}])).not.toThrow();
});
it('respects parent transforms and permits aligned doors after whole-building rotation',()=>{
 const scene=applySceneOperations(terra(),fixes());
 const root={id:'review-root',label:'Transform',kind:'volume' as const,at:[0,0,0] as [number,number,number],size:[1,1,1] as [number,number,number],rotation:.7,material:'ivory' as const,panels:1};
 const moved={...scene,elements:[root,...scene.elements.map(e=>e.parent?e:{...e,parent:root.id})]};
 expect(sceneRelationshipIssues(moved).filter(i=>i.rule.startsWith('door'))).toEqual([]);
});
