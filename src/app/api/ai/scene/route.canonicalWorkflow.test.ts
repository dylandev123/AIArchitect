// Offline end-to-end checks of the normal /api/ai/scene handler with a mocked provider.
// Developer-authored plans prove contracts and construction only; they are not AI quality evidence.
import { emptySnapshot } from '@/lib/library/store';
vi.mock('@/lib/library/store', async original => ({ ...await original<typeof import('@/lib/library/store')>(), readLibrary: async () => emptySnapshot() }));
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { canonicalFixture } from '@/lib/villa/canonical/fixture';
import { compositionFixture } from '@/lib/villa/canonical/compositions.fixture';
import { validateScene } from '@/lib/villa/scene/model';
import { GENERATE_COORDINATION_GUIDANCE, ARCHITECTURAL_DESIGN_GUIDE } from '@/lib/villa/scene/designGuide';
import { CANONICAL_CONTEXT_PRECEDENCE } from '@/lib/villa/canonical/plan';
const generate = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: generate }));
vi.mock('@/lib/ai/model', () => ({ isAiConfigured: () => true, getAiModel: () => 'offline-model', getAiModelId: () => 'offline-model', AI_PROVIDER_OPTIONS: {}, AI_NOT_CONFIGURED_MESSAGE: 'Not configured' }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_: unknown, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/villa/design-learning-store', () => ({ listDesignLessonSummaries: async () => [] }));
import { POST } from './route';
beforeEach(() => { vi.stubEnv('NODE_ENV', 'test'); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
const call = (input: unknown) => POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify(input) }));
const proposed = (plan: unknown) => generate.mockResolvedValue({ finishReason: 'stop', output: { status: 'proposed', plan, limitations: ['Developer fixture response'] } });

it.each([
  ['compact family house', 'A compact family house', () => compositionFixture('compact')],
  ['multilevel luxury residence', 'A multilevel luxury residence', () => compositionFixture('waterfront')],
  ['multi-volume mansion', 'A substantial mansion of connected volumes', () => compositionFixture('courtyard')],
])('%s: Generate takes exactly one canonical provider call and returns editable compiled geometry', async (_name, prompt, fixture) => {
  const plan = fixture();
  proposed(plan);
  const response = await call({ mode: 'generate', prompt });
  const body = await response.json();
  expect(response.status, body.error).toBe(200);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(body).toMatchObject({ canonical: true, providerCalls: 1, reviewStatus: 'pending', repairBudget: 0 });
  expect(body.designProposal).toBeUndefined();
  expect(body.scene.architecturalPlan).toEqual(plan);
  expect(body.scene.generationStatus).toBe('pending-visual-review');
  expect(validateScene(JSON.parse(JSON.stringify(body.scene)))).toEqual(body.scene);
  const ids = body.scene.elements.map((e: { id: string }) => e.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(body.operations).toHaveLength(ids.length);
  for (const space of plan.spaces) expect(ids).toContain(`${space.id}-floor`);
  const request = generate.mock.calls[0][0];
  expect(request.system).toContain('sole new-house authoring path');
  expect(request.system).toContain(CANONICAL_CONTEXT_PRECEDENCE.trim());
  expect(request.system).not.toContain(GENERATE_COORDINATION_GUIDANCE.trim().slice(0, 80));
  expect(request.system).not.toContain(ARCHITECTURAL_DESIGN_GUIDE.trim().slice(0, 80));
});

it('never falls back to the retired operations author when the provider returns operations', async () => {
  generate.mockResolvedValue({ finishReason: 'stop', output: { operations: [], name: 'x', summary: 'x', unsupported: [] } });
  const response = await call({ mode: 'generate', prompt: 'A house' });
  expect(response.status).toBe(422);
  expect(generate).toHaveBeenCalledTimes(1);
  expect((await response.json()).scene).toBeUndefined();
});

it('reports every occupied-volume clash of the retained invalid mansion and returns no geometry', async () => {
  const retained = JSON.parse(readFileSync('docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json', 'utf8'));
  proposed(retained.plan);
  const response = await call({ mode: 'generate', prompt: 'Retained mansion brief' });
  const body = await response.json();
  expect(response.status).toBe(422);
  expect(body.scene).toBeUndefined();
  const clashes = body.decisions.filter((d: string) => d.includes('occupied volumes overlap'));
  expect(clashes).toHaveLength(6);
  expect(clashes.find((d: string) => d.startsWith('foyer/upper-suite-6'))).toMatch(/rises 0\.60m above the upper floor datum/);
  expect(generate).toHaveBeenCalledTimes(1);
});

it('refuses scene-operation edits of a compiler-owned house with zero provider calls', async () => {
  proposed(canonicalFixture());
  const generated = await (await call({ mode: 'generate', prompt: 'A house' })).json();
  generate.mockReset();
  const response = await call({ mode: 'edit', editIntent: 'refine', prompt: 'Make it taller', current: generated.scene });
  expect(response.status).toBe(409);
  expect((await response.json()).providerCalls).toBe(0);
  expect(generate).not.toHaveBeenCalled();
});

it.each([
  ['/api/ai/house', () => import('../house/route'), { mode: 'generate', prompt: 'A house', currentHouseJson: '{}' }],
  ['/api/ai/villa', () => import('../villa/route'), { mode: 'generate', prompt: 'A house' }],
  ['/api/ai/plan', () => import('../plan/route'), { action: 'design', prompt: 'A house', currentHouseJson: '{}' }],
])('retired new-house endpoint %s refuses with zero provider calls', async (url, load, body) => {
  // Open the earlier development/evaluation gates so the retirement guard itself is exercised.
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('AI_V3_PLAN_EVALUATION', '1');
  const { POST: retired } = await load();
  const response = await retired(new Request(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) }) as never);
  expect(response.status).toBe(409);
  expect(generate).not.toHaveBeenCalled();
});
