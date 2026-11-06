/** One coordinated verification of the corrections to the seven root causes found by the instrumented live experiment
 * (docs/architecture/e2e-generation-diagnostic-2026-11-03). Every proposal is the retained Terra plan read unmodified or a
 * developer-authored fixture: this is evidence of software capability, not of better model creativity. No model call, no network. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {architecturalPlanSchema,compileArchitecturalPlan,PlanRejection,COMPILE_PHASES,CANONICAL_INSTRUCTIONS,type ArchitecturalPlan,type Rect} from './plan';
import {diagnosePlan} from './diagnose';
import {coordinatePlan,extentDrivers} from './spatial';
import {reviewCorrections,verifyCorrection,baselineOf} from './corrections';
import {resolveLayout} from './layout';
import {placePortals,WALL} from './coordination';
import {rejectedGeneration,REJECTION_LIMITS} from './rejection';
import {programmeReview} from './programmeReview';
import {planConceptReview} from './concept';
import {expandComposition} from './composition';
import {DesignConflict} from '../experimental/semantic-building/compiler';
import {canonicalFixture} from './fixture';
import {compositionFixture} from './compositions.fixture';
import {strategyFixture,type StrategyFixture} from './strategies.fixture';
import {compositionFirstFixture} from './compositionFirst.fixture';
import {luxuryEstate,compactFamilyHome,asymmetricMultilevel,courtyardHouse} from './spatial.fixture';
import {retainedMansion,retainedBrief,retainedLimitations,terracedPavilion,adjacencyTrio} from './consolidated.fixture';
import {validateScene,stageSceneOperations} from '../scene/model';
import {useProjectStore} from '@/store/useProjectStore';

afterEach(()=>vi.unstubAllGlobals());
const errors=(p:ArchitecturalPlan,stage?:string)=>diagnosePlan(p).findings.filter(f=>f.severity==='error'&&(!stage||f.stage===stage));
const rects=(p:ArchitecturalPlan)=>diagnosePlan(p).rects as Record<string,Rect>;
const decisions=(p:ArchitecturalPlan)=>{try{compileArchitecturalPlan(p);return [] as string[];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};
const STRATEGIES:StrategyFixture[]=['waterfront-pavilion','tropical-pavilion-court','courtyard-residence','stepped-multilevel','compact-two-volume'];
/** The varied offline buildings the brief asked for. */
const BUILDINGS:[string,()=>ArchitecturalPlan][]=[
 ['compact residence',compactFamilyHome],['multilevel residence',asymmetricMultilevel],['courtyard residence',courtyardHouse],['multi-wing luxury estate',luxuryEstate],
 ['composition with multi-room roof spans and facade rhythms',()=>compositionFixture('waterfront')],
 ...STRATEGIES.map(s=>[`strategy fixture ${s}`,()=>strategyFixture(s)] as [string,()=>ArchitecturalPlan]),
 ['composition-first hillcrest',()=>compositionFirstFixture('hillcrest')],['composition-first pavilion court',()=>compositionFirstFixture('pavilion-court')],
];

