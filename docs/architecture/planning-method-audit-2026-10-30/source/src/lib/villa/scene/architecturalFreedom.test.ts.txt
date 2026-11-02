import {expect,it} from 'vitest';
import {architecturalFreedomStudy} from './architecturalFreedom.fixture';
import {residentialWingOperations} from './assemblies';
import {wingAssemblySchema} from './assemblyContract';
import {applySceneOperations,validateScene} from './model';
import {sceneRelationshipIssues} from './relationships';
import {sceneSystemPrompt,sceneResponseFormatSchema} from './terra';
import {asSchema} from 'ai';
const wing={id:'varied',at:[0,.1,0],width:12,depth:8,height:3.4,bays:3,roofForm:'hip' as const,roofRise:1.2,overhang:.4,entryBay:1};
it('constructs selected unequal bays with contiguous boundaries and fitted panels; preserves old default geometry',()=>{
 const ops=residentialWingOperations({...wing,bayWidths:[3,4,5]});
 const parts=ops.flatMap(o=>o.op==='add'?[o.element]:[]);
 const walls=[0,1,2].map(i=>parts.find(e=>e.id===`varied-bay-${i}`)!);
 expect(walls.map(e=>e.size[0])).toEqual([3,4,5]);
 expect(walls.map(e=>e.at[0])).toEqual([-4.5,-1,3.5]);
 expect(parts.find(e=>e.id==='varied-glass-1')?.size[0]).toBe(3.55);
 expect(residentialWingOperations(wing)).toEqual(residentialWingOperations({...wing,bayWidths:[4,4,4]}));
 expect(wingAssemblySchema.safeParse({...wing,bayWidths:[3,4,6]}).success).toBe(false);
 expect(wingAssemblySchema.safeParse({...wing,bayWidths:[6,6]}).success).toBe(false);
});
it('exposes bay selection to the real strict provider schema and removes copied composition/numeric defaults',async()=>{
 const schema=await asSchema(await sceneResponseFormatSchema({mode:'generate',prompt:'Tropical home'})).jsonSchema;
 expect(JSON.stringify(schema)).toContain('bayWidths');
 const system=sceneSystemPrompt({mode:'generate',prompt:'Tropical home'});
 expect(system).not.toContain('For example a vertically layered compact residence and a court-led pavilion estate');
 expect(system).not.toContain('id:"studio",at:[0,.1,0]');
 expect(system).toContain('optional construction shortcuts, not design candidates');
});
it('replays an ambitious exterior through normal Generate, reloads, and edits independent facade parts',()=>{
 const study=architecturalFreedomStudy();
 expect(sceneRelationshipIssues(study.scene)).toEqual([]);
 expect(validateScene(JSON.parse(JSON.stringify(study.scene)))).toEqual(study.scene);
 const edited=applySceneOperations(study.scene,[{op:'finish',id:'portal-left',material:'bronze'}]);
 expect(edited.elements.find(e=>e.id==='portal-left')?.material).toBe('bronze');
 expect(edited.elements.filter(e=>e.id!=='portal-left')).toEqual(study.scene.elements.filter(e=>e.id!=='portal-left'));
});
