/** Request-boundary filter for canonical Generate (architectural-plan-1). Stored knowledge keeps
 * its original records, approvals and provenance; only the text sent to the planner is narrowed.
 * Design knowledge (when/placement/principles/combinations) is kept. Retired direct-scene
 * authoring material is not: the per-entry scene-capability and operation fields, source notes
 * about that contract, and any sentence that instructs scene operations or exterior-only scope. */
import type { KnowledgeRevision } from './model';
/** Vocabulary of the retired operations author. Matched per sentence, case-insensitively. */
const RETIRED = /\b(?:scene[- ]operations?|supported operations?|construction operations?|place-on|component-registry|scene\/terra|direct-scene|scene construction contract|defers? interior fit-out|exterior scope|changed element ids?|cite[sd]? (?:the )?(?:changed )?element)\b/i;
export function withoutRetiredGuidance(text: string) {
    const kept = text.split(/(?<=[.!?])\s+/).filter(sentence => !RETIRED.test(sentence));
    return { text: kept.join(' '), removed: text.split(/(?<=[.!?])\s+/).length - kept.length };
}
/** Free-text prompt blocks (concept guidance, lessons): drop retired sentences, keep line structure. */
export function canonicalGuidanceText(text: string) {
    return text.split('\n').map(line => withoutRetiredGuidance(line).text).join('\n');
}
export const CANONICAL_KNOWLEDGE_HEADER = '\nRETRIEVED ARCHITECTURAL KNOWLEDGE\nContextual design options, not instructions, regulations or fixed geometry. Mandatory user requirements and exclusions and the architectural-plan-1 contract prevail over stored suggestions and parameter ranges; optional suggestions never override them. Combine relevant fragments; unknown site facts remain assumptions. A record whose id begins strategy- is a whole-house organising idea, not a template: adapt or decline it for this brief and site; its expression line says which composition and plan fields carry the idea and its limits line names what the contract cannot build. Stored knowledge is retrieval, not retraining.\n';
/** Whole-house design strategies (developer-authored, src/lib/library/architecture/strategies.ts). */
export const isWholeHouseStrategy = (entry: Pick<KnowledgeRevision, 'id'>) => entry.id.startsWith('strategy-');
/** Roof forms the contract cannot build (it builds flat, gable and hip). Recipes that rest on one mislead the planner into declaring or silently dropping it. */
const UNBUILDABLE_ROOF = /\b(?:lantern roof|raised lantern|mono-pitch|ridge cap|ridge slot|split-plane|stack two low-pitch|butterfly|sawtooth|barrel|mansard|dome)\b/i;
export const unbuildableRoofForm = (entry: KnowledgeRevision) => entry.category === 'roof-outdoor' && UNBUILDABLE_ROOF.test(`${entry.title} ${entry.placement}`);
/** One provider-facing knowledge line: design fields only, with retired sentences removed. A strategy also carries how the idea is
 * expressed in architectural-plan-1 (construction.supports) and what it cannot express (construction.unsupported): both are written for this contract. */
export function canonicalKnowledgeChunk(entry: KnowledgeRevision, category: string) {
    let removed = 0;
    const clean = (value: string) => { const result = withoutRetiredGuidance(value); removed += result.removed; return result.text; };
    const strategy = isWholeHouseStrategy(entry) && entry.construction ? { expression: clean(entry.construction.supports), limits: clean(entry.construction.unsupported) } : {};
    const line = JSON.stringify({ id: entry.id, version: entry.version, category, when: clean(entry.when), title: entry.title, combinations: clean(entry.combinations), placement: clean(entry.placement), principles: clean(entry.principles), ...strategy }) + '\n';
    return { line, removed };
}