describe('RC1: wings and attached spaces',()=>{
 it('the retained mansion: the wing extent is inflated by the terrace (west) and the service rooms (east), and the cause is named',()=>{
  const c=coordinatePlan(retainedMansion()),core=c.wings.find(w=>w.id==='core-pavilion')!;
  expect(core.extentDrivers).toEqual(expect.arrayContaining([{side:'west',spaces:['waterfront-terrace'],beyondBy:3,outdoor:true},{side:'east',spaces:['pantry','powder-room'],beyondBy:3,outdoor:false}]));
  expect(core.attached).toEqual([]);
  expect(core.placementEnvelope).toEqual(core.envelope); // nothing declared, so nothing is excluded: the plan means what it says
  const west=c.constraints.find(k=>k.id==='west-wing-pavilion-adjoin')!;
  expect(west.ok).toBe(false);expect(west.measured).toBe(0);
 });
 it('a declaration moves nothing silently: software only OFFERS `attached`, and the retained plan is never edited',()=>{
  const plan=retainedMansion(),before=JSON.stringify(plan);
  const west=coordinatePlan(plan).constraints.find(k=>k.id==='west-wing-pavilion-adjoin')!;
  expect(west.options.map(o=>o.edits.map(e=>`${e.node}.${e.field}=${e.to}`).join('+'))).toContain('waterfront-terrace.attached=true');
  expect(west.options.every(o=>o.status==='candidate')).toBe(true);
  expect(JSON.stringify(plan)).toBe(before);
 });
 it('declared attached, the terrace stays in its wing, the suite wing meets the salon, and the small estate compiles',()=>{
  const without=terracedPavilion(false),withIt=terracedPavilion(true);
  expect(coordinatePlan(without).constraints[0]).toMatchObject({ok:false,measured:0});
  expect(decisions(without).join('\n')).toMatch(/suites-meet-salon[\s\S]*salon-suite-hall: salon and suite-hall share no wall/);
  const c=coordinatePlan(withIt);
  expect(c.constraints[0]).toMatchObject({ok:true});expect(c.ok).toBe(true);
  const pav=c.wings.find(w=>w.id==='pavilion')!;
  expect(pav.attached).toEqual(['terrace']);
  expect(pav.envelope.width).toBe(14);expect(pav.placementEnvelope.width).toBe(8); // every room still counts for the wing's own extent; the placement uses the enclosed rooms
  expect(errors(withIt)).toEqual([]);
  const compiled=compileArchitecturalPlan(withIt);
  expect(compiled.scene.elements.some(e=>/terrace/.test(e.id))).toBe(true);
 });
 it('attached rooms stay rigid with their wing: the terrace is exactly where its salon puts it, whatever the suite wing does',()=>{
  const a=rects(terracedPavilion(true)),b=rects(terracedPavilion(false));
  expect(a.terrace.x-a.salon.x).toBe(b.terrace.x-b.salon.x);expect(a.terrace.z-a.salon.z).toBe(b.terrace.z-b.salon.z);
 });
 it('a rotated building resolves the same plan-frame arrangement and compiles',()=>{
  const flat=rects(terracedPavilion(true,0)),turned=rects(terracedPavilion(true,.6));
  expect(turned).toEqual(flat);
  expect(()=>compileArchitecturalPlan(terracedPavilion(true,.6))).not.toThrow();
 });
 it('a wing whose every room is attached keeps every room, so its extent is never empty',()=>{
  const p=terracedPavilion(true);for(const s of p.spaces.filter(s=>s.mass==='pavilion'))s.attached=true;
  const frames=resolveLayout(p);expect(frames.problems).toEqual([]);
  expect(frames.rects.get('salon')).toBeDefined();
 });
 it('plans that declare nothing are unchanged by the feature: every wing extent equals its placement extent on every offline building',()=>{
  for(const [name,make] of BUILDINGS){
   const c=coordinatePlan(make());
   for(const w of c.wings)expect(w.placementEnvelope,`${name}/${w.id}`).toEqual(w.envelope);
  }
 });
 it('the drivers of an extent are measured, not guessed: a wing without a projecting room has none',()=>{
  const p=compactFamilyHome(),w={plan:p,rects:resolveLayout(p).rects};
  for(const m of p.masses)for(const d of extentDrivers(w,m.id))expect(d.beyondBy).toBeGreaterThan(0);
  expect(extentDrivers(w,'no-such-wing')).toEqual([]);
 });
 it('adjoin counts interior rooms only: contact through an outdoor space is not a connection',()=>{
  const p=terracedPavilion(false);
  // Park the suite wing against the terrace only: its hall touches the outdoor terrace but no salon wall.
  const c=coordinatePlan(p);expect(c.constraints[0].measured).toBe(0);
  const viaTerrace=structuredClone(p);viaTerrace.constraints=[{id:'hall-meets-terrace',kind:'adjoin',a:'suite-hall',b:'terrace',amount:1,reason:'a terrace is a single outdoor space named directly'}];
  expect(coordinatePlan(viaTerrace).constraints[0].measured).toBeGreaterThan(0); // a single named outdoor space still measures its own contact
 });
});

