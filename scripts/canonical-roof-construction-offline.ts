/* eslint-disable @typescript-eslint/no-explicit-any -- offline measurement script; builder primitives are untyped records */
/** Offline measurement of what the 52 pitched-roof findings of Terra's retained revision physically are, and of the effect of building
 * fascia on exposed edges only. No network, credential, database or provider call. Retained files are read, never written.
 * The previous rule is reproduced here (bounding boxes expanded by overhang + 0.1 m on every side of a pitched roof) and must give 52. */
import {writeFileSync,mkdirSync,existsSync,readFileSync} from 'node:fs';
import {Vector3} from 'three';
import {rejectedRevision,originalMansion} from '../src/lib/villa/canonical/coordination.fixture';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
import {analysePlan} from '../src/lib/villa/canonical/revision/analysis';
import {exposedFascia,ELEMENT_EDGE,type Side} from '../src/lib/villa/canonical/coordination';
import {buildSceneRoof} from '../src/lib/villa/scene/roofs';
const dir='docs/architecture/canonical-roof-construction-2026-11-02';
if(existsSync(dir))throw Error(`${dir} exists; refusing to overwrite`);
mkdirSync(dir,{recursive:true});
const plan=rejectedRevision(),diag=diagnosePlan(plan),rects=diag.rects as Record<string,{x:number;z:number;width:number;depth:number}>;
const levelTop:Record<string,number>={};for(const l of plan.levels)levelTop[l.id]=(l.above===null?plan.site.elevation:levelTop[l.above])+l.rise;
const spaceOf=(id:string)=>plan.spaces.find(s=>s.id===id)!;
const height=(id:string)=>{const s=spaceOf(id);if(s.height!==undefined)return s.height;const up=plan.levels.find(l=>l.above===s.level);return up?up.rise:3;};
const roofOf=(id:string)=>plan.roofs.find(r=>r.space===id);
const pitched=(id:string)=>!!roofOf(id)&&roofOf(id)!.form!=='flat';
const base=(id:string)=>levelTop[spaceOf(id).level]+height(id);
const overlap=(a:any,b:any)=>{const w=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x),d=Math.min(a.z+a.depth,b.z+b.depth)-Math.max(a.z,b.z);return w>1e-6&&d>1e-6?{w,d}:null;};
// ---- the previous rule: one bounding box per roof, pitched roofs grown 0.1 m on all four sides
const old=plan.roofs.filter(r=>rects[r.space]).map(r=>{const p=r.form!=='flat',extra=(r.overhang??0)+(p?.1:0),rc=rects[r.space],rise=r.rise??.18;
 return {id:r.space,pitched:p,rect:{x:rc.x-extra,z:rc.z-extra,width:rc.width+2*extra,depth:rc.depth+2*extra},bottom:base(r.space)-(p?.28:0),top:base(r.space)+rise};});
