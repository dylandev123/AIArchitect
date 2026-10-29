/** Offline retrieval evaluation; no provider calls or credentials. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS as entries } from '../src/lib/library/architecture/seeds';
import { retrieveArchitecturalKnowledge } from '../src/lib/library/architecture/retrieval';
const briefs=[
 'A $25m Caribbean waterfront estate',
 'A compact three-bedroom family home without pool or gym',
 'A grand Mediterranean courtyard mansion with guest suites',
 'A luxury estate with a grand entrance, private bedroom wing, rooftop terrace, pool, gym and garage',
 'A small modern two-bedroom house',
 'Add a rooftop terrace with guards and shade',
 'Add one bedroom window',
];
const results=briefs.map((brief,i)=>{const r=retrieveArchitecturalKnowledge(entries,brief,i>=5?'edit':'generate');return {brief,...r,text:undefined,evidence:undefined};});
mkdirSync('docs/architecture/knowledge-expansion',{recursive:true});
writeFileSync('docs/architecture/knowledge-expansion/retrieval.json',JSON.stringify({entries:entries.length,providerCalls:0,results},null,2));
// Existing importer permits 100 entries per atomic batch. Never mutate the user's
// library as part of evaluation. These reviewable files can use the admin import.
for(let i=61;i<entries.length;i+=100){
 const batch=entries.slice(i,i+100).map(({version,updatedAt,...entry})=>{void version;void updatedAt;return {entry,expectedVersion:1};});
 writeFileSync(`docs/architecture/knowledge-expansion/batch-${Math.floor((i-61)/100)+1}.json`,JSON.stringify(batch,null,2));
}
console.log(JSON.stringify(results.map(r=>({brief:r.brief,ids:r.selected.map(s=>s.id),chars:r.chars,metrics:r.metrics})),null,2));
