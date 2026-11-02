import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
vi.mock('node:dns/promises',()=>({lookup:vi.fn()}));
vi.mock('node:tls',()=>({connect:vi.fn()}));
import {lookup} from 'node:dns/promises';
import {connect} from 'node:tls';
import {semanticTransportPreflight,safeTransportError} from '../../../scripts/semantic-transport-preflight.mjs';
const request={model:'gpt-5.6-terra',max_output_tokens:30000};
afterEach(()=>{vi.resetAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
function network(){
 vi.stubEnv('OPENAI_API_KEY','secret-test');
 vi.mocked(lookup).mockResolvedValueOnce([{address:'192.0.2.1',family:4}] as never);
 vi.mocked(connect).mockImplementationOnce((()=>{const s=Object.assign(new EventEmitter(),{authorized:true,setTimeout:vi.fn(),destroy:vi.fn(),getProtocol:()=> 'TLSv1.3'});queueMicrotask(()=>s.emit('secureConnect'));return s;}) as never);
}
it('fails closed at DNS before HTTP and retains safe nested cause',async()=>{
 vi.stubEnv('OPENAI_API_KEY','secret-test');
 vi.mocked(lookup).mockRejectedValueOnce(Object.assign(Error('secret-test'),{code:'ENOTFOUND',cause:{name:'Error',code:'EAI_AGAIN'}}));
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const r=await semanticTransportPreflight(request,'{}');
 expect(r).toMatchObject({ok:false,failureStage:'dns',error:{code:'ENOTFOUND',cause:{code:'EAI_AGAIN'}},generationRequests:0});expect(fetch).not.toHaveBeenCalled();expect(JSON.stringify(r)).not.toContain('secret-test');
});
it('checks exact model and Responses using GET without asserting write permission',async()=>{
 network();const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({id:request.model}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'missing_scope'}}),{status:401}));vi.stubGlobal('fetch',fetch);
 const r=await semanticTransportPreflight(request,'{}');expect(r).toMatchObject({ok:true,creationPermissionVerified:false,responses:{readScopeRestricted:true}});
 expect(fetch.mock.calls.map(c=>[c[0],c[1].method])).toEqual([['https://api.openai.com/v1/models/gpt-5.6-terra','GET'],['https://api.openai.com/v1/responses','GET']]);expect(JSON.stringify(r)).not.toContain('secret-test');
});
it('stops on denied model access',async()=>{network();const fetch=vi.fn().mockResolvedValueOnce(new Response('{}',{status:403}));vi.stubGlobal('fetch',fetch);expect(await semanticTransportPreflight(request,'{}')).toMatchObject({ok:false,failureStage:'model-access'});expect(fetch).toHaveBeenCalledTimes(1);});
it('retains aggregate causes without arbitrary exception messages',()=>{const e={name:'AggregateError',message:'secret',errors:[{name:'Error',code:'ETIMEDOUT'}]};expect(safeTransportError(e)).toMatchObject({errors:[{code:'ETIMEDOUT'}]});expect(JSON.stringify(safeTransportError(e))).not.toContain('secret');});
