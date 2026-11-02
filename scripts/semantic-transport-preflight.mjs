/** GET-only gate. Runs in the generation runner, with its native fetch and credentials. */
import {lookup} from 'node:dns/promises';
import {connect} from 'node:tls';
import {createHash} from 'node:crypto';
const safe=v=>typeof v==='string'&&/^[A-Za-z0-9_.:-]{1,100}$/.test(v)?v:undefined;
export function safeTransportError(error,seen=new Set()) {
 if(!error||seen.has(error)||seen.size>=8)return undefined;
 seen.add(error);
 return {name:safe(error.name),code:safe(error.code),syscall:safe(error.syscall),hostname:error.hostname==='api.openai.com'?error.hostname:undefined,cause:safeTransportError(error.cause,seen),errors:Array.isArray(error.errors)?error.errors.slice(0,4).map(e=>safeTransportError(e,seen)):undefined};
}
export async function semanticTransportPreflight(request,wire) {
 const r={at:new Date().toISOString(),pid:process.pid,node:process.version,platform:process.platform,arch:process.arch,cwd:process.cwd(),executionContext:process.env.SEMANTIC_EXECUTION_CONTEXT??'unspecified',requestSha256:createHash('sha256').update(wire).digest('hex'),requestBytes:Buffer.byteLength(wire),model:request.model,maxOutputTokens:request.max_output_tokens,generationRequests:0,retries:0,creationPermissionVerified:false,environment:Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','NODE_USE_ENV_PROXY','NODE_EXTRA_CA_CERTS','NODE_OPTIONS','OPENAI_BASE_URL'].map(k=>[k,Boolean(process.env[k])]))};
 let stage='configuration';
 try {
  if(!process.env.OPENAI_API_KEY?.trim())throw Object.assign(Error(),{code:'MISSING_CREDENTIAL'});
  stage='dns';r.dns={addresses:await lookup('api.openai.com',{all:true}),ok:true};
  stage='tls';r.tls=await Promise.all([...new Set(r.dns.addresses.map(a=>a.family))].map(family=>new Promise(resolve=>{
   const socket=connect({host:r.dns.addresses.find(a=>a.family===family).address,port:443,servername:'api.openai.com',rejectUnauthorized:true});
   socket.setTimeout(10000,()=>socket.destroy(Object.assign(Error(),{code:'ETIMEDOUT'})));
   socket.once('secureConnect',()=>{resolve({family,ok:socket.authorized,protocol:socket.getProtocol()});socket.destroy();});
   socket.once('error',e=>resolve({family,ok:false,error:safeTransportError(e)}));
  })));
  if(!r.tls.some(t=>t.ok))throw Object.assign(Error(),{code:'TLS_UNAVAILABLE'});
  const headers={Authorization:`Bearer ${process.env.OPENAI_API_KEY}`};
  const get=async path=>{const response=await fetch(`https://api.openai.com/v1/${path}`,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(20000)});const data=await response.json().catch(()=>null);return {status:response.status,requestId:response.headers.get('x-request-id'),model:data?.id,code:safe(data?.error?.code),type:safe(data?.error?.type)};};
  stage='model-access';r.modelAccess=await get(`models/${encodeURIComponent(request.model)}`);
  if(r.modelAccess.status!==200||r.modelAccess.model!==request.model)throw Object.assign(Error(),{code:'MODEL_ACCESS_FAILED'});
  stage='responses-reachability';r.responses=await get('responses');
  r.responses.readScopeRestricted=r.responses.status===401&&r.responses.code==='missing_scope';
  if(!([200,405].includes(r.responses.status)||r.responses.readScopeRestricted))throw Object.assign(Error(),{code:'RESPONSES_PROBE_FAILED'});
  r.ok=true;r.authorizationCaveat='Model GET authenticates and confirms visibility. Responses GET tests reachability/read permission only; it cannot certify response creation permission, quota or exact payload acceptance.';
 }catch(e){r.ok=false;r.failureStage=stage;r.error=safeTransportError(e);}
 return r;
}
