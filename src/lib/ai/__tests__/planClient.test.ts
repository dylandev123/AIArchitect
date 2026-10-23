import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const storage=new Map<string,string>();
beforeEach(()=>{
  storage.clear();vi.resetModules();
  const localStorage={getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>{storage.set(key,value);},removeItem:(key:string)=>{storage.delete(key);}};
  vi.stubGlobal('localStorage',localStorage);vi.stubGlobal('window',{localStorage,addEventListener:()=>{}});
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
const recovery={rawResponse:' \n{"format":"invalid"}\n',sha256:'offline-capture-id',bytes:24,redacted:false};

it.each([
  ['provider','provider_429','Provider failure (HTTP 429).'],
  ['parsing','invalid_json','Parsing failure: invalid JSON.'],
  ['schema','plan_schema','Schema failure: fields do not match.'],
  ['geometry','plan_geometry','Geometric planning failure: the plan needs correction.'],
])('passes %s diagnostics to both normal UI error handlers without altering projects',async(category,code,message)=>{
  const {useProjectStore}=await import('@/store/useProjectStore');
  const {requestPlanEvaluation,PlanEvaluationError}=await import('../planClient');
  const store=useProjectStore.getState(),project=store.createProject('Failed request','house','v3-scene'),before=structuredClone(store.projects);
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:message,failure:{category,code},failureId:'offline-reference'},{status:502})));
  try{await requestPlanEvaluation(project.id,'design','Estate');throw Error('Expected rejection');}
  catch(error){
    expect(error).toBeInstanceOf(PlanEvaluationError);
    const failure=error as InstanceType<typeof PlanEvaluationError>;
    expect(String(failure)).toContain(message);expect(String(failure)).toContain('Diagnostic reference: offline-reference');
    expect(failure.failure).toEqual({category,code});expect(failure.recovery).toBeUndefined();
  }
  expect(store.projects).toEqual(before);expect(fetch).toHaveBeenCalledTimes(1);
});

it('retains the response when a concurrent project edit prevents applying a success',async()=>{
  const {useProjectStore}=await import('@/store/useProjectStore');
  const {requestPlanEvaluation}=await import('../planClient');
  const store=useProjectStore.getState(),project=store.createProject('Concurrent evaluation','house','v3-scene');
  let concurrentlySaved='';
  vi.stubGlobal('fetch',vi.fn(async()=>{
    const root=JSON.parse(project.houseConfigJson);root.v3Scene.metadata.brief='Concurrent local edit';
    concurrentlySaved=JSON.stringify(root);store.appendVersion(project.id,'Local edit',concurrentlySaved);
    return Response.json({json:project.houseConfigJson,summary:'2D plan',recovery});
  }));
  await expect(requestPlanEvaluation(project.id,'design','An estate')).rejects.toThrow(/changed/i);
  expect(store.getProject(project.id)!.houseConfigJson).toBe(concurrentlySaved);
  expect(JSON.parse(storage.get(`ai-architect-plan-response:${recovery.sha256}`)!)).toEqual(recovery);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('keeps rejection downloadable when browser storage is full and preserves every project',async()=>{
  const {useProjectStore}=await import('@/store/useProjectStore');
  const {requestPlanEvaluation,PlanEvaluationError}=await import('../planClient');
  const store=useProjectStore.getState(),project=store.createProject('Rejected evaluation','house','v3-scene');
  const before=structuredClone(useProjectStore.getState().projects);
  vi.stubGlobal('localStorage',{setItem:()=>{throw Error('Storage full');}});
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:'Rejected',recovery},{status:422})));
  try{await requestPlanEvaluation(project.id,'design','An estate');throw Error('Expected rejection');}
  catch(error){expect(error).toBeInstanceOf(PlanEvaluationError);expect((error as InstanceType<typeof PlanEvaluationError>).recovery).toEqual(recovery);}
  expect(useProjectStore.getState().projects).toEqual(before);expect(fetch).toHaveBeenCalledTimes(1);
});

