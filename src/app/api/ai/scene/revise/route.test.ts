// The optional, user-authorized revision of a rejected plan, with a mocked provider. No paid call, network, database or file write is possible here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { compactTwoLevelFaulty, compactTwoLevelRepairMock, mansionOriginal, mansionStillInvalidMock } from '@/lib/villa/canonical/revision/revision.fixture';
import { compileArchitecturalPlan, type ArchitecturalPlan } from '@/lib/villa/canonical/plan';
const generate = vi.hoisted(() => vi.fn());
const usage = vi.hoisted(() => vi.fn(async (_: unknown, run: () => Promise<unknown>) => run()));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: generate }));
vi.mock('@/lib/ai/model', () => ({ isAiConfigured: () => true, getAiModel: () => 'offline-model', getAiModelId: () => 'offline-model', AI_PROVIDER_OPTIONS: {}, AI_NOT_CONFIGURED_MESSAGE: 'Not configured' }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: usage }));
import { POST } from './route';
beforeEach(() => { generate.mockReset(); usage.mockClear(); });
afterEach(() => vi.unstubAllEnvs());

const sha = (plan: unknown) => createHash('sha256').update(JSON.stringify(plan)).digest('hex');
const auth = (plan: unknown, over: Record<string, unknown> = {}) => ({ confirmPaidCall: true, authorizedBy: 'tester', scope: 'repair-only', planSha256: sha(plan), ...over });
const revisedResponse = (plan: ArchitecturalPlan, kind: 'repair' | 'redesign' = 'repair') => ({
    status: 'revised', revisionKind: kind, concept: 'Same concept, conflicts resolved.', plan,
    addressed: [], changes: [{ entity: 'x', change: 'y', reason: 'z' }], retained: ['everything else'], limitations: [],
});
const post = async (body: unknown) => {
    const response = await POST(new Request('http://localhost/api/ai/scene/revise', { method: 'POST', body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() };
};
const brief = 'A compact two-level house with a garden.';

describe('no authorization, no provider call', () => {
    const plan = compactTwoLevelFaulty();
    it.each([
        ['no authorization at all', { brief, plan }],
        ['consent missing', { brief, plan, authorization: { authorizedBy: 'tester', scope: 'repair-only', planSha256: sha(plan) } }],
        ['consent false', { brief, plan, authorization: auth(plan, { confirmPaidCall: false }) }],
        ['anonymous authorizer', { brief, plan, authorization: auth(plan, { authorizedBy: '  ' }) }],
        ['unknown scope', { brief, plan, authorization: auth(plan, { scope: 'anything' }) }],
        ['extra field smuggled in', { brief, plan, authorization: auth(plan, { retries: 3 }) }],
    ])('%s: refused with zero calls', async (_label, body) => {
        const { status, body: out } = await post(body);
        expect(status).toBe(403);
        expect(out.providerCalls).toBe(0);
        expect(generate).not.toHaveBeenCalled();
        expect(usage).not.toHaveBeenCalled();
    });
    it('consent given for a different plan is refused with zero calls', async () => {
        const { status, body } = await post({ brief, plan, authorization: auth(mansionOriginal()) });
        expect(status).toBe(409); expect(body.providerCalls).toBe(0); expect(generate).not.toHaveBeenCalled();
    });
    it('a plan that does not satisfy the contract is refused with zero calls', async () => {
        const bad = { version: 'nope' };
        const { status, body } = await post({ brief, plan: bad, authorization: auth(bad) });
        expect(status).toBe(422); expect(body.providerCalls).toBe(0); expect(generate).not.toHaveBeenCalled();
    });
    it('a plan that already compiles is refused with zero calls', async () => {
        const fine = compactTwoLevelRepairMock();
        expect(() => compileArchitecturalPlan(fine)).not.toThrow();
        const { status, body } = await post({ brief, plan: fine, authorization: auth(fine) });
        expect(status).toBe(409); expect(body.providerCalls).toBe(0); expect(generate).not.toHaveBeenCalled();
    });
    it('the faulty plan really is one the compiler rejects', () => { expect(() => compileArchitecturalPlan(compactTwoLevelFaulty())).toThrow(); });
});

describe('one authorized revision', () => {
    it('a valid model revision is accepted, compiled, and returns the untouched original beside it; exactly one call', async () => {
        const original = compactTwoLevelFaulty(), before = JSON.stringify(original);
        generate.mockResolvedValue({ finishReason: 'stop', output: revisedResponse(compactTwoLevelRepairMock()), totalUsage: {} });
        const { status, body } = await post({ brief, plan: original, authorization: auth(original) });
        expect(status).toBe(200);
        expect(generate).toHaveBeenCalledTimes(1);
        expect(generate.mock.calls[0][0]).toMatchObject({ maxRetries: 0, providerOptions: { openai: { strictJsonSchema: true } } });
        expect(body.providerCalls).toBe(1);
        expect(JSON.stringify(original)).toBe(before);
        expect(body.record.original.plan).toEqual(original);
        expect(body.record.original.sha256).toBe(sha(original));
        expect(body.record.revised.plan).toEqual(compactTwoLevelRepairMock());
        expect(body.accepted).toBe(true);
        expect(body.physicalValidity).toMatchObject({ valid: true, revisedErrors: 0 });
        expect(body.scene.generationStatus).toBe('pending-visual-review');
        expect(body.revisedRejected).toBeUndefined();
        expect(body.architecturalPlan).toEqual(compactTwoLevelRepairMock());
    });
    it('the request carries the whole conflict set and no proposed layout; the schema is the canonical plan schema', async () => {
        const original = compactTwoLevelFaulty();
        generate.mockResolvedValue({ finishReason: 'stop', output: revisedResponse(compactTwoLevelRepairMock()), totalUsage: {} });
        await post({ brief, plan: original, authorization: auth(original) });
        const call = generate.mock.calls[0][0], context = JSON.parse(call.messages[0].content[0].text);
        expect(context.currentPlan).toEqual(original);
        expect(context.findings.groupedByCause.flatMap((g: { findings: unknown[] }) => g.findings).length).toBe(context.findings.errorCount);
        expect(call.messages[0].content).toHaveLength(1); // no drawing is sent
        expect(call.system).toContain('PLAN REVISION');
        expect(call.system).not.toContain('REDESIGN AUTHORIZED BY THE USER');
    });
    it('a revision that is still invalid is not accepted: no scene, both versions kept, the remaining findings reported, one call, no retry', async () => {
        const original = mansionOriginal();
        generate.mockResolvedValue({ finishReason: 'stop', output: revisedResponse(mansionStillInvalidMock()), totalUsage: {} });
        const { status, body } = await post({ brief, plan: original, authorization: auth(original) });
        expect(status).toBe(200);
        expect(generate).toHaveBeenCalledTimes(1);
        expect(body.accepted).toBe(false); expect(body.scene).toBeUndefined();
        expect(body.record.original.plan).toEqual(original);
        expect(body.record.revised.plan).toEqual(mansionStillInvalidMock());
        expect(body.physicalValidity.valid).toBe(false);
        expect(body.physicalValidity.revisedErrors).toBeGreaterThan(0);
        expect(body.revisedRejected).toMatchObject({ status: 'rejected', completedHouse: false, scene: null, persisted: false });
        expect(body.revisedRejected.plan).toEqual(mansionStillInvalidMock());
        expect(body.revisedRejected.rootCauses.length).toBeGreaterThan(0);
        expect(body.error).toMatch(/Stopped/);
    });
    it('a provider failure costs the one call, is reported, and is not retried', async () => {
        const original = compactTwoLevelFaulty();
        generate.mockRejectedValue(new Error('network down'));
        const { status, body } = await post({ brief, plan: original, authorization: auth(original) });
        expect(status).toBe(200);
        expect(generate).toHaveBeenCalledTimes(1);
        expect(body.accepted).toBe(false); expect(body.record.assessment.stopReasons).toEqual(['provider-failure']);
        expect(body.record.original.plan).toEqual(original); expect(body.record.revised).toBeUndefined();
    });
    it('a response that breaks the revision or plan schema is kept as evidence, not repaired', async () => {
        const original = compactTwoLevelFaulty();
        generate.mockResolvedValue({ finishReason: 'stop', output: { status: 'revised', plan: { version: 'nope' } }, totalUsage: {} });
        const { body } = await post({ brief, plan: original, authorization: auth(original) });
        expect(generate).toHaveBeenCalledTimes(1);
        expect(body.accepted).toBe(false); expect(body.record.assessment.stopReasons).toContain('schema-invalid');
        expect(body.record.response.output).toEqual({ status: 'revised', plan: { version: 'nope' } });
    });
    it('a model that reports the intent cannot be represented is preserved and nothing is simplified', async () => {
        const original = compactTwoLevelFaulty();
        generate.mockResolvedValue({ finishReason: 'stop', output: { status: 'decision-required', decisions: ['Needs a curved wall.'] }, totalUsage: {} });
        const { body } = await post({ brief, plan: original, authorization: auth(original) });
        expect(body.accepted).toBe(false); expect(body.record.assessment.stopReasons).toEqual(['unrepresentable']);
        expect(body.record.assessment.checks.find((c: { id: string }) => c.id === 'representable').detail).toContain('curved wall');
    });
});

describe('architectural quality is reported apart from physical validity', () => {
    it('a repair authorization compiles a physically valid, programme-preserving repair without demanding a better concept', async () => {
        const original = compactTwoLevelFaulty();
        generate.mockResolvedValue({ finishReason: 'stop', output: revisedResponse(compactTwoLevelRepairMock()), totalUsage: {} });
        const { body } = await post({ brief, plan: original, authorization: auth(original) });
        const ids = body.record.assessment.checks.map((c: { id: string }) => c.id);
        expect(ids).toContain('architectural-quality-reported'); expect(ids).not.toContain('improvement-demonstrated');
        expect(body.architecturalQuality.gating).toBe(false);
        expect(body.architecturalQuality.before).not.toBeNull(); expect(body.architecturalQuality.after).not.toBeNull();
    });
    it('a redesign authorization keeps the architectural-quality gate and tells the model so', async () => {
        const original = compactTwoLevelFaulty();
        generate.mockResolvedValue({ finishReason: 'stop', output: revisedResponse(compactTwoLevelRepairMock(), 'redesign'), totalUsage: {} });
        const { body } = await post({ brief, plan: original, authorization: auth(original, { scope: 'redesign-permitted' }) });
        expect(generate.mock.calls[0][0].system).toContain('REDESIGN AUTHORIZED BY THE USER');
        expect(body.architecturalQuality.gating).toBe(true);
        expect(body.record.assessment.checks.map((c: { id: string }) => c.id)).toContain('improvement-demonstrated');
    });
});
