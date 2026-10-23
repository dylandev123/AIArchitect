'use client';

import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { compileV3Scene, type V3Scene } from '@/lib/v3/scene';
import { getV3PresentationBounds } from '@/lib/v3/presentation';
import type { ConceptFinding } from '@/lib/v3/architecturalConcept';
import { compactMassingExampleNames } from '@/lib/v3/evaluation/compactMassingExamples';

function Preview({ scene }: { scene: V3Scene }) {
  const { primitives, center, distance } = useMemo(() => {
    const model = compileV3Scene(scene);
    const bounds = getV3PresentationBounds(scene, model);
    return { primitives: model.primitives, center: bounds.center, distance: Math.max(15, ...bounds.size) * 1.4 };
  }, [scene]);
  return <Canvas camera={{ position: [center[0] + distance, center[1] + distance * .75, center[2] + distance], fov: 40, near: .1, far: 2000 }}>
    <color attach="background" args={['#e5e7e5']} />
    <ambientLight intensity={1.1} />
    <directionalLight position={[30, 60, 20]} intensity={2.2} />
    <hemisphereLight args={['#ffffff', '#92978a', .8]} />
    <Suspense fallback={null}>
      {primitives.map(p => <PrimitiveMesh key={p.id} primitive={p} readOnly />)}
    </Suspense>
    <OrbitControls makeDefault target={center} minDistance={2} maxDistance={1000} />
  </Canvas>;
}