describe('RC2: correction offers are verified, not assumed',()=>{
 it('the retained "centre→end" offer, which met `adjoin` through the outdoor terrace, is no longer offered and is classified as introducing a conflict',()=>{
  const plan=retainedMansion();
  const offered=coordinatePlan(plan).constraints.flatMap(c=>c.options).flatMap(o=>o.edits.map(e=>`${e.node}.${e.field}=${e.to}`));
  expect(offered).not.toContain('west-suite-wing.alignment=end');
  const old=verifyCorrection(plan,[{node:'west-suite-wing',field:'alignment',from:'centre',to:'end'}],['arr:constraint:west-wing-pavilion-adjoin'],'the earlier offer');
  expect(old.status).toBe('introduces-conflicts');
  expect(old.newFindings).toContain('diag:screens:terrace-west-screen');
  expect(old.checks.find(c=>c.name==='compilation')).toMatchObject({ran:true,passed:false});
 });
 it('on the retained mansion no offer is claimed verified, none is applied, and each says what it could not establish',()=>{
  const plan=retainedMansion(),r=reviewCorrections(plan);
  expect(r.baseline).toMatchObject({compiles:false,compilationStage:'derive'});
  expect(r.byStatus.verified).toBe(0);
  expect(r.corrections.every(c=>c.neverApplied)).toBe(true);
  const attach=r.corrections.find(c=>c.edits.length===1&&c.edits[0].node==='waterfront-terrace'&&c.edits[0].field==='attached')!;
  expect(attach.status).toBe('unverified');
  expect(attach.resolved).toContain('arr:constraint:west-wing-pavilion-adjoin');
  expect(attach.alsoResolved).toContain('diag:openings:living-to-west-gallery'); // one cause, two findings
  expect(attach.statusReason).toMatch(/does not compile for reasons this edit does not address|downstream/);
  expect(attach.compilationBlockers.join('\n')).toMatch(/dining-to-terrace|dining-to-east-gallery/);
  // The attach-everything option collides with the east gallery and is classified accordingly.
  expect(r.corrections.find(c=>c.edits.length===3)!.status).toBe('introduces-conflicts');
  expect(r.noOffer).toEqual(expect.arrayContaining(['diag:openings:dining-to-terrace','diag:openings:dining-to-east-gallery']));
  expect(JSON.stringify(plan)).toBe(JSON.stringify(retainedMansion()));
 });
 it('verified: the same declaration on the small estate clears the target, adds nothing, loses no connection and compiles',()=>{
  const r=reviewCorrections(terracedPavilion(false));
  expect(r.baseline.compiles).toBe(false);
  const ok=r.corrections.find(c=>c.edits.length===1&&c.edits[0].field==='attached')!;
  expect(ok.status).toBe('verified');
  expect(ok.checks.map(c=>[c.name,c.ran,c.passed])).toEqual([['arrangement',true,true],['diagnosis',true,true],['compilation',true,true],['interior-connections',true,true]]);
  expect(ok.resolved).toEqual(['arr:constraint:suites-meet-salon']);expect(ok.neverApplied).toBe(true);
  // Applying it by hand (the author's act) is what the verification describes.
  expect(decisions(terracedPavilion(true))).toEqual([]);
 });
 it('decision-required: geometrically sound, compiles, but gives up an interior adjacency the plan had',()=>{
  const plan=adjacencyTrio();expect(decisions(plan)).toEqual([]);
  const c=verifyCorrection(plan,[{node:'room-b',field:'alignment',from:'start',to:'end'}],[],'re-align B');
  expect(c.status).toBe('decision-required');expect(c.lostConnections).toEqual(['room-b ↔ room-c']);expect(c.newFindings).toEqual([]);
 });
 it('unverified: a check that cannot run is never reported as passed',()=>{
  const c=verifyCorrection(terracedPavilion(false),[{node:'terrace',field:'width',from:14,to:-5}],[],'an edit outside the contract');
  expect(c.status).toBe('unverified');expect(c.checks.every(k=>!k.ran&&k.passed===null)).toBe(true);
 });
 it('every offer on every offline building carries a status backed by checks that ran, and none claims verification without compiling',()=>{
  for(const [name,make] of BUILDINGS){
   const plan=make(),r=reviewCorrections(plan);
   for(const c of r.corrections){
    if(c.status==='verified'||c.status==='decision-required')expect(c.checks.find(k=>k.name==='compilation'),name).toMatchObject({ran:true,passed:true});
    expect(c.neverApplied).toBe(true);
   }
  }
 });
 it('a lawn moved off one room onto another is caught: the candidate for an overlap is verified against the whole plan',()=>{
  const base=compactFamilyHome();
  const house=rects(base),poolLawn=structuredClone(base);
  poolLawn.landscape=[{id:'bad-lawn',kind:'lawn',placement:{relativeTo:Object.keys(house)[0],side:'north',alignment:'centre',gap:0},width:30,depth:6}];
  const r=reviewCorrections(poolLawn);
  for(const c of r.corrections)if(c.status==='verified')expect(c.newFindings).toEqual([]);
 });
});

