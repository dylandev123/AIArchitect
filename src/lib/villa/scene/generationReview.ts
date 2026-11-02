import { isCanonicalPlan } from '../canonical/plan';
import { z } from 'zod';
import { evidenceRevisionSchema, reviseProgrammeEvidence } from './evidenceRevision';
import { sceneSchema, validateScene, type ArchitecturalScene, type SceneOperation } from './model';
import { inspectCapture, type SceneCapture } from '../visual-review';
import { sceneSpatialGeometry } from './spatial';
import { resolveSceneResult, sceneResultSchema } from './terra';
import { architecturalReferenceDependencies, compareSceneEvidence } from './visualEvidence';

export const REVIEW_VIEWS = ['Aerial', 'Arrival', 'Garden', 'Poolside'] as const;
export const REVIEW_CATEGORIES = ['massing hierarchy', 'arrival facade', 'facade depth', 'roof composition', 'door and window quality', 'material coordination', 'pool and terrace relationship', 'garden/landscape completeness', 'camera composition', 'unfinished or disconnected elements'] as const;
export const REFINEMENT_LIMITS = { existing: 24, additions: 32, removals: 8, operations: 80, extentMarginMetres: 6 } as const;
export const REFINEMENT_OPERATIONS: SceneOperation['op'][] = ['add','remove','move','resize','rotate','attach','place-on','replace','finish','scale-assembly'];
export const REFINEMENT_FIELDS = ['at','size','rotation','parent','material','color','geometry','opening','roofForm','overhang','panels'];
const target = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/);
const bundleSchema = z.object({
  objective: z.string().min(1).max(800).describe('Observable architectural relationship to improve, why it matters to the whole composition, and which larger weaknesses remain.'),
  views: z.array(z.enum(REVIEW_VIEWS)).min(1).max(4),
  successEvidence: z.string().min(1).max(800).describe('What matching rendered views must demonstrate beyond a noticeable difference; do not use operation count or confidence.'),
  alternatives: z.array(z.object({ strategy: z.string().min(1).max(600), tradeoff: z.string().min(1).max(600) }).strict()).min(2).max(4).optional().describe('Compare distinct strategies, including dependency cost and compositional benefit, before selecting this bundle.'),
  objects: z.array(z.object({ id: target, action: z.enum(['modify','replace','remove','add','preserve']), reason: z.string().min(1).max(400) }).strict()).min(1).max(80),
  dependencies: z.array(z.object({ source: target, target, relationship: z.string().min(1).max(400), datum: z.enum(['source top meets target bottom','same top','source below target']).optional() }).strict()).max(80),
}).strict();
const stopSchema = z.object({ condition: z.enum(['not representable','broader redesign','preservation conflict','insufficient visual evidence']), limitation: z.string().min(1).max(800), nextAction: z.enum(['capability improvement','broader redesign workflow','new model decision']) }).strict();
export const ARCHITECTURAL_INTERVENTION_GUIDANCE = `Plan one coherent intervention bundle, not one isolated finding target. Relate the selected weakness to overall composition and compare alternative strategies by expected architectural effect and dependencies, not by ease or few operations. Declare all affected objects and preserved geometric/reference dependencies. Each object has an explicit action; every declared action must be constructed. Dependencies may cross finding targets. Coordinate roof/enclosure datums, opening hosts and access, canopy supports and walking surfaces, and programme commitments where affected. An opaque band is not a glazed clerestory; names and historical intent are not construction proof. Define an observable objective and success evidence in named views before constructing. Small changes may be meaningful, but visible difference alone is insufficient. Stop with a specific limitation and next action if unsupported operations, broader redesign, protected architecture or inadequate render evidence prevent the objective; do not substitute a superficial edit.`;
export const generationReviewSchema = z.object({
  selectionReason: z.string().min(1).max(1200).describe('Explain why the chosen intervention addresses the largest supported architectural weakness. If major massing, roof or arrival problems remain, explain why they cannot safely be addressed in this scope before selecting a cosmetic change. State the visible effect to verify in comparison, or why no safe refinement exists.').optional(),
  stop: stopSchema.nullable().optional(),
  assessments: z.array(z.object({ category: z.enum(REVIEW_CATEGORIES), observation: z.string().min(1).max(500) }).strict()).length(REVIEW_CATEGORIES.length),
  findings: z.array(z.object({ severity: z.enum(['minor', 'major', 'critical']), category: z.enum(REVIEW_CATEGORIES), targetIds: z.array(target).max(REFINEMENT_LIMITS.existing), observation: z.string().min(1).max(500), suggestedChange: z.string().min(1).max(800).nullable() }).strict()).max(10),
  refinement: z.object({ bundle: bundleSchema.optional(), findingIndex: z.number().int().min(0).max(9), targetIds: z.array(target).min(1).max(REFINEMENT_LIMITS.existing), newIds: z.array(target).max(REFINEMENT_LIMITS.additions).optional(), instruction: z.string().min(1).max(1500) }).strict().nullable(),
}).strict();
/** New provider output records the selection decision; retained reviews remain readable. */
export const generationReviewProviderSchema = generationReviewSchema.required({selectionReason:true, stop:true}).extend({ refinement: generationReviewSchema.shape.refinement.unwrap().required({bundle:true}).extend({bundle:bundleSchema.required({alternatives:true})}).nullable() });
export const significanceEvidenceSchema = z.object({ noticeable: z.boolean(), meaningful: z.boolean(), objective: z.string().min(1).max(800), views: z.array(z.object({ view: z.enum(REVIEW_VIEWS), observation: z.string().min(1).max(800) }).strict()).min(1).max(4) }).strict();
export const generationComparisonSchema = z.object({ significance: significanceEvidenceSchema.optional(), verdict: z.enum(['prefer revised', 'prefer previous', 'uncertain']), reason: z.string().min(1).max(1500), regressions: z.array(z.string().min(1).max(500)).max(10) }).strict();
export const generationComparisonProviderSchema = generationComparisonSchema.required({significance:true});
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
  if (review.stop && review.refinement) throw Error('Stopping condition forbids a substitute refinement.');
  if (review.refinement) {
    const r = review.refinement, finding = review.findings[r.findingIndex];
    if (!finding?.suggestedChange || !finding.targetIds.length || new Set(r.targetIds).size !== r.targetIds.length || (!r.bundle && r.targetIds.some(id => !finding.targetIds.includes(id)))) throw Error('Refinement exceeds finding targets.');
    if (r.targetIds.length >= scene.elements.length / 2) throw Error('Refinement must preserve a majority of existing elements outside scope.');
    const newIds = r.newIds ?? [];
    if (new Set(newIds).size !== newIds.length || newIds.some(id => ids.has(id))) throw Error('New IDs must be unique and unused.');
    if (r.bundle) {
      const b = r.bundle, objects = new Map(b.objects.map(o => [o.id,o]));
      if (objects.size !== b.objects.length) throw Error('Bundle object IDs must be unique.');
      for (const o of b.objects) {
        if (o.action === 'add' ? !newIds.includes(o.id) : !ids.has(o.id)) throw Error('Bundle object identity/action mismatch.');
        if (o.action !== 'preserve' && o.action !== 'add' && !r.targetIds.includes(o.id)) throw Error('Bundle change outside target scope.');
      }
      if (r.targetIds.some(id => !objects.has(id) || objects.get(id)!.action === 'preserve') || newIds.some(id => objects.get(id)?.action !== 'add')) throw Error('Bundle must declare every changed object.');
      if (!finding.targetIds.some(id => r.targetIds.includes(id))) throw Error('Bundle must address selected finding.');
      if (b.dependencies.some(d => !objects.has(d.source) || !objects.has(d.target) || d.source === d.target)) throw Error('Bundle dependency must name declared objects.');
    }
    if (finding.category === 'camera composition') throw Error('Camera findings cannot authorize geometry changes.');
  }
  return review;
}
export const generationRefinementSchema = sceneResultSchema.extend({ evidenceRevisions: evidenceRevisionSchema.optional() });

