import {recordWorkerHeartbeat} from './workerHealth';
import {PrivateStudioService} from './service';
import {studioStore} from './store';
/** Single-machine development worker. The durable reservation is the cross-process mutex.
 * No historical/manual runs are eligible. Unknown requests are never retried. */
export function startStudioWorker(service=new PrivateStudioService(studioStore)){
 let active=false,heartbeatActive=false;
 const beat=async()=>{
  if(heartbeatActive)return;heartbeatActive=true;
  try{await service.store.init();await recordWorkerHeartbeat(service.store.directory);}
  catch{console.error('Private Studio worker heartbeat unavailable.');}
  finally{heartbeatActive=false;}
 };
 void beat();const heartbeat=setInterval(()=>void beat(),2000);
 heartbeat.unref();
 const timer=setInterval(async()=>{
  if(active)return;
  active=true;
  try{await service.tick();}
  catch{console.error('Private Studio worker storage unavailable; paid work not retried.');}
  finally{active=false;}
 },1000);
 timer.unref();
 return ()=>{clearInterval(timer);clearInterval(heartbeat);};
}
