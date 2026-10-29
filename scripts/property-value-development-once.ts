/** One authorized paid edit. Exclusive marker and transport guard prevent retries. */
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {generateText,Output} from 'ai';
import {getAiModel,getAiModelId,AI_PROVIDER_OPTIONS} from '../src/lib/ai/model';
import {developmentRequest} from '../src/lib/villa/scene/twoStage';
import {SCENE_SYSTEM_PROMPT,sceneMessages,sceneProviderOutputSchema,resolveSceneResult,SceneConstructionError} from '../src/lib/villa/scene/terra';
import {generationKnowledge} from '../src/lib/library/architecture/service';
import {learningContext} from '../src/lib/villa/design-learning';
import {listDesignLessonSummaries} from '../src/lib/villa/design-learning-store';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {validateScene} from '../src/lib/villa/scene/model';
const dir='docs/villa-playground/property-value-development';
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}.json`,JSON.stringify(value,null,2));
async function main(){
 if(process.argv[2]!=='--authorize-one-live-call')throw Error('Explicit one-call flag required');
 if(existsSync(`${dir}/live-attempt.json`))throw Error('Already attempted; no retries authorized');
 loadEnvConfig(process.cwd());if(!process.env.OPENAI_API_KEY?.trim())throw Error('Existing key missing');
 mkdirSync(dir,{recursive:true});
 const source='docs/villa-playground/two-stage/retained.after.json';
 const before=validateScene(JSON.parse(readFileSync(source,'utf8')));
 const input=developmentRequest(before,'Improve the retained $25m contemporary tropical waterfront residence. Review actual composition, proportions, primary/secondary volumes, entrance hierarchy, suite privacy, facade glazing/material balance, roof setbacks, shade and connected indoor-outdoor spaces. Prioritize meaningful massing improvements when needed, rather than decorating. Select only justified amenities. Do not inflate counts. Resolve access/enclosure with existing operations where possible; disclose remaining unsupported features. No invented market or construction-cost claims.',{recompose:true});
 const knowledge=await generationKnowledge(input.prompt,'edit');
 const lessons=learningContext(await listDesignLessonSummaries(),input.prompt);
 save('before',before);save('request',input);save('knowledge',knowledge);
 save('preserved',{source,sha256:createHash('sha256').update(readFileSync(source)).digest('hex'),approval:'unapproved candidate; no learning writes',baseline:'latest retained offline two-stage development; original upstream retained separately'});
 save('settings',{model:getAiModelId(),maxRetries:0,maxOutputTokens:30000,system:SCENE_SYSTEM_PROMPT+knowledge.text+lessons});
 writeFileSync(`${dir}/live-attempt.json`,JSON.stringify({startedAt:new Date().toISOString(),maxCalls:1,maxRetries:0}),{flag:'wx'});
 let calls=0;const originalFetch=globalThis.fetch;
 globalThis.fetch=async(request,options)=>{
  const url=String(request instanceof Request?request.url:request);
  if(!url.startsWith('https://api.openai.com/'))throw Error('Unexpected provider destination');
  if(++calls>1)throw Error('Second request prohibited');
  save('transport',{calls,url});
  const response=await originalFetch(request,options);
  writeFileSync(`${dir}/provider-response.raw.json`,await response.clone().text());
  save('http',{status:response.status,requestId:response.headers.get('x-request-id')});return response;
 };
 try{
  const result=await generateText({model:getAiModel(),system:SCENE_SYSTEM_PROMPT+knowledge.text+lessons,messages:sceneMessages(input),output:Output.object({schema:sceneProviderOutputSchema(input)}),providerOptions:AI_PROVIDER_OPTIONS,maxOutputTokens:30000,maxRetries:0,abortSignal:AbortSignal.timeout(170000)});
  save('response',{output:result.output,text:result.text,usage:result.totalUsage,finishReason:result.finishReason,providerCalls:calls});
  if(result.finishReason!=='stop')throw Error('Incomplete response; no application');
  const resolved=resolveSceneResult(input,result.output,knowledge.evidence);
  save('after',resolved.scene);save('operations',resolved.operations);
  save('audit',{approval:'unapproved',beforeIssues:sceneRelationshipIssues(before),afterIssues:sceneRelationshipIssues(resolved.scene),architecturalAudit:resolved.architecturalAudit,providerCalls:calls,roundtrip:!!validateScene(JSON.parse(JSON.stringify(resolved.scene)))});
  console.log(JSON.stringify({providerCalls:calls,usage:result.totalUsage,operations:resolved.operations.length,elements:resolved.scene.elements.length}));
 }catch(error){
  if(error instanceof SceneConstructionError)save('recoverable-draft.UNAPPROVED',error.recoverableDraft);
  save('failure',{error:error instanceof Error?error.message:String(error),providerCalls:calls,retry:false});
  console.log('Single attempt failed; response retained; no retry.');process.exitCode=1;
 }finally{globalThis.fetch=originalFetch;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