export function stageGenerationRefinement(scene: ArchitecturalScene, review: ReturnType<typeof generationReviewSchema.parse>, output: unknown) {
  if (isCanonicalPlan(scene.architecturalPlan)) throw Error('Canonical geometry requires plan revision and recompilation; operation repair is disabled.');
  const r = validateGenerationReview(review, scene).refinement;
  if (!r) throw Error('No supported refinement.');
  const { evidenceRevisions, ...parsed } = generationRefinementSchema.parse(output);
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
  if (evidenceRevisions) result.scene = reviseProgrammeEvidence(scene, result.scene, evidenceRevisions, [...r.targetIds, ...newIds]);
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
  if (r.bundle) {
    const beforeGeometry = sceneSpatialGeometry(scene), afterGeometry = sceneSpatialGeometry(result.scene);
    for (const e of scene.elements) {
      const next = result.scene.elements.find(n => n.id === e.id);
      if (next && JSON.stringify(beforeGeometry.world(e)) !== JSON.stringify(afterGeometry.world(next)) && !diff.changedElementIds.includes(e.id)) diff.changedElementIds.push(e.id);
    }
  }
  if (diff.introduced.length || diff.introducedAuditWarnings.length) throw Error('Refinement introduced construction findings.');
  if (r.bundle) {
    const changed = new Set(diff.changedElementIds);
    for (const o of r.bundle.objects) {
      const ops = operations.filter(op => op.op === 'add' ? op.element.id === o.id : 'id' in op && op.id === o.id);
      const actionMatches = o.action === 'preserve' ? !changed.has(o.id) && !ops.length : changed.has(o.id) && ops.length > 0 && (o.action === 'modify' ? ops.every(op => !['add','remove','replace'].includes(op.op)) : ops.some(op => op.op === o.action));
      if (!actionMatches) throw Error(`Incomplete coordinated bundle: ${o.id} ${o.action}.`);
    }
    for (const d of r.bundle.dependencies) {
      if (!d.datum) continue;
      const source = result.scene.elements.find(e => e.id === d.source), target = result.scene.elements.find(e => e.id === d.target);
      if (!source || !target) throw Error('Datum dependency needs surviving objects.');
      if (source.geometry || target.geometry || [source,target].some(e => e.kind === 'roof' && e.roofForm && e.roofForm !== 'flat')) throw Error('Datum dependency cannot certify profiled/ pitched actual surfaces.');
      const g = sceneSpatialGeometry(result.scene), delta = g.top(source) - (d.datum === 'same top' ? g.top(target) : g.bottom(target));
      if (d.datum === 'source below target' ? delta > .001 : Math.abs(delta) > .001) throw Error('Coordinated datum dependency failed.');
    }
    if (diff.changedElementIds.some(id => !r.bundle!.objects.some(o => o.id === id && o.action !== 'preserve'))) throw Error('Undeclared dependent change.');
  }
  return { ...result, diff, bundleEvidence: r.bundle ? { objects: r.bundle.objects, dependencies: r.bundle.dependencies, preservedReferences: architecturalReferenceDependencies(scene).filter(ref => r.bundle!.objects.some(o => o.id === ref.elementId)), changedElementIds: diff.changedElementIds } : null };
}
export type GenerationReviewRecord = { pass: number; before: ArchitecturalScene; beforeCaptures: SceneCapture[]; review?: ReturnType<typeof generationReviewSchema.parse>; after?: ArchitecturalScene; operations?: SceneOperation[]; afterCaptures?: SceneCapture[]; diff?: ReturnType<typeof compareSceneEvidence>; stoppingCondition?: z.infer<typeof stopSchema>; technicalValidity?: 'passed'; comparison?: ReturnType<typeof generationComparisonSchema.parse>; accepted: boolean; error?: string };
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
      if (isCanonicalPlan(current.architecturalPlan)) {
        const rejected=record.review.findings.length>0||Boolean(record.review.stop);
        record.error = rejected ? 'Canonical candidate rejected by rendered review; plan revision required. Repair budget: zero.' : 'Rendered review recorded; envelope scope only, no complete-home certification.';
        current={...current,generationStatus:rejected?'rejected':'reviewed-envelope'};
        deps.commit(current,record);
        deps.record(record); break;
      }
      if (!record.review.refinement) { record.stoppingCondition = record.review.stop ?? undefined; deps.record(record); break; }
      const output = await deps.request({ ...base, phase: 'refine', review: record.review }); deps.assertCurrent();
      const staged = stageGenerationRefinement(current, record.review, output);
      record.technicalValidity = 'passed';
      record.after = staged.scene; record.operations = staged.operations; record.diff = staged.diff;
      record.afterCaptures = await deps.capture(staged.scene, record.beforeCaptures); deps.assertCurrent();
      assertCaptures(record.afterCaptures, record.beforeCaptures);
      record.comparison = generationComparisonSchema.parse(await deps.request({ ...base, phase: 'compare', current: staged.scene, previous: current, review: record.review, images: record.afterCaptures.map(s => s.image), previousImages: record.beforeCaptures.map(s => s.image) })); deps.assertCurrent();
      if (!demonstratesArchitecturalImprovement(record.review, record.comparison)) { record.stoppingCondition = {condition:'insufficient visual evidence',limitation:'Matching rendered evidence did not demonstrate the declared architectural objective without regressions.',nextAction:'new model decision'}; deps.record(record); break; }
      // Repeat deterministic gates immediately before committing the staged transaction.
      stageGenerationRefinement(current, record.review, output);
      record.accepted = true;
      deps.commit(staged.scene, record);
      current = staged.scene;
      deps.record(record);
    } catch (error) { record.accepted = false; record.error = String(error); if(isCanonicalPlan(current.architecturalPlan)){ try{deps.assertCurrent();current={...current,generationStatus:'rejected'};deps.commit(current,record);}catch{/* Concurrent changes must remain untouched. */} } deps.record(record); break; }
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

/** Technical staging and rendered architectural judgment remain separate gates.
 * Legacy comparisons stay readable but cannot authorize architectural promotion. */
export function demonstratesArchitecturalImprovement(review: ReturnType<typeof generationReviewSchema.parse>, comparison: z.infer<typeof generationComparisonSchema>) {
  const b = review.refinement?.bundle, e = comparison.significance;
  return !!b && !!e && e.objective === b.objective && e.noticeable && e.meaningful && comparison.verdict === 'prefer revised' && comparison.regressions.length === 0 && new Set(e.views.map(v => v.view)).size === e.views.length && b.views.every(view => e.views.some(v => v.view === view));
}
