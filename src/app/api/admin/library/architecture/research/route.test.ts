import { NextRequest } from 'next/server';
import { beforeEach, expect, it, vi } from 'vitest';
const service=vi.hoisted(()=>({generationKnowledge:vi.fn(),importArchitecturalKnowledge:vi.fn()}));
vi.mock('@/lib/admin/auth',()=>({isAdminRequest:(r:NextRequest)=>r.headers.get('x-test-admin')==='yes'}));
vi.mock('@/lib/library/architecture/service',()=>service);
import { POST } from './route';
import { researchIntakeFixture } from '@/lib/library/architecture/research.fixture';
import { retrieveArchitecturalKnowledge } from '@/lib/library/architecture/retrieval';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS } from '@/lib/library/architecture/seeds';
const request=(body:unknown,admin=true)=>new NextRequest('http://localhost/api/admin/library/architecture/research',{method:'POST',headers:admin?{'x-test-admin':'yes'}:{},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();service.generationKnowledge.mockResolvedValue(retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,'A tropical estate'));service.importArchitecturalKnowledge.mockImplementation(async value=>value);});
it('requires existing admin access and does not permit execution or supplied approval',async()=>{
 expect((await POST(request({action:'prepare',brief:'Research a home'},false))).status).toBe(401);
 expect((await POST(request({action:'search',brief:'Research a home'}))).status).toBe(400);
 expect((await POST(request({action:'propose',findings:[{...researchIntakeFixture,status:'approved'}]}))).status).toBe(400);
 expect(service.importArchitecturalKnowledge).not.toHaveBeenCalled();
});
it('prepares and previews without writes; explicit propose uses the existing store with unverified provenance',async()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Network forbidden'));
 try {
  const response=await POST(request({action:'prepare',brief:'Research a tropical estate',policy:'on-request'}));
  expect(response.status).toBe(200);expect((await response.json()).plan.bounds.maxProviderCalls).toBe(0);
  expect((await POST(request({action:'preview',findings:[researchIntakeFixture]}))).status).toBe(200);
  expect(service.importArchitecturalKnowledge).not.toHaveBeenCalled();
  expect((await POST(request({action:'propose',findings:[researchIntakeFixture]}))).status).toBe(200);
  expect(service.importArchitecturalKnowledge.mock.calls[0][0][0].entry).toMatchObject({status:'proposed',sources:[{verified:false}]});
  expect(network).not.toHaveBeenCalled();
 } finally {network.mockRestore();}
});
