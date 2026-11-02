/** Experimental pre-construction design checkpoint. No provider, scene mutation or retry loop.
 * Diagnostics are advice; only full compilation + sampled physical evidence permits construction. */
import {semanticProposalSchema,constructSemantic,restoreSemantic,type SemanticSession} from './generation';
import {normalizeSemanticIdentifiers} from './identifiers';
import {pointIn,type BuildingIntent,type Point} from './compiler';
import {physicalEvidence} from './physical';

export type RevisionFinding={code:string;objects:string[];relationship:string;facts:Record<string,unknown>;decision:string;alternatives:string[];responsibility:'model'|'representation'|'contract'};
const groups=['levels','masses','spaces','portals','stairs'] as const;
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const edge=(s:BuildingIntent['spaces'][number],i:number):[Point,Point]|undefined=>i<s.polygon.length?[s.polygon[i],s.polygon[(i+1)%s.polygon.length]]:undefined;
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const overlaps=(a:Point[],b:Point[])=>[a,b].every(poly=>poly.every((p,i)=>{
 const q=poly[(i+1)%poly.length],project=(v:Point)=>v[0]*(q[1]-p[1])+v[1]*(p[0]-q[0]);
 const aa=a.map(project),bb=b.map(project);return Math.min(Math.max(...aa),Math.max(...bb))-Math.max(Math.min(...aa),Math.min(...bb))>1e-7;
}));
function inspect(response:unknown){
 const referenceErrors:string[]=[];
 // Diagnostic-only continuation: unresolved references remain unresolved, never become geometry.
 const normalized=normalizeSemanticIdentifiers(response,referenceErrors);
 const parsed=semanticProposalSchema.safeParse(normalized.response);
 if(!parsed.success)throw Error(parsed.error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('\n'));
 if(parsed.data.status!=='proposed')throw Error(parsed.data.decisions.join('\n'));
 return {proposal:parsed.data,referenceErrors,mappings:normalized.mappings};
}
export function reviewProposal(response:unknown){
 const findings:RevisionFinding[]=[];
 let inspected:ReturnType<typeof inspect>;
 try{inspected=inspect(response);}catch(e){return {findings:[{code:'input',objects:[],relationship:'schema / identity',facts:{message:(e as Error).message},decision:'Resolve input identity/schema before architectural review.',alternatives:[],responsibility:'contract' as const}],proposal:null};}
 const p=inspected.proposal.intent,spaces=new Map(p.spaces.map(s=>[s.id,s])),levels=new Map(p.levels.map(l=>[l.id,l.top]));
 const add=(code:string,objects:string[],relationship:string,facts:Record<string,unknown>,decision:string,alternatives:string[],responsibility:RevisionFinding['responsibility']='model')=>findings.push({code,objects,relationship,facts,decision,alternatives,responsibility});
 for(const message of inspected.referenceErrors)add('reference',[], 'typed reference',{message},'Select a declared entity of the correct type; no inferred substitution.', ['Revise the reference explicitly','Request a broader semantic representation change'],'contract');
 for(const m of p.masses)if(m.relatesTo&&!p.masses.some(x=>x.id===m.relatesTo)){
  const f=findings.find(f=>f.code==='reference'&&String(f.facts.message).includes(`reference ${m.relatesTo}.`));if(f)f.objects=[m.id,m.relatesTo];
 }
 for(let i=0;i<p.spaces.length;i++)for(let j=i+1;j<p.spaces.length;j++){
  const a=p.spaces[i],b=p.spaces[j],at=levels.get(a.level),bt=levels.get(b.level);if(at===undefined||bt===undefined)continue;
  if(overlaps(a.polygon,b.polygon)){
   if(Math.min(at+a.height,bt+b.height)>Math.max(at,bt)+1e-7)add('occupied-overlap',[a.id,b.id],'occupied envelopes',{a:[at,at+a.height],b:[bt,bt+b.height]},'Revise selected outlines or section.',['Move/resize named cells with their neighbours','Revise levels and dependent stairs']);
   for(const [lower,upper,lt,ut] of [[a,b,at,bt],[b,a,bt,at]] as const)if(lower.roof&&ut>lt&&ut<lt+lower.height+.3)add('roof-floor',[lower.id,upper.id,lower.level,upper.level],'lower roof / upper floor',{roof:[lt+lower.height,lt+lower.height+.18],floor:[ut-.2,ut],compilerClearance:.3},'Choose cover composition; compiler does not remove selected roofs.', ['Use upper floor as cover: explicitly remove lower roof','Revise upper footprint or level and dependent stair/section']);
  }
  if(a.level!==b.level)continue;
  a.polygon.forEach((v,k)=>b.polygon.forEach((w,l)=>{
   const v2=a.polygon[(k+1)%a.polygon.length],w2=b.polygon[(l+1)%b.polygon.length],len=distance(v,v2);
   if(Math.abs(cross(v,v2,w))>1e-7||Math.abs(cross(v,v2,w2))>1e-7||!len)return;
   const t=(q:Point)=>((q[0]-v[0])*(v2[0]-v[0])+(q[1]-v[1])*(v2[1]-v[1]))/len;
   const shared=Math.min(len,Math.max(t(w),t(w2)))-Math.max(0,Math.min(t(w),t(w2)));
   if(shared>1e-7&&!(distance(v,w2)<1e-7&&distance(v2,w)<1e-7))add('partial-edge',[a.id,b.id], 'shared boundary',{aEdge:k,bEdge:l,a:[v,v2],b:[w,w2],sharedLength:shared},'This physically possible partial adjacency is unsupported; select an explicit topology revision.', ['Revise named outlines to complete coincident edges','Escalate for boundary-segmentation support; do not add collinear vertices to strict-convex cells'],'representation');
  }));
 }
 for(const portal of p.portals){
  const host=spaces.get(portal.host.space),to=spaces.get(portal.to),e=host&&edge(host,portal.host.edge);
  if(!host||!to||!e){add('portal-host',[portal.id,portal.host.space,portal.to],'portal hosting',{},'Select an existing edge and target.',[]);continue;}
  const length=distance(...e),other=to.polygon.some((v,i)=>distance(v,e[1])<1e-7&&distance(to.polygon[(i+1)%to.polygon.length],e[0])<1e-7);
  if(!other||host.level!==to.level)add('portal-adjacency',[portal.id,host.id,to.id],'portal / target',{hostEdge:e,hostLevel:host.level,targetLevel:to.level},'Select a full shared same-level boundary.',['Coordinate both cell outlines','Choose another represented intermediary and revise the portal network']);
  const min=.18+portal.width/2,max=length-.18-portal.width/2,h=Math.max(...[host,to].filter(s=>!s.outdoor).map(s=>s.height));
  if(portal.offset<min||portal.offset>max||portal.height>h||portal.height<2.1||portal.width<.8)add('portal-fit',[portal.id,host.id,to.id],'hosted opening / edge margins',{offsetMetres:portal.offset,width:portal.width,height:portal.height,edge:e,edgeLength:length,allowedOffset:[min,max],wallHeight:h,units:'metres from selected host edge start'},'Select opening position/dimensions; 0.5 is not interpreted as a fraction.', ['Choose an offset within the stated interval','Revise opening dimensions or entire hosting boundary group'],'contract');
 }
 for(const st of p.stairs){
  const lower=spaces.get(st.lower),upper=spaces.get(st.upper);if(!lower||!upper)continue;
  const rise=(levels.get(upper.level)??NaN)-(levels.get(lower.level)??NaN),[x,z]=st.start;
  const footprint:Point[]=[[x-st.width/2-.1,z-st.landing],[x+st.width/2+.1,z-st.landing],[x+st.width/2+.1,z+st.run+st.landing],[x-st.width/2-.1,z+st.run+st.landing]];
  const fits=footprint.every(q=>pointIn(q,lower.polygon,.09)&&pointIn(q,upper.polygon,.09));
  if(st.run/st.risers<.25||rise/st.risers>.2||!fits||Math.abs(lower.height-rise)>1e-7||lower.roof||!upper.roof||upper.height-.18<st.headroom)add('stair-section',[st.id,lower.id,upper.id,lower.level,upper.level],'flight / landings / void / cover',{rise,riser:rise/st.risers,going:st.run/st.risers,minimumRun:st.risers*.25,minimumLength:st.risers*.25+2*st.landing+.18,selectedFootprint:footprint,fits,lowerHeight:lower.height,lowerRoof:!!lower.roof,upperRoof:!!upper.roof,upperClearance:upper.height-.18,requiredHeadroom:st.headroom},'Choose a complete supported flight and cell/landing arrangement.', ['Resize/reposition both stair cells, adjacent outlines and portals consistently','Revise level section with dependent envelopes and treads','Escalate if a turn-back or differently directed stair is required']);
 }
 const outcome=constructSemantic('Proposal review',response);
 if(outcome.status==='decision-required'){
  // The compiler remains authoritative. Preserve its first finding even when not covered above.
  add('construction',[], 'complete compiler transaction',{decisions:outcome.decisions},'Resolve all compiler conflicts before construction.',[]);
 }else{
  const evidence=physicalEvidence(outcome.session.compiled);
  if(evidence.failures.length)add('physical',[], 'sampled actual surfaces',{failures:evidence.failures,scope:evidence.scope},'Revise routes/clearance; graph connectivity alone is insufficient.', ['Move selected portals or revise the complete stair/circulation group']);
 }
 return {findings,proposal:inspected.proposal};
}

