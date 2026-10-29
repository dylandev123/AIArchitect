import { z } from 'zod';
export const knowledgeCategories = ['property-value', 'composition', 'programme', 'tradition', 'arrival', 'envelope', 'roof-outdoor', 'amenity', 'climate-site', 'construction', 'materials'] as const;
export const constructionSchema = z.object({
 operations: z.array(z.enum(['add', 'attach', 'place-on', 'move', 'rotate', 'resize', 'replace', 'finish', 'remove'])).min(1),
 requiredKinds: z.array(z.enum(['plate', 'wall', 'roof', 'glazing', 'balcony', 'entrance', 'screen', 'volume', 'water'])).min(1),
 supports: z.string().min(1).max(700), materials: z.string().min(1).max(700),
 unsupported: z.string().min(1).max(700),
}).strict();
const text = z.string().trim().min(1).max(700);
export const knowledgeInputSchema = z.object({
 id: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/), title: z.string().trim().min(1).max(120),
 kind: z.enum(['principle', 'recipe', 'experience']),
 category: z.enum(knowledgeCategories).optional(),
 recipeType: z.enum(['principle', 'feature', 'relationship', 'pattern', 'material', 'failure']).optional(),
 construction: constructionSchema.optional(),
 tags: z.array(z.string().trim().min(1).max(50)).min(1).max(20),
 scales: z.array(z.enum(['compact', 'family', 'estate', 'mansion'])).max(4),
 when: text, combinations: text, placement: text, principles: text, capabilities: text,
 sources: z.array(z.object({ reference: z.string().min(1).max(500), note: text,
  kind: z.enum(['repository', 'curated', 'web', 'reviewed-design']), verified: z.boolean() }).strict()).min(1).max(8),
 status: z.enum(['proposed', 'approved', 'retired']),
 supersedes: z.array(z.string().max(80)).max(20).default([]),
 review: z.string().trim().max(700).default(''),
}).strict().superRefine((v, c) => {
 if (v.supersedes.includes(v.id)) c.addIssue({code:'custom', message:'Cannot supersede itself'});
 if (v.status === 'approved' && (!v.review || !v.sources.some(s => s.verified))) c.addIssue({code:'custom', message:'Approval requires review and a verified source'});
});
export type KnowledgeInput = z.infer<typeof knowledgeInputSchema>;
export type KnowledgeRevision = KnowledgeInput & { version: number; updatedAt: string };
export interface ArchitecturalKnowledge { id: string; revisions: KnowledgeRevision[] }
