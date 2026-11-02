import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { operationSchema, stageSceneOperations, type SceneOperation } from './model';
import { assemblyOperations } from './assemblies';
import { assertGenerateConstruction } from './generationSafety';
import { reviewProgramme } from './programme';
import { resolveSceneResult, sceneSystemPrompt } from './terra';
const assembly = (id:string, x=0):SceneOperation => operationSchema.parse({op:'assemble',assembly:{kind:'residential-wing',parameters:{id,at:[x,.1,0],width:12,depth:8,height:3.4,bays:3,roofForm:'flat',roofRise:1,overhang:.4}}});
const erase = (op:SceneOperation):SceneOperation[] => op.op === 'assemble' ? assemblyOperations(op.assembly).filter(o=>o.op==='add').reverse().map(o=>({op:'remove',id:o.op==='add'?o.element.id:''})) : [];
const output = (operations:SceneOperation[])=>({name:'Draft',summary:'Incomplete residence draft',unsupported:['Rooms remain incomplete.'],operations});
describe('Generate final construction contract',()=>{
 it('diagnoses the exact retained Sol loop before expansion budget failure',()=>{
  const retained=JSON.parse(readFileSync('.data/sol-high-background/comparison-2/validated-output.json','utf8'));
  const operations=retained.operations.map((o:unknown)=>operationSchema.parse(o));
  expect(()=>stageSceneOperations({version:'architectural-scene-1',name:'empty',elements:[]},operations)).toThrow('Expanded assembly operation budget exceeded');
  expect(()=>resolveSceneResult({mode:'generate',prompt:'House'},retained)).toThrow(/construction loop/);
 });
 it('permits distinct wings, one replacement, and retains programme references',()=>{
  const a=assembly('first'), b=assembly('selected');
  expect(()=>assertGenerateConstruction([a,...erase(a),b])).not.toThrow();
  expect(()=>assertGenerateConstruction([a,assembly('second',20),assembly('third',40)])).not.toThrow();
  const programme=[{name:'Living',zone:'public',strategy:'Selected wing',floorIds:['selected'],enclosureIds:['selected-rear'],roofIds:['selected-roof'],accessIds:[],limitation:'Access and rooms incomplete.'}];
  const scene=resolveSceneResult({mode:'generate',prompt:'House'},{...output([b]),architecturalPlan:{programme}}).scene;
  expect((scene.architecturalPlan as {programme:unknown}).programme).toEqual(programme);
  expect(reviewProgramme(scene).spaces[0].allocation[0].id).toBe('selected');
  expect(scene.elements.some(e=>e.id==='selected')).toBe(true);
 });
 it('rejects repeated deletion, identical overlap and empty final geometry',()=>{
  const a=assembly('first'),b=assembly('second'),c=assembly('third');
  expect(()=>assertGenerateConstruction([a,...erase(a),b,...erase(b),c])).toThrow(/two complete deletions/);
  expect(()=>assertGenerateConstruction([a,b,c])).toThrow(/overlap/);
  expect(()=>resolveSceneResult({mode:'generate',prompt:'House'},output([a,...erase(a)]))).toThrow(/retained no editable construction/);
 });
 it('preserves legitimate removal-only edits',()=>{
  const a=assembly('first');const scene=stageSceneOperations({version:'architectural-scene-1',name:'House',elements:[]},[a]);
  expect(resolveSceneResult({mode:'edit',prompt:'Remove shell',current:scene},output(erase(a))).scene.elements).toEqual([]);
  expect(sceneSystemPrompt({mode:'generate',prompt:'House'})).toContain('never a scratchpad');
  expect(sceneSystemPrompt({mode:'edit',prompt:'Edit',current:scene})).not.toContain('never a scratchpad');
 });
});
