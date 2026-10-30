import {expect,it} from 'vitest';
import {assertV3LocalPreserved,planV3LocalEdit,validateV3LocalPlan,v3SemanticObjects} from './v3Editing';
import {executeV3SceneOperations} from '@/lib/v3/operations';
import {BLANK_V3_SCENE,type V3Scene,type V3SceneObject} from '@/lib/v3/scene';
const object=(id:string,type:string,x:number):V3SceneObject=>({id,type,label:id.replaceAll('-',' '),semanticRole:id.replaceAll('-',' '),transform:{position:[x,1,0],rotation:[0,0,0],scale:[1,1,1]},dimensions:[1,2,.1],material:{id:'wood',color:'#aaaaaa'},collision:'none'});
const scene=():V3Scene=>({...BLANK_V3_SCENE.v3Scene,objects:[object('front-door','door',0),object('side-door','door',4),object('roof','roof-form',20)]});
it('uses the canonical vocabulary and existing V3 IDs for exact target isolation',()=>{
 const before=scene(),scope=planV3LocalEdit(before,'Change front door material');
 expect(v3SemanticObjects({...before,objects:[object('garden','landscape-zone',30),object('bed','planter',40),object('custom','future-semantic-object',50)]}).map(o=>o.type)).toEqual(['garden','planting-bed','mass']);
 expect(v3SemanticObjects(before)[0].type).toBe('front-door');expect(scope.ids).toEqual(['front-door']);
 const plan={intent:'Door finish',operations:[{op:'changeMaterial',target:'front-door',material:{id:'blue',color:'#0000ff'}}]};
 validateV3LocalPlan(before,plan,scope);
 const next=structuredClone(before);next.objects[0].material={id:'blue',color:'#0000ff'};
 expect(()=>assertV3LocalPreserved(before,next,scope)).not.toThrow();
 next.objects[2].material={id:'blue',color:'#0000ff'};
 expect(()=>assertV3LocalPreserved(before,next,scope)).toThrow('Unrequested');
 expect(()=>validateV3LocalPlan(before,{...plan,operations:[...plan.operations,{op:'delete',target:'roof'}]},scope)).toThrow('scope');
 expect(before.objects[0].material.color).toBe('#aaaaaa');
});
it('refuses ambiguous, invented and incomplete V3 targets before mutation',()=>{
 const before=scene();
 expect(()=>planV3LocalEdit(before,'Change door material')).toThrow('Choose a specific');
 expect(()=>planV3LocalEdit(before,'Change selected material',['invented'])).toThrow('no longer exists');
 expect(()=>planV3LocalEdit(before,'Change front door material',['roof'])).toThrow('conflicts');
 const scope=planV3LocalEdit(before,'Resize front door');
 expect(()=>validateV3LocalPlan(before,{intent:'Bad',operations:[{op:'resize',target:'front-door'}]},scope)).toThrow();
 expect(()=>validateV3LocalPlan(before,{intent:'Bad',operations:[{op:'editArchitecture',target:'front-door',architecture:{width:2,id:'spoof'}}]},scope)).toThrow('protected architecture');
 expect(()=>validateV3LocalPlan(before,{intent:'Bad',operations:[{op:'editArchitecture',target:'front-door',architecture:{x:50}}]},scope)).toThrow('unrequested field');
});
it('widens connectors without changing endpoints or unrelated properties',()=>{
 const before=scene();before.objects.push({...object('stair','stair',10),fromSupportId:'lower',toSupportId:'upper'});
 const scope=planV3LocalEdit(before,'Make staircase wider');
 const next=structuredClone(before);next.objects[3].dimensions[0]=2;
 expect(()=>assertV3LocalPreserved(before,next,scope)).not.toThrow();
 next.objects[3].toSupportId='roof';expect(()=>assertV3LocalPreserved(before,next,scope)).toThrow();
});
it('rejects whole-site replacements and detects unrelated normalization changes',()=>{
 const before=scene(),scope=planV3LocalEdit(before,'Move front door');
 expect(()=>validateV3LocalPlan(before,{intent:'Bad',operations:[{op:'replaceSiteHierarchy',hierarchy:{}}]},scope)).toThrow();
 const next=structuredClone(before);next.site.width+=1;expect(()=>assertV3LocalPreserved(before,next,scope)).toThrow('outside objects');
});
it('keeps the established V3 executor atomic on malformed edits',()=>{
 const before=scene(),snapshot=JSON.stringify(before);
 const result=executeV3SceneOperations(before,{intent:'Malformed',operations:[{op:'changeMaterial',target:'front-door',material:{id:'blue',color:'#0000ff'}},{op:'move',target:'invented',position:[0,0,0]}]});
 expect(result.ok).toBe(false);expect(result.scene).toEqual(before);expect(JSON.stringify(before)).toBe(snapshot);
});
