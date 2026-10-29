import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { latestKnowledge } from '../src/lib/library/architecture/service';
import { legacyRecipeKnowledge } from '../src/lib/library/architecture/legacyRecipes';
import { knowledgeCategory } from '../src/lib/library/architecture/constructibility';
import { fragmentDetails } from '../src/lib/library/architecture/fragments';
import { listDesignLessonSummaries } from '../src/lib/villa/design-learning-store';
loadEnvConfig(process.cwd());
let stored: Parameters<typeof latestKnowledge>[0]=[], recipes: Parameters<typeof legacyRecipeKnowledge>[0]=[];
let storage='';
if(process.env.KNOWLEDGE_AUDIT_SNAPSHOT){
 const snapshot=JSON.parse(await readFile('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));stored=snapshot.architecturalKnowledge;recipes=snapshot.recipes;storage='read-only Postgres snapshot captured 2026-10-28';
}else if(process.env.DATABASE_URL || process.env.POSTGRES_URL){
 const pool=new Pool({connectionString:process.env.DATABASE_URL||process.env.POSTGRES_URL,connectionTimeoutMillis:10000});
 try{
  const client=await pool.connect();
  try { await client.query('BEGIN READ ONLY');
   const result=await client.query("SELECT kind, data FROM library_docs WHERE kind IN ('architecturalKnowledge','recipe')");
   stored=result.rows.filter(r=>r.kind==='architecturalKnowledge').map(r=>r.data);
   recipes=result.rows.filter(r=>r.kind==='recipe').map(r=>r.data);
   await client.query('ROLLBACK');storage='configured Postgres, read-only SELECT (no schema initialization)';
  }finally{client.release();}
 }finally{await pool.end();}
}else{
 try{const snapshot=JSON.parse(await readFile(process.env.AI_LIBRARY_PATH||'.data/ai-library.json','utf8'));stored=snapshot.architecturalKnowledge??[];recipes=snapshot.recipes??[];storage='local library file';}
 catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;storage='no local library file; repository seeds';}
}
const entries=latestKnowledge(stored), lessons=await listDesignLessonSummaries();
const counts=<T extends object>(rows:T[],key:keyof T)=>Object.fromEntries([...new Set(rows.map(r=>String(r[key])))].map(k=>[k,rows.filter(r=>String(r[key])===k).length]));
const duplicateGroups=(key:(e:typeof entries[number])=>string)=>[...Map.groupBy(entries,key).values()].filter(g=>g.length>1).map(g=>g.map(e=>e.id));
const combined=[...entries,...legacyRecipeKnowledge(recipes)];
const superseded=new Set(combined.filter(e=>e.status==='approved').flatMap(e=>e.supersedes));
const terms=(s:string)=>new Set(s.toLowerCase().match(/[a-z]+/g)?.filter(w=>w.length>3&&!['modern','tropical','caribbean','reference','property','value','with','from','residence'].includes(w))??[]);
const overlapPairs=combined.flatMap((a,i)=>combined.slice(i+1).filter(b=>knowledgeCategory(a)===knowledgeCategory(b)&&[...terms(a.title)].filter(w=>terms(b.title).has(w)).length>=2).map(b=>[a.id,b.id]));
const report={storage,totalReadableRecords:combined.length,approvedActive:combined.filter(e=>e.status==='approved'&&!superseded.has(e.id)).length,overlapHeuristic:{definition:'Same category and at least two shared significant title words (not proof of duplicate guidance).',pairs:overlapPairs.length,entries:new Set(overlapPairs.flat()).size,ids:overlapPairs},verifiedReviewedDesignEntries:entries.filter(e=>e.sources.some(s=>s.kind==='reviewed-design'&&s.verified)).length,storedKnowledgeRecords:stored?.length,entries:entries.length,status:counts(entries,'status'),kinds:counts(entries,'kind'),recipeTypes:counts(entries,'recipeType'),categories:counts(entries.map(e=>({...e,category:knowledgeCategory(e)})),'category'),propertyValue:entries.filter(e=>e.category==='property-value').length,legacyRecipes:recipes.length,legacyApproval:counts(recipes,'approval'),fragmentOverrides:Object.keys(fragmentDetails),lessons:{total:lessons.length,origin:counts(lessons,'origin'),verdict:counts(lessons,'verdict')},duplicates:{normalizedTitle:duplicateGroups(e=>e.title.toLowerCase().replace(/[^a-z0-9]/g,'')),exactGuidance:duplicateGroups(e=>e.placement+'|'+e.principles)},entriesIndex:entries.map(e=>({id:e.id,kind:e.kind,category:knowledgeCategory(e),recipeType:e.recipeType,status:e.status})),legacyIndex:recipes.map(e=>({id:e.id,name:e.name,approval:e.approval}))};
await writeFile('docs/architecture/unified-knowledge/library-snapshot.json',JSON.stringify({architecturalKnowledge:stored,recipes},null,2));
await writeFile('docs/architecture/unified-knowledge/inventory.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,entriesIndex:undefined,legacyIndex:undefined},null,2));
