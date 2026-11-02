/** Offline evidence for whole-building spatial coordination. Reads retained plans, never writes to them; no provider, database or network.
 * Every arrangement here is DEVELOPER-AUTHORED: it shows mechanics, never that a model designs better.
 *   npx vite-node --config vitest.config.mts scripts/canonical-coordination-offline.ts */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {compileArchitecturalPlan,type ArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
import {coordinatePlan} from '../src/lib/villa/canonical/spatial';
import {resolveLayout} from '../src/lib/villa/canonical/layout';
import {volumeCollisions,explainCollisions,compositionOf,renderConceptSvg} from '../src/lib/villa/canonical/arrangement';
import {compactFamilyHome,asymmetricMultilevel,courtyardHouse,luxuryEstate,sweepParti,SWEEP_SIDES,skeleton} from '../src/lib/villa/canonical/spatial.fixture';
import {spineParti} from '../src/lib/villa/canonical/arrangement.fixture';
import {analysePlan} from '../src/lib/villa/canonical/revision/analysis';
import {renderPlanPng} from '../src/lib/villa/canonical/revision/planView';
import {physicalEvidence} from '../src/lib/villa/experimental/semantic-building/physical';
import {DesignConflict} from '../src/lib/villa/experimental/semantic-building/compiler';
const OUT='docs/architecture/canonical-whole-building-2026-11-02';
mkdirSync(`${OUT}/diagrams`,{recursive:true});
const collisions=(p:ArchitecturalPlan)=>volumeCollisions(p,resolveLayout(p).rects);
const arrangements={'compact-family':compactFamilyHome,'asymmetric-multilevel':asymmetricMultilevel,'courtyard':courtyardHouse,'multi-wing-estate':luxuryEstate};
const rows:Record<string,unknown>[]=[];
for(const [name,make] of Object.entries(arrangements)){
 const plan=make(),c=coordinatePlan(plan),comp=compositionOf(plan),d=diagnosePlan(plan);
 let compiled='compiled',elements=0,failures=0;
 try{const r=compileArchitecturalPlan(plan);elements=r.scene.elements.length;failures=physicalEvidence(r).failures.length;}catch(e){compiled=e instanceof DesignConflict?e.decisions.join(' | '):String(e);}
 writeFileSync(`${OUT}/diagrams/${name}.svg`,renderConceptSvg(plan,{title:`${name} (developer fixture)`,showRooms:true,caption:'DEVELOPER FIXTURE. Wing envelopes (bold) and rooms from the single layout resolver. Not model output; not a quality rating. ★ arrival.'}));
 writeFileSync(`${OUT}/diagrams/${name}.plan.png`,(await renderPlanPng(plan,analysePlan(plan),{title:`${name} (developer fixture, not model output)`})).png);
 rows.push({arrangement:name,compiled,elements,physicalFailures:failures,diagnosedErrors:d.findings.filter(f=>f.severity==='error').length,coordinationOk:c.ok,
  wings:c.wings.map(w=>({id:w.id,placed:w.placed,rooms:w.rooms,levels:w.levels,envelope:`${w.envelope.width.toFixed(1)}×${w.envelope.depth.toFixed(1)}`,relation:w.relation})),
  levels:comp.levels,footprintFill:comp.footprintFill,mirrorShare:comp.mirrorShare,repeated:comp.repeated,distinctFootprints:comp.distinctFootprints,roofForms:comp.roofForms,
  constraints:c.constraints.map(x=>({id:x.id,kind:x.kind,required:x.required,measured:x.measured,ok:x.ok})),
  wingCirculation:c.circulation.wings.map(w=>({id:w.id,reachable:`${w.reachable}/${w.interiorRooms}`,adjoins:w.adjoins})),
  stacking:c.vertical.map(v=>`${v.space} ${Math.round(v.supportedFraction*100)}% supported`),site:c.site});
}
// Competing and impossible arrangements: every one is rejected or identified with its reason; none is repaired.
const reasons=(p:ArchitecturalPlan)=>{try{compileArchitecturalPlan(p);return ['ACCEPTED'];}catch(e){return e instanceof DesignConflict?e.decisions:[String(e)];}};
const cases:{case:string;kind:'competing'|'impossible';outcome:string[]}[]=[];
{const p=luxuryEstate();p.constraints![0].amount=40;cases.push({case:'privacy demand of 40 m between guest pavilion and owner wing (arrangement gives ~24 m)',kind:'competing',outcome:reasons(p)});}
{const p=luxuryEstate();p.constraints!.push({id:'touch',kind:'adjoin',a:'guest-pavilion',b:'owner-wing',amount:3,reason:'share a wall'});cases.push({case:'separate and adjoin declared on one pair',kind:'competing',outcome:reasons(p)});}
{const p=luxuryEstate();p.site={...p.site,width:62,depth:70};p.constraints![0].amount=34;const r=coordinatePlan(p).constraints.find(x=>x.id==='guests-private')!;cases.push({case:'34 m privacy on a 62×70 m site',kind:'competing',outcome:[`measured ${r.measured} m; ${r.options.length} single edit(s) meet it; creating: ${r.options.map(o=>`${o.node}.${o.field}→${o.to}: ${o.newErrors.join(',')||'nothing new'}`).join('; ')||'none'}`]});}
{const p=courtyardHouse();for(const id of ['west-bed-one','west-bed-two'])p.spaces.find(s=>s.id===id)!.depth=2;p.portals=p.portals.filter(x=>x.mode!=='window'&&x.id!=='west-bed-two-studio');cases.push({case:'court declared 90% enclosed but the west range is shortened',kind:'competing',outcome:reasons(p)});}
{const p=compactFamilyHome();p.masses.find(m=>m.id==='approach')!.placement={relativeTo:'terrace',side:'south',alignment:'start',gap:0};p.masses.find(m=>m.id==='terrace')!.placement={relativeTo:'approach',side:'east',alignment:'start',gap:0};cases.push({case:'two wings placed against each other',kind:'impossible',outcome:reasons(p)});}
{const p=compactFamilyHome();p.spaces.find(s=>s.id==='bed-two')!.placement={relativeTo:'kitchen',side:'north',alignment:'start',gap:0};cases.push({case:'a room of a placed wing anchored to a room of another wing',kind:'impossible',outcome:reasons(p)});}
{const p=compactFamilyHome();p.spaces.find(s=>s.id==='bed-one')!.placement={relativeTo:null,side:'origin',alignment:'centre',gap:0};cases.push({case:'a wing with two local origins',kind:'impossible',outcome:reasons(p)});}
{const p=compactFamilyHome();p.masses.find(m=>m.id==='sleeping')!.placement={relativeTo:'living',side:'same',alignment:'start',gap:0};cases.push({case:'a wing stacked over another on the same level',kind:'impossible',outcome:reasons(p)});}
{const p=skeleton({id:'corner',thesis:'x',site:[80,80],levels:[{id:'ground',above:null,rise:.2}],arrival:'core-a',doors:[],wings:[{id:'core',role:'core',rooms:[{id:'core-a',w:6,d:6}]},{id:'east-arm',role:'e',at:{to:'core',side:'east',al:'start'},rooms:[{id:'east-a',w:8,d:14}]},{id:'north-arm',role:'n',at:{to:'core',side:'north',al:'start'},rooms:[{id:'north-a',w:14,d:6}]}]});
 const c=coordinatePlan(p);cases.push({case:'two long wings on adjacent sides of one core (corner claim)',kind:'impossible',outcome:[...c.errors.map(e=>e.message),...c.openChoices.map(o=>`OPEN CHOICE: ${o.about}: ${o.options.join(' | ')}`)]});}
// Collision-class sweeps (stress ranges, not base rates for any model).
const sweep=(label:string,sides:readonly (typeof SWEEP_SIDES)[number][],from:number,n:number)=>{
 let roomForm=0,wingForm=0,corner=0,other=0,roomCollisions=0,wingCollisions=0;
 for(let i=0;i<n;i++){
  const r=sweepParti(from+i,'rooms',sides),w=sweepParti(from+i,'wings',sides),cr=collisions(r),cw=collisions(w);
  if(cr.length)roomForm++;if(cw.length)wingForm++;roomCollisions+=cr.length;wingCollisions+=cw.length;
  for(const d of explainCollisions(w,0)){if(d.cause==='adjacent-overhang'&&d.heads.every(h=>h&&w.masses.some(m=>m.id===h)))corner++;else other++;}
 }
 return {sweep:label,samples:n,arrangementsColliding:{roomPlacement:roomForm,wingPlacement:wingForm},collisionCount:{roomPlacement:roomCollisions,wingPlacement:wingCollisions},remainingWingCollisionsByClass:{wingCornerClaim:corner,anythingElse:other}};
};
const sweeps=[sweep('wings on opposite sides only (east+west)',['east','west'],7000,1000),sweep('wings on opposite sides only (north+south)',['north','south'],8000,1000),sweep('wings on all four sides',SWEEP_SIDES,9000,2000)];
let spineCollided=0;
{const rnd=(()=>{let s=20261102;return ()=>((s=(s*1664525+1013904223)>>>0)/2**32);})();
 for(let i=0;i<2000;i++){
  const pick=(a:number,b:number)=>Math.round((a+rnd()*(b-a))*2)/2,gal=[pick(6,12),pick(6,14)],sal=[pick(10,22),pick(8,14)],hall=[pick(3,5),pick(12,26)],suite=[pick(6,12),pick(4,7)];
  const wr=(side:'east'|'west')=>[{id:`${side}-hall`,w:hall[0],d:hall[1]},...(['start','centre','end'] as const).map(al=>({id:`${side}-suite-${al}`,w:suite[0],d:suite[1],at:{to:`${side}-hall`,side,al}}))];
  const p=skeleton({id:'spine-wings',thesis:'x',site:[600,600],levels:[{id:'ground',above:null,rise:.2}],arrival:'entry',doors:[],wings:[{id:'social',role:'spine',rooms:[{id:'entry',w:10,d:8},{id:'gallery',w:gal[0],d:gal[1],at:{to:'entry',side:'south'}},{id:'salon',w:sal[0],d:sal[1],at:{to:'gallery',side:'south'}}]},{id:'east-wing',role:'e',at:{to:'social',side:'east',al:'start'},rooms:wr('east')},{id:'west-wing',role:'w',at:{to:'social',side:'west',al:'start'},rooms:wr('west')}]});
  if(collisions(p).some(c=>p.spaces.find(s=>s.id===c.a)!.mass!==p.spaces.find(s=>s.id===c.b)!.mass))spineCollided++;
 }}
let roomSpine=0;
{const rnd=(()=>{let s=20261102;return ()=>((s=(s*1664525+1013904223)>>>0)/2**32);})();
 for(let i=0;i<2000;i++){const pick=(a:number,b:number)=>Math.round((a+rnd()*(b-a))*2)/2;const sizes={gallery:[pick(6,12),pick(6,14)] as [number,number],salon:[pick(10,22),pick(8,14)] as [number,number],hall:[pick(3,5),pick(12,26)] as [number,number],suite:[pick(6,12),pick(4,7)] as [number,number]};if(collisions(spineParti(sizes).roomAnchored).length)roomSpine++;}}
// Retained model proposals, read-only: how the coordination report describes what Terra actually authored.
const retained=['docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json','docs/architecture/canonical-plan-revision-2026-11-02/revision-record.json','docs/architecture/canonical-redesign-revision-2026-11-02/revision-record.json'].map(f=>{
 const j=JSON.parse(readFileSync(f,'utf8')),plan=(j.revised?.plan??j.plan??j) as ArchitecturalPlan,c=coordinatePlan(plan),comp=compositionOf(plan);
 const byCause:Record<string,number>={};c.collisions.forEach(d=>byCause[d.cause]=(byCause[d.cause]??0)+1);
 return {file:f,spaces:plan.spaces.length,wingsDeclared:plan.masses.length,wingPlacementsUsed:plan.masses.filter(m=>m.placement).length,collisions:c.collisions.length,byCause,singleEditOptionsAvailable:c.collisions.filter(d=>d.options.length).length,
  spineDependants:comp.spine,mirrorShare:comp.mirrorShare,repeatedCells:comp.repeated,maxChainDepth:comp.maxChainDepth,levels:comp.levels,roofForms:comp.roofForms,openChoices:c.openChoices.length};
});
const evidence={generated:'offline, no provider/database/network',arrangements:rows,cases,sweeps,spineParti:{samples:2000,roomAnchoredCollidingArrangements:roomSpine,wingPlacedCrossWingCollidingArrangements:spineCollided},retainedModelProposals:retained};
writeFileSync(`${OUT}/evidence.json`,JSON.stringify(evidence,null,1));
console.log(JSON.stringify({arrangements:rows.map(r=>({a:r.arrangement,compiled:r.compiled,el:r.elements,phys:r.physicalFailures,diag:r.diagnosedErrors,ok:r.coordinationOk})),cases:cases.map(c=>({k:c.kind,c:c.case,o:c.outcome[0].slice(0,140)})),sweeps,spine:evidence.spineParti,retained},null,1));
