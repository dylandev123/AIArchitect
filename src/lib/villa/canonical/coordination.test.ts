/** Offline verification of deterministic architectural coordination. Every proposal here is the retained Terra plan, read unmodified, or a
 * developer-authored fixture/mock; nothing is model output and nothing claims architectural quality. */
import {describe,expect,it,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
vi.mock('@/lib/ai/model',()=>({getAiModel:()=>({})}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_m:unknown,call:()=>unknown)=>call()}));
import {architecturalPlanSchema,compileArchitecturalPlan,CANONICAL_INSTRUCTIONS,type ArchitecturalPlan,type Rect} from './plan';
import {diagnosePlan} from './diagnose';
import {WALL,placePortals,placeInRun,edgeOf,sharedRuns,exposedFascia,forbiddenRuns,stairKeepOuts,type Side} from './coordination';
import {DesignConflict} from '../experimental/semantic-building/compiler';
import {canonicalFixture} from './fixture';
import {compositionFixture} from './compositions.fixture';
import {analysePlan} from './revision/analysis';
import {buildRevisionRequest,reviseCanonicalPlan,authorizeRevisionExperiment,sceneFromAcceptedRevision} from './revision/revise';
import {renderPlanSvg} from './revision/planView';
import {stageSceneOperations,validateScene} from '../scene/model';
import {useProjectStore} from '@/store/useProjectStore';
import {originalMansion,rejectedRevision,connectionsAsRelationships,declareLandingConnections,miniPair,waterfrontBase,waterfrontRevisionMock,waterfrontNaiveExplicitMock,REVISION_RECORD} from './coordination.fixture';
afterEach(()=>vi.unstubAllGlobals());
type Evidence={id:string;local:[number,number];width:number;host:string;passable:boolean};
const evidenceOf=(c:{portalEvidence:object[]},id:string)=>(c.portalEvidence as Evidence[]).find(e=>e.id===id)!;
const rectsOf=(p:ArchitecturalPlan)=>diagnosePlan(p).rects as Record<string,Rect>;
const errors=(p:ArchitecturalPlan,stage?:string)=>diagnosePlan(p).findings.filter(f=>f.severity==='error'&&(!stage||f.stage===stage));
const rejection=(p:ArchitecturalPlan)=>{try{compileArchitecturalPlan(p);return null;}catch(e){if(e instanceof DesignConflict)return e.decisions.join(' | ');throw e;}};

