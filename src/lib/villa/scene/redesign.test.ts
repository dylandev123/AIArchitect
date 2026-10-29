import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import {developmentRequest} from './twoStage';
import {sceneSystemPrompt,sceneRequestSchema,resolveSceneResult,SceneConstructionError} from './terra';
import {validateScene} from './model';
import {sceneRelationshipIssues} from './relationships';
import {useProjectStore} from '@/store/useProjectStore';
const dir='docs/villa-playground/redesign-audit';
const load=(name:string,kind:string)=>JSON.parse(readFileSync(`${dir}/${name}.${kind}.json`,'utf8'));
afterEach(()=>vi.unstubAllGlobals());
it('defaults ordinary edits to refinement and explicitly authorizes redesign without changing transaction safety',()=>{
 const current=validateScene(load('study','before'));
 const ordinary=sceneRequestSchema.parse({mode:'edit',prompt:'Resize a window',current});
 expect(sceneSystemPrompt(ordinary)).toContain('REFINE MODE: Preserve the existing composition');
 const request=developmentRequest(current,'Reorganize the inadequate house',{intent:'redesign'});
 expect(request.editIntent).toBe('redesign');
 expect(request.prompt).not.toContain('Do not replace the house');
 expect(sceneSystemPrompt(request)).toContain('You may replace, remove, reorganize');
 expect(sceneSystemPrompt(request)).toContain('All operation and geometry safety budgets still apply');
 expect(developmentRequest(current,'Revise massing',{recompose:true}).editIntent).toBe('redesign');
 expect(developmentRequest(current,'Fix door').editIntent).toBe('refine');
});
it.each(['relocated-suite','study','developed-study'])('executes %s, preserves original and unrelated data, reloads versions, undoes and recovers offline',async name=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Network forbidden'));
 try{
 const data=new Map<string,string>();
 vi.stubGlobal('window',{addEventListener:()=>{},localStorage:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v),removeItem:(k:string)=>data.delete(k)}});
 useProjectStore.setState({projects:[]});
 const before=validateScene({...load(name,'before'),terrain:{width:100,depth:100,elevation:0,grade:0,fall:'z'}});
 const snapshot=JSON.stringify(before),operations=load(name,'operations');
 const input=developmentRequest(before,'Redesign main residence',{intent:'redesign'});
 const output={name:before.name,architecturalPlan:JSON.parse(readFileSync('docs/villa-playground/redesign-live/concept-only.NOT-CONSTRUCTED.json','utf8')).architecturalPlan,summary:'Offline authored architectural redesign',unsupported:['Vertical access and completeness unverified'],operations};
 const result=resolveSceneResult(input,output);
 expect(sceneRelationshipIssues(result.scene)).toEqual([]);
 expect(result.scene.terrain).toEqual(before.terrain);
 for(const id of load(name,'audit').retainedUnchangedIds)expect(result.scene.elements.find(e=>e.id===id)).toEqual(before.elements.find(e=>e.id===id));
 if(name!=='relocated-suite')for(const id of ['salon-floor','salon-roof','west-wing-floor','east-wing-floor','entry-door'])expect(result.scene.elements.find(e=>e.id===id)).toBeDefined();
 const store=useProjectStore.getState(),project=store.createProject('Retained mansion','house','direct-scene');
 store.appendVersion(project.id,'Original',snapshot);
 const originalProject=useProjectStore.getState().getProject(project.id)!;
 store.appendVersion(project.id,'Architectural redesign',JSON.stringify(result.scene));
 const revised=useProjectStore.getState().getProject(project.id)!;
 for(const key of Object.keys(originalProject) as (keyof typeof revised)[])if(!['houseConfigJson','versions','currentVersionIndex','updatedAt'].includes(key))expect(revised[key]).toEqual(originalProject[key]);
 expect(revised.versions[1].houseConfigJson).toBe(snapshot);
 const saved=new Map(data);useProjectStore.setState({projects:[]});for(const [k,v] of saved)data.set(k,v);
 await useProjectStore.persist.rehydrate();
 expect(JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson)).toEqual(JSON.parse(JSON.stringify(result.scene)));
 store.undo(project.id);expect(useProjectStore.getState().getProject(project.id)!.houseConfigJson).toBe(snapshot);
 store.redo(project.id);expect(useProjectStore.getState().getProject(project.id)!.houseConfigJson).toBe(JSON.stringify(result.scene));
 const floor=result.scene.elements.find(e=>e.kind==='plate')!;
 try{resolveSceneResult(input,{...output,operations:[...operations,{op:'move',id:floor.id,at:[99,80,99]}]});throw Error('Expected validation failure');}
 catch(error){expect(error).toBeInstanceOf(SceneConstructionError);const draft=(error as SceneConstructionError).recoverableDraft;expect(()=>validateScene(JSON.parse(JSON.stringify(draft)))).not.toThrow();expect(sceneRelationshipIssues(draft).length).toBeGreaterThan(0);}
 expect(JSON.stringify(before)).toBe(snapshot);
 expect(useProjectStore.getState().getProject(project.id)!.houseConfigJson).toBe(JSON.stringify(result.scene));
 expect(resolveSceneResult(input,output).scene).toEqual(result.scene);
 expect(network).not.toHaveBeenCalled();
 }finally{network.mockRestore();}
});
