import { emptySnapshot } from '@/lib/library/store';
vi.mock('@/lib/library/store', async original => ({ ...await original<typeof import('@/lib/library/store')>(), readLibrary: async () => emptySnapshot() }));
import { NoObjectGeneratedError } from 'ai';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { laderaScene } from '@/lib/villa/scene/example';
import { laderaPlan } from '@/lib/villa/scene/planning.fixture';
import { sceneSystemPrompt } from '@/lib/villa/scene/terra';
import { ARCHITECTURAL_DESIGN_GUIDE } from '@/lib/villa/scene/designGuide';
const generate = vi.hoisted(() => vi.fn());
const retained = vi.hoisted(() => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock('node:fs/promises', () => retained);
const lessonRows = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: generate }));
vi.mock('@/lib/ai/model', () => ({ isAiConfigured: () => true, getAiModel: () => 'offline-model', getAiModelId: () => 'offline-model', AI_PROVIDER_OPTIONS: {}, AI_NOT_CONFIGURED_MESSAGE: 'Not configured' }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_: unknown, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/villa/design-learning-store', () => ({ listDesignLessonSummaries: async () => lessonRows.rows }));
import { POST } from './route';
beforeEach(() => { vi.stubEnv('NODE_ENV', 'test'); generate.mockReset(); retained.writeFile.mockClear(); lessonRows.rows = []; });
afterEach(() => vi.unstubAllEnvs());
const call = (input: unknown) => POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify(input) }));
it('uses scene instructions and executes operations without villa configuration translation', async () => {
 const output = { architecturalPlan:laderaPlan, name: laderaScene.name, summary: 'Direct scene', unsupported: [], operations: laderaScene.elements.map(element => ({ op: 'add', element })) };
 generate.mockResolvedValue({ output, finishReason: 'stop' });
 const response = await call({ prompt: 'Construct an editable scene', mode: 'generate' });
 expect(response.status).toBe(200); expect((await response.json()).scene).toEqual({...laderaScene,architecturalPlan:laderaPlan});
 expect(generate).toHaveBeenCalledTimes(1); expect(generate.mock.calls[0][0].system.startsWith(sceneSystemPrompt({mode:'generate',prompt:'Construct an editable scene'}))).toBe(true); expect(generate.mock.calls[0][0].system).toContain('CONCEPT SELECTION WITHIN THIS RESPONSE'); expect(generate.mock.calls[0][0].system).toContain(ARCHITECTURAL_DESIGN_GUIDE); expect(generate.mock.calls[0][0].maxRetries).toBe(0);
});
it('applies targeted edits on the same scene and rejects invalid transactions atomically', async () => {
 generate.mockResolvedValue({ output: { name: laderaScene.name, summary: 'Roof edit', unsupported: [], operations: [{ op: 'resize', id: 'bridge-roof', size: [17,.3,10] }] }, finishReason: 'stop' });
 const input = { prompt: 'Extend roof', mode: 'edit', current: laderaScene };
 const response = await call(input); expect(response.status).toBe(200);
 const { scene } = await response.json(); expect(scene.elements.filter((e: {id:string}) => e.id !== 'bridge-roof')).toEqual(laderaScene.elements.filter(e => e.id !== 'bridge-roof'));
 generate.mockResolvedValue({ output: { name: 'Invalid', summary: 'Invalid edit', unsupported: [], operations: [{ op: 'remove', id: 'missing' }] }, finishReason: 'stop' });
 expect((await call(input)).status).toBe(422); expect(input.current).toEqual(laderaScene);
});

it('sends reference pixels through the primary provider call and the same executor', async () => {
 const output={architecturalPlan:laderaPlan,name:laderaScene.name,summary:'Image reconstruction',unsupported:['Estimated dimensions'],operations:laderaScene.elements.map(element=>({op:'add',element}))};
 generate.mockResolvedValue({output,finishReason:'stop'});
 const reference={source:'concept.png',image:'data:image/png;base64,aGVsbG8='};
 const response=await call({prompt:'Reconstruct visible architecture',mode:'generate',reference});
 expect(response.status).toBe(200);expect((await response.json()).scene).toEqual({...laderaScene,architecturalPlan:laderaPlan});
 expect(generate.mock.calls[0][0].messages[0].content).toContainEqual({type:'image',image:reference.image});
 expect(generate).toHaveBeenCalledOnce();
});

