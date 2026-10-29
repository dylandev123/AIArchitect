import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';

/** Development transport for the installed AI SDK; never retries a create. */
export function backgroundResponseFetch(directory:string, resume:boolean, options:{fetch?:typeof fetch; pause?:()=>Promise<void>; maxPolls?:number}={}) : typeof fetch {
 const transport=options.fetch??fetch;
 let invoked=false;
 return async (url,init) => {
  if(invoked)throw Error('Only one SDK invocation is allowed.');
  invoked=true;
  if(String(url)!=='https://api.openai.com/v1/responses'||init?.method!=='POST'||typeof init.body!=='string')throw Error('Expected the SDK Responses endpoint.');
  const body=JSON.stringify({...JSON.parse(init.body),background:true,store:true});
  const fingerprint=createHash('sha256').update(body).digest('hex');
  const statePath=`${directory}/state.json`;
  type State={clientRequestId:string;fingerprint:string;responseId?:string;status:string;usage:unknown;requestId?:string|null};
  let state:State;
  const save=async()=>{await writeFile(`${statePath}.tmp`,JSON.stringify(state,null,2),{mode:0o600});await rename(`${statePath}.tmp`,statePath);};
  const headers=new Headers(init.headers);
  let response:Response;
  if(resume){
   state=JSON.parse(await readFile(statePath,'utf8'));
   if(state.fingerprint!==fingerprint)throw Error('Frozen request changed; refusing recovery.');
   if(!state.responseId)throw Error('Acceptance unknown: no provider response ID. Do not resubmit.');
   headers.set('X-Client-Request-Id',state.clientRequestId);
   const terminal=await readFile(`${directory}/terminal.json`,'utf8').catch(()=>null);
   if(terminal){
    if(JSON.parse(terminal).status!=='completed')throw Error('Retained response is terminal and unsuccessful; no resubmission.');
    return new Response(terminal,{status:200,headers:{'content-type':'application/json'}});
   }
   response=await transport(`${url}/${encodeURIComponent(state.responseId)}`,{method:'GET',headers,signal:AbortSignal.timeout(60000)});
  }else{
   // Exclusive directory is the durable submission lock, including across processes.
   await mkdir(directory,{mode:0o700});
   state={clientRequestId:randomUUID(),fingerprint,status:'submitting-acceptance-unknown',usage:null};
   await save();
   await writeFile(`${directory}/request.json`,body,{flag:'wx',mode:0o600});
   headers.set('X-Client-Request-Id',state.clientRequestId);
   response=await transport(url,{...init,headers,body,signal:AbortSignal.timeout(60000)});
  }
  for(let poll=0;;poll++){
   // Save raw bytes and safe correlation headers before parsing or SDK validation.
   const raw=await response.text();
   const tag=`${Date.now()}-${randomUUID()}`;
   await writeFile(`${directory}/${tag}.raw.json`,raw,{flag:'wx',mode:0o600});
   await writeFile(`${directory}/${tag}.http.json`,JSON.stringify({status:response.status,requestId:response.headers.get('x-request-id'),clientRequestId:state.clientRequestId}),{flag:'wx',mode:0o600});
   if(!response.ok)throw Error(`Provider HTTP ${response.status}; raw response retained. Resume explicitly; no automatic retries.`);
   const value=JSON.parse(raw);
   if(typeof value.id!=='string'||!/^resp_[A-Za-z0-9_-]+$/.test(value.id))throw Error('Missing provider response ID.');
   if(state.responseId&&state.responseId!==value.id)throw Error('Provider response ID changed.');
   state={...state,responseId:value.id,status:value.status,usage:value.usage??null,requestId:response.headers.get('x-request-id')};
   await save();
   if(!['queued','in_progress'].includes(value.status)){
    await writeFile(`${directory}/terminal.json`,raw,{mode:0o600});
    if(value.status!=='completed')throw Error(`Provider terminal status ${value.status}; output and actual usage retained; no resubmission.`);
    return new Response(raw,{status:200,headers:response.headers});
   }
   if(poll>=(options.maxPolls??180))throw Error('Polling window ended. Resume this directory; generation was not cancelled.');
   await (options.pause?.()??delay(5000));
   response=await transport(`${url}/${encodeURIComponent(value.id)}`,{method:'GET',headers,signal:AbortSignal.timeout(60000)});
  }
 };
}
