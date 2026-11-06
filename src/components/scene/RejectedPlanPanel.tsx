'use client';
import { useState } from 'react';
import type { RejectedGeneration } from '@/lib/villa/canonical/rejection';
import type { RevisionRecord } from '@/lib/villa/canonical/revision/revise';
/** A generation the compiler refused, shown as evidence: never a house, never saved, never applied to the open project.
 * The plan, rejection reasons, findings and the labelled diagnostic drawing can be read here and exported. */
const download = (name: string, type: string, body: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
};
type RevisionOutcome = {
    providerCalls: number; accepted: boolean; error?: string; record?: RevisionRecord; revisedRejected?: RejectedGeneration; scene?: unknown;
    physicalValidity?: { valid: boolean; originalErrors: number; revisedErrors: number | null; remainingCauses: string[]; newCauses: string[] };
    architecturalQuality?: { gating: boolean; dimensions: { dimension: string; verdict: string }[] };
};
const sha256 = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))).map(b => b.toString(16).padStart(2, '0')).join('');
/** One optional revision, started only by the explicit action below. Nothing here runs on render, on a timer or after a failure. */
function RevisionControl({ rejected, brief, onAdopt }: { rejected: RejectedGeneration; brief: string; onAdopt?: (scene: unknown) => void }) {
    const [consent, setConsent] = useState(false);
    const [scope, setScope] = useState<'repair-only' | 'redesign-permitted'>('repair-only');
    const [state, setState] = useState<{ busy: boolean; outcome?: RevisionOutcome; failure?: string; used: boolean }>({ busy: false, used: false });
    if (!rejected.plan) return null;
    const plan = rejected.plan;
    async function revise() {
        if (!consent || state.used) return;
        setState({ busy: true, used: true });
        try {
            const response = await fetch('/api/ai/scene/revise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief, plan, authorization: { confirmPaidCall: true, authorizedBy: 'user (rejected-plan panel)', scope, planSha256: await sha256(JSON.stringify(plan)) } }) });
            const outcome = await response.json() as RevisionOutcome;
            setState({ busy: false, used: true, outcome, failure: response.ok ? undefined : outcome.error });
        } catch (error) { setState({ busy: false, used: true, failure: String(error) }); }
    }
    const { outcome } = state;
    return <section aria-label="Optional architectural revision" style={{ borderTop: '1px solid #999', marginTop: 8, paddingTop: 8 }}>
        <h4 style={{ margin: 0 }}>Optional: ask Terra to revise this plan once</h4>
        {!state.used && <>
            <p>Review the concept, root causes and findings above first. A revision sends this plan, the brief and every finding to the model <b>once</b> (one paid call). The model returns a complete new plan; software changes nothing and does not retry. Your plan above is kept either way.</p>
            <label><input type="radio" name="revision-scope" checked={scope === 'repair-only'} onChange={() => setScope('repair-only')} /> Resolve the conflicts and keep the concept (repair only)</label><br />
            <label><input type="radio" name="revision-scope" checked={scope === 'redesign-permitted'} onChange={() => setScope('redesign-permitted')} /> Also allow the model to reconsider the architectural concept (redesign)</label>
            <p><label><input type="checkbox" checked={consent} onChange={ev => setConsent(ev.target.checked)} /> I authorize one paid model call to revise this plan.</label></p>
            <button type="button" disabled={!consent || state.busy} onClick={revise}>Revise once</button>
        </>}
        {state.busy && <p>Waiting for the model (one request, no retry)…</p>}
        {state.failure && <p role="alert">The revision did not complete: {state.failure}. No further request was made.</p>}
        {outcome && <div>
            <p><b>{outcome.accepted ? 'Revision accepted for construction (rendered review still required).' : 'Revision not accepted.'}</b> Model calls made: {outcome.providerCalls}. The original plan above is unchanged; the model&apos;s plan is shown below.</p>
            {outcome.physicalValidity && <p><b>Physical validity:</b> {outcome.physicalValidity.valid ? 'the revised plan compiles' : 'the revised plan is still refused or was not produced'}; errors {outcome.physicalValidity.originalErrors} → {outcome.physicalValidity.revisedErrors ?? 'n/a'}{outcome.physicalValidity.remainingCauses.length ? `; causes still present: ${outcome.physicalValidity.remainingCauses.join(', ')}` : ''}{outcome.physicalValidity.newCauses.length ? `; new causes: ${outcome.physicalValidity.newCauses.join(', ')}` : ''}.</p>}
            {outcome.architecturalQuality && <p><b>Architectural quality (separate):</b> {outcome.architecturalQuality.dimensions.map(d => `${d.dimension} ${d.verdict}`).join(', ') || 'not measured'}. {outcome.architecturalQuality.gating ? 'Redesign was authorized, so a measured improvement was required.' : 'Repair only: reported, not required, and the concept was not judged against a better one.'}</p>}
            {outcome.record?.revised && <p><b>Model&apos;s concept:</b> {outcome.record.revised.concept}</p>}
            {outcome.record && !outcome.accepted && outcome.record.assessment.checks.filter(c => !c.ok).length > 0 && <ul>{outcome.record.assessment.checks.filter(c => !c.ok).map(c => <li key={c.id}><code>{c.id}</code> {c.detail}</li>)}</ul>}
            {outcome.revisedRejected && <div style={{ marginLeft: 12 }}><h4 style={{ margin: 0 }}>Revised plan — still refused</h4><RejectedPlanPanel rejected={outcome.revisedRejected} onDismiss={() => undefined} /></div>}
            {outcome.accepted && outcome.scene !== undefined && onAdopt && <button type="button" onClick={() => onAdopt(outcome.scene)}>Use the revised house</button>}{' '}
            {outcome.record && <button type="button" onClick={() => download(`${(plan.id ?? 'plan').replace(/[^a-z0-9-]/gi, '-')}.revision.json`, 'application/json', JSON.stringify(outcome.record, null, 2))}>Export both versions (JSON)</button>}
        </div>}
    </section>;
}
export function RejectedPlanPanel({ rejected, onDismiss, brief, onAdopt }: { rejected: RejectedGeneration; onDismiss: () => void; brief?: string; onAdopt?: (scene: unknown) => void }) {
    const errors = rejected.diagnostics.findings.filter(f => f.severity === 'error');
    const slug = (rejected.plan?.id ?? 'rejected-generation').replace(/[^a-z0-9-]/gi, '-');
    const byStatus = rejected.corrections?.byStatus;
    return <section aria-label="Rejected architectural plan" style={{ border: '2px solid #b00020', padding: 8, margin: '8px 0' }}>
        <h3 style={{ margin: 0 }}>Rejected plan — not a completed house</h3>
        <p>Compilation stopped in the <b>{rejected.stage}</b> phase{rejected.notReached.length ? `; ${rejected.notReached.join(', ')} never ran, so those results are unknown, not passed` : ''}. Nothing was saved, built or applied to your project.</p>
        {rejected.plan && <p><b>Thesis:</b> {rejected.plan.thesis}</p>}
        <details open><summary>Why the compiler refused it ({rejected.compilerRejection.decisions.length})</summary><ul>{rejected.compilerRejection.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></details>
        {rejected.unparsed && <details><summary>Provider output could not be read as a plan</summary><p>{rejected.unparsed.reason}</p>{rejected.unparsed.rawText && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{rejected.unparsed.rawText}</pre>}</details>}
        {rejected.rootCauses?.length > 0 && <details open><summary>Root causes ({rejected.rootCauses.length} decisions behind {errors.length} findings)</summary><ul>{rejected.rootCauses.map(c => <li key={c.key}><b>{c.title}</b> ({c.count}): {c.explanation}{c.options.length > 0 && <> Options: {c.options.join('; ')}.</>}</li>)}</ul></details>}
        {errors.length > 0 && <details><summary>Independent findings ({errors.length}{rejected.diagnostics.truncated ? '+' : ''})</summary><ul>{errors.map((f, i) => <li key={i}><code>{f.stage}</code> {f.id}: {f.message}</li>)}</ul></details>}
        {byStatus && <p>Correction offers (never applied): {byStatus.verified} verified, {byStatus['decision-required']} need an architectural decision, {byStatus.unverified} unverified, {byStatus['introduces-conflicts']} introduce new conflicts.</p>}
        {rejected.concept && rejected.concept.findings.length > 0 && <details><summary>Architectural concerns, reported apart from why it was refused ({rejected.concept.findings.length})</summary><ul>{rejected.concept.findings.map((f, i) => <li key={i}>{f.message}</li>)}</ul></details>}
        {/* eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URL of the diagnostic drawing: nothing to optimise or fetch */}
        {rejected.drawing && <figure><img alt="Diagnostic plan of the rejected arrangement, not a building" style={{ maxWidth: '100%' }} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(rejected.drawing.svg)}`} /><figcaption>{rejected.drawing.caption}</figcaption></figure>}
        {brief && <RevisionControl rejected={rejected} brief={brief} onAdopt={onAdopt} />}
        <p>
            <button type="button" onClick={() => download(`${slug}.rejected.json`, 'application/json', JSON.stringify(rejected, null, 2))}>Export rejected plan (JSON)</button>{' '}
            {rejected.drawing && <button type="button" onClick={() => download(`${slug}.rejected-plan.svg`, 'image/svg+xml', rejected.drawing!.svg)}>Export diagnostic drawing (SVG)</button>}{' '}
            <button type="button" onClick={onDismiss}>Dismiss</button>
        </p>
    </section>;
}
