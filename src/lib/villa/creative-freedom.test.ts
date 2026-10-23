import { describe, expect, it } from 'vitest';
import { creativeExamples } from './creative-examples';
import { buildComposition, executeCompositionPatch, validateComposition } from './composition';
import { compositionSystemPrompt, resolveVillaResult, villaProviderOutputSchema } from './terra';
import { approvedComponents } from './component-record';
import { terraComponents } from './component-registry';
import { pavilionApproachBounds, pavilionBounds } from './experimental/curved-pavilion';

const response=(changes:unknown)=>({changes,summary:'Offline component construction.',unsupported:[]});
describe('brief-responsive property scale and approved component construction (offline)',()=>{
  it('builds substantially different modest, Caribbean and Tuscan compositions without presets',()=>{
    const [family,estate,tuscan]=creativeExamples();
    expect([family,estate,tuscan].map(c=>c.wings.length)).toEqual([1,5,5]);
    const area=(c:typeof family)=>c.wings.reduce((a,w)=>a+w.width*w.depth*w.storeys,0);
    expect(area(estate)).toBeGreaterThan(area(family)*10);
    expect(area(tuscan)).toBeGreaterThan(area(family)*8);
    expect(estate.garden.width*estate.garden.depth).toBeGreaterThan(family.garden.width*family.garden.depth*8);
    expect(tuscan.garden.depth).toBeGreaterThan(estate.garden.depth);
    expect(estate.pool!.width).toBe(28);
    expect(estate.components).toHaveLength(1);expect(family.components).toBeUndefined();expect(tuscan.components).toBeUndefined();
    for(const c of [family,estate,tuscan]) {
      expect(buildComposition(c).wings).toHaveLength(c.wings.length+c.connections.length);
      expect(validateComposition(c)).toEqual(c);
      const result=resolveVillaResult({mode:'generate',prompt:c.name},response(c));
      expect(result.config).toEqual(c);
      expect(villaProviderOutputSchema({mode:'generate',prompt:c.name}).safeParse(response(c)).success).toBe(true);
    }
  });
  it('derives distant fictional grounds across the full placement domain without losing geometry',()=>{
    const c=creativeExamples()[0];
    c.wings[0].x=200;c.wings[0].z=-200;c.pool={x:-200,z:200,width:32,depth:12};c.terraces=[];
    const next=validateComposition(c);
    expect(next.garden.width).toBeGreaterThan(400);expect(next.garden.depth).toBeGreaterThan(400);
    expect(next.wings).toEqual(c.wings);expect(next.pool).toEqual(c.pool);
    expect(()=>validateComposition({...c,siteMode:'fixed',garden:{x:0,z:0,width:40,depth:40}})).toThrow('outside');
  });
  it('pins provider requests to approved versions, excluding experimental and executable geometry',()=>{
    const record=terraComponents()[0];
    expect(record.reference).toEqual({kind:'builder',id:'curved-pavilion@1'});
    expect(approvedComponents([{...record,status:'review'},{...record,validation:{...record.validation,status:'pending'}}])).toEqual([]);
    const c=creativeExamples()[1],schema=villaProviderOutputSchema({mode:'generate',prompt:'estate'});
    expect(schema.safeParse(response({...c,experimentalForms:c.components})).success).toBe(false);
    for(const builder of ['curved-pavilion@2','dome@1']) {
      expect(schema.safeParse(response({...c,components:[{...c.components![0],builder}]})).success).toBe(false);
    }
    expect(schema.safeParse(response({...c,mesh:[1,2,3]})).success).toBe(false);
    expect(schema.safeParse(response({...c,components:[{...c.components![0],code:'execute()'}]})).success).toBe(false);
  });
  it('applies component-only edits atomically while preserving unrelated architecture',()=>{
    const current=creativeExamples()[1],snapshot=structuredClone(current),p=current.components![0];
    const edited=executeCompositionPatch(current,{components:[{type:'adjust',id:p.id,changes:{orientation:35,height:4}}]});
    for(const key of ['wings','connections','terraces','appearance','pool'] as const) expect(edited[key]).toEqual(current[key]);
    expect(edited.components![0]).toMatchObject({orientation:35,height:4});
    expect(current).toEqual(snapshot);
    expect(()=>executeCompositionPatch(current,{components:[{type:'adjust',id:p.id,changes:{x:0,z:-18}}]})).toThrow('clearance');
    expect(current).toEqual(snapshot);
    const removed=executeCompositionPatch(current,{components:[{type:'remove',id:p.id}]});
    expect(removed.components).toEqual([]);
    expect(executeCompositionPatch(removed,{components:[{type:'put',component:p}]})).toEqual(current);
    expect(()=>executeCompositionPatch(current,{components:[{type:'adjust',id:p.id,changes:{builder:'dome@1'}}]})).toThrow();
    expect(()=>executeCompositionPatch(current,{components:[{type:'remove',id:'absent'}]})).toThrow('Unknown component');
  });
  it('includes entry approaches in derived sites and rejects blocked approaches and cross-family IDs',()=>{
    const c=creativeExamples()[0];c.pool=null;c.terraces=[];
    c.components=[{id:'lounge',builder:'curved-pavilion@1',x:20,z:0,orientation:0,width:6,depth:5,height:3,material:'ivory'}];
    const valid=validateComposition(c),p=valid.components![0],approach=pavilionApproachBounds(p);
    expect(valid.garden.z+valid.garden.depth/2).toBeGreaterThanOrEqual(approach.front+3-1e-9);
    const obstruction={...c.wings[0],id:'obstruction',parentId:c.wings[0].id,role:'guest' as const,detached:true,x:20,z:7.3,width:6,depth:4,veranda:0};
    // Roofs are separated, but the 2.4 m pedestrian approach is blocked.
    expect(pavilionBounds(p).front).toBeLessThan(obstruction.z-obstruction.depth/2-.7);
    expect(()=>validateComposition({...c,wings:[...c.wings,obstruction],appearance:{...c.appearance,style:'modern',roof:'flat'}})).toThrow('pedestrian approach');
    expect(()=>validateComposition({...c,components:[{...p,id:c.wings[0].id}]})).toThrow('unique');
    expect(()=>validateComposition({...valid,siteMode:'fixed',garden:{x:15,z:-3,width:34,depth:13}})).toThrow('outside');
  });
  it('retains geometry limits, pool/courtyard clearance, and honest missing-capability instructions',()=>{
    const c=creativeExamples()[1];
    expect(()=>validateComposition({...c,wings:c.wings.map((w,i)=>i===0 ? {...w,width:33} : w)})).toThrow();
    expect(()=>executeCompositionPatch(c,{pool:{z:-18}})).toThrow();
    const prompt=compositionSystemPrompt('generate');
    expect(prompt).toContain('No minimum wing/component count');expect(prompt).toContain('Never silently replace');
    expect(prompt).toContain('curved-pavilion@1');expect(prompt).toContain('future reusable component');
    const same=resolveVillaResult({mode:'edit',prompt:'Add a dome',current:c},{changes:{},summary:'Missing dome roof builder; current estate preserved.',unsupported:['Missing capability: a reusable domed roof with compatible shell and connection validation.']});
    expect(same.config).toEqual(c);
  });
});
