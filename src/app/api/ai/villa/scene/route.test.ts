import {beforeEach,describe,it,expect,vi} from 'vitest';
import { laderaPlan } from '@/lib/villa/scene/planning.fixture';
import { laderaScene } from '@/lib/villa/scene/example';
const mock=vi.hoisted(()=>({generate:vi.fn()}));
vi.mock('node:fs/promises',()=>({mkdir:vi.fn(),writeFile:vi.fn()}));
vi.mock('@/lib/villa/design-learning-store',()=>({listDesignLessonSummaries:async()=>[]}));
vi.mock('ai',()=>({generateText:mock.generate,Output:{object:(x:unknown)=>x},NoObjectGeneratedError:{isInstance:()=>false}}));
vi.mock('@/lib/ai/model',()=>({isAiConfigured:()=>true,getAiModel:()=>({}),getAiModelId:()=> 'offline-mock',AI_PROVIDER_OPTIONS:{}}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_meta:unknown,fn:()=>unknown)=>fn()}));
import { POST } from './route';
const req=(body:unknown)=>new Request('http://localhost/api/ai/villa/scene',{method:'POST',body:JSON.stringify(body)});
describe('direct scene route (no live provider)',()=>{
 beforeEach(()=>{vi.stubEnv('NODE_ENV','development');mock.generate.mockReset();});
 it('replays Casa Ladera without a legacy configuration validator',async()=>{
 mock.generate.mockResolvedValue({finishReason:'stop',output:{architecturalPlan:laderaPlan,name:laderaScene.name,summary:'Replay',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))}});
 const response=await POST(req({prompt:'Casa Ladera',mode:'generate'}));expect(response.status).toBe(200);expect((await response.json()).scene).toEqual({...laderaScene,architecturalPlan:laderaPlan});expect(mock.generate).toHaveBeenCalledOnce();
 });
 it('exposes the same primary construction handler in production',async()=>{
 vi.stubEnv('NODE_ENV','production');
 mock.generate.mockResolvedValue({finishReason:'stop',output:{architecturalPlan:laderaPlan,name:laderaScene.name,summary:'Offline production replay',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))}});
 const {POST:primary}=await import('../../scene/route');
 expect(primary).toBe(POST);expect((await primary(req({prompt:'House',mode:'generate'}))).status).toBe(200);
 });
 it('rejects corrupt attachments before provider dispatch',async()=>{
 const scene={...laderaScene,elements:[{...laderaScene.elements[0],parent:'missing'}]};
 const response=await POST(req({prompt:'Edit',mode:'edit',current:scene}));expect(response.status).toBe(400);expect(mock.generate).not.toHaveBeenCalled();
 });
 it('rejects unsupported model geometry without substitution or retry',async()=>{
 mock.generate.mockResolvedValue({finishReason:'stop',output:{name:'Bad',summary:'Bad',unsupported:[],operations:[{op:'add',element:{id:'roof',label:'Dome',kind:'dome',at:[0,0,0],size:[3,3,3]}}]}});
 expect((await POST(req({prompt:'Dome',mode:'generate'}))).status).toBe(422);expect(mock.generate).toHaveBeenCalledOnce();
 });
});
