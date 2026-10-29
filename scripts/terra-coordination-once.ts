/** One authorized experiment; offline preflight, exclusive marker, guarded transport. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {createOpenAI} from '@ai-sdk/openai';
import {generateText,Output,NoObjectGeneratedError} from 'ai';
import {getAiModelId} from '../src/lib/ai/model';
import {sceneRequestSchema,sceneResponseFormatSchema,sceneSystemPrompt,sceneMessages,resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {stageSceneOperations} from '../src/lib/villa/scene/model';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {occupiedRoofConflicts} from '../src/lib/villa/scene/spatial';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
const dir='docs/architecture/terra-coordination-experiment';
const save=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}.json`,JSON.stringify(v,null,2),{flag:'wx'});
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
async function main(){
 const live=process.argv[2]==='--authorize-one-live-call';assert(live||process.argv[2]==='--preflight');
 loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim());mkdirSync(dir,{recursive:true});assert(!existsSync(`${dir}/live-attempt.json`),'Attempt already recorded; retries forbidden');
 const source='.data/scene-responses/66c57386-4c5c-4f50-a97e-8ec0ec80588b.json',bytes=readFileSync(source),retained=JSON.parse(bytes.toString());
 const before=stageSceneOperations({version:'architectural-scene-1',name:retained.output.name,elements:[]},retained.output.operations);before.architecturalPlan=retained.output.architecturalPlan;assert.equal(before.elements.length,88);
 const audit=reviewSceneArchitecture(before),coordinates=JSON.parse(readFileSync('docs/architecture/programme-coordination/evidence.json','utf8')).coordinates;
 const input=sceneRequestSchema.parse({mode:'edit',editIntent:'complete',current:before,prompt:`Architectural revision experiment. Independently resolve the existing roof/occupied-space conflict, excessive stair rises and blocked circulation using supported operations, preserving the intended architectural character and accommodation. You may revise roof footprints, elevations, allocations, circulation or relevant geometry. Choose the geometric solution yourself. Return a separate unapproved candidate and explain your selected solution and reasons explicitly in architecturalPlan and summary. Correct programme references against final construction. Disclose unresolved and new limitations. Original brief (retained knowledge.query): ${retained.knowledge.query}`});
 const evidence={originalBrief:retained.knowledge.query,coordinates,roofConflicts:occupiedRoofConflicts(before),findings:audit.findings,programme:audit.programme};
 const system=sceneSystemPrompt(input)+retained.knowledge.text;
 const messages=[...sceneMessages(input),{role:'user' as const,content:JSON.stringify({coordinationEvidence:evidence})}];
 const schema=await sceneResponseFormatSchema(input),format=await Output.object({schema}).responseFormat;assert(format?.type==='json');
 const model=getAiModelId();assert(model.includes('terra'));
 const fingerprint=hash(JSON.stringify({input,system,messages,model,schema:format.schema}));
 const settings={model,maxRetries:0,maxCalls:1,maxOutputTokens:30000,fingerprint,source,sourceSha256:hash(bytes),approval:'UNAPPROVED',knowledgeWrites:0};
 if(!live){save('before',before);save('request',input);save('coordination-evidence',evidence);save('settings',settings);save('system',{system});save('messages',messages);save('response-format',format);}
 else assert.deepEqual(settings,JSON.parse(readFileSync(`${dir}/settings.json`,'utf8')));
 let calls=0;
 const transport:typeof fetch=async(request,options)=>{
  const url=String(request instanceof Request?request.url:request);assert.equal(url,'https://api.openai.com/v1/responses');const wire=JSON.parse(String(options?.body));assert.equal(wire.text.format.strict,true);assert.equal(wire.model,model);
  if(!live){save('preflight',{passed:true,providerCalls:0,wire});throw Error('OFFLINE_PREFLIGHT_COMPLETE');}
  assert.equal(++calls,1,'Second request forbidden');save('transport',{calls,url});const response=await fetch(request,options);writeFileSync(`${dir}/provider-response.raw.json`,await response.clone().text(),{flag:'wx'});save('http',{status:response.status,requestId:response.headers.get('x-request-id')});return response;
 };
 if(live)save('live-attempt',{startedAt:new Date().toISOString(),maxCalls:1,maxRetries:0,fingerprint});
 try{
 const result=await generateText({model:createOpenAI({apiKey:process.env.OPENAI_API_KEY,fetch:transport})(model),system,messages,output:Output.object({schema}),providerOptions:{openai:{strictJsonSchema:true}},maxOutputTokens:30000,maxRetries:0,abortSignal:AbortSignal.timeout(600000)});
 save('response',{output:result.output,text:result.text,usage:result.totalUsage,finishReason:result.finishReason,providerCalls:calls});assert.equal(result.finishReason,'stop');
 const resolved=resolveSceneResult(input,result.output,retained.knowledge.evidence);save('after.UNAPPROVED',resolved.scene);save('operations',resolved.operations);
 save('audit',{approval:'UNAPPROVED',before:audit,after:reviewSceneArchitecture(resolved.scene),beforeRoof:occupiedRoofConflicts(before),afterRoof:occupiedRoofConflicts(resolved.scene),beforeRelationships:sceneRelationshipIssues(before),afterRelationships:sceneRelationshipIssues(resolved.scene)});
 console.log(JSON.stringify({providerCalls:calls,usage:result.totalUsage,operations:resolved.operations.length,elements:resolved.scene.elements.length}));
 }catch(error){
 if(!live&&existsSync(`${dir}/preflight.json`)){console.log('Offline SDK preflight passed; zero provider calls');return;}
 if(NoObjectGeneratedError.isInstance(error))save('sdk-failure',{text:error.text,usage:error.usage,finishReason:error.finishReason});
 if(error instanceof SceneConstructionError){save('after.UNAPPROVED',error.recoverableDraft);save('audit',{approval:'REJECTED-UNAPPROVED',before:audit,after:reviewSceneArchitecture(error.recoverableDraft),beforeRoof:occupiedRoofConflicts(before),afterRoof:occupiedRoofConflicts(error.recoverableDraft),beforeRelationships:sceneRelationshipIssues(before),afterRelationships:sceneRelationshipIssues(error.recoverableDraft)});}
 const message=String(error instanceof Error?error.message:error).split(process.env.OPENAI_API_KEY!).join('[REDACTED]');save('failure',{message,providerCalls:calls,retry:false});console.log(JSON.stringify({providerCalls:calls,error:message}));process.exitCode=1;
 }finally{assert.equal(hash(readFileSync(source)),settings.sourceSha256);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