describe('derived connections: the declared relationship fixes the wall and the position',()=>{
 for(const side of ['north','east','south','west'] as const)for(const al of ['start','centre','end'] as const)for(const door of ['start','centre','end'] as const)
  it(`b ${side} of a (${al}-aligned), door ${door}: the compiled opening lies on the shared wall`,()=>{
   const plan=miniPair(side,al,door),compiled=compileArchitecturalPlan(plan);
   expect(errors(plan)).toEqual([]);
   const link=evidenceOf(compiled,'link'),d=rectsOf(plan);
   const a=d.a,b=d.b,[x,z]=link.local,run=(lo:number,hi:number)=>({lo,hi});
   const shared=side==='east'||side==='west'?run(Math.max(a.z,b.z),Math.min(a.z+a.depth,b.z+b.depth)):run(Math.max(a.x,b.x),Math.min(a.x+a.width,b.x+b.width));
   const line=side==='east'?a.x+a.width:side==='west'?a.x:side==='north'?a.z+a.depth:a.z;
   expect(side==='east'||side==='west'?x:z).toBeCloseTo(line);
   const along=side==='east'||side==='west'?z:x;
   expect(along-link.width/2).toBeGreaterThanOrEqual(shared.lo+.18-1e-6);expect(along+link.width/2).toBeLessThanOrEqual(shared.hi-.18+1e-6);
  });
 it('centre means the middle of the shared segment, not of the host edge',()=>{
  const plan=miniPair('east','start','centre'),compiled=compileArchitecturalPlan(plan),link=evidenceOf(compiled,'link');
  const b=rectsOf(plan).b;expect(link.local[1]).toBeCloseTo(b.z+b.depth/2);
 });
 it('the explicit-side formula is unchanged wherever it already lands inside the shared boundary; elsewhere the opening is fitted into the run it shares, or refused',()=>{
  expect(placeInRun('start',1.2,0,10)).toBeCloseTo(.85);expect(placeInRun('end',1.2,0,10)).toBeCloseTo(9.15);expect(placeInRun('centre',1.2,0,10)).toBe(5);
  let refitted=0;
  for(const plan of [originalMansion(),rejectedRevision(),compositionFixture('compact'),compositionFixture('waterfront'),compositionFixture('courtyard')]){
   const rects=rectsOf(plan),placed=placePortals(plan,rects);
   for(const p of plan.portals.filter(x=>x.host.side!=='shared'&&x.host.side!=='exposed')){
    const at=placed.get(p.id)!,len=edgeOf(rects[p.host.space],p.host.side as Side).len;
    expect(at.derived).toBe(false);
    if(at.problem!==undefined){expect(at.problem).toMatch(/cannot fit the shared boundary|separate runs/);continue;}
    if(at.refitted){refitted++;expect(at.centre).toBeCloseTo(placeInRun(p.alignment,p.width,at.run.lo,at.run.hi));expect(at.refitted.from).toBeCloseTo(p.alignment==='centre'?len/2:p.alignment==='start'?p.width/2+.25:len-p.width/2-.25);continue;}
    expect(at.centre).toBeCloseTo(p.alignment==='centre'?len/2:p.alignment==='start'?p.width/2+.25:len-p.width/2-.25);
   }
  }
  expect(refitted).toBeGreaterThan(0); // the original saved mansion alone holds four doors whose whole-edge position missed the wall they share
 });
 describe('an explicit side whose whole-edge position misses the shared boundary (partial overlap)',()=>{
  /** Room a (10 m wide) with room b (4 m wide) to its east, offset along z: they share only part of a's east edge. */
  const pair=(width:number,alignment:'start'|'centre'|'end',bAlign:'start'|'centre'|'end'='end',bDepth=4)=>{
   const host={x:0,z:0,width:10,depth:10},target={x:10,z:bAlign==='end'?6:bAlign==='start'?0:3,width:4,depth:bDepth};
   const portal={id:'d',host:{space:'a',side:'east' as const},to:'b',alignment,width,height:2.2,mode:'door' as const};
   return {rects:{a:host,b:target},portal,placed:placePortals({spaces:[{id:'a',level:'g'},{id:'b',level:'g'}],portals:[portal]},{a:host,b:target}).get('d')!};
  };
  it('places the opening inside the shared run, honouring the alignment within it',()=>{
   const c=pair(1,'centre').placed;
   expect(c.problem).toBeUndefined();expect(c.side).toBe('east');expect(c.refitted?.from).toBeCloseTo(5);
   expect(c.centre).toBeCloseTo(8); // east edge z 0..10 runs south→north; b spans z 6..10, so the run is 6..10 and its middle is 8
   const s=pair(1,'start').placed,e=pair(1,'end').placed;
   expect(s.centre).toBeCloseTo(6+.5+.25);expect(e.centre).toBeCloseTo(10-.5-.25);
   expect(s.centre!-.5).toBeGreaterThanOrEqual(6+WALL-1e-6);expect(e.centre!+.5).toBeLessThanOrEqual(10-WALL+1e-6);
  });
  it('leaves the historical position alone when it already lies inside the shared run',()=>{
   const at=pair(1,'centre','centre').placed; // run z 3..7 contains the edge middle (5)
   expect(at.problem).toBeUndefined();expect(at.refitted).toBeUndefined();expect(at.centre).toBeCloseTo(5);
  });
  it('refuses an opening that cannot physically fit the short shared boundary, naming the run',()=>{
   const at=pair(3.8,'centre').placed;
   expect(at.problem).toMatch(/touches b along only 6\.\.10 m \(4 m\) of its east edge.*needs 4\.16 m/);
  });
  it('is the same for a rotated building because placement is made in the plan frame before rotation',()=>{
   const rotated=(orientation:number)=>{const plan=structuredClone(compositionFixture('waterfront'));plan.orientation=orientation;return plan;};
   const a=compileArchitecturalPlan(rotated(0)),b=compileArchitecturalPlan(rotated(.7));
   const local=(c:typeof a)=>c.intent.portals.map(p=>[p.id,p.host.space,p.host.edge,Number(p.offset.toFixed(6))]);
   expect(local(b)).toEqual(local(a));
  });
 });
 it('a connection between rooms that share no wall is a precise finding, not a guess',()=>{
  const plan=miniPair('east','centre');plan.spaces.find(s=>s.id==='b')!.placement.gap=2;
  expect(errors(plan,'openings').map(f=>f.message).join()).toMatch(/a and b share no wall/);
  expect(rejection(plan)).toMatch(/link: a and b share no wall/);
 });
 it('a shared wall too short for the opening reports its length and the need',()=>{
  const plan=miniPair('east','centre');plan.portals.find(p=>p.id==='link')!.width=6.5;
  expect(errors(plan,'openings').map(f=>f.message).join()).toMatch(/too short for a 6.5 m opening.*6.86 m/);
 });
 it('an explicit wrong side names the side the rooms do share',()=>{
  const plan=miniPair('east','centre','centre','north');
  expect(errors(plan,'openings').map(f=>f.message).join()).toMatch(/share no wall on the north edge.*share the east edge of a; host side "shared" derives it/);
 });
 it('both new sides are in the strict schema and nothing else about the portal changed',()=>{
  expect(architecturalPlanSchema.safeParse(miniPair('east','centre')).success).toBe(true);
  const bad=structuredClone(miniPair('east','centre'));(bad.portals[0].host as {side:string}).side='middle';expect(architecturalPlanSchema.safeParse(bad).success).toBe(false);
 });
});

