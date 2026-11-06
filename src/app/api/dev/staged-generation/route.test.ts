import {afterEach,it,expect,vi} from 'vitest';
import {POST} from './route';
import {POST as paid} from '@/app/api/ai/staged-generation/route';
import {MOCK_BRIEFS} from '@/lib/villa/staged/promptExamples';
const request=(body:unknown,origin='http://localhost')=>new Request('http://localhost/api/dev/staged-generation',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
afterEach(()=>vi.unstubAllEnvs());
it('runs the actual offline HTTP handler through all five stages and refuses client checkpoints',async()=>{
 let id='';
 for(let stage=1;stage<=5;stage++){
  const r=await POST(request(stage===1?{action:'start',brief:MOCK_BRIEFS[2]}:{action:'advance',runId:id}));
  expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('no-store');
  const body=await r.json();id=body.runId;expect(body.stage).toBe(stage);expect(body.providerCalls).toBe(0);expect(body.costUsd).toBe(0);
 }
 expect((await POST(request({action:'advance',runId:id,checkpoints:[]}))).status).toBe(422);
 expect((await POST(request({action:'advance',runId:id}))).status).toBe(422);
});
it('rejects arbitrary prompts explicitly rather than substituting a villa',async()=>{
 const r=await POST(request({action:'start',brief:'A Japanese house with six bedrooms'}));
 expect(r.status).toBe(422);expect((await r.json()).error).toContain('Custom descriptions require secure live execution');
});
it('requires same-origin requests and hides offline mocks on production and Vercel',async()=>{
 expect((await POST(request({},'https://evil.example'))).status).toBe(403);
 const noOrigin=new Request('http://localhost/api/dev/staged-generation',{method:'POST'});
 expect((await POST(noOrigin)).status).toBe(403);
 vi.stubEnv('NODE_ENV','production');expect((await POST(request({}))).status).toBe(404);
 vi.stubEnv('NODE_ENV','development');vi.stubEnv('VERCEL','1');expect((await POST(request({}))).status).toBe(404);
});
it('paid handler fails closed independently of proxy, environment, email or payload',async()=>{
 for(const env of ['test','development','production']){
  vi.stubEnv('NODE_ENV',env);
  const spoofed=new Request('http://localhost/api/ai/staged-generation',{method:'POST',headers:{'x-admin-email':'dylandevaux3@gmail.com'},body:JSON.stringify({authorized:true,maxCostUsd:999})});
  const response=await Reflect.apply(paid,undefined,[spoofed]);
  expect(response.status).toBe(403);
 }
});
