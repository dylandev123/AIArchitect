'use client';
import {SCENE_TEST_MODELS,type SceneTestSettings} from '@/lib/ai/sceneTesting';
import type {SceneRequest} from '@/lib/villa/scene/terra';
import { generationDiagnostics } from '@/lib/villa/scene/generationDiagnostics';
import { SceneTerrain } from './SceneTerrain';
import { reviewSceneArchitecture } from '@/lib/villa/scene/planning';
import { sceneRelationshipIssues } from '@/lib/villa/scene/relationships';
import { SceneReview } from './SceneReview';
import type { z } from 'zod';
import { developmentRequest } from '@/lib/villa/scene/twoStage';
import { sceneReferenceSchema, generationSceneRequest } from '@/lib/villa/scene/terra';
import './operation-studio.css';
import { Suspense, useState, useEffect, useRef, useEffectEvent } from 'react';
import Link from 'next/link';
import { Canvas } from '@react-three/fiber';
import { VillaScene, type View } from '@/app/dev/villa-playground/scene';
import { OperationScene } from './OperationScene';
import { resolveSceneResult } from '@/lib/villa/scene/terra';
import { laderaScene } from '@/lib/villa/scene/example';
import { applySceneOperations, validateScene, type ArchitecturalScene, type SceneOperation } from '@/lib/villa/scene/model';
import type { Project } from '@/types/project';
import { useProjectStore } from '@/store/useProjectStore';
import { useUIStore } from '@/store/useUIStore';
export function OperationStudio({ project, initialBrief, initialReference, onLegacy }: {
    initialReference?: z.infer<typeof sceneReferenceSchema>;
    initialBrief?: string;
    onLegacy?: () => void;
    project?: Project;
}) {
    const [testModel,setTestModel]=useState<SceneTestSettings['model']>('current');
    const [testEffort,setTestEffort]=useState<''|'medium'|'high'>('');
    const [currentModel,setCurrentModel]=useState('configured production default');
    const [controlledCase,setControlledCase]=useState<SceneRequest>();
    const [testResult,setTestResult]=useState<unknown>();
    useEffect(()=>{if(process.env.NODE_ENV!=='development')return;void fetch('/api/ai/scene').then(r=>r.json()).then(data=>setCurrentModel(data.currentModel??'configured production default')).catch(()=>{});},[]);
    const started = useRef(false);
    const [reference, setReference] = useState<z.infer<typeof sceneReferenceSchema> | undefined>(initialReference);
    const sceneFromProject = project ? validateScene(JSON.parse(project.houseConfigJson)) : undefined;
    const [localScene, setScene] = useState(laderaScene), [history, setHistory] = useState<ArchitecturalScene[]>([]), [selected, setSelected] = useState('bridge-roof'), [view, setView] = useState<View>('Poolside'), [source, setSource] = useState('ladera'), [error, setError] = useState('');
    const scene = sceneFromProject ?? localScene;
    const architecturalReview = reviewSceneArchitecture(scene);
    const constructionIssues = sceneRelationshipIssues(scene);
    const sceneRef = useRef(scene);
    sceneRef.current = scene;
    const [diagnostic, setDiagnostic] = useState<ReturnType<typeof generationDiagnostics>>();
    const [recoverableDraft, setRecoverableDraft] = useState<ArchitecturalScene>();
    const [brief, setBrief] = useState(''), [busy, setBusy] = useState(false);
    useEffect(() => { if (project)
        return; const frame = requestAnimationFrame(() => { try {
        const saved = localStorage.getItem('terra-direct-scene-1');
        if (saved) {
            const restored = validateScene(JSON.parse(saved));
            sceneRef.current = restored;
            setScene(restored);
            setSelected(restored.elements[0]?.id ?? '');
        }
    }
    catch {
        setError('Saved scene could not be loaded.');
    } }); return () => cancelAnimationFrame(frame); }, [project]);
    const handledBrief = useRef('');
    const generateInitial = useEffectEvent((pending: string) => { setBrief(pending); void askTerra('generate', pending); });
    useEffect(() => { if (!initialBrief) { handledBrief.current = ''; return; }
        if (handledBrief.current === initialBrief) return;
        handledBrief.current = initialBrief;
        const frame = requestAnimationFrame(() => generateInitial(initialBrief));
        return () => { cancelAnimationFrame(frame); handledBrief.current = ''; };
    }, [initialBrief]);
    useEffect(() => { if (!project || started.current)
        return; const frame = requestAnimationFrame(() => { if (started.current)
        return; started.current = true; const pending = useUIStore.getState().takePendingBrief(project.id); if (pending)
        generateInitial(pending); }); return () => cancelAnimationFrame(frame); }, [project]);
    function commit(next: ArchitecturalScene, label = 'Scene edit') { const previous = sceneRef.current; if (project)
        useProjectStore.getState().appendVersion(project.id, label, JSON.stringify(next));
    else {
        localStorage.setItem('terra-direct-scene-1', JSON.stringify(next));
        setHistory(h => [...h, previous]);
    } setScene(next); setSelected(id => next.elements.some(e => e.id === id) ? id : next.elements[0]?.id ?? ''); setSource('ladera'); setError(''); }
    async function askTerra(mode: 'generate' | 'edit', prompt = brief, editIntent: 'refine' | 'redesign' = 'refine', controlled=false) { const revision = project ? useProjectStore.getState().getProject(project.id)?.houseConfigJson : undefined; setBusy(true); setError(''); try {
        const baseline = JSON.stringify(sceneRef.current);
        const ordinaryInput = { ...(mode === 'edit' ? developmentRequest(sceneRef.current, prompt, {intent:editIntent}) : generationSceneRequest(prompt)), ...(reference ? { reference } : {}) };
        if(controlled&&!controlledCase)throw Error('Load the retained case first.');
        const testing=process.env.NODE_ENV==='development'&&(controlled||testModel!=='current'||testEffort)
            ?{model:testModel,...(testEffort?{reasoningEffort:testEffort}:{}),...(controlled?{fixture:'mansion-coordination' as const}:{})}:undefined;
        const input=controlled?{...controlledCase!,current:sceneRef.current,testing}:{...ordinaryInput,...(testing?{testing}:{})};
        const response = await fetch('/api/ai/scene', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
        const output = await response.json();
        setTestResult(output.experiment??{responseId:output.responseId,error:output.error,architecturalQuality:output.architecturalAudit});
        setDiagnostic(generationDiagnostics(output.responseId, input, output));
        if (!response.ok) {
            if (output.recoverableDraft) setRecoverableDraft(validateScene(output.recoverableDraft));
            throw Error(output.error);
        }
        const result = resolveSceneResult(input, { architecturalPlan: output.architecturalPlan, name: output.name, summary: output.summary, unsupported: output.unsupported, operations: output.operations }, output.scene?.knowledgeEvidence);
        if (project && useProjectStore.getState().getProject(project.id)?.houseConfigJson !== revision)
            throw Error('Project changed while Terra was working; response was not applied.');
        if (JSON.stringify(sceneRef.current) !== baseline) throw Error('Scene changed while Terra was working; response was not applied.');
        result.scene.generationResponseId = output.responseId;
        commit(result.scene, mode === 'edit' && editIntent === 'redesign' ? 'Architectural redesign' : 'Scene edit');
        setError([result.summary, ...result.unsupported].join(' '));
    }
    catch (err) {
        setError(String(err));
    }
    finally {
        setBusy(false);
    } }
    const e = scene.elements.find(e => e.id === selected) ?? scene.elements[0];
    function edit(ops: SceneOperation[]) { try {
        const next = applySceneOperations(scene, ops);
        commit(next);
    }
    catch (err) {
        setError(String(err));
    } }
    return <main className="operation-studio" style={{ height: '100vh', background: '#ece9df', color: '#26352e', fontFamily: 'sans-serif', display: 'grid', gridTemplateColumns: '310px 1fr' }}>
 <aside style={{ padding: 24, overflow: 'auto' }}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><Link href="/">← All projects</Link>{onLegacy && <p><button type="button" onClick={onLegacy}>Legacy villas</button></p>}{!project && <p><Link href="/dev/villa-playground?scene=legacy">Villa composition, components and visual review</Link></p>}<p>DIRECT ARCHITECTURAL OPERATIONS</p><h1>{scene.name}</h1><p>Compose individual architectural elements with Terra. Every part has its own editable identity.</p>
 <details><summary>Generation diagnostics {scene.generationResponseId ?? diagnostic?.responseId ?? '(historical trace unavailable)'}</summary>{scene.generationResponseId && <button type="button" onClick={async()=>{try{const response=await fetch(`/api/dev/scene-diagnostics/${scene.generationResponseId}`);if(!response.ok)throw Error('Saved diagnostics are available locally in development only.');setDiagnostic(await response.json());}catch(error){setError(String(error));}}}>Load retained report</button>}<p>Exact request, provider output and execution records are retained privately under .data/scene-responses using this response ID. Current geometry and warnings below include subsequent edits; the generation snapshot remains unchanged.</p>{diagnostic && <><p>Transaction: {diagnostic.outcome}</p><details><summary>Selected component provenance: {selected}</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify({component:diagnostic.components?.find(c=>c.element.id===selected),operations:diagnostic.operations?.filter(o=>o.changes.some(c=>c.id===selected)),explicitIntent:diagnostic.explicitIntent,currentElement:scene.elements.find(c=>c.id===selected)},null,2)}</pre></details><details><summary>Original ordered operations and execution report</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(diagnostic,null,2)}</pre></details></>}</details>
 <details open={architecturalReview.issues.length > 0 || constructionIssues.length > 0}><summary>Architectural warnings ({architecturalReview.issues.length + constructionIssues.length})</summary><p>Renderable geometry does not certify a complete house.</p><p>{architecturalReview.geometry.waterSurfaceAreaM2.toFixed(1)} m² water surface · {architecturalReview.geometry.surfaces.filter(s=>s.kind==='plate').length} floor/deck plates</p><details><summary>Measured element inventory</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(architecturalReview.geometry,null,2)}</pre></details>{architecturalReview.knowledgeUse.length > 0 && <details><summary>Knowledge application ({architecturalReview.knowledgeUse.length})</summary><p>Evidence checks element references and kinds; architectural completeness still needs review.</p><ul>{architecturalReview.knowledgeUse.map(entry=><li key={entry.id}>{entry.id}: {entry.status}{entry.elementIds.length ? ` (${entry.elementIds.join(', ')})` : ''}</li>)}</ul></details>}<ul>{constructionIssues.map((i,n)=><li key={`construction-${n}`}>Construction draft: {i.message}</li>)}{architecturalReview.issues.map((issue,n)=><li key={n}>{issue}</li>)}</ul>{scene.architecturalPlan !== undefined && <details><summary>Original design intent</summary><pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(scene.architecturalPlan,null,2)}</pre></details>}</details>
 {process.env.NODE_ENV==='development'&&<details><summary>Development model test</summary>
 <p>One request per click, zero retries. Production default: {currentModel}. Model access is unverified.</p>
 <label>Test model <select aria-label="Test model" value={testModel} onChange={ev=>setTestModel(ev.target.value as SceneTestSettings['model'])}><option value="current">Current configured model ({currentModel})</option>{SCENE_TEST_MODELS.map(m=><option key={m.id} value={m.id}>{m.label} ({m.id})</option>)}</select></label>
 <label>Reasoning effort <select aria-label="Reasoning effort" value={testEffort} onChange={ev=>setTestEffort(ev.target.value as typeof testEffort)}><option value="">Provider default</option>{(['medium','high'] as const).filter(e=>SCENE_TEST_MODELS.find(m=>m.id===(testModel==='current'?currentModel:testModel))?.efforts.some(v=>v===e)).map(e=><option key={e} value={e}>{e==='medium'?'Medium':'High'}</option>)}</select></label>
 <p>Documented Responses API and structured-output support checked 29 October 2026. Higher effort may use more output tokens.</p>
 <button type="button" onClick={async()=>{try{const response=await fetch('/api/ai/scene?fixture=mansion-coordination');const data=await response.json();if(!response.ok)throw Error(data.error);setControlledCase(data.input);commit(validateScene(data.input.current),'Retained original for controlled test — unapproved');setBrief(data.input.prompt);setTestResult({status:'ready',fingerprint:data.fingerprint,providerCalls:0});}catch(error){setError(String(error));}}}>Load retained 88-element case (offline)</button>
 <button type="button" disabled={!controlledCase||busy} onClick={()=>askTerra('edit',brief,'refine',true)}>Run retained revision once</button>
 <p>The retained case freezes the brief, original scene, coordination evidence and approved knowledge snapshot. Reload it before another comparison. Results remain unapproved editable versions.</p>
 {testResult!==undefined&&<pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(testResult,null,2)}</pre>}
 </details>}
 <p>Refine preserves composition. Redesign can replace and reorganize the house. Each change is saved as a version with Undo.</p><label>Terra design brief<textarea aria-label="Terra design brief" value={brief} onChange={ev => setBrief(ev.target.value)}/></label><p><button disabled={busy || !brief.trim()} onClick={() => askTerra('generate')}>{project ? 'Generate scene' : 'Generate villa'}</button> <button disabled={busy || !brief.trim()} onClick={() => askTerra('edit')}>Refine</button> <button disabled={busy || !brief.trim()} onClick={() => askTerra('edit', brief, 'redesign')}>Redesign</button></p>
 <p><label>Reference image <input aria-label="Reference image" type="file" accept="image/png,image/jpeg,image/webp" onChange={async ev => { try {
    const file = ev.target.files?.[0]; if (!file) return;
    if (file.size > 4400000) throw Error('Reference image exceeds 4.4 MB.');
    const image = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('Image could not be read.')); reader.readAsDataURL(file); });
    setReference(sceneReferenceSchema.parse({source:file.name,image}));
 } catch (err) { setError(String(err)); } }} /></label>{reference && <><span>{reference.source}</span> <button onClick={() => setReference(undefined)}>Clear reference</button></>}</p>
 {process.env.NODE_ENV === 'development' && <SceneReview scene={scene} reference={reference} brief={brief} commit={next => commit(next)} current={() => sceneRef.current} />}
 {!project && <label>Comparison <select aria-label="Comparison" value={source} onChange={ev => setSource(ev.target.value)}><option value="ladera">Current direct scene</option><option value="solana">Villa Solana</option></select></label>}
 {!project && <p><button onClick={() => commit(laderaScene)}>Load Casa Ladera</button></p>}
 <details><summary>Advanced Terrain &amp; Elevation</summary><p>Optional natural ground. Building elevations stay authored; pads and route grading require explicit design.</p><label><input type="checkbox" aria-label="Enable advanced terrain" checked={!!scene.terrain} onChange={ev => edit([{op:'set-terrain',terrain:ev.target.checked ? {width:120,depth:120,elevation:-.5,grade:.05,fall:'z'} : null}])} /> Enable terrain</label>{scene.terrain && <>{(['elevation','grade'] as const).map(key=><label key={key} style={{display:'block'}}>Terrain {key}<input aria-label={`Terrain ${key}`} type="number" step={key==='grade' ? .01 : .5} value={scene.terrain![key]} onChange={ev=>edit([{op:'set-terrain',terrain:{...scene.terrain!,[key]:Number(ev.target.value)}}])} /></label>)}<label>Fall direction<select aria-label="Terrain fall" value={scene.terrain.fall} onChange={ev=>edit([{op:'set-terrain',terrain:{...scene.terrain!,fall:ev.target.value as 'x'|'-x'|'z'|'-z'}}])}>{['x','-x','z','-z'].map(axis=><option key={axis}>{axis}</option>)}</select></label></>}</details>
 <p>{(['Arrival', 'Poolside', 'Aerial', 'Garden'] as View[]).map(v => <button key={v} onClick={() => setView(v)}>{v}</button>)}</p>
 <label>Element <select aria-label="Element" value={e?.id ?? ''} onChange={ev => setSelected(ev.target.value)} style={{ width: '100%' }}>{scene.elements.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}</select></label>
 {e && <><p>{e.kind} · {e.id}</p>{e.kind === 'roof' && <label>Roof form <select aria-label="Roof form" value={e.roofForm ?? 'flat'} onChange={ev => edit([{ op: 'replace', id: e.id, element: { ...e, roofForm: ev.target.value as 'flat' | 'gable' | 'hip', size: [e.size[0], ev.target.value === 'flat' ? e.size[1] : Math.max(.6, e.size[1]), e.size[2]] } }])}>{['flat', 'gable', 'hip'].map(form => <option key={form}>{form}</option>)}</select></label>}{(['x', 'y', 'z'] as const).map((axis, i) => <label key={axis} style={{ display: 'block' }}>Position {axis} <input aria-label={`Position ${axis}`} type="number" step="0.25" value={e.at[i]} onChange={ev => { const at = [...e.at] as [
            number,
            number,
            number
        ]; at[i] = Number(ev.target.value); edit([{ op: 'move', id: e.id, at }]); }}/></label>)}
 {(['Width', 'Height', 'Depth'] as const).map((axis, i) => <label key={axis} style={{ display: 'block' }}>{axis} <input aria-label={axis} type="number" step="0.25" value={e.size[i]} onChange={ev => { const size = [...e.size] as [
            number,
            number,
            number
        ]; size[i] = Number(ev.target.value); edit([{ op: 'resize', id: e.id, size }]); }}/></label>)}
 <label>Finish <select aria-label="Finish" value={e.material} onChange={ev => edit([{ op: 'finish', id: e.id, material: ev.target.value as typeof e.material }])}>{['ivory', 'limestone', 'timber', 'bronze', 'sage'].map(m => <option key={m}>{m}</option>)}</select></label></>}
 {scene.elements.some(e => e.id === 'bridge-roof') && <p><button onClick={() => edit([{ op: 'resize', id: 'bridge-roof', size: [17, .3, 10] }])}>Extend suite roof</button></p>}
 {scene.elements.some(e => e.id === 'suite-screen') && <button onClick={() => edit([{ op: 'move', id: 'suite-screen', at: [3.8, 6.5, 1.3] }])}>Slide privacy screen</button>}
 <p><button disabled={busy || (project ? project.currentVersionIndex <= 0 : !history.length)} onClick={() => { if (project) {
        useProjectStore.getState().undo(project.id);
        return;
    } localStorage.setItem('terra-direct-scene-1', JSON.stringify(history[history.length - 1])); setScene(history[history.length - 1]); setHistory(history.slice(0, -1)); }}>Undo</button> <button disabled={busy || !project || project.currentVersionIndex >= project.versions.length - 1} onClick={() => { if (project)
        useProjectStore.getState().redo(project.id); }}>Redo</button></p>
 {recoverableDraft && <p>Construction failed. Current house preserved. <button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(recoverableDraft,null,2)],{type:'application/json'}));a.download='recoverable-construction-draft.json';a.click();URL.revokeObjectURL(a.href);}}>Download recoverable draft</button></p>}
 <button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' })); a.download = 'architectural.scene.json'; a.click(); URL.revokeObjectURL(a.href); }}>Export scene JSON</button>
 <p><label>Import scene JSON <input aria-label="Import scene JSON" type="file" accept=".json" onChange={async (ev) => { try {
        const file = ev.target.files?.[0];
        if (file) {
            const next = validateScene(JSON.parse(await file.text()));
            commit(next);
            setSelected(next.elements[0]?.id ?? '');
        }
    }
    catch (err) {
        setError(String(err));
    } }}/></label></p>
 <p>{project ? `Saved project · ${project.versions.length} versions` : "Playground scene"}</p><p role="status">{(busy ? 'Terra is constructing the scene…' : error) || `${scene.elements.length} elements · ${history.length} edits · scene ready`}</p></fieldset></aside>
 <div style={{ minWidth: 0 }}><Canvas shadows camera={{ position: [33, 18, 43], fov: 40 }} gl={{ preserveDrawingBuffer: true }}><Suspense fallback={null}><VillaScene frameArchitectureOnly={source === 'ladera'} grounds={source === 'ladera' ? <SceneTerrain terrain={scene.terrain ?? {width:120,depth:120,elevation:0,grade:0,fall:'z'}} /> : undefined} replaceArchitecture={source === 'ladera'} mood="Daylight" view={view} reset={source === 'ladera' ? 0 : 1} tour={false}>{source === 'ladera' && <OperationScene scene={scene} onSelect={setSelected}/>}</VillaScene></Suspense></Canvas></div>
 </main>;
}