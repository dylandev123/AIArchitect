import {afterEach,expect,it,vi} from 'vitest';
import {EventEmitter} from 'node:events';
vi.mock('node:dns/promises',()=>({lookup:vi.fn()}));
vi.mock('node:tls',()=>({connect:vi.fn()}));
import {lookup} from 'node:dns/promises';
import {connect} from 'node:tls';
import {connectivityPreflight,safeCauses} from '../../../scripts/reference-connectivity';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('retains structured DNS failure without messages or credentials and sends no HTTP',async()=>{
 vi.stubEnv('OPENAI_API_KEY','secret-test');
 vi.mocked(lookup).mockRejectedValueOnce(Object.assign(Error('secret-test'),{code:'ENOTFOUND'}));
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const result=await connectivityPreflight();
 expect(result).toMatchObject({ok:false,failureStage:'dns',causes:[{name:'Error',code:'ENOTFOUND'}],generationRequests:0});
 expect(fetch).not.toHaveBeenCalled();expect(JSON.stringify(result)).not.toContain('secret-test');
});
it('uses authenticated GET only and accepts IPv4 TLS despite unreachable IPv6',async()=>{
 vi.stubEnv('OPENAI_API_KEY','secret-test');
 vi.mocked(lookup).mockResolvedValueOnce([{address:'192.0.2.1',family:4},{address:'2001:db8::1',family:6}] as never);
 vi.mocked(connect).mockImplementationOnce((()=>{
  const socket=Object.assign(new EventEmitter(),{authorized:true,setTimeout:vi.fn(),destroy:vi.fn(),getProtocol:()=> 'TLSv1.3'});
  queueMicrotask(()=>socket.emit('secureConnect'));return socket;
 }) as never).mockImplementationOnce((()=>{
  const socket=Object.assign(new EventEmitter(),{setTimeout:vi.fn(),destroy:vi.fn()});
  queueMicrotask(()=>socket.emit('error',Object.assign(Error('secret-test'),{code:'EHOSTUNREACH'})));return socket;
 }) as never);
 const fetch=vi.fn().mockResolvedValueOnce(new Response('{}',{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'missing_scope',type:'invalid_request_error',message:'secret-test'}}),{status:401}));vi.stubGlobal('fetch',fetch);
 const result=await connectivityPreflight();
 expect(result.ok).toBe(true);
 expect(result.providerEndpoint).toMatchObject({reachable:true,readScopeRestricted:true,creationPermissionVerified:false});expect(fetch).toHaveBeenCalledTimes(2);
 expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/models',expect.objectContaining({method:'GET',redirect:'error',headers:{Authorization:'Bearer secret-test'}}));
 expect(JSON.stringify(result)).not.toContain('secret-test');
});
it('bounds cyclic exception chains and rejects arbitrary codes',()=>{
 const error={name:'Error',code:'secret / text',cause:null as unknown};error.cause=error;
 expect(safeCauses(error)).toEqual([{name:'Error',code:undefined}]);
});
