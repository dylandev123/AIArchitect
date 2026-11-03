'use client';
import type { RejectedGeneration } from '@/lib/villa/canonical/rejection';
/** A generation the compiler refused, shown as evidence: never a house, never saved, never applied to the open project.
 * The plan, rejection reasons, findings and the labelled diagnostic drawing can be read here and exported. */
const download = (name: string, type: string, body: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
};
export function RejectedPlanPanel({ rejected, onDismiss }: { rejected: RejectedGeneration; onDismiss: () => void }) {
    const errors = rejected.diagnostics.findings.filter(f => f.severity === 'error');
    const slug = (rejected.plan?.id ?? 'rejected-generation').replace(/[^a-z0-9-]/gi, '-');
    const byStatus = rejected.corrections?.byStatus;
    return <section aria-label="Rejected architectural plan" style={{ border: '2px solid #b00020', padding: 8, margin: '8px 0' }}>
        <h3 style={{ margin: 0 }}>Rejected plan — not a completed house</h3>
        <p>Compilation stopped in the <b>{rejected.stage}</b> phase{rejected.notReached.length ? `; ${rejected.notReached.join(', ')} never ran, so those results are unknown, not passed` : ''}. Nothing was saved, built or applied to your project.</p>
        {rejected.plan && <p><b>Thesis:</b> {rejected.plan.thesis}</p>}
        <details open><summary>Why the compiler refused it ({rejected.compilerRejection.decisions.length})</summary><ul>{rejected.compilerRejection.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></details>
        {rejected.unparsed && <details><summary>Provider output could not be read as a plan</summary><p>{rejected.unparsed.reason}</p>{rejected.unparsed.rawText && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>{rejected.unparsed.rawText}</pre>}</details>}
        {errors.length > 0 && <details><summary>Independent findings ({errors.length}{rejected.diagnostics.truncated ? '+' : ''})</summary><ul>{errors.map((f, i) => <li key={i}><code>{f.stage}</code> {f.id}: {f.message}</li>)}</ul></details>}
        {byStatus && <p>Correction offers (never applied): {byStatus.verified} verified, {byStatus['decision-required']} need an architectural decision, {byStatus.unverified} unverified, {byStatus['introduces-conflicts']} introduce new conflicts.</p>}
        {rejected.concept && rejected.concept.findings.length > 0 && <details><summary>Architectural review ({rejected.concept.findings.length})</summary><ul>{rejected.concept.findings.map((f, i) => <li key={i}>{f.message}</li>)}</ul></details>}
        {/* eslint-disable-next-line @next/next/no-img-element -- an inline SVG data URL of the diagnostic drawing: nothing to optimise or fetch */}
        {rejected.drawing && <figure><img alt="Diagnostic plan of the rejected arrangement, not a building" style={{ maxWidth: '100%' }} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(rejected.drawing.svg)}`} /><figcaption>{rejected.drawing.caption}</figcaption></figure>}
        <p>
            <button type="button" onClick={() => download(`${slug}.rejected.json`, 'application/json', JSON.stringify(rejected, null, 2))}>Export rejected plan (JSON)</button>{' '}
            {rejected.drawing && <button type="button" onClick={() => download(`${slug}.rejected-plan.svg`, 'image/svg+xml', rejected.drawing!.svg)}>Export diagnostic drawing (SVG)</button>}{' '}
            <button type="button" onClick={onDismiss}>Dismiss</button>
        </p>
    </section>;
}
