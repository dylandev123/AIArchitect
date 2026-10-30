import {expect,it,vi} from 'vitest';
vi.mock('@/lib/library/architecture/service',()=>({generationKnowledge:vi.fn(async(query:string)=>({text:'',evidence:[],project:{brief:query,location:[],style:[]},selected:[],budget:{},metrics:{}}))}));
vi.mock('../design-learning-store',()=>({listDesignLessonSummaries:async()=>[]}));
import {architecturalRequestContext} from './knowledgeContext';
import {resolveSceneResult,sceneMessages,SceneConstructionError} from './terra';
import {validateScene,applySceneOperations} from './model';
import {laderaScene} from './example';
import {useProjectStore} from '@/store/useProjectStore';
const brief='A compact family home in Saint Lucia: 3 bedrooms, 2 bathrooms, north-facing garden; construction budget of about $150,000.';

it('retains the exact brief through generation, JSON reload, targeted edits, project history and Undo/Redo',()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Offline only'));
 const previous=useProjectStore.getState();
 const storage=new Map<string,string>();
 vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)}});
 try{
  const generated=resolveSceneResult({mode:'generate',prompt:brief},{name:laderaScene.name,summary:'Retained construction fixture, not a response to this brief.',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))}).scene;
  expect(generated.generationBrief).toBe(brief);
  const restored=validateScene(JSON.parse(JSON.stringify(generated)));
  const target=restored.elements[0];
  const edited=applySceneOperations(restored,[{op:'finish',id:target.id,material:'sage'}]);
  expect(edited.generationBrief).toBe(brief);
  expect(sceneMessages({mode:'edit',prompt:'Change one finish',current:edited})[0].content[0]).toMatchObject({type:'text',text:expect.stringContaining(brief)});
  useProjectStore.setState({projects:[]});
  const store=useProjectStore.getState(),project=store.createProject('Brief regression','house','direct-scene');
  store.appendVersion(project.id,'Generate',JSON.stringify(restored));
  store.appendVersion(project.id,'Finish',JSON.stringify(edited));
  store.undo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(restored);
  store.redo(project.id);expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(edited);
  expect(storage.size).toBeGreaterThan(0);expect(network).not.toHaveBeenCalled();
 }finally{network.mockRestore();useProjectStore.setState(previous);vi.unstubAllGlobals();}
});

it('uses the original brief during broad development, keeps Refine retrieval scoped and accepts historical scenes',async()=>{
 const current={...laderaScene,generationBrief:brief};
 for(const editIntent of ['complete','redesign'] as const){
  const context=await architecturalRequestContext({mode:'edit',editIntent,prompt:'Improve the chosen design',current});
  expect(context.trace.query).toContain(brief);
  expect(context.trace.query).toContain('current edit takes precedence');
 }
 const scoped=await architecturalRequestContext({mode:'edit',editIntent:'refine',prompt:'Change one window',current});
 expect(scoped.trace.query).toBe('Change one window');
 expect(validateScene(laderaScene)).not.toHaveProperty('generationBrief');
});

it('retains the brief on rejected drafts without changing the original project',()=>{
 const before=JSON.stringify(laderaScene);
 try{
  resolveSceneResult({mode:'generate',prompt:brief},{name:'Bad geometry',summary:'Unsupported elevated floor',unsupported:[],operations:[{op:'add',element:{id:'floating',label:'Floating slab',kind:'plate',at:[0,5,0],size:[5,.2,5]}}]});
  throw Error('Expected construction rejection');
 }catch(error){expect(error).toBeInstanceOf(SceneConstructionError);expect((error as SceneConstructionError).recoverableDraft.generationBrief).toBe(brief);}
 expect(JSON.stringify(laderaScene)).toBe(before);
});
