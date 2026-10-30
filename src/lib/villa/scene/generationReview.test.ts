import { describe, expect, it, vi } from 'vitest';
import { exteriorStudy } from './exteriorFirst.fixture';
import { REVIEW_CATEGORIES, REVIEW_VIEWS, runGenerationReview, validateGenerationReview, stageGenerationRefinement, generationReviewRequestSchema, matchingReviewCamera, type GenerationReviewRecord } from './generationReview';
import type { SceneCapture } from '../visual-review';
const scene = exteriorStudy(false).scene;
function review() { return { assessments: REVIEW_CATEGORIES.map(category => ({ category, observation: 'Visible in the actual views.' })), findings: [{ severity: 'minor' as const, category: 'material coordination' as const, targetIds: ['gable-roof'], observation: 'Roof finish is uncoordinated.', suggestedChange: 'Use timber on gable-roof.' }], refinement: { findingIndex: 0, targetIds: ['gable-roof'], instruction: 'Finish gable-roof with timber.' } }; }
const output = (material = 'timber') => ({ name: scene.name, summary: 'Targeted roof finish', unsupported: [], operations: [{ op: 'finish', id: 'gable-roof', material }] });
function shots(): SceneCapture[] {
 const header = Buffer.alloc(36); Buffer.from('\x89PNG\r\n\x1a\n', 'binary').copy(header); header.write('IHDR', 12); header.writeUInt32BE(640, 16); header.writeUInt32BE(360, 20);
 return REVIEW_VIEWS.map(view => ({ view, image: `data:image/png;base64,${header.toString('base64')}`, width: 640, height: 360, camera: { position: [20, 10, 20], target: [0, 0, 0] } }));
}
function harness(verdict = 'prefer revised') {
 const records: GenerationReviewRecord[] = []; let edits = 0;
 const request = vi.fn<(input: { phase: string }) => Promise<unknown>>(async input => input.phase === 'review' ? review() : input.phase === 'refine' ? output(++edits === 1 ? 'timber' : 'bronze') : { verdict, reason: 'Visible roof finish comparison.', regressions: [] });
 const deps = { capture: vi.fn(async () => shots()), request, assertCurrent: vi.fn(), commit: vi.fn(), record: (r: GenerationReviewRecord) => records.push(r) };
 return { deps, records };
}
describe('bounded Generate visual refinement', () => {
 it('honors a single paid pass even when the candidate is preferred', async () => {
  const { deps, records } = harness();
  await runGenerationReview(scene, deps, { maxPasses: 1 });
  expect(deps.request).toHaveBeenCalledTimes(3);
  expect(deps.commit).toHaveBeenCalledTimes(1);
  expect(deps.request.mock.calls[2][0]).toMatchObject({phase:'compare',review:review()});
  expect(records).toHaveLength(1);
 });
 it('uses two passes at most and keeps versions only after comparison', async () => {
  const { deps, records } = harness(); const original = JSON.stringify(scene);
  const result = await runGenerationReview(scene, deps);
  expect(deps.request).toHaveBeenCalledTimes(6); expect(deps.capture).toHaveBeenCalledTimes(4); expect(deps.commit).toHaveBeenCalledTimes(2);
  expect(records.every(r => r.accepted)).toBe(true); expect(result.elements.find(e => e.id === 'gable-roof')?.material).toBe('bronze'); expect(JSON.stringify(scene)).toBe(original);
  expect(records[0].diff?.changedElementIds).toEqual(['gable-roof']);
 });
 it.each(['prefer previous', 'uncertain'])('discards %s and stops without another pass', async verdict => {
  const { deps, records } = harness(verdict); expect(await runGenerationReview(scene, deps)).toEqual(scene);
  expect(deps.commit).not.toHaveBeenCalled(); expect(deps.request).toHaveBeenCalledTimes(3); expect(records[0].accepted).toBe(false);
 });
 it('rejects a preferred candidate when comparison discloses regressions', async () => {
  const { deps } = harness(); const request = deps.request;
  deps.request = vi.fn(async i => i.phase === 'compare' ? { verdict: 'prefer revised', reason: 'Mixed result', regressions: ['Arrival worsened'] } : request(i));
  await runGenerationReview(scene, deps); expect(deps.commit).not.toHaveBeenCalled();
 });
 it('stops after no supported refinement without an edit or comparison', async () => {
  const { deps } = harness(); deps.request = vi.fn(async () => ({ ...review(), refinement: null }));
  await runGenerationReview(scene, deps); expect(deps.request).toHaveBeenCalledTimes(1); expect(deps.commit).not.toHaveBeenCalled();
 });
 it('rejects stale revisions before spending on an edit', async () => {
  const { deps, records } = harness(); let stale = false;
  deps.assertCurrent = vi.fn(() => { if (stale) throw Error('Revision changed'); });
  deps.request = vi.fn(async () => { stale = true; return review(); });
  await runGenerationReview(scene, deps); expect(deps.request).toHaveBeenCalledTimes(1); expect(deps.commit).not.toHaveBeenCalled(); expect(records[0].error).toContain('Revision');
 });
 it.each(['render', 'provider', 'malformed', 'scope', 'structure', 'camera'])('preserves original on %s failure without retries', async failure => {
  const { deps, records } = harness(); const request = deps.request;
  if (failure === 'render') deps.capture = vi.fn(async () => { throw Error('WebGL lost'); });
  if (failure === 'provider') deps.request = vi.fn(async () => { throw Error('Provider unavailable'); });
  if (failure === 'malformed') deps.request = vi.fn(async () => ({}));
  if (failure === 'scope') deps.request = vi.fn(async i => i.phase === 'refine' ? { ...output(), operations: [{ op: 'finish', id: 'main-floor', material: 'bronze' }] } : request(i));
  if (failure === 'structure') deps.request = vi.fn(async i => i.phase === 'refine' ? { ...output(), operations: [{ op: 'resize', id: 'gable-roof', size: [-1, 1.2, 8] }] } : request(i));
  if (failure === 'camera') { let n = 0; deps.capture = vi.fn(async () => { const s = shots(); if (++n === 2) s[0].camera.position[0]++; return s; }); }
  expect(await runGenerationReview(scene, deps)).toEqual(scene); expect(deps.commit).not.toHaveBeenCalled(); expect(records).toHaveLength(1); expect(records[0].error).toBeTruthy();
 });
 it('rejects unknown IDs, repeated categories and ungrounded scopes', () => {
  const r = review(); r.refinement.targetIds = ['main-floor']; expect(() => validateGenerationReview(r, scene)).toThrow(/targets/);
  const unknown = review(); unknown.findings[0].targetIds = ['missing']; expect(() => validateGenerationReview(unknown, scene)).toThrow(/unknown/);
  const duplicate = review(); duplicate.assessments[1] = duplicate.assessments[0]; expect(() => validateGenerationReview(duplicate, scene)).toThrow(/once/);
 });
 it('rejects uncoordinated removals, undeclared additions and metadata rewrites', () => {
  for (const operations of [[{ op: 'remove', id: 'gable-roof' }], [{ op: 'add', element: { ...scene.elements[0], id: 'new-floor' } }]]) expect(() => stageGenerationRefinement(scene, review(), { ...output(), operations })).toThrow();
  expect(() => stageGenerationRefinement(scene, review(), { ...output(), architecturalPlan: { invented: true } })).toThrow();
 });
 it('rejects pass three and incomplete image sets at the API boundary', () => {
  const input = { phase: 'review', pass: 3, brief: 'Home', current: scene, images: shots().map(s => s.image) };
  expect(generationReviewRequestSchema.safeParse(input).success).toBe(false);
  expect(generationReviewRequestSchema.safeParse({ ...input, pass: 1, images: input.images.slice(1) }).success).toBe(false);
 });
});

