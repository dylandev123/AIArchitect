/** Offline demonstration of deterministic architectural coordination. No network, credentials, database or provider call.
 * Reads the retained Terra plans (never modified), runs developer-authored mocks through the real diagnosis and compiler,
 * and writes a measured inventory. Every mock is labelled. Exclusive writes: refuses to overwrite. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileArchitecturalPlan,type ArchitecturalPlan,type Rect} from '../src/lib/villa/canonical/plan';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
import {analysePlan} from '../src/lib/villa/canonical/revision/analysis';
import {renderPlanPng} from '../src/lib/villa/canonical/revision/planView';
import {placePortal,edgeExposure,SIDES} from '../src/lib/villa/canonical/coordination';
import {DesignConflict} from '../src/lib/villa/experimental/semantic-building/compiler';
import {originalMansion,rejectedRevision,connectionsAsRelationships,declareLandingConnections,waterfrontBase,waterfrontRevisionMock,waterfrontNaiveExplicitMock,REVISION_RECORD,ORIGINAL_MANSION} from '../src/lib/villa/canonical/coordination.fixture';
const dir='docs/architecture/canonical-coordination-2026-11-02';
if(existsSync(dir))throw Error(`${dir} exists; refusing to overwrite`);
mkdirSync(dir,{recursive:true});
const w=(n:string,v:unknown)=>writeFileSync(`${dir}/${n}`,typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v,null,2),{flag:'wx'});
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const errs=(p:ArchitecturalPlan)=>diagnosePlan(p).findings.filter(f=>f.severity==='error');
const byStage=(p:ArchitecturalPlan)=>Object.fromEntries(Object.entries(errs(p).reduce<Record<string,number>>((m,f)=>(m[f.stage]=(m[f.stage]??0)+1,m),{})));
const compileOutcome=(p:ArchitecturalPlan)=>{try{const c=compileArchitecturalPlan(p);return {compiled:true as const,elements:c.scene.elements.length,reachable:c.access.reachable.length};}catch(e){if(e instanceof DesignConflict)return {compiled:false as const,firstRejection:e.decisions[0]};throw e;}};
const retained={recordSha256:sha(readFileSync(REVISION_RECORD)),originalSha256:sha(readFileSync(ORIGINAL_MANSION))};

// 1. Terra's rejected revision: what the 87 findings are.
const revised=rejectedRevision(),original=originalMansion();
const a=analysePlan(revised,original),a0=analysePlan(original);
const rects=diagnosePlan(revised).rects as Record<string,Rect>;
const others=(id:string)=>revised.spaces.filter(s=>s.id!==id&&s.level===revised.spaces.find(x=>x.id===id)!.level&&rects[s.id]).map(s=>({id:s.id,rect:rects[s.id]}));
// For every window that faces another room: would host side "exposed" have been resolvable? For every undeclared connection: would "shared" resolve?
const windows=errs(revised).filter(f=>f.stage==='openings'&&/window faces/.test(f.message)).map(f=>{
 const p=revised.portals.find(x=>x.id===f.id)!,host=rects[p.host.space];
 const probe=placePortal({...p,host:{...p.host,side:'exposed'}},host,rects,others(p.host.space),()=>true);
 return {id:p.id,room:p.host.space,authoredSide:p.host.side,exposedResolves:probe.problem===undefined,derivedSide:probe.side,exposure:SIDES.map(s=>({side:s,...(({shared,free})=>({sharedWith:[...new Set(shared.map(x=>x.id))],exposed:free.map(r=>[Number(r.lo.toFixed(2)),Number(r.hi.toFixed(2))])}))(edgeExposure(host,s,others(p.host.space)))}))};
});
const unreachable=a.access.unreachable;
const landing=declareLandingConnections(connectionsAsRelationships(revised),'upper-landing',unreachable);
const aLanding=analysePlan(landing,revised);
const retainedErrors=87,nowErrors=errs(revised).length;
const res={
 note:'Offline. No provider, network, credential, database or commit. Retained Terra files read only.',retained,
 revision:{
  retainedFindingCount:retainedErrors,diagnosisNow:nowErrors,byStage:byStage(revised),
  removedAsNonConflicts:['central-gallery/owner-suite','entry-hall/upper-west-suite','east-private-hall/east-suite-3'],
  addedBecauseCompilerWouldReachThem:errs(revised).filter(f=>/stair flight/.test(f.message)).map(f=>({id:f.id,message:f.message})),
  decisions:a.decisions.map(d=>({id:d.id,kind:d.kind,title:d.title,findings:d.findings.length,portals:d.affects.portals,screens:d.affects.screens,roofs:d.affects.roofs,rooms:d.affects.rooms,introduced:d.introduced,softwareRole:d.softwareRole,modelDecides:d.modelDecides})),
  decisionCount:a.decisions.length,decisionsByKind:a.decisions.reduce<Record<string,{decisions:number;findings:number}>>((m,d)=>{const k=m[d.kind]??={decisions:0,findings:0};k.decisions++;k.findings+=d.findings.length;return m;},{}),
  windowsOnSharedWalls:windows,windowsDerivableWithExposed:windows.filter(x=>x.exposedResolves).length,windowsImpossibleOnAnyWall:windows.filter(x=>!x.exposedResolves).length,
  unreachableRooms:unreachable,
 },
 relationshipsOnly:{
  note:'Same plans with ONLY door/passage connections re-expressed as host side "shared" (host, target, mode, width, alignment unchanged), and, for the revision, the three missing landing connections declared.',
  originalMansion:{explicitOpeningErrors:errs(original).filter(f=>f.stage==='openings').length,afterSharedOpeningErrors:errs(connectionsAsRelationships(original)).filter(f=>f.stage==='openings').length,remaining:errs(connectionsAsRelationships(original)).filter(f=>f.stage==='openings').map(f=>({id:f.id,message:f.message})),totalBefore:errs(original).length,totalAfter:errs(connectionsAsRelationships(original)).length,doorsAndPassagesRelocatedByDerivation:original.portals.filter(p=>p.to!=='exterior'&&p.mode!=='window').length},
  rejectedRevision:{totalBefore:nowErrors,totalAfter:aLanding.errorCount,accessBefore:a.access.unreachable.length,accessAfter:aLanding.access.unreachable.length,decisionsAfter:aLanding.decisions.length,decisionKindsAfter:aLanding.decisions.reduce<Record<string,number>>((m,d)=>(m[d.kind]=(m[d.kind]??0)+d.findings.length,m),{}),
   hostCoordinatesNoLongerAuthored:revised.portals.filter(p=>p.to!=='exterior'&&p.mode!=='window').length,windowsStillTheModelsDecision:revised.portals.filter(p=>p.mode==='window').length},
 },
 compactMultilevel:(()=>{
  const base=waterfrontBase(),mock=waterfrontRevisionMock(),naive=waterfrontNaiveExplicitMock();
  return {note:'Developer composition fixture and developer-authored revision mock (ensuite + study upstairs, guest wing deepened). Not model output.',
   base:{errors:errs(base).length,...compileOutcome(base)},
   revisionMockAsRelationships:{errors:errs(mock).length,byStage:byStage(mock),...compileOutcome(mock),sharedOrExposedOpenings:mock.portals.filter(p=>p.host.side==='shared'||p.host.side==='exposed').length,totalOpenings:mock.portals.length,decisions:analysePlan(mock,base).decisions.length},
   sameIntentGuessedEdges:{errors:errs(naive).length,byStage:byStage(naive),findings:errs(naive).map(f=>({id:f.id,message:f.message})),...compileOutcome(naive)}};
 })(),
};
w('results.json',res);
const mock=waterfrontRevisionMock(),base=waterfrontBase();
w('plan-view.compact-multilevel.base.png',await renderPlanPng(base,undefined,{title:'Developer fixture: compact multilevel base',caption:'Developer fixture, not model output.'}));
w('plan-view.compact-multilevel.mock-revision.png',await renderPlanPng(mock,undefined,{title:'Developer mock revision: ensuite and study',caption:'Developer-authored mock. Connections and windows declared as relationships; openings drawn where software derived them.'}));
w('decisions.rejected-revision.json',a.decisions);
w('exposure.rejected-revision.json',a.exposure);
w('analysis.original-mansion.json',{errorCount:a0.errorCount,decisions:a0.decisions.map(d=>({id:d.id,kind:d.kind,title:d.title,findings:d.findings.length}))});
console.log(JSON.stringify({decisions:res.revision.decisionsByKind,diagnosisNow:nowErrors,rev:res.relationshipsOnly,mc:res.compactMultilevel.revisionMockAsRelationships},null,1));
