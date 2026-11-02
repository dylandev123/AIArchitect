/** Read-only network gate. No generation endpoint, retries, response bodies or secrets logged. */
import {lookup} from 'node:dns/promises';
import {connect} from 'node:tls';
export function safeCauses(error: unknown) {
 const causes: {name:string;code?:string}[]=[];
 const seen=new Set<unknown>();
 while(error&&causes.length<6&&!seen.has(error)) {
  seen.add(error);
  const item=error as {name?:unknown;code?:unknown;cause?:unknown};
  const safe=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_]{1,80}$/.test(v)?v:undefined;
  causes.push({name:safe(item.name)??'Error',code:safe(item.code)});error=item.cause;
 }
 return causes;
}
export async function connectivityPreflight() {
 const report: Record<string,unknown>={at:new Date().toISOString(),pid:process.pid,node:process.version,endpoint:'https://api.openai.com/v1/models',method:'GET',generationRequests:0,retries:0,credentialPresent:Boolean(process.env.OPENAI_API_KEY?.trim()),environment:Object.fromEntries(['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','NODE_USE_ENV_PROXY','NODE_EXTRA_CA_CERTS','NODE_OPTIONS','OPENAI_BASE_URL'].map(k=>[k,Boolean(process.env[k])]))};
 let stage='configuration';
 try {
  if(!report.credentialPresent)throw Error('MissingCredential');
  stage='dns';
  const addresses=await lookup('api.openai.com',{all:true});
  report.dns={ok:true,addresses};
  stage='tls';
  // Probe each available address family without weakening hostname/certificate validation.
  const tlsResults=await Promise.all(([4,6] as const).filter(f=>addresses.some(a=>a.family===f)).map(async family=>{
   try {return await new Promise(resolve=>{
    const socket=connect({host:addresses.find(a=>a.family===family)!.address,port:443,servername:'api.openai.com',rejectUnauthorized:true});
    socket.setTimeout(10000,()=>socket.destroy(Object.assign(Error(),{code:'ETIMEDOUT'})));
    socket.once('secureConnect',()=>{resolve({family,ok:socket.authorized,protocol:socket.getProtocol()});socket.destroy();});
    socket.once('error',error=>resolve({family,ok:false,causes:safeCauses(error)}));
   });}catch(error){return {family,ok:false,causes:safeCauses(error)};}
  }));
  report.tls=tlsResults;
  if(!tlsResults.some(r=>(r as {ok:boolean}).ok))throw Error('TLSUnavailable');
  stage='authenticated-https';
  const response=await fetch('https://api.openai.com/v1/models',{method:'GET',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY!.trim()}`},redirect:'error',signal:AbortSignal.timeout(20000)});
  report.http={status:response.status,requestId:response.headers.get('x-request-id')};
  await response.body?.cancel();
  report.ok=response.ok;
  if(response.ok) {
   stage='provider-endpoint';
   // GET cannot create a Response. A 405 proves the exact generation path responds.
   const endpoint=await fetch('https://api.openai.com/v1/responses',{method:'GET',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY!.trim()}`},redirect:'error',signal:AbortSignal.timeout(20000)});
   report.providerEndpoint={method:'GET',status:endpoint.status,requestId:endpoint.headers.get('x-request-id')};
   const payload=await endpoint.json().catch(()=>null) as {error?:{code?:unknown;type?:unknown}}|null;
   const safe=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_]{1,80}$/.test(v)?v:undefined;
   report.providerEndpoint={...(report.providerEndpoint as object),code:safe(payload?.error?.code),type:safe(payload?.error?.type)};
   const readScopeRestricted=endpoint.status===401&&payload?.error?.code==='missing_scope';
   report.providerEndpoint={...(report.providerEndpoint as object),reachable:true,readScopeRestricted,creationPermissionVerified:false};
   report.ok=endpoint.status===405||readScopeRestricted;
   if(!report.ok)report.failureClass='unexpected-provider-endpoint-status';
  }
  if(!response.ok)report.failureClass=response.status===401?'authentication':response.status===403?'permission':response.status===429?'rate-or-quota':'http';
 }catch(error){report.ok=false;report.failureStage=stage;report.causes=safeCauses(error);}
 return report;
}
