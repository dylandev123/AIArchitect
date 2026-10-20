import { afterEach,expect,it,vi } from 'vitest';
import { fullPropertyBlueprint } from '@/lib/v3/parity/fullPropertyBlueprint';
import { generateV3FromArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprintGeneration';
import { checkoutV3ArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprint';
import { BLANK_V3_SCENE,compileV3Scene } from '@/lib/v3/scene';
import { executeV3SceneOperations } from '@/lib/v3/operations';

afterEach(()=>vi.unstubAllGlobals());
it('saves an authored full property to the existing project store and preserves another saved project',async()=>{
  const data=new Map<string,string>(),localStorage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>void data.set(k,v),removeItem:(k:string)=>void data.delete(k)};
  vi.stubGlobal('localStorage',localStorage);vi.stubGlobal('window',{localStorage,addEventListener:()=>{}});vi.resetModules();
  const {useProjectStore}=await import('../useProjectStore');
  const existing=useProjectStore.getState().createProject('Existing saved project','house','v3-scene');
  const previous=JSON.stringify(useProjectStore.getState().getProject(existing.id));
  const built=await generateV3FromArchitecturalBlueprint('Curved residence',async()=>({output:fullPropertyBlueprint()}));expect(built.ok).toBe(true);
  const edited=executeV3SceneOperations(built.scene!,{intent:'Local finish',operations:[{op:'changeMaterial',target:'orchard-atelier',material:{id:'ochre',color:'#c49a68',surface:'stucco'}}]});expect(edited.ok).toBe(true);
  const project=useProjectStore.getState().createProject('Full-property construction','house','v3-scene');
  useProjectStore.getState().appendVersion(project.id,'Constructed blueprint',JSON.stringify({...BLANK_V3_SCENE,v3Scene:edited.scene}));
  vi.resetModules();const store=(await import('../useProjectStore')).useProjectStore.getState(),restored=store.getProject(project.id)!;
  expect(JSON.stringify(store.getProject(existing.id))).toBe(previous);
  const scene=JSON.parse(restored.houseConfigJson).v3Scene;
  expect(compileV3Scene(scene)).toEqual(compileV3Scene(edited.scene));expect(checkoutV3ArchitecturalBlueprint(scene).ok).toBe(true);
  expect(scene.objects[0].composition.assemblies[0].id).toBe('arc-balcony');
  expect(scene.objects.find((o:{id:string})=>o.id==='poolside-shade').canopyStyle).toBe('slatted');
},20_000);
