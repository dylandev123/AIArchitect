/** Offline only. This module has no import path to a paid provider. */
import {z} from 'zod';
import {advancePromptRun,promptInput,type PromptRun} from '@/lib/villa/staged/promptGeneration';
import {mockDesignerFor} from '@/lib/villa/staged/promptMocks';
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('start'),...promptInput.shape}).strict(),
 z.object({action:z.literal('advance'),runId:z.string().uuid()}).strict(),
]);
const runs=new Map<string,{run:PromptRun;designer:ReturnType<typeof mockDesignerFor>;busy:boolean;expires:number}>();
export async function POST(request:Request){
 if(!['development','test'].includes(process.env.NODE_ENV??'')||process.env.VERCEL==='1')return Response.json({error:'Not found'},{status:404});
 const origin=new URL(request.url).origin;
 if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Same-origin request required'},{status:403});
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 try{
  const text=await request.text();if(text.length>8000)return reply({error:'Request too large'},413);
  const body=input.parse(JSON.parse(text));
  for(const [id,r] of runs)if(r.expires<Date.now()&&!r.busy)runs.delete(id);
  let runId:string;
  if(body.action==='start'){
   if(runs.size>=20)return reply({error:'Offline run capacity reached; restart the local server to clear old runs.'},429);
   const parsed=promptInput.parse({brief:body.brief,site:body.site});
   const designer=mockDesignerFor(parsed.brief);
   runId=crypto.randomUUID();runs.set(runId,{run:{input:parsed},designer,busy:false,expires:Date.now()+3600000});
  }else runId=body.runId;
  const entry=runs.get(runId);if(!entry)return reply({error:'Offline run expired. Existing browser checkpoints remain available; start a new run.'},404);
  if(entry.busy)return reply({error:'A stage is already running'},409);
  entry.busy=true;
  try{return reply({...await advancePromptRun(entry.run,entry.designer),runId,providerCalls:0,provenance:entry.designer.label});}
  finally{entry.busy=false;}
 }catch(e){return reply({error:(e as Error).message,providerCalls:0,costUsd:0},422);}
}