describe('derived exposure for windows',()=>{
 const withWindow=(side:'exposed'|'north'|'south'|'east'|'west',width=1.2)=>{const p=miniPair('east','centre');p.portals.push({id:'win',host:{space:'b',side},to:'exterior',alignment:'centre',width,height:1.2,mode:'window',sill:.9});return p;};
 it('an unambiguous exposed run is used; several are reported with their intervals and refused as ambiguous',()=>{
  const ambiguous=withWindow('exposed');
  expect(errors(ambiguous,'openings').map(f=>f.message).join()).toMatch(/ambiguous: 3 exposed runs.*south 0\.\.4 m; east 0\.\.6 m; north 0\.\.4 m.*Name the side/);
  expect(compileArchitecturalPlan(withWindow('east')).scene.elements.length).toBeGreaterThan(0);
 });
 it('exactly one exposed run is derived without naming a side',()=>{
  const p=withWindow('exposed');p.spaces.push({id:'c',mass:'main',level:'ground',use:'c',width:4,depth:6,height:3.2,outdoor:false,placement:{relativeTo:'b',side:'north',alignment:'start',gap:0}},{id:'d',mass:'main',level:'ground',use:'d',width:4,depth:6,height:3.2,outdoor:false,placement:{relativeTo:'b',side:'south',alignment:'start',gap:0}});
  const q=structuredClone(p);q.portals.find(x=>x.id==='win')!.host.side='exposed';
  // b: west shared with a (full), north and south shared with c and d (full width), only east is exposed
  const placed=placePortals(q,rectsOf(q));expect(placed.get('win')).toMatchObject({side:'east',derived:true});
 });
 it('a window on a wall that has become shared says which walls remain exposed, and a wrapped room says it has none',()=>{
  const p=withWindow('west');expect(errors(p,'openings').map(f=>f.message).join()).toMatch(/window faces a.*Exposed wall wide enough for 1.2 m: south 0\.\.4 m; east 0\.\.6 m; north 0\.\.4 m/);
  const wrapped=miniPair('east','centre');wrapped.spaces.push({id:'c',mass:'main',level:'ground',use:'c',width:4,depth:6,height:3.2,outdoor:false,placement:{relativeTo:'b',side:'north',alignment:'start',gap:0}},{id:'d',mass:'main',level:'ground',use:'d',width:4,depth:6,height:3.2,outdoor:false,placement:{relativeTo:'b',side:'south',alignment:'start',gap:0}},{id:'e',mass:'main',level:'ground',use:'e',width:4,depth:6,height:3.2,outdoor:false,placement:{relativeTo:'b',side:'east',alignment:'start',gap:0}});
  wrapped.portals.push({id:'win',host:{space:'b',side:'exposed'},to:'exterior',alignment:'centre',width:1.2,height:1.2,mode:'window',sill:.9});
  expect(errors(wrapped,'openings').map(f=>f.message).join()).toMatch(/b has no exposed wall wide enough for a 1.2 m window/);
 });
});

