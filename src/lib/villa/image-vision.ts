import { z } from 'zod';
import { analysisInstructions, constructImageSpec, imageSpecSchema } from './image-first';
import { buildComposition } from './composition';

export const visionSpecSchema = imageSpecSchema.extend({
  provenance: z.literal('terra-vision'),
  evidence: z.array(z.object({ featureId:z.string(), basis:z.enum(['visible','inferred','unsupported']), explanation:z.string().min(1) }).strict()).min(1),
  camera: z.object({ position:z.tuple([z.number(),z.number().positive(),z.number()]), target:z.tuple([z.number(),z.number(),z.number()]), fov:z.number().min(15).max(90), uncertainty:z.string().min(1) }).strict(),
});
export function visionInstructions(reviewedLessons = '') {
  return `${analysisInstructions()}
${reviewedLessons}
The supplied image is the authoritative visual reference. Do not use any fixture, preset or generic house. Return ONLY a JSON object matching this JSON Schema: ${JSON.stringify(z.toJSONSchema(visionSpecSchema))}
source must be /inspiration/villa.jpg. Infer metres only as estimates and disclose scale ambiguity. Coordinate system: Y up, X horizontal, Z depth. Include an estimated perspective camera in world metres matching the reference framing, with a target and fov. Disclose camera uncertainty. All features need exactly one evidence record keyed by featureId: visible for directly observed evidence, inferred for occluded geometry/scale assumptions, visible or inferred independently of construction disposition. A visible feature may have unsupported disposition with a null target. The legacy unsupported evidence basis is allowed only for unsupported disposition. Hidden geometry must be explicitly disclosed. Use supported forms and connections when needed, never force complex massing into a rectangular house. Missing builders must remain unsupported. Do not claim structural engineering, interiors, stairs or unseen entrances are observed. No tools or follow-up calls.`;
}
export function constructVision(raw: unknown) {
  const spec=visionSpecSchema.parse(raw);
  if(spec.source!=='/inspiration/villa.jpg') throw new Error('Reference source changed');
  const ids=new Set(spec.features.map(f=>f.id));
  if(ids.size!==spec.features.length || spec.evidence.length!==ids.size) throw new Error('Evidence must map each feature exactly once');
  for(const e of spec.evidence) {
    if(!ids.delete(e.featureId)) throw new Error('Duplicate or unknown evidence feature');
    const f=spec.features.find(f=>f.id===e.featureId)!;
    if((f.disposition==='hidden' && e.basis!=='inferred') || (e.basis==='unsupported' && f.disposition!=='unsupported')) throw new Error('Evidence disposition mismatch');
  }
  const {evidence,camera,...base}=spec;
  const result=constructImageSpec(base);
  buildComposition(result.config);
  return {...result,spec:{...result.spec,evidence,camera}};
}

/** Exactly one injected provider invocation; retention precedes JSON and geometry validation. */
export async function interpretSavedImage(provider:()=>Promise<{text:string;response:unknown;usage:unknown}>, retain:(raw:unknown)=>Promise<void>) {
  const result=await provider();
  await retain(result);
  return constructVision(JSON.parse(result.text));
}