it('tolerates only OrbitControls numerical camera noise', () => {
 const a=shots()[0].camera, b=structuredClone(a); b.position[0]+=1e-12;
 expect(matchingReviewCamera(a,b)).toBe(true); b.position[0]+=.001; expect(matchingReviewCamera(a,b)).toBe(false);
});

it('constructs a scoped structural mock through the normal transaction and preserves unrelated elements', async () => {
 const { structuralRefinementMock } = await import('./structuralRefinement.fixture');
 const {scene: before,review:r,output:ops} = structuralRefinementMock();
 const original = JSON.stringify(before);
 const staged = stageGenerationRefinement(before,r,ops);
 expect(staged.scene.elements.some(e=>e.id==='entry-canopy')).toBe(false);
 expect(staged.scene.elements.find(e=>e.id==='gable-roof')?.roofForm).toBe('hip');
 expect(staged.scene.elements.filter(e=>r.refinement.newIds.includes(e.id))).toHaveLength(5);
 for(const e of before.elements.filter(e=>!r.refinement.targetIds.includes(e.id))) expect(staged.scene.elements.find(n=>n.id===e.id)).toEqual(e);
 expect(JSON.stringify(before)).toBe(original);
 const {useProjectStore} = await import('@/store/useProjectStore');
 const previous=useProjectStore.getState(), saved=new Map<string,string>();
 vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v)}});
 try {
  useProjectStore.setState({projects:[]}); const store=useProjectStore.getState(), project=store.createProject('Offline structural mock','house','direct-scene');
  store.appendVersion(project.id,'Original',JSON.stringify(before)); store.appendVersion(project.id,'Structural refinement',JSON.stringify(staged.scene));
  store.undo(project.id); expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(before);
  store.redo(project.id); expect(JSON.parse(store.getProject(project.id)!.houseConfigJson)).toEqual(staged.scene);
 } finally {useProjectStore.setState(previous);vi.unstubAllGlobals();}
});

