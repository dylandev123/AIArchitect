import { z } from 'zod';
import { constructionSchema, knowledgeInputSchema } from './model';
import type { retrieveArchitecturalKnowledge } from './retrieval';

export const researchPolicySchema = z.enum(['off', 'on-request', 'when-needed']);
type Retrieval = ReturnType<typeof retrieveArchitecturalKnowledge>;
/** Bounded preparation only. This module has no provider, HTTP client or scene writer.
 * Coverage is a retrieval heuristic, never a claim that Terra knows a subject. */
export function prepareArchitecturalResearch(brief: string, knowledge: Pick<Retrieval, 'selected' | 'project'>, policy: z.infer<typeof researchPolicySchema> = 'on-request', uncertainty?: string) {
 const requested = /\b(research|references?|reference-based|study examples|look up)\b/i.test(brief);
 const categories = new Set(knowledge.selected.map(e => e.category));
 const gaps = [
  ...(!categories.has('composition') ? ['composition and spatial hierarchy'] : []),
  ...(knowledge.project.location.length && !categories.has('climate-site') ? ['regional climate and site relationships'] : []),
  ...(knowledge.project.style.length && !knowledge.selected.some(e => e.reasons.some(r => r.startsWith('brief matches '))) ? ['style-specific architectural principles'] : []),
  ...(uncertainty?.trim() ? [uncertainty.trim().slice(0, 300)] : []),
 ];
 const relevant = requested || gaps.length > 0;
 const recommended = policy !== 'off' && (requested || policy === 'when-needed' && gaps.length > 0);
 const topics = (requested ? ['Transferable architectural relationships for the brief', ...gaps] : gaps).slice(0, 2);
 return {policy, requested, relevant, recommended, gaps, approvedKnowledgeIds:knowledge.selected.map(e=>e.id),
  queries: recommended ? topics.map(topic => `${topic}: ${brief.slice(0, 700)}`) : [],
  bounds:{maxQueries:2, maxFindings:4, maxSourcesPerFinding:3, maxProviderCalls:0, maxRetries:0},
  execution:'offline-preparation-only' as const, searchedAt:null,
  guidance:'Review full source pages from architectural publications, professional practices or reliable regional institutions. Derive relationships, not copied plans. Retain URLs, publication/research dates and distinguish observation from inference. Search snippets, listings and marketing do not establish facts. No search, crawling, charge or scene mutation is authorized by this plan.',
 };
}
const text = z.string().trim().min(1).max(700);
const sourceSchema = z.object({
 url:z.string().url().max(400).refine(value => {const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password;}, 'Use a public HTTPS citation'),
 title:z.string().trim().min(1).max(120),
 researchedAt:z.string().datetime().max(40), publishedAt:z.string().max(50).optional(),
 basis:z.enum(['full-page-observation', 'professional-guidance', 'regional-data']),
 evidence:z.string().trim().min(1).max(300),
}).strict();
export const researchFindingSchema = z.object({
 id:z.string().regex(/^research-[a-z0-9-]{1,60}$/), title:z.string().trim().min(1).max(120),
 category:knowledgeInputSchema.shape.category.unwrap(),
 tags:z.array(z.string().trim().min(1).max(50)).min(1).max(12),
 scales:knowledgeInputSchema.shape.scales,
 contexts:text, principle:text, spatialRelationships:text, combinations:text,
 supportedMethods:constructionSchema, limitations:text,
 sources:z.array(sourceSchema).min(1).max(3),
}).strict();
export const researchFindingsSchema = z.array(researchFindingSchema).min(1).max(4);
/** Uses the existing import/revision/approval workflow. Caller cannot supply approval,
 * verified provenance, review text or operations. Sources remain unverified by default. */
export function researchKnowledgeProposals(raw: unknown) {
 return researchFindingsSchema.parse(raw).map(f => ({expectedVersion:0, entry:knowledgeInputSchema.parse({
  id:f.id, title:f.title, category:f.category, kind:'principle', recipeType:'relationship',
  tags:f.tags, scales:f.scales, when:f.contexts, principles:f.principle,
  placement:f.spatialRelationships, combinations:f.combinations,
  capabilities:f.limitations,
  construction:f.supportedMethods,
  sources:f.sources.map(s=>({reference:s.url,kind:'web',verified:false,
   note:`${s.title}; researched ${s.researchedAt}; published ${s.publishedAt ?? 'unknown'}; ${s.basis}: ${s.evidence}`.slice(0,700)})),
  status:'proposed', review:'', supersedes:[],
 })}));
}
