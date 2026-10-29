import {expect,it} from 'vitest';
import {Output} from 'ai';
import {sceneResponseFormatSchema} from './terra';
import {laderaScene} from './example';
it('makes Generate strict-compatible and normalizes null without changing geometry',async()=>{
 const schema=await sceneResponseFormatSchema({mode:'generate',prompt:'A waterfront estate'});
 const format=await Output.object({schema}).responseFormat;
 function check(node:any){if(node.properties){expect(node.additionalProperties).toBe(false);expect(node.required).toEqual(Object.keys(node.properties));Object.values(node.properties).forEach(check);}if(node.items)check(node.items);if(node.anyOf)node.anyOf.forEach(check);expect(node).not.toHaveProperty('default');}
 if(format?.type!=='json')throw Error('JSON schema expected');check(format.schema);
 const element=laderaScene.elements[0];
 const value={name:'Roundtrip',summary:'Offline',unsupported:[],architecturalPlan:{scaleRationale:'A residence',arrivalAndCirculation:'Entry',volumeHierarchy:'Primary and secondary',relationshipsAndViews:'Water',roofFacadeAndMaterials:'Stone',intendedSpaces:['Salon'],programme:[{name:'Salon',zone:'public',strategy:'Ground shared salon',floorIds:['salon-floor'],enclosureIds:['salon-back'],roofIds:['salon-roof'],accessIds:['pivot-door'],limitation:'Access requires review'}],spatialRelationships:null,designDecisions:null},operations:[{op:'add',element:{...element,parent:null,roofForm:null,overhang:null,opening:null}}]};
 const result=await schema.validate!(value);
 if(typeof result==='boolean')throw Error('Structured validation expected');expect(result.success).toBe(true);
 if(result.success){expect(result.value.operations[0]).toEqual({op:'add',element});expect(result.value.architecturalPlan).toHaveProperty('programme');}
});

it('requires programme on new intent-shaped generations while retaining legacy runtime reads',async()=>{
 const schema=await sceneResponseFormatSchema({mode:'generate',prompt:'A residence'});
 const result=await schema.validate!({name:'Missing commitments',summary:'Offline',unsupported:[],operations:[],architecturalPlan:{scaleRationale:'Scale',arrivalAndCirculation:'Entry',volumeHierarchy:'Wings',relationshipsAndViews:'Garden',roofFacadeAndMaterials:'Stone',intendedSpaces:['Suite'],programme:null,spatialRelationships:null,designDecisions:null}});
 if(typeof result==='boolean')throw Error('Structured validation expected');expect(result.success).toBe(false);
});
