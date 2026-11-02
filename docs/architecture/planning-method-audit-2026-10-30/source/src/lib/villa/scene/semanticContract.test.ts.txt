import {readFileSync} from 'node:fs';
import {expect,it,vi} from 'vitest';
import {zodSchema} from 'ai';
import {DIRECT_SCENE_KINDS,OBJECT_TYPES} from '@/lib/semantic/vocabulary';
import {elementFieldsSchema,elementSchema,stageSceneOperations,validateScene} from './model';
import {sceneResponseFormatSchema,sceneResultSchema} from './terra';
import {structuralRefinementMock} from './structuralRefinement.fixture';
import {useProjectStore} from '@/store/useProjectStore';
import {stageGenerationRefinement} from './generationReview';
const read=(name:string)=>JSON.parse(readFileSync(`docs/architecture/retained-visual-review/${name}`,'utf8'));
const original=()=>validateScene(read('original.scene.json'));
it('reproduces the paid schema hole and refuses the exact invalid response without guessing',()=>{
 const raw=read('raw-candidate.operations.json');
 const response=read('refine.provider-response.txt');
 const text=response.output.flatMap((item:{content?:Array<{type:string;text?:string}>})=>item.content??[]).find((item:{type:string})=>item.type==='output_text').text;
 expect(JSON.parse(text)).toEqual(raw);
 const edge=raw.operations.find((o:{element?:{id:string}})=>o.element?.id==='rear-loggia-canopy-edge').element;
 expect(elementFieldsSchema.parse(edge).semanticType).toBe('material');
 expect(DIRECT_SCENE_KINDS.material).toBeUndefined();
 expect(()=>sceneResultSchema.parse(raw)).toThrow('material is incompatible');
 expect(()=>stageGenerationRefinement(original(),read('refine.input.json').review,raw)).toThrow('material is incompatible');
});
it('derives every provider branch from renderer support and constructs every supported pair',async()=>{
 const schema=await zodSchema(elementSchema).jsonSchema as {anyOf:Array<{properties:{kind:{const:string};semanticType:{enum?:string[];const?:string}}}>};
 for(const branch of schema.anyOf){
  const kind=branch.properties.kind.const;
  const expected=OBJECT_TYPES.filter(t=>DIRECT_SCENE_KINDS[t]?.includes(kind));
  expect(branch.properties.semanticType.enum??[branch.properties.semanticType.const]).toEqual(expected);
  for(const semanticType of expected){
   const element={id:'supported',label:'Supported fixture',kind,semanticType,at:[0,.5,0],size:kind==='pavilion'?[6,3,5]:[1,1,1]};
   const output={name:'Fixture',summary:'Supported edit',unsupported:[],operations:[{op:'add',element}]};
   const parsed=sceneResultSchema.parse(output);
   const next=stageSceneOperations({version:'architectural-scene-1',name:'Fixture',elements:[]},parsed.operations);
   expect(next.elements[0]).toMatchObject({id:'supported',kind,semanticType});
  }
 }
 expect(()=>elementSchema.parse({id:'unknown',label:'Unknown',kind:'volume',semanticType:'canopy-edge',at:[0,0,0],size:[1,1,1]})).toThrow('incompatible');
});
it('constructs a labelled equivalent but retains the genuine subsequent collision gate atomically',()=>{
 const scene=original(),snapshot=JSON.stringify(scene),fixture=read('raw-candidate.operations.json');
 fixture.operations.find((o:{element?:{id:string}})=>o.element?.id==='rear-loggia-canopy-edge').element.semanticType='mass';
 const constructed=stageSceneOperations(scene,sceneResultSchema.parse(fixture).operations);
 expect(constructed.elements.find(e=>e.id==='rear-loggia-canopy-edge')).toMatchObject({semanticType:'mass',kind:'volume'});
 expect(()=>stageGenerationRefinement(scene,read('refine.input.json').review,fixture)).toThrow('New collision between dining-post-west-front and main-floor');
 expect(JSON.stringify(scene)).toBe(snapshot);
});

it('commits supported semantic geometry through refinement, reload and Undo/Redo',()=>{
 const data=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
 const {scene,review,output}=structuralRefinementMock();
 for(const op of output.operations) if(op.op==='add' && op.element){
  Object.assign(op.element,{semanticType:op.element.kind==='roof'?'roof':op.element.kind==='screen'?'wall':'mass'});
 }
 const staged=stageGenerationRefinement(scene,review,output);
 const project=useProjectStore.getState().createProject('Semantic contract fixture','villa');
 const store=useProjectStore.getState();
 store.appendVersion(project.id,'Original',JSON.stringify(scene));
 store.appendVersion(project.id,'Semantic edit',JSON.stringify(staged.scene));
 const reload=()=>validateScene(JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson));
 expect(reload()).toEqual(staged.scene);
 store.undo(project.id);expect(reload()).toEqual(scene);
 store.redo(project.id);expect(reload()).toEqual(staged.scene);
 const edited=stageSceneOperations(reload(),[{op:'resize',id:'entry-west-pier',size:[.4,2.8,.3]}]);
 expect(edited.elements.find(e=>e.id==='entry-west-pier')!.size[0]).toBe(.4);
});
it('offers identical supported element branches in Generate, Refine and Redesign',async()=>{
 for(const input of [{mode:'generate' as const,prompt:'Fixture'},{mode:'edit' as const,editIntent:'refine' as const,prompt:'Fixture',current:original()},{mode:'edit' as const,editIntent:'redesign' as const,prompt:'Fixture',current:original()}]){
  const response=await sceneResponseFormatSchema(input);
  const wire=JSON.stringify('jsonSchema' in response ? response.jsonSchema : await zodSchema(response).jsonSchema);
  expect(wire).toContain('semanticType');
  expect(wire).not.toContain('"lighting","material"');
 }
});
