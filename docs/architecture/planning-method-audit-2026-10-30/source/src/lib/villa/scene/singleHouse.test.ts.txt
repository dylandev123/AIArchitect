import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,it,vi} from 'vitest';
import {validateScene,stageSceneOperations} from './model';
import {sceneResultSchema} from './terra';
import {stageGenerationRefinement} from './generationReview';
import {assertSceneEditPreserved} from './semanticEditing';
import {compareSceneEvidence} from './visualEvidence';
import {sceneSpatialGeometry} from './spatial';
import {useProjectStore} from '@/store/useProjectStore';
const root='docs/architecture/';
const read=(path:string)=>JSON.parse(readFileSync(root+path,'utf8'));
const original=()=>validateScene(read('retained-visual-review/original.scene.json'));
const output=()=>sceneResultSchema.parse(read('single-house/diagnostic.operations.json'));
const review=()=>read('retained-visual-review/refine.input.json').review;
it('keeps original family bytes and unsupported paid output unchanged',()=>{
 for(const path of ['retained-visual-review/original.scene.json','generation-quality/final-family/scene.json']) expect(createHash('sha256').update(readFileSync(root+path)).digest('hex')).toBe('b76ed99bad6f6bda1c1e6f233ef9d65e9b01b0c1c0687f97e488dc44feadf983');
 expect(()=>stageGenerationRefinement(original(),review(),read('retained-visual-review/raw-candidate.operations.json'))).toThrow('material is incompatible');
});
it('replays the complete corrected geometry but retains metadata/evidence rejection atomically',()=>{
 const scene=original(),before=JSON.stringify(scene),o=output();
 expect(stageSceneOperations(scene,o.operations)).toEqual(validateScene(read('single-house/construction.scene.json')));
 expect(()=>stageGenerationRefinement(scene,review(),o)).toThrow('Refinement introduced construction findings');
 expect(JSON.stringify(scene)).toBe(before);
 const diff=compareSceneEvidence(scene,stageSceneOperations(scene,o.operations));
 expect(diff.introduced).toEqual([]);
 expect(diff.introducedAuditWarnings.some(s=>s.includes('garden-door missing'))).toBe(true);
 expect(diff.introducedAuditWarnings.some(s=>s.includes('Entry vestibule'))).toBe(true);
});
it('proves exact slab/canopy seating while preserving plan positions',()=>{
 const scene=stageSceneOperations(original(),output().operations),g=sceneSpatialGeometry(scene);
 for(const e of scene.elements.filter(e=>e.id.startsWith('dining-post-'))){
  expect(g.bottom(e)).toBeCloseTo(.15);expect(g.top(e)).toBeCloseTo(g.bottom(g.map.get('dining-canopy')!));
 }
 expect(g.top(g.map.get('rear-loggia-canopy-edge')!)).toBeCloseTo(g.bottom(g.map.get('main-roof')!));
});
it('still blocks the original new slab penetration instead of exempting posts',()=>{
 const scene=original(),o=output();
 const operations=o.operations.filter(op=>!(op.op==='resize'&&op.id==='dining-post-west-front')).map(op=>op.op==='move'&&op.id==='dining-post-west-front'?{...op,at:[op.at[0],1.65,op.at[2]] as [number,number,number]}:op);
 expect(()=>stageGenerationRefinement(scene,review(),{...o,operations})).toThrow('New collision between dining-post-west-front and main-floor');
});
it('preserves every unrelated element and metadata through the normal edit preservation check',()=>{
 const scene=original(),next=stageSceneOperations(scene,output().operations),r=review().refinement;
 assertSceneEditPreserved(scene,next,{targetIds:[...r.targetIds,...r.newIds],creationIds:r.newIds,fields:['at','size'],operations:['add','remove','move','resize']});
 for(const e of scene.elements.filter(e=>!r.targetIds.includes(e.id)))expect(next.elements.find(n=>n.id===e.id)).toEqual(e);
 expect(next.architecturalPlan).toEqual(scene.architecturalPlan);
});
it('roundtrips diagnostic-only versions and Undo/Redo; every retained primitive remains editable',()=>{
 const data=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 try{
 const scene=original(),next=stageSceneOperations(scene,output().operations),store=useProjectStore.getState();
 const project=store.createProject('REJECTED single-house diagnostic TEST ONLY','villa');
 store.appendVersion(project.id,'Original',JSON.stringify(scene));store.appendVersion(project.id,'Rejected diagnostic',JSON.stringify(next));
 const reload=()=>validateScene(JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson));
 expect(reload()).toEqual(next);store.undo(project.id);expect(reload()).toEqual(scene);store.redo(project.id);expect(reload()).toEqual(next);
 for(const element of next.elements){const edited=stageSceneOperations(reload(),[{op:'finish',id:element.id,material:element.material==='timber'?'ivory':'timber'}]);expect(edited.elements.find(e=>e.id===element.id)?.material).not.toBe(element.material);expect(edited.elements.filter(e=>e.id!==element.id)).toEqual(next.elements.filter(e=>e.id!==element.id));}
 }finally{vi.unstubAllGlobals();}
});
