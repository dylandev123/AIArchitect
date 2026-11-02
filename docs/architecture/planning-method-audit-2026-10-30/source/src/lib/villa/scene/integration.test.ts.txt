import { describe, it, expect } from 'vitest';
import { laderaScene } from './example';
import { applySceneOperations, scenePavilionPlacement, validateScene } from './model';
import { pavilionPlacementSchema } from '../experimental/curved-pavilion';
import { stageSceneReviewEdit, visualReviewRequestSchema, reviewInstructions } from '../visual-review';
import { sceneMessages, sceneRequestSchema, SCENE_SYSTEM_PROMPT } from './terra';
import { learningContext } from '../design-learning';

describe('primary scene capability integration',()=>{
 it('reuses the approved curved geometry bounds without legacy site placement limits',()=>{
  const scene=applySceneOperations(laderaScene,[{op:'add',element:{id:'curved-lounge',kind:'pavilion',label:'Curved lounge',at:[800,30,200],rotation:.423,size:[8,3.5,6],material:'limestone'}}]);
  const element=scene.elements.at(-1)!;
  expect(scenePavilionPlacement(element)).toEqual(pavilionPlacementSchema.parse({id:'scene-pavilion',builder:'curved-pavilion@1',x:0,z:0,orientation:0,width:8,height:3.5,depth:6,material:'limestone'}));
  expect(validateScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  expect(()=>applySceneOperations(scene,[{op:'resize',id:element.id,size:[5,3.5,6]}])).toThrow();
  expect(()=>applySceneOperations(scene,[{op:'finish',id:element.id,material:'bronze'}])).toThrow();
  expect(laderaScene.elements.some(e=>e.id===element.id)).toBe(false);
 });
 it('reviews reference-aware direct scenes and stages scoped operations without mutating the original',()=>{
  const instructions=reviewInstructions(laderaScene);expect(instructions).toContain(SCENE_SYSTEM_PROMPT);
  const index=laderaScene.elements.findIndex(e=>e.id==='suite-screen');
  const output={name:laderaScene.name,summary:'Material study',unsupported:[],operations:[{op:'finish',id:'suite-screen',material:'limestone'}]};
  const next=stageSceneReviewEdit(laderaScene,'Material study',output,[`elements.${index}.material`]);
  expect(next.scene.elements[index].material).toBe('limestone');
  expect(next.scene.elements.filter(e=>e.id!=='suite-screen')).toEqual(laderaScene.elements.filter(e=>e.id!=='suite-screen'));
  expect(()=>stageSceneReviewEdit(laderaScene,'Bad scope',output,['elements.0.material'])).toThrow();
  expect(()=>stageSceneReviewEdit(laderaScene,'Remove',{...output,operations:[{op:'remove',id:'suite-screen'}]},[`elements.${index}.material`])).toThrow();
  expect(visualReviewRequestSchema.shape.current.parse(laderaScene)).toEqual(laderaScene);
 });
 it('keeps reference input optional, bounded and on the scene contract',()=>{
  const input=sceneRequestSchema.parse({prompt:'Interpret image',mode:'generate',reference:{source:'concept.png',image:'data:image/png;base64,aGVsbG8='}});
  expect(sceneMessages(input)[0].content.at(-1)).toEqual({type:'image',image:input.reference!.image});
  expect(()=>sceneRequestSchema.parse({...input,reference:{source:'bad',image:'https://remote.test/image.png'}})).toThrow();
 });
 it('retrieves only reviewed non-mock principles; never imports old geometry',()=>{
  const row={brief:'Tropical villa shade',verdict:'improved' as const,feedback:'Use deep tropical shade for the outdoor terrace.',origin:'terra' as const,referenceCompared:true,changedFields:['elements.0.size.0']};
  expect(learningContext([row],'Tropical villa shade')).toContain(row.feedback);
  expect(learningContext([{...row,origin:'mock'}],'Tropical villa shade')).toBe('');
 });
});