it('identifies a successful provider response followed by a failed browser save, retains recovery, and restores project state',async()=>{
  const {useProjectStore,PROJECT_STORAGE_KEY}=await import('@/store/useProjectStore');
  const {requestPlanEvaluation,PlanEvaluationError}=await import('../planClient');
  const store=useProjectStore.getState(),project=store.createProject('Storage failure','house','v3-scene');
  const before=structuredClone(useProjectStore.getState().projects);
  const persisted=storage.get(PROJECT_STORAGE_KEY);
  const originalSet=window.localStorage.setItem;
  vi.spyOn(window.localStorage,'setItem').mockImplementation((key,value)=>{
    if(key===PROJECT_STORAGE_KEY)throw new DOMException('The quota has been exceeded.','QuotaExceededError');
    originalSet(key,value);
  });
  const root=JSON.parse(project.houseConfigJson);root.v3Scene.metadata.brief='Completed response';
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({json:JSON.stringify(root),summary:'Plan saved',recovery})));
  try{await requestPlanEvaluation(project.id,'design','Estate');throw Error('Expected storage failure');}
  catch(error){
    expect(error).toBeInstanceOf(PlanEvaluationError);
    const failure=error as InstanceType<typeof PlanEvaluationError>;
    expect(failure.message).toContain('OpenAI completed the plan');
    expect(failure.message).toContain('Do not generate again');
    expect(failure.failure).toEqual({category:'browser-storage',code:'browser_storage_quota'});
    expect(failure.recovery).toEqual(recovery);
  }
  expect(useProjectStore.getState().projects).toEqual(before);
  expect(storage.get(PROJECT_STORAGE_KEY)).toBe(persisted);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it('saves a default exterior handoff as editable V3, supports undo, and reloads the finished property',async()=>{
  const {useProjectStore}=await import('@/store/useProjectStore');
  const {requestPlanEvaluation}=await import('../planClient');
  const {planningStudioBlueprint}=await import('@/lib/v3/parity/planningStudio');
  const {splitV3ArchitecturalBlueprint,elaborateV3ArchitecturalPlan,sameArchitecturalPlan}=await import('@/lib/v3/architecturalPlanFirst');
  const {preparePlanEvaluation}=await import('@/lib/v3/architecturalPlanEvaluation');
  const {planV3ArchitecturalBlueprint,constructV3ArchitecturalBlueprint}=await import('@/lib/v3/architecturalBlueprint');
  const {executeV3SceneOperations}=await import('@/lib/v3/operations');
  const {BLANK_V3_SCENE,compileV3Scene}=await import('@/lib/v3/scene');
  const original=planningStudioBlueprint(),design=splitV3ArchitecturalBlueprint(original);
  for(const f of design.plan.features)delete f.height;
  design.exterior.features.forEach(f=>{f.height=original.features.find(p=>p.id===f.id)!.height;});
  const stage=preparePlanEvaluation(design.plan);
  const saved=JSON.stringify({...BLANK_V3_SCENE,v3Scene:stage.scene});
  const store=useProjectStore.getState(),project=store.createProject('Saved blueprint handoff','house','v3-scene');
  store.appendVersion(project.id,'Saved 2D blueprint',saved);
  const exterior=elaborateV3ArchitecturalPlan(stage,design.exterior);
  const planned=planV3ArchitecturalBlueprint(exterior.blueprint,{buildFirst:true});
  const built=constructV3ArchitecturalBlueprint(planned.approval!);
  expect(built.ok).toBe(true);
  built.scene!.metadata={...built.scene!.metadata,planEvaluation:false,designPipeline:{format:'v3-plan-first-1',stage:'exterior',authority:'v3-semantic-plan'}};
  const finished=JSON.stringify({...BLANK_V3_SCENE,v3Scene:built.scene});
  vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
    expect(JSON.parse(init.body)).toMatchObject({action:'elaborate',prompt:'',currentHouseJson:saved});
    return Response.json({json:finished,summary:'Complete: built from the saved 2D plan.',recovery});
  }));
  await requestPlanEvaluation(project.id,'elaborate');
  expect(store.getProject(project.id)!.houseConfigJson).toBe(finished);
  store.undo(project.id);expect(store.getProject(project.id)!.houseConfigJson).toBe(saved);
  store.redo(project.id);expect(store.getProject(project.id)!.houseConfigJson).toBe(finished);
  const edited=executeV3SceneOperations(built.scene!,{intent:'Change the pavilion finish',operations:[{op:'changeMaterial',target:'orchard-atelier',material:{id:'ochre',color:'#c49a68',surface:'stucco'}}]});
  expect(edited.ok).toBe(true);
  store.appendVersion(project.id,'Edited pavilion finish',JSON.stringify({...BLANK_V3_SCENE,v3Scene:edited.scene}));
  vi.resetModules();
  const reloaded=(await import('@/store/useProjectStore')).useProjectStore.getState().getProject(project.id)!;
  const scene=JSON.parse(reloaded.houseConfigJson).v3Scene;
  expect(scene.objects.find((o:{id:string})=>o.id==='orchard-atelier').material.color).toBe('#c49a68');
  expect(sameArchitecturalPlan(stage.scene!,scene)).toBe(true);
  expect(compileV3Scene(scene)).toEqual(compileV3Scene(edited.scene));
  expect(fetch).toHaveBeenCalledTimes(1);
});
