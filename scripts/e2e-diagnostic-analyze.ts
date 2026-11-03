/** Offline, read-only analysis of ONE retained provider response (Stages B-E). No network, credentials, database or provider.
 *  usage: vite-node scripts/e2e-diagnostic-analyze.ts <evidenceDir> [--selftest]
 *  Reads provider-response.raw.json (never modified). Never edits Terra's plan, never repairs, never relaxes compilation.
 *  Every stage is run independently so one early failure cannot hide later, independent findings; stages that cannot be
 *  reached are labelled 'not-reached' rather than passed. */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Output} from 'ai';
import {canonicalProposalSchema,compileArchitecturalPlan,deriveBuildingIntent,architecturalPlanSchema,type ArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
import {diagnosePlan,type Finding} from '../src/lib/villa/canonical/diagnose';
import {coordinatePlan} from '../src/lib/villa/canonical/spatial';
import {compositionOf,renderConceptSvg,volumeCollisions,levelTops,envelopeHeight} from '../src/lib/villa/canonical/arrangement';
import {resolveLayout,resolveSiteRects,type Rect} from '../src/lib/villa/canonical/layout';
import {placePortals,pointOnEdge,edgeOf,sharedRuns,SIDES} from '../src/lib/villa/canonical/coordination';
import {conceptReview} from '../src/lib/villa/canonical/concept';
import {expandComposition} from '../src/lib/villa/canonical/composition';
import {computeCostUsd,getPricingTable} from '../src/lib/ai/pricing';
const dir=process.argv[2];if(!dir)throw Error('evidence directory required');
const rawPath=`${dir}/provider-response.raw.json`;
const rawText=readFileSync(rawPath,'utf8'),rawSha=createHash('sha256').update(rawText).digest('hex');
const out=(n:string,v:unknown)=>{if(/provider-response|provider-request|call-started|route-response/.test(n))throw Error(`protected evidence ${n}`);writeFileSync(`${dir}/${n}`,typeof v==='string'?v:JSON.stringify(v,null,2));};
const readJson=(n:string)=>existsSync(`${dir}/${n}`)?JSON.parse(readFileSync(`${dir}/${n}`,'utf8')):null;
const timeline:any[]=[...(readJson('timeline.preflight.json')??[]).map((r:any)=>({phase:'preflight (offline, no provider call)',...r})),...(readJson('timeline.live.json')??[]).map((r:any)=>({phase:'live',...r}))];
const timed=async<T,>(stage:string,event:string,fn:()=>T|Promise<T>,outcome:(v:T)=>string=()=>'ok'):Promise<T>=>{const t=Date.now(),startedAt=new Date(t).toISOString();try{const v=await fn();timeline.push({stage,event,startedAt,durationMs:Date.now()-t,outcome:outcome(v)});return v;}catch(e){timeline.push({stage,event,startedAt,durationMs:Date.now()-t,outcome:`failed: ${String((e as Error).message??e).slice(0,160)}`});throw e;}};
const f2=(n:number)=>Number(n.toFixed(2));
const response=JSON.parse(rawText);

// ───────────── Stage B: provider response, usage, cost ─────────────
const items:any[]=response.output??[];
const message=items.filter(i=>i.type==='message').flatMap(i=>i.content??[]).filter((c:any)=>c.type==='output_text'||c.type==='refusal');
const text:string=message.filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('');
const reasoningItems=items.filter(i=>i.type==='reasoning');
const usage=response.usage??{},http=readJson('provider-http.json'),approval=readJson('request-approval.json'),callResult=readJson('call-result.json');
const cost=computeCostUsd('gpt-5.6-terra',{inputTokens:usage.input_tokens??0,cachedInputTokens:usage.input_tokens_details?.cached_tokens??0,outputTokens:usage.output_tokens??0});
out('usage.json',{providerUsage:usage,inputTokens:usage.input_tokens,cachedInputTokens:usage.input_tokens_details?.cached_tokens??0,cacheWriteTokens:usage.input_tokens_details?.cache_write_tokens??null,outputTokens:usage.output_tokens,reasoningTokens:usage.output_tokens_details?.reasoning_tokens??null,visibleOutputTokens:(usage.output_tokens??0)-(usage.output_tokens_details?.reasoning_tokens??0),totalTokens:usage.total_tokens,
 outputTokenCeiling:30000,ceilingShare:f2((usage.output_tokens??0)/30000),rates:getPricingTable()['gpt-5.6-terra'],estimatedUsd:cost,approvedMaximumUsd:approval?.maximumCostUsd??null,
 durations:{providerWallMs:http?.providerWallMs??null,openaiProcessingMs:http?.openaiProcessingMs??null},paidProviderRequests:callResult?.providerCalls??null,note:'Local estimate from provider-reported usage and the repository rate table; not an invoice.'});
const responseFacts={httpStatus:http?.status??null,requestId:http?.requestId??null,responseId:response.id,model:response.model,status:response.status,incompleteDetails:response.incomplete_details??null,error:response.error??null,outputItemTypes:items.map(i=>i.type),textChars:text.length,refusal:message.some((c:any)=>c.type==='refusal'),rawSha256:rawSha,
 reasoningSummary:reasoningItems.length?reasoningItems.map(r=>({id:r.id,summary:r.summary??[],hasEncryptedContent:!!r.encrypted_content})):'No reasoning summary was exposed by the provider (the request did not ask for one). Hidden reasoning is not available and is not reconstructed here.'};
const proposalText=text;out('proposal.exact.txt',proposalText);
type Proposal=ReturnType<typeof canonicalProposalSchema.parse>;
let proposal:Proposal|null=null,parseError:string|null=null;
await timed('B','parse-provider-output-with-production-schema',async()=>{
 try{
  const output=Output.object({schema:await strictSceneResponseSchema(canonicalProposalSchema)});
  proposal=canonicalProposalSchema.parse(await output.parseCompleteOutput({text:proposalText},{response:{id:response.id,timestamp:new Date((response.created_at??0)*1000),modelId:response.model},usage:{inputTokens:usage.input_tokens,outputTokens:usage.output_tokens,totalTokens:usage.total_tokens,inputTokenDetails:{noCacheTokens:usage.input_tokens,cacheReadTokens:0,cacheWriteTokens:0},outputTokenDetails:{textTokens:usage.output_tokens,reasoningTokens:usage.output_tokens_details?.reasoning_tokens??0}},finishReason:response.status==='completed'?'stop':'length'} as never));
 }catch(e){parseError=String((e as Error).message??e);}
},()=>proposal?`parsed (${(proposal as Proposal).status})`:`REJECTED: ${parseError?.slice(0,120)}`);
out('response-facts.json',responseFacts);
if(!proposal||(proposal as Proposal).status!=='proposed'){
 out('canonical-plan.json',{note:'No canonical plan was produced.',parseError,proposal});
 out('timeline.json',timeline);
 console.log(JSON.stringify({stage:'B',proposalStatus:proposal?(proposal as Proposal).status:'unparseable',parseError}));process.exit(0);
}
const proposed=proposal as Extract<Proposal,{status:'proposed'}>,plan:ArchitecturalPlan=proposed.plan;
out('canonical-plan.json',proposed);

// ───────────── Stage B (cont.): the declared architectural decisions, as authored ─────────────
const tops=levelTops(plan),layout=resolveLayout(plan),rects=layout.rects,site=resolveSiteRects(plan,rects);
const rectOf=(id:string)=>rects.get(id)??null;
const indoor=plan.spaces.filter(s=>!s.outdoor);
const decisions={
 thesis:plan.thesis,limitationsDeclared:proposed.limitations,
 site:plan.site,orientationRadians:plan.orientation,levels:plan.levels.map(l=>({...l,top:tops.get(l.id)})),arrival:plan.arrival,materials:plan.materials,cameraViews:plan.cameraViews,
 wings:plan.masses.map(m=>({id:m.id,role:m.role,relatesTo:m.relatesTo??null,placement:m.placement??'(none: wing placed by its rooms)',rooms:plan.spaces.filter(s=>s.mass===m.id).map(s=>s.id)})),
 composition:plan.composition??'NOT DECLARED (composition field absent)',
 constraints:plan.constraints??[],
 programme:plan.spaces.map(s=>({id:s.id,wing:s.mass,level:s.level,use:s.use,outdoor:s.outdoor,width:s.width,depth:s.depth,areaM2:f2(s.width*s.depth),height:s.height??'derived',material:s.facadeMaterial??null,placement:s.placement,resolved:rectOf(s.id)})),
 roofs:plan.roofs,screens:plan.screens??[],portals:plan.portals,stairs:plan.stairs,terraces:plan.terraces,pools:plan.pools.map(p=>({...p,resolved:site.rects.get(p.id)??null})),landscape:plan.landscape.map(l=>({...l,resolved:site.rects.get(l.id)??null})),
 counts:{wings:plan.masses.length,spaces:plan.spaces.length,interior:indoor.length,outdoor:plan.spaces.length-indoor.length,portals:plan.portals.length,doors:plan.portals.filter(p=>p.mode==='door').length,passages:plan.portals.filter(p=>p.mode==='open').length,windows:plan.portals.filter(p=>p.mode==='window').length,stairs:plan.stairs.length,roofs:plan.roofs.length,screens:plan.screens?.length??0,pools:plan.pools.length,landscape:plan.landscape.length,constraints:plan.constraints?.length??0}
};
out('architectural-decisions.json',decisions);

// ───────────── Stage C: independent read-only diagnostics ─────────────
const diag=await timed('C','diagnosePlan (all independent checks)',()=>diagnosePlan(plan),d=>`${d.findings.filter(f=>f.severity==='error').length} errors, ${d.findings.filter(f=>f.severity==='observation').length} observations`);
// diagnosePlan reads plan.roofs/plan.portals only; roofs and window bays declared through composition (roofSpans, facades) are expanded by the compiler, not by diagnosePlan.
// Without this expansion diagnosePlan reports every roof-span room as roofless and every facade-window room as dark. The expansion below is the production expandComposition; the plan is not altered.
let composed:ReturnType<typeof expandComposition>|null=null,composedError:string|null=null;
try{composed=expandComposition(plan as never,plan.composition,rects);}catch(e){composedError=String((e as any).decisions?.join(' | ')??(e as Error).message);}
// Rooms inside a composition roof span are covered by the span (compiler: spanOf); diagnosePlan only knows plan.roofs entries, so it flags them. Roof-section clash analysis does not model spans at all (not evaluated for span roofs).
const spanMembers=new Set((composed?.spans??[]).flatMap(sp=>sp.members));
const blindSpot=diag.findings.filter(f=>f.stage==='roofs'&&spanMembers.has(f.id)&&/neither a roof nor a space above/.test(f.message));
const introduced:Finding[]=[];
const diagX={...diag,findings:diag.findings.filter(f=>!blindSpot.includes(f))};
const windowedSpaces=new Set([...plan.portals.filter(p=>p.mode==='window'&&p.to==='exterior').map(p=>p.host.space),...(composed?.facades??[]).filter(f=>f.mode==='window').map(f=>f.host.space)]);
const darkRooms=indoor.filter(s=>!windowedSpaces.has(s.id)).map(s=>s.id);
let coord:any;try{coord=await timed('C','coordinatePlan (whole-building coordinator)',()=>coordinatePlan(plan),c=>`${c.errors.length} errors, ${c.constraints.filter((x:any)=>!x.ok).length} violated constraints`);}catch(e){coord={threw:String(e)};}
const ids=new Set<string>([...plan.levels,...plan.masses,...plan.spaces,...plan.portals,...plan.stairs,...plan.pools,...plan.landscape,...(plan.screens??[])].map(e=>e.id));
const idsIn=(msg:string)=>[...new Set([...ids].filter(i=>new RegExp(`(^|[^a-z0-9-])${i.replace(/[-]/g,'\\-')}($|[^a-z0-9-])`).test(msg)))].sort();
const errors=diagX.findings.filter(f=>f.severity==='error');
// One physical conflict = one group. Findings are keyed by stage + the entities they name; the compiler/coordinator messages for the same pair merge in.
const groups=new Map<string,{key:string;stage:string;entities:string[];messages:string[];sources:string[]}>();
const addGroup=(stage:string,entities:string[],message:string,source:string)=>{const key=`${stage}:${entities.join('+')||'unattributed'}`;const g=groups.get(key)??{key,stage,entities,messages:[],sources:[]};if(!g.messages.includes(message))g.messages.push(message);if(!g.sources.includes(source))g.sources.push(source);groups.set(key,g);};
for(const f of errors)addGroup(f.stage,f.id.split('/').filter(x=>ids.has(x)).length?f.id.split('/').filter(x=>ids.has(x)).sort():idsIn(f.message).slice(0,3),f.message,'diagnosePlan');
for(const e of coord?.errors??[])addGroup(e.kind==='collision'?'volumes':e.kind==='site'?'site':e.kind,[...e.ids].sort(),e.message,'coordinatePlan');
const findingsByStage=Object.fromEntries(Object.entries(Object.groupBy(errors,f=>f.stage)).map(([k,v])=>[k,v!.length]));
// Repeated-template detection: same message with entity names removed.
const template=(m:string)=>m.replace(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g,'<id>').replace(/-?\d+(?:\.\d+)?/g,'<n>').slice(0,110);
const templates=Object.entries(Object.groupBy(errors,f=>`${f.stage}|${template(f.message)}`)).map(([k,v])=>({template:k,count:v!.length,ids:v!.map(f=>f.id)})).sort((a,b)=>b.count-a.count);
out('diagnostics.json',{
 readOnly:true,providerCalls:0,planSha256:createHash('sha256').update(JSON.stringify(plan)).digest('hex'),
 totals:{diagnosticErrors:errors.length,diagnosticObservations:diag.findings.length-errors.length,coordinatorErrors:coord?.errors?.length??null,distinctPhysicalConflictGroups:groups.size,byStage:findingsByStage},
 layoutProblems:layout.problems,siteProblems:site.problems,
 groupedPhysicalConflicts:[...groups.values()],repeatedMessageTemplates:templates,
 compositionExpansion:{expanded:!!composed,error:composedError,expandedRoofs:composed?.roofs.length??null,spans:composed?.spans.map(s=>({id:s.id,lead:s.lead,members:s.members,form:s.form,rise:s.rise,overhang:s.overhang}))??[],facadeOpenings:composed?.facades.length??0,windowBays:(composed?.facades??[]).filter(f=>f.mode==='window').length},
 diagnosticBlindSpot:{explanation:'diagnosePlan does not expand composition.roofSpans or composition.facades. These raw findings name rooms that the production expandComposition places under a declared roof span; they are a defect in the read-only diagnostic, not in Terra\'s plan.',rawErrorsFromDiagnosePlan:diag.findings.filter(f=>f.severity==='error').length,falsePositivesRemovedByExpansion:blindSpot.map(f=>({stage:f.stage,id:f.id,message:f.message})),newFindingsAfterExpansion:introduced.map(f=>({stage:f.stage,id:f.id,message:f.message}))},
 daylight:{interiorRoomsWithAnyExteriorWindow:indoor.length-darkRooms.length,interiorRoomsWithoutExteriorWindow:darkRooms,note:'Counts authored exterior window portals plus composition window bays. diagnosePlan\'s own daylight observation ignores composition bays.'},
 findings:diagX.findings,rawFindingsBeforeBlindSpotRemoval:diag.findings,metrics:diagX.metrics,
 coordination:coord,
 resolvedRects:diagX.rects,resolvedSiteRects:diagX.siteRects,
 note:'Groups merge findings that name the same entities; they are NOT root causes. Root causes are assigned in root-causes.json.'
});

// ───────────── Stage D: the authoritative compiler, and the stages it did or did not reach ─────────────
let derivedOk=false,deriveError:string|null=null;
try{deriveBuildingIntent(plan);derivedOk=true;}catch(e){deriveError=String((e as any).decisions?.join(' | ')??(e as Error).message);}
let compileOk=false,compileError:any=null,built:ReturnType<typeof compileArchitecturalPlan>|null=null;
await timed('D','compileArchitecturalPlan (authoritative)',()=>{try{built=compileArchitecturalPlan(plan);compileOk=true;}catch(e){compileError={name:(e as Error).name,message:String((e as Error).message??e),decisions:(e as any).decisions??null};}},()=>compileOk?'compiled':'REJECTED');
const decisionsList:string[]=compileError?.decisions??(compileError?[compileError.message]:[]);
const enclosureFail=decisionsList.some(d=>/incomplete overhead enclosure|unsupported-capability: only/.test(d));
const status=(ok:boolean|null,reason:string)=>({status:ok===null?'not-reached':ok?'passed':'failed',reason});
const phases=[
 {phase:'1 contract parse (architecturalPlanSchema)',...status(architecturalPlanSchema.safeParse(plan).success,'schema validation of the normalized plan')},
 {phase:'2 derive: single root, ground level, layout resolution, composition expansion, roof-span checks, portal placement, site-anchor resolution',...(compileOk?status(true,'compiler completed'):derivedOk?status(true,'deriveBuildingIntent returned'):status(false,deriveError??'derive threw'))},
 {phase:'3 id uniqueness, flat-site, camera views, duplicate roofs',...(compileOk?status(true,'compiler completed'):derivedOk?status(null,'cannot be separated from later phases without re-running compiler internals; see first error'):status(null,'not reached: derive failed first'))},
 {phase:'4 overhead enclosure of every roofless interior',...(compileOk?status(true,'compiler completed'):derivedOk?(enclosureFail?status(false,'enclosure messages present'):status(null,'not isolated')):status(null,'not reached: derive failed first; independently analysed by diagnosePlan stage "roofs"'))},
 {phase:'5 compileBuilding (walls, slabs, openings, stairs, roofs geometry)',...(compileOk?status(true,'compiler completed'):status(null,derivedOk?'not isolated':'not reached: derive failed first'))},
 {phase:'6 whole-building spatial constraints and declarations (coordinatePlan)',...(compileOk?status(true,'no constraint or declaration errors'):derivedOk?status(null,'not isolated'):status(null,'not reached through the compiler; coordinatePlan was run independently (see diagnostics.json)'))},
 {phase:'7 overlapping wall sections between staggered levels',...(compileOk?status(true,'compiler completed'):status(null,'not reached'))},
 {phase:'8 composition fidelity (declared composition honoured by built geometry)',...(compileOk?status(true,'compiler completed'):status(null,'not reached'))},
 {phase:'9 pool/landscape inside site, no site overlap, all geometry in site bounds',...(compileOk?status(true,'compiler completed'):status(null,'not reached through the compiler; checked independently by diagnosePlan stage "site"'))},
 {phase:'10 validateScene',...(compileOk?status(true,'compiler completed'):status(null,'not reached'))},
];
// Available verified correction options: OFFERS ONLY, each produced by the existing coordinator, never applied.
const options={appliedToPlan:false,note:'Offers computed by the existing arrangement/spatial analysers. Choosing one is an architectural decision; none was applied.',
 collisions:(coord?.collisions??[]).map((c:any)=>({pair:c.pair,explanation:c.explanation,options:c.options})),constraintOptions:(coord?.constraints??[]).filter((c:any)=>!c.ok).map((c:any)=>({id:c.id,reason:c.reason,implicated:c.implicated,options:c.options})),openChoices:coord?.openChoices??[]};
out('correction-options.json',options);
out('compile-result.json',{compiled:compileOk,firstBlockingError:decisionsList[0]??null,allCompilerReportedErrors:decisionsList,errorName:compileError?.name??null,phases,
 independentlyDiagnosedErrorCount:errors.length,note:compileOk?'Compiled without modification.':'The compiler stops at its first failing phase and reports that phase\'s decisions together. Phases marked not-reached were NOT executed and are NOT claimed to pass.'});
if(compileOk&&built){
 const b=built as ReturnType<typeof compileArchitecturalPlan>;
 out('compiled-scene.json',b.scene);
 const kinds=Object.entries(Object.groupBy(b.scene.elements,e=>e.kind)).map(([k,v])=>[k,v!.length]);
 out('scene-summary.json',{elements:b.scene.elements.length,byKind:Object.fromEntries(kinds),materials:Object.fromEntries(Object.entries(Object.groupBy(b.scene.elements,e=>String(e.material))).map(([k,v])=>[k,v!.length])),roofElements:b.scene.elements.filter(e=>e.kind==='roof').map(e=>({id:e.id,at:e.at,size:e.size,material:e.material,rotation:e.rotation})),terrain:b.scene.terrain,compiler:b.compiler});
}

// ───────────── Stage E: does the plan support the declared intentions? (measured, no beauty score) ─────────────
const quotes=(re:RegExp)=>[...[plan.thesis,...plan.masses.map(m=>m.role),...(plan.constraints??[]).map(c=>c.reason),...proposed.limitations].flatMap(t=>t.split(/(?<=[.;])\s+/))].filter(s=>re.test(s)).map(s=>s.trim().slice(0,260));
const roofBySpace=new Map<string,{form:string;overhang:number}>();
for(const r of plan.roofs)roofBySpace.set(r.space,{form:r.form,overhang:r.overhang??0});
for(const sp of plan.composition?.roofSpans??[])for(const m of sp.spaces)if(!roofBySpace.has(m))roofBySpace.set(m,{form:sp.form,overhang:sp.overhang??0});
const volumeDefs=plan.composition?plan.composition.volumes.map(v=>({id:v.id,tier:v.tier as string,wings:v.masses})):plan.masses.map(m=>({id:m.id,tier:'(undeclared)',wings:[m.id]}));
const topOf=(s:ArchitecturalPlan['spaces'][number])=>(tops.get(s.level)??0)+(envelopeHeight(plan,s)||0);
// the tops map holds the level TOP, so a level's floor is its top minus its rise; envelope top = floor datum + height.
const floorOf=(level:string)=>{const l=plan.levels.find(x=>x.id===level)!;return (tops.get(level)??0)-l.rise;};
const envTop=(s:ArchitecturalPlan['spaces'][number])=>floorOf(s.level)+envelopeHeight(plan,s);
void topOf;
const indoorArea=indoor.reduce((n,s)=>n+s.width*s.depth,0);
const allIndoorRects=indoor.map(s=>rectOf(s.id)).filter((r):r is Rect=>!!r);
const bx0=Math.min(...allIndoorRects.map(r=>r.x)),bx1=Math.max(...allIndoorRects.map(r=>r.x+r.width)),bz0=Math.min(...allIndoorRects.map(r=>r.z)),bz1=Math.max(...allIndoorRects.map(r=>r.z+r.depth));
const bcx=(bx0+bx1)/2,bcz=(bz0+bz1)/2;
const volumes=volumeDefs.map(v=>{
 const members=indoor.filter(s=>v.wings.includes(s.mass)),area=members.reduce((n,s)=>n+s.width*s.depth,0),rs=members.map(s=>rectOf(s.id)).filter((r):r is Rect=>!!r);
 const cx=rs.length?rs.reduce((n,r)=>n+(r.x+r.width/2)*r.width*r.depth,0)/rs.reduce((n,r)=>n+r.width*r.depth,0):null,cz=rs.length?rs.reduce((n,r)=>n+(r.z+r.depth/2)*r.width*r.depth,0)/rs.reduce((n,r)=>n+r.width*r.depth,0):null;
 return {id:v.id,tier:v.tier,wings:v.wings,interiorRooms:members.length,interiorAreaM2:f2(area),areaShare:f2(indoorArea?area/indoorArea:0),maxEnvelopeTopM:members.length?f2(Math.max(...members.map(envTop))):null,
  levels:[...new Set(members.map(s=>s.level))],roofForms:[...new Set(members.map(s=>roofBySpace.get(s.id)?.form).filter(Boolean))],maxOverhangM:f2(Math.max(0,...members.map(s=>roofBySpace.get(s.id)?.overhang??0))),
  centreOffsetFromBuildingCentreM:cx===null?null:f2(Math.hypot(cx-bcx,(cz as number)-bcz)),centreOffsetShareOfHalfExtent:cx===null?null:f2(Math.hypot(cx-bcx,(cz as number)-bcz)/(Math.max(bx1-bx0,bz1-bz0)/2||1))};
});
const primary=volumes.filter(v=>v.tier==='primary'),others=volumes.filter(v=>v.tier!=='primary');
const outdoorSpaces=plan.spaces.filter(s=>s.outdoor);
const shading=outdoorSpaces.map(s=>{const r=roofBySpace.get(s.id);const rr=rectOf(s.id);const upper=rr?indoor.filter(o=>o.level!==s.level&&floorOf(o.level)>=floorOf(s.level)&&(()=>{const q=rectOf(o.id);return q&&Math.min(q.x+q.width,rr.x+rr.width)-Math.max(q.x,rr.x)>.1&&Math.min(q.z+q.depth,rr.z+rr.depth)-Math.max(q.z,rr.z)>.1;})()).map(o=>o.id):[];
 return {id:s.id,use:s.use,areaM2:f2(s.width*s.depth),roof:r??null,coveredByUpperSpaces:upper,shaded:!!r||upper.length>0};});
const screensDetail=(plan.screens??[]).map(sc=>({id:sc.id,space:sc.space,side:sc.side,widthM:sc.width,heightM:sc.height,standOffM:sc.standOff,panels:sc.panels}));
const arrivalSpace=plan.spaces.find(s=>s.id===plan.arrival),arrivalRoof=roofBySpace.get(plan.arrival)??null;
const entrancePortal=plan.composition?.entrance?plan.portals.find(p=>p.id===plan.composition!.entrance!.portal):null;
const porch=plan.composition?.entrance?plan.spaces.find(s=>s.id===plan.composition!.entrance!.porch):null;
const exteriorDoors=plan.portals.filter(p=>p.to==='exterior'||plan.spaces.find(s=>s.id===p.to)?.outdoor).filter(p=>p.mode!=='window');
const courts=plan.spaces.filter(s=>s.outdoor&&/court|cloister|atrium|patio/i.test(`${s.id} ${s.use}`)).map(s=>{
 const r=rectOf(s.id);if(!r)return {id:s.id,resolved:false};
 const others=indoor.filter(o=>o.level===s.level&&rectOf(o.id)).map(o=>({id:o.id,rect:rectOf(o.id)!}));
 const per=2*(r.width+r.depth),enclosed=SIDES.reduce((n,side)=>n+sharedRuns(r,side,others).reduce((m,run)=>m+(run.hi-run.lo),0),0);
 return {id:s.id,resolved:true,perimeterM:f2(per),enclosedByInteriorRoomsM:f2(enclosed),enclosedShare:f2(enclosed/per),sidesTouchingRooms:SIDES.filter(side=>sharedRuns(r,side,others).length).length};});
const sharedExteriorByWallSide=plan.portals.filter(p=>p.mode==='window'&&p.to==='exterior').length;
const comp=compositionOf(plan);
const bedrooms=plan.spaces.filter(s=>!s.outdoor&&/bedroom|suite/i.test(`${s.id} ${s.use}`)&&!/living|dining|lounge|gallery|corridor|hall/i.test(`${s.id} ${s.use}`));
const bedSig=Object.entries(Object.groupBy(bedrooms,s=>`${f2(s.width)}x${f2(s.depth)}`)).map(([k,v])=>({footprint:k,count:v!.length,ids:v!.map(s=>s.id)})).sort((a,b)=>b.count-a.count);
const claims=[
 {claim:'dominant / central / principal volume',declaredIn:quotes(/\b(central|dominant|principal|hero|focal|pavilion|spine|primary)\b/i),
  measured:{compositionDeclared:!!plan.composition,volumes,primaryCount:primary.length,largestVolumeAreaShare:Math.max(0,...volumes.map(v=>v.areaShare)),heightSpreadAcrossVolumesM:f2(Math.max(...volumes.map(v=>v.maxEnvelopeTopM??0))-Math.min(...volumes.map(v=>v.maxEnvelopeTopM??0))),distinctEnvelopeTopsM:[...new Set(indoor.map(s=>f2(envTop(s))))].sort((a,b)=>a-b),levelsUsed:plan.levels.length},
  supportedByGeometry:primary.length>0&&others.length>0?(primary[0].areaShare>=.3&&primary[0].maxEnvelopeTopM!==null&&primary[0].maxEnvelopeTopM>=Math.max(...others.map(v=>v.maxEnvelopeTopM??0))+.5):null,
  rule:'Heuristic: a primary volume holds >=30% of interior area AND its envelope top is >=0.5 m above every other volume. null = no primary/secondary hierarchy was declared to test.'},
 {claim:'shaded terraces / veranda / canopy / deep eaves',declaredIn:quotes(/\b(shad\w*|veranda\w*|loggia\w*|canop\w*|eave\w*|overhang\w*|pergola\w*|brise|louv\w*)\b/i),
  measured:{outdoorSpaces:shading,shadedOutdoorSpaces:shading.filter(s=>s.shaded).length,outdoorSpaceCount:shading.length,screens:screensDetail,roofOverhangsM:[...new Set(plan.roofs.map(r=>r.overhang??0))].sort((a,b)=>a-b),maxOverhangM:Math.max(0,...plan.roofs.map(r=>r.overhang??0),...(plan.composition?.roofSpans??[]).map(r=>r.overhang??0))},
  supportedByGeometry:shading.length?shading.some(s=>s.shaded&&s.areaM2>=20):null,rule:'Supported if at least one declared outdoor space of >=20 m2 has a roof entry/span or an upper-level space above it. Does not test sun angle or depth adequacy.'},
 {claim:'memorable / developed entrance',declaredIn:quotes(/\b(entrance|entry|arrival|gate|porte|threshold|foyer|forecourt|court of arrival)\b/i),
  measured:{arrival:arrivalSpace?{id:arrivalSpace.id,use:arrivalSpace.use,widthM:arrivalSpace.width,depthM:arrivalSpace.depth,level:arrivalSpace.level,outdoor:arrivalSpace.outdoor,roof:arrivalRoof}:null,compositionEntrance:plan.composition?.entrance??null,entrancePortal:entrancePortal?{id:entrancePortal.id,mode:entrancePortal.mode,widthM:entrancePortal.width,heightM:entrancePortal.height}:null,porch:porch?{id:porch.id,widthM:porch.width,depthM:porch.depth,roof:roofBySpace.get(porch.id)??null}:null,exteriorDoorCount:exteriorDoors.length,screensOnArrivalSide:screensDetail.filter(s=>s.space===plan.arrival)},
  supportedByGeometry:plan.composition?.entrance?!!(porch&&roofBySpace.get(porch.id)&&entrancePortal):(arrivalSpace?!!arrivalRoof&&arrivalSpace.width*arrivalSpace.depth>=20:null),
  rule:'Supported if a composition.entrance names a door and a roofed porch, or the arrival space is >=20 m2 and roofed. Dramatic quality is not measurable.'},
 {claim:'courtyard / enclosed court',declaredIn:quotes(/\b(court\w*|cloister\w*|atrium|patio|quadrangle|enclos\w*)\b/i),
  measured:{courts,declaredEncloseConstraints:(coord?.constraints??[]).filter((c:any)=>c.kind==='enclose').map((c:any)=>({id:c.id,a:c.a,required:c.required,measured:c.measured,ok:c.ok,reason:c.reason}))},
  supportedByGeometry:courts.length?courts.some((c:any)=>c.resolved&&c.enclosedShare>=.5):null,rule:'Supported if a court-named outdoor space has >=50% of its perimeter bounded by interior rooms on its level.'},
 {claim:'composed facade / opening relationships',declaredIn:quotes(/\b(facade\w*|façade\w*|rhythm|elevation\w*|bay\w*|glaz\w*|fenestration|opening\w*)\b/i),
  measured:{openingsByVolume:volumeDefs.map(v=>{const sp=new Set(indoor.filter(x=>v.wings.includes(x.mass)).map(x=>x.id));return {volume:v.id,tier:v.tier,exteriorWindows:[...windowedSpaces].filter(x=>sp.has(x)).length,windowBays:(composed?.facades??[]).filter(f=>f.mode==='window'&&sp.has(f.host.space)).length,doorsToOutdoorSpaces:plan.portals.filter(p=>p.mode!=='window'&&sp.has(p.host.space)&&plan.spaces.find(x=>x.id===p.to)?.outdoor).map(p=>p.id)};}),compositionFacades:plan.composition?.facades??[],facadeBayCount:(plan.composition?.facades??[]).reduce((n,f)=>n+f.bays,0),authoredPortalCount:plan.portals.length,exteriorWindows:sharedExteriorByWallSide,spacesWithAnyExteriorWindow:new Set(plan.portals.filter(p=>p.mode==='window'&&p.to==='exterior').map(p=>p.host.space)).size,interiorSpaces:indoor.length,interiorRoomsWithoutExteriorWindow:darkRooms,windowBaysFromComposition:(composed?.facades??[]).filter(f=>f.mode==='window').length},
  supportedByGeometry:(plan.composition?.facades.length??0)>0?true:null,rule:'Reports declared bays and window coverage only; proportion, rhythm quality and glazing ratio on elevations are not measured here.'},
 {claim:'privacy / separation of suites from social and service',declaredIn:quotes(/\b(privacy|private|separat\w*|quiet|discreet|service)\b/i),
  measured:{separateConstraints:(coord?.constraints??[]).filter((c:any)=>c.kind==='separate').map((c:any)=>({id:c.id,a:c.a,b:c.b,required:c.required,measured:c.measured,ok:c.ok})),adjoinConstraints:(coord?.constraints??[]).filter((c:any)=>c.kind==='adjoin').map((c:any)=>({id:c.id,a:c.a,b:c.b,required:c.required,measured:c.measured,ok:c.ok}))},
  supportedByGeometry:(coord?.constraints??[]).some((c:any)=>c.kind==='separate')?(coord.constraints.filter((c:any)=>c.kind==='separate').every((c:any)=>c.ok)):null,rule:'Only declared separate constraints are measurable; line-of-sight privacy is not.'},
];
const brief=readJson('brief.json')?.prompt as string|undefined;
const programmeVsBrief=brief?{
 suitesRequested:'approximately six',bedroomLikeSpaces:bedrooms.map(s=>({id:s.id,use:s.use,areaM2:f2(s.width*s.depth),level:s.level})),bedroomCount:bedrooms.length,
 bathroomLikeSpaces:plan.spaces.filter(s=>/\bbath|ensuite|wc|powder|dressing/i.test(`${s.id} ${s.use}`)).length,
 poolRectangular:plan.pools.length>0,poolCount:plan.pools.length,shadedTerraces:shading.filter(s=>s.shaded&&/terrace|deck|veranda|loggia|lanai/i.test(`${s.id} ${s.use}`)).length,
 levels:plan.levels.length,infinityEdgeMentionedInLimitationsOrThesis:/infinity/i.test(plan.thesis+proposed.limitations.join(' ')),
 unsupportedDeclaredByModel:proposed.limitations}:null;
let compiledReview:any=null;
if(compileOk&&built){try{const cr=conceptReview(brief??'',plan,built);compiledReview={commission:cr.commission,composition:cr.composition,fidelity:cr.fidelity,findings:cr.findings.map(f=>f.message),limits:cr.limits};}catch(e){compiledReview={threw:String(e)};}}
out('concept-review.json',{
 basis:compileOk?'Compiled scene available: existing conceptReview() plus plan-level measurements.':'Plan did not compile: measurements below are taken from the model-authored arrangement (resolved by the layout resolver) only. No built geometry exists to confirm them.',
 thesis:plan.thesis,claims,
 repeatedModules:{compositionOfRepeated:comp.repeated,distinctFootprints:comp.distinctFootprints,indoorRooms:comp.indoorRooms,bedroomFootprints:bedSig,mirrorShare:comp.mirrorShare,mirrorAxis:comp.mirrorAxis,footprintFill:comp.footprintFill,bilateral:comp.bilateral.length,spine:comp.spine},
 massing:{levels:plan.levels.length,roofForms:comp.roofForms,volumes,wingEnvelopes:comp.wings},
 programmeVsBrief,existingConceptReview:compiledReview,
 notMeasurable:['proportion and silhouette','material richness, colour harmony and luxury character','whether an entrance reads as dramatic rather than merely roofed','facade depth and rhythm quality on real elevations','view orientation to the sea (the contract has no water-edge geometry)','originality'],
 note:'Each claim reports quotes from the model\'s own text, measured facts, and a heuristic yes/no only where a threshold is stated. Nothing is scored.'});


// ───────────── Stage A findings (objective only): retrieval, omissions, conflicts, strategy use ─────────────
{
 const a=readJson('stage-a-input.json');
 if(a){
  const sel:any[]=a.knowledge.selectedRecords,ex:any[]=a.knowledge.metrics.excludedByBudget??[],lowest=Math.min(...sel.map(r=>Number(r.score)));
  const sys=existsSync(`${dir}/system-prompt.txt`)?readFileSync(`${dir}/system-prompt.txt`,'utf8'):'';
  const recordText=(id:string)=>sys.split('\n').find(l=>l.startsWith(`{"id":"${id}"`))??'';
  const grams=(t:string)=>{const w=t.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(Boolean);return new Set(w.slice(0,-2).map((_,i)=>w.slice(i,i+3).join(' ')));};
  const planText=[plan.thesis,...plan.masses.map(m=>m.role),...(plan.constraints??[]).map(c=>c.reason),...proposed.limitations].join(' ');
  const pg=grams(planText);
  const strategies=sel.filter(r=>/^strategy-|^estate-composition$/.test(r.id)).map(r=>{const t=recordText(r.id),g=grams(t),shared=[...g].filter(x=>pg.has(x));return {id:r.id,score:r.score,reasons:r.reasons,recordChars:t.length,sharedThreeWordPhrasesWithPlanProse:shared.length,examples:shared.slice(0,8)};});
  out('stage-a-findings.json',{
   basis:'Objective comparisons of the frozen retrieval trace and the brief. No claim is made about hidden model reasoning.',
   retrieval:{eligible:a.knowledge.metrics.approvedActive,selected:sel.length,budgetChars:a.knowledge.budget.chars,tier:a.knowledge.budget.tier,excludedForBudget:ex.length,lowestSelectedScore:lowest,
    excludedForBudgetScoringAboveLowestSelected:ex.filter(e=>Number(e.score)>lowest).map(e=>`${e.id} (${e.category}, ${e.score})`)},
   strategiesSelected:strategies,
   strategyNotSelectedButHighlyRelevantByName:ex.filter(e=>/strategy-/.test(e.id)).map(e=>`${e.id} (${e.score}) excluded for budget`),
   conflicts:[
    ...(sel.some(r=>r.id==='infinity-pool')&&/infinity/i.test(a.brief)?[{kind:'knowledge-vs-brief',detail:'infinity-pool (score 19) was selected although the brief says an infinity-edge amenity is unsupported and must not be claimed; the matching limit record pool-infinity-limit '+(ex.some((e:any)=>e.id==='pool-infinity-limit')?'WAS excluded for budget (score '+ex.find((e:any)=>e.id==='pool-infinity-limit').score+')':'was not excluded')+'.'}]:[]),
    ...(sel.some(r=>/^legacy-recipe-/.test(r.id))?[{kind:'legacy-content',detail:'A legacy recipe record ('+sel.find(r=>/^legacy-recipe-/.test(r.id)).id+') is in the selected set for a canonical request; its text may use retired operations language (canonical filter removed 0 retired sentences).'}]:[])],
   unsupportedRequirementsInBriefThatAreDeterminable:['infinity edge (brief itself excludes)','terrain/grading/planting (brief excludes)','sea/water-edge geometry (contract has none: ocean is conceptual)'],
   precedenceNote:'CONTRACT PRECEDENCE paragraph follows the knowledge block (see system-prompt.txt).'
  });
 }
}
// ───────────── Diagnostic drawings (labelled; never presented as a compiled building) ─────────────
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
const placed=placePortals({spaces:plan.spaces,portals:plan.portals,stairs:plan.stairs},Object.fromEntries(rects));
const collisions=volumeCollisions(plan,rects,tops);
const label=compileOk?'DIAGNOSTIC PLAN from model-authored arrangement (plan compiled; see scene for built geometry)':'DIAGNOSTIC PLAN of the model-authored arrangement — THIS PLAN DID NOT COMPILE; no building was constructed';
const drawings:string[]=[];
for(const level of plan.levels){
 const spacesHere=plan.spaces.filter(s=>s.level===level.id&&rects.has(s.id));
 const siteHere=[...plan.pools.filter(p=>p.level===level.id),...(level.above===null?plan.landscape:[])].filter(i=>site.rects.has(i.id));
 const all=[...spacesHere.map(s=>rects.get(s.id)!),...siteHere.map(i=>site.rects.get(i.id)!)];if(!all.length)continue;
 const live=plan.spaces.filter(s=>rects.has(s.id)),lx=live.flatMap(s=>[rects.get(s.id)!.x,rects.get(s.id)!.x+rects.get(s.id)!.width]),lz=live.flatMap(s=>[rects.get(s.id)!.z,rects.get(s.id)!.z+rects.get(s.id)!.depth]);
 const cx=(Math.min(...lx)+Math.max(...lx))/2,cz=(Math.min(...lz)+Math.max(...lz))/2,c=Math.cos(plan.orientation),s=Math.sin(plan.orientation);
 const corner=(wx:number,wz:number)=>[cx+c*wx-s*wz,cz+s*wx+c*wz] as const;
 const siteCorners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>corner(a*plan.site.width/2,b*plan.site.depth/2));
 const xs=[...all.flatMap(r=>[r.x,r.x+r.width]),...siteCorners.map(p=>p[0])],zs=[...all.flatMap(r=>[r.z,r.z+r.depth]),...siteCorners.map(p=>p[1])];
 const S=9,pad=34,head=60,foot=70,x0=Math.min(...xs)-2,z1=Math.max(...zs)+2,W=Math.round((Math.max(...xs)+2-x0)*S+2*pad),H=Math.round((z1-(Math.min(...zs)-2))*S+head+foot);
 const X=(x:number)=>f2(pad+(x-x0)*S),Y=(z:number)=>f2(head+(z1-z)*S);
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica,Arial,sans-serif"><rect width="${W}" height="${H}" fill="#fff"/><rect width="${W}" height="26" fill="${compileOk?'#2b5':'#b00020'}"/><text x="8" y="18" font-size="12" font-weight="bold" fill="#fff">${esc(label)}</text>`;
 svg+=`<text x="${pad}" y="44" font-size="11" font-weight="bold">${esc(plan.id)} — level ${esc(level.id)} (top ${f2(tops.get(level.id)!)} m)</text>`;
 svg+=`<polygon points="${siteCorners.map(p=>`${X(p[0])},${Y(p[1])}`).join(' ')}" fill="none" stroke="#999" stroke-dasharray="6 4"/><text x="${X(siteCorners[0][0])}" y="${Number(Y(siteCorners[0][1]))+12}" font-size="9" fill="#777">site ${plan.site.width}×${plan.site.depth} m (centred on rooms, yaw ${f2(plan.orientation)} rad)</text>`;
 for(const i of siteHere){const r=site.rects.get(i.id)!,pool='waterDepth' in i;svg+=`<rect x="${X(r.x)}" y="${Y(r.z+r.depth)}" width="${f2(r.width*S)}" height="${f2(r.depth*S)}" fill="${pool?'#bfe0ee':'#e3efd6'}" stroke="#7a9" stroke-dasharray="3 2"/><text x="${Number(X(r.x))+3}" y="${Number(Y(r.z+r.depth))+11}" font-size="8.5" fill="#365">${esc(i.id)}</text>`;}
 for(const sp of spacesHere){const r=rects.get(sp.id)!;svg+=`<rect x="${X(r.x)}" y="${Y(r.z+r.depth)}" width="${f2(r.width*S)}" height="${f2(r.depth*S)}" fill="${sp.outdoor?'#f2f6ee':'#f1ead8'}" fill-opacity=".85" stroke="#333" stroke-width="1.2" ${sp.outdoor?'stroke-dasharray="5 3"':''}/><text x="${Number(X(r.x))+3}" y="${Number(Y(r.z+r.depth))+11}" font-size="8.5" font-weight="bold">${esc(sp.id)}</text><text x="${Number(X(r.x))+3}" y="${Number(Y(r.z+r.depth))+21}" font-size="7.5" fill="#555">${esc(sp.mass)} · ${f2(r.width)}×${f2(r.depth)}${roofBySpace.has(sp.id)?` · ${roofBySpace.get(sp.id)!.form}`:''}</text>`;}
 for(const col of collisions.filter(k=>plan.spaces.find(x=>x.id===k.a)?.level===level.id)){const r=col.overlap;svg+=`<rect x="${X(r.x)}" y="${Y(r.z+r.depth)}" width="${f2(r.width*S)}" height="${f2(r.depth*S)}" fill="#e00" fill-opacity=".55" stroke="#900"/><text x="${Number(X(r.x))}" y="${Number(Y(r.z))+10}" font-size="8" fill="#900" font-weight="bold">overlap ${f2(r.width)}×${f2(r.depth)} (${esc(col.a)} / ${esc(col.b)})</text>`;}
 for(const p of plan.portals){const pl=placed.get(p.id),host=rects.get(p.host.space);if(!pl||pl.problem!==undefined||!host||plan.spaces.find(x=>x.id===p.host.space)?.level!==level.id)continue;const [px,pz]=pointOnEdge(host,pl.side,pl.centre);const col=p.mode==='door'?'#0a7a2f':p.mode==='open'?'#e08a00':'#2a62d9';svg+=`<circle cx="${X(px)}" cy="${Y(pz)}" r="${p.mode==='window'?2.2:3.4}" fill="${col}"/>`;}
 for(const st of plan.stairs){const r=rects.get(st.lower);if(r&&plan.spaces.find(x=>x.id===st.lower)?.level===level.id)svg+=`<rect x="${X(r.x+r.width/2-st.width/2)}" y="${Y(r.z+st.landing+.1+st.run)}" width="${f2(st.width*S)}" height="${f2(st.run*S)}" fill="none" stroke="#a0a" stroke-width="1.4"/><text x="${X(r.x+r.width/2)}" y="${Y(r.z+st.landing+.1+st.run/2)}" font-size="8" fill="#a0a" text-anchor="middle">stair</text>`;}
 const ar=rects.get(plan.arrival);if(ar&&plan.spaces.find(x=>x.id===plan.arrival)?.level===level.id)svg+=`<text x="${X(ar.x+ar.width/2)}" y="${Number(Y(ar.z+ar.depth/2))+5}" font-size="15" text-anchor="middle" fill="#c60">★</text>`;
 const missing=plan.spaces.filter(s=>s.level===level.id&&!rects.has(s.id)).map(s=>s.id);
 svg+=`<text x="${pad}" y="${H-46}" font-size="9">Legend: ● door  ● passage  ● window · red = overlapping volumes · purple = stair · ★ arrival · dashed = outdoor/site · 10 m bar below</text><line x1="${pad}" x2="${pad+10*S}" y1="${H-34}" y2="${H-34}" stroke="#222" stroke-width="2"/>`;
 svg+=`<text x="${pad}" y="${H-18}" font-size="9" fill="#555">${missing.length?`Unresolved rooms not drawn: ${esc(missing.join(', '))}. `:''}Positions from the production layout resolver on the unmodified plan. North = +Z up. Window/door dots use the production portal placer.</text></svg>`;
 const name=`floorplan-${level.id}.svg`;out(name,svg);drawings.push(name);
}
out('wings-composition.svg',renderConceptSvg(plan,{title:`${plan.id} — wing envelopes`,caption:compileOk?'WING/COMPOSITION DIAGRAM from authored placements (plan compiled).':'WING/COMPOSITION DIAGRAM from authored placements. THIS PLAN DID NOT COMPILE; no building was constructed.',showRooms:true}));
drawings.push('wings-composition.svg');
out('drawings-index.json',{drawings,label});
out('timeline.json',timeline);
console.log(JSON.stringify({proposalStatus:'proposed',diagnosticErrors:errors.length,groups:groups.size,compileOk,firstError:decisionsList[0]?.slice(0,200),drawings,costUsd:cost}));
