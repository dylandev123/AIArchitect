import { z } from 'zod';
import { compositionSchema } from '../composition';
import { inspectCapture } from '../visual-review';
import { CAPABILITIES, placementSchema, proposalSchema, validatePlacement, validateProposal } from './model';
export const evidenceSchema = z.object({ villa: compositionSchema, placement: placementSchema, image: z.string().max(6000000), view: z.enum(['Aerial','Arrival','Poolside']), reviewed: z.literal(true) }).strict();
export const candidateSchema = z.object({
  schemaVersion: z.literal(1), id: proposalSchema.shape.id, version: z.number().int().min(1),
  status: z.enum(['experimental','approved']), availability: z.literal('development-only'),
  proposal: proposalSchema, originalIntent: z.string().min(1).max(4000),
  evidence: z.array(evidenceSchema).max(2), createdAt: z.string().datetime(),
  capabilities: z.unknown(),
}).strict();
export type Candidate = z.infer<typeof candidateSchema>;
export function validateCandidate(input: unknown) {
  const c=validateStoredCandidate(input);
  if(c.evidence.length!==2) throw new Error('Two reviewed villa compositions are required before approval or export.');
  return c;
}
/** Unreviewed private candidates may be stored, never approved or exported as verified. */
export function validateStoredCandidate(input: unknown) {
  const c=candidateSchema.parse(input);
  if(c.id!==c.proposal.id) throw new Error('Candidate identity must match proposal.');
  validateProposal(c.proposal);
  if(c.evidence.length===0 && c.status==='experimental') return c;
  if(c.evidence.length!==2) throw new Error('Two reviewed villa compositions are required.');
  if(new Set(c.evidence.map(e=>JSON.stringify(e.villa))).size!==2) throw new Error('Two different villa compositions are required.');
  for(const e of c.evidence) {inspectCapture(e.image);validatePlacement(c.proposal,e.placement,e.villa);}
  return c;
}
export function candidateDraft(proposal: unknown, originalIntent: string, evidence: unknown) {
  const p=validateProposal(proposal);
  return validateCandidate({schemaVersion:1,id:p.id,version:1,status:'experimental',availability:'development-only',proposal:p,originalIntent,evidence,createdAt:new Date().toISOString(),capabilities:CAPABILITIES});
}
export const pinnedStudySchema = z.object({schemaVersion:z.literal(1), candidate:candidateSchema, villa:compositionSchema, placement:placementSchema}).strict();
export function validatePinnedStudy(input: unknown) {
  const study=pinnedStudySchema.parse(input); validateCandidate(study.candidate);
  if(study.candidate.status!=='approved') throw new Error('Only approved candidates can be reused.');
  validatePlacement(study.candidate.proposal,study.placement,study.villa); return study;
}

export function automaticCandidateDraft(proposal: unknown, originalIntent: string) {
  const p=validateProposal(proposal);
  return validateStoredCandidate({schemaVersion:1,id:p.id,version:1,status:'experimental',availability:'development-only',proposal:p,originalIntent,evidence:[],createdAt:new Date().toISOString(),capabilities:CAPABILITIES});
}