it('retrieves reviewed principles on the canonical generation route',async()=>{
 lessonRows.rows=[{brief:'Tropical villa shade',verdict:'improved',feedback:'Deep shade improved the tropical outdoor terrace.',origin:'terra',referenceCompared:true,changedFields:['elements.0.size.0']}];
 generate.mockResolvedValue({output:{architecturalPlan:laderaPlan,name:laderaScene.name,summary:'Learned principles',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))},finishReason:'stop'});
 expect((await call({prompt:'Tropical villa shade',mode:'generate'})).status).toBe(200);
 expect(generate.mock.calls[0][0].system).toContain('Deep shade improved');
});

it('keeps missing or inaccurate intent as warnings without discarding valid geometry',async()=>{
 const output={name:laderaScene.name,summary:'Finished mansion',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))};
 generate.mockResolvedValue({output,finishReason:'stop'});
 expect((await call({prompt:'A $25m mansion',mode:'generate'})).status).toBe(200);
 generate.mockResolvedValue({output:{...output,architecturalPlan:{...laderaPlan,enclosedAreaM2:1800}},finishReason:'stop'});
 const response=await call({prompt:'A $25m mansion',mode:'generate'});
 expect(response.status).toBe(200);expect((await response.json()).architecturalAudit.issues.join(' ')).toContain('Planned enclosed area');
});

// The provider is mocked throughout: paid generation and filesystem writes are forbidden.
it.each(['test', 'production', 'development'])('retains original provider text for offline replay with planning warnings in %s', async env => {
 vi.stubEnv('NODE_ENV', env);
 const output={architecturalPlan:{...laderaPlan,enclosedAreaM2:1800},name:laderaScene.name,summary:'Incomplete',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))};
 const text='  '+JSON.stringify(output, null, 2)+'\n';
 generate.mockResolvedValue({output,text,finishReason:'stop'});
 const response=await call({prompt:'Mansion',mode:'generate'});
 const body=await response.json();
 expect(response.status).toBe(200);expect(body.scene.elements).toEqual(laderaScene.elements);
 expect(retained.writeFile).toHaveBeenCalledTimes(3);
 const [path,content,options]=retained.writeFile.mock.calls[0];
 expect(path).toBe(`.data/scene-responses/${body.responseId}.json`);
 expect(options).toEqual({flag:'wx',mode:0o600});
 const artifact=JSON.parse(content);
 expect(artifact).toMatchObject({status:'accepted',rawResponse:text,output});
 expect(JSON.parse(artifact.rawResponse)).toEqual(output);
 expect(retained.writeFile.mock.calls.find(c=>c[0].endsWith('.provider.txt'))?.[1]).toBe(text);

 expect(generate).toHaveBeenCalledOnce();
});

it.each([
 ['floor area', {...laderaPlan,enclosedAreaM2:1800}, 'Planned enclosed area'],
 ['room', {...laderaPlan,spaces:laderaPlan.spaces.map((s,i)=>i===0?{...s,areaM2:400}:s)}, 'Salon: measured floor'],
 ['levels', {...laderaPlan,levels:3}, 'Planned 3 levels, measured 2'],
 ['circulation', {...laderaPlan,commitments:laderaPlan.commitments.filter(c=>c.kind!=='circulation')}, 'Missing circulation commitment'],
])('returns specific %s warnings and leaves the existing house untouched',async (_label,architecturalPlan,message)=>{
 const current=structuredClone(laderaScene),before=JSON.stringify(current);
 generate.mockResolvedValue({output:{architecturalPlan,name:'Replacement',summary:'Rejected',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))},finishReason:'stop'});
 const response=await call({prompt:'Replacement mansion',mode:'generate',current});
 const body=await response.json();
 expect(response.status).toBe(200);expect(body.architecturalAudit.issues.join(' ')).toContain(message);expect(body.scene.elements).toEqual(laderaScene.elements);
 expect(JSON.stringify(current)).toBe(before);
});

