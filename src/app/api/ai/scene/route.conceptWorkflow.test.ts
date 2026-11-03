// Offline end-to-end checks of the normal /api/ai/scene handler with a mocked provider: brief -> knowledge -> composition ->
// compiled geometry -> concept review -> editing and persistence. Plans are developer-authored; they test software behaviour,
// not whether Terra composes well. No paid call, database write or network is used.
import { emptySnapshot } from '@/lib/library/store';
vi.mock('@/lib/library/store', async original => ({ ...await original<typeof import('@/lib/library/store')>(), readLibrary: async () => emptySnapshot() }));
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalFixture } from '@/lib/villa/canonical/fixture';
import { strategyFixture } from '@/lib/villa/canonical/strategies.fixture';
import { conceptReview } from '@/lib/villa/canonical/concept';
import { compileArchitecturalPlan, type ArchitecturalPlan } from '@/lib/villa/canonical/plan';
import { applySceneOperations, validateScene } from '@/lib/villa/scene/model';
const generate = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: generate }));
vi.mock('@/lib/ai/model', () => ({ isAiConfigured: () => true, getAiModel: () => 'offline-model', getAiModelId: () => 'offline-model', AI_PROVIDER_OPTIONS: {}, AI_NOT_CONFIGURED_MESSAGE: 'Not configured' }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_: unknown, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/villa/design-learning-store', () => ({ listDesignLessonSummaries: async () => [] }));
import { POST } from './route';
beforeEach(() => { vi.stubEnv('NODE_ENV', 'test'); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
const LUXURY = 'A luxury waterfront estate with a dramatic entrance, two bedroom wings and a pool.';
const run = async (prompt: string, plan: ArchitecturalPlan) => {
  generate.mockResolvedValue({ finishReason: 'stop', output: { status: 'proposed', plan, limitations: ['Developer fixture response'] } });
  const response = await POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify({ mode: 'generate', prompt }) }));
  const body = await response.json();
  expect(response.status, body.error).toBe(200);
  expect(generate).toHaveBeenCalledTimes(1);
  return body;
};
const codes = (body: { conceptReview: { findings: { code: string }[] } }) => body.conceptReview.findings.map(f => f.code);
const roomByRoom = (p: ArchitecturalPlan) => { delete p.composition; for (const s of p.spaces.filter(q => !q.outdoor)) p.roofs.push({ space: s.id, form: 'flat', rise: .2 }); return p; };
/** One volume, one roof, one entrance: a deliberately restrained house whose composition is nevertheless stated. */
const restrained = () => {
  const p = canonicalFixture();
  p.thesis = 'A quiet two-level house in one volume under one flat roof, entered through a sheltered porch.';
  p.roofs = [{ space: 'arrival', form: 'flat' }, { space: 'rear-deck', form: 'flat' }];
  p.composition = { volumes: [{ id: 'house', masses: ['base-mass', 'upper-mass'], tier: 'primary', roof: 'house-roof' }], roofSpans: [{ id: 'house-roof', spaces: ['gallery', 'sleep-room'], form: 'flat' }], facades: [], entrance: { portal: 'front-door', porch: 'arrival' } };
  return p;
};

describe('Generate reports concept review beside the construction audit (mocked provider)', () => {
  it('complete structured composition: stated, built, measured; only the unglazed-living daylight observation is raised', async () => {
    const plan = strategyFixture('waterfront-pavilion');
    const body = await run(LUXURY, plan);
    expect(body.conceptReview.commission.ambitious).toBe(true);
    expect(body.conceptReview.composition).toEqual({ declared: true, gaps: [] });
    expect(body.conceptReview.fidelity.declared).toBe(true);
    expect(body.conceptReview.fidelity.volumes.map((v: { id: string }) => v.id)).toEqual(['living-pavilion', 'west-range', 'east-range']);
    expect(body.conceptReview.fidelity.claims.every((c: { supported: boolean }) => c.supported)).toBe(true);
    // The developer fixture's living pavilion has doors but no window; that is reported as an unestablished daylight source, never as an error.
    expect(codes(body)).toEqual(['daylight-unestablished']);
    expect(body.conceptReview.programme.brief.missing).toEqual([]);
    expect(body.conceptReview.limits).toMatch(/Not assessed: proportion and silhouette/);
    expect(JSON.stringify(body.conceptReview)).not.toMatch(/"score"/);
  });
  it('missing composition on an ambitious commission is an explicit finding, not a pass; the house still builds', async () => {
    const plan = roomByRoom(strategyFixture('waterfront-pavilion'));
    const body = await run(LUXURY, plan);
    expect(codes(body)).toContain('composition-missing');
    expect(body.conceptReview.composition.declared).toBe(false);
    expect(body.scene.elements.length).toBeGreaterThan(0);                                 // non-destructive: geometry is delivered
    expect(body.architecturalAudit.status).toBe('incomplete');
    expect(body.architecturalAudit.findings.some((f: { code: string }) => f.code === 'composition-missing')).toBe(true);
    expect(body.architecturalAudit.issues.join(' ')).toMatch(/Composition missing for an ambitious commission/);
    expect(body.summary).toMatch(/Concept review: \d+ finding/);
    expect(body.conceptReview.fidelity.claims.find((c: { claim: string }) => c.claim === 'entrance')).toMatchObject({ supported: false });
  });
  it('composition that is only volume labels is flagged as nominal for an ambitious commission', async () => {
    const plan = roomByRoom(strategyFixture('waterfront-pavilion'));
    plan.composition = { volumes: [{ id: 'all', masses: plan.masses.map(m => m.id), tier: 'primary' }], roofSpans: [], facades: [] };
    const body = await run(LUXURY, plan);
    expect(codes(body)).toContain('composition-inadequate');
    expect(body.conceptReview.composition.gaps.join(' ')).toMatch(/no composition\.entrance/);
  });
  it('a declaration contradicted by the constructed geometry is reported with its measurement; nothing is rejected or altered', async () => {
    const plan = strategyFixture('courtyard-residence');
    plan.thesis = 'A central living pavilion with a dramatic entrance and a courtyard.';
    const body = await run('A luxury courtyard estate for a private family.', plan);
    const central = body.conceptReview.fidelity.claims.find((c: { claim: string }) => c.claim === 'central');
    expect(central).toMatchObject({ supported: false });
    expect(central.measured).toMatch(/0\.39/);
    expect(body.conceptReview.findings.find((f: { code: string }) => f.code === 'concept-fidelity').message).toMatch(/central/);
    expect(codes(body)).not.toContain('composition-missing');
    expect(body.scene.architecturalPlan).toEqual(plan);
  });
  it('a coherent restrained home is not penalised for being restrained, even under a luxury brief', async () => {
    for (const prompt of ['A restrained, minimal family house.', 'A restrained luxury house with a quiet garden.']) {
      generate.mockReset();
      const body = await run(prompt, restrained());
      expect(body.conceptReview.composition).toEqual({ declared: true, gaps: [] });
      expect(codes(body)).toEqual([]);
      expect(body.conceptReview.fidelity.volumes).toHaveLength(1);
    }
  });
  it('legacy plans without composition: unchanged for ordinary briefs, flagged only when the commission is ambitious', async () => {
    const ordinary = await run('A small family house.', canonicalFixture());
    expect(ordinary.conceptReview.commission.ambitious).toBe(false);
    expect(codes(ordinary)).toEqual([]);
    expect(ordinary.architecturalAudit.findings.some((f: { code: string }) => f.code.startsWith('composition'))).toBe(false);
    expect(ordinary.summary).toBe('Compiled envelope candidate — rendered review required.');
    generate.mockReset();
    const ambitious = await run('A luxury mansion.', canonicalFixture());
    expect(codes(ambitious)).toEqual(['composition-missing']);
  });
  it('negated or incidental wording does not make a commission ambitious', async () => {
    for (const prompt of ['A small house, not a mansion.', 'A modest family house with no luxury finishes.']) {
      generate.mockReset();
      expect((await run(prompt, canonicalFixture())).conceptReview.commission.ambitious, prompt).toBe(false);
    }
    generate.mockReset();
    expect((await run('A house with a budget of US$12 million.', canonicalFixture())).conceptReview.commission.reasons.join(' ')).toMatch(/12 million/);
  });
});

describe('editing and persistence of a reviewed house', () => {
  it('survives a JSON round trip, recompiles identically and reproduces the same concept review from the saved plan', async () => {
    const body = await run(LUXURY, strategyFixture('waterfront-pavilion'));
    const saved = JSON.parse(JSON.stringify(body.scene));
    const loaded = validateScene(saved);
    expect(loaded).toEqual(body.scene);
    const plan = loaded.architecturalPlan as ArchitecturalPlan;
    expect(compileArchitecturalPlan(plan).scene.elements).toEqual(loaded.elements);
    expect(JSON.parse(JSON.stringify(conceptReview(loaded.generationBrief!, plan, compileArchitecturalPlan(plan))))).toEqual(body.conceptReview);
  });
  it('stays element-editable; scene-operation edits through the route remain refused with zero provider calls', async () => {
    const body = await run(LUXURY, strategyFixture('waterfront-pavilion'));
    const roof = body.scene.elements.find((e: { id: string }) => e.id === 'pavilion-roof');
    const edited = applySceneOperations(validateScene(body.scene), [{ op: 'resize', id: 'pavilion-roof', size: [roof.size[0] + 1, roof.size[1], roof.size[2]] }]);
    expect(validateScene(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
    expect(edited.architecturalPlan).toEqual(body.scene.architecturalPlan);               // the declared composition persists through the edit
    generate.mockReset();
    const refused = await POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify({ mode: 'edit', editIntent: 'refine', prompt: 'Make it taller', current: body.scene }) }));
    expect(refused.status).toBe(409);
    expect(generate).not.toHaveBeenCalled();
  });
  it('the review is read-only: compiling and reviewing never changes the plan or the scene', async () => {
    const plan = strategyFixture('courtyard-residence'), before = JSON.stringify(plan);
    const built = compileArchitecturalPlan(plan), scene = JSON.stringify(built.scene);
    conceptReview('A luxury estate', plan, built);
    expect(JSON.stringify(plan)).toBe(before);
    expect(JSON.stringify(built.scene)).toBe(scene);
  });
});
