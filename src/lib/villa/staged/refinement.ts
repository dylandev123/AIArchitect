/** Offline Stage 6 transaction boundary. No provider, network, credentials or persistence. */
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {compileHouse, runEdit, type EditOp} from './edits';
import type {HouseSpec} from './spec';

const text = z.string().min(1).max(700);
export const stagedReviewSchema = z.object({
  observations: z.array(z.object({
    view: z.enum(['arrival', 'aerial', 'garden', 'poolside']),
    responsibility: z.enum(['architecture', 'renderer', 'uncertain']),
    component: z.string().min(1).max(100), evidence: text,
  }).strict()).max(6),
  summary: text,
  // These are suggestions, never permissions. The application supplies the policy separately.
  ops: z.array(z.union([
    z.object({op: z.literal('set-finish'), block: z.string().min(1).max(40), wall: z.enum(['ivory', 'limestone', 'timber', 'bronze', 'sage']), wallColor: z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict(),
    z.object({op: z.literal('move-site-item'), id: z.string().min(1).max(40), dx: z.number().min(-1).max(1), dz: z.number().min(-1).max(1)}).strict(),
  ])).max(2),
}).strict();
export type StagedReview = z.infer<typeof stagedReviewSchema>;

export const refinementPolicySchema = z.object({
  baseline: z.string().regex(/^[a-f0-9]{64}$/),
  finishBlocks: z.array(z.string()).max(1),
  siteItems: z.array(z.string()).max(2),
  components: z.array(z.string()).min(1).max(12),
  maxChanged: z.number().int().min(1).max(80),
}).strict();
export type RefinementPolicy = z.infer<typeof refinementPolicySchema>;
export const refinementHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function refinementBaseline(spec: HouseSpec) {
  const built = compileHouse(spec, 5);
  return {...built, hash: refinementHash({spec, scene: built.scene, components: built.components})};
}

/** Returns the original objects on every rejection; accepts a candidate, never publishes it. */
export async function stageRefinement(spec: HouseSpec, rawReview: unknown, rawPolicy: unknown) {
  const base = refinementBaseline(spec);
  const reject = (reason: string) => ({accepted: false as const, spec, scene: base.scene, components: base.components, reasons: [reason]});
  const policy = refinementPolicySchema.safeParse(rawPolicy), review = stagedReviewSchema.safeParse(rawReview);
  if (!policy.success || !review.success) return reject('Invalid review or application policy.');
  const p = policy.data, r = review.data;
  if (p.baseline !== base.hash) return reject('Stale baseline.');
  const known = new Set(Object.values(base.components));
  if (p.components.some(c => !known.has(c))) return reject('Unknown policy component.');
  if (r.observations.some(o => !known.has(o.component))) return reject('Unknown observation component.');
  if (!r.ops.length) return reject('Review proposes no supported refinement.');
  for (const op of r.ops) {
    if (op.op === 'set-finish' && !p.finishBlocks.includes(op.block)) return reject('Block exceeds application scope.');
    if (op.op === 'move-site-item' && !p.siteItems.includes(op.id)) return reject('Site item exceeds application scope.');
  }
  if (!r.observations.some(o => o.responsibility === 'architecture' && p.components.includes(o.component))) return reject('No architectural evidence for the permitted scope.');
  const outcome = await runEdit({
    planner: {label: 'Stage 6 supplied proposal; no model execution', plan: async () => ({plan: {summary: r.summary.slice(0, 300), ops: r.ops as EditOp[]}})},
    instruction: r.summary, spec, scene: base.scene, components: base.components, requiredBedrooms: 4,
  });
  if (!outcome.accepted) return {...reject('Construction validation rejected refinement.'), findings: outcome.findings};
  const d = outcome.diff!;
  if (d.added.length || d.removed.length || !d.changed.length || d.changed.length > p.maxChanged) return reject('Element identity or change budget exceeded.');
  for (const id of d.changed) {
    if (!p.components.includes(base.components[id]) || base.components[id] !== outcome.components[id]) return reject(`Changed element ${id} (${base.components[id]}) exceeds semantic scope.`);
    // Finish transactions cannot alter geometry, openings or ownership, even as a compiler side effect.
    const before = base.scene.elements.find(e => e.id === id)!, after = outcome.scene.elements.find(e => e.id === id)!;
    if (r.ops.some(op => op.op === 'set-finish')) {
      const strip = (e: typeof before) => {const {material, color, appearance, roofWallFinish, ...rest} = e; void material; void color; void appearance; void roofWallFinish; return rest;};
      if (JSON.stringify(strip(before)) !== JSON.stringify(strip(after))) return reject('Finish refinement changed geometry.');
    }
  }
  if (outcome.scene.terrain !== undefined || outcome.scene.elements.length > 400 || JSON.stringify(spec.site) !== JSON.stringify(outcome.spec.site)) return reject('Flat site or element cap violated.');
  return {...outcome, reasons: []};
}
