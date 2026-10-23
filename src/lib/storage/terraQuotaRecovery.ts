/** Exact snapshot recovery: no plan checkout, normalization, or provider transport. */
import type { Project } from '@/types/project';
import { projectStorage, readProjectStorage } from './projectStorage';

export const TERRA_RESPONSE_SHA = '3b599d4ffe1a888a97610eb1622b620cc055cadfa69f84050767fd471d4c9787';
export const TERRA_SOURCE_ID = 'd4fbb3cc-b8c1-4d7f-a48f-9b2a82de11c8';
const BACKUP_SHA = '9931dd5acea82b849bf87a2a473dd151f0ce37c2e353f38fc6607761bae89c9b';
const SCENE_SHA = '45f1c70a48b791587b8045cf0fb0d4795b774d23fc87a7c8c9cff65a70049242';
const KEY = 'ai-architect-projects';
const RECORD = `exact-recovery-${TERRA_RESPONSE_SHA}`;
type Envelope = { state: { projects: Project[] }; version: number };
export interface QuotaBackup { persisted: string; live: string }
interface RecoveryRecord { before: string; project: Project; backupSha256: string; beforeUsage: ReturnType<typeof storageUsage> }
export const sha256 = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2,'0')).join('');
const equal = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }
export function storageUsage() {
  const keys = Object.keys(localStorage).map(key=>({key,characters:(localStorage.getItem(key)??'').length})).sort((a,b)=>b.characters-a.characters);
  const characters = keys.reduce((n,x)=>n+x.key.length+x.characters,0);
  return { characters, utf16Bytes: characters*2, keys };
}
async function database() {
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('ai-architect-quota-recovery');
    request.onupgradeneeded=()=>{request.transaction?.abort();reject(Error('Original backup database is missing'));};
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve(request.result);
  });
}
async function entry<T>(key: string): Promise<T | undefined> {
  const db=await database();
  try { return await new Promise<T | undefined>((resolve,reject)=>{
    const tx=db.transaction('snapshots','readonly'),get=tx.objectStore('snapshots').get(key);
    get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);
  }); } finally {db.close();}
}
export const readQuotaBackup = async () => {
  const backup=await entry<QuotaBackup>('2026-10-22');
  assert(backup && typeof backup.persisted==='string' && typeof backup.live==='string','Incomplete original snapshot');
  return backup;
};
async function addRecord(record: RecoveryRecord) {
  const db=await database();
  try { await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').add(record,RECORD);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  }); } finally {db.close();}
}
export async function verifyQuotaBackup(backup: QuotaBackup, rawResponse: string) {
  assert(await sha256(rawResponse)===TERRA_RESPONSE_SHA,'Retained provider response changed');
  assert(await sha256(JSON.stringify(backup))===BACKUP_SHA,'Original snapshot fingerprint changed');
  const persisted: Envelope=JSON.parse(backup.persisted),live: Envelope=JSON.parse(backup.live);
  assert(persisted.version===6 && live.version===6,'Unexpected storage version');
  assert(persisted.state.projects.length===56 && live.state.projects.length===56,'Unexpected project count');
  assert(new Set(live.state.projects.map(p=>p.id)).size===56,'Duplicate project identity');
  const source=live.state.projects.find(p=>p.id===TERRA_SOURCE_ID);
  assert(source && source.versions.length===2 && source.currentVersionIndex===1,'Generated history is incomplete');
  assert(source.houseConfigJson===source.versions[1].houseConfigJson,'Generated scene differs from its saved version');
  assert(await sha256(source.houseConfigJson)===SCENE_SHA,'Generated scene fingerprint changed');
  const scene=JSON.parse(source.houseConfigJson).v3Scene;
  assert(scene.metadata.planResponseSha256===TERRA_RESPONSE_SHA,'Generated scene belongs to a different response');
  const unchanged=persisted.state.projects.filter(p=>p.id!==TERRA_SOURCE_ID);
  assert(unchanged.every(p=>equal(p,live.state.projects.find(x=>x.id===p.id))),'Other live projects differ from durable backup');
  const cached=localStorage.getItem(`ai-architect-plan-response:${TERRA_RESPONSE_SHA}`);
  assert(cached && JSON.parse(cached).rawResponse===rawResponse,'Browser provider evidence differs from retained response');
  return { source, persisted, backupSha256:BACKUP_SHA, sceneSha256:SCENE_SHA, providerSha256:TERRA_RESPONSE_SHA, unchangedOtherProjects:unchanged.length, sceneCharacters:source.houseConfigJson.length, unresolvedObjects:scene.metadata.planUnresolved?.length??0, retainedRoomDrafts:scene.metadata.roomLayoutDrafts?.length??0 };
}
export async function recoverExactTerra(rawResponse: string) {
  const backup=await readQuotaBackup(),verified=await verifyQuotaBackup(backup,rawResponse);
  let record=await entry<RecoveryRecord>(RECORD);
  if (!record) {
    // Recheck immediately before adding the recovery record and immediately before saving.
    assert(readProjectStorage(KEY)===backup.persisted,'Projects changed since backup; recovery stopped before writing');
    const now=Date.now();
    const project: Project={...structuredClone(verified.source),id:crypto.randomUUID(),name:'Terra estate — exact recovered plan',createdAt:now,updatedAt:now,
      architecturalView:{mode:'floor-plan',floor:null,buildingId:null,cutaway:true},recoverySource:{sha256:TERRA_RESPONSE_SHA,originalBlueprint:rawResponse}};
    record={before:backup.persisted,project,backupSha256:verified.backupSha256,beforeUsage:storageUsage()};
    await addRecord(record);
  }
  const current=readProjectStorage(KEY);
  if(current===record.before) {
    const saved: Envelope=JSON.parse(current);
    assert(!saved.state.projects.some(p=>p.id===record.project.id),'Recovery identity collision');
    const expected=JSON.stringify({...saved,state:{...saved.state,projects:[...saved.state.projects,record.project]}});
    assert(readProjectStorage(KEY)===current,'Concurrent storage change; recovery stopped');
    projectStorage.setItem(KEY,expected);
    assert(readProjectStorage(KEY)===expected,'Lossless write/read comparison failed');
    window.dispatchEvent(new StorageEvent('storage',{key:KEY}));
  }
  return verifyRecoveredTerra(rawResponse);
}
export async function verifyRecoveredTerra(rawResponse: string) {
  const backup=await readQuotaBackup(),verified=await verifyQuotaBackup(backup,rawResponse);
  const record=await entry<RecoveryRecord>(RECORD);
  assert(record && record.before===backup.persisted && record.backupSha256===BACKUP_SHA,'Recovery record is missing or changed');
  const stored: Envelope=JSON.parse(readProjectStorage(KEY)??'null');
  assert(stored?.state?.projects?.length===57,'Expected all 56 original projects plus one recovery');
  assert(verified.persisted.state.projects.every(p=>equal(p,stored.state.projects.find(x=>x.id===p.id))),'An original project changed');
  const recovered=stored.state.projects.find(p=>p.id===record.project.id);
  assert(recovered,'Recovered project is missing');
  assert(recovered.houseConfigJson===verified.source.houseConfigJson,'Recovered scene is not byte-identical to live backup');
  assert(equal(recovered.versions,verified.source.versions),'Recovered version history changed');
  assert(recovered.currentVersionIndex===1,'Recovered workspace is not on the generated version');
  assert(recovered.recoverySource?.originalBlueprint===rawResponse,'Original provider response changed');
  return {result:'PASS',workspaceUrl:`http://localhost:3000/workspace/${recovered.id}`,originalProjectsUnchanged:56,recoveredVersions:recovered.versions.length,sceneSha256:verified.sceneSha256,providerSha256:verified.providerSha256,backupSha256:verified.backupSha256,sceneCharacters:verified.sceneCharacters,unresolvedObjects:verified.unresolvedObjects,retainedRoomDrafts:verified.retainedRoomDrafts,compressed:localStorage.getItem(KEY)?.startsWith('ai-architect:gzip:v1:'),before:record.beforeUsage,after:storageUsage()};
}
