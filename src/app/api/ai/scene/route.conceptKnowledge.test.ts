// What the REAL provider-facing canonical request carries, with the stored approved library and a mocked provider.
// Retrieval and prompt text only; no model is asked to design anything here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibrarySnapshot } from '@/lib/library/store';
const generate = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ mkdir: vi.fn(), writeFile: vi.fn() }));
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: generate }));
vi.mock('@/lib/ai/model', () => ({ isAiConfigured: () => true, getAiModel: () => 'offline-model', getAiModelId: () => 'offline-model', AI_PROVIDER_OPTIONS: {}, AI_NOT_CONFIGURED_MESSAGE: 'Not configured' }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_: unknown, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/villa/design-learning-store', () => ({ listDesignLessonSummaries: async () => [] }));
vi.mock('@/lib/library/store', async original => {
  const actual = await original<typeof import('@/lib/library/store')>();
  const fs = await import('node:fs');
  const snapshot = JSON.parse(fs.readFileSync('docs/architecture/unified-knowledge/library-snapshot.json', 'utf8'));
  return { ...actual, readLibrary: async () => ({ ...actual.emptySnapshot(), ...snapshot } as LibrarySnapshot) };
});
import { POST } from './route';
import { strategyFixture } from '@/lib/villa/canonical/strategies.fixture';
import { canonicalFixture } from '@/lib/villa/canonical/fixture';
import { CANONICAL_INSTRUCTIONS } from '@/lib/villa/canonical/plan';
import { WHOLE_HOUSE_STRATEGIES } from '@/lib/library/architecture/strategies';
beforeEach(() => { vi.stubEnv('NODE_ENV', 'test'); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
const request = async (prompt: string, plan = strategyFixture('waterfront-pavilion')) => {
  generate.mockResolvedValue({ finishReason: 'stop', output: { status: 'proposed', plan, limitations: [] } });
  const response = await POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify({ mode: 'generate', prompt }) }));
  return { response, body: await response.json(), system: generate.mock.calls[0][0].system as string };
};
const strategyIds = (system: string) => WHOLE_HOUSE_STRATEGIES.map(s => s.id).filter(id => system.includes(`"id":"${id}"`));
const WATERFRONT = 'Design a contemporary Caribbean waterfront estate with six bedroom suites, a memorable entrance, shaded terraces facing the ocean and a rectangular pool. US$25 million.';

describe('provider-facing request for an ambitious commission', () => {
  it('carries the architectural mission, the relevant whole-house strategy and the supported composition vocabulary together', async () => {
    const { response, body, system } = await request(WATERFRONT);
    expect(response.status, body.error).toBe(200);
    expect(system).toContain('ROLE AND ARCHITECTURAL MISSION');
    expect(system).toContain('principal residential architect');
    expect(strategyIds(system)).toEqual(['strategy-waterfront-central-pavilion']);
    const chunk = JSON.parse(system.split('\n').find(l => l.includes('"id":"strategy-waterfront-central-pavilion"'))!);
    expect(chunk.expression).toMatch(/composition\.volumes/);
    expect(chunk.limits).toMatch(/Not expressible/);
    for (const term of ['COMPOSITION FIRST', 'volumes', 'tier', 'roofSpans', 'facades', 'entrance', 'heightStep']) expect(system, term).toContain(term);
    expect(system).toMatch(/Composition is expected for luxury, estate, mansion/);
    expect(system).toMatch(/reported in the architectural review as missing composition/);
  });
  it('keeps strategies optional design knowledge: framed as options, schema field optional, no style or complexity forced', async () => {
    const { system } = await request(WATERFRONT);
    expect(system).toMatch(/Contextual design options|options/i);
    expect(system).toMatch(/DESIGN FREEDOM: Symmetry, pitched roofs, multiple storeys, courtyards or any number of wings are not required/);
    expect(system).toMatch(/does not require several storeys, wings, pitched roofs or any style/);
    expect(CANONICAL_INSTRUCTIONS).toMatch(/It stays optional for simple briefs/);
    for (const s of WHOLE_HOUSE_STRATEGIES) { expect(s.when, s.id).toMatch(/Decline/); expect(s.status).toBe('approved'); }
    // A house that ignores the offered strategy is still accepted: the plan below is not the waterfront parti.
    // (Different composition, no review finding because composition is stated.)
  });
  it('a plan that declines the offered strategy is accepted when its own composition is stated', async () => {
    const { response, body } = await request(WATERFRONT, strategyFixture('compact-two-volume'));
    expect(response.status, body.error).toBe(200);
    expect(body.conceptReview.findings.filter((f: { code: string }) => f.code.startsWith('composition'))).toEqual([]);
  });
  it('a restrained legacy-style request still receives the contract and no strategy it did not ask for', async () => {
    const { response, system, body } = await request('Design a house.', canonicalFixture());
    expect(response.status, body.error).toBe(200);
    expect(strategyIds(system)).toEqual([]);
    expect(system).toContain('COMPOSITION FIRST');
  });
});

describe('retrieval respects the brief’s requirements and explicit exclusions', () => {
  const COURTYARD = 'Design a private courtyard house on a narrow urban lot in Lisbon with three bedrooms, an inner court and strong privacy from the street.';
  it('offers the courtyard strategy when a courtyard is asked for', async () => {
    expect(strategyIds((await request(COURTYARD)).system)).toEqual(['strategy-courtyard-residence']);
  });
  it.each([
    'Design a house on a narrow urban lot in Lisbon with three bedrooms and strong privacy. No courtyard.',
    'Design a house on a narrow urban lot in Lisbon with three bedrooms and strong privacy, not a courtyard house.',
    'Design a house on a narrow urban lot in Lisbon with three bedrooms and strong privacy; avoid a courtyard.',
    'Design a house on a narrow urban lot in Lisbon with three bedrooms and strong privacy, without an inner courtyard.',
  ])('does not offer the courtyard strategy to: %s', async prompt => {
    generate.mockReset();
    expect(strategyIds((await request(prompt)).system)).not.toContain('strategy-courtyard-residence');
  });
  it('does not offer the stepped-levels strategy to a brief that requires one storey, or a pool recipe to a brief with no pool', async () => {
    const { system } = await request('Design a hillside home with four bedrooms and sea views. It must be single storey, not multilevel, with no pool.');
    expect(strategyIds(system)).not.toContain('strategy-hillside-stepped-levels');
    expect(system).not.toMatch(/"id":"pool-/);
  });
  it('does not offer the estate strategy to a compact brief', async () => {
    expect(strategyIds((await request('Design a compact waterfront cottage with two bedrooms.')).system)).not.toContain('strategy-waterfront-central-pavilion');
  });
  it('requirements named in the brief reach the request (bedrooms, pool) alongside the strategy', async () => {
    const { body } = await request(WATERFRONT);
    expect(body.error).toBeUndefined();
    const sent = JSON.stringify(generate.mock.calls[0][0].messages);
    expect(sent).toMatch(/six bedroom suites/i);
    expect(sent).toMatch(/rectangular pool/i);
  });
});