/** Intentionally local React state only: no project store, localStorage or save/import actions. */
export function ArchitecturalConceptViewer({ compactEnabled = false }: { compactEnabled?: boolean }) {
  const [language, setLanguage] = useState('concept');
  const [prompt, setPrompt] = useState('A small home for a writer, arranged around a quiet garden. Explore an expressive footprint and a sheltered arrival.');
  const [scene, setScene] = useState<V3Scene | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [findings, setFindings] = useState<ConceptFinding[]>([]);
  const [revision, setRevision] = useState(0);
  async function generate() {
    setBusy(true); setError(''); setFindings([]); setScene(null);
    try {
      const response = await fetch('/api/ai/concept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, ...(language === 'compact' ? { language: 'compact' } : {}) }) });
      const body = await response.json();
      if (!response.ok || !body.scene) { setError(body.error || 'Generation failed.'); setFindings(body.findings ?? []); return; }
      setScene(body.scene); setRevision(r => r + 1);
    } catch { setError('The concept request could not complete. Check the development server and try again.'); }
    finally { setBusy(false); }
  }
  const metadata = scene?.metadata;
  return <main style={{ minHeight: '100vh', flexShrink: 0, colorScheme: 'light', background: '#f4f3ef', color: '#242b28', padding: 20 }}>
    <h1 style={{ fontSize: 24, fontWeight: 600 }}>Architectural concept evaluation</h1>
    <p style={{ margin: '8px 0 16px' }}>Development experiment · transient V3 preview · rooms and construction readiness deferred</p>
    <form onSubmit={e => { e.preventDefault(); if (!busy && prompt.trim()) void generate(); }}>
      {compactEnabled && <label>Authoring language <select aria-label="Authoring language" disabled={busy} value={language} onChange={e => setLanguage(e.target.value)}>
        <option value="concept">Existing concept</option><option value="compact">Compact massing</option>
      </select></label>}
      <label htmlFor="concept-prompt">Architectural brief</label>
      <textarea id="concept-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={12000} required rows={3} disabled={busy}
        style={{ display: 'block', width: '100%', padding: 12, margin: '6px 0 12px', background: '#fff', border: '1px solid #a9b2ab', borderRadius: 6 }} />
      <button disabled={busy || !prompt.trim()} style={{ padding: '10px 18px', background: '#284c40', color: '#fff', borderRadius: 6, opacity: busy ? .6 : 1 }}>
        {busy ? 'Terra is composing…' : 'Generate 3D Concept'}
      </button>
      <span role="status" style={{ marginLeft: 12 }}>{busy ? 'One generation request; this may take several minutes.' : scene ? 'Concept geometry validated. Saved projects are untouched.' : ''}</span>
    </form>
    {error && <div role="alert" style={{ padding: 12, marginTop: 12, background: '#fce6df' }}><p>{error}</p>
      <ul>{findings.map((f, i) => <li key={i}>{f.code} · {f.targetId}: {f.message}</li>)}</ul></div>}
    <div style={{ height: '58vh', minHeight: 360, marginTop: 16, border: '1px solid #bdc5be', borderRadius: 8, overflow: 'hidden' }}>
      {scene ? <Preview key={revision} scene={scene} /> : <p style={{ padding: 24 }}>{busy ? 'Waiting for Terra’s validated geometry…' : 'Generate a concept to explore its massing and roofs.'}</p>}
    </div>
    <p style={{ fontSize: 13, margin: '8px 0' }}>Drag to orbit · right-drag to pan · scroll to zoom</p>
    {scene && metadata && <section aria-label="Concept metadata">
      <p>Real Terra response · {String(metadata.authoringLanguage ?? 'existing concept')} · one provider request</p>
      <h2 style={{ fontSize: 20, fontWeight: 600 }}>{String(metadata.title)}</h2>
      <p>{String(metadata.concept)}</p><p style={{ margin: '8px 0' }}>{String(metadata.character)}</p>
      <ul style={{ listStyle: 'disc', paddingLeft: 20 }}>{(metadata.decisions as string[]).map((d, i) => <li key={i}>{d}</li>)}</ul>
      {(metadata.assumptions as string[]).length > 0 && <p>Assumptions: {(metadata.assumptions as string[]).join(' ')}</p>}
      <p style={{ marginTop: 8 }}>{scene.objects.filter(o => o.type === 'building-mass').length} building masses · {scene.interior?.storeys.length ?? 0} storeys · 0 rooms · {String(metadata.model)} · {metadata.usage?.inputTokens ?? '?'} input / {metadata.usage?.outputTokens ?? '?'} output tokens</p>
      <ul>{scene.objects.filter(o => o.type === 'building-mass').map(o => <li key={o.id}>{o.label}: {o.architecture?.width} × {o.architecture?.depth} m envelope, {o.architecture?.height} m high, {o.levels} storeys, {o.roofForm} roof</li>)}</ul>
    </section>}
    {compactEnabled && <CompactMassingEvaluation />}
  </main>;
}

/** Offline comparisons share the exact V3 viewport used by generated concepts. */
function CompactMassingEvaluation() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ scene?: V3Scene; comparison?: { scene?: V3Scene }; findings?: ConceptFinding[]; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  async function evaluate(body: unknown) {
    setBusy(true); setError(''); setResult(null);
    try {
      const response = await fetch('/api/ai/concept/compact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json(); setResult(data); setRevision(r => r + 1);
      if (data.input) setInput(JSON.stringify(data.input, null, 2));
      if (!response.ok) setError(data.error ?? 'Geometry rejected.');
    } catch { setError('Offline evaluation failed. Check the JSON and development server.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Offline compact massing comparison" style={{ marginTop: 32 }}>
    <h2 style={{ fontSize: 22 }}>Compact massing · deterministic offline evaluation</h2>
    <p>Hand-authored fixtures · zero provider calls · these results are not Terra generations.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>{compactMassingExampleNames.map(name => <button key={name} disabled={busy} onClick={() => void evaluate({ fixture: name })} style={{ padding: 8, border: '1px solid #a9b2ab' }}>{name}</button>)}</div>
    <label htmlFor="compact-contract">Compact contract (JSON)</label>
    <textarea id="compact-contract" rows={12} value={input} disabled={busy} onChange={e => setInput(e.target.value)} style={{ display: 'block', width: '100%', fontFamily: 'monospace', background: '#fff', padding: 12 }} />
    <button disabled={busy || !input.trim()} style={{ padding: 10, border: '1px solid #a9b2ab', marginTop: 8 }} onClick={() => {
      try { void evaluate({ input: JSON.parse(input) }); } catch { setResult(null); setError('Invalid JSON.'); }
    }}>{busy ? 'Evaluating…' : 'Evaluate JSON offline'}</button>
    {error && <p role="alert">{error}</p>}
    <ul>{result?.findings?.map((f, i) => <li key={i}>{f.code} · {f.targetId}: {f.message}</li>)}</ul>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginTop: 12 }}>
      {result?.scene && <div><h3>Compact → V3</h3><div style={{ height: 420 }}><Preview key={`compact-${revision}`} scene={result.scene} /></div></div>}
      {result?.scene && result?.comparison?.scene && <div><h3>Independent existing concept → V3</h3><div style={{ height: 420 }}><Preview key={`legacy-${revision}`} scene={result.comparison.scene} /></div></div>}
    </div>
  </section>;
}