const oldPairs:{kind:'roof-roof'|'roof-volume';a:string;b:string}[]=[];
for(let i=0;i<old.length;i++)for(let j=i+1;j<old.length;j++){const a=old[i],b=old[j];if(overlap(a.rect,b.rect)&&Math.min(a.top,b.top)-Math.max(a.bottom,b.bottom)>1e-6)oldPairs.push({kind:'roof-roof',a:a.id,b:b.id});}
for(const a of old)for(const o of plan.spaces.filter(s=>!s.outdoor&&s.id!==a.id&&rects[s.id])){const t=levelTop[o.level];if(overlap(a.rect,rects[o.id])&&Math.min(base(a.id)+(roofOf(a.id)!.rise??.18),t+height(o.id))-Math.max(a.bottom,t)>1e-6)oldPairs.push({kind:'roof-volume',a:a.id,b:o.id});}
// A flat roof over a partly covered room is built over its exposed remainder only, so these three whole-room findings were never conflicts (coordination report §1).
const knownNonConflicts=new Set(['roof-roof:east-private-hall/east-suite-3','roof-volume:entry-hall/upper-west-suite','roof-volume:central-gallery/owner-suite']);
for(let i=oldPairs.length-1;i>=0;i--)if(knownNonConflicts.has(`${oldPairs[i].kind}:${oldPairs[i].a}/${oldPairs[i].b}`))oldPairs.splice(i,1);
const partialSingle=plan.roofs.filter(r=>r.form!=='flat'&&/partly covered/.test(diag.findings.find(f=>f.id===r.space&&f.stage==='roofs')?.message??'')).length;
const oldCount=oldPairs.length+partialSingle;
if(oldCount!==52)throw Error(`previous rule must reproduce the retained 52 findings, got ${oldCount}`);
// ---- builder geometry
type P={id:string;kind:'box'|'tri';v:Vector3[];ax:Vector3[]};
function parts(space:string,fascia?:Side[]):P[]{
 const r=roofOf(space)!,rc=rects[space],b=base(space),rise=r.rise!,o=new Vector3(rc.x+rc.width/2,b+rise/2,rc.z+rc.depth/2),out:P[]=[];
 const el:any={id:space,kind:'roof',size:[rc.width,rise,rc.depth],roofForm:r.form,overhang:r.overhang??0,fascia:fascia?fascia.map(s=>ELEMENT_EDGE[s]):undefined};
 for(const part of buildSceneRoof(el,{color:'#fff',roughness:1,metalness:0} as any) as any[]){
  if(part.kind==='box'){const vs:Vector3[]=[];for(const x of[-1,1])for(const y of[-1,1])for(const z of[-1,1])vs.push(new Vector3(x*part.size[0]/2,y*part.size[1]/2,z*part.size[2]/2).add(new Vector3(...part.position)).add(o));out.push({id:part.id,kind:'box',v:vs,ax:[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)]});}
  else for(let i=0;i<part.vertices.length;i+=9){const v=[0,3,6].map(j=>new Vector3(part.vertices[i+j],part.vertices[i+j+1],part.vertices[i+j+2]).add(o));const e=v.map((a,j)=>v[(j+1)%3].clone().sub(a)),n=e[0].clone().cross(e[1]);out.push({id:part.id,kind:'tri',v,ax:[n,...e.map(x=>n.clone().cross(x))]});}
 }
 return out;
}
const boxOf=(rc:any,y0:number,y1:number,id:string):P=>({id,kind:'box',v:[rc.x,rc.x+rc.width].flatMap(X=>[y0,y1].flatMap(Y=>[rc.z,rc.z+rc.depth].map(Z=>new Vector3(X,Y,Z)))),ax:[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)]});
function depth(a:P,b:P){
 const edges=(q:P)=>q.kind==='box'?q.ax:[q.v[1].clone().sub(q.v[0]),q.v[2].clone().sub(q.v[1]),q.v[0].clone().sub(q.v[2])];
 const axes=[...a.ax,...b.ax,...edges(a).flatMap(x=>edges(b).map(y=>x.clone().cross(y)))];let m=Infinity;
 for(const ax of axes){if(ax.lengthSq()<1e-12)continue;const u=ax.clone().normalize(),pa=a.v.map(v=>v.dot(u)),pb=b.v.map(v=>v.dot(u));const a0=Math.min(...pa),a1=Math.max(...pa),b0=Math.min(...pb),b1=Math.max(...pb);let o=Math.min(a1,b1)-Math.max(a0,b0);if(a1-a0<1e-9)o=Math.min(a0-b0,b1-a0);else if(b1-b0<1e-9)o=Math.min(b0-a0,a1-b0);m=Math.min(m,o);if(m<=1e-6)return m;}
 return m;
}
const other=(id:string,fascia:(s:string)=>Side[]|undefined)=>pitched(id)?parts(id,fascia(id)):[boxOf(rects[id],base(id),base(id)+(roofOf(id)?.rise??.18),`${id}-flat-slab`)];
const hitsFor=(p:{kind:string;a:string;b:string},fascia:(s:string)=>Side[]|undefined)=>{
 const A=parts(p.a,fascia(p.a)),out:{a:string;b:string;depth:number}[]=[];
 const B=p.kind==='roof-roof'?other(p.b,fascia):[boxOf(rects[p.b],levelTop[spaceOf(p.b).level],levelTop[spaceOf(p.b).level]+height(p.b),`volume:${p.b}`)];
 for(const x of A)for(const y of B){const d=depth(x,y);if(d>1e-4)out.push({a:x.id.replace(`${p.a}-`,''),b:y.id.replace(`${p.b}-`,''),depth:+d.toFixed(3)});}
 return out;
};
const oldFascia=()=>undefined;
const neighbours=(id:string)=>plan.spaces.filter(s=>s.id!==id&&s.level===spaceOf(id).level&&rects[s.id]).map(s=>rects[s.id]);
const newFascia=(id:string)=>exposedFascia(roofOf(id)!.form as 'gable'|'hip',rects[id],neighbours(id));
const classify=(p:typeof oldPairs[number])=>{
 const hits=hitsFor(p,oldFascia),stacked=spaceOf(p.a).level!==spaceOf(p.b).level,overlapping=!!overlap(rects[p.a],rects[p.b])&&!stacked;
 const kind=overlapping?'rooms overlap (not a roof fault)':hits.length===0?'bounding box only: no roof part touches the other':hits.every(h=>/fascia/.test(h.a)||/fascia/.test(h.b))?'fascia board only (slopes and gable ends clear)':'roof surface penetrates';
 return {...p,class:kind,stackedLevels:stacked,physicalHits:hits};
};
const classified=oldPairs.map(classify);
const stackedHits=classified.filter(c=>c.stackedLevels&&c.physicalHits.some(h=>!/fascia/.test(h.a)));
const tally=classified.reduce<Record<string,number>>((m,c)=>(m[c.class]=(m[c.class]??0)+1,m),{});
// one relationship per unordered neighbouring pair / per roof
const pairKey=(p:{a:string;b:string})=>[p.a,p.b].sort().join('|');
const relationships=new Set(oldPairs.map(pairKey));
const roofsInvolved=new Set(oldPairs.flatMap(p=>[p.a,p.b].filter(pitched)));
// ---- the fix: boards withheld on shared edges, same plan, same builder
const newPairs=oldPairs.filter(p=>{const ex=new Set(diag.findings.filter(f=>f.stage==='roofs').map(f=>f.id));return ex.has(`${p.a}/${p.b}`);});
const afterHits=oldPairs.flatMap(p=>hitsFor(p,newFascia).map(h=>({roofA:p.a,roofB:p.b,partA:h.a,partB:h.b,depth:h.depth})));
const afterNonPartial=afterHits.filter(h=>spaceOf(h.roofA).level===spaceOf(h.roofB).level);
const dec=analysePlan(plan,originalMansion());
const prior=JSON.parse(readFileSync('docs/architecture/canonical-coordination-2026-11-02/results.json','utf8'));
const res={
 note:'Offline. No provider, network, credential, database or commit. Retained Terra files read only. Nothing in the plan was changed.',
 previousRule:{findings:oldCount,roofRoof:oldPairs.filter(p=>p.kind==='roof-roof').length,roofVolume:oldPairs.filter(p=>p.kind==='roof-volume').length,partlyCoveredPitched:partialSingle,reproducesRetained52:true},
 physicalClasses:tally,
 distinctNeighbourRelationships:relationships.size,distinctPitchedRoofsInvolved:roofsInvolved.size,pitchedRoofsInPlan:plan.roofs.filter(r=>r.form!=='flat').length,
 builderFacts:{fasciaThicknessM:0.1,fasciaDropM:0.28,boardsPerForm:{hip:4,gable:2},gableEndsCarryBoard:false,overhangInRetainedPlan:[...new Set(plan.roofs.map(r=>r.overhang??0))]},
 realSurfaceEvents:stackedHits.map(c=>({pair:`${c.a}/${c.b}`,hits:c.physicalHits.filter(h=>!/fascia/.test(h.a)).slice(0,3)})),
 classified:classified.map(c=>({kind:c.kind,pair:`${c.a}/${c.b}`,class:c.class,hits:c.physicalHits.map(h=>`${h.a}~${h.b}:${h.depth}`)})),
 afterFix:{findings:diag.findings.filter(f=>f.stage==='roofs'&&f.severity==='error').map(f=>({id:f.id,message:f.message})),totalErrors:diag.findings.filter(f=>f.severity==='error').length,
  samePlanSameLevelPenetrationsWithExposedBoardsOnly:afterNonPartial.length,penetrationsAcrossLevels:afterHits.filter(h=>spaceOf(h.roofA).level!==spaceOf(h.roofB).level).map(h=>`${h.roofA}/${h.roofB}: ${h.partA}~${h.partB} ${h.depth} m`).slice(0,6)},
 decisions:dec.decisions.map(d=>({kind:d.kind,title:d.title,findings:d.findings.length})),decisionCount:dec.decisions.length,errorCount:dec.errorCount,
 decisionsByKind:dec.decisions.reduce<Record<string,{decisions:number;findings:number}>>((m,d)=>{const k=m[d.kind]??={decisions:0,findings:0};k.decisions++;k.findings+=d.findings.length;return m;},{}),
 windowsOnSharedWalls:{derivableWithExposed:prior.revision.windowsDerivableWithExposed,impossibleOnAnyWall:prior.revision.windowsImpossibleOnAnyWall},
 unreachableRooms:dec.access.unreachable,
};
void newPairs;
writeFileSync(`${dir}/results.json`,JSON.stringify(res,null,2),{flag:'wx'});
console.log(JSON.stringify({previousRule:res.previousRule,physicalClasses:res.physicalClasses,distinctNeighbourRelationships:res.distinctNeighbourRelationships,distinctPitchedRoofsInvolved:res.distinctPitchedRoofsInvolved,realSurfaceEvents:res.realSurfaceEvents,afterFix:res.afterFix,decisionsByKind:res.decisionsByKind,decisionCount:res.decisionCount,errorCount:res.errorCount},null,1));
