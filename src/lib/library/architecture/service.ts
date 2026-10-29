import { z } from 'zod';
import { mutateLibrary, readLibrary } from '../store';
import { knowledgeInputSchema, type ArchitecturalKnowledge, type KnowledgeRevision } from './model';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS } from './seeds';
import { retrieveArchitecturalKnowledge } from './retrieval';
import { legacyRecipeKnowledge } from './legacyRecipes';
export function knowledgeRecords(stored: ArchitecturalKnowledge[] = []): ArchitecturalKnowledge[] {
 const all = new Map(ARCHITECTURAL_KNOWLEDGE_SEEDS.map(e => [e.id, {id:e.id,revisions:[e]}]));
 stored.forEach(e => all.set(e.id,e));
 return [...all.values()];
}
export const latestKnowledge = (stored?: ArchitecturalKnowledge[]) => knowledgeRecords(stored).map(e => e.revisions[e.revisions.length-1]);
export const importKnowledgeSchema = z.array(z.object({entry:knowledgeInputSchema,expectedVersion:z.number().int().nonnegative()}).strict()).min(1).max(100);
/** Atomic batch with optimistic concurrency, full history and normalized-title duplicate checks. */
export async function importArchitecturalKnowledge(raw: unknown) {
 const batch = importKnowledgeSchema.parse(raw);
 return mutateLibrary(snapshot => {
  const records = knowledgeRecords(snapshot.architecturalKnowledge);
  const map = new Map(records.map(e => [e.id,e]));
  const ids = new Set<string>();
  const changed: ArchitecturalKnowledge[] = [];
  for (const {entry,expectedVersion} of batch) {
   if(ids.has(entry.id)) throw Error('Duplicate ID in import'); ids.add(entry.id);
   const previous = map.get(entry.id);
   const current = previous?.revisions.at(-1);
   if((current?.version ?? 0) !== expectedVersion) throw Error(`Version conflict: ${entry.id}`);
   const normalize = (s:string) => s.toLowerCase().replace(/[^a-z0-9]/g,'');
   if([...map.values()].some(e => e.id !== entry.id && normalize(e.revisions.at(-1)!.title) === normalize(entry.title) && !entry.supersedes.includes(e.id))) throw Error('Duplicate title; correct the existing entry or explicitly supersede it');
   for(const id of entry.supersedes) if(!map.has(id)) throw Error(`Unknown superseded entry: ${id}`);
   const revision: KnowledgeRevision = {...entry,version:expectedVersion+1,updatedAt:new Date().toISOString()};
   const record = {id:entry.id,revisions:[...(previous?.revisions ?? []),revision]};
   map.set(entry.id,record); changed.push(record);
  }
  // Prevent cyclic supersession, including across batches.
  const visit = (id:string, path:Set<string>) => {
   if(path.has(id)) throw Error('Cyclic supersession');
   for(const next of map.get(id)?.revisions.at(-1)?.supersedes ?? []) visit(next,new Set([...path,id]));
  };
  for(const id of map.keys()) visit(id,new Set());
  return {put:changed.map(data => ({kind:'architecturalKnowledge' as const,data})), result:changed};
 });
}
export async function inspectArchitecturalKnowledge(query = '') {
 const records = knowledgeRecords((await readLibrary()).architecturalKnowledge);
 const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
 return records.filter(e => terms.every(t => JSON.stringify(e.revisions.at(-1)).toLowerCase().includes(t)));
}
export async function generationKnowledge(brief: string, mode: 'generate' | 'edit') {
 const snapshot = await readLibrary();
 return retrieveArchitecturalKnowledge([...latestKnowledge(snapshot.architecturalKnowledge), ...legacyRecipeKnowledge(snapshot.recipes)],brief,mode);
}
