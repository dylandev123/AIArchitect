'use client';
import {useState} from 'react';
import {useProjectStore} from '@/store/useProjectStore';
import {generateSemantic,reviseSemantic,restoreSemantic,type SemanticSession} from '@/lib/villa/experimental/semantic-building/generation';
import {SemanticViewer} from '../semantic-building/viewer';
export function SemanticGenerationCheckpoint({mocks}:{mocks:string[]}){
 const [brief,setBrief]=useState('Compact family home with an upstairs sleeping allocation and connected garden.');
 const [response,setResponse]=useState(mocks[0]),[session,setSession]=useState<SemanticSession>(),[decisions,setDecisions]=useState<string[]>([]);
 const [projectId,setProjectId]=useState<string>();
 const [checkpoints,setCheckpoints]=useState<Record<string,string>>({});
 const project=useProjectStore(s=>s.projects.find(p=>p.id===projectId));
 function commit(next:SemanticSession){
  const store=useProjectStore.getState();const id=projectId??store.createProject('Experimental semantic study','house','direct-scene').id;
  const scene=JSON.stringify(next.scene);store.appendVersion(id,'Semantic checkpoint',scene);
  setProjectId(id);setCheckpoints(p=>({...p,[scene]:JSON.stringify(next)}));setSession(next);
 }
 function travel(direction:'undo'|'redo'){if(!projectId)return;const store=useProjectStore.getState();store[direction](projectId);
  const scene=store.getProject(projectId)!.houseConfigJson,saved=checkpoints[scene];
  if(saved){const restored=restoreSemantic(saved);setSession(restored);setResponse(JSON.stringify(restored.proposal,null,2));}
 }
 async function run(){try{
 const next=session?reviseSemantic(session,JSON.parse(response)):await generateSemantic(brief,async()=>JSON.parse(response));
 if(next.status!=='ready'){setDecisions(next.decisions);return;}
 commit(next.session);setDecisions([]);
 }catch(error){setDecisions([String(error)]);}}
 return <><style>{`#semantic-checkpoint { padding:20px; background:#f5f4ee; color:#19231e; } #semantic-checkpoint button { margin:6px 12px 6px 0; padding:8px 12px; border:1px solid #aab6ad; border-radius:4px; } #semantic-checkpoint textarea { padding:8px; border:1px solid #aab6ad; background:white; color:#19231e; vertical-align:top; }`}</style><main id="semantic-checkpoint"><h1>Experimental semantic Generate checkpoint</h1><p>Offline mocked planning responses. No model requests. Envelope studies; architectural quality unproven.</p>
 <label>Brief <textarea aria-label="Brief" value={brief} disabled={!!session} onChange={e=>setBrief(e.target.value)}/></label>
 <button onClick={()=>{setResponse(mocks[0]);setSession(undefined);setProjectId(undefined);setCheckpoints({});}}>Family mock</button><button onClick={()=>{setResponse(mocks[1]);setBrief('Multilevel luxury waterfront composition with connected living spaces and suite allocations.');setSession(undefined);setProjectId(undefined);setCheckpoints({});}}>Luxury mock</button>
 <p><label>Semantic planning response <textarea aria-label="Semantic planning response" style={{width:'100%',height:180}} value={response} onChange={e=>setResponse(e.target.value)}/></label></p>
 <button onClick={run}>{session?'Apply explicit revision':'Construct planning response'}</button>
 <button disabled={!project||project.currentVersionIndex<=1} onClick={()=>travel('undo')}>Undo</button>
 <button disabled={!project||project.currentVersionIndex>=project.versions.length-1} onClick={()=>travel('redo')}>Redo</button>
 <button disabled={!session} onClick={()=>localStorage.setItem('semantic-generation-checkpoint',JSON.stringify(session))}>Save checkpoint locally</button>
 <button onClick={()=>{try{const saved=localStorage.getItem('semantic-generation-checkpoint');if(saved)commit(restoreSemantic(saved));}catch(e){setDecisions([String(e)]);}}}>Reload checkpoint</button>
 {decisions.map((d,i)=><p key={i} role="alert">{d}</p>)}</main>
 {session&&<SemanticViewer scene={session.scene} thesis={session.proposal.intent.thesis} source="Mock AI planning response · experimental construction"/>}</>;
}
