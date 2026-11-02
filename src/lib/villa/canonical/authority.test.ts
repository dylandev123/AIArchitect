import { expect,it,vi,beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
const mocks=vi.hoisted(()=>({canonical:vi.fn()}));
vi.mock('./generate',()=>({generateCanonical:mocks.canonical}));
vi.mock('@/lib/ai/model',()=>({getAiModelId:()=> 'gpt-5.6-terra',isAiConfigured:()=>true,getAiModel:vi.fn(),AI_NOT_CONFIGURED_MESSAGE:'Unavailable'}));
import {POST as scenePOST} from '@/app/api/ai/scene/route';
import {POST as housePOST} from '@/app/api/ai/house/route';
import {POST as villaPOST} from '@/app/api/ai/villa/route';
import {POST as conceptPOST} from '@/app/api/ai/concept/route';
import {POST as replayPOST} from '@/app/api/ai/house/replay/route';
import {POST as planPOST} from '@/app/api/ai/plan/route';
beforeEach(()=>{vi.clearAllMocks();mocks.canonical.mockResolvedValue(Response.json({canonical:true}));});
it('dispatches new direct-scene generation to exactly one authority',async()=>{
 const response=await scenePOST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify({mode:'generate',prompt:'A house'})}));
 expect(response.status).toBe(200);expect(mocks.canonical).toHaveBeenCalledTimes(1);
});
it('blocks V2 and V3 new generation at their old endpoint without dispatch',async()=>{
 for(const generationMode of ['v2','v3-scene']){
  const response=await housePOST(new NextRequest('http://localhost/api/ai/house',{method:'POST',body:JSON.stringify({mode:'generate',generationMode,prompt:'A house'})}));
  expect(response.status).toBe(409);expect((await response.json()).providerCalls).toBe(0);
 }
 expect(mocks.canonical).not.toHaveBeenCalled();
});
it('blocks villa configuration new generation',async()=>{
 vi.stubEnv('NODE_ENV','development');
 try{
  const response=await villaPOST(new Request('http://localhost/api/ai/villa',{method:'POST',body:JSON.stringify({mode:'generate',prompt:'A house'})}));
  expect(response.status).toBe(409);expect((await response.json()).providerCalls).toBe(0);
 }finally{vi.unstubAllEnvs();}
});

it('blocks retired concept, plan design and paid stage replay without dispatch',async()=>{
 vi.stubEnv('AI_V3_PLAN_EVALUATION','1');
 try{
  for(const handler of [conceptPOST,replayPOST,planPOST]){
   const response=await handler(new NextRequest('http://localhost/api/retired',{method:'POST',body:JSON.stringify({action:'design',prompt:'A house',currentHouseJson:'{}'})}));
   expect(response.status).toBe(409);expect((await response.json()).providerCalls).toBe(0);
  }
  expect(mocks.canonical).not.toHaveBeenCalled();
 }finally{vi.unstubAllEnvs();}
});