/** The guest wing made deeper than the suite above it: its uncovered remainder takes a flat roof. */
const deeperWing=(suiteDepth:number)=>{const p=waterfrontBase();p.spaces.find(s=>s.id==='guest-wing')!.depth=11;p.spaces.find(s=>s.id==='master-suite')!.depth=suiteDepth;p.roofs.push({space:'guest-wing',form:'flat',rise:.25});return p;};
describe('stair clearance is part of the derivation and of the diagnosis',()=>{
 it('an explicit door the compiler rejects beside the flight is now diagnosed with the same verdict',()=>{
  const plan=waterfrontNaiveExplicitMock();
  const finding=errors(plan,'openings').find(f=>f.id==='suite-passage');
  expect(finding?.message).toMatch(/left of the stair flight/);
  // the compiler fails on the first problem it reaches; the stair rule is one of the plan's rejections
  const alone=waterfrontBase();alone.portals.find(p=>p.id==='suite-passage')!.alignment='centre';
  expect(errors(alone,'openings').map(f=>f.id)).toEqual(['suite-passage']);expect(rejection(alone)).toMatch(/suite-passage: unsupported-capability: left threshold crosses the selected stair flight/);
 });
 it('every explicit threshold the diagnosis accepts compiles past the stair rule, and every one it refuses is refused by the compiler',()=>{
  for(const al of ['start','centre','end'] as const){
   const p=waterfrontBase();p.portals.find(q=>q.id==='suite-passage')!.alignment=al;
   const flagged=errors(p,'openings').some(f=>f.id==='suite-passage'&&/stair flight/.test(f.message));
   expect(/left threshold crosses/.test(rejection(p)??''),`alignment ${al}`).toBe(flagged);
  }
 });
 it('"shared" moves the opening the least distance that clears the flight and keeps it on the shared wall',()=>{
  const q=deeperWing(9);q.portals.find(x=>x.id==='suite-passage')!.alignment='centre';
  expect(errors(q,'openings').map(f=>f.id)).toContain('suite-passage'); // an explicit centred door crosses the flight
  q.portals.find(x=>x.id==='suite-passage')!.host.side='shared';
  const placed=placePortals(q,rectsOf(q)).get('suite-passage')!;
  expect(placed.problem).toBeUndefined();expect(placed.movedFrom).toBeDefined();expect(placed.centre).not.toBe(placed.movedFrom);
  expect(errors(q)).toEqual([]);expect(rejection(q)).toBeNull();
 });
 it('when the whole shared wall lies beside the flight it says so instead of choosing',()=>{
  const p=deeperWing(5.5); // wall z 1..6.5, all inside the flight and its clearance
  p.portals.find(q=>q.id==='suite-passage')!.host.side='shared';
  expect(errors(p,'openings').map(f=>f.message).join()).toMatch(/stair flight beside upper-gallery leaves no place for a 1.4 m opening/);
  expect(rejection(p)).toMatch(/suite-passage: the stair flight beside upper-gallery/);
 });
 it('windows are exempt, matching the compiler',()=>{
  const k=stairKeepOuts(waterfrontBase().stairs,rectsOf(waterfrontBase()));
  expect(k).toHaveLength(1);expect(forbiddenRuns({x:0,z:0,width:5,depth:12},'west',k).length).toBe(1);
 });
});