it('explains missing planning fields when SDK structured-output validation rejects first',async()=>{
 const text=JSON.stringify({architecturalPlan:{...laderaPlan,spaces:undefined,arrivalAndCirculation:undefined},name:'Incomplete',summary:'Missing plan fields',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))});
 generate.mockRejectedValue(new NoObjectGeneratedError({message:'No object generated: response did not match schema.',text,response:{id:'mock',timestamp:new Date(),modelId:'offline'},usage:{} as never,finishReason:'stop'}));
 const response=await call({prompt:'Mansion',mode:'generate'});
 const body=await response.json();
 expect(response.status).toBe(200);expect(body.architecturalAudit.issues.join(' ')).toContain('malformed');expect(body.scene.elements).toEqual(laderaScene.elements);
 expect(JSON.parse(retained.writeFile.mock.calls[0][1]).rawResponse).toBe(text);
 expect(generate).toHaveBeenCalledOnce();
});

it('generates an elevated terrace and railing with place-on, then edits and reloads project history offline', async () => {
 vi.stubEnv('NODE_ENV', 'production');
 const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('Network forbidden'));
 const data = new Map<string,string>();
 vi.stubGlobal('window', {addEventListener:()=>{},localStorage:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)}});
 try {
  const {sceneProviderOutputSchema,resolveSceneResult}=await import('@/lib/villa/scene/terra');
  const {applySceneOperations,validateScene}=await import('@/lib/villa/scene/model');
  const {useProjectStore,verifyPersistedProjectMode}=await import('@/store/useProjectStore');
  const {POST:compatibility}=await import('../villa/scene/route');
  expect(compatibility).toBe(POST);
  const input={prompt:'House with an elevated terrace and glass railing',mode:'generate' as const};
  const output={architecturalPlan:laderaPlan,name:laderaScene.name,summary:'Elevated terrace',unsupported:[],operations:[
   ...laderaScene.elements.map(element=>({op:'add',element})),
   {op:'place-on',id:'balcony-deck',support:'bridge-floor',offset:[0,4.35]},
   {op:'place-on',id:'balcony-rail',support:'balcony-deck',offset:[0,1.05]},
   {op:'place-on',id:'balcony-return',support:'balcony-deck',offset:[6.4,-.05],rotation:Math.PI/2},
  ]};
  expect(sceneProviderOutputSchema(input).safeParse(output).success).toBe(true);
  generate.mockResolvedValue({output,finishReason:'stop'});
  const response=await call(input),body=await response.json();
  expect(body.error).toBeUndefined();expect(response.status).toBe(200);
  // The retained fixture has water and a bottom slab but no basin walls.
  expect(body.architecturalAudit.status).toBe('incomplete');
  expect(body.architecturalAudit.issues.join(' ')).toContain('water perimeter lacks local basin wall evidence');
  expect(generate.mock.calls[0][0].system).toContain('Operations: place-on');
  expect(generate.mock.calls[0][0].system).toContain((await import('@/lib/villa/scene/planning')).ARCHITECTURAL_PLANNING_INSTRUCTIONS);
  const format=await generate.mock.calls[0][0].output.responseFormat;
  expect(JSON.stringify(format.schema)).toContain('place-on');
  expect(format.schema.required).toContain('architecturalPlan');
  const scene=resolveSceneResult(input,{...output,operations:body.operations},body.scene.knowledgeEvidence).scene;
  expect(scene).toEqual(body.scene);
  expect(scene.elements.find(e=>e.id==='balcony-deck')).toMatchObject({parent:'bridge-floor',at:[0,.3,4.35]});
  expect(scene.elements.find(e=>e.id==='balcony-rail')?.at[1]).toBeCloseTo(.7);
  const edited=applySceneOperations(scene,[{op:'finish',id:'balcony-deck',material:'limestone'},{op:'resize',id:'balcony-rail',size:[13,1.2,.03]},{op:'place-on',id:'balcony-rail',support:'balcony-deck',offset:[0,1.05]}]);
  expect(edited.elements.find(e=>e.id==='balcony-rail')?.at[1]).toBeCloseTo(.75);
  useProjectStore.setState({projects:[]});
  const store=useProjectStore.getState(),project=store.createProject('Mock terrace','house','direct-scene');
  expect(verifyPersistedProjectMode(project.id,'direct-scene').ok).toBe(true);
  store.appendVersion(project.id,'Generated',JSON.stringify(scene));
  store.appendVersion(project.id,'Edited',JSON.stringify(edited));
  store.undo(project.id);expect(JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson)).toEqual(scene);
  store.redo(project.id);
  const saved=new Map(data);
  useProjectStore.setState({projects:[]});
  for(const [key,value] of saved)data.set(key,value);
  await useProjectStore.persist.rehydrate();
  const restored=validateScene(JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson));
  expect(restored).toEqual(edited);
  // Inspect the production renderer's recursive scene graph, including local transforms.
  vi.unstubAllGlobals();
  vi.stubEnv('NODE_ENV','test');
  const React=await import('react');
  vi.stubGlobal('React',React);
  const {OperationScene}=await import('@/components/scene/OperationScene');
  const root=OperationScene({scene:restored,onSelect:()=>{}});
  type Node={props:{element?:typeof restored.elements[number];children?:Node[]}};
  const find=(nodes:Node[],id:string):Node|undefined=>{
   for(const node of nodes){if(node.props.element?.id===id)return node;const child=find(node.props.children??[],id);if(child)return child;}
  };
  const deck=find(root.props.children as Node[],'balcony-deck')!;
  expect(deck.props.element?.parent).toBe('bridge-floor');
  const rail=find(deck.props.children??[],'balcony-rail')!;
  expect(rail.props.element?.at[1]).toBeCloseTo(.75);
  expect(rail.props.element?.kind).toBe('balcony');
  expect(generate).toHaveBeenCalledOnce();expect(network).not.toHaveBeenCalled();
 } finally {network.mockRestore();vi.unstubAllGlobals();}
});

