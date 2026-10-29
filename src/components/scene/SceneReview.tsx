'use client';
/* Captured PNG bytes must be shown unmodified for architectural comparison. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState, useEffect } from 'react';
import { ReviewPreview } from '@/app/dev/villa-playground/review-preview';
import { reviewSchema, stageSceneReviewEdit, type SceneCapture } from '@/lib/villa/visual-review';
import { compareSceneEvidence, sceneVisualEvidence } from '@/lib/villa/scene/visualEvidence';
import { transferableLessonSchema } from '@/lib/villa/design-learning';
import type { SceneOperation } from '@/lib/villa/scene/model';
import type { ArchitecturalScene } from '@/lib/villa/scene/model';

type Reference = {source:string;image:string};
type Proposal = {operations:SceneOperation[];review:ReturnType<typeof reviewSchema.parse>;scene:ArchitecturalScene;baseline:string;brief:string;reference?:Reference;before:ArchitecturalScene;beforeCaptures:SceneCapture[];afterCaptures:SceneCapture[]};
/** Reuses the review captures, scope validator, executor and immutable learning records. */
export function SceneReview({scene, reference, brief, current, commit}:{scene:ArchitecturalScene;reference?:Reference;brief:string;current:()=>ArchitecturalScene;commit:(scene:ArchitecturalScene)=>void}) {
  const [authorized,setAuthorized]=useState(false);
  const [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [feedback,setFeedback]=useState('');
  const [recordPrinciple,setRecordPrinciple]=useState(false);
  const [lessonDraft,setLessonDraft]=useState({title:'',context:'',problem:'',rootCause:'',correction:'',rationale:'',exceptions:'',confidence:'medium',tags:''});
  const [proposal,setProposal]=useState<Proposal>();
  const [capture,setCapture]=useState<{scene:ArchitecturalScene;view:SceneCapture['view'];pose?:SceneCapture['camera'];ready:(shot:SceneCapture)=>void;fail:(error:string)=>void}>();
  const lock=useRef(false), mounted=useRef(true), latest=useRef({brief,reference});
  useEffect(()=>{latest.current={brief,reference};},[brief,reference]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  async function shots(config:ArchitecturalScene, poses?:SceneCapture[]) {
    const result:SceneCapture[]=[];
    for(const view of ['Aerial','Arrival','Poolside','Facade'] as const) {
      if(!mounted.current) throw Error('Review closed.');
      result.push(await new Promise<SceneCapture>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Capture timed out. Original preserved.')),30000);
        setCapture({scene:config,view,pose:poses?.find(p=>p.view===view)?.camera,ready:shot=>{clearTimeout(timer);resolve(shot);},fail:error=>{clearTimeout(timer);reject(Error(error));}});
      }));
    }
    setCapture(undefined);return result;
  }
  async function post(url:string, input:unknown) {
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(175000)});
    const output=await response.json();if(!response.ok)throw Error(output.error || 'Review failed');return output;
  }
  async function evaluate() {
    if(lock.current||!authorized)return;setAuthorized(false);lock.current=true;setBusy(true);setProposal(undefined);
    const original=structuredClone(scene), baseline=JSON.stringify(original), context=JSON.stringify({brief,reference});
    const assertCurrent=()=>{if(!mounted.current || JSON.stringify(current())!==baseline || JSON.stringify(latest.current)!==context)throw Error('Design or reference changed. Evaluate again.');};
    try {
      setMessage('Capturing four exterior views…');
      const beforeCaptures=await shots(original);assertCurrent();
      const reviewResponse=await post('/api/ai/villa/visual-review',{brief,current:original,reference,unresolved:sceneVisualEvidence(original).geometryWarnings.map(i=>`${i.id}: ${i.message}`).slice(0,30),images:beforeCaptures.map(s=>s.image)});
      const review=reviewSchema.parse(reviewResponse.review);assertCurrent();setMessage([...review.weaknesses, review.improvement ?? 'No supported improvement proposed.'].join(' '));
      if(!review.improvement)return;
      const output=await post('/api/ai/scene',{mode:'edit',editIntent:review.editIntent ?? 'refine',current:original,reference,prompt:`${review.improvement}. Allowed element IDs (element: prefix) or legacy leaf paths: ${JSON.stringify(review.scope)}. Preserve unrelated geometry and terrain. Use only declared IDs, including new IDs. Coordinate dependent repairs atomically.`});
      assertCurrent();
      const staged=stageSceneReviewEdit(original,review.improvement,{architecturalPlan:output.architecturalPlan,name:output.name,summary:output.summary,unsupported:output.unsupported,operations:output.operations},review.scope,review.editIntent);
      const afterCaptures=await shots(staged.scene,beforeCaptures);assertCurrent();
      setMessage(JSON.stringify({weaknesses:review.weaknesses,reviewUsage:reviewResponse.usage,reviewCostUsd:reviewResponse.costUsd,revisionUsage:output.usage,revisionCostUsd:output.costUsd,quality:'Unverified until human comparison'},null,2));
      setFeedback('');setProposal({operations:staged.operations,review,scene:staged.scene,baseline,brief,reference,before:original,beforeCaptures,afterCaptures});
    } catch(error){setMessage(String(error));}finally{setCapture(undefined);setBusy(false);lock.current=false;}
  }
  async function decide(verdict:'improved'|'rejected') {
    if(!proposal||lock.current)return;lock.current=true;setBusy(true);
    try {
      if(JSON.stringify(current())!==proposal.baseline||brief!==proposal.brief||JSON.stringify(reference)!==JSON.stringify(proposal.reference))throw Error('Design changed. Evaluate again.');
      const saved=await post('/api/dev/villa-design-lessons',{version:1,brief,verdict,feedback,before:proposal.before,after:proposal.scene,beforeCaptures:proposal.beforeCaptures,afterCaptures:proposal.afterCaptures,reference:proposal.reference,origin:'terra',...(recordPrinciple?{transferable:transferableLessonSchema.parse({...lessonDraft,tags:lessonDraft.tags.split(',').map(t=>t.trim()).filter(Boolean)})}:{}),correction:{operations:proposal.operations,weaknesses:proposal.review.weaknesses,scope:proposal.review.scope,improvement:proposal.review.improvement ?? undefined,editIntent:proposal.review.editIntent}});
      if(JSON.stringify(current())!==proposal.baseline||latest.current.brief!==proposal.brief||JSON.stringify(latest.current.reference)!==JSON.stringify(proposal.reference))throw Error('Design changed while saving. Feedback retained; scene preserved.');
      if(verdict==='improved')commit(proposal.scene);
      setProposal(undefined);setMessage(`Reviewed feedback saved. ${saved.knowledge?`Knowledge ${saved.knowledge.id}: ${saved.knowledge.status}. Separate authorized knowledge review is required.`:''}`);
    }catch(error){setMessage(String(error));}finally{setBusy(false);lock.current=false;}
  }
  return <details><summary>Visual review</summary><p>Review four views and the reference, then approve or reject one scoped proposal. Quality remains a user judgment. Four 640 × 360 images enter one review. A revision uses text and scene operations; a supplied reference adds image usage. No retries or automatic follow-up reviews.</p>
    <button type="button" disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{const snapshot=structuredClone(scene);const captures=await shots(snapshot);const artifact={responseId:snapshot.generationResponseId??null,capturedAt:new Date().toISOString(),scene:snapshot,evidence:sceneVisualEvidence(snapshot),captures,provenance:'Actual browser renders of this scene snapshot; no AI review'};const url=URL.createObjectURL(new Blob([JSON.stringify(artifact,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`scene-${snapshot.generationResponseId??'unlinked'}-render-evidence.json`;link.click();URL.revokeObjectURL(url);setMessage('Four rendered views exported with scene snapshot and generation ID. Zero provider calls.');}catch(error){setMessage(String(error));}finally{setCapture(undefined);setBusy(false);lock.current=false;}}}>Export diagnostic screenshots (offline)</button>
    <label><input type="checkbox" checked={authorized} disabled={busy} onChange={e=>setAuthorized(e.target.checked)}/> Authorize one paid visual review and at most one paid revision; no retries</label>
    <button type="button" disabled={busy||!brief.trim()||!authorized} onClick={evaluate}>Evaluate scene</button>
    <p role="status">{message}</p>
    {capture && <ReviewPreview key={`${capture.view}-${JSON.stringify(capture.scene)}`} config={capture.scene} view={capture.view} cameraPose={capture.pose} ready={capture.ready} onError={capture.fail} responsive />}
    {proposal && <><p>Before / proposed · architectural improvement remains unverified until human review</p><pre>{JSON.stringify(compareSceneEvidence(proposal.before,proposal.scene),null,2)}</pre>{proposal.beforeCaptures.map((shot,i)=><div key={shot.view}><img alt={`${shot.view} before`} src={shot.image} width={240}/><img alt={`${shot.view} proposed`} src={proposal.afterCaptures[i].image} width={240}/></div>)}<label>Review feedback<textarea aria-label="Review feedback" value={feedback} onChange={ev=>setFeedback(ev.target.value)}/></label><fieldset><legend>Reusable architectural lesson</legend><label><input type="checkbox" checked={recordPrinciple} onChange={e=>setRecordPrinciple(e.target.checked)}/> Propose a transferable lesson for separate knowledge approval</label>{recordPrinciple && <>{(['title','context','problem','rootCause','correction','rationale','exceptions','tags'] as const).map(field=><label key={field}>{({title:'Lesson title',context:'When this applies',problem:'Original weakness',rootCause:'Root cause, if established',correction:'Successful correction or rejected approach',rationale:'Why it worked or failed',exceptions:'Scope, exceptions and uncertainty',tags:'Relevant terms, separated by commas'})[field]}<textarea maxLength={field==='title'?120:500} value={lessonDraft[field]} onChange={e=>setLessonDraft(d=>({...d,[field]:e.target.value}))}/></label>)}<label>Confidence<select value={lessonDraft.confidence} onChange={e=>setLessonDraft(d=>({...d,confidence:e.target.value}))}><option>low</option><option>medium</option><option>high</option></select></label><p>Saved as proposed knowledge. An authorized reviewer must approve the transferable principle before Generate can retrieve it.</p></>}</fieldset><button disabled={busy||feedback.trim().length<20} onClick={()=>decide('improved')}>Approve scene proposal</button><button disabled={busy||feedback.trim().length<20} onClick={()=>decide('rejected')}>Reject scene proposal</button></>}
  </details>;
}