describe('partly covered flat roofs are diagnosed over their exposed remainder, as the compiler builds them',()=>{
 it('a ground room under a smaller upper room is not reported as a roof projecting into it',()=>{
  const plan=canonicalFixture(),sleep=plan.spaces.find(s=>s.id==='sleep-room')!;sleep.width=2;sleep.depth=4;plan.portals.find(p=>p.id==='sleep-door')!.alignment='start';
  plan.roofs.push({space:'day-room',form:'flat'});
  expect(errors(plan,'roofs')).toEqual([]);expect(rejection(plan)).toBeNull();
 });
 it('the three retained findings it removes are exactly the partly covered flat roofs',()=>{
  const plan=rejectedRevision(),d=errors(plan,'roofs').map(f=>f.id);
  for(const gone of ['central-gallery/owner-suite','entry-hall/upper-west-suite','east-private-hall/east-suite-3'])expect(d).not.toContain(gone);
  expect(d).toContain('media-lounge/east-suite-1'); // a genuine volume collision still reported
 });
});

describe('Terra\'s rejected revision: independent decisions, not 87 faults',()=>{
 const plan=rejectedRevision(),original=originalMansion();
 it('the retained files are unchanged and the diagnosis reproduces the retained errors, minus three non-conflicts and plus one stair-clearance failure the compiler would reach later',()=>{
  const record=JSON.parse(readFileSync(REVISION_RECORD,'utf8'));
  expect(record.assessment.revisedErrorCount).toBe(87);expect(plan).toEqual(record.revised.plan);
  expect(errors(plan).length).toBe(36); // 85 before roofs built fascia on exposed edges only: 49 were fascia boards, none a physical clash
  expect(errors(plan,'openings').find(f=>f.id==='entry-stair-door')!.message).toMatch(/left of the stair flight/);
  expect(createHash('sha256').update(JSON.stringify(original)).digest('hex')).toBe(record.original.sha256);
 });
 const a=analysePlan(plan,original);
 it('every error belongs to exactly one decision',()=>{
  expect(a.decisions.reduce((n,d)=>n+d.findings.length,0)).toBe(a.errorCount);
  expect(a.decisions.length).toBeLessThan(a.errorCount/2);
 });
 it('names the relationships: pitched roofs, the bath walls, the unconnected upper rooms',()=>{
  const by=(k:string)=>a.decisions.filter(d=>d.kind===k);
  // Nine pitched roofs abut their neighbours; only the one with a room stacked over part of it is a roof relationship.
  expect(by('pitched-roof').flatMap(d=>d.affects.roofs).sort()).toEqual(['east-suite-3']);
  expect(by('pitched-roof')[0].findings.map(f=>f.id).sort()).toEqual(['east-suite-3','east-suite-3/owner-suite']);
  expect(by('arrangement').flatMap(d=>d.findings.map(f=>f.id))).toContain('media-lounge/east-suite-1');
  const bathWalls=by('wall').filter(d=>/bath/.test(d.title));
  expect(bathWalls.map(d=>d.findings.length)).toEqual(expect.arrayContaining([5,5,5,5]));
  for(const w of bathWalls.filter(d=>d.findings.length===5)){expect(w.affects.portals.length).toBe(2);expect(w.affects.screens.length).toBe(1);expect(w.introduced.some(i=>/bath/.test(i))).toBe(true);}
  expect(by('circulation')).toHaveLength(1);expect(by('circulation')[0].affects.rooms.sort()).toEqual(['owner-suite','upper-east-suite','upper-west-suite']);
  expect(by('circulation')[0].title).toMatch(/not connected to upper-landing/);
 });
 it('attributes new findings to what was added, using the original as baseline',()=>{
  const added=new Set(a.decisions.flatMap(d=>d.introduced));
  for(const id of ['east-bath-2','west-bath-3','owner-suite','upper-west-suite'])expect(added.has(id),id).toBe(true);
 });
 it('declaring only the missing landing connections clears the access failures and creates no new kind of failure',()=>{
  const connected=declareLandingConnections(connectionsAsRelationships(plan),'upper-landing',['owner-suite','upper-west-suite','upper-east-suite']);
  expect(architecturalPlanSchema.safeParse(connected).success).toBe(true);
  const b=analysePlan(connected,plan);
  expect(errors(connected,'access')).toEqual([]);
  expect(b.errorCount).toBe(a.errorCount-4); // 3 access failures, and entry-stair-door moved clear of the flight
  expect(errors(connected,'openings').length).toBe(errors(plan,'openings').length-1); // entry-stair-door cleared the flight
  // what remains are decisions only the model can take
  expect(new Set(b.decisions.map(d=>d.kind))).toEqual(new Set(['pitched-roof','wall','arrangement','site']));
 });
 it('the exposure table is derived for every room and agrees with the findings',()=>{
  const stair=a.exposure.find(r=>r.room==='east-suite-2')!;
  expect(stair.edges.find(e=>e.side==='east')).toMatchObject({sharedWith:[{room:'east-bath-2'}],exposed:[]});
  expect(a.exposure.find(r=>r.room==='east-suite-3')!.edges.find(e=>e.side==='north')!.exposed).toEqual([{from:0,to:6}]);
 });
 it('the revision request carries the exposure table and the relationship decisions',async()=>{
  const req=await buildRevisionRequest({brief:'b',plan,analysis:a});
  const ctx=req.context as {measured:{exposure:{columns:string[];rows:unknown[][]}};findings:{relationshipDecisions:{decisions:{kind:string;findingCount:number}[]}}};
  expect(ctx.measured.exposure.rows.length).toBe(plan.spaces.length*4);
  expect(ctx.findings.relationshipDecisions.decisions.reduce((n,d)=>n+d.findingCount,0)).toBe(a.errorCount);
  expect(req.system).toMatch(/relationshipDecisions/);
 });
});

