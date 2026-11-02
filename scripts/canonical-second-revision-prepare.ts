/** Offline preparation of the SECOND bounded canonical revision (no network, credentials, database or provider).
 * Base plan: Terra's retained rejected revision (read only, never modified). Freezes the exact provider request,
 * compares it with the previously approved request (d830dac2…) segment by segment, and estimates cost. Exclusive writes. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Output} from 'ai';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
import {strictSchemaIssues,type SchemaNode} from '../src/lib/villa/scene/strictSchema';
import {CANONICAL_INSTRUCTIONS,CANONICAL_CONTEXT_PRECEDENCE} from '../src/lib/villa/canonical/plan';
import {analysePlan} from '../src/lib/villa/canonical/revision/analysis';
import {buildRevisionRequest,revisionResponseSchema,REVISION_ADDENDUM} from '../src/lib/villa/canonical/revision/revise';
import {originalMansion,rejectedRevision,REVISION_RECORD} from '../src/lib/villa/canonical/coordination.fixture';
import {getPricingTable} from '../src/lib/ai/pricing';
const dir='docs/architecture/canonical-redesign-revision-2026-11-02',prev='docs/architecture/canonical-plan-revision-2026-11-02';
if(existsSync(dir))throw Error(`${dir} exists; refusing to overwrite`);
mkdirSync(dir,{recursive:true});
const w=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2),{flag:'wx'});
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const old=JSON.parse(readFileSync(`${prev}/provider-request.exact.json`,'utf8'));
const oldCtx=JSON.parse(old.input[1].content[0].text),oldSystem:string=old.input[0].content,brief:string=oldCtx.brief;
const tail='Disclose limitations.',k0=oldSystem.indexOf(tail)+tail.length,k1=oldSystem.indexOf('\nCONTRACT PRECEDENCE'),k2=oldSystem.indexOf('\nPLAN REVISION');
if(oldSystem.indexOf(tail)<0||k1<0||k2<0)throw Error('Unexpected shape of the approved request');
const knowledge=oldSystem.slice(k0,k1);
const original=originalMansion(),revised=rejectedRevision();
const baseline=analysePlan(original),a=analysePlan(revised,original);
const req=await buildRevisionRequest({brief,plan:revised,analysis:a,knowledge,image:true,redesign:true});
const format=await Output.object({schema:await strictSceneResponseSchema(revisionResponseSchema)}).responseFormat;
if(format?.type!=='json'||!format.schema)throw Error('Expected JSON schema');
const issues=strictSchemaIssues(format.schema as SchemaNode);if(issues.length)throw Error(`Strict-schema issues: ${JSON.stringify(issues)}`);
const wire=Buffer.from(JSON.stringify({model:'gpt-5.6-terra',input:[{role:'developer',content:req.system},{role:'user',content:[{type:'input_text',text:req.text},{type:'input_image',image_url:`data:image/png;base64,${req.png!.toString('base64')}`}]}],max_output_tokens:30000,text:{format:{type:'json_schema',strict:true,name:'response',schema:format.schema}}}));
w('request.prepared.NOT-SUBMITTED.json',wire);w('request.system.txt',req.system);w('request.context.json',req.context);w('request.plan-image.png',req.png!);
w('previous.system.txt',oldSystem);
// ---- Comparison with two earlier requests: the approved d830dac2 request and the superseded (never submitted) 94b18aff request.
const newCtx=JSON.parse(req.text),newSchema=JSON.stringify(format.schema);
const split=(s:string)=>{const i=(m:string)=>s.indexOf(m),a0=i(tail)+tail.length,a1=i('\nCONTRACT PRECEDENCE'),a2=i('\nPLAN REVISION'),a3=i('\nREDESIGN AUTHORIZED');return {contract:s.slice(0,a0),knowledge:s.slice(a0,a1),precedence:s.slice(a1,a2),addendum:s.slice(a2,a3<0?undefined:a3),redesignAuthorization:a3<0?'':s.slice(a3)};};
const compare=(label:string,prior:{model:string;max_output_tokens:number;input:{content:unknown}[];text:{format:{schema:unknown;strict:boolean;name:string}}},file:string)=>{
 const pCtx=JSON.parse((prior.input[1].content as {text:string}[])[0].text),ps=split(prior.input[0].content as string),ns=split(req.system);
 const segments=Object.fromEntries((Object.keys(ns) as (keyof typeof ns)[]).map(k=>[k,{identical:ps[k]===ns[k],previousChars:ps[k].length,newChars:ns[k].length}]));
 const ctx=Object.fromEntries([...new Set([...Object.keys(pCtx),...Object.keys(newCtx)])].map(k=>{
  const o=pCtx[k],n=newCtx[k],same=JSON.stringify(o)===JSON.stringify(n);
  const sub=o&&n&&typeof o==='object'&&typeof n==='object'&&!Array.isArray(o)?Object.fromEntries([...new Set([...Object.keys(o),...Object.keys(n)])].map(x=>[x,JSON.stringify(o[x])===JSON.stringify(n[x])?'identical':o[x]===undefined?'added':n[x]===undefined?'removed':'changed'])):undefined;
  return [k,{status:same?'identical':o===undefined?'added':n===undefined?'removed':'changed',sub}];
 }));
 return {label,file,sha256:sha(readFileSync(file)),envelope:{model:[prior.model,'gpt-5.6-terra'],maxOutputTokens:[prior.max_output_tokens,30000],strict:[prior.text.format.strict,true],name:[prior.text.format.name,'response']},systemSegments:segments,briefIdentical:pCtx.brief===newCtx.brief,outputSchemaIdentical:JSON.stringify(prior.text.format.schema)===newSchema,contextTopLevel:ctx};
};
const v1File='docs/architecture/canonical-second-revision-2026-11-02/request.prepared.NOT-SUBMITTED.json';
const cmpApproved=compare('approved d830dac2 request',old,`${prev}/provider-request.exact.json`),cmpV1=compare('superseded 94b18aff request (never submitted)',JSON.parse(readFileSync(v1File,'utf8')),v1File);
const reqA=newCtx.requirements,reqB=JSON.parse(JSON.parse(readFileSync(v1File,'utf8')).input[1].content[0].text).requirements;
w('comparison.json',{newSha256:sha(wire),approved:cmpApproved,supersededV1:cmpV1,requirementsBefore:reqB,requirementsNow:reqA,dispositionNow:newCtx.architecturalWeaknesses.disposition});
const segmentReport={...Object.fromEntries(Object.entries(cmpApproved.systemSegments).map(([k,v])=>[k,(v as {identical:boolean}).identical]))};
const oldSchema=JSON.stringify(old.text.format.schema);
// ---- What the model will see about the plan it is revising.
const reachable=a.access.unreachable;
w('analysis.base-plan.json',{note:'Analysis of Terra\'s retained rejected revision, as given to the model.',baseRevisionRecord:REVISION_RECORD,baseRevisionRecordSha256:sha(readFileSync(REVISION_RECORD)),originalProposalSha256:sha(JSON.stringify(original)),errorCount:a.errorCount,groupCount:a.groups.length,decisionCount:a.decisions.length,decisions:a.decisions,signals:a.signals,disposition:a.disposition,unreachable:reachable,compilerNote:a.compilerNote,latentLimits:a.latentLimits,baselineErrorCount:baseline.errorCount});
const rates=getPricingTable()['gpt-5.6-terra'],pngMeta=await (await import('sharp')).default(req.png!).metadata();
const textTokens=Math.ceil((req.system.length+req.text.length+newSchema.length)/3.6),imageTokens=Math.ceil((pngMeta.width??0)/512)*Math.ceil((pngMeta.height??0)/512)*170+85,inTok=textTokens+imageTokens;
const usd=(i:number,o:number)=>Number(((i*rates.input+o*rates.output)/1e6).toFixed(4));
w('estimate.json',{note:'Local estimate at repository default rates; not an invoice. Tokens approximated as characters/3.6 plus image tiles.',model:'gpt-5.6-terra',rates,wireBytes:wire.length,wireSha256:sha(wire),estimatedInputTokens:inTok,previousCall:{input:21593,output:11774,reasoning:4007,usd:0.1845,estimatedInputWas:22700},estimatedUsd:{expected:usd(inTok,12500),atPreviousOutput:usd(inTok,11774),worstCaseAtOutputCeiling:usd(inTok,30000)},maxCalls:1,retries:0});
w('verification.json',{offline:true,providerCalls:0,preparedRequestSha256:sha(wire),strictSchemaIssues:[],systemSha256:req.sha256.system,contextSha256:req.sha256.text,imageSha256:req.sha256.image,instructionsStartWithCurrentContract:req.system.startsWith(CANONICAL_INSTRUCTIONS),precedenceIsCurrent:req.system.includes(CANONICAL_CONTEXT_PRECEDENCE),addendumIsCurrent:req.system.endsWith(REVISION_ADDENDUM)});
console.log(JSON.stringify({errors:a.errorCount,decisions:a.decisions.length,groups:a.groups.length,unreachable:reachable,signals:a.signals.filter(s=>s.fired).map(s=>s.id),disposition:a.disposition.kind,wireBytes:wire.length,sha:sha(wire),inTok,est:usd(inTok,12500),segmentReport:Object.fromEntries(Object.entries(segmentReport).map(([k,v])=>[k,v.identical])),schemaSame:oldSchema===newSchema,briefSame:oldCtx.brief===newCtx.brief},null,1));
