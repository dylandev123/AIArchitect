import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { compactMassingExample, compactMassingExampleNames } from '@/lib/v3/evaluation/compactMassingExamples';
import { useProjectStore } from '@/store/useProjectStore';
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AI_V3_CONCEPT_EVALUATION', '1'); vi.stubEnv('AI_V3_COMPACT_MASSING_EVALUATION', '1');
  vi.stubEnv('OPENAI_API_KEY', '');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Offline evaluation must never fetch.'); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const post = (body: unknown) => POST(new Request('http://localhost/api/ai/concept/compact', { method: 'POST', body: JSON.stringify(body) }));
describe('offline compact evaluator endpoint', () => {
  it.each(compactMassingExampleNames)('compares %s with independent existing concept input without credentials or network', async fixture => {
    const before = JSON.stringify(useProjectStore.getState().projects), response = await post({ fixture }), body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body).toMatchObject({ ok: true, comparison: { ok: true }, provenance: 'deterministic-hand-authored-fixture', providerCalls: 0 });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetch).not.toHaveBeenCalled(); expect(JSON.stringify(useProjectStore.getState().projects)).toBe(before);
  });
  it('validates custom JSON and returns precise findings without a replacement scene', async () => {
    const input = compactMassingExample('u-courtyard').compact; input.volumes[0].roof.form = 'hip';
    const response = await post({ input }), body = await response.json();
    expect(response.status).toBe(422); expect(body).not.toHaveProperty('scene');
    expect(body.findings[0].code).toBe('ROOF_FOOTPRINT_UNSUPPORTED'); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['production', 'test'])('rejects %s even if both flags are set', async env => {
    vi.stubEnv('NODE_ENV', env); expect((await post({ fixture: 'asymmetric-wings' })).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['AI_V3_CONCEPT_EVALUATION', 'AI_V3_COMPACT_MASSING_EVALUATION'])('requires %s', async key => {
    vi.stubEnv(key, '0'); expect((await post({ fixture: 'asymmetric-wings' })).status).toBe(403);
  });
  it('rejects malformed JSON, unknown fixtures and project payloads', async () => {
    expect((await POST(new Request('http://localhost', { method: 'POST', body: '{' }))).status).toBe(400);
    for (const body of [{ fixture: 'invented' }, { input: {}, projectId: 'saved-project' }, { prompt: 'Do not generate' }]) expect((await post(body)).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