describe('the original saved mansion: coordinate faults disappear when only the relationship is declared',()=>{
 it('its opening faults on walls it already shared are derived away; what remains is a real wall decision',()=>{
  const plan=originalMansion(),before=errors(plan,'openings'),after=errors(connectionsAsRelationships(plan),'openings');
  expect(before.map(f=>f.id)).toEqual(['living-east-window']); // four explicit-side doors that missed the wall they share are now fitted into it; only the real wall decision remains
  expect(after.map(f=>f.id)).toEqual(['living-east-window']);
  expect(after[0].message).toMatch(/window faces media-lounge.*Exposed wall wide enough for 3.2 m: east 0\.\.4 m/);
 });
 it('rewriting connections as relationships changes no room, level, roof or screen',()=>{
  const plan=originalMansion(),re=connectionsAsRelationships(plan);
  expect({...re,portals:null}).toEqual({...plan,portals:null});
  expect(re.portals.map(p=>({...p,host:{space:p.host.space}}))).toEqual(plan.portals.map(p=>({...p,host:{space:p.host.space}})).map(p=>p));
 });
});

describe('a different compact multilevel house: an ensuite and study added by declaring relationships',()=>{
 const base=waterfrontBase(),mock=waterfrontRevisionMock();
 it('the base house is valid; the mock is valid and compiles',()=>{
  expect(errors(base)).toEqual([]);expect(rejection(base)).toBeNull();
  expect(errors(mock)).toEqual([]);expect(rejection(mock)).toBeNull();
 });
 it('the same intent authored with guessed edges and alignments fails in several places at once; precise findings name each',()=>{
  const naive=waterfrontNaiveExplicitMock(),f=errors(naive,'openings');
  expect(f.map(x=>x.id).sort()).toEqual(['master-bath-door','suite-passage']);
  expect(f.find(x=>x.id==='master-bath-door')!.message).toMatch(/share the south edge of master-suite/);
  expect(f.find(x=>x.id==='suite-passage')!.message).toMatch(/stair flight/);
 });
 it('adding rooms beside an existing explicit opening no longer breaks it: the opening is fitted into the wall it now shares',()=>{
  const moved=deeperWing(9);moved.portals.find(p=>p.id==='suite-passage')!.alignment='start';
  expect(errors(moved,'openings').map(f=>f.id)).not.toContain('suite-passage'); // 4..11 m shared segment: the old 0.25..1.65 m whole-edge position missed it, so it is fitted into 4..11 m
  expect(placePortals(moved,rectsOf(moved)).get('suite-passage')?.refitted).toBeDefined();
  const derived=structuredClone(moved);derived.portals.find(p=>p.id==='suite-passage')!.host.side='shared';
  expect(errors(derived,'openings').map(f=>f.id)).not.toContain('suite-passage');
 });
 it('constructs real geometry: every door sits on a wall shared by its two rooms, the new rooms are reachable, nothing collides',()=>{
  const compiled=compileArchitecturalPlan(mock),d={rects:rectsOf(mock)};
  expect(compiled.access.reachable.sort()).toEqual(expect.arrayContaining(['master-bath','upper-study','master-suite','upper-gallery']));
  const ev=(id:string)=>evidenceOf(compiled,id);
  const door=ev('master-bath-door'),bath=d.rects['master-bath'],suite=d.rects['master-suite'];
  expect(door.passable).toBe(true);expect(door.local[1]).toBeCloseTo(suite.z); // the suite/bath boundary
  expect(door.local[0]-door.width/2).toBeGreaterThanOrEqual(bath.x+.18-1e-6);expect(door.local[0]+door.width/2).toBeLessThanOrEqual(bath.x+bath.width-.18+1e-6);
  const passage=ev('suite-passage');expect(passage.local[0]).toBeCloseTo(d.rects['upper-gallery'].x);
  const sd=ev('study-door');expect(sd.local[0]).toBeCloseTo(d.rects['upper-gallery'].x+d.rects['upper-gallery'].width);
  expect(compiled.scene.elements.filter(e=>e.kind==='roof').map(e=>e.id)).toEqual(expect.arrayContaining(['master-bath-roof','upper-study-roof']));
  expect(Object.keys(compiled.provenance).length).toBe(compiled.scene.elements.length);
 });
 it('is accepted by the bounded revision, then saved, edited, reloaded, undone and redone',async()=>{
  const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
  const response={status:'revised' as const,revisionKind:'repair' as const,concept:'Developer mock: ensuite and study added by declared relationships.',plan:mock,addressed:[],changes:[{entity:'master-bath',change:'added',reason:'mock'}],retained:['programme'],limitations:['developer mock, not model output']};
  const record=await reviseCanonicalPlan({authorization:authorizeRevisionExperiment({experimentId:'coord-mock',authorizedBy:'test',scope:'redesign-permitted'}),brief:'Compact two-level waterfront house with ensuite and study',plan:base,submit:async()=>({output:response})});
  expect(record.assessment.checks.filter(c=>!c.ok),JSON.stringify(record.assessment.stopReasons)).toEqual([]);expect(record.accepted).toBe(true);
  const before=validateScene(compileArchitecturalPlan(base).scene),scene=validateScene(sceneFromAcceptedRevision(record).scene);
  expect(scene.architecturalPlan).toEqual(mock);expect(validateScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
  const target=scene.elements.find(e=>e.id==='master-bath-roof')!,edited=stageSceneOperations(scene,[{op:'finish',id:target.id,material:'bronze'}]);
  expect(edited.elements.filter(e=>e.id!==target.id)).toEqual(scene.elements.filter(e=>e.id!==target.id));
  const store=useProjectStore.getState(),project=store.createProject('Coordination','house','direct-scene');
  store.appendVersion(project.id,'Base house',JSON.stringify(before));store.appendVersion(project.id,'Ensuite and study',JSON.stringify(scene));store.appendVersion(project.id,'Edited bath roof',JSON.stringify(edited));
  const current=()=>validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson));
  expect(current()).toEqual(edited);store.undo(project.id);expect(current()).toEqual(scene);store.undo(project.id);expect(current()).toEqual(before);store.redo(project.id);store.redo(project.id);expect(current()).toEqual(edited);
  // the saved plan keeps the relationships, and recompiling it from storage reproduces the same geometry
  expect((current().architecturalPlan as ArchitecturalPlan).portals.filter(p=>p.host.side==='shared').length).toBeGreaterThanOrEqual(3);
  expect(compileArchitecturalPlan(current().architecturalPlan).scene.elements).toEqual(compileArchitecturalPlan(mock).scene.elements);
 });
 it('renders the plan drawing with derived openings on their resolved walls',()=>{
  const svg=renderPlanSvg(mock);expect(svg).toMatch(/master-bath-door/);expect(svg).not.toMatch(/NaN|undefined/);
 });
});