it('rejects destructive budgets, undeclared creation, identity reuse and remote construction atomically', async () => {
 const {structuralRefinementMock} = await import('./structuralRefinement.fixture');
 const {scene:s,review:r,output:o}=structuralRefinementMock(); const bytes=JSON.stringify(s);
 const cases = [
  {...o,operations:Array(81).fill({op:'finish',id:'gable-roof',material:'timber'})},
  {...o,operations:[{op:'remove',id:'arrival'}]},
  {...o,operations:[{op:'add',element:{...s.elements[0],id:'undeclared'}}]},
  {...o,operations:[{op:'remove',id:'gable-roof'},{op:'add',element:s.elements.find(e=>e.id==='gable-roof')}]},
  {...o,operations:[{op:'move',id:'gable-roof',at:[100,4,0]}]},
  {...o,operations:[{op:'resize',id:'gable-roof',size:[1000,1,1000]}]},
  {...o,operations:Array(9).fill({op:'remove',id:'entry-canopy'})},
 ];
 for(const out of cases) {expect(()=>stageGenerationRefinement(s,r,out)).toThrow();expect(JSON.stringify(s)).toBe(bytes);}
 expect(()=>validateGenerationReview({...r,refinement:{...r.refinement,newIds:['gable-roof']}},s)).toThrow(/unused/);
 expect(()=>validateGenerationReview({...r,findings:[{...r.findings[0],targetIds:s.elements.map(e=>e.id)}],refinement:{...r.refinement,targetIds:s.elements.map(e=>e.id)}},s)).toThrow();
});

it('accepts thirteen explicitly scoped existing elements rather than the old twelve-ID ceiling', () => {
 const s=exteriorStudy(true).scene, targetIds=s.elements.slice(0,13).map(e=>e.id);
 const r={...review(),findings:[{...review().findings[0],targetIds}],refinement:{...review().refinement,targetIds}};
 expect(validateGenerationReview(r,s).refinement?.targetIds).toHaveLength(13);
 const result=stageGenerationRefinement(s,r,{...output(),operations:targetIds.map(id=>({op:'finish',id,material:s.elements.find(e=>e.id===id)?.material==='bronze'?'timber':'bronze'}))});
 expect(result.diff.changedElementIds.length).toBe(13);
});
