"use client";

import { OperationStudio } from '@/components/scene/OperationStudio';
import { fetchVillaRequest, recoverVillaRequest } from '@/lib/villa/requestClient';
import { VILLA_REQUEST_STORAGE_KEY } from '@/lib/villa/requestLifecycle';
import { assertReviewBaseline } from "@/lib/villa/visual-review";
import { VisualReview } from "./visual-review";
import { Component, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import { House, Move, RotateCcw, Rotate3D, Sun, Sunset, Pause, Play } from "lucide-react";
import * as THREE from "three";
import { VillaScene, VIEWS, type View, type Mood } from "./scene";
import { STYLES, STYLE_RULES, defaultVilla, executeVillaPatch, type VillaConfig, type VillaPatch } from "@/lib/villa/design";
import { resolveVillaResult } from "@/lib/villa/terra";
import { COMPOSITIONS } from "./wing-composition";
import { landscapeAcceptance, buildComposition, executeCompositionPatch, compositionFindings, type CompositionPatch, type VillaComposition } from '@/lib/villa/composition';
import { residenceCompositionStudies } from '@/lib/villa/residence-composition-studies';
import { ArchitectureLibrary } from './architecture-library';
import { architecturalFreedomStudies } from '@/lib/villa/architectural-freedom-studies';
import { stackedVolumeExamples } from '@/lib/villa/stacked-volume-examples';
import { mainResidenceExamples } from '@/lib/villa/main-residence-examples';
import { facadeExamples } from '@/lib/villa/facade-examples';
import { footprintExamples } from '@/lib/villa/footprint-examples';
import { creativeExamples } from '@/lib/villa/creative-examples';
import { estateExamples } from '@/lib/villa/estate-examples';
import { experimentalExamples } from '@/lib/villa/experimental/examples';
import { CompositionEditor } from './composition-editor';
import styles from "./villa.module.css";

function subscribeStoredRequest(listener: () => void) {
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
function readStoredRequest() {
  try { return localStorage.getItem(VILLA_REQUEST_STORAGE_KEY) ?? ''; } catch { return ''; }
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className={styles.status} role="alert">The 3D scene could not start. Check that WebGL is available, then reload.</div> : this.props.children;
  }
}

export function VillaPlayground({ initialComposition, recovered, reference }: { reference?: {source:string;image:string}; initialComposition?: string; recovered?: { config: VillaComposition; summary: string; unsupported: string[] } }) {
  const examples=useMemo(()=>[...creativeExamples(),...estateExamples(),...footprintExamples(),...mainResidenceExamples(),...stackedVolumeExamples(),...residenceCompositionStudies(),...architecturalFreedomStudies(),...facadeExamples()],[]);
  const initialExample=examples.find(c=>c.id===initialComposition);
  const studies = useMemo(()=>({...COMPOSITIONS,...Object.fromEntries(experimentalExamples().map(c=>[c.id,c]))}),[]);
  const [compositionId, setCompositionId] = useState(initialComposition && studies[initialComposition] ? initialComposition : "");
  const [revision, setRevision] = useState(0);
  const [authored, updateAuthored] = useState<VillaComposition | undefined>(recovered?.config ?? initialExample);
  const composition = useMemo(() => authored ? buildComposition(authored) : studies[compositionId], [authored, compositionId, studies]);
  const acceptance = useMemo(()=>authored ? landscapeAcceptance(authored) : undefined,[authored]);
  function selectComposition(id: string) {
    setOriginalBrief(''); setStatusDismissed(false); setStatusOpen(false); setAuthored(undefined); setCompositionId(id); if(id) { setConfig(undefined); setMode('generate'); setTerraMessage(''); setTerraError(''); setUnsupported([]); } setCustomize(false); setView("Focus House"); setTour(false); setReset(v => v + 1);
  }
  const [directOpen, setDirectOpen] = useState(false);
  const [directBrief, setDirectBrief] = useState('');
  const [hasDirect, setHasDirect] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setHasDirect(!!localStorage.getItem('terra-direct-scene-1')); } catch { /* Storage may be unavailable. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const [residenceOnly,setResidenceOnly]=useState(false);
  const [mood, setMood] = useState<Mood>("Daylight");
  const [view, setView] = useState<View>("Focus House");
  const [reset, setReset] = useState(0);
  const [tour, setTour] = useState(false);
  const [config, updateConfig] = useState<VillaConfig | undefined>();
  function setAuthored(next: VillaComposition | undefined) { setRevision(v => v + 1); updateAuthored(next); }
  function setConfig(next: VillaConfig | undefined) { setRevision(v => v + 1); updateConfig(next); }
  const [customize, setCustomize] = useState(false);
  const [editError, setEditError] = useState('');
  const [prompt, setPrompt] = useState('');
  const [originalBrief, setOriginalBrief] = useState('');
  const [mode, setMode] = useState<'generate' | 'edit'>('generate');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [terraMessage, setTerraMessage] = useState(recovered?.summary ?? '');
  const [unsupported, setUnsupported] = useState<string[]>(recovered?.unsupported ?? []);
  const [terraError, setTerraError] = useState('');
  const [currentRequestId, setRetainedRequestId] = useState('');
  const storedRequestId = useSyncExternalStore(subscribeStoredRequest, readStoredRequest, () => '');
  const retainedRequestId = currentRequestId || storedRequestId;
  async function recoverTerra() {
    if (inFlight.current || !retainedRequestId) return;
    inFlight.current = true; setBusy(true); setTerraError('');
    try {
      const body = await recoverVillaRequest(retainedRequestId);
      const result = resolveVillaResult({mode:'generate',prompt:'Recover completed request'}, {changes:body.config,summary:body.summary,unsupported:body.unsupported});
      if ('version' in result.config) { setAuthored(result.config); setConfig(undefined); }
      else { setConfig(result.config); setAuthored(undefined); }
      setCompositionId(''); setTerraMessage(result.summary); setUnsupported(result.unsupported); setView('Focus House'); setReset(v=>v+1);
    } catch (error) { setTerraError(error instanceof Error ? error.message : 'Recovery unavailable. Your current villa is preserved.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function askTerra(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !prompt.trim() || (mode === 'edit' && !config && !authored)) return;
    if (mode === 'generate') {
      setDirectBrief(prompt.trim()); setHasDirect(true); setDirectOpen(true);
      return;
    }
    inFlight.current = true; setRevision(v => v + 1); setBusy(true); setStatusDismissed(false); setStatusOpen(false); setTerraError(''); setTerraMessage('');
    try {
      const requestId = crypto.randomUUID();
      setRetainedRequestId(requestId);
      try { localStorage.setItem(VILLA_REQUEST_STORAGE_KEY, requestId); } catch { /* Recovery ID is still available in this session. */ }
      const body = await fetchVillaRequest({ prompt, mode, ...(mode === 'edit' ? { current: authored ?? config } : {}) }, requestId);
      const result = resolveVillaResult({prompt,mode,...(mode === 'edit' ? {current: authored ?? config} : {})}, {changes:body.changes,summary:body.summary,unsupported:body.unsupported});
      if ('version' in result.config) {
        setAuthored(result.config); setCompositionId(''); setConfig(undefined);
      } else { setConfig(result.config); setAuthored(undefined); setCompositionId(''); }
      setTerraMessage(result.summary); setUnsupported(previous => [...new Set([...previous, ...result.unsupported])]); setEditError(''); setView('Focus House'); setReset(v=>v+1);

    } catch (error) {
      setTerraError(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'Terra took too long. Your current villa is preserved.');
    } finally { inFlight.current = false; setBusy(false); }
  }
  function edit(patch: VillaPatch) {
    if (!config) return;
    try { setConfig(executeVillaPatch(config, patch)); setEditError(''); }
    catch (e) { setEditError(e instanceof Error ? e.message : 'Unsupported change'); }
  }
  function editComposition(patch: CompositionPatch) {
    if(!authored) return;
    try { setStatusDismissed(false); setStatusOpen(false); setAuthored(executeCompositionPatch(authored,patch)); setEditError(''); }
    catch(error) { setEditError(compositionFindings(error).map(f=>`${f.path}: ${f.message}`).join('\n')); }
  }
  const [terraOpen, setTerraOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusDismissed, setStatusDismissed] = useState(false);
  const [exploring, setExploring] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const sync = () => setExploring(!!document.fullscreenElement);
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExploring(false); };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('fullscreenchange', sync); document.removeEventListener('keydown', escape); };
  }, []);
  async function toggleExplore() {
    if (exploring) { if (document.fullscreenElement) await document.exitFullscreen(); setExploring(false); }
    else { setExploring(true); try { await root.current?.requestFullscreen?.(); } catch { /* CSS exploration mode remains available. */ } }
  }
  const hasStatus = !!(terraMessage || terraError || unsupported.length || acceptance?.unresolved.length);
  const rule = config ? STYLE_RULES[config.style] : undefined;

  return <>
    {hasDirect && <div hidden={!directOpen}><OperationStudio initialBrief={directBrief} onLegacy={() => { setDirectOpen(false); setDirectBrief(''); }} /></div>}
    <main style={directOpen ? { display: 'none' } : undefined} ref={root} className={`${styles.playground} ${exploring ? styles.exploring : ""}`}>
    <div className={styles.viewport} aria-label="Interactive 3D villa. Drag to orbit, scroll to zoom, right-drag to pan.">
      <SceneBoundary>
        <Canvas shadows="soft" dpr={[1, 1.75]} gl={{ toneMapping: THREE.NeutralToneMapping, logarithmicDepthBuffer: true }}
          camera={{ position: VIEWS.Poolside.position, fov: 39, near: .1, far: Math.max(800,composition ? Math.max(composition.garden.width,composition.garden.depth)*10 : 800) }}
          fallback={<div className={styles.status} role="alert">This playground needs a browser with WebGL.</div>}>
          <Suspense fallback={null}><VillaScene residenceOnly={residenceOnly} mood={mood} view={view} reset={reset} tour={tour} config={config} composition={composition} /></Suspense>
        </Canvas>
      </SceneBoundary>
    </div>
    <header className={styles.header}>
      <Link href="/" className={styles.brand}><House size={20} strokeWidth={1.5} /> AI Architect <span>PLAYGROUND</span></Link>
      <span style={{ pointerEvents: 'auto', position: 'absolute', right: 160, top: 20 }}>{hasDirect && <button onClick={() => setDirectOpen(true)}>Return to direct scene</button>}</span><span className={styles.dev}><i /> Live 3D · Design study</span>
    </header>
    {process.env.NODE_ENV === "development" && <details className={styles.development}><summary>Development Tools</summary>
    <details name="villa-development-tool" className={styles.toolPanel}><summary>Development Presets</summary><Link href="/dev/villa-playground/create-component" onClick={() => { if (authored) sessionStorage.setItem("villa-creation-context", JSON.stringify({ current: authored, brief: originalBrief })); else sessionStorage.removeItem("villa-creation-context"); }}>Create Architectural Component ↗</Link>
    <nav className={styles.styleBar} aria-label="Architectural styles">
      <button disabled={busy} aria-pressed={!config && !composition} onClick={() => { selectComposition(""); setConfig(undefined); setCustomize(false); setMode("generate"); setTerraMessage(""); setUnsupported([]); setTerraError(""); }}>Solana original</button>
      {STYLES.map(style => <button key={style} disabled={busy} aria-pressed={!composition && config?.style === style} onClick={() => { selectComposition(""); setConfig(defaultVilla(style)); setEditError(''); setTerraMessage(''); setUnsupported([]); setTerraError(''); }}>{STYLE_RULES[style].label}</button>)}
    </nav>
    <nav className={styles.compositionBar} aria-label="Wing composition examples">
      <span>WING STUDIES</span>
      {Object.values(studies).map(c => <button key={c.id} disabled={busy} aria-pressed={compositionId === c.id} onClick={() => selectComposition(c.id)}>{c.id === 'compact-l' ? 'Compact L' : c.id === 'courtyard-u' ? 'Courtyard U' : c.id === 'pavilion-estate' ? 'Pavilion estate' : c.id === 'curve-horizon' ? 'Curve / Modern' : 'Curve / Island'}</button>)}
      {examples.map(c=><button key={c.id} disabled={busy} aria-pressed={authored?.id===c.id} onClick={()=>{setStatusDismissed(false);setStatusOpen(false);setOriginalBrief('');setAuthored(c);setCompositionId('');setConfig(undefined);setMode('edit');setTerraMessage('');setTerraError('');setUnsupported([]);setCustomize(false);setView("Focus House");setTour(false);setReset(v=>v+1);}}>{c.id==='family-breeze' ? 'Family villa' : c.id==='caribbean-grande' ? 'Caribbean estate' : c.id==='estate-palmhaven' ? 'Palmhaven' : c.id==='estate-splay' ? 'Splay House' : c.id==='estate-cortile' ? 'Cortile' : c.forms?.length ? c.name : 'Tuscan estate'}</button>)}
    </nav>
    </details>
    {process.env.NODE_ENV === 'development' && (authored || config) && <VisualReview reference={reference} current={(authored ?? config)!} brief={originalBrief} setBrief={setOriginalBrief} unresolved={[...unsupported, ...(acceptance?.unresolved.map(f => `${f.path}: ${f.message}`) ?? [])]} revision={revision} accept={(next, baseline, baseRevision) => {
      assertReviewBaseline((authored ?? config)!, revision, baseline, baseRevision);
      if ('version' in next) setAuthored(next); else setConfig(next);
    }} />}
    </details>}
    <section className={`${styles.intro} ${styles.collectionIntro}`}>
      <h1>{composition?.name ?? rule?.name ?? "Villa Solana"}</h1>
      <details><summary>Property details</summary>
      <p>{composition?.character ?? rule?.character ?? "A slower kind of living."}</p>
      <p className={styles.eyebrow}>THE SOLANA COLLECTION / {authored?.estateLandscape ? "ESTATE STUDIES · OFFLINE" : authored ? "TERRA COMPOSITION" : composition ? "WING STUDIES" : config ? String(STYLES.indexOf(config.style) + 2).padStart(3, "0") : "001"}</p>

      <p className={styles.description}>{composition ? `${composition.forms?.length ? composition.forms.length + " footprint building(s)" : composition.wings.filter(w => w.role !== "gallery").length + " wings"} · ${authored?.estateLandscape ? 'offline estate study' : authored ? 'Terra composition' : 'local composition study'}` : config ? `${config.levels} levels · ${config.composition.replace("-", " ")} · ${config.roof} roofs` : "Sculpted stone. Open horizons. Tropical calm."}<br />{authored ? `${authored.garden.width.toFixed(1)} × ${authored.garden.depth.toFixed(1)} m ${authored.siteMode==='derived' ? 'auto-sized garden' : 'fixed site'}` : 'Explore a home shaped around the outdoors.'}</p>
      </details>
    </section>
    <div className={styles.moods} aria-label="Lighting">
      {(["Daylight", "Golden hour"] as const).map(option => <button key={option} aria-pressed={mood === option} onClick={() => setMood(option)}>
        {option === "Daylight" ? <Sun size={17} /> : <Sunset size={17} />}{option}
      </button>)}
    </div>
    {config && !composition && <>
      <button className={styles.customizeToggle} aria-expanded={customize} onClick={() => setCustomize(!customize)}>{customize ? 'Close customization' : 'Customize this villa'}</button>
      {customize && <aside className={styles.customizer} aria-label="Villa customization">
        <h2>Make it yours</h2><p>Every detail, in harmony.</p>
        <fieldset disabled={busy}><label>Composition<select aria-label="Composition" value={config.composition} onChange={e => edit({ composition: e.target.value as VillaConfig['composition'] })}>{rule?.compositions.map(v => <option key={v} value={v}>{v.replace('-', ' ')}</option>)}</select></label>
        <label>Levels<select aria-label="Levels" value={config.levels} onChange={e => edit({ levels: Number(e.target.value) as 1 | 2 })}><option value={1}>One level</option><option value={2}>Two levels</option></select></label>
        <label>Exterior<select aria-label="Exterior" value={config.exterior} onChange={e => edit({ exterior: e.target.value as VillaConfig['exterior'] })}>{['ivory', 'sand', 'limestone', 'warm-stone'].map(v => <option key={v} value={v}>{v.replace('-', ' ')}</option>)}</select></label>
        <label>Roof<select aria-label="Roof" value={config.roof} onChange={e => edit({ roof: e.target.value as VillaConfig['roof'] })}>{rule?.roofs.map(v => <option key={v} value={v}>{v}</option>)}</select></label>
        <label>Glazing<select aria-label="Glazing" value={config.glazing} onChange={e => edit({ glazing: e.target.value as VillaConfig['glazing'] })}><option value="panoramic">Panoramic</option><option value="divided">Divided lights</option></select></label>
        <label>Garden<select aria-label="Garden" value={config.landscape} onChange={e => edit({ landscape: e.target.value as VillaConfig['landscape'] })}><option value="tropical">Tropical</option><option value="mediterranean">Mediterranean</option></select></label>
        <label>Scale <output>{config.scale.toFixed(2)}×</output><input aria-label="Scale" type="range" min="0.85" max="1.05" step="0.01" value={config.scale} onChange={e => edit({ scale: +e.target.value })} /></label>
        <label>Wing proportions <output>{config.wingRatio.toFixed(2)}×</output><input aria-label="Wing proportions" type="range" min="0.85" max="1.1" step="0.01" value={config.wingRatio} onChange={e => edit({ wingRatio: +e.target.value })} /></label>
        <label>Veranda <output>{config.verandaDepth.toFixed(1)} m</output><input aria-label="Veranda depth" type="range" min="1.6" max="2.8" step="0.1" value={config.verandaDepth} onChange={e => edit({ verandaDepth: +e.target.value })} /></label>
        <label>Terrace <output>{config.terraceDepth.toFixed(1)} m</output><input aria-label="Terrace depth" type="range" min="1.6" max="2.8" step="0.1" value={config.terraceDepth} onChange={e => edit({ terraceDepth: +e.target.value })} /></label>
        <label className={styles.checkLabel}><input aria-label="Swimming pool" type="checkbox" checked={config.pool.enabled} onChange={e => edit({ pool: { enabled: e.target.checked } })} />Swimming pool</label>
        {config.pool.enabled && <>
          <label>Pool length <output>{config.pool.width.toFixed(1)} m</output><input aria-label="Pool length" type="range" min="10" max="18" step="0.5" value={config.pool.width} onChange={e => edit({ pool: { width: +e.target.value } })} /></label>
          <label>Pool width <output>{config.pool.depth.toFixed(1)} m</output><input aria-label="Pool width" type="range" min="4" max="6.4" step="0.2" value={config.pool.depth} onChange={e => edit({ pool: { depth: +e.target.value } })} /></label>
        </>}
        </fieldset>{editError && <p role="alert">{editError}</p>}
      </aside>}
    </>}
    {authored && <>
      <button className={styles.customizeToggle} aria-expanded={customize} onClick={()=>setCustomize(!customize)}>{customize ? 'Close customization' : 'Customize this villa'}</button>
      {customize && <aside className={styles.customizer} aria-label="Composition customization"><h2>Shape your villa</h2><p>Stage wing and courtyard changes, then apply together.</p><ArchitectureLibrary current={authored} disabled={busy} onApply={setAuthored} /><CompositionEditor current={authored} disabled={busy} onApply={editComposition} />{editError && <p role="alert">{editError}</p>}</aside>}
    </>}
    <button className={styles.exploreToggle} onClick={toggleExplore}>{exploring ? 'Exit exploration' : 'Fullscreen'}</button>
    <button className={styles.terraToggle} aria-expanded={terraOpen} onClick={() => { setTerraOpen(!terraOpen); if (terraOpen) setCustomize(false); }}>{terraOpen ? 'Close Terra' : '✦ Terra'}</button>
    {hasStatus && <div className={styles.statusDock}>
      <button aria-expanded={statusOpen} onClick={() => { setStatusOpen(!statusOpen); setStatusDismissed(false); }}>{statusDismissed ? 'Design status' : acceptance?.unresolved.length ? `${acceptance.unresolved.length} unresolved items` : terraError ? 'Terra needs attention' : 'Terra response'}</button>
      {!statusDismissed && <button aria-label="Dismiss status" onClick={() => { setStatusDismissed(true); setStatusOpen(false); }}>×</button>}
    </div>}
      {statusOpen && <div className={styles.terraResult} role={terraError ? 'alert' : 'status'}>
        <button type="button" aria-label="Dismiss Terra response" onClick={() => { setStatusOpen(false); setStatusDismissed(true); }}>×</button>
        {(terraError || !acceptance?.unresolved.length) && <p>{terraError || terraMessage}</p>}
        {!!acceptance?.unresolved.length && <div role="status" className={styles.unsupported}>
          <strong>Design preview{acceptance.accessWarning ? ' · Access unresolved' : ''}</strong>
          <p>Architecture accepted. These landscape drafts are retained for editing and excluded from the scene. Complete estate approval is pending.</p>
          <ul>{acceptance.unresolved.map((finding, index) => <li key={`${finding.path}-${index}`}>{finding.path}: {finding.message}</li>)}</ul>
        </div>}
        {!!authored?.createdComponents?.length && <p className={styles.unsupported}>{authored.createdComponents.map(i=>`${i.proposal.name} · ${i.status} · v${i.candidateVersion}`).join(' · ')}. {authored.createdComponents.some(i=>i.status==='experimental') ? <>Experimental forms await review in the <a href="/dev/villa-playground/create-component">optional Component Studio</a>.</> : 'Approved library components reused.'}</p>}
        {unsupported.length > 0 && <p className={styles.unsupported}>Not yet supported: {unsupported.join(' · ')}</p>}
      </div>}
    <div className={styles.terraDock} hidden={!terraOpen}>
      <form className={styles.terraForm} onSubmit={askTerra} aria-label="Design with Terra">
        <div className={styles.terraMode}><span>✦ TERRA</span><button disabled={busy} type="button" aria-pressed={mode === 'generate'} onClick={() => setMode('generate')}>New design</button><button disabled={busy || (!config && !authored)} type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>Refine villa</button></div>
        <div className={styles.terraInput}><textarea aria-label="Villa brief" rows={2} maxLength={4000} disabled={busy} value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={mode === 'generate' ? 'Imagine one long modern house, or an asymmetric courtyard with a detached guest pavilion…' : authored ? 'Try: add a detached guest pavilion, extend the main wing, or enlarge the courtyard…' : 'Try: use limestone walls and make the pool 12 metres long…'} /><button disabled={busy || !prompt.trim() || (mode === 'edit' && !config && !authored)} type="submit">{busy ? 'Terra is designing…' : mode === 'generate' ? 'Generate villa ↗' : 'Apply change ↗'}</button></div>
        {retainedRequestId && <button type="button" disabled={busy} onClick={recoverTerra}>Recover last Terra response · no API call</button>}
        {busy && <span className={styles.terraProgress} role="status">Shaping your villa. You can keep exploring the current scene.</span>}
      </form>
    </div>
    <footer className={styles.footer}>
      <button style={{position:"absolute",bottom:90,left:24,zIndex:3,padding:"10px 16px",borderRadius:24,fontSize:11}} aria-pressed={residenceOnly} onClick={()=>{setResidenceOnly(v=>!v);setReset(v=>v+1);}}>House only</button>
      <div className={styles.caption}><span className={styles.number}>{config ? String(STYLES.indexOf(config.style) + 2).padStart(2, "0") : "01"} /</span><div><strong>{composition ? STYLE_RULES[composition.config.style].label : rule?.label ?? "Contemporary tropical residence"}</strong><span>{composition ? `${composition.pool.enabled === false ? "Garden terrace" : composition.pool.width + " m pool"} · ${composition.wings.length+(composition.forms?.length ?? 0)} building volumes` : config ? `${config.pool.enabled ? config.pool.width + " m pool" : "Garden terrace"} · ${config.landscape} garden` : "Two levels · Sky terrace · 17 m infinity pool"}</span></div></div>
      <div className={styles.cameraBar} aria-label="Camera views">
        {(Object.keys(VIEWS) as View[]).map(option => <button key={option} aria-pressed={view === option} onClick={() => { setView(option); setReset(value => value + 1); setTour(false); }}>{option}</button>)}
        <span className={styles.divider} />
        <button title="Reset camera" aria-label="Reset camera" onClick={() => { setView("Fit Property"); setReset(value => value + 1); setTour(false); }}><RotateCcw size={16} /></button>
        <button title={tour ? "Pause tour" : "Start tour"} aria-label={tour ? "Pause tour" : "Start tour"} aria-pressed={tour} onClick={() => setTour(!tour)}>{tour ? <Pause size={16} /> : <Play size={16} />}</button>
      </div>
      <div className={styles.hints}><span><Rotate3D size={15} /> Drag to orbit</span><span><Move size={15} /> Right-drag to pan</span><span>↕ Scroll to zoom</span></div>
    </footer>
    <span className={styles.credit}>{authored?.estateLandscape ? "ESTATE LANDSCAPE @1 · DETERMINISTIC LOCAL STUDY" : composition?.components?.length ? "TERRA · APPROVED CURVED PAVILION" : composition?.experimentalForms?.length ? "PROCEDURAL CURVED PAVILION · LOCAL STUDY" : authored ? "TERRA · COMPOSABLE ARCHITECTURE" : composition ? "WING COMPOSITION STUDIES · LOCAL DESIGN" : config ? "THE SOLANA COLLECTION · DESIGNED TO EXPLORE" : "VILLA SOLANA · ORIGINAL DESIGN STUDY"}</span>
  </main></>;
}
