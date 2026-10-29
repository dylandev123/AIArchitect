import {readFileSync} from 'node:fs';
import {expect,it,vi,beforeEach,afterEach} from 'vitest';
import {laderaScene} from '@/lib/villa/scene/example';
import {laderaPlan} from '@/lib/villa/scene/planning.fixture';
const mocks=vi.hoisted(()=>({generate:vi.fn(),writeFile:vi.fn(),model:vi.fn((_capture?:unknown,_model?:string)=> {void _capture;void _model;return 'mock-model';}),context:vi.fn(async()=>({system:'unchanged knowledge',trace:{selected:['approved']},evidence:[]}))}));
vi.mock('node:fs/promises',async original=>({...await original<typeof import('node:fs/promises')>(),mkdir:vi.fn(),writeFile:mocks.writeFile}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:mocks.generate}));
vi.mock('@/lib/ai/model',()=>({isAiConfigured:()=>true,getAiModelId:()=> 'gpt-5.6-terra',getAiModel:mocks.model}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:async(_:unknown,run:()=>Promise<unknown>)=>run()}));
vi.mock('@/lib/villa/scene/knowledgeContext',()=>({architecturalRequestContext:mocks.context}));
import {GET,POST} from './route';
beforeEach(()=>{vi.stubEnv('NODE_ENV','development');mocks.generate.mockReset();mocks.context.mockClear();mocks.writeFile.mockClear();mocks.model.mockClear();});
afterEach(()=>vi.unstubAllEnvs());
const output={name:laderaScene.name,summary:'Roof changed',unsupported:[],architecturalPlan:laderaPlan,operations:[{op:'resize',id:'bridge-roof',size:[17,.3,10]}]};
const call=(input:unknown)=>POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(input)}));
it('hides development catalogue in production and rejects overrides before provider use',async()=>{
 vi.stubEnv('NODE_ENV','production');expect((await GET(new Request('http://localhost/api/ai/scene'))).status).toBe(404);
 expect((await call({mode:'edit',current:laderaScene,prompt:'Edit',testing:{model:'gpt-6-astra'}})).status).toBe(400);expect(mocks.generate).not.toHaveBeenCalled();
});
it('uses the same route, records selection/usage/audit and preserves normal defaults',async()=>{
 mocks.generate.mockResolvedValue({output,finishReason:'stop',totalUsage:{inputTokens:20,outputTokens:10}});
 const input={mode:'edit',current:laderaScene,prompt:'Edit roof'};
 const normal=await call(input);expect(normal.status).toBe(200);const normalArgs=mocks.generate.mock.calls[0][0];
 const response=await call({...input,testing:{model:'gpt-6.1-sol',reasoningEffort:'high'}});expect(response.status).toBe(200);const body=await response.json();
 expect(mocks.generate.mock.calls[1][0].system).toBe(normalArgs.system);expect(mocks.generate.mock.calls[1][0].messages).toEqual(normalArgs.messages);
 expect(mocks.model.mock.calls[1][1]).toBe('gpt-6.1-sol');expect(mocks.generate.mock.calls[1][0].providerOptions.openai.reasoningEffort).toBe('high');
 expect(body.experiment).toMatchObject({model:'gpt-6.1-sol',reasoningEffort:'high',usage:{inputTokens:20,outputTokens:10},operations:1,architecturalQuality:'requires-visual-review'});
 const reports=mocks.writeFile.mock.calls.filter(c=>String(c[0]).endsWith('.diagnostics.json')).map(c=>JSON.parse(c[1]));expect(reports[1].requestFingerprint).toBe(reports[0].requestFingerprint);expect(reports[1].validation.status).toBe('accepted');expect(reports[1].architecturalQuality.audit).toBeDefined();
});
it('loads exact retained case offline, freezes knowledge, rejects changed scene and retains failed output',async()=>{
 const loaded=await GET(new Request('http://localhost/api/ai/scene?fixture=mansion-coordination'));expect(loaded.status).toBe(200);const {input}=await loaded.json();expect(input.current.elements).toHaveLength(88);
 const failed=JSON.parse(readFileSync('docs/architecture/terra-coordination-experiment/response.json','utf8')).output;
 mocks.generate.mockResolvedValue({output:failed,text:JSON.stringify(failed),finishReason:'stop',totalUsage:{totalTokens:1}});
 const request={...input,testing:{model:'gpt-6.1-sol',reasoningEffort:'high',fixture:'mansion-coordination'}};
 const response=await call(request);const body=await response.json();expect(response.status).toBe(422);expect(body.error).toContain('Destructive incomplete replacement');expect(body.recoverableDraft.elements).toHaveLength(87);expect(mocks.context).not.toHaveBeenCalled();
 expect(mocks.generate.mock.calls[0][0].messages).toHaveLength(2);expect(mocks.generate.mock.calls[0][0].system).toContain('RETRIEVED ARCHITECTURAL KNOWLEDGE');
 const report=JSON.parse(mocks.writeFile.mock.calls.find(c=>String(c[0]).endsWith('.diagnostics.json'))![1]);expect(report.providerMetadata).toMatchObject({model:'gpt-6.1-sol',reasoningEffort:'high'});expect(report.validation.status).toBe('rejected');
 expect((await call({...request,current:{...input.current,name:'Edited scene'}})).status).toBe(400);expect(mocks.generate).toHaveBeenCalledOnce();
});
