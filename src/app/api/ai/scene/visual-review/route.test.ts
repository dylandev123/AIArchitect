import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), configured: vi.fn(() => true) }));
vi.mock('ai', async importOriginal => ({ ...await importOriginal<typeof import('ai')>(), generateText: mocks.generate }));
vi.mock('@/lib/ai/model', () => ({ isAiConfigured: mocks.configured, getAiModel: () => 'mock-model', getAiModelId: () => 'mock-model', AI_PROVIDER_OPTIONS: {}, AI_NOT_CONFIGURED_MESSAGE: 'Not configured' }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: (_: unknown, action: () => unknown) => action() }));
import { POST } from './route';
import { exteriorStudy } from '@/lib/villa/scene/exteriorFirst.fixture';
import { REVIEW_CATEGORIES } from '@/lib/villa/scene/generationReview';
const scene = exteriorStudy(false).scene;
const review = { stop: null, selectionReason: 'No massing or arrival issue is supported in this fixture; compare the visible roof finish.', assessments: REVIEW_CATEGORIES.map(category => ({ category, observation: 'Observed in actual render' })), findings: [{ category: 'material coordination', severity: 'minor', targetIds: ['gable-roof'], observation: 'Uncoordinated finish', suggestedChange: 'Use timber on the roof' }], refinement: { bundle: {alternatives:[{strategy:'Coordinate finish',tradeoff:'Local objective only'},{strategy:'Rebuild entrance',tradeoff:'Requires broader dependencies'}],objective:'Coordinate material hierarchy',views:['Arrival'],successEvidence:'Coherent arrival material relationship',objects:[{id:'gable-roof',action:'modify',reason:'Coordinate finish'}],dependencies:[]}, findingIndex: 0, targetIds: ['gable-roof'], instruction: 'Make the roof timber' } };
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
 const evidence=JSON.parse(request.messages[0].content[0].text).current;
 const roof=scene.elements.find(e=>e.id==='gable-roof')!;
 expect(evidence.constructed.find((e:{id:string})=>e.id===roof.id)).toMatchObject(roof);
 expect(evidence.constructed.find((e:{id:string})=>e.id===roof.id)).toHaveProperty('renderedTop');
 expect(evidence.refinementContract).toContain('spatial/knowledge references remain protected');
});
it('compares eight images with previous first', async () => {
 mocks.generate.mockResolvedValue({ output: { significance: {noticeable:false,meaningful:false,objective:'Coordinate material hierarchy',views:[{view:'Arrival',observation:'Insufficient evidence'}]}, verdict: 'uncertain', reason: 'Insufficient visible difference', regressions: [] }, totalUsage: {}, finishReason: 'stop' });
 expect((await post({ ...base, phase: 'compare', images, previous: scene, previousImages: images })).status).toBe(200);
 expect(mocks.generate.mock.calls[0][0].messages[0].content.filter((c: { type: string }) => c.type === 'image')).toHaveLength(8);
});
it('compares the actual proposed intervention and keeps its unresolved architectural context', async () => {
 mocks.generate.mockResolvedValue({ output: { significance: {noticeable:false,meaningful:false,objective:'Coordinate material hierarchy',views:[{view:'Arrival',observation:'Insufficient evidence'}]}, verdict: 'uncertain', reason: 'Local finish does not resolve composition', regressions: [] }, totalUsage: {}, finishReason: 'stop' });
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
 expect(mocks.generate.mock.calls[0][0].system).toContain('Optional evidenceRevisions');
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

it('returns a bounded evidence proposal unchanged and refuses unauthored metadata changes', async () => {
 const output = {name:scene.name,summary:'Finish',unsupported:[],operations:[{op:'finish',id:'gable-roof',material:'timber'}],evidenceRevisions:[]};
 mocks.generate.mockResolvedValue({output,totalUsage:{},finishReason:'stop'});
 const response=await post({...base,phase:'refine',review});
 expect(response.status).toBe(200);
 expect((await response.json()).output).toEqual(output);
 mocks.generate.mockResolvedValue({output:{...output,evidenceRevisions:[{spaceIndex:0,role:'roofIds',previousIds:['gable-roof'],replacementIds:['main-floor'],reason:'Unsupported role swap'}]},totalUsage:{},finishReason:'stop'});
 expect((await post({...base,phase:'refine',review})).status).toBe(400);
});

it('distinguishes a failed provider request from local construction rejection without leaking errors', async () => {
 mocks.generate.mockRejectedValue(new Error('private transport detail'));
 const failed = await (await post({...base,phase:'review',images})).json();
 expect(failed).toMatchObject({providerCalls:1,failureStage:'provider'});
 expect(JSON.stringify(failed)).not.toContain('private transport detail');
 expect(mocks.generate).toHaveBeenCalledTimes(1);
 mocks.generate.mockResolvedValue({output:{name:scene.name,summary:'Finish',unsupported:[],operations:[{op:'finish',id:'main-floor',material:'bronze'}]},totalUsage:{},finishReason:'stop'});
 const rejected=await (await post({...base,phase:'refine',review})).json();
 expect(rejected).toMatchObject({providerCalls:1,failureStage:'construction'});
});

it('replays the saved original-house request offline through the normal review route', async () => {
 const {readFileSync}=await import('node:fs');
 const input=JSON.parse(readFileSync('docs/architecture/full-house-investigation/fresh-intelligence/review.input.json','utf8'));
 const unchanged=JSON.stringify(input.current);
 mocks.generate.mockRejectedValue(new TypeError('Offline transport failure fixture'));
 const body=await (await post(input)).json();
 expect(body).toMatchObject({providerCalls:1,failureStage:'provider'});
 expect(mocks.generate).toHaveBeenCalledTimes(1);
 const request=mocks.generate.mock.calls[0][0];
 expect(request.maxRetries).toBe(0);
 expect(request.maxOutputTokens).toBe(5000);
 const content=request.messages[0].content;
 const evidence=JSON.parse(content[0].text).current;
 expect(evidence.constructed).toHaveLength(47);
 expect(content.filter((item:{type:string})=>item.type==='image').map((item:{image:string})=>item.image)).toEqual(input.images);
 expect(JSON.stringify(input.current)).toBe(unchanged);
});
