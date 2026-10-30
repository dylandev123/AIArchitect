'use client';
/* Evidence PNGs are displayed without modification. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from 'react';
import { ReviewPreview } from '@/app/dev/villa-playground/review-preview';
import type { ArchitecturalScene } from '@/lib/villa/scene/model';
import type { SceneCapture } from '@/lib/villa/visual-review';
import { REVIEW_VIEWS, runGenerationReview, type GenerationReviewRecord } from '@/lib/villa/scene/generationReview';

export function useGenerationReview() {
  const [capture, setCapture] = useState<{ scene: ArchitecturalScene; view: SceneCapture['view']; pose?: SceneCapture['camera']; ready: (shot: SceneCapture) => void; fail: (error: string) => void }>();
  const [records, setRecords] = useState<GenerationReviewRecord[]>([]);
  const [status, setStatus] = useState('');
  const mounted = useRef(true), running = useRef(false), pending = useRef<(() => void) | undefined>(undefined), abort = useRef<AbortController | undefined>(undefined);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; pending.current?.(); abort.current?.abort(); }; }, []);
  async function run(initial: ArchitecturalScene, revision: () => string, current: () => ArchitecturalScene, commit: (scene: ArchitecturalScene, label: string) => void) {
    if (running.current) throw Error('Generation review already running.');
    running.current = true; abort.current = new AbortController(); setRecords([]);
    let expectedRevision = revision(), baseline = JSON.stringify(initial);
    const assertCurrent = () => { if (!mounted.current || abort.current?.signal.aborted || revision() !== expectedRevision || JSON.stringify(current()) !== baseline) throw Error('Scene revision changed; review stopped.'); };
    try {
      await runGenerationReview(initial, {
        assertCurrent,
        capture: async (scene, previous) => {
          const shots: SceneCapture[] = [];
          for (const view of REVIEW_VIEWS) {
            assertCurrent(); setStatus(`Capturing ${view.toLowerCase()} view…`);
            shots.push(await new Promise<SceneCapture>((resolve, reject) => {
              const done = (error?: string, shot?: SceneCapture) => { clearTimeout(timer); pending.current = undefined; if (error) reject(Error(error)); else resolve(shot!); };
              const timer = setTimeout(() => done('Render timed out; previous version retained.'), 30000);
              pending.current = () => done('Review closed.');
              setCapture({ scene, view, pose: previous?.find(s => s.view === view)?.camera, ready: shot => done(undefined, shot), fail: error => done(error) });
            }));
          }
          setCapture(undefined); return shots;
        },
        request: async input => {
          assertCurrent(); setStatus(`Terra visual ${input.phase} · pass ${input.pass} of 2…`);
          const response = await fetch('/api/ai/scene/visual-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.any([abort.current!.signal, AbortSignal.timeout(175000)]) });
          const body = await response.json(); if (!response.ok) throw Error(body.error || 'Visual review failed.'); return body.output;
        },
        commit: (next, record) => { assertCurrent(); commit(next, `Visual refinement ${record.pass} — Terra preferred`); baseline = JSON.stringify(next); expectedRevision = revision(); },
        record: record => { if (mounted.current) { setRecords(old => [...old, record]); setStatus(record.error || (record.accepted ? `Pass ${record.pass}: refinement retained by Terra comparison.` : record.comparison ? `Pass ${record.pass}: previous version retained. ${record.comparison.reason}` : 'Review completed without a supported refinement.')); } },
      });
    } finally { running.current = false; if (mounted.current) setCapture(undefined); }
  }
  const panel = <details open={!!capture}><summary>Generation visual review ({records.length}/2 passes)</summary><p role="status">{status || 'Generate includes up to two targeted refinement passes. Terra compares actual renders; visual preference remains a model judgment.'}</p>{capture && <ReviewPreview key={`${capture.view}-${JSON.stringify(capture.scene)}`} config={capture.scene} view={capture.view} cameraPose={capture.pose} ready={capture.ready} onError={capture.fail} />}{records.map(record => <details key={record.pass}><summary>Pass {record.pass}: {record.accepted ? 'retained' : 'previous version kept'}</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ review: record.review, diff: record.diff, comparison: record.comparison, error: record.error }, null, 2)}</pre>{record.beforeCaptures.map((shot, i) => <div key={shot.view}><p>{shot.view}: previous / proposed</p><img src={shot.image} alt={`${shot.view} previous`} width={260}/>{record.afterCaptures?.[i] && <img src={record.afterCaptures[i].image} alt={`${shot.view} proposed`} width={260}/>}</div>)}</details>)}{!!records.length && <button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'generation-visual-review.json'; a.click(); URL.revokeObjectURL(url); }}>Export review evidence</button>}</details>;
  return { run, panel };
}
