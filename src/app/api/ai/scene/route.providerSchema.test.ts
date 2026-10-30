import { emptySnapshot } from '@/lib/library/store';
vi.mock('@/lib/library/store', async original => ({ ...await original<typeof import('@/lib/library/store')>(), readLibrary: async () => emptySnapshot() }));
import { beforeEach, expect, it, vi } from 'vitest';
import { createOpenAI } from '@ai-sdk/openai';
import { Output } from 'ai';
import { z } from 'zod';
import {readFileSync} from 'node:fs';
import { sceneResponseFormatSchema } from '@/lib/villa/scene/terra';
import { operationSchema } from '@/lib/villa/scene/model';
import { laderaScene } from '@/lib/villa/scene/example';
import { laderaPlan } from '@/lib/villa/scene/planning.fixture';

const boundary = vi.hoisted(() => ({ fetch: vi.fn(), writeFile: vi.fn() }));
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: boundary.writeFile }));
vi.mock('@/lib/ai/model', () => ({
 isAiConfigured: () => true, getAiModelId: () => 'gpt-5.6-terra',
 getAiModel: () => createOpenAI({ apiKey: 'offline-placeholder', fetch: boundary.fetch })('gpt-5.6-terra'),
 AI_PROVIDER_OPTIONS: { openai: { strictJsonSchema: false } }, AI_NOT_CONFIGURED_MESSAGE: 'Not configured',
}));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_: unknown, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/villa/design-learning-store', () => ({ listDesignLessonSummaries: async () => [] }));
import { POST } from './route';

// Audit every emitted node, including nested operation unions and plan definitions.
// This allowlist deliberately fails when conversion introduces an unaudited keyword.
const keywords = new Set(['$schema', '$ref', '$defs', 'type', 'properties', 'required', 'additionalProperties', 'items', 'anyOf', 'enum', 'const', 'description', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'pattern', 'minItems', 'maxItems', 'default']);
function audit(node: unknown, path = '$'): void {
 if (typeof node === 'boolean') return;
 expect(node, path).toBeTypeOf('object');
 expect(node, path).not.toBeNull();
 expect(Array.isArray(node), path).toBe(false);
 const schema = node as Record<string, unknown>;
 for (const [key, value] of Object.entries(schema)) {
  expect(keywords.has(key), `${path}.${key}: unaudited schema keyword`).toBe(true);
  if (key === 'properties' || key === '$defs') {
   for (const [name, child] of Object.entries(value as object)) audit(child, `${path}.${key}.${name}`);
  } else if (key === 'anyOf') {
   expect(Array.isArray(value), path).toBe(true);
   (value as unknown[]).forEach((child, i) => audit(child, `${path}.anyOf[${i}]`));
  } else if (key === 'items' || key === 'additionalProperties') audit(value, `${path}.${key}`);
 }
}
beforeEach(() => { boundary.fetch.mockReset(); boundary.writeFile.mockClear(); });
it('detects the original tuple rejection at any nested schema path', async () => {
 const format = await Output.object({ schema: z.object({ offset: z.tuple([z.number(), z.number()]) }) }).responseFormat;
 if (format?.type !== 'json') throw Error('Expected JSON response format');
 expect(() => audit(format.schema)).toThrow();
});
it.each(['generate', 'edit'] as const)('audits the complete %s schema actually serialized by OpenAI SDK with no live calls', async mode => {
 const input = { mode, prompt: mode === 'edit' ? 'Change bridge-roof material' : 'Construct architecture', ...(mode === 'edit' ? { current: laderaScene } : {}) };
 const output = { ...(mode === 'generate' ? { architecturalPlan: laderaPlan } : {}), name: laderaScene.name, summary: 'Offline provider response', unsupported: [], operations: mode === 'generate' ? laderaScene.elements.map(element => ({ op: 'add', element })) : [{ op: 'finish', id: 'bridge-roof', material: 'ivory' }] };
 boundary.fetch.mockResolvedValue(new Response(JSON.stringify({
  id: 'resp_offline', object: 'response', created_at: 0, model: 'gpt-5.6-terra', status: 'completed',
  output: [{ type: 'message', id: 'msg_offline', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }],
  usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
 }), { status: 200, headers: { 'content-type': 'application/json' } }));
 const response = await POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify(input) }));
 expect(await response.clone().json()).not.toHaveProperty('error');
 expect(response.status).toBe(200);
 expect(boundary.fetch).toHaveBeenCalledOnce();
 const wire = JSON.parse(boundary.fetch.mock.calls[0][1].body);
 if(mode==='generate'){
  const sent=JSON.stringify(wire.input);
  expect(sent).toContain('EXTERIOR FIRST');
  expect(sent).toContain('interiors unfinished');
  expect(sent).toContain('Bedroom count drives footprint/wing/level capacity');
  expect(sent).toContain('FITTED FACADE BAY');
  expect(sent).toContain('slab TOP datums');
  expect(sent).toContain('FINAL FOUR-VIEW SELF-CHECK');
  expect(wire.text.format.schema.properties.architecturalPlan.required).toContain('programme');
  expect(wire.text.format.schema.properties.architecturalPlan.anyOf).toBeUndefined();
  expect(sent).not.toContain('Reference built partitions/cabinets and separate bathroom entries');
 }
 const expected = await Output.object({ schema: await sceneResponseFormatSchema(input) }).responseFormat;
 if (expected?.type !== 'json') throw Error('Expected JSON response format');
 expect(wire.text.format).toEqual({ type: 'json_schema', name: 'response', strict: mode === 'generate', schema: expected.schema });
 audit(wire.text.format.schema);
 const operations = wire.text.format.schema.properties.operations.items.anyOf;
 expect(operations).toHaveLength(operationSchema.options.length);
 const placement = operations.find((node: { properties: { op: { const: string } } }) => node.properties.op.const === 'place-on');
 expect(placement.properties.offset).toEqual({ type: 'array', items: { type: 'number', minimum: -10000, maximum: 10000 }, minItems: 2, maxItems: 2 });
 expect(wire.text.format.schema.required.includes('architecturalPlan')).toBe(mode === 'generate');
});

