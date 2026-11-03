// Offline replay of the retained end-to-end failure (docs/architecture/e2e-generation-diagnostic-2026-11-03) through the normal canonical
// Generate route with a mocked provider. The plan is Terra's, read unmodified; no paid call, database write or network is used.
import { emptySnapshot } from '@/lib/library/store';
vi.mock('@/lib/library/store', async original => ({ ...await original<typeof import('@/lib/library/store')>(), readLibrary: async () => emptySnapshot() }));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { canonicalFixture } from '@/lib/villa/canonical/fixture';
const generate = vi.hoisted(() => vi.fn());
const writeFile = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile }));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: generate }));
vi.mock('@/lib/ai/model', () => ({ isAiConfigured: () => true, getAiModel: () => 'offline-model', getAiModelId: () => 'offline-model', AI_PROVIDER_OPTIONS: {}, AI_NOT_CONFIGURED_MESSAGE: 'Not configured' }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_: unknown, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/villa/design-learning-store', () => ({ listDesignLessonSummaries: async () => [] }));
import { POST } from './route';
beforeEach(() => { vi.stubEnv('NODE_ENV', 'test'); generate.mockReset(); writeFile.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
const DIR = 'docs/architecture/e2e-generation-diagnostic-2026-11-03';
const retained = JSON.parse(readFileSync(`${DIR}/canonical-plan.json`, 'utf8'));
const brief = JSON.parse(readFileSync(`${DIR}/brief.json`, 'utf8')).prompt as string;
const post = async (prompt: string, output: unknown) => {
  generate.mockResolvedValue({ finishReason: 'stop', output });
  const response = await POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify({ mode: 'generate', prompt }) }));
  return { status: response.status, body: await response.json() };
};

describe('a plan the compiler rejects is preserved for the requesting user', () => {
  it('the retained failed mansion comes back with its unmodified plan, every rejection reason, findings, offers and a labelled drawing', async () => {
    const before = JSON.stringify(retained);
    const { status, body } = await post(brief, retained);
    expect(status).toBe(422);
    expect(generate).toHaveBeenCalledTimes(1);
    // The historical error contract is intact.
    expect(body.error).toMatch(/west-wing-pavilion-adjoin/);
    expect(body.decisions.length).toBe(4);
    expect(body.scene).toBeUndefined();
    expect(JSON.stringify(retained)).toBe(before);
    const r = body.rejected;
    expect(r).toMatchObject({ status: 'rejected', completedHouse: false, scene: null, persisted: false, stage: 'derive' });
    expect(r.notReached).toEqual(['construction', 'exterior', 'composition', 'site', 'validate']);
    // The plan survives exactly as authored: same thesis, wings, rooms, portals, composition.
    expect(r.plan).toEqual(retained.plan);
    expect(r.designDecisions.thesis).toBe(retained.plan.thesis);
    expect(r.designDecisions.composition.volumes).toHaveLength(3);
    expect(r.designDecisions.wings.map((w: { id: string }) => w.id)).toEqual(['core-pavilion', 'west-suite-wing', 'east-suite-wing']);
    expect(r.limitations).toEqual(retained.limitations);
    // Compiler reasons: all three unplaceable openings are reported together with the unmet declaration.
    const reasons = r.compilerRejection.decisions.join('\n');
    for (const id of ['dining-to-terrace', 'living-to-west-gallery', 'dining-to-east-gallery', 'west-wing-pavilion-adjoin']) expect(reasons).toContain(id);
    // Independent findings carry no false composition diagnostics.
    const errors = r.diagnostics.findings.filter((f: { severity: string }) => f.severity === 'error');
    expect(errors.map((f: { id: string }) => f.id).sort()).toEqual(['arrival-lawn', 'dining-to-east-gallery', 'dining-to-terrace', 'living-to-west-gallery', 'pool-lawn-reserve']);
    expect(r.diagnostics.findings.some((f: { message: string }) => /neither a roof nor a space above/.test(f.message))).toBe(false);
    // Measured geometry, site derivation and attribution.
    expect(r.measured.rects['living-salon']).toBeDefined();
    expect(r.coordination.site.required).toEqual({ width: 64, depth: 78 });
    expect(r.coordination.siteConflicts.map((c: { item: string; with: string }) => `${c.item}/${c.with}`)).toEqual(['arrival-lawn/powder-room']);
    // Offers are classified; none is claimed verified while the plan still cannot compile, and none was applied.
    expect(r.corrections.byStatus.verified).toBe(0);
    expect(r.corrections.corrections.every((c: { neverApplied: boolean }) => c.neverApplied)).toBe(true);
    expect(r.concept.programme.brief.missing.map((m: { id: string }) => m.id)).toContain('bedrooms');
    // The drawing is labelled as not a building.
    expect(r.drawing.svg).toMatch(/^<svg/);
    expect(r.drawing.caption).toMatch(/NOT A BUILDING/);
    expect(r.drawing.svg).toMatch(/NOT A BUILDING/);
    expect(JSON.stringify(body).length).toBeLessThan(900_000);
    // Nothing was written anywhere.
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('a decision-required proposal and a compiling plan keep their existing contracts', async () => {
    const decision = await post('Any house', { status: 'decision-required', decisions: ['Need a graded site.'] });
    expect(decision.status).toBe(422);
    expect(decision.body.decisions).toEqual(['Need a graded site.']);
    expect(decision.body.rejected).toBeUndefined();
    const ok = await post('A small house with a pool.', { status: 'proposed', plan: canonicalFixture(), limitations: [] });
    expect(ok.status).toBe(200);
    expect(ok.body.rejected).toBeUndefined();
    expect(ok.body.scene.elements.length).toBeGreaterThan(10);
  });

  it('keeps the provider text when the output cannot be read as a proposal', async () => {
    generate.mockRejectedValue(Object.assign(new Error('No object generated: response did not match schema.'), { text: '{"not":"a plan"}' }));
    const response = await POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify({ mode: 'generate', prompt: 'A house' }) }));
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body.rejected).toMatchObject({ status: 'rejected', completedHouse: false, plan: null, stage: 'provider-output', unparsed: { rawText: '{"not":"a plan"}', truncated: false } });
    expect(body.rejected.notReached).toHaveLength(7);
  });

  it('a plan with several independent errors is rejected once with all of them', async () => {
    const plan = canonicalFixture();
    plan.site = { ...plan.site, width: 12, depth: 12 };
    plan.portals.push({ id: 'bad-window', host: { space: 'hall', side: 'east' }, to: 'exterior', alignment: 'centre', width: 1, height: 1, mode: 'window', sill: .9 });
    plan.spaces.find(s => s.id === 'day-room')!.placement = { relativeTo: 'hall', side: 'same', alignment: 'start', gap: 0 };
    const { status, body } = await post('A house', { status: 'proposed', plan, limitations: [] });
    expect(status).toBe(422);
    expect(body.rejected.plan).toEqual(plan);
    const ids = body.rejected.diagnostics.findings.filter((f: { severity: string }) => f.severity === 'error').map((f: { stage: string }) => f.stage);
    expect(new Set(ids).size).toBeGreaterThanOrEqual(2);
  });
});