export type ProposalRevision={version:'proposal-revision-1';brief:string;original:unknown;scope:string[];attempts:{response:unknown;findings:RevisionFinding[];changed:string[]}[];status:'revisable'|'ready'|'escalation-required';session?:SemanticSession};
export const MAX_DESIGN_REVISIONS=2;
export function beginProposalRevision(brief:string,response:unknown,scope:string[]):ProposalRevision{
 const report=reviewProposal(response);if(!report.proposal)throw Error('Resolve malformed input before starting a design revision.');
 const ids=new Set(groups.flatMap(g=>report.proposal!.intent[g].map(x=>x.id)));
 if(!scope.length||scope.some(id=>!ids.has(id))||new Set(scope).size!==scope.length)throw Error('Select unique existing architectural IDs for the revision scope.');
 return {version:'proposal-revision-1',brief,original:structuredClone(response),scope:[...scope],attempts:[],status:'revisable'};
}
/** One explicit model response per call. Entire affected geometry group is derived atomically;
 * never apply only the edited portal/roof/stair component. No automatic model invocation. */
export function submitProposalRevision(state:ProposalRevision,response:unknown):ProposalRevision{
 if(state.status!=='revisable'||state.attempts.length>=MAX_DESIGN_REVISIONS)throw Error('Revision closed; explicit broader redesign required.');
 const baseline=inspect(state.original).proposal,next=reviewProposal(response),findings=[...next.findings],changed:string[]=[];
 const reject=(message:string)=>findings.push({code:'preservation',objects:[],relationship:'revision scope',facts:{message},decision:'Escalate scope explicitly; do not replace the concept silently.',alternatives:[],responsibility:'model'});
 if(next.proposal){
  const before=baseline.intent,after=next.proposal.intent;
  for(const key of ['version','id','thesis','frame','arrival','requiredAccess'] as const)if(!equal(before[key],after[key]))reject(`Preserved ${key} changed.`);
  if(!equal(baseline.limitations,next.proposal.limitations))reject('Original limitations must remain disclosed.');
  for(const g of groups){
   if(!equal(before[g].map(x=>x.id),after[g].map(x=>x.id)))reject(`${g}: topology identities/order changed; explicit migration required.`);
   for(const entity of before[g]){
    const n=after[g].find(x=>x.id===entity.id);if(equal(entity,n))continue;
    changed.push(entity.id);if(!state.scope.includes(entity.id))reject(`${entity.id}: outside selected scope.`);
    if(g==='masses'&&n&&(entity as BuildingIntent['masses'][number]).role!==(n as BuildingIntent['masses'][number]).role)reject(`${entity.id}: mass hierarchy/role changed; broader redesign required.`);
    if(g==='spaces'&&n){const a=entity as BuildingIntent['spaces'][number],b=n as typeof a;
     if(a.use!==b.use||a.mass!==b.mass||a.level!==b.level||a.outdoor!==b.outdoor||a.polygon.length!==b.polygon.length)reject(`${entity.id}: programme or topology changed; broader redesign required.`);
    }
   }
  }
 }
 let session:SemanticSession|undefined;
 if(!findings.length){const result=constructSemantic(state.brief,response);if(result.status==='ready')session=result.session;}
 const attempts=[...state.attempts,{response:structuredClone(response),findings,changed}];
 return {...structuredClone(state),attempts,status:session?'ready':(semanticProposalSchema.safeParse(response).data?.status==='decision-required'||attempts.length>=MAX_DESIGN_REVISIONS)?'escalation-required':'revisable',...(session?{session}:{})};
}
export function restoreProposalRevision(serialized:string):ProposalRevision{
 const raw=JSON.parse(serialized) as ProposalRevision;
 if(raw.version!=='proposal-revision-1'||!Array.isArray(raw.attempts)||raw.attempts.length>MAX_DESIGN_REVISIONS)throw Error('Invalid revision history.');
 let state=beginProposalRevision(raw.brief,raw.original,raw.scope);
 for(const attempt of raw.attempts)state=submitProposalRevision(state,attempt.response);
 if(raw.session){if(!state.session)throw Error('Invalid constructed revision.');const restored=restoreSemantic(JSON.stringify(raw.session));
  if(!equal(restored.proposal,state.session.proposal))throw Error('Session does not match accepted revision.');state.session=restored;
 }
 return state;
}