it('preserves exact coordinate count, finite bounds and placement defaults', () => {
 const placement = { op: 'place-on', id: 'rail', support: 'deck', offset: [-10000, 10000] };
 expect(operationSchema.parse(placement)).toEqual({ ...placement, rotation: 0 });
 for (const offset of [[0], [0, 0, 0], [-10001, 0], [0, 10001], [NaN, 0], [0, Infinity]]) {
  expect(operationSchema.safeParse({ ...placement, offset }).success).toBe(false);
 }
});

it('retains a provider schema rejection without inference output or retrying', async () => {
 boundary.fetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Invalid schema for response_format', type: 'invalid_request_error', code: 'invalid_json_schema', param: 'text.format.schema' } }), { status: 400, headers: { 'content-type': 'application/json' } }));
 const response = await POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify({ mode: 'generate', prompt: 'Offline rejection' }) }));
 expect(response.status).toBe(422);
 expect(boundary.fetch).toHaveBeenCalledOnce();
 const artifact = JSON.parse(boundary.writeFile.mock.calls[0][1]);
 expect(artifact.status).toBe('rejected');
 expect(artifact.error).toContain('Invalid schema');
 expect(artifact).not.toHaveProperty('output');
 expect(artifact).not.toHaveProperty('rawResponse');
});

