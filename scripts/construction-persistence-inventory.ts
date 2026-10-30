/** Read-only inventory: bypasses application readers because they initialize DDL.
 * No provider imports, secrets in output, migrations, or test database writes. */
import { readFileSync } from 'node:fs';
import { loadEnvConfig } from '@next/env';
import { Client } from 'pg';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS } from '../src/lib/library/architecture/seeds';
import { latestKnowledge } from '../src/lib/library/architecture/service';
import { legacyRecipeKnowledge } from '../src/lib/library/architecture/legacyRecipes';
import { retrieveArchitecturalKnowledge } from '../src/lib/library/architecture/retrieval';
loadEnvConfig(process.cwd());
const url=process.env.DATABASE_URL || process.env.POSTGRES_URL;
console.log(JSON.stringify({seedCount:ARCHITECTURAL_KNOWLEDGE_SEEDS.length,seedApproved:ARCHITECTURAL_KNOWLEDGE_SEEDS.filter(r=>r.status==='approved').length,configured:!!url}));
if(url){
 const client=new Client({connectionString:url,connectionTimeoutMillis:10000,query_timeout:10000});
 try{
  await client.connect();await client.query('BEGIN READ ONLY');
  const {rows}=await client.query('SELECT kind, data FROM library_docs');
  const stored=rows.filter(r=>r.kind==='architecturalKnowledge').map(r=>r.data);
  const recipes=rows.filter(r=>r.kind==='recipe').map(r=>r.data);
  const merged=latestKnowledge(stored),all=[...merged,...legacyRecipeKnowledge(recipes)];
  const retrieval=retrieveArchitecturalKnowledge(all,'$25m Caribbean tropical waterfront mansion','generate');
  const retained=JSON.parse(readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
  const sameKnowledge=JSON.stringify([...stored].sort((a,b)=>a.id.localeCompare(b.id)))===JSON.stringify([...retained.architecturalKnowledge].sort((a,b)=>a.id.localeCompare(b.id)));
  console.log(JSON.stringify({sameKnowledgeAsOfflineFixture:sameKnowledge,database:new URL(url).pathname.slice(1),host:new URL(url).hostname,kinds:rows.reduce((a,r)=>(a[r.kind]=(a[r.kind]??0)+1,a),{} as Record<string,number>),storedKnowledge:stored.map(r=>({id:r.id,status:r.revisions.at(-1)?.status,versions:r.revisions.length})),mergedKnowledge:merged.length,legacyRecipes:legacyRecipeKnowledge(recipes).length,metrics:{total:retrieval.metrics.total,approvedActive:retrieval.metrics.approvedActive,eligible:retrieval.metrics.eligible,selected:retrieval.metrics.selected},selected:retrieval.selected.map(r=>r.id)},null,2));
  await client.query('ROLLBACK');
 }catch(error){console.log(JSON.stringify({readErrorCode:(error as {code?:string}).code??'unknown'}));process.exitCode=1;}
 finally{await client.end();}
}