describe('pitched roofs: fascia only on edges no other room shares',()=>{
 const abutting=()=>{const p=miniPair('east','start');p.roofs=[{space:'a',form:'flat'},{space:'b',form:'hip',rise:.9}];return p;};
 it('a hip roof beside a same-height neighbour is valid: no fascia on the shared edge, and the compiler builds it',()=>{
  const p=abutting();expect(errors(p,'roofs')).toEqual([]);expect(rejection(p)).toBeNull();
  const roof=compileArchitecturalPlan(p).scene.elements.find(e=>e.kind==='roof'&&e.roofForm==='hip')!;
  expect(roof.fascia).toEqual(expect.arrayContaining(['north','east','south'])); // b stands east of a: its west edge is shared
  expect(roof.fascia).not.toContain('west');
 });
 it('boards stay on every edge that is exposed, and an outdoor neighbour shares its edge like a room',()=>{
  const p=abutting();p.roofs=[{space:'a',form:'hip',rise:.9},{space:'b',form:'flat'}];
  const roof=compileArchitecturalPlan(p).scene.elements.find(e=>e.kind==='roof'&&e.roofForm==='hip')!;
  expect([...roof.fascia!].sort()).toEqual(['north','south']); // a: b shares its east edge, the yard its west edge
 });
 it('an overhang of at least the board thickness keeps the board on a shared edge: it stands outside the wall, on the eave line',()=>{
  const r={x:0,z:0,width:8,depth:6},next={x:8,z:0,width:4,depth:6};
  expect(exposedFascia('hip',r,[next],0)).not.toContain('east');expect(exposedFascia('hip',r,[next],.4)).toContain('east');
  expect(exposedFascia('gable',r,[next],0)).toEqual(['south','north']); // gable eaves are the long edges; the shared east edge is a rake
 });
 it('two abutting pitched roofs of different forms and heights coexist',()=>{
  const p=abutting();p.roofs=[{space:'a',form:'gable',rise:1},{space:'b',form:'hip',rise:.9}];p.spaces.find(s=>s.id==='a')!.height=3.6;
  expect(errors(p,'roofs')).toEqual([]);expect(rejection(p)).toBeNull();
 });
 it('an overhang whose edge lies wholly against the neighbour is built flush on that edge only, by both the diagnosis and the compiler',()=>{
  const p=abutting();p.roofs=[{space:'a',form:'flat'},{space:'b',form:'hip',rise:.9,overhang:.5}];
  expect(errors(p,'roofs')).toEqual([]);expect(rejection(p)).toBeNull();
  expect(diagnosePlan(p).findings.filter(f=>f.severity==='observation'&&f.stage==='roofs').map(f=>f.message).join()).toMatch(/west eave is flush \(authored 0.5 m, built 0\)/);
  const roof=compileArchitecturalPlan(p).scene.elements.find(e=>e.kind==='roof'&&e.roofForm==='hip')!;
  expect(roof.overhang).toBe(.5);expect(roof.eaves).toEqual({west:0}); // the other three edges keep the authored overhang
 });
});

describe('the contract states the relationships it now derives',()=>{
 it('covers shared/exposed sides, explicit upper-room connections, exposed windows and screens, and the pitched fascia rule',()=>{
  for(const re of [/host side "shared"/,/host side "exposed"/,/every interior room, including each upper room, needs its own door/,/never a wall shared with another room/,/fascia boards are built only on edges no other room shares/,/a room enclosed on every edge cannot have an exterior window or screen/])expect(CANONICAL_INSTRUCTIONS).toMatch(re);
 });
 it('still asks for no legacy artefacts',()=>{expect(CANONICAL_INSTRUCTIONS).not.toMatch(/semantic-pilot|v3-plan|spatial-proposal/);});
});
void sharedRuns;