it('returns a recoverable construction draft while keeping invalid edits unapplied',async()=>{
 const current=structuredClone(laderaScene),before=JSON.stringify(current);
 generate.mockResolvedValue({finishReason:'stop',output:{name:current.name,summary:'Invalid construction',unsupported:[],operations:[{op:'move',id:'balcony-deck',at:[100,30,100]}]}});
 const response=await call({mode:'edit',prompt:'Float deck',current}),body=await response.json();
 expect(response.status).toBe(422);expect(body.error).toContain('needs contact');expect(body.recoverableDraft.elements.find((e:{id:string})=>e.id==='balcony-deck').at).toEqual([100,30,100]);expect(body).not.toHaveProperty('scene');expect(JSON.stringify(current)).toBe(before);
});

it('preserves the legacy 174-part study at runtime while new provider intents require commitments', async () => {
 const {readFileSync}=await import('node:fs');
 const {sceneProviderOutputSchema}=await import('@/lib/villa/scene/terra');
 const study=JSON.parse(readFileSync('docs/villa-playground/terra-basic-diagnosis/study.scene.json','utf8'));
 const input={prompt:'A detailed courtyard mansion',mode:'generate' as const};
 const architecturalPlan={scaleRationale:'Courtyard residence with subordinate wings.',arrivalAndCirculation:'Sheltered arrival.',volumeHierarchy:'Salon and stepped wings.',relationshipsAndViews:'Loggias open to the sea.',roofFacadeAndMaterials:'Individual glazed bays, stone fins and layered roof datums.',intendedSpaces:['Salon','Residential wings','Loggia']};
 const output={name:study.name,summary:'Detailed construction replay',unsupported:[],architecturalPlan,operations:study.elements.map((element:unknown)=>({op:'add',element}))};
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Network forbidden'));
 try {
  expect(sceneProviderOutputSchema(input).safeParse(output).success).toBe(false);
  generate.mockResolvedValue({output,text:JSON.stringify(output),finishReason:'stop'});
  const response=await call(input),body=await response.json();
  expect(response.status).toBe(200);expect(body.scene.elements).toEqual(study.elements);
  expect(body.scene.elements).toHaveLength(174);
  expect(body.scene.elements.filter((e:{opening?:unknown})=>e.opening)).toHaveLength(70);
  const args=generate.mock.calls[0][0];
  expect(args.maxOutputTokens).toBe(30000);
  expect(args.system).toContain('COMPONENT UTILIZATION');
  expect(args.system).toContain('No separate column or trim kind is needed');
  const format=await args.output.responseFormat;
  const wire=JSON.stringify(format.schema);
  const {elementSchema,operationSchema}=await import('@/lib/villa/scene/model');
  for(const kind of elementSchema.shape.kind.options)expect(wire).toContain(`"${kind}"`);
  for(const op of operationSchema.options)expect(wire).toContain(`"${op.shape.op.value}"`);
  expect(wire).not.toContain('prefixItems');
  expect(generate).toHaveBeenCalledOnce();expect(network).not.toHaveBeenCalled();
 } finally {network.mockRestore();}
});

