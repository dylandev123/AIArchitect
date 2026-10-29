import { z } from 'zod';
import { placementSchema, proposalSchema } from './geometry';

// A self-contained snapshot preserves private geometry and exact builder/candidate
// identities through property edits, export and library version changes.
export const createdComponentSchema = z.object({
  id: proposalSchema.shape.id,
  candidateId: proposalSchema.shape.id,
  candidateVersion: z.number().int().positive(),
  status: z.enum(['experimental', 'approved']),
  originalIntent: z.string().min(1).max(4000),
  proposal: proposalSchema,
  placement: placementSchema,
}).strict();
export type CreatedComponent = z.infer<typeof createdComponentSchema>;
export const componentRequestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), id: proposalSchema.shape.id,
    missingCapability: z.string().min(1).max(1600), proposal: proposalSchema, placement: placementSchema }).strict(),
  z.object({ type: z.literal('reuse'), id: proposalSchema.shape.id,
    candidateId: proposalSchema.shape.id, candidateVersion: z.number().int().positive(), placement: placementSchema }).strict(),
  z.object({ type: z.literal('gap'), capabilityGap: z.string().min(1).max(200) }).strict(),
]);
export const componentRequestsSchema = z.array(componentRequestSchema).max(2);
