import { NextRequest } from 'next/server';
import { expect, it, vi } from 'vitest';
const service=vi.hoisted(()=>({inspectArchitecturalKnowledge:vi.fn(),importArchitecturalKnowledge:vi.fn()}));
vi.mock('@/lib/admin/auth',()=>({isAdminRequest:(r:NextRequest)=>r.headers.get('x-test-admin')==='yes'}));
vi.mock('@/lib/library/architecture/service',async original=>({...await original<typeof import('@/lib/library/architecture/service')>(),...service}));
import { GET, POST } from './route';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS } from '@/lib/library/architecture/seeds';
const req=(method:string,body?:unknown,admin=true)=>new NextRequest('http://localhost/api/admin/library/architecture?q=waterfront',{method,headers:admin?{'x-test-admin':'yes'}:{},...(body?{body:JSON.stringify(body)}:{})});
it('uses existing admin access checks for inspection and bulk writes',async()=>{
 expect((await GET(req('GET',undefined,false))).status).toBe(401);
 expect((await POST(req('POST',[],false))).status).toBe(401);
 expect(service.importArchitecturalKnowledge).not.toHaveBeenCalled();
 service.inspectArchitecturalKnowledge.mockResolvedValue([]);
 expect((await GET(req('GET'))).status).toBe(200);
 expect(service.inspectArchitecturalKnowledge).toHaveBeenCalledWith('waterfront');
});
it('validates bulk edits and reports stale revision conflicts',async()=>{
 expect((await POST(req('POST',[]))).status).toBe(400);
 const {version,updatedAt,...entry}=ARCHITECTURAL_KNOWLEDGE_SEEDS[0];void updatedAt;
 service.importArchitecturalKnowledge.mockResolvedValue([{id:entry.id}]);
 expect((await POST(req('POST',[{entry,expectedVersion:version}]))).status).toBe(200);
 service.importArchitecturalKnowledge.mockRejectedValue(Error('Version conflict'));
 expect((await POST(req('POST',[{entry,expectedVersion:version}]))).status).toBe(409);
});