const redesignInput = {mode:'edit' as const, editIntent:'redesign' as const,prompt:'Recompose the house',current:laderaScene};
function respond(output:unknown) {
 boundary.fetch.mockResolvedValue(new Response(JSON.stringify({id:'resp_offline',object:'response',created_at:0,model:'gpt-5.6-terra',status:'completed',output:[{type:'message',id:'msg_offline',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output),annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}),{status:200,headers:{'content-type':'application/json'}}));
}
const redesignCall=()=>POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(redesignInput)}));
const complete=()=>({architecturalPlan:laderaPlan,name:'Construction proposal',summary:'Executable proposal',unsupported:[],operations:[{op:'resize',id:'bridge-roof',size:[17,.3,10]}]});
it('serializes strict Redesign objects at every depth and requires executable operations',async()=>{
 respond(complete());
 expect((await redesignCall()).status).toBe(200);
 const wire=JSON.parse(boundary.fetch.mock.calls[0][1].body);
 const schema=wire.text.format.schema;
 expect(wire.text.format.strict).toBe(true);audit(schema);
 expect([...schema.required].sort()).toEqual(['architecturalPlan','name','operations','summary','unsupported']);
 expect(schema.properties.operations.minItems).toBe(1);expect(schema.properties.operations.maxItems).toBe(800);
 function check(node:Record<string,unknown>){
  if(node.properties){expect(node.required).toEqual(Object.keys(node.properties));expect(node.additionalProperties).toBe(false);Object.values(node.properties as object).forEach(check);}
  if(node.items)check(node.items as Record<string,unknown>);
  if(node.anyOf)(node.anyOf as Record<string,unknown>[]).forEach(check);
  expect(node).not.toHaveProperty('default');
 }
 check(schema);
 const format=await Output.object({schema:await sceneResponseFormatSchema(redesignInput)}).responseFormat;
 expect(format?.type).toBe('json');if(format?.type==='json')expect(schema).toEqual(format.schema);
 expect(boundary.fetch).toHaveBeenCalledOnce();
});
it.each(['concept-only','name','summary','unsupported','operations','architecturalPlan','empty','unknown-op','unsupported-shape','finish-only','no-change','bad-support'])(
 'rejects %s through the actual SDK transport with original retained and no retry',async kind=>{
 const output:Record<string,unknown>=complete();
 if(kind==='concept-only'){for(const key of ['name','summary','unsupported','operations'])delete output[key];}
 else if(['name','summary','unsupported','operations','architecturalPlan'].includes(kind))delete output[kind];
 else if(kind==='empty')output.operations=[];
 else if(kind==='unknown-op')output.operations=[{op:'invent-a-house'}];
 else if(kind==='unsupported-shape')output.operations=[{op:'add',element:{id:'dome',label:'Dome',kind:'dome',at:[0,0,0],size:[4,4,4]}}];
 else if(kind==='finish-only')output.operations=[{op:'finish',id:'bridge-roof',material:'ivory'}];
 else if(kind==='no-change')output.operations=[{op:'resize',id:'bridge-roof',size:laderaScene.elements.find(e=>e.id==='bridge-roof')!.size}];
 else output.operations=[...complete().operations,{op:'move',id:'bridge-floor',at:[100,40,100]}];
 const original=JSON.stringify(redesignInput.current);respond(output);
 const response=await redesignCall(),body=await response.json();expect(response.status).toBe(422);
 expect(body.scene).toBeUndefined();expect(JSON.stringify(redesignInput.current)).toBe(original);
 if(kind==='bad-support')expect(body.recoverableDraft).toBeDefined();
 expect(boundary.fetch).toHaveBeenCalledOnce();
 const artifact=JSON.parse(boundary.writeFile.mock.calls[0][1]);expect(JSON.parse(artifact.rawResponse)).toEqual(output);
});
it('executes a large coordinated developer study through the real SDK, including strict nullable fields',async()=>{
 const study=JSON.parse(readFileSync('docs/villa-playground/redesign-audit/developed-study.operations.json','utf8'));
 const before=JSON.parse(readFileSync('docs/villa-playground/redesign-audit/developed-study.before.json','utf8'));
 // Explicit null represents optional properties only, never invented geometry.
 for(const op of study)if(op.element)for(const k of ['parent','roofForm','overhang','opening'])op.element[k]??=null;
 respond({...complete(),operations:study});
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify({...redesignInput,current:before})}));
 const body=await response.json();expect(body.error).toBeUndefined();expect(response.status).toBe(200);
 expect(body.operations).toHaveLength(study.length);expect(body.scene.elements.length).toBeGreaterThan(150);
 expect(boundary.fetch).toHaveBeenCalledOnce();
});

it.each(['construction','concept-only','empty','finish-only','no-change','bad-support'])('enforces strict Complete Architecture %s through the offline SDK transport',async kind=>{
 const input={...redesignInput,editIntent:'complete' as const};
 const output:Record<string,unknown>=complete();
 if(kind==='concept-only')delete output.operations;
 if(kind==='empty')output.operations=[];
 if(kind==='finish-only')output.operations=[{op:'finish',id:'bridge-roof',material:'ivory'}];
 if(kind==='no-change')output.operations=[{op:'resize',id:'bridge-roof',size:laderaScene.elements.find(e=>e.id==='bridge-roof')!.size}];
 if(kind==='bad-support')output.operations=[{op:'move',id:'bridge-floor',at:[100,40,100]}];
 const original=JSON.stringify(input.current);respond(output);
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(input)}));
 const body=await response.json();
 expect(response.status).toBe(kind==='construction'?200:422);
 if(kind!=='construction')expect(body.scene).toBeUndefined();
 expect(JSON.stringify(input.current)).toBe(original);
 const wire=JSON.parse(boundary.fetch.mock.calls[0][1].body);
 expect(wire.text.format.strict).toBe(true);audit(wire.text.format.schema);
 expect(wire.text.format.schema.properties.operations.minItems).toBe(1);
 expect(boundary.fetch).toHaveBeenCalledOnce();
});

