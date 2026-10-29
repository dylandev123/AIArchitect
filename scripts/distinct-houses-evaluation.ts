/** Two authorized first-pass Generate calls, no retries or repair. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {loadEnvConfig} from '@next/env';
import {Pool} from 'pg';
import {createOpenAI} from '@ai-sdk/openai';
import {generateText,Output,NoObjectGeneratedError} from 'ai';
import {getAiModelId,AI_PROVIDER_OPTIONS} from '../src/lib/ai/model';
import {generationSceneRequest,sceneMessages,sceneResponseFormatSchema,resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {architecturalRequestContext} from '../src/lib/villa/scene/knowledgeContext';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const root='docs/architecture/distinct-houses';
const briefs=[['A','Design an extraordinary $25m contemporary tropical waterfront mansion in Saint Lucia, on a flat site. Create a sophisticated luxury residence with a distinctive entrance, beautiful living spaces, private bedroom wings, purposeful upper-level architecture where appropriate, and integrated outdoor living. Choose a coherent architectural concept using relevant knowledge and construction capabilities. The result should feel like a remarkable luxury estate, not a basic bungalow. Construct fully editable direct-scene architecture.'],['B','Design an exceptional $25 million Mediterranean courtyard estate with warm natural materials, carefully composed pitched roofs, arcades, shaded courtyards, elegant residential wings and richly developed indoor-outdoor spaces. Use an original architectural composition appropriate to the style, rather than adapting a tropical mansion layout. Construct fully editable direct-scene architecture.']] as const;
const save=(dir:string,name:string,v:unknown)=>writeFileSync(`${dir}/${name}.json`,JSON.stringify(v,null,2),{flag:'wx',mode:0o600});
async function main(){
 loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim());
 const live=process.argv[2]==='--live';assert(live||process.argv[2]==='--preflight');mkdirSync(root,{recursive:true});
 const url=process.env.DATABASE_URL||process.env.POSTGRES_URL;assert(url);const pool=new Pool({connectionString:url,connectionTimeoutMillis:10000});
 const query=pool.query.bind(pool);pool.query=((...args:any[])=>{const sql=typeof args[0]==='string'?args[0]:args[0]?.text;assert(/^\s*SELECT\b/i.test(sql),'Read-only knowledge access');return (query as any)(...args);}) as any;
 (globalThis as any).__libraryPool={url,pool,ready:Promise.resolve()};
 try{
 for(const [label,prompt] of briefs){const dir=`${root}/${label}`;mkdirSync(dir,{recursive:true});
 const input=generationSceneRequest(prompt);const model=getAiModelId();assert(model.includes('terra'));
 const schema=await sceneResponseFormatSchema(input);
 if(!live){const context=await architecturalRequestContext(input);save(dir,'request',input);save(dir,'context',context);save(dir,'settings',{model,maxRetries:0,maxOutputTokens:30000,providerOptions:AI_PROVIDER_OPTIONS});save(dir,'format',await Output.object({schema}).responseFormat);continue;}
 assert(!existsSync(`${dir}/attempt.json`),'No retry allowed');assert.deepEqual(input,JSON.parse(readFileSync(`${dir}/request.json`,'utf8')));
 const context=JSON.parse(readFileSync(`${dir}/context.json`,'utf8'));const settings=JSON.parse(readFileSync(`${dir}/settings.json`,'utf8'));assert.equal(settings.model,model);
 let calls=0;const transport:typeof fetch=async(req,opts)=>{assert.equal(++calls,1);const wire=JSON.parse(String(opts?.body));save(dir,'wire-request',wire);const response=await fetch(req,opts);writeFileSync(`${dir}/provider-response.raw.json`,await response.clone().text(),{flag:'wx',mode:0o600});save(dir,'http',{status:response.status,requestId:response.headers.get('x-request-id')});return response;};
 save(dir,'attempt',{startedAt:new Date().toISOString(),maxCalls:1});
 try{const result=await generateText({model:createOpenAI({apiKey:process.env.OPENAI_API_KEY,fetch:transport})(model),system:context.system,messages:sceneMessages(input),output:Output.object({schema}),providerOptions:AI_PROVIDER_OPTIONS,maxOutputTokens:30000,maxRetries:0,abortSignal:AbortSignal.timeout(170000)});
 save(dir,'result',{text:result.text,output:result.output,usage:result.totalUsage,finishReason:result.finishReason,providerCalls:calls});assert.equal(result.finishReason,'stop');
 const resolved=resolveSceneResult(input,result.output,context.evidence);save(dir,'scene.UNAPPROVED',resolved.scene);save(dir,'audit',{relationships:sceneRelationshipIssues(resolved.scene),architecturalAudit:resolved.architecturalAudit,operations:resolved.operations});console.log(label,'constructed unapproved',JSON.stringify(result.totalUsage));
 }catch(error){if(NoObjectGeneratedError.isInstance(error))save(dir,'sdk-failure',{text:error.text,usage:error.usage,finishReason:error.finishReason});if(error instanceof SceneConstructionError)save(dir,'recoverable-draft.UNAPPROVED',error.recoverableDraft);save(dir,'failure',{message:String(error).split(process.env.OPENAI_API_KEY!).join('[REDACTED]'),providerCalls:calls});console.log(label,'failed; stopping, no further calls');process.exitCode=1;break;}
 }
 }finally{await pool.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
