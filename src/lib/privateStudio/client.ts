/** Browser-only workflow helpers. No provider or credentials. */
export interface AvailableApproval {projectId?:string;briefHash:string}
export function draftKey(projectId:string){return `private-studio-draft:${projectId}`;}
export function readDraft(storage:Pick<Storage,'getItem'>,projectId:string,fallback:string){
 try{return storage.getItem(draftKey(projectId))??fallback;}catch{return fallback;}
}
export function writeDraft(storage:Pick<Storage,'setItem'>,projectId:string,brief:string){
 storage.setItem(draftKey(projectId),brief);
}
export async function matchesApproval(approvals:AvailableApproval[],projectId:string,brief:string){
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(brief.trim()))),v=>v.toString(16).padStart(2,'0')).join('');
 return approvals.some(a=>(!a.projectId||a.projectId===projectId)&&a.briefHash===hash);
}
export async function startOrAdvance<T extends {runId:string;stage:number}>(post:(body:unknown)=>Promise<T>,current:T|undefined,projectId:string,brief:string,onStarted?:(run:T)=>void){
 const run=current??await post({action:'start',projectId,brief});
 if(!current)onStarted?.(run);
 return post({action:'advance',runId:run.runId,stage:run.stage+1,key:crypto.randomUUID()});
}