it('keeps every supported operation executable through the mocked edit route',async()=>{
 const {operationSchema}=await import('@/lib/villa/scene/model');
 const support=laderaScene.elements.find(e=>e.kind==='plate')!;
 const element={id:'detail-post',label:'Editable detail',kind:'volume',at:[0,.5,0],size:[.2,1,.2],rotation:0,material:'limestone',panels:4};
 const operations=[
  {op:'assemble',assembly:{kind:'residential-wing',parameters:{id:'test-wing',at:[100,.1,0],rotation:0,width:12,depth:8,height:3.4,bays:3,material:'ivory',roofForm:'hip',roofRise:1.2,overhang:.4,entryBay:1}}},
  {op:'scale-assembly',id:'test-wing',factors:[1.1,1,1.1]},
  {op:'set-terrain',terrain:null},{op:'add',element},
  {op:'replace',id:element.id,element:{...element,label:'Revised detail'}},
  {op:'move',id:element.id,at:[0,.6,0]}, {op:'rotate',id:element.id,rotation:.2},
  {op:'resize',id:element.id,size:[.3,1.2,.3]}, {op:'finish',id:element.id,material:'bronze'},
  {op:'attach',id:element.id,parent:support.id,at:[0,.7,0]},
  {op:'place-on',id:element.id,support:support.id,offset:[0,0]}, {op:'remove',id:element.id},
 ];
 expect(new Set(operations.map(op=>op.op))).toEqual(new Set(operationSchema.options.map(op=>op.shape.op.value)));
 generate.mockResolvedValue({output:{name:laderaScene.name,summary:'All operations',unsupported:[],operations},finishReason:'stop'});
 const response=await call({mode:'edit',prompt:'Exercise editable details',current:laderaScene});
 expect(response.status).toBe(200);const scene=(await response.json()).scene;expect(scene.elements.filter((e:{id:string})=>!e.id.startsWith('test-wing'))).toEqual(laderaScene.elements);expect(scene.elements.find((e:{id:string})=>e.id==='test-wing').size[0]).toBeCloseTo(13.2);
});

it('injects bounded architectural knowledge on the real canonical route with a mocked provider',async()=>{
 generate.mockResolvedValue({output:{architecturalPlan:laderaPlan,name:laderaScene.name,summary:'Estate',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))},finishReason:'stop'});
 expect((await call({prompt:'A $25m Caribbean waterfront estate',mode:'generate'})).status).toBe(200);
 const system=generate.mock.calls[0][0].system;
 expect(system).toContain('RETRIEVED ARCHITECTURAL KNOWLEDGE');expect(system).toContain('waterfront-estate');expect(system).toContain('tropical-envelope');expect(system).not.toContain('"id":"cinema"');
 expect(generate).toHaveBeenCalledOnce();
});

