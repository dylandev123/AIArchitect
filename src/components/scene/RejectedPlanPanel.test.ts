import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { RejectedPlanPanel } from './RejectedPlanPanel';
import { rejectedGeneration, unparsedGeneration } from '@/lib/villa/canonical/rejection';
import { mansionOriginal } from '@/lib/villa/canonical/revision/revision.fixture';
afterEach(() => vi.unstubAllGlobals());
const rejected = () => rejectedGeneration({ plan: mansionOriginal(), error: new Error('compiler refused'), brief: 'brief' });
const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(RejectedPlanPanel, { rejected: rejected(), onDismiss: () => undefined, ...props } as never));

it('renders the review first and the revision control last; the paid action is disabled until consent and nothing is sent on render', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const out = html({ brief: 'brief' });
    const at = (text: string) => { const i = out.indexOf(text); expect(i, text).toBeGreaterThan(-1); return i; };
    expect(at('Why the compiler refused it')).toBeLessThan(at('Optional: ask Terra to revise this plan once'));
    expect(at('Root causes')).toBeLessThan(at('Optional: ask Terra to revise this plan once'));
    expect(at('<b>Thesis:</b>')).toBeLessThan(at('Optional: ask Terra to revise this plan once'));
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Revise once<\/button>/);
    expect(out).toMatch(/type="checkbox"(?![^>]*checked)/);
    expect(out).toContain('one paid call');
    expect(fetch).not.toHaveBeenCalled();
});
it('offers no revision without a brief, and none for provider output that could not be read as a plan', () => {
    expect(html({})).not.toContain('Revise once');
    const unread = renderToStaticMarkup(createElement(RejectedPlanPanel, { rejected: unparsedGeneration({ error: new Error('bad'), rawText: '{}' }), brief: 'brief', onDismiss: () => undefined } as never));
    expect(unread).not.toContain('Revise once');
});