/** Reviewable request packet for a future explicitly invoked planner. It contains
 * complete dimensions and original preservation anchors, never generated scene edits. */
export function proposalRevisionRequest(state:ProposalRevision){
 if(state.status!=='revisable')throw Error('Revision closed.');
 const original=inspect(state.original).proposal;
 const latest=state.attempts.at(-1)?.response??state.original;
 const report=reviewProposal(latest);
 const p=original.intent;
 const selected=new Set(state.scope);
 const dependencies=p.spaces.filter(s=>selected.has(s.id)||selected.has(s.mass)||selected.has(s.level)).map(s=>s.id);
 for(const portal of p.portals)if(selected.has(portal.id))dependencies.push(portal.host.space,portal.to);
 for(const stair of p.stairs)if(selected.has(stair.id))dependencies.push(stair.lower,stair.upper);
 const cells=new Set(dependencies);
 const linkedPortals=p.portals.filter(x=>cells.has(x.host.space)||cells.has(x.to)).map(x=>x.id);
 const linkedStairs=p.stairs.filter(x=>cells.has(x.lower)||cells.has(x.upper)).map(x=>x.id);
 return {
  attempt:state.attempts.length+1,maximumAttempts:MAX_DESIGN_REVISIONS,brief:state.brief,
  originalResponse:structuredClone(state.original),latestResponse:structuredClone(latest),
  findings:state.attempts.at(-1)?.findings??report.findings,editableIds:[...state.scope],
  dependencyReview:{spaces:[...cells],portals:linkedPortals,stairs:linkedStairs,note:'Typed dependency neighbourhood, not permission to change locked objects. Full proposal compilation checks geometric neighbours, shared boundaries, covers and routes; generated components update together.'},
  preserved:{concept:p.thesis,frame:p.frame,arrival:p.arrival,requiredAccess:p.requiredAccess,
   entities:groups.flatMap(g=>p[g].filter(x=>!selected.has(x.id))),
   programme:p.spaces.map(s=>({id:s.id,mass:s.mass,level:s.level,use:s.use,outdoor:s.outdoor,vertices:s.polygon.length})),
   massRoles:p.masses.map(m=>({id:m.id,role:m.role})),limitations:original.limitations},
  instructions:'Return one complete semantic proposal using the existing schema. Make only explicit architectural choices in editableIds; coordinate their entire dependency group. Preserve identities, concept, programme, mass roles, frame, access obligations and limitations. Offsets are metres from the host edge start. Do not infer normalized offsets, bridge gaps or invent intent. If the supported straight stair, full-edge topology or preserved programme prevents a valid design, return decision-required with a broader redesign request. No scene geometry is committed until the entire revised proposal compiles and passes sampled physical checks. Alternatives in findings are options, never selected repairs.',
 };
}
