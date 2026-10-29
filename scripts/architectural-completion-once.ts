/** Authorized strict-schema test. One durable attempt, one transport call, zero retries. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {createOpenAI} from '@ai-sdk/openai';
import {generateText,Output,NoObjectGeneratedError} from 'ai';
import {getAiModelId} from '../src/lib/ai/model';
import {prepareArchitectureCompletion,sceneRequestSchema,sceneResponseFormatSchema,sceneSystemPrompt,sceneMessages,resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {validateScene} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {learningContext} from '../src/lib/villa/design-learning';
const dir='docs/architecture/completion-live';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}.json`,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
function audit(value:unknown){
 assert(value && typeof value==='object' && !Array.isArray(value));
 const node=value as Record<string,unknown>;
 assert(!('default' in node));
 if(node.properties){assert.equal(node.additionalProperties,false);assert.deepEqual(node.required,Object.keys(node.properties));Object.values(node.properties).forEach(audit);}
 if(node.items)audit(node.items);
 if(node.anyOf){assert(Array.isArray(node.anyOf));node.anyOf.forEach(audit);}
 if(node.$defs)Object.values(node.$defs).forEach(audit);
}
async function main(){
 loadEnvConfig(process.cwd());assert(process.env.OPENAI_API_KEY?.trim(),'Existing key required');
 const live=process.argv[2]==='--authorize-one-live-call';assert(live||process.argv[2]==='--preflight');
 mkdirSync(dir,{recursive:true});assert(!existsSync(`${dir}/live-attempt.json`),'Attempt already recorded; no retry');
 const source='docs/villa-playground/redesign-technical-review/repaired.UNAPPROVED.json';
 const original=readFileSync(source),before=validateScene(JSON.parse(original.toString()));
 const input=sceneRequestSchema.parse(prepareArchitectureCompletion(before));
 assert.deepEqual(input.current,before);assert.equal(input.editIntent,'complete');
 const knowledge=read('docs/villa-playground/redesign-live/knowledge.json');
 const lessons=learningContext(read('docs/villa-playground/redesign-live/settings.json').lessons,input.prompt);
 const system=sceneSystemPrompt(input)+knowledge.text+lessons;
 const model=getAiModelId();assert(model.includes('terra'));
 const schema=await sceneResponseFormatSchema(input),format=await Output.object({schema}).responseFormat;
 assert(format?.type==='json');audit(format.schema);
 assert.deepEqual(read('docs/architecture/completion/door-repair.UNAPPROVED.json'),before);
 const preservedSources=['docs/villa-playground/25m-mansion-recovery/original.scene.json','docs/villa-playground/redesign-strict-live/after.UNAPPROVED.json',source,'docs/villa-playground/redesign-technical-review/preserved-versions.UNAPPROVED.json'];
 const preserved=preservedSources.map(path=>({path,sha256:hash(readFileSync(path))}));
 const fingerprint=hash(JSON.stringify({input,system,model,schema:format.schema}));
 const settings={fingerprint,model,maxRetries:0,maxCalls:1,maxOutputTokens:30000,strict:true,source,sourceSha256:hash(original),knowledgeSource:'retained approved retrieval snapshot',databaseWrites:0,learningWrites:0,preserved};
 if(!live){save('settings',settings);save('request',input);save('system',{system});save('response-format',{type:'json_schema',name:'response',strict:true,schema:format.schema});}
 else assert.deepEqual(settings,read(`${dir}/settings.json`),'Preflight configuration changed');
 let calls=0;
 const transport:typeof fetch=async(request,options)=>{
  const url=String(request instanceof Request?request.url:request);assert.equal(url,'https://api.openai.com/v1/responses');
  const wire=JSON.parse(String(options?.body));assert.equal(wire.text.format.strict,true);audit(wire.text.format.schema);assert.deepEqual(wire.text.format.schema,format.schema);
  assert.equal(wire.model,model);assert.equal(wire.max_output_tokens,30000);
  if(!live){save('preflight',{passed:true,actualSdkWire:wire,providerCalls:0});throw new Error('OFFLINE_PREFLIGHT_COMPLETE');}
  assert.equal(++calls,1,'Second transport call forbidden');
  save('transport',{calls,url,strict:wire.text.format.strict});
  const response=await fetch(request,options);
  writeFileSync(`${dir}/provider-response.raw.json`,await response.clone().text(),{flag:'wx',mode:0o600});
  save('http',{status:response.status,requestId:response.headers.get('x-request-id')});return response;
 };
 if(live)save('live-attempt',{startedAt:new Date().toISOString(),maxCalls:1,maxRetries:0,fingerprint});
 try{
  const result=await generateText({model:createOpenAI({apiKey:process.env.OPENAI_API_KEY,fetch:transport})(model),system,messages:sceneMessages(input),output:Output.object({schema}),providerOptions:{openai:{strictJsonSchema:true}},maxOutputTokens:30000,maxRetries:0,abortSignal:AbortSignal.timeout(600000)});
  save('response',{output:result.output,text:result.text,usage:result.totalUsage,finishReason:result.finishReason,providerCalls:calls});
  assert.equal(result.finishReason,'stop');
  const resolved=resolveSceneResult(input,result.output,knowledge.evidence);
  assert.deepEqual(before.terrain,resolved.scene.terrain,'Terrain must be preserved');
  for(const e of before.elements.filter(e=>e.id.startsWith('pool-')||['gallery-salon-door','salon-guest-door','salon-dining-door'].includes(e.id))) assert.deepEqual(resolved.scene.elements.find(n=>n.id===e.id),e,'Protected original pool/door geometry changed');
  save('after.UNAPPROVED',resolved.scene);save('operations',resolved.operations);save('architectural-plan',resolved.scene.architecturalPlan);
  const previous=new Map(before.elements.map(e=>[e.id,e])),next=new Map(resolved.scene.elements.map(e=>[e.id,e]));
  save('audit',{status:'constructed-unapproved',providerCalls:calls,operations:resolved.operations.length,operationCounts:Object.fromEntries([...new Set(resolved.operations.map(o=>o.op))].map(k=>[k,resolved.operations.filter(o=>o.op===k).length])),beforeElements:before.elements.length,afterElements:resolved.scene.elements.length,removed:[...previous.keys()].filter(id=>!next.has(id)),added:[...next.keys()].filter(id=>!previous.has(id)),changed:[...next.keys()].filter(id=>previous.has(id)&&JSON.stringify(previous.get(id))!==JSON.stringify(next.get(id))),beforeIssues:sceneRelationshipIssues(before),afterIssues:sceneRelationshipIssues(resolved.scene),architecturalAudit:resolved.architecturalAudit,originalArchitecturalAudit:reviewSceneArchitecture(before),terrainPreserved:JSON.stringify(before.terrain)===JSON.stringify(resolved.scene.terrain),poolPreserved:before.elements.filter(e=>e.id.startsWith('pool-')).every(e=>JSON.stringify(e)===JSON.stringify(next.get(e.id))),roundtrip:!!validateScene(JSON.parse(JSON.stringify(resolved.scene))),usage:result.totalUsage});
  console.log(JSON.stringify({status:'constructed-unapproved',providerCalls:calls,operations:resolved.operations.length,usage:result.totalUsage}));
 }catch(error){
  if(!live && existsSync(`${dir}/preflight.json`)){console.log('Strict schema and actual SDK wire preflight passed. Zero provider calls.');return;}
  if(NoObjectGeneratedError.isInstance(error))save('sdk-failure',{text:error.text,usage:error.usage,finishReason:error.finishReason});
  if(error instanceof SceneConstructionError)save('recoverable-draft.UNAPPROVED',error.recoverableDraft);
  // Only the message is retained; credentials and request headers are never serialized.
  const message=(error instanceof Error?error.message:String(error)).split(process.env.OPENAI_API_KEY!).join('[REDACTED]');
  save('failure',{message,providerCalls:calls,retry:false});console.log(JSON.stringify({status:'failed',providerCalls:calls,message}));process.exitCode=1;
 }finally{for(const p of preserved)assert.equal(hash(readFileSync(p.path)),p.sha256,'Preserved source changed');}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
