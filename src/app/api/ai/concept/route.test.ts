import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { conceptExample } from '@/lib/v3/__tests__/fixtures/conceptExamples';
import { architecturalConceptPrompt } from '@/lib/v3/architecturalConcept';
import { compactMassingPrompt } from '@/lib/v3/compactMassing';
import { compactMassingExample } from '@/lib/v3/evaluation/compactMassingExamples';
import { useProjectStore } from '@/store/useProjectStore';
import { POST, GET } from './route';

const records = vi.hoisted(() => ({ append: vi.fn(), capture: vi.fn(), validation: vi.fn() }));
// Production SDK, model factory, adapter AND usage logger. Only network/storage are replaced.
vi.mock('@/lib/ai/usage/store', () => ({ appendUsageRecord: records.append }));
vi.mock('@/lib/ai/conceptResponseArtifact', () => ({ retainConceptResponse: records.capture, retainConceptValidation: records.validation }));
let output: unknown, status: number, finish: string;
let rawText: string | undefined;
let wires: Record<string, unknown>[];
beforeEach(() => {
  records.append.mockReset(); records.append.mockResolvedValue(undefined);
  records.capture.mockReset(); records.capture.mockImplementation(async (rawResponse: string) => ({ rawResponse, sha256: 'offline-hash' }));
  records.validation.mockReset(); records.validation.mockResolvedValue(undefined);
  output = conceptExample(); status = 200; finish = 'completed'; wires = [];
  rawText = undefined;
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AI_V3_CONCEPT_EVALUATION', '1');
  vi.stubEnv('AI_HOUSE_MODEL', 'gpt-5.6-terra'); vi.stubEnv('OPENAI_API_KEY', 'offline-placeholder-never-sent');
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init?: RequestInit) => {
    const wire = JSON.parse(String(init?.body)); wires.push(wire);
    if (status !== 200) return Response.json({ error: { message: 'Offline provider failure', type: 'insufficient_quota', code: 'insufficient_quota' } }, { status });
    return Response.json({ id: 'offline-concept-response', model: wire.model, created_at: 1, status: finish,
      ...(finish === 'incomplete' ? { incomplete_details: { reason: 'max_output_tokens' } } : {}),
      output: [{ type: 'message', id: 'offline-message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: rawText ?? JSON.stringify(output), annotations: [] }] }],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    });
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const post = (body: unknown = { prompt: 'A small quiet courtyard home' }) => POST(new Request('http://localhost/api/ai/concept', { method: 'POST', body: JSON.stringify(body) }));

describe('development concept route with offline production transport', () => {
  it('uses Terra configuration and usage tracking and never mutates saved projects', async () => {
    const before = JSON.stringify(useProjectStore.getState().projects);
    const response = await post(), body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(body.scene.interior.rooms).toEqual([]);
    expect(wires).toHaveLength(1);
    expect(wires[0]).toMatchObject({ model: 'gpt-5.6-terra', max_output_tokens: 8000, text: { format: { type: 'json_object' } }, input: [{ role: 'developer', content: architecturalConceptPrompt() }, { role: 'user', content: expect.anything() }] });
    expect(wires[0]).not.toHaveProperty('reasoning'); expect(wires[0]).not.toHaveProperty('temperature');
    expect(records.append).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ stage: 'v3-concept-evaluation', projectId: null, success: true, inputTokens: 100, outputTokens: 50, model: 'gpt-5.6-terra' }));
    expect(body.scene.metadata.usage).toMatchObject({ inputTokens: 100, outputTokens: 50, attempts: 1, repair: false });
    expect(JSON.stringify(useProjectStore.getState().projects)).toBe(before);
    expect(body).not.toHaveProperty('json');
  });
  it('honours the existing model override', async () => {
    vi.stubEnv('AI_HOUSE_MODEL', 'existing-terra-override');
    expect((await post()).status).toBe(200);
    expect(wires[0].model).toBe('existing-terra-override');
  });
  it('uses the same one-call Terra transport for compact input, with no translation or repair call', async () => {
    vi.stubEnv('AI_V3_COMPACT_MASSING_EVALUATION', '1');
    output = compactMassingExample('asymmetric-wings').compact;
    const before = JSON.stringify(useProjectStore.getState().projects);
    const response = await post({ prompt: 'An asymmetric home with a lower wing', language: 'compact' }), body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    expect(wires).toHaveLength(1);
    expect(wires[0]).toMatchObject({ model: 'gpt-5.6-terra', max_output_tokens: 8000, input: [{ role: 'developer', content: compactMassingPrompt() }, { role: 'user', content: expect.anything() }] });
    expect(body.scene.metadata).toMatchObject({ authoringLanguage: 'terra-massing-1', usage: { attempts: 1, repair: false } });
    expect(body.scene.objects.map((o: { id: string }) => o.id)).toEqual(['mass-home', 'mass-wing']);
    expect(records.append.mock.calls[0][0].stage).toBe('v3-compact-massing-evaluation');
    expect(JSON.stringify(useProjectStore.getState().projects)).toBe(before);
  });
  it('refuses compact geometry errors without a second call', async () => {
    vi.stubEnv('AI_V3_COMPACT_MASSING_EVALUATION', '1');
    const c = compactMassingExample('u-courtyard').compact; c.volumes[0].roof.form = 'hip'; output = c;
    const response = await post({ prompt: 'A U-shaped home', language: 'compact' }), body = await response.json();
    expect(response.status).toBe(422); expect(body).not.toHaveProperty('scene'); expect(wires).toHaveLength(1);
    expect(body.findings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ROOF_FOOTPRINT_UNSUPPORTED' })]));
    expect(records.validation).toHaveBeenCalledOnce();
  });
  it('requires a separate compact flag before any provider request', async () => {
    vi.stubEnv('AI_V3_COMPACT_MASSING_EVALUATION', '0');
    expect((await post({ prompt: 'Home', language: 'compact' })).status).toBe(403);
    expect(wires).toHaveLength(0); expect(records.append).not.toHaveBeenCalled();
    expect((await post()).status).toBe(200);
  });
  it('reports geometry rejection in both response and usage with no retry', async () => {
    const c = conceptExample(); c.buildings[0].roof.form = 'hip'; output = c;
    const response = await post(), body = await response.json();
    expect(response.status).toBe(422); expect(body.scene).toBeUndefined();
    expect(body.findings.some((f: { code: string }) => f.code === 'ROOF_FOOTPRINT_UNSUPPORTED')).toBe(true);
    expect(wires).toHaveLength(1); expect(records.append.mock.calls[0][0]).toMatchObject({ success: false, errorKind: 'concept_geometry' });
    expect(records.capture).toHaveBeenCalledExactlyOnceWith(JSON.stringify(output), expect.objectContaining({ finishReason: 'stop', model: 'gpt-5.6-terra' }));
    expect(body.responseEvidence.rawResponse).toBe(JSON.stringify(output));
    expect(body.footprintTrace[0]).toMatchObject({ kind: 'articulated', dimensions: [24, 6.9, 18] });
    expect(records.validation).toHaveBeenCalledExactlyOnceWith('offline-hash', expect.objectContaining({ ok: false, footprintTrace: body.footprintTrace }));
  });
  it('reports provider quota errors without retrying or exposing authentication', async () => {
    status = 429;
    const response = await post(), body = await response.json();
    expect(response.status).toBe(502); expect(body.failure).toMatchObject({ status: 429, providerCode: 'insufficient_quota' });
    expect(wires).toHaveLength(1); expect(records.append.mock.calls[0][0].success).toBe(false);
    expect(JSON.stringify(body)).not.toContain('offline-placeholder');
  });
  it('captures the original bytes even when JSON parsing fails', async () => {
    rawText = '{ malformed response';
    const response = await post(), body = await response.json();
    expect(response.status).toBe(502);
    expect(body.responseEvidence.rawResponse).toBe(rawText);
    expect(records.capture).toHaveBeenCalledExactlyOnceWith(rawText, expect.anything());
    expect(body).not.toHaveProperty('scene');
    expect(wires).toHaveLength(1);
  });
  it('rejects incomplete output instead of showing partial geometry', async () => {
    finish = 'incomplete';
    const response = await post(), body = await response.json();
    expect(response.status).toBe(502); expect(body.scene).toBeUndefined(); expect(wires).toHaveLength(1);
    expect(records.append.mock.calls[0][0]).toMatchObject({ success: false, errorKind: 'concept_incomplete' });
    expect(body.responseEvidence.rawResponse).toBe(JSON.stringify(output));
    expect(records.capture).toHaveBeenCalledOnce();
  });
  it.each(['production', 'test'])('disables GET and POST in %s even with the flag set', async env => {
    vi.stubEnv('NODE_ENV', env);
    expect((await GET()).status).toBe(403); expect((await post()).status).toBe(403); expect(wires).toHaveLength(0);
  });
  it('requires explicit development opt-in and rejects project payloads before a call', async () => {
    vi.stubEnv('AI_V3_CONCEPT_EVALUATION', '0'); expect((await post()).status).toBe(403);
    vi.stubEnv('AI_V3_CONCEPT_EVALUATION', '1');
    expect((await post({ prompt: 'Home', currentHouseJson: '{}' })).status).toBe(400);
    expect((await post({ prompt: ' ' })).status).toBe(400);
    expect(wires).toHaveLength(0); expect(records.append).not.toHaveBeenCalled();
  });
});
