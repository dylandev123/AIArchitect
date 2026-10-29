import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS as seeds } from './seeds';
import { knowledgeInputSchema } from './model';
import { retrieveArchitecturalKnowledge, MAX_KNOWLEDGE_CHARS } from './retrieval';
import { generationKnowledge, importArchitecturalKnowledge, inspectArchitecturalKnowledge } from './service';
import { createFileBackend, emptySnapshot } from '../store';
const input = (index=0) => { const {version,updatedAt,...entry}=seeds[index]; void version; void updatedAt; return entry; };
afterEach(()=>vi.unstubAllEnvs());
it('validates all repository seeds and differentiates the three briefs with bounded explainable retrieval',()=>{
 seeds.forEach(e=>knowledgeInputSchema.parse(input(seeds.indexOf(e))));
 const prompts=['A $25m Caribbean waterfront estate','A compact three-bedroom family home','A grand Mediterranean courtyard mansion'];
 const results=prompts.map(p=>retrieveArchitecturalKnowledge(seeds,p));
 expect(results[0].selected.map(e=>e.id)).toContain('waterfront-estate');
 expect(results[0].selected.map(e=>e.id)).toContain('tropical-envelope');
 expect(results[1].selected.map(e=>e.id)).toContain('compact-family');
 expect(results[1].selected.map(e=>e.id)).not.toContain('wellness-suite');
 expect(results[2].selected.map(e=>e.id)).toContain('mediterranean-courtyard');
 expect(results[2].selected.map(e=>e.id)).not.toContain('sports-court');
 results.forEach(r=>{expect(r.chars).toBeLessThanOrEqual(MAX_KNOWLEDGE_CHARS);expect(r.selected.length).toBeLessThanOrEqual(r.budget.entries);expect(r.selected.every(e=>e.reasons.length)).toBe(true);});
});
it('excludes proposals, retired and superseded knowledge and respects negative feature matching',()=>{
 const proposed={...seeds[0],id:'proposal',status:'proposed' as const};
 const correction={...seeds[0],id:'correction',supersedes:[seeds[0].id]};
 const r=retrieveArchitecturalKnowledge([...seeds,proposed,correction],'Waterfront estate without pool');
 expect(r.selected.map(e=>e.id)).not.toContain('infinity-pool');expect(r.selected.map(e=>e.id)).not.toContain('proposal');expect(r.selected.map(e=>e.id)).not.toContain(seeds[0].id);
 expect(retrieveArchitecturalKnowledge(seeds,'A family home without cinema').selected.map(e=>e.id)).not.toContain('cinema');
 expect(retrieveArchitecturalKnowledge(seeds,'Add a rooftop lounge','edit').text).toContain('preserve unrelated');
});
it('requires source verification and review for approval',()=>{
 expect(()=>knowledgeInputSchema.parse({...input(),sources:[{kind:'web',reference:'https://example.org',verified:false,note:'Unreviewed'}]})).toThrow();
 expect(knowledgeInputSchema.parse({...input(),status:'proposed',review:'',sources:[{kind:'web',reference:'https://example.org',verified:false,note:'Unreviewed'}]}).status).toBe('proposed');
});
it('persists edits, optimistic revisions, atomic bulk imports and old library data without migration',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'terra-knowledge-'));
 try {
 const file=path.join(dir,'library.json');vi.stubEnv('AI_LIBRARY_PATH',file);vi.stubEnv('DATABASE_URL','');vi.stubEnv('POSTGRES_URL','');vi.stubEnv('VERCEL','');
 const old={...emptySnapshot(),recipes:[],knowledge:[]};
 await writeFile(file,JSON.stringify(old));
 const changed={...input(),principles:'Corrected estate composition from a reviewed design.'};
 await importArchitecturalKnowledge([{entry:changed,expectedVersion:1}]);
 expect((await inspectArchitecturalKnowledge('corrected'))[0].revisions).toHaveLength(2);
 expect((await generationKnowledge('waterfront estate','generate')).text).toContain(changed.principles);
 await expect(importArchitecturalKnowledge([{entry:changed,expectedVersion:1}])).rejects.toThrow('Version conflict');
 await expect(importArchitecturalKnowledge([{entry:{...input(),id:'copy'},expectedVersion:0}])).rejects.toThrow('Duplicate title');
 const before=await readFile(file,'utf8');
 await expect(importArchitecturalKnowledge([{entry:{...changed,title:'New estate title'},expectedVersion:2},{entry:input(1),expectedVersion:99}])).rejects.toThrow();
 expect(await readFile(file,'utf8')).toBe(before);
 expect((await createFileBackend(file).read()).architecturalKnowledge?.[0].revisions.at(-1)?.version).toBe(2);
 expect(JSON.parse(before).knowledge).toEqual(old.knowledge);expect(JSON.parse(before).recipes).toEqual(old.recipes);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('excludes coordinated negative amenities from expanded guidance',()=>{
 const r=retrieveArchitecturalKnowledge(seeds,'A compact three-bedroom family house without pool or gym');
 expect(r.selected.map(e=>e.id)).not.toContain('fitness-daylight');
 expect(r.selected.map(e=>e.id)).not.toContain('pool-sun-shelf');
 expect(new Set(seeds.map(e=>e.id)).size).toBe(seeds.length);
});
