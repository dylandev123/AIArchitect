/** Offline preparation for the bounded canonical plan-revision experiment. No network, credentials, database or provider.
 * Reads the saved mansion proposal (never modified), writes its analysis and planning drawing, runs labelled MOCK
 * revisions through the real parser/validator, and prepares (does not submit) the one live request. Exclusive writes. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Output} from 'ai';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
import {strictSchemaIssues,type SchemaNode} from '../src/lib/villa/scene/strictSchema';
import {CANONICAL_INSTRUCTIONS} from '../src/lib/villa/canonical/plan';
import {analysePlan} from '../src/lib/villa/canonical/revision/analysis';
import {renderPlanPng} from '../src/lib/villa/canonical/revision/planView';
import {buildRevisionRequest,assessRevision,revisionResponseSchema} from '../src/lib/villa/canonical/revision/revise';
import {MANSION_PATH,mansionBytes,mansionOriginal,mansionCoordinateRepairMock,mansionStillInvalidMock,weakRowHouse,rowHouseRedesignMock,compactTwoLevelFaulty,compactTwoLevelRepairMock} from '../src/lib/villa/canonical/revision/revision.fixture';
import {getPricingTable} from '../src/lib/ai/pricing';
const dir='docs/architecture/canonical-plan-revision-2026-11-02',src='docs/architecture/canonical-roof-retrieval-2026-11-02';
if(existsSync(dir))throw Error(`${dir} exists; refusing to overwrite`);
mkdirSync(dir,{recursive:true});
const w=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2),{flag:'wx'});
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const bytes=mansionBytes(),plan=mansionOriginal(),a=analysePlan(plan);
// The brief and the retrieved architectural knowledge are the ones the saved proposal was written against (no retrieval, no database).
const old=JSON.parse(readFileSync(`${src}/provider-request.exact.json`,'utf8'));
const dev:string=old.input[0].content,brief:string=JSON.parse(old.input[1].content[0].text).prompt;
const tail='Disclose limitations.',k0=dev.indexOf(tail)+tail.length,k1=dev.indexOf('\nCONTRACT PRECEDENCE');
if(dev.indexOf(tail)<0||k1<0)throw Error('Retained developer message has an unexpected shape');
const knowledge=dev.slice(k0,k1);
// 1. What the model would see about its own saved plan.
w('analysis.saved-mansion.json',{readOnly:true,providerCalls:0,sourceProposal:MANSION_PATH,sourceProposalSha256:sha(bytes),errorCount:a.errorCount,groupCount:a.groups.length,groups:a.groups,compilerNote:a.compilerNote,signals:a.signals,disposition:a.disposition,building:a.building,site:a.site,levels:a.levels,rooms:a.rooms,siteItems:a.siteItems,chains:a.chains,access:a.access,dependencies:a.dependencies});
const view=await renderPlanPng(plan,a,{title:'Saved Terra mansion proposal — plan under revision (not constructed)'});
w('plan-view.saved-mansion.svg',view.svg);w('plan-view.saved-mansion.png',view.png);
// 2. Labelled mock revisions through the real validator (developer-authored; not model output).
const mocks:Record<string,unknown>={};
const rv=(p:unknown,k:'repair'|'redesign')=>({status:'revised',revisionKind:k,concept:'MOCK',plan:p,addressed:[],changes:[],retained:[],limitations:['mock']});
const runMock=async(name:string,original:Parameters<typeof analysePlan>[0],mock:Parameters<typeof analysePlan>[0],kind:'repair'|'redesign',scope:'repair-only'|'redesign-permitted',draw:boolean)=>{
 const r=assessRevision(original,rv(mock,kind),scope);
 mocks[name]={label:'MOCK developer-authored response; not model output and not evidence of model capability',originalErrors:analysePlan(original).errorCount,originalDisposition:analysePlan(original).disposition.kind,scope,declaredKind:kind,status:r.status,stopReasons:r.stopReasons,checks:r.checks,resolvedCauses:r.resolvedCauses,remainingCauses:r.remainingCauses,newCauses:r.newCauses,dimensions:r.dimensions,changeShare:r.diff?.changeShare,revisedErrors:r.revisedAnalysis?.errorCount,statement:r.statement};
 if(draw){const o=await renderPlanPng(original,undefined,{title:`${name}: original`}),m=await renderPlanPng(mock,undefined,{title:`${name}: mock revision`});w(`plan-view.${name}.original.png`,o.png);w(`plan-view.${name}.revised.png`,m.png);}
};
await runMock('mansion-coordinate-repair',plan,mansionCoordinateRepairMock(),'repair','redesign-permitted',false);
await runMock('mansion-still-invalid',plan,mansionStillInvalidMock(),'repair','redesign-permitted',false);
await runMock('weak-row-house-redesign',weakRowHouse(),rowHouseRedesignMock(),'redesign','redesign-permitted',true);
await runMock('weak-row-house-redesign-under-repair-only',weakRowHouse(),rowHouseRedesignMock(),'redesign','repair-only',false);
await runMock('compact-two-level-repair',compactTwoLevelFaulty(),compactTwoLevelRepairMock(),'repair','repair-only',true);
w('offline-mock-runs.json',mocks);
// 3. The one prepared (NOT submitted) live request.
const req=await buildRevisionRequest({brief,plan,analysis:a,knowledge,image:true});
const format=await Output.object({schema:await strictSceneResponseSchema(revisionResponseSchema)}).responseFormat;
if(format?.type!=='json'||!format.schema)throw Error('Expected JSON schema');
const issues=strictSchemaIssues(format.schema as SchemaNode);if(issues.length)throw Error(`Strict-schema issues: ${JSON.stringify(issues)}`);
const wire=Buffer.from(JSON.stringify({model:'gpt-5.6-terra',input:[{role:'developer',content:req.system},{role:'user',content:[{type:'input_text',text:req.text},{type:'input_image',image_url:`data:image/png;base64,${req.png!.toString('base64')}`}]}],max_output_tokens:30000,text:{format:{type:'json_schema',strict:true,name:'response',schema:format.schema}}}));
w('request.prepared.NOT-SUBMITTED.json',wire);w('request.context.json',req.context);w('request.system.txt',req.system);w('request.plan-image.png',req.png!);
const textTokens=Math.ceil((req.system.length+req.text.length+JSON.stringify(format.schema).length)/3.6),imgTiles=(Math.ceil(view.png.length>0?1:0)),pngMeta=await (await import('sharp')).default(req.png!).metadata();
const imageTokens=Math.ceil((pngMeta.width??0)/512)*Math.ceil((pngMeta.height??0)/512)*170+85;
const rates=getPricingTable()['gpt-5.6-terra'],inTok=textTokens+imageTokens;
const usd=(i:number,o:number)=>Number(((i*rates.input+o*rates.output)/1e6).toFixed(4));
void imgTiles;
w('estimate.json',{note:'Local estimate from repository default rates; not an invoice or provider pricing verification. Token counts are approximations (characters/3.6; image tiles at 512 px × 170 + 85).',model:'gpt-5.6-terra',rates,wireBytes:wire.length,wireSha256:sha(wire),systemChars:req.system.length,contextChars:req.text.length,schemaChars:JSON.stringify(format.schema).length,image:{width:pngMeta.width,height:pngMeta.height,bytes:req.png!.length},estimatedInputTokens:inTok,priorSameBriefCalls:{input:[4556,6066],output:[9534,9879]},outputTokensExpected:'10,000–16,000 including reasoning (the plan is returned in full)',maxOutputTokens:30000,estimatedUsd:{expected:usd(inTok,13000),atPriorOutput:usd(inTok,9879),worstCaseAtOutputCeiling:usd(inTok,30000)},maxCalls:1,retries:0});
w('verification.json',{offline:true,providerCalls:0,savedProposalSha256:sha(bytes),preparedRequestSha256:sha(wire),strictSchemaIssues:[],systemSha256:req.sha256.system,contextSha256:req.sha256.text,imageSha256:req.sha256.image,knowledgeChars:knowledge.length,instructionsContainCurrentContract:req.system.startsWith(CANONICAL_INSTRUCTIONS)});
console.log(JSON.stringify({errors:a.errorCount,groups:a.groups.length,disposition:a.disposition.kind,wireBytes:wire.length,wireSha256:sha(wire),estimatedInputTokens:inTok,mocks:Object.fromEntries(Object.entries(mocks).map(([k,v])=>[k,(v as {status:string;stopReasons:string[]}).status+' '+(v as {stopReasons:string[]}).stopReasons.join(',')]))},null,1));