describe('RC3: openings on a shared wall',()=>{
 it('dining-to-terrace on the retained mansion: only 3 m of the 6 m dining wall touches the terrace; a 2.8 m door cannot fit, with the numbers',()=>{
  const plan=retainedMansion(),f=errors(plan,'openings').find(f=>f.id==='dining-to-terrace')!;
  expect(f.message).toMatch(/touches waterfront-terrace along only 3\.\.6 m \(3 m\) of its north edge \(6 m long\).*2\.8 m opening needs 3\.16 m/);
  expect(decisions(plan).join('\n')).toContain('dining-to-terrace');
  const narrower=structuredClone(plan);narrower.portals.find(p=>p.id==='dining-to-terrace')!.width=2.4;
  expect(errors(narrower,'openings').map(x=>x.id)).not.toContain('dining-to-terrace');
  const at=placePortals(narrower,rects(narrower)).get('dining-to-terrace')!;
  expect(at.refitted).toBeDefined();
  expect(at.centre).toBeCloseTo(4.5); // middle of the 3..6 m shared run along the directed north edge
  expect(at.centre!-1.2).toBeGreaterThanOrEqual(3+WALL-1e-6);expect(at.centre!+1.2).toBeLessThanOrEqual(6-WALL+1e-6);
 });
 it('unequal rooms and short shared boundaries: openings that fit the 3 m run are placed in it, wider ones are refused with the run named',()=>{
  for(const [width,fits] of [[1,true],[2.4,true],[2.8,false],[3.2,false]] as const){
   const p=retainedMansion();p.portals.find(x=>x.id==='dining-to-terrace')!.width=width;
   const f=errors(p,'openings').find(x=>x.id==='dining-to-terrace');
   if(fits)expect(f,String(width)).toBeUndefined();else expect(f!.message,String(width)).toMatch(/touches waterfront-terrace along only 3\.\.6 m \(3 m\)/);
  }
  // The salon-terrace wall of the small estate is wholly shared, so an explicit side behaves exactly as before.
  const p=terracedPavilion(true);const door=p.portals.find(x=>x.id==='salon-terrace')!;door.host.side='north';door.alignment='start';
  expect(decisions(p)).toEqual([]);expect(placePortals(p,rects(p)).get('salon-terrace')!.refitted).toBeUndefined();
 });
 it('rotated buildings place the same opening on the same wall',()=>{
  const a=compileArchitecturalPlan(terracedPavilion(true,0)),b=compileArchitecturalPlan(terracedPavilion(true,.9));
  const key=(c:typeof a)=>c.intent.portals.map(p=>[p.id,p.host.space,p.host.edge,Number(p.offset.toFixed(6))]);
  expect(key(b)).toEqual(key(a));
 });
 it('validation is not weakened: an opening whose whole-edge position already lies on the shared wall is unchanged, and rooms with no shared wall are still refused',()=>{
  for(const [name,make] of BUILDINGS){
   const p=make(),placed=placePortals(p,rects(p));
   for(const [id,at] of placed)if(at.problem===undefined&&!at.refitted&&!at.derived)expect(at.run.lo,`${name}/${id}`).toBe(0);
  }
  const apart=terracedPavilion(true);apart.spaces.find(s=>s.id==='suite-hall')!.placement.gap=0;
  const door=apart.portals.find(x=>x.id==='salon-suite-hall')!;door.host.side='north';
  expect(errors(apart,'openings').map(f=>f.id)).toContain('salon-suite-hall');
 });
});

