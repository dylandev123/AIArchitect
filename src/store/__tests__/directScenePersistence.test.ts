import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '../useProjectStore';
import { laderaScene } from '@/lib/villa/scene/example';
import { applySceneOperations } from '@/lib/villa/scene/model';
import { resolveProjectGenerationMode } from '@/lib/v3/projectMode';

describe('direct scenes in normal project history',()=>{
 beforeEach(()=>{const data=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});useProjectStore.setState({projects:[]});});
 it('creates, edits one roof, undoes, redoes and serializes without format conversion',()=>{
  const store=useProjectStore.getState();
  const project=store.createProject('Ladera','villa');
  expect(resolveProjectGenerationMode(project)).toBe('direct-scene');
  store.appendVersion(project.id,'Generated Ladera',JSON.stringify(laderaScene));
  const edited=applySceneOperations(laderaScene,[{op:'resize',id:'bridge-roof',size:[17,.3,10]}]);
  store.appendVersion(project.id,'Extend roof',JSON.stringify(edited));
  store.undo(project.id);expect(JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson)).toEqual(laderaScene);
  store.redo(project.id);expect(JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson)).toEqual(edited);
  expect(edited.elements.filter(e=>e.id!=='bridge-roof')).toEqual(laderaScene.elements.filter(e=>e.id!=='bridge-roof'));
  const saved=JSON.parse(JSON.stringify(useProjectStore.getState().getProject(project.id)));
  expect(resolveProjectGenerationMode(saved)).toBe('direct-scene');expect(saved.versions).toHaveLength(3);
  expect(()=>store.appendVersion(project.id,'Invalid legacy replacement','{}')).toThrow();
  expect(useProjectStore.getState().getProject(project.id)!.houseConfigJson).toBe(JSON.stringify(edited));
 });
});
