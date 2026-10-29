/** Controlled one-call Redesign; no retries, migrations, approval or learning writes. */
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadEnvConfig} from '@next/env';
import {Pool} from 'pg';
import {generateText,Output,NoObjectGeneratedError} from 'ai';
import {getAiModel,getAiModelId,AI_PROVIDER_OPTIONS} from '../src/lib/ai/model';
import {generationKnowledge,importArchitecturalKnowledge,inspectArchitecturalKnowledge,importKnowledgeSchema} from '../src/lib/library/architecture/service';
import {developmentRequest} from '../src/lib/villa/scene/twoStage';
import {sceneSystemPrompt,sceneMessages,sceneProviderOutputSchema,resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {validateScene} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {learningContext} from '../src/lib/villa/design-learning';
import {listDesignLessonSummaries} from '../src/lib/villa/design-learning-store';
const dir='docs/villa-playground/redesign-live',save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}.json`,JSON.stringify(v,null,2));
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
async function main(){
 assert(!existsSync(`${dir}/recipe-review.json`) || JSON.parse(readFileSync(`${dir}/recipe-review.json`,'utf8')).status !== 'BLOCKED_PENDING_EXPLICIT_APPROVAL', 'Recipe approval blocked by automatic review; explicit user resolution required before running this harness');
 loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim(),'Existing key required');
 if(process.argv[2]==='--validate-recipes'){const batch=importKnowledgeSchema.parse(JSON.parse(readFileSync(`${dir}/revised-recipe-submission.json`,'utf8')));assert.equal(batch.length,9);console.log('All nine revised entries pass the existing approval schema; no database or provider access.');return;}
 assert(['--preflight','--authorize-one-live-call'].includes(process.argv[2]));
 mkdirSync(dir,{recursive:true});
 const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;assert(url);
 const pool=new Pool({connectionString:url,connectionTimeoutMillis:10000});
 // Refuse every DDL statement. Bind the existing store to a verified existing table.
 const query=pool.query.bind(pool);pool.query=((...args:any[])=>{const sql=typeof args[0]==='string'?args[0]:args[0]?.text;assert(!/\b(CREATE|ALTER|DROP|TRUNCATE)\b/i.test(sql),'Migrations forbidden');return (query as any)(...args);}) as any;
 assert((await pool.query("SELECT to_regclass('library_docs') AS table_name")).rows[0].table_name,'Existing table required');
 (globalThis as any).__libraryPool={url,pool,ready:Promise.resolve()};
 try{
 const records=await inspectArchitecturalKnowledge('property-value');
 if(process.argv[2]==='--preflight'){
  assert(!existsSync(`${dir}/recipe-approval.json`),'Approval already completed');
  const pending=records.map(r=>r.revisions.at(-1)!);assert.equal(pending.length,9);assert(pending.every(r=>r.status==='proposed'));
  save('recipes-before',records);
  const batch=JSON.parse(readFileSync(`${dir}/revised-recipe-submission.json`,'utf8'));
  for(const item of batch) assert.equal(item.expectedVersion,pending.find(e=>e.id===item.entry.id)?.version,'Revision conflict');
  const approved=await importArchitecturalKnowledge(batch);
  save('recipe-approval',{workflow:'importArchitecturalKnowledge: schema, verified source, review, optimistic concurrency, title duplicates, supersession cycles, atomic transaction and revision history',ddlStatements:0,approved});
 }
 const source='docs/villa-playground/25m-mansion-recovery/original.scene.json';
 const before=validateScene(JSON.parse(readFileSync(source,'utf8')));
 const input=developmentRequest(before,'Fundamentally redesign the original retained $25m Calypsonian House contemporary tropical waterfront mansion. The main residence is architecturally inadequate. Use your architectural knowledge to rethink overall composition, scale, primary and secondary volumes, arrival and entrance hierarchy, roof relationships, spatial organization, suite privacy, and facade depth, opening rhythm and material quality. Substantial replacement and removal of existing architecture and dependents are explicitly authorized; accessories alone do not satisfy this brief. Preserve unrelated pool/site geometry and terrain. Do not follow a supplied design template. Existing raw scene has east-terrace-rail and west-terrace-rail centres at Y=3.8 while their decks require Y=4.2; address these in your coordinated operations if retained. Original upper retreat overlaps owner/guest floors; resolve spatial allocation rather than relabeling it. Construct real hollow enclosures and connected entrances with the existing direct-scene primitives. Use only supported geometry and disclose stairs, circulation, interior, structure or other unresolved capabilities. Do not silently substitute unsupported shapes. Supply an updated architectural plan and cite actual constructed IDs for retrieved knowledge; distinguish realized work from intent. Preserve stable IDs for retained identity. No market value or construction-cost claims.',{intent:'redesign'});
 const knowledge=await generationKnowledge(input.prompt,'edit');
 assert(knowledge.selected.some(e=>e.id==='property-value-25m-50m'));
 const summaries=await listDesignLessonSummaries(),lessons=learningContext(summaries,input.prompt);
 const system=sceneSystemPrompt(input)+knowledge.text+lessons;assert(system.includes('REDESIGN MODE:'));
 assert(getAiModelId().includes('terra'),'This test requires Terra');
 assert(JSON.parse(readFileSync(`${dir}/browser-preflight.json`,'utf8')).request.editIntent==='redesign','User-facing workflow evidence required');
 if(process.argv[2]==='--preflight'){
  save('before',before);save('request',input);save('knowledge',knowledge);
  save('preserved',{source,sha256:hash(readFileSync(source)),rawOriginal:true,elements:before.elements.length,relationshipIssues:sceneRelationshipIssues(before),architecturalAudit:reviewSceneArchitecture(before)});
  save('settings',{model:getAiModelId(),maxRetries:0,maxCalls:1,maxOutputTokens:30000,system,lessons: summaries,approval:'candidate remains UNAPPROVED',successfulLearningWrites:0});
  console.log(JSON.stringify({approvedRecipes:9,knowledge:knowledge.selected,model:getAiModelId(),paidCalls:0}));return;
 }
 assert(!existsSync(`${dir}/live-attempt.json`),'Already attempted; no retry authorized');
 assert.equal(hash(JSON.stringify(input)),hash(JSON.stringify(JSON.parse(readFileSync(`${dir}/request.json`,'utf8')))),'Preflight request changed');
 assert.equal(system,JSON.parse(readFileSync(`${dir}/settings.json`,'utf8')).system,'Knowledge/system changed');
 const lessonFiles=()=>readdirSync('.data/villa-design-lessons').sort();const initialLessons=lessonFiles();
 writeFileSync(`${dir}/live-attempt.json`,JSON.stringify({startedAt:new Date().toISOString(),maxCalls:1,maxRetries:0}),{flag:'wx'});
 let calls=0;const originalFetch=globalThis.fetch;
 globalThis.fetch=async(request,options)=>{const url=String(request instanceof Request?request.url:request);assert(url.startsWith('https://api.openai.com/'),'Unexpected destination');assert(++calls===1,'Second request forbidden');save('transport',{calls,url});const response=await originalFetch(request,options);writeFileSync(`${dir}/provider-response.raw.json`,await response.clone().text());save('http',{status:response.status,requestId:response.headers.get('x-request-id')});return response;};
 try{
  const result=await generateText({model:getAiModel(),system,messages:sceneMessages(input),output:Output.object({schema:sceneProviderOutputSchema(input)}),providerOptions:AI_PROVIDER_OPTIONS,maxOutputTokens:30000,maxRetries:0,abortSignal:AbortSignal.timeout(170000)});
  save('response',{output:result.output,text:result.text,usage:result.totalUsage,finishReason:result.finishReason,providerCalls:calls});
  assert.equal(result.finishReason,'stop');
  const resolved=resolveSceneResult(input,result.output,knowledge.evidence);
  save('after',resolved.scene);save('operations',resolved.operations);
  const prior=new Map(before.elements.map(e=>[e.id,e])),next=new Map(resolved.scene.elements.map(e=>[e.id,e]));
  save('audit',{approval:'UNAPPROVED',providerCalls:calls,operations:resolved.operations.length,operationCounts:Object.fromEntries([...new Set(resolved.operations.map(o=>o.op))].map(k=>[k,resolved.operations.filter(o=>o.op===k).length])),beforeElements:before.elements.length,afterElements:resolved.scene.elements.length,removed:[...prior.keys()].filter(id=>!next.has(id)),added:[...next.keys()].filter(id=>!prior.has(id)),changed:[...next.keys()].filter(id=>prior.has(id)&&JSON.stringify(prior.get(id))!==JSON.stringify(next.get(id))),beforeIssues:sceneRelationshipIssues(before),afterIssues:sceneRelationshipIssues(resolved.scene),architecturalAudit:resolved.architecturalAudit,roundtrip:!!validateScene(JSON.parse(JSON.stringify(resolved.scene))),successfulLearningWrites:0});
  console.log(JSON.stringify({providerCalls:calls,usage:result.totalUsage,operations:resolved.operations.length,elements:resolved.scene.elements.length}));
 }catch(error){if(NoObjectGeneratedError.isInstance(error))save('sdk-failure',{text:error.text,usage:error.usage,finishReason:error.finishReason,cause:String(error.cause)});if(error instanceof SceneConstructionError)save('recoverable-draft.UNAPPROVED',error.recoverableDraft);save('failure',{error:error instanceof Error?error.message:String(error),providerCalls:calls,retry:false});console.log('Single attempt failed; raw response retained; no retry.');process.exitCode=1;}
 finally{globalThis.fetch=originalFetch;assert.deepEqual(lessonFiles(),initialLessons);assert.equal(hash(readFileSync(source)),JSON.parse(readFileSync(`${dir}/preserved.json`,'utf8')).sha256);}
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