it.each(['generate','refine','redesign','complete'] as const)('executes an assembly through the actual %s provider request offline',async mode=>{
 const input=mode==='generate'?{mode:'generate' as const,prompt:'Offline wing'}:{mode:'edit' as const,editIntent:mode,prompt:'Add detached studio',current:laderaScene};
 const output={...(mode==='refine'?{}:{architecturalPlan:laderaPlan}),name:'Assembly proof',summary:'Offline construction',unsupported:[],operations:[{op:'assemble',assembly:{kind:'residential-wing',parameters:{id:'proof-wing',at:[100,.1,0],rotation:0,width:12,depth:8,height:3.4,bays:3,material:'ivory',roofForm:'hip',roofRise:1.2,overhang:.4,entryBay:1}}}]};
 boundary.fetch.mockResolvedValue(new Response(JSON.stringify({id:'resp_offline',object:'response',created_at:0,model:'gpt-5.6-terra',status:'completed',output:[{type:'message',id:'msg_offline',role:'assistant',content:[{type:'output_text',text:JSON.stringify(output),annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}),{status:200,headers:{'content-type':'application/json'}}));
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(input)}));
 const body=await response.json();expect(body.error).toBeUndefined();expect(response.status).toBe(200);
 expect(body.scene.elements.find((e:{id:string})=>e.id==='proof-wing-glass-1').kind).toBe('entrance');
 const wire=JSON.parse(boundary.fetch.mock.calls[0][1].body);audit(wire.text.format.schema);
 expect(JSON.stringify(wire.text.format.schema)).toContain('residential-wing');
 expect(JSON.stringify(wire.input)).toContain('COORDINATED ASSEMBLIES');
});

it.each(['angular','flowing','estate'] as const)('runs %s profile construction through the normal route and real SDK transport without simplification',async study=>{
 const {profileFreedomStudy}=await import('@/lib/villa/scene/profileFreedom.fixture');
 const {scene,operations}=profileFreedomStudy(study);
 const intent={scaleRationale:'Offline developer replay, not model design evidence.',arrivalAndCirculation:'Selected entry; complete access unverified.',volumeHierarchy:'Study-specific form.',relationshipsAndViews:'Site assumptions.',roofFacadeAndMaterials:'Profile sections.',intendedSpaces:['Residence'],constructionScope:'exterior',programme:[{name:'Residence',zone:'public',strategy:'enclosed',floorIds:[scene.elements.find(e=>e.kind==='plate')!.id],enclosureIds:scene.elements.filter(e=>e.kind==='wall'||e.kind==='glazing').map(e=>e.id),roofIds:scene.elements.filter(e=>e.kind==='roof').map(e=>e.id),accessIds:scene.elements.filter(e=>e.kind==='entrance').map(e=>e.id),limitation:'Interior fit-out deferred; profile coverage/access unverified.'}]};
 const nullable=operations.map(op=>{
  if(op.op!=='add')return op;
  const element:Record<string,unknown>={...op.element};
  for(const key of ['geometry','color','parent','roofForm','overhang','opening','assemblyKind'])element[key]??=null;
  if(element.geometry && (element.geometry as {type:string}).type==='extrusion')element.geometry={...element.geometry as object,holes:(element.geometry as {holes?:unknown}).holes??null};
  return {...op,element};
 });
 respond({name:scene.name,summary:'Offline profile replay',unsupported:['Developer study; no autonomous model design claim.'],architecturalPlan:intent,operations:nullable});
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify({mode:'generate',prompt:'Offline developer study replay'})}));
 const body=await response.json();expect(body.error,JSON.stringify(body)).toBeUndefined();expect(response.status).toBe(200);
 expect(body.scene.elements).toEqual(scene.elements);expect(boundary.fetch).toHaveBeenCalledOnce();
 const wire=JSON.parse(boundary.fetch.mock.calls[0][1].body);audit(wire.text.format.schema);
 expect(JSON.stringify(wire.input)).toContain('GENERAL-PURPOSE EDITABLE PROFILES');
 expect(JSON.stringify(wire.input)).not.toContain('primary salon, subordinate dining pavilion');
 expect(JSON.stringify(wire.text.format.schema)).toContain('innerRatio');
});
