import { z } from 'zod';
import { sceneSchema, validateScene, type ArchitecturalScene, type SceneOperation } from './model';
import { inspectCapture, type SceneCapture } from '../visual-review';
import { sceneSpatialGeometry } from './spatial';
import { resolveSceneResult, sceneResultSchema } from './terra';
import { compareSceneEvidence } from './visualEvidence';

export const REVIEW_VIEWS = ['Aerial', 'Arrival', 'Garden', 'Poolside'] as const;
export const REVIEW_CATEGORIES = ['massing hierarchy', 'arrival facade', 'facade depth', 'roof composition', 'door and window quality', 'material coordination', 'pool and terrace relationship', 'garden/landscape completeness', 'camera composition', 'unfinished or disconnected elements'] as const;
export const REFINEMENT_LIMITS = { existing: 24, additions: 32, removals: 8, operations: 80, extentMarginMetres: 6 } as const;
export const REFINEMENT_OPERATIONS: SceneOperation['op'][] = ['add','remove','move','resize','rotate','attach','place-on','replace','finish','scale-assembly'];
export const REFINEMENT_FIELDS = ['at','size','rotation','parent','material','color','geometry','opening','roofForm','overhang','panels'];
const target = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
export const generationReviewSchema = z.object({
  selectionReason: z.string().min(1).max(1200).describe('Explain why the chosen intervention addresses the largest supported architectural weakness. If major massing, roof or arrival problems remain, explain why they cannot safely be addressed in this scope before selecting a cosmetic change. State the visible effect to verify in comparison, or why no safe refinement exists.').optional(),
  assessments: z.array(z.object({ category: z.enum(REVIEW_CATEGORIES), observation: z.string().min(1).max(500) }).strict()).length(REVIEW_CATEGORIES.length),
  findings: z.array(z.object({ severity: z.enum(['minor', 'major', 'critical']), category: z.enum(REVIEW_CATEGORIES), targetIds: z.array(target).max(REFINEMENT_LIMITS.existing), observation: z.string().min(1).max(500), suggestedChange: z.string().min(1).max(800).nullable() }).strict()).max(10),
  refinement: z.object({ findingIndex: z.number().int().min(0).max(9), targetIds: z.array(target).min(1).max(REFINEMENT_LIMITS.existing), newIds: z.array(target).max(REFINEMENT_LIMITS.additions).optional(), instruction: z.string().min(1).max(1500) }).strict().nullable(),
}).strict();
/** New provider output records the selection decision; retained reviews remain readable. */
export const generationReviewProviderSchema = generationReviewSchema.required({selectionReason:true});
export const generationComparisonSchema = z.object({ verdict: z.enum(['prefer revised', 'prefer previous', 'uncertain']), reason: z.string().min(1).max(1500), regressions: z.array(z.string().min(1).max(500)).max(10) }).strict();
const image = z.string().max(6000000).refine(value => { try { inspectCapture(value); return true; } catch { return false; } }, 'Bounded PNG required');
const images = z.array(image).length(4);
const common = { brief: z.string().min(1).max(12000), current: sceneSchema, pass: z.number().int().min(1).max(2) };
export const generationReviewRequestSchema = z.discriminatedUnion('phase', [
  z.object({ ...common, phase: z.literal('review'), images }).strict(),
  z.object({ ...common, phase: z.literal('refine'), review: generationReviewSchema }).strict(),
  z.object({ ...common, phase: z.literal('compare'), images, previous: sceneSchema, previousImages: images, review: generationReviewSchema.optional() }).strict(),
]);
export function validateGenerationReview(raw: unknown, scene: ArchitecturalScene) {
  const review = generationReviewSchema.parse(raw);
  if (new Set(review.assessments.map(a => a.category)).size !== REVIEW_CATEGORIES.length) throw Error('Every review category must be assessed once.');
  const ids = new Set(scene.elements.map(e => e.id));
  if (review.findings.some(f => f.targetIds.some(id => !ids.has(id)))) throw Error('Review cites unknown target IDs.');
  if (review.refinement) {
    const r = review.refinement, finding = review.findings[r.findingIndex];
    if (!finding?.suggestedChange || !finding.targetIds.length || new Set(r.targetIds).size !== r.targetIds.length || r.targetIds.some(id => !finding.targetIds.includes(id))) throw Error('Refinement exceeds finding targets.');
    if (r.targetIds.length >= scene.elements.length / 2) throw Error('Refinement must preserve a majority of existing elements outside scope.');
    const newIds = r.newIds ?? [];
    if (new Set(newIds).size !== newIds.length || newIds.some(id => ids.has(id))) throw Error('New IDs must be unique and unused.');
    if (finding.category === 'camera composition') throw Error('Camera findings cannot authorize geometry changes.');
  }
  return review;
}
export function stageGenerationRefinement(scene: ArchitecturalScene, review: ReturnType<typeof generationReviewSchema.parse>, output: unknown) {
  const r = validateGenerationReview(review, scene).refinement;
  if (!r) throw Error('No supported refinement.');
  const parsed = sceneResultSchema.parse(output);
  if (parsed.architecturalPlan !== undefined) throw Error('Refinement must preserve architectural plan metadata.');
  const newIds = r.newIds ?? [];
  const operations = parsed.operations;
  if (operations.length > REFINEMENT_LIMITS.operations) throw Error('Refinement operation budget exceeded.');
  const added = operations.filter(op => op.op === 'add');
  const removed = operations.filter(op => op.op === 'remove');
  if (added.length > REFINEMENT_LIMITS.additions || removed.length > Math.min(REFINEMENT_LIMITS.removals, Math.floor(scene.elements.length * .2))) throw Error('Refinement addition/removal budget exceeded.');
  const oldIds = new Set(scene.elements.map(e => e.id));
  if (new Set(added.map(op => op.element.id)).size !== added.length || operations.some(op => !REFINEMENT_OPERATIONS.includes(op.op) || (op.op === 'add' ? !newIds.includes(op.element.id) || oldIds.has(op.element.id) : !('id' in op) || ![...r.targetIds,...newIds].includes(op.id)))) throw Error('Operation exceeds declared refinement scope.');
  if (removed.some(op => !r.targetIds.includes(op.id)) || added.some(op => removed.some(r => r.id === op.element.id))) throw Error('Stable identities cannot be recycled.');
  const result = resolveSceneResult({ mode: 'edit', editIntent: 'refine', current: scene, prompt: r.instruction }, parsed, undefined, {
    targetIds: [...r.targetIds, ...newIds], creationIds: newIds, fields: REFINEMENT_FIELDS, operations: REFINEMENT_OPERATIONS,
  });
  if (JSON.stringify(scene.elements) === JSON.stringify(result.scene.elements)) throw Error('Review made no change.');
  // Bound the final construction to the selected original architecture, in world space.
  const bounds = (s: ArchitecturalScene, ids: string[]) => {
    const g = sceneSpatialGeometry(s);
    return s.elements.filter(e => ids.includes(e.id)).flatMap(e => {
      const [x,,z,yaw] = g.world(e);
      const extension = e.kind === 'pavilion' ? .65 : e.kind === 'roof' && e.roofForm && e.roofForm !== 'flat' ? e.overhang ?? 0 : 0;
      const w = e.size[0]+2*extension, d = e.kind === 'sofa' ? 1.08 : e.size[2]+2*extension;
      return [-1,1].flatMap(sx => [-1,1].flatMap(sz => [g.bottom(e),g.top(e)].map(y => [x+Math.cos(yaw)*sx*w/2+Math.sin(yaw)*sz*d/2,y,z-Math.sin(yaw)*sx*w/2+Math.cos(yaw)*sz*d/2])));
    });
  };
  const originalBounds = bounds(scene,r.targetIds);
  const min = [0,1,2].map(axis => Math.min(...originalBounds.map(p=>p[axis]))-REFINEMENT_LIMITS.extentMarginMetres);
  const max = [0,1,2].map(axis => Math.max(...originalBounds.map(p=>p[axis]))+REFINEMENT_LIMITS.extentMarginMetres);
  if (bounds(result.scene,[...r.targetIds,...newIds]).some(p=>p.some((v,axis)=>v<min[axis] || v>max[axis]))) throw Error('Refinement exceeds local construction extent.');
  const diff = compareSceneEvidence(scene, result.scene);
  if (diff.introduced.length || diff.introducedAuditWarnings.length) throw Error('Refinement introduced construction findings.');
  return { ...result, diff };
}
export type GenerationReviewRecord = { pass: number; before: ArchitecturalScene; beforeCaptures: SceneCapture[]; review?: ReturnType<typeof generationReviewSchema.parse>; after?: ArchitecturalScene; operations?: SceneOperation[]; afterCaptures?: SceneCapture[]; diff?: ReturnType<typeof compareSceneEvidence>; comparison?: ReturnType<typeof generationComparisonSchema.parse>; accepted: boolean; error?: string };
/** No retries. Each pass gets one proposal, one atomic edit and one comparison. */
export async function runGenerationReview(initial: ArchitecturalScene, deps: {
  capture: (scene: ArchitecturalScene, previous?: SceneCapture[]) => Promise<SceneCapture[]>;
  request: (input: z.infer<typeof generationReviewRequestSchema>) => Promise<unknown>;
  assertCurrent: () => void;
  commit: (next: ArchitecturalScene, record: GenerationReviewRecord) => void;
  record: (record: GenerationReviewRecord) => void;
}, options: { maxPasses?: 1 | 2 } = {}) {
  let current = validateScene(initial);
  const maxPasses = options.maxPasses ?? 2;
  if (maxPasses !== 1 && maxPasses !== 2) throw Error('One or two review passes required.');
  for (let pass = 1; pass <= maxPasses; pass++) {
    const record: GenerationReviewRecord = { pass, before: structuredClone(current), beforeCaptures: [], accepted: false };
    try {
      deps.assertCurrent();
      record.beforeCaptures = await deps.capture(current); deps.assertCurrent();
      assertCaptures(record.beforeCaptures);
      const base = { brief: current.generationBrief || 'Review this generated exterior', current, pass };
      record.review = validateGenerationReview(await deps.request({ ...base, phase: 'review', images: record.beforeCaptures.map(s => s.image) }), current); deps.assertCurrent();
      if (!record.review.refinement) { deps.record(record); break; }
      const output = await deps.request({ ...base, phase: 'refine', review: record.review }); deps.assertCurrent();
      const staged = stageGenerationRefinement(current, record.review, output);
      record.after = staged.scene; record.operations = staged.operations; record.diff = staged.diff;
      record.afterCaptures = await deps.capture(staged.scene, record.beforeCaptures); deps.assertCurrent();
      assertCaptures(record.afterCaptures, record.beforeCaptures);
      record.comparison = generationComparisonSchema.parse(await deps.request({ ...base, phase: 'compare', current: staged.scene, previous: current, review: record.review, images: record.afterCaptures.map(s => s.image), previousImages: record.beforeCaptures.map(s => s.image) })); deps.assertCurrent();
      if (record.comparison.verdict !== 'prefer revised' || record.comparison.regressions.length) { deps.record(record); break; }
      // Repeat deterministic gates immediately before committing the staged transaction.
      stageGenerationRefinement(current, record.review, output);
      record.accepted = true;
      deps.commit(staged.scene, record);
      current = staged.scene;
      deps.record(record);
    } catch (error) { record.accepted = false; record.error = String(error); deps.record(record); break; }
  }
  return current;
}
function assertCaptures(captures: SceneCapture[], previous?: SceneCapture[]) {
  if (captures.length !== 4 || captures.some((s, i) => s.view !== REVIEW_VIEWS[i] || s.width !== 640 || s.height !== 360 || (previous && !matchingReviewCamera(s.camera, previous[i].camera)))) throw Error('Four matching camera views are required.');
  captures.forEach(s => inspectCapture(s.image));
}

/** OrbitControls round-trips through spherical coordinates; allow numerical noise only. */
export function matchingReviewCamera(a: SceneCapture['camera'], b: SceneCapture['camera']) {
  return [...a.position, ...a.target].every((v, i) => Number.isFinite(v) && Math.abs(v - [...b.position, ...b.target][i]) <= 1e-7);
}
