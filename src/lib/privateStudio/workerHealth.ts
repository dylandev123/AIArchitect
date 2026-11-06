/** Local operational health only. Never starts or advances a generation job. */
import {readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export async function executionHeld(directory:string){
 try{await readFile(path.join(directory,'generation-hold.json'));return true;}
 catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}
}
export async function workerHealth(directory:string,now=Date.now()){
 const held=await executionHeld(directory);
 try{
  const value=JSON.parse(await readFile(path.join(directory,'worker-heartbeat.json'),'utf8'));
  return {held,available:Number.isFinite(value.at)&&value.at<=now&&now-value.at<8000,lastSeen:value.at as number};
 }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;return {held,available:false};}
}
export async function recordWorkerHeartbeat(directory:string){
 const temp=path.join(directory,`heartbeat-${randomUUID()}.tmp`);
 await writeFile(temp,JSON.stringify({at:Date.now(),pid:process.pid}),{mode:0o600});
 await rename(temp,path.join(directory,'worker-heartbeat.json'));
}
