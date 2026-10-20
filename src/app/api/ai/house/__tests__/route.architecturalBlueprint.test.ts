import { APICallError } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLANK_V3_SCENE } from '@/lib/v3/scene';
import * as compiler from '@/lib/v3/scene';
import { fullPropertyBlueprint } from '@/lib/v3/parity/fullPropertyBlueprint';
import { distinctArchitecturalBlueprints } from '@/lib/v3/parity/architecturalBlueprint';

const mocks = vi.hoisted(() => ({ getModel: vi.fn(), usage: vi.fn(), artifact: vi.fn() }));
vi.mock('@/lib/ai/model', () => ({
  isAiConfigured: () => true, getAiModel: () => mocks.getModel(), getAiModelId: () => 'offline-blueprint-model', AI_PROVIDER_OPTIONS: {},
}));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (meta: unknown, run: () => Promise<unknown>) => { mocks.usage(meta); return run(); } }));
vi.mock('@/lib/ai/v3FailureArtifact', () => ({ retainV3FailureArtifact: (...args: unknown[]) => mocks.artifact(...args) }));

const response = (output: unknown, finish: LanguageModelV3GenerateResult['finishReason']['unified'] = 'stop', raw = false): LanguageModelV3GenerateResult => ({
  content: [{ type: 'text', text: raw ? String(output) : JSON.stringify(output) }], finishReason: { unified: finish, raw: finish }, warnings: [],
  usage: { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 50, text: 50, reasoning: 0 } },
});
const useModel = (...outputs: LanguageModelV3GenerateResult[]) => {
  const model = new MockLanguageModelV3({ doGenerate: outputs }); mocks.getModel.mockReturnValue(model); return model;
};
const post = async (prompt = 'An independent residence', extra = {}) => {
  const { POST } = await import('../route');
  return POST(new NextRequest('http://localhost/api/ai/house', { method: 'POST', body: JSON.stringify({ mode: 'generate', generationMode: 'v3-scene', prompt, currentHouseJson: JSON.stringify(BLANK_V3_SCENE), ...extra }) }));
};
const noScene = (body: Record<string, unknown>) => {
  for (const key of ['json', 'scene', 'model', 'v3FailedPreview', 'rawResponse']) expect(body).not.toHaveProperty(key);
};
beforeEach(() => {
  vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT', '1'); vi.stubEnv('AI_V3_BLUEPRINT_FIRST', '1');
  mocks.getModel.mockReset(); mocks.usage.mockReset(); mocks.artifact.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in offline acceptance'); }));
  vi.spyOn(console, 'info').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('actual production route with real SDK parsing and an offline model', () => {
  it.each(distinctArchitecturalBlueprints())('constructs $name from JSON text with only the blueprint schema on the provider wire', async ({ blueprint }) => {
    const model = useModel(response(blueprint)), res = await post(), body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200); expect(model.doGenerateCalls).toHaveLength(1);
    expect(res.headers.get('x-ai-architect-pipeline')).toBe('v3-architectural-blueprint-1');
    const call = model.doGenerateCalls[0]; expect(call.responseFormat).toMatchObject({ type: 'json' });
    expect(call.maxOutputTokens).toBe(10_000);
    const system = call.prompt.find(p => p.role === 'system'); expect(system?.content).toContain('ONE complete independent architectural blueprint');
    const schema = JSON.parse(String(system?.content).slice(String(system?.content).indexOf('{')));
    expect(schema.properties.format.const).toBe('v3-architectural-blueprint-1');
    expect(schema.properties.objects).toBeUndefined(); expect(schema.properties.v3Scene).toBeUndefined(); expect(schema.additionalProperties).toBe(false);
    expect(JSON.parse(body.json).v3Scene.metadata.usage).toMatchObject({ inputTokens: 100, outputTokens: 50, attempts: 1 });
  });
  it('repairs only diagnosed stair intent and attributes exactly two SDK calls', async () => {
    const bad = fullPropertyBlueprint(); bad.verticalCirculation[0].footprint.depth = .5;
    const model = useModel(response(bad), response(fullPropertyBlueprint())), res = await post(), body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200); expect(model.doGenerateCalls).toHaveLength(2);
    expect(mocks.usage.mock.calls.map(([meta]) => [meta.stage, meta.retryNumber])).toEqual([['v3-architectural-blueprint', 0], ['v3-architectural-blueprint-repair', 1]]);
    expect(JSON.parse(body.json).v3Scene.metadata.usage).toMatchObject({ attempts: 2, inputTokens: 200, outputTokens: 100, repair: true });
  });
  it.each(['failed-repair', 'redesign', 'wrong-contract', 'extra-scene', 'preflight', 'construction'] as const)('returns no saveable output for %s', async kind => {
    const bad = fullPropertyBlueprint(), next = fullPropertyBlueprint();
    if (kind === 'failed-repair' || kind === 'redesign') bad.verticalCirculation[0].footprint.depth = .5;
    if (kind === 'redesign') next.buildings[0].location.x += 2;
    if (kind === 'preflight') bad.buildings[0].facade.openings![1].segmentId = 'missing';
    if (kind === 'construction') {
      const compile = compiler.compileV3Scene;
      vi.spyOn(compiler, 'compileV3Scene').mockImplementation(s => { const m = compile(s); return { ...m, primitives: m.primitives.filter(p => p.id !== 'poolside-shade-slat-0') }; });
    }
    const output = kind === 'wrong-contract' ? { version: 3, objects: [] } : kind === 'extra-scene' ? { ...bad, objects: [] } : bad;
    const model = useModel(response(output), response(kind === 'failed-repair' ? bad : next)), res = await post(), body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(422); noScene(body);
    expect(model.doGenerateCalls).toHaveLength(kind === 'failed-repair' || kind === 'redesign' ? 2 : 1);
    expect(res.headers.get('x-ai-architect-pipeline')).toBe('v3-architectural-blueprint-1');
    if (kind === 'construction') expect(body.findings.map((f: { code: string }) => f.code)).toContain('ARCHITECTURAL_PART_UNBUILT');
  });
  it.each(['length', 'content-filter', 'error', 'tool-calls', 'other'] as const)('refuses an otherwise complete JSON candidate after provider finish=%s', async finish => {
    const model = useModel(response(fullPropertyBlueprint(), finish)), compile = vi.spyOn(compiler, 'compileV3Scene');
    const res = await post(), body = await res.json(); expect(res.status).toBe(502); noScene(body);
    expect(model.doGenerateCalls).toHaveLength(1); expect(compile).not.toHaveBeenCalled();
  });
  it.each(['{"format":', '', 'null', '[]'] as const)('rejects malformed/non-object output %j without retry or preview', async text => {
    const model = useModel(response(text, 'stop', true)), compile = vi.spyOn(compiler, 'compileV3Scene');
    const res = await post(), body = await res.json(); expect(res.status).toBeGreaterThanOrEqual(400); noScene(body);
    expect(model.doGenerateCalls).toHaveLength(1); expect(compile).not.toHaveBeenCalled();
  });
  it('does not hide retries inside the SDK after a retryable provider failure', async () => {
    const failed = vi.fn().mockRejectedValue(new APICallError({ message: 'offline rate limit', url: 'https://offline.invalid', requestBodyValues: {}, statusCode: 429, isRetryable: true }));
    mocks.getModel.mockReturnValue(new MockLanguageModelV3({ doGenerate: failed }));
    const res = await post(); expect(res.status).toBeGreaterThanOrEqual(400); noScene(await res.json()); expect(failed).toHaveBeenCalledTimes(1);
  });
  it('reports flag state without any authoring request or sensitive configuration', async () => {
    const { GET } = await import('../route');
    for (const [flag, enabled] of [['1', true], ['0', false], ['', false], ['true', false]] as const) {
      vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT', flag);
      const res = await GET(), body = await res.json();
      expect(body).toEqual({ architecturalBlueprint: { enabledForNewFlatGenerations: enabled, contract: 'v3-architectural-blueprint-1', maxAuthoringAttempts: 2, maxOutputTokens: 10_000 } });
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(mocks.getModel).not.toHaveBeenCalled(); expect(mocks.usage).not.toHaveBeenCalled();
  });
  it('rejects unsupported brief intent without spending a provider call', async () => {
    const res = await post('A residence with a dome roof'); expect(res.status).toBe(422); noScene(await res.json());
    expect(mocks.getModel).not.toHaveBeenCalled(); expect(res.headers.get('x-ai-architect-pipeline')).toBe('v3-architectural-blueprint-1');
  });
});
