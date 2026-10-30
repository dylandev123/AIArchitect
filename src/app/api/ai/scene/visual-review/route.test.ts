import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), configured: vi.fn(() => true) }));
vi.mock('ai', async importOriginal => ({ ...await importOriginal<typeof import('ai')>(), generateText: mocks.generate }));
vi.mock('@/lib/ai/model', () => ({ isAiConfigured: mocks.configured, getAiModel: () => 'mock-model', getAiModelId: () => 'mock-model', AI_PROVIDER_OPTIONS: {}, AI_NOT_CONFIGURED_MESSAGE: 'Not configured' }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: (_: unknown, action: () => unknown) => action() }));
import { POST } from './route';
import { exteriorStudy } from '@/lib/villa/scene/exteriorFirst.fixture';
import { REVIEW_CATEGORIES } from '@/lib/villa/scene/generationReview';
const scene = exteriorStudy(false).scene;
const review = { selectionReason: 'No massing or arrival issue is supported in this fixture; compare the visible roof finish.', assessments: REVIEW_CATEGORIES.map(category => ({ category, observation: 'Observed in actual render' })), findings: [{ category: 'material coordination', severity: 'minor', targetIds: ['gable-roof'], observation: 'Uncoordinated finish', suggestedChange: 'Use timber on the roof' }], refinement: { findingIndex: 0, targetIds: ['gable-roof'], instruction: 'Make the roof timber' } };
const header = Buffer.alloc(36); Buffer.from('\x89PNG\r\n\x1a\n', 'binary').copy(header); header.write('IHDR', 12); header.writeUInt32BE(640, 16); header.writeUInt32BE(360, 20);
const images = Array(4).fill(`data:image/png;base64,${header.toString('base64')}`);
const base = { brief: 'A house', pass: 1, current: scene };
const post = async (body: unknown) => POST(new Request('http://localhost/api/ai/scene/visual-review', { method: 'POST', body: JSON.stringify(body) }));
beforeEach(() => { mocks.generate.mockReset(); mocks.configured.mockReturnValue(true); });
it('reviews four labelled actual views once using configured Terra', async () => {
 mocks.generate.mockResolvedValue({ output: review, totalUsage: {}, finishReason: 'stop' });
 const response = await post({ ...base, phase: 'review', images }); expect(response.status).toBe(200);
 const result = await response.json(); expect(result.output).toEqual(review); expect(result.providerCalls).toBe(1);
 const request = mocks.generate.mock.calls[0][0]; expect(request.maxRetries).toBe(0); expect(request.system).toContain('camera composition');
 expect(request.messages[0].content.filter((c: { type: string }) => c.type === 'image')).toHaveLength(4);
 expect(request.messages[0].content[0].text).toContain('Garden');
});
it('compares eight images with previous first', async () => {
 mocks.generate.mockResolvedValue({ output: { verdict: 'uncertain', reason: 'Insufficient visible difference', regressions: [] }, totalUsage: {}, finishReason: 'stop' });
 expect((await post({ ...base, phase: 'compare', images, previous: scene, previousImages: images })).status).toBe(200);
 expect(mocks.generate.mock.calls[0][0].messages[0].content.filter((c: { type: string }) => c.type === 'image')).toHaveLength(8);
});
it('compares the actual proposed intervention and keeps its unresolved architectural context', async () => {
 mocks.generate.mockResolvedValue({ output: { verdict: 'uncertain', reason: 'Local finish does not resolve composition', regressions: [] }, totalUsage: {}, finishReason: 'stop' });
 expect((await post({ ...base, phase: 'compare', images, previous: scene, previousImages: images, review })).status).toBe(200);
 const payload=JSON.parse(mocks.generate.mock.calls[0][0].messages[0].content[0].text);
 expect(payload.intendedIntervention.refinement).toEqual(review.refinement);
 expect(payload.intendedIntervention.finding).toEqual(review.findings[0]);
});
it('reuses atomic scoped staging on server and blocks unrelated operations', async () => {
 const output = { name: scene.name, summary: 'Finish', unsupported: [], operations: [{ op: 'finish', id: 'main-floor', material: 'bronze' }] };
 mocks.generate.mockResolvedValue({ output, totalUsage: {}, finishReason: 'stop' });
 expect((await post({ ...base, phase: 'refine', review })).status).toBe(400);
 expect(mocks.generate).toHaveBeenCalledTimes(1);
 expect(mocks.generate.mock.calls[0][0].system).toContain('LOCALLY ENFORCED EDIT SCOPE');
 expect(mocks.generate.mock.calls[0][0].system).not.toContain('TARGET CLARIFICATION REQUIRED');
});
it('accepts a valid targeted refinement without committing a project', async () => {
 const output = { name: scene.name, summary: 'Finish', unsupported: [], operations: [{ op: 'finish', id: 'gable-roof', material: 'timber' }] };
 mocks.generate.mockResolvedValue({ output, totalUsage: {}, finishReason: 'stop' });
 const response = await post({ ...base, phase: 'refine', review }); expect(response.status).toBe(200); expect((await response.json()).output).toEqual(output);
 expect(JSON.stringify(mocks.generate.mock.calls[0][0].messages)).toContain('renderedBottom');
});
it('rejects malformed or incomplete provider output without retries', async () => {
 for (const result of [{ output: review, finishReason: 'length' }, { output: {}, finishReason: 'stop' }, { output: {...review,selectionReason:undefined}, finishReason:'stop' }]) {
  mocks.generate.mockResolvedValue({ ...result, totalUsage: {} }); expect((await post({ ...base, phase: 'review', images })).status).toBe(400);
 }
 expect(mocks.generate).toHaveBeenCalledTimes(3);
});
it('rejects unsupported pass, unknown targets and missing images before provider call', async () => {
 for (const input of [{ ...base, pass: 3, phase: 'review', images }, { ...base, phase: 'review', images: [] }, { ...base, phase: 'refine', review: { ...review, refinement: { ...review.refinement, targetIds: ['missing'] } } }]) expect((await post(input)).status).toBe(400);
 expect(mocks.generate).not.toHaveBeenCalled();
});
it('allows declared structural additions and coordinated removal through the real refinement route', async () => {
 const {structuralRefinementMock}=await import('@/lib/villa/scene/structuralRefinement.fixture');
 const mock=structuralRefinementMock();
 mocks.generate.mockResolvedValue({output:mock.output,totalUsage:{},finishReason:'stop'});
 const response=await post({...base,current:mock.scene,phase:'refine',review:mock.review});
 expect(response.status).toBe(200);
 const wire=mocks.generate.mock.calls[0][0];
 expect(wire.maxRetries).toBe(0);expect(wire.system).toContain('creationIds');
 expect(wire.system).toContain('entry-roof');expect(wire.system).toContain('"remove"');
});
