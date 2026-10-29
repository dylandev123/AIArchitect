'use client';
import { VILLA_CLIENT_TIMEOUT_MS } from '@/lib/villa/requestLifecycle';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { requestReviewProposal, visualReviewRequestSchema, changedPaths, type ReviewConfig, type SceneCapture } from '@/lib/villa/visual-review';
import { ReviewPreview } from './review-preview';
import type { View } from './scene';
import styles from './villa.module.css';
const views: View[] = ['Aerial', 'Arrival', 'Poolside'];
export function VisualReview({ reference, current, brief, setBrief, unresolved, revision, accept }: { reference?: {source:string;image:string}; current: ReviewConfig; brief: string; setBrief: (brief: string) => void; unresolved: string[]; revision: number; accept: (config: ReviewConfig, baseline: string, revision: number) => void }) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const latest = useRef({ revision, brief });
  useEffect(() => { latest.current = { revision, brief }; }, [revision, brief]);
  const [briefDraft, setBriefDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [capture, setCapture] = useState<{ config: ReviewConfig; view: View; ready: (image: SceneCapture) => void; onError: (message: string) => void; cameraPose?:SceneCapture['camera'] }>();
  const [images, setImages] = useState<SceneCapture[]>([]);
  const [proposal, setProposal] = useState<{ original: ReviewConfig; config: ReviewConfig; baseline: string; brief: string; revision: number; captures: SceneCapture[]; afterCaptures:SceneCapture[]; mock:boolean }>();
  const [feedback,setFeedback]=useState('');
  const [saving,setSaving]=useState(false);
  const [view, setView] = useState<View>('Arrival');
  const [message, setMessage] = useState('');
  const [approved, setApproved] = useState(false);
  async function evaluate(mock: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setApproved(false); setProposal(undefined); setImages([]);
    try {
      const original = structuredClone(current), baseline = JSON.stringify(original);
      const shots: SceneCapture[] = [];
      for (const view of views) shots.push(await new Promise<SceneCapture>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Scene capture timed out. Check WebGL and retry manually.')), 30000);
        setCapture({ config: original, view, ready: image => { clearTimeout(timer); resolve(image); }, onError: message => { clearTimeout(timer); reject(new Error(message)); } });
      }));
      setCapture(undefined); setImages(shots);
      const form = 'version' in original ? original.forms?.find(f => f.facades?.length) : undefined;
      const formIndex = 'version' in original ? original.forms?.findIndex(f => f.id === form?.id) : -1;
      const scope = form ? `forms.${formIndex}.facades.0.treatment` : 'version' in original ? 'appearance.exterior' : 'exterior';
      const finish = ('version' in original ? original.appearance.exterior : original.exterior) === 'sand' ? 'ivory' : 'sand';
      const treatment = form?.facades?.[0].treatment === 'loggia' ? 'solid' : 'loggia';
      const mockChanges = form ? { forms: [{ type: 'put', form: { ...form, facades: form.facades!.map((section, i) => i === 0 ? { ...section, treatment } : section) } }] } : 'version' in original ? { appearance: { exterior: finish } } : { exterior: finish };
      const payload = visualReviewRequestSchema.parse({ brief: brief || (mock ? 'Deterministic local evaluation; original brief unavailable.' : ''), current: original, unresolved, reference, images: shots.map(s => s.image) });
      let reviewUsage: unknown, editUsage: unknown;
      const { review, staged } = await requestReviewProposal(payload, async payload => {
        if (mock) return { weaknesses: ['Mock observation: inspect façade rhythm.', 'Mock observation: inspect material hierarchy.', 'Mock observation: inspect arrival legibility.'], improvement: form ? `Change only façade section 0 on ${form.id} to ${treatment}.` : `Change only exterior finish to ${finish}.`, scope: [scope] };
        const response = await fetch('/api/ai/villa/visual-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(175000) }).then(r => r.json());
        if (response.error) throw new Error(response.error);
        reviewUsage = { model: response.model, usage: response.usage, costUsd: response.costUsd };
        return response.review;
      }, async (improvement, scope) => {
        if (mock) return { changes: mockChanges, summary: 'Deterministic mock architectural study', unsupported: [] };
        const output = await fetch('/api/ai/villa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'edit', current: original, prompt: `Apply ONLY ${improvement}. Allowed changed leaf paths: ${JSON.stringify(scope)}. Preserve all unrelated features and approved choices; remove nothing.` }), signal: AbortSignal.timeout(VILLA_CLIENT_TIMEOUT_MS) }).then(r => r.json());
        if (output.error) throw new Error(output.error);
        editUsage = { model: output.model, usage: output.usage, costUsd: output.costUsd };
        return output;
      }, () => mounted.current && latest.current.revision === revision && latest.current.brief === brief);
      if(!staged){setMessage(JSON.stringify({...review,reviewUsage,editUsage:{providerCalls:0,costUsd:0},outcome:'No supported improvement proposed. Original preserved.'},null,2));return;}
      if ('version' in staged.config && staged.config.version==='architectural-scene-1') throw Error('Use the direct scene review panel for this candidate.');
      const revisedConfig=staged.config;
      const afterCaptures:SceneCapture[]=[];
      for(const shot of shots)afterCaptures.push(await new Promise<SceneCapture>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Proposal capture timed out. Original preserved.')),30000);
        setCapture({config:revisedConfig,view:shot.view,ready:image=>{clearTimeout(timer);resolve(image);},onError:message=>{clearTimeout(timer);reject(Error(message));},cameraPose:shot.camera});
      }));
      if(!mounted.current||latest.current.revision!==revision||latest.current.brief!==brief)throw Error('Design changed during comparison. Original preserved.');
      setCapture(undefined);setFeedback('');
      setProposal({ original, config: staged.config, baseline, brief, revision, captures: shots,afterCaptures,mock });
      setMessage(JSON.stringify({ ...review, reviewUsage: mock ? { providerCalls: 0, costUsd: 0 } : reviewUsage, editUsage: mock ? { providerCalls: 0, costUsd: 0 } : editUsage, qualityImprovement: 'Unverified' }, null, 2));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Evaluation failed'); }
    finally { setCapture(undefined); lock.current = false; setBusy(false); }
  }
  async function decide(verdict:'improved'|'rejected'){
    if(!proposal||saving)return;
    if(proposal.baseline!==JSON.stringify(current)||proposal.revision!==revision||proposal.brief!==brief){setMessage('Design changed. Evaluate again.');return;}
    setSaving(true);
    try{
      const response=await fetch('/api/dev/villa-design-lessons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1,brief:proposal.brief||'Offline design review',verdict,feedback,before:proposal.original,after:proposal.config,beforeCaptures:proposal.captures,afterCaptures:proposal.afterCaptures,reference,origin:proposal.mock?'mock':'terra'})}).then(r=>r.json());
      if(response.error)throw Error(response.error);
      if(!mounted.current||latest.current.revision!==proposal.revision||latest.current.brief!==proposal.brief)throw Error('Design changed while saving. Reviewed lesson retained; current design unchanged.');
      if(verdict==='improved')accept(proposal.config,proposal.baseline,proposal.revision);
      setMessage(`Reviewed lesson saved: ${response.id}. ${verdict==='improved'?'Revision accepted.':'Original retained.'}`);setProposal(undefined);
    }catch(error){setMessage(String(error));}finally{setSaving(false);}
  }
  const stale = proposal && (proposal.baseline !== JSON.stringify(current) || proposal.brief !== brief || proposal.revision !== revision);
  return <details name="villa-development-tool" className={styles.reviewPanel}><summary>Visual review experiment</summary>
    <p>Optional development experiment. Quality improvement is unverified. Original remains unchanged until accepted.</p>
    <label>Original design brief<textarea aria-label="Original design brief" value={brief || briefDraft} disabled={busy || !!brief} maxLength={4000} onChange={e => setBriefDraft(e.target.value)} /></label>
    {!brief && <button disabled={busy || !briefDraft.trim()} onClick={() => setBrief(briefDraft.trim())}>Retain supplied original brief</button>}
    <label><input type="checkbox" checked={approved} onChange={e => setApproved(e.target.checked)} /> Authorize one paid vision review and at most one paid targeted edit for this evaluation</label>
    <button disabled={busy || !brief.trim() || !approved} onClick={() => evaluate(false)}>Evaluate with Terra</button>
    <button disabled={busy} onClick={() => evaluate(true)}>Evaluate deterministic mock</button>
    {capture && <ReviewPreview key={capture.view} {...capture} />}
    {busy && <p role="status">Capturing scenes and staging evaluation…</p>}
    <pre role="status">{message}</pre>
    {reference&&<><p>Approved concept · compare visible relationships; hidden geometry remains uncertain.</p><Image unoptimized src={reference.image} alt="Approved architectural concept" width={320} height={180}/></>}
    {images.length > 0 && <p>Verified scene captures: 640 × 360 · daylight · aerial, arrival, poolside</p>}
    {images.map((shot, i) => <Image unoptimized key={i} src={shot.image} alt={`Original ${views[i]}`} width={160} height={90} />)}
    {proposal && <><label>Comparison camera<select value={view} onChange={e => setView(e.target.value as View)}>{views.map(v => <option key={v}>{v}</option>)}</select></label>
      <div className={styles.reviewComparison}><section><h3>Original</h3><ReviewPreview responsive key={`before-${view}`} config={proposal.original} view={view} cameraPose={proposal.captures.find(s => s.view === view)?.camera} /></section><section><h3>Proposed · unsaved</h3><ReviewPreview responsive key={`after-${view}`} config={proposal.config} view={view} cameraPose={proposal.captures.find(s => s.view === view)?.camera} /></section></div>
      <pre style={{ whiteSpace: 'pre-wrap' }}>Changed fields: {changedPaths(proposal.original, proposal.config).join(', ')}</pre>
      {stale && <p role="alert">Design or brief changed. This proposal is stale; evaluate again.</p>}
      <label>Visual comparison findings<textarea aria-label="Visual comparison findings" value={feedback} maxLength={1500} onChange={e=>setFeedback(e.target.value)} placeholder="Describe visible improvement or failure, reference mismatch, and any remaining uncertainty (20 characters minimum)." /></label>
      <p>Compare all three views before deciding. Your judgment is saved with both configurations, captures and reference. It guides future requests as a reviewed lesson; mock revisions remain labelled mock and are excluded from generation retrieval.</p>
      <button disabled={!!stale||saving||feedback.trim().length<20} onClick={()=>decide('improved')}>Accept visually reviewed improvement</button>
      <button disabled={!!stale||saving||feedback.trim().length<20} onClick={()=>decide('rejected')}>Save rejection and keep original</button>
      <button disabled={saving} onClick={()=>setProposal(undefined)}>Discard without learning</button></>}
  </details>;
}