describe('RC4: site and landscape',()=>{
 it('the retained 80×75 m site needs 64×78 m, and the extents are attributed to the allocations that set them',()=>{
  const c=coordinatePlan(retainedMansion());
  expect(c.site).toMatchObject({required:{width:64,depth:78},available:{width:80,depth:75},fits:false,basis:'model-defined',drivers:{width:'east-garden-reserve',depth:'pool-lawn-reserve'}});
  const e=c.errors.find(x=>x.kind==='site'&&/needs a site/.test(x.message))!;
  expect(e.message).toMatch(/Depth is set by pool-lawn-reserve \(pool-lawn-reserve: north of waterfront-pool/);
  expect(e.message).toMatch(/model-defined: enlarging it to the stated minimum is a determined consequence/);
 });
 it('arrival-lawn × powder-room: the overlap is attributed to the lawn\'s own size and placement',()=>{
  const [s]=coordinatePlan(retainedMansion()).siteConflicts;
  expect(s).toMatchObject({item:'arrival-lawn',with:'powder-room'});
  expect(s.decision).toBe('arrival-lawn: arrival-lawn: south of arrival-porch, centre, gap 5');
  expect(s.explanation).toMatch(/22 m wide against its anchor arrival-porch, which is 6 m wide, so it extends 8 m past each side/);
  expect(s.explanation).toMatch(/created by this item's own size and placement/);
  expect(s.options.length).toBeGreaterThan(0);expect(s.options.every(o=>o.status==='candidate')).toBe(true);
 });
 it('a fixed property boundary is never enlarged: no site edit is offered, and the message says so; a model-defined site gets the exact minimum offered, never applied',()=>{
  const plan=retainedMansion(),before=JSON.stringify(plan.site);
  const fixed=coordinatePlan(plan,{siteBasis:'fixed'}),model=coordinatePlan(plan,{siteBasis:'model-defined'});
  expect(fixed.errors.find(e=>/needs a site/.test(e.message))!.message).toMatch(/fixed: software does not enlarge it/);
  expect(reviewCorrections(plan,fixed).corrections.flatMap(c=>c.edits).some(e=>e.field.startsWith('site-'))).toBe(false);
  const offer=reviewCorrections(plan,model).corrections.find(c=>c.edits.some(e=>e.field==='site-depth'))!;
  expect(offer.edits).toEqual([{node:'site',field:'site-depth',from:75,to:78}]);expect(offer.targets).toEqual(['arr:site:fit']);
  expect(JSON.stringify(plan.site)).toBe(before);
 });
 it('site need agrees with the compiler on offline buildings, including a rotated one: the exact minimum compiles and a metre less is refused',()=>{
  for(const [name,make] of [['compact',compactFamilyHome],['courtyard',courtyardHouse],['estate',luxuryEstate]] as const){
   for(const orientation of [0,.5]){
    const p=make();p.orientation=orientation;
    const need=coordinatePlan(p).site.required;
    const exact=structuredClone(p);exact.site={...p.site,width:Math.ceil(need.width)+1,depth:Math.ceil(need.depth)+1};
    expect(decisions(exact).filter(d=>/outside site|exceeds site/.test(d)),`${name} ${orientation}`).toEqual([]);
    const tight=structuredClone(p);tight.site={...p.site,width:Math.floor(need.width)-1,depth:Math.floor(need.depth)-1};
    expect(coordinatePlan(tight).site.fits,`${name} ${orientation}`).toBe(false);
   }
  }
 });
 it('overlapping landscape is rejected unless nothing overlaps; the conflict names both placements and nothing moves',()=>{
  const p=compactFamilyHome();const first=Object.keys(rects(p))[0];
  const before=JSON.stringify(p);
  p.landscape=[{id:'over-lawn',kind:'lawn',placement:{relativeTo:first,side:'same',alignment:'centre',gap:0},width:4,depth:4}];
  const c=coordinatePlan(p);
  expect(JSON.stringify(p)).not.toBe(before); // the test itself edited its own copy
  expect(c.siteConflicts.length+c.errors.filter(e=>e.kind==='layout').length).toBeGreaterThan(0);
 });
});

describe('RC5: diagnosis reads the composition the compiler reads',()=>{
 it('the retained mansion: no false roof or window findings, and daylight is counted from composition facades',()=>{
  const d=diagnosePlan(retainedMansion());
  expect(d.findings.filter(f=>/neither a roof nor a space above/.test(f.message))).toEqual([]);
  expect(d.findings.filter(f=>f.id==='roofs')).toEqual([]);
  const daylight=d.findings.find(f=>f.id==='daylight')!;
  expect(daylight.message).toBe('6 of 13 interior rooms have no window: living-salon, dining-salon, pantry, powder-room, west-gallery, east-gallery.');
  expect((d.metrics as {windowedInteriorRooms:number}).windowedInteriorRooms).toBe(7);
  expect((d.metrics as {roofForms:string[]}).roofForms.sort()).toEqual(['flat','gable','hip']);
  expect(errors(retainedMansion()).map(f=>f.id).sort()).toEqual(['arrival-lawn','dining-to-east-gallery','dining-to-terrace','living-to-west-gallery','pool-lawn-reserve']);
 });
 it('every accepted composed building diagnoses with zero errors, and the diagnosis agrees with the compiler',()=>{
  for(const [name,make] of BUILDINGS){
   const p=make();expect(decisions(p),name).toEqual([]);expect(errors(p).map(f=>`${f.stage}:${f.id}`),name).toEqual([]);
  }
 });
 it('composition roofs and openings are one population: room-authored and composition-authored elements are not double counted',()=>{
  const p=strategyFixture('waterfront-pavilion');
  const view=expandComposition(p,p.composition,new Map(Object.entries(rects(p))));
  expect(view.spans.length).toBeGreaterThan(0);
  const diag=diagnosePlan(p);
  expect((diag.metrics as {roofForms:string[]}).roofForms.length).toBe(new Set(view.roofs.map(r=>r.form)).size);
  // A room named by a span and also given its own roof is one finding, from the same expansion the compiler uses.
  const dup=structuredClone(p),lead=view.spans[0].members[0];dup.roofs.push({space:lead,form:'flat'});
  const found=errors(dup,'resolution').filter(f=>f.id==='composition');
  expect(found).toHaveLength(1);expect(found[0].message).toMatch(/its own different roof|a space has exactly one roof/);
  expect(decisions(dup).join('\n')).toMatch(/its own different roof/);
 });
 it('actual omissions stay detectable: remove a span and the rooms it covered are reported; remove window bays and the daylight observation grows',()=>{
  const p=strategyFixture('waterfront-pavilion');
  const noSpans=structuredClone(p);noSpans.composition!.roofSpans=[];noSpans.composition!.volumes.forEach(v=>delete v.roof);
  expect(errors(noSpans,'roofs').some(f=>/neither a roof nor a space above/.test(f.message))).toBe(true);
  const bays=p.composition!.facades.filter(f=>f.kind==='windows');expect(bays.length).toBeGreaterThan(0);
  const dark=structuredClone(p);dark.composition!.facades=dark.composition!.facades.filter(f=>f.kind!=='windows');
  const count=(q:ArchitecturalPlan)=>(diagnosePlan(q).metrics as {windowedInteriorRooms:number}).windowedInteriorRooms;
  expect(count(dark)).toBeLessThan(count(p));
 });
 it('a composition facade bay is checked like any opening: one that does not fit its wall is reported',()=>{
  const p=strategyFixture('waterfront-pavilion');const bay=p.composition!.facades.find(f=>f.kind==='windows')!;
  bay.bays=12;bay.width=3;
  expect([...errors(p).map(f=>f.message),...decisions(p)].join('\n')).toMatch(/do not fit|bays/);
 });
});

describe('RC6: a rejected plan is preserved',()=>{
 it('records the phase compilation stopped in and the phases that never ran',()=>{
  const p=retainedMansion();
  try{compileArchitecturalPlan(p);throw Error('should reject');}catch(e){
   expect(e).toBeInstanceOf(PlanRejection);expect(e).toBeInstanceOf(DesignConflict);
   expect((e as PlanRejection).stage).toBe('derive');expect((e as PlanRejection).notReached).toEqual(['construction','exterior','composition','site','validate']);
  }
  expect(COMPILE_PHASES).toHaveLength(7);
  const bad=JSON.parse(JSON.stringify(canonicalFixture()));bad.version='architectural-plan-2';
  try{compileArchitecturalPlan(bad);}catch(e){expect((e as PlanRejection).stage).toBe('contract');}
 });
 it('every unplaceable opening is reported together, not just the first',()=>{
  const d=decisions(retainedMansion()).join('\n');
  for(const id of ['dining-to-terrace','living-to-west-gallery','dining-to-east-gallery'])expect(d).toContain(`${id}:`);
 });
 it('rejectedGeneration keeps the unmodified plan, decisions, composition, limitations, measured geometry and a drawing, and is never a scene',()=>{
  const plan=retainedMansion(),before=JSON.stringify(plan);
  let error:unknown;try{compileArchitecturalPlan(plan);}catch(e){error=e;}
  const r=rejectedGeneration({plan,error,brief:retainedBrief(),limitations:retainedLimitations()});
  expect(JSON.stringify(plan)).toBe(before);
  expect(r).toMatchObject({status:'rejected',completedHouse:false,scene:null,persisted:false,stage:'derive'});
  expect(r.plan).toEqual(architecturalPlanSchema.parse(plan));
  expect(r.designDecisions!.composition!.entrance).toEqual(plan.composition!.entrance);
  expect(r.designDecisions!.constraints).toHaveLength(3);
  expect(r.measured!.rects['living-salon']).toBeDefined();
  expect(r.drawing!.svg).toMatch(/NOT A BUILDING/);
  expect(Object.keys(r)).not.toContain('operations');
  expect(JSON.stringify(r).length).toBeLessThan(REJECTION_LIMITS.totalChars);
 });
 it('a plan with several independent faults keeps all of them, grouped by stage, and reports each unreached phase as unknown',()=>{
  const p=canonicalFixture();p.site={...p.site,width:12,depth:12};
  p.portals.push({id:'bad-window',host:{space:'hall',side:'east'},to:'exterior',alignment:'centre',width:1,height:1,mode:'window',sill:.9});
  p.spaces.find(s=>s.id==='day-room')!.placement={relativeTo:'hall',side:'same',alignment:'start',gap:0};
  let error:unknown;try{compileArchitecturalPlan(p);}catch(e){error=e;}
  const r=rejectedGeneration({plan:p,error,brief:'A house'});
  expect(new Set(r.diagnostics.findings.filter(f=>f.severity==='error').map(f=>f.stage)).size).toBeGreaterThanOrEqual(2);
  expect(r.notes.join(' ')).toMatch(/never ran, so/);
 });
 it('a failure after derive (exterior phase) is attributed to that phase',()=>{
  const p=strategyFixture('waterfront-pavilion');
  const lead=p.composition!.roofSpans[0];lead.rise=.4;lead.form='gable'; // pitched roofs need >= 0.6 m rise
  let stage:string|undefined;try{compileArchitecturalPlan(p);}catch(e){stage=(e as PlanRejection).stage;}
  expect(['exterior','construction','composition']).toContain(stage);
 });
 it('a plan that is not architectural-plan-1 is kept as received, bounded, with nothing measured',()=>{
  const r=rejectedGeneration({plan:{version:'architectural-plan-1',id:'x'},error:new DesignConflict(['unsupported-plan-contract']),brief:'A house'});
  expect(r).toMatchObject({plan:null,stage:'contract',coordination:null,drawing:null});expect(r.unparsed!.reason.length).toBeGreaterThan(0);
 });
});

describe('RC7: programme and concept',()=>{
 it('the retained brief asks for approximately six suites; the plan declares six bedrooms and no bathroom space, so no suite is established',()=>{
  const r=programmeReview(retainedBrief(),retainedMansion());
  const bed=r.brief.missing.find(m=>m.id==='bedrooms')!;
  expect(bed).toMatchObject({minimum:5,found:0,briefPhrase:'approximately six generous bedroom suites'});
  expect(r.findings.find(f=>f.code==='brief-programme')!.message).toMatch(/6 sleeping room\(s\) are declared and 0 of them have a bathroom space/);
  // Counted from the brief's own words and nothing else: entrance, service, terraces, pool and living/entertainment are present.
  expect(r.brief.requirements.filter(q=>q.ok).map(q=>q.id).sort()).toEqual(['entrance','living-entertainment','pool','service','terraces']);
 });
 it('living and dining spaces with doors but no window are reported as daylight unestablished, not as dark and not as an error',()=>{
  const r=programmeReview(retainedBrief(),retainedMansion());
  expect(r.daylight.filter(d=>d.status==='doors-only').map(d=>d.room).sort()).toEqual(['dining-salon','living-salon']);
  const f=r.findings.filter(x=>x.code==='daylight-unestablished');
  expect(f).toHaveLength(2);expect(f[0].category).toBe('subjective-design-concern');
  expect(f[0].message).toMatch(/Whether those doors are glazed is not modelled/);
 });
 it('six identical 7×5 m cells are an observation for a person, never a score or a gate',()=>{
  const r=programmeReview(retainedBrief(),retainedMansion());
  expect(r.repeatedCells).toHaveLength(1);expect(r.repeatedCells[0]).toMatchObject({cell:'7×5 m'});expect(r.repeatedCells[0].rooms).toHaveLength(6); // five guest suites and the primary suite
  expect(r.findings.find(f=>f.code==='repeated-cells')!.category).toBe('subjective-design-concern');
  expect(JSON.stringify(planConceptReview(retainedBrief(),retainedMansion()))).not.toMatch(/"score"/);
 });
 it('nothing the brief does not say is required: a restrained brief with a satisfied programme raises no brief finding, and a one-storey flat-roofed house is not penalised',()=>{
  const p=compactFamilyHome();
  const r=programmeReview('A compact single-storey home with a flat roof and a terrace.',p);
  expect(r.brief.missing).toEqual([]);expect(r.findings.filter(f=>f.code==='brief-programme')).toEqual([]);
  expect(planConceptReview('A modest house.',p).commission.ambitious).toBe(false);
 });
 it('"two bedroom wings" is read as wings, not as a requirement for two bedroom suites',()=>{
  const r=programmeReview('A luxury waterfront estate with a dramatic entrance, two bedroom wings and a pool.',strategyFixture('waterfront-pavilion'));
  expect(r.brief.requirements.find(q=>q.id==='bedrooms')).toBeUndefined();
 });
 it('the instructions now say how a suite, daylight, wing extent, openings and the site are judged, without demanding size, storeys or complexity',()=>{
  expect(CANONICAL_INSTRUCTIONS).toMatch(/PLACEMENT, OPENINGS AND PROGRAMME ADDENDUM/);
  expect(CANONICAL_INSTRUCTIONS).toMatch(/attached:true: it moves with its wing but does not enlarge the extent/);
  expect(CANONICAL_INSTRUCTIONS).toMatch(/A bedroom suite is a bedroom with its own bathroom space joined by a door/);
  expect(CANONICAL_INSTRUCTIONS).toMatch(/None of this asks for size, storeys or complexity the brief does not\./);
  expect(CANONICAL_INSTRUCTIONS).not.toMatch(/at least \d+ m²|minimum floor area|must have (?:two|three) storeys/i);
 });
});

describe('existing projects and editing',()=>{
 it('retained saved scenes still recompile exactly (savedProjects.test.ts), and plans without `attached` are schema-identical',()=>{
  for(const [,make] of BUILDINGS){const p=make();expect(architecturalPlanSchema.parse(p)).toEqual(p);expect(JSON.stringify(p)).not.toContain('"attached"');}
 });
 it('a compiled, attached-declaring house is editable, saves, reloads, undoes and redoes',()=>{
  const compiled=compileArchitecturalPlan(terracedPavilion(true)),scene=compiled.scene;
  const reloaded=validateScene(JSON.parse(JSON.stringify(scene)));
  expect(reloaded).toEqual(scene);
  expect(compileArchitecturalPlan(reloaded.architecturalPlan).scene.elements).toEqual(scene.elements);
  const target=scene.elements.find(e=>e.kind==='roof')!;
  const edited=stageSceneOperations(scene,[{op:'finish',id:target.id,material:'bronze'}]);
  expect(edited.elements.filter(e=>e.id!==target.id)).toEqual(scene.elements.filter(e=>e.id!==target.id));
  const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
  const store=useProjectStore.getState(),project=store.createProject('Consolidated','house','direct-scene');
  store.appendVersion(project.id,'Compiled',JSON.stringify(scene));store.appendVersion(project.id,'Edited roof',JSON.stringify(edited));
  const current=()=>validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson));
  expect(current()).toEqual(edited);store.undo(project.id);expect(current()).toEqual(scene);store.redo(project.id);expect(current()).toEqual(edited);
 });
 it('the baseline of every offline building is internally consistent: it compiles, has no arrangement or diagnostic finding',()=>{
  for(const [name,make] of BUILDINGS){const b=baselineOf(make());expect(b.compile,name).toEqual({ran:true,ok:true});expect([...b.arrangement,...b.diagnosis],name).toEqual([]);}
 });
});

describe('the retained failure can now be diagnosed accurately',()=>{
 it('15+2 raw findings reduce to the six physical conflicts and zero false positives, none repaired',()=>{
  const plan=retainedMansion(),c=coordinatePlan(plan),d=errors(plan);
  const conflicts=[...d.map(f=>f.id),...c.errors.filter(e=>e.kind==='constraint').map(e=>e.ids[0])];
  expect(new Set(conflicts)).toEqual(new Set(['arrival-lawn','pool-lawn-reserve','dining-to-terrace','living-to-west-gallery','dining-to-east-gallery','west-wing-pavilion-adjoin']));
  expect(d.every(f=>f.stage==='openings'||f.stage==='site')).toBe(true); // as before the ownership contract changed: no roof or composition finding is raised for this plan
  expect(JSON.parse(readFileSync('docs/architecture/e2e-generation-diagnostic-2026-11-03/canonical-plan.json','utf8')).plan).toEqual(plan);
 });
});
