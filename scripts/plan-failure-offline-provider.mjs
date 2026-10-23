// Test-only preload: synthetic failures/fixtures, dummy credentials, no external sockets.
import { appendFileSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
const cases=JSON.parse(process.env.OFFLINE_PLAN_CASES||'[]'),log=process.env.OFFLINE_PLAN_LOG;
if(!cases.length||!log)throw Error('Offline cases and log are required');
for(const key of ['DATABASE_URL','POSTGRES_URL','VERCEL','OPENAI_ORG_ID','OPENAI_PROJECT_ID'])process.env[key]='';
process.env.OPENAI_API_KEY='offline-placeholder-never-sent';
process.env.NEXT_TELEMETRY_DISABLED='1';
const record=value=>appendFileSync(log,JSON.stringify(value)+'\n');
const loopback=host=>['localhost','127.0.0.1','::1','[::1]'].includes(host);
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){
  const options=Array.isArray(args[0])?args[0][0]:args[0];
  const host=typeof options==='object'?options.host:typeof args[1]==='string'?args[1]:'localhost';
  if(host&&!loopback(host)){record({blockedSocket:host});throw Error('Offline test forbids external sockets');}
  return connect.apply(this,args);
};
syncBuiltinESMExports();
const originalFetch=globalThis.fetch;
let index=0;
globalThis.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'||input instanceof URL?input:input.url);
  if(url.origin==='https://api.openai.com'&&url.pathname==='/v1/responses'){
    const item=cases[index++];
    if(!item)throw Error('Unexpected extra provider attempt');
    record({synthetic:true,index:index-1,name:item.name,status:item.status??200});
    if(item.status)return Response.json({error:{message:'Synthetic test error; original provider body unavailable',...(item.code?{code:item.code}:{})}},{status:item.status});
    const request=JSON.parse(init.body);
    return Response.json({id:`offline-${index}`,model:request.model,created_at:1,status:'completed',output:[{type:'message',id:`offline-msg-${index}`,role:'assistant',status:'completed',content:[{type:'output_text',text:readFileSync(item.file,'utf8'),annotations:[]}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150}});
  }
  if(!loopback(url.hostname)){record({blockedFetch:url.origin+url.pathname});throw Error('Offline test forbids external fetch');}
  return originalFetch(input,init);
};