it.each([
 ['generate','A $25m Caribbean waterfront mansion with infinity edge pool'],
 ['generate','A compact three-bedroom family villa without pool or gym'],
 ['generate','A Mediterranean courtyard mansion with loggias'],
 ['edit','Add a pool sun shelf'],
])('retains knowledge selections on the canonical %s path for %s even without model citations',async(mode,prompt)=>{
 const operations=mode==='generate'?laderaScene.elements.map(element=>({op:'add',element})):[{op:'finish',id:laderaScene.elements[0].id,material:'sage'}];
 generate.mockResolvedValue({output:{name:'Offline',summary:'Contract fixture',unsupported:[],operations},finishReason:'stop'});
 const response=await call({mode,prompt,...(mode==='edit'?{current:laderaScene}:{})});
 const body=await response.json();
 expect(response.status).toBe(200);
 expect(generate.mock.calls[0][0].system).toContain('RETRIEVED ARCHITECTURAL KNOWLEDGE');
 expect(generate.mock.calls[0][0].system).toContain('KNOWLEDGE APPLICATION');
 expect(body.scene.knowledgeEvidence.length).toBeGreaterThan(0);
 expect(body.architecturalAudit.knowledgeUse.every((e:{status:string})=>e.status==='selected-missing')).toBe(true);
 expect(body.scene.elements.length).toBe(laderaScene.elements.length);
});

it.each(['refine','redesign'])('sends explicit %s permission through the canonical route with identical execution safety',async editIntent=>{
 generate.mockResolvedValue({output:{architecturalPlan:laderaPlan,name:laderaScene.name,summary:'Offline edit',unsupported:[],operations:[{op:'resize',id:'bridge-roof',size:[17,.3,10]}]},finishReason:'stop'});
 const response=await call({mode:'edit',editIntent,prompt:'Reconsider house composition',current:laderaScene});
 expect(response.status).toBe(200);
 expect(generate.mock.calls[0][0].system).toContain(editIntent==='redesign'?'REDESIGN MODE:':'REFINE MODE:');
 expect(generate).toHaveBeenCalledOnce();
 generate.mockResolvedValue({output:{architecturalPlan:laderaPlan,name:'bad',summary:'bad support',unsupported:[],operations:[{op:'move',id:'bridge-floor',at:[100,40,100]}]},finishReason:'stop'});
 const rejected=await call({mode:'edit',editIntent,prompt:'Change the main floor',current:laderaScene});
 expect(rejected.status).toBe(422);expect((await rejected.json()).recoverableDraft).toBeDefined();
});

it.each([
 ['$250k compact modern family home','property-value-250k-500k'],
 ['$1m Mediterranean courtyard villa','mediterranean-courtyard'],
 ['$5m contemporary tropical residence','tropical-envelope'],
 ['$25m Caribbean waterfront mansion','property-value-25m-50m'],
])('sends and retains brief-specific guidance in one normal Generate call: %s',async(prompt,knowledgeId)=>{
 generate.mockResolvedValue({output:{architecturalPlan:laderaPlan,name:laderaScene.name,summary:'Mock only',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))},finishReason:'stop'});
 const response=await call({mode:'generate',prompt});
 expect(response.status).toBe(200);
 const body=await response.json();
 expect(body.scene.knowledgeEvidence.some((e:{id:string})=>e.id===knowledgeId)).toBe(true);
 expect(generate).toHaveBeenCalledOnce();
 const system=generate.mock.calls[0][0].system;
 expect(system).toContain(knowledgeId);
 expect(JSON.parse(retained.writeFile.mock.calls[0][1]).requestSystem).toBe(system);
});

it('rejects the retained terrace-through-pool defect on the homepage handler with operation provenance',async()=>{
 const {readFileSync}=await import('node:fs');
 const artifact=JSON.parse(readFileSync('.data/scene-responses/7702f28d-6098-4bf4-b08a-b12fc68ae93b.json','utf8'));
 generate.mockResolvedValue({output:artifact.output,finishReason:'stop'});
 const response=await call({mode:'generate',prompt:'Offline replay of retained pool coordination defect'});
 const body=await response.json();
 expect(response.status).toBe(422);
 expect(body.error).toContain('pool-terrace');expect(body.error).toContain('4:add:pool-terrace');
 expect(body.error).toContain('39:add:pool-water');
 expect(body.recoverableDraft.elements).toEqual(artifact.output.operations.map((op:{element:unknown})=>op.element));
 expect(generate).toHaveBeenCalledOnce(); // Mock only: zero network/provider calls.
});
