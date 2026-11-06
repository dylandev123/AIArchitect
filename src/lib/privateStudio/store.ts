/** Single-machine, fail-closed durable store. Never use this backend on serverless hosts. */
import {mkdir,open,readFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import type {PromptRun} from '@/lib/villa/staged/promptGeneration';
import type {Usage,Checkpoint} from '@/lib/villa/staged/pipeline';
import {StudioError} from './policy';
export interface Session{owner:string;csrf:string;expires:number}
export interface Call {normalizations?:import('@/lib/villa/staged/normalize').Normalization[];responseBody?:string;httpStatus?:number;wireRequestBody?:string;phase?:'validating'|'finished';checkpoint?:Checkpoint;executionException?:{message:string;stack?:string};raw?:string;request?:{system:string;prompt:string};id:string;runId:string;stage:number;purpose?:'design'|'correction';wireBound?:number;key:string;status:'reserved'|'settled'|'unknown';reservation:number;costMicros?:number;usage?:Usage;providerUsage?:unknown;/** Estimated provider bill at published per-category rates (costMicros is the budget charge). Absent on records settled before 2026-11-06. */billedMicros?:number;requestId?:string;finishReason?:string;error?:string;createdAt:number;finishedAt?:number;limitViolation?:boolean}
export interface Run {id:string;owner:string;projectId:string;source:PromptRun;automatic?:boolean;cancelRequested?:boolean;executionError?:string;state:'ready'|'running'|'failed'|'complete'|'uncertain'|'cancelled';policyHash:string;callIds:string[];lastResponse?:unknown;runningSince?:number}
export interface State{
 version:1;account?:{owner:string;salt:string;hash:string};sessions:Record<string,Session>;
 loginFailures:number;lockedUntil:number;
 projects:Record<string,{owner:string;name:string;runId?:string;save?:string}>;
 runs:Record<string,Run>;calls:Record<string,Call>;
 approvals:{id:string;owner:string;projectId?:string;briefHash:string;policyHash:string;approvedAt:string;consumedBy?:string}[];
}
const blank=():State=>({version:1,sessions:{},loginFailures:0,lockedUntil:0,projects:{},runs:{},calls:{},approvals:[]});
export class StudioStore{
 constructor(readonly directory=path.join(process.cwd(),'.data/private-studio')){}
 async init(){
  await mkdir(this.directory,{recursive:true,mode:0o700});
  try{await readFile(path.join(this.directory,'state.json'));return;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  // Never return or log the bootstrap secret. It is read locally by the developer only.
  try{const file=await open(path.join(this.directory,'setup-code'),'wx',0o600);try{await file.writeFile(randomBytes(32).toString('hex'));await file.sync();}finally{await file.close();}}
  catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
 }
 async transaction<T>(fn:(state:State)=>T|Promise<T>):Promise<T>{
  await this.init();const lock=path.join(this.directory,'transaction.lock');
  let fd;
  // Bounded storage-lock wait only. This never retries a provider call or breaks a stale lock.
  for(let attempt=0;attempt<50;attempt++){
   try{fd=await open(lock,'wx',0o600);break;}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;if(attempt===49)throw new StudioError(409,'Store busy or interrupted transaction; read status later. Never automatically retry paid work.');await new Promise(resolve=>setTimeout(resolve,20));}
  }
  if(!fd)throw new StudioError(503,'Private store lock unavailable');
  try{
   let state:State;try{state=JSON.parse(await readFile(path.join(this.directory,'state.json'),'utf8'));if(state.version!==1)throw Error('Unsupported private Studio state');}
   catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')state=blank();else throw e;}
   const result=await fn(state);
   const temp=path.join(this.directory,`${randomBytes(12).toString('hex')}.tmp`),file=await open(temp,'wx',0o600);
   try{await file.writeFile(JSON.stringify(state));await file.sync();}finally{await file.close();}
   await rename(temp,path.join(this.directory,'state.json'));
   const dir=await open(this.directory,'r');try{await dir.sync();}finally{await dir.close();}
   return result;
  }finally{await fd.close();await unlink(lock);}
 }
}
export const studioStore=new StudioStore();
