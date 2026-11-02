/** One continuous-house experiment. Default offline preparation; live phases require separate approval. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEnvConfig} from '@next/env';
import {connectivityPreflight} from './reference-connectivity';
import {validateScene} from '../src/lib/villa/scene/model';
import {generationReviewRequestSchema,validateGenerationReview,stageGenerationRefinement,REVIEW_VIEWS} from '../src/lib/villa/scene/generationReview';
import {sceneVisualEvidence} from '../src/lib/villa/scene/visualEvidence';
// A separately authorized cycle never reuses the consumed historical phase.
const dir=process.argv.includes('--network-verified-cycle')
 ? 'docs/architecture/full-house-investigation/network-verified-intelligence'
 : 'docs/architecture/full-house-investigation/fresh-intelligence';
const source='docs/architecture/retained-visual-review';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const baselinePath=`${source}/original.scene.json`;
const expected='b76ed99bad6f6bda1c1e6f233ef9d65e9b01b0c1c0687f97e488dc44feadf983';
assert.equal(hash(baselinePath),expected);
const current=validateScene(read(baselinePath));
assert.equal(current.elements.length,47);
const captureRecord=read(`${source}/record.json`);
assert.deepEqual(captureRecord.before,current);
const captures=captureRecord.beforeCaptures;
assert.deepEqual(captures.map((s:{view:string})=>s.view),REVIEW_VIEWS);
const oldInput=read(`${source}/review.input.json`);
assert.deepEqual(oldInput.current,current);
assert(oldInput.images.every((image:string,index:number)=>image===captures[index].image),'Capture/input mismatch');
const brief='Continue this exact 47-element family house. Its architectural composition is weak. Independently assess the four actual rendered views and complete construction evidence, and select the highest-impact meaningful architectural intervention feasible within the normal editable refinement and preservation contract. Decide the design yourself. Explain architectural significance, physical feasibility, affected extent and expected visible effect; distinguish local improvement from unresolved whole-house weaknesses. Do not generate a new house. If a substantial intervention cannot be represented safely, explain why rather than selecting a minor cosmetic change while leaving fundamental problems acknowledged.';
const input=generationReviewRequestSchema.parse({phase:'review',pass:1,brief,current,images:captures.map((s:{image:string})=>s.image)});
const mode=process.argv[2]??'--prepare';
assert(['--prepare','--approved-review','--approved-refine','--preflight'].includes(mode));
mkdirSync(dir,{recursive:true});
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}`,JSON.stringify(value,null,2),{flag:'wx'});
if(mode==='--preflight') {
 loadEnvConfig(process.cwd());
 delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
 const report=await connectivityPreflight();
 const output=process.argv[3]?.startsWith('--')?undefined:process.argv[3];
 if(output)writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});
 console.log(JSON.stringify(report,null,2));
 if(!report.ok)process.exitCode=1;
} else if(mode==='--prepare') {
 globalThis.fetch=async()=>{throw Error('Network prohibited in preparation');};
 const evidence=sceneVisualEvidence(current);
 assert.equal(evidence.constructed.length,47);
 assert(evidence.constructed.every(e=>Number.isFinite(e.renderedTop)&&Number.isFinite(e.renderedBottom)));
 save('review.input.json',input);
 save('prepared-evidence.json',{baselineHash:expected,elements:47,brief,views:captures.map(({image: _image,...shot}: {image:string;view:string})=>shot),constructedEvidence:evidence,providerCalls:0,model:'gpt-5.6-terra',outputLimits:{review:5000,refine:12000},preservation:'Normal route and stageGenerationRefinement; no bypasses',historicalHashes:Object.fromEntries(['original.scene.json','review.provider-response.txt','refine.provider-response.txt','raw-candidate.operations.json'].map(name=>[`${source}/${name}`,hash(`${source}/${name}`)]))});
 console.log('Prepared original-house review; zero provider calls.');
} else {
 // These explicit flags are operational guards, never a substitute for user approval.
 loadEnvConfig(process.cwd());
 assert(process.env.OPENAI_API_KEY?.trim(),'Existing approved key unavailable');
 assert(!process.env.VERCEL,'Local only');
 delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
 process.env.AI_USAGE_LOG_PATH=`${process.cwd()}/${dir}/usage.jsonl`;
 const {getAiModelId}=await import('../src/lib/ai/model');
 assert.equal(getAiModelId(),'gpt-5.6-terra');
 assert.deepEqual(read(`${dir}/review.input.json`),input);
 const phase=mode==='--approved-review'?'review':'refine';
 let requestInput=input;
 if(phase==='refine') {
  const result=read(`${dir}/review.result.json`);
  const review=validateGenerationReview(result.output,current);
  const checkpoint=read(`${dir}/decision-checkpoint.json`);
  assert.equal(checkpoint.proceed,true,'No positive significance/feasibility checkpoint');
  assert.equal(checkpoint.reviewHash,hash(`${dir}/review.result.json`));
  assert(typeof checkpoint.reason==='string'&&checkpoint.reason.length>40);
  assert(review.refinement,'No intervention');
  requestInput=generationReviewRequestSchema.parse({phase:'refine',pass:1,brief,current,review});
 }
 assert(!existsSync(`${dir}/${phase}.started.json`),'Phase already consumed; no retries');
 // A failure here consumes no paid phase; success applies only to this process.
 const preflight=await connectivityPreflight();
 save(`${phase}.preflight-${Date.now()}.json`,preflight);
 assert.equal(preflight.ok,true,`Connectivity preflight failed: ${JSON.stringify(preflight)}`);
 const nativeFetch=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async(url,init)=>{
  assert.equal(String(url instanceof Request?url.url:url),'https://api.openai.com/v1/responses');
  assert.equal(++calls,1,'Extra request forbidden');
  save(`${phase}.provider-request.json`,JSON.parse(String(init?.body)));
  let response: Response;
  try { response=await nativeFetch(url,init); }
  catch(error) {
   // Only structured error names/codes: arbitrary messages can contain secrets.
   const causes: {name:string;code?:string}[]=[];
   let cause: unknown=error;
   for(let depth=0;cause&&depth<6;depth++) {
    const item=cause as {name?:unknown;code?:unknown;cause?:unknown};
    const safe=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_]{1,80}$/.test(value)?value:undefined;
    causes.push({name:safe(item.name)??'Error',code:safe(item.code)});
    cause=item.cause;
   }
   save(`${phase}.transport-failure.json`,{causes,retry:false});
   throw error;
  }
  writeFileSync(`${dir}/${phase}.provider-response.txt`,await response.clone().text(),{flag:'wx'});
  save(`${phase}.http.json`,{status:response.status,requestId:response.headers.get('x-request-id')});
  return response;
 };
 save(`${phase}.started.json`,{at:new Date().toISOString(),model:getAiModelId(),maxCalls:1,maxRetries:0});
 try {
  const {POST}=await import('../src/app/api/ai/scene/visual-review/route');
  if(phase==='refine') save('refine.input.json',requestInput);
  const response=await POST(new Request('http://localhost/api/ai/scene/visual-review',{method:'POST',body:JSON.stringify(requestInput)}));
  const result=await response.json();save(`${phase}.result.json`,result);
  assert(response.ok,result.error);
  if(requestInput.phase==='refine') {
   const staged=stageGenerationRefinement(current,requestInput.review,result.output);
   save('refined.scene.json',staged.scene);save('construction-diff.json',staged.diff);
  }
 } catch(error){save(`${phase}.failure.json`,{error:String(error),calls,retry:false});process.exitCode=1;}
 finally {globalThis.fetch=nativeFetch;assert.equal(hash(baselinePath),expected);save(`${phase}.finished.json`,{calls,baselineUnchanged:true});}
 console.log(`${phase}: ${calls} provider calls; stopped without comparison or project mutation.`);
}
