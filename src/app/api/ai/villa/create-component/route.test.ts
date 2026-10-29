import { beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({generate:vi.fn(),list:vi.fn()}));
vi.mock('ai',()=>({generateText:f.generate,Output:{object:vi.fn()}}));
vi.mock('@/lib/ai/model',()=>({getAiModel:vi.fn(),getAiModelId:()=> 'existing-terra-model',isAiConfigured:()=>true,AI_PROVIDER_OPTIONS:{},AI_NOT_CONFIGURED_MESSAGE:'not configured'}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_meta:unknown,run:()=>unknown)=>run()}));
vi.mock('@/lib/villa/creation/store',()=>({listCandidates:f.list}));
import { POST } from './route';
import { COMPOSITION_EXAMPLES } from '@/lib/villa/composition-examples';
beforeEach(()=>{vi.stubEnv('NODE_ENV','development');f.generate.mockReset();f.list.mockResolvedValue([]);});
const payload={brief:'Invent a wave',element:'Terrace canopy',current:COMPOSITION_EXAMPLES[0],authorizePaidCall:true,offlineCandidate:{id:'tidal-ribbon',version:1}};
const request=(body:unknown,origin='http://localhost:3000')=>new Request('http://localhost:3000/api/ai/villa/create-component',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
describe('manual paid creation guard',()=>{
 it('blocks production before all provider work',async()=>{vi.stubEnv('NODE_ENV','production');expect((await POST(request(payload))).status).toBe(404);expect(f.generate).not.toHaveBeenCalled();});
 it('rejects missing authorization, foreign origins and missing offline validation without calls',async()=>{
  for(const req of [request({...payload,authorizePaidCall:false}),request(payload,'https://foreign.test'),request(payload)]) {const r=await POST(req);expect(r.status).toBe(400);expect((await r.json()).providerCalls).toBe(0);}
  expect(f.generate).not.toHaveBeenCalled();
 });
 it('uses one mocked provider result with a specific gap and no retry',async()=>{
  f.list.mockResolvedValue([{id:'tidal-ribbon',version:1}]);f.generate.mockResolvedValue({output:{capabilityGap:'Enclosed glazed domes are unsupported by swept-ribbon@1.'},totalUsage:{inputTokens:10,outputTokens:10}});
  const r=await POST(request(payload));expect(r.status).toBe(200);expect((await r.json()).capabilityGap).toMatch(/domes/);expect(f.generate).toHaveBeenCalledTimes(1);expect(f.generate.mock.calls[0][0].maxRetries).toBe(0);
 });
});
