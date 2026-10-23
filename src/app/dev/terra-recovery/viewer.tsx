'use client';
import { useState } from 'react';
import { readProjectStorage } from '@/lib/storage/projectStorage';
import { readQuotaBackup, verifyQuotaBackup, recoverExactTerra, verifyRecoveredTerra, storageUsage, sha256 } from '@/lib/storage/terraQuotaRecovery';
export function TerraRecovery({rawResponse}:{rawResponse:string;sha256:string}) {
  const [report,setReport]=useState('Ready for read-only integrity verification.');
  const [url,setUrl]=useState(''),[busy,setBusy]=useState(false),[verified,setVerified]=useState(false);
  const [exportUrl,setExportUrl]=useState(''),[evidenceUrl,setEvidenceUrl]=useState('');
  async function run(action:'inspect'|'recover'|'verify') {
    setBusy(true);
    try {
      let result;
      if(action==='inspect'){
        const backup=await readQuotaBackup(),check=await verifyQuotaBackup(backup,rawResponse);
        result={result:'PASS',backupSha256:check.backupSha256,sceneSha256:check.sceneSha256,providerSha256:check.providerSha256,projects:check.persisted.state.projects.length,sourceVersions:check.source.versions.length,sceneCharacters:check.sceneCharacters,unresolvedObjects:check.unresolvedObjects,retainedRoomDrafts:check.retainedRoomDrafts,storage:storageUsage()};
        setVerified(true);
      }else{
        result=await(action==='recover'?recoverExactTerra(rawResponse):verifyRecoveredTerra(rawResponse));
        setUrl(result.workspaceUrl);
        const backup=await readQuotaBackup();
        const otherKeys=await Promise.all(Object.keys(localStorage).filter(k=>k!=='ai-architect-projects').sort().map(async key=>({key,sha256:await sha256(localStorage.getItem(key)??'')})));
        const evidence=JSON.stringify({verification:result,backup,rawProjectStorage:localStorage.getItem('ai-architect-projects'),decodedProjects:readProjectStorage('ai-architect-projects'),otherKeys,rawResponse},null,2);
        setEvidenceUrl(old=>{if(old)URL.revokeObjectURL(old);return URL.createObjectURL(new Blob([evidence],{type:'application/json'}));});
      }
      const text=JSON.stringify(result,null,2);setReport(text);
      setExportUrl(old=>{if(old)URL.revokeObjectURL(old);return URL.createObjectURL(new Blob([text],{type:'application/json'}));});
    }catch(e){setReport(String(e));}finally{setBusy(false);}
  }
  return <main className="min-h-screen bg-neutral-950 p-8 text-neutral-100"><h1 className="text-2xl">Exact Terra recovery</h1><p>Original snapshots and provider response are retained. Recovery adds one separate workspace.</p><div className="my-4 flex gap-4"><button disabled={busy} className="rounded bg-emerald-300 p-3 text-black" onClick={()=>void run('inspect')}>Verify original backup</button><button disabled={busy||!verified} className="rounded bg-emerald-300 p-3 text-black disabled:opacity-40" onClick={()=>void run('recover')}>Recover exact plan</button><button disabled={busy} className="rounded border p-3" onClick={()=>void run('verify')}>Independently verify saved recovery</button>{exportUrl&&<a className="underline" download="terra-recovery-verification.json" href={exportUrl}>Download verification</a>}{evidenceUrl&&<a className="underline" download="terra-recovery-after.json" href={evidenceUrl}>Download recovery evidence</a>}{url&&<a className="underline" href={url}>Open recovered workspace</a>}</div><div aria-label="Recovery verification" className="bg-neutral-900 p-4 font-mono text-xs">{report.split('\n').map((line,i)=><p className="whitespace-pre-wrap" key={i}>{line||' '}</p>)}</div></main>;
}
