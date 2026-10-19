import { afterEach, expect, it, vi } from 'vitest';
import { mansionBlueprintFixture } from '@/lib/v3/__tests__/blueprintFixtures';
import { BLANK_V3_SCENE, compileV3Scene } from '@/lib/v3/scene';
import { executeV3SceneOperations } from '@/lib/v3/operations';
import { auditV3Blueprint } from '@/lib/v3/blueprint';

afterEach(()=>vi.unstubAllGlobals());
it('edits and reloads blueprint references through existing operations and project persistence',async()=>{
  const data=new Map<string,string>();
  const localStorage={getItem:(key:string)=>data.get(key) ?? null,setItem:(key:string,value:string)=>void data.set(key,value),removeItem:(key:string)=>void data.delete(key)};
  vi.stubGlobal('localStorage',localStorage);vi.stubGlobal('window',{localStorage,addEventListener:()=>{}});
  vi.resetModules();
  const {useProjectStore}=await import('../useProjectStore');
  const scene=mansionBlueprintFixture(),plan=structuredClone(scene.estatePlan!);
  plan.blueprint!.buildings[0].role='Primary residence overlooking the pool and sunset lawn';
  const edited=executeV3SceneOperations(scene,{intent:'Clarify spatial hierarchy',operations:[{op:'replaceEstatePlan',estatePlan:plan}]});
  expect(edited.ok).toBe(true);expect(auditV3Blueprint(edited.scene).ok).toBe(true);
  const project=useProjectStore.getState().createProject('Blueprint proof','house','v3-scene');
  useProjectStore.getState().appendVersion(project.id,'Blueprint',JSON.stringify({...BLANK_V3_SCENE,v3Scene:edited.scene}));
  vi.resetModules();
  const restoredStore=(await import('../useProjectStore')).useProjectStore;
  const restored=JSON.parse(restoredStore.getState().getProject(project.id)!.houseConfigJson).v3Scene;
  expect(restored).toEqual(edited.scene);
  expect(compileV3Scene(restored)).toEqual(compileV3Scene(scene));
  expect(Object.keys(restored)).not.toContain('approval');
  expect(Object.keys(restored)).not.toContain('construction');
});
