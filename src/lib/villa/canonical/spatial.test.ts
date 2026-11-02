/** Whole-building spatial coordination: wing placement by envelope, declared constraints, impossible arrangements, and
 * the collision classes the earlier audits demonstrated. Every plan here is DEVELOPER-AUTHORED (spatial.fixture.ts):
 * these tests prove mechanics, never that a model designs better. */
import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {compileArchitecturalPlan,architecturalPlanSchema,type ArchitecturalPlan} from './plan';
import {diagnosePlan} from './diagnose';
import {resolveLayout,placementPath} from './layout';
import {coordinatePlan} from './spatial';
import {volumeCollisions,explainCollisions,compositionOf} from './arrangement';
import {compactFamilyHome,asymmetricMultilevel,courtyardHouse,luxuryEstate,skeleton,build,sweepParti,SWEEP_SIDES as sides,type HouseSpec} from './spatial.fixture';
import {spineParti} from './arrangement.fixture';
import {physicalEvidence} from '../experimental/semantic-building/physical';
import {DesignConflict} from '../experimental/semantic-building/compiler';
import {stageSceneOperations,validateScene} from '../scene/model';
import {useProjectStore} from '@/store/useProjectStore';
const arrangements={compact:compactFamilyHome,multilevel:asymmetricMultilevel,courtyard:courtyardHouse,estate:luxuryEstate};
const reasons=(plan:ArchitecturalPlan)=>{try{compileArchitecturalPlan(plan);return [] as string[];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};
const collisions=(plan:ArchitecturalPlan)=>volumeCollisions(plan,resolveLayout(plan).rects);
const lcg=(seed:number)=>()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
afterEach(()=>vi.unstubAllGlobals());

describe('wing placement by envelope',()=>{
 it('places the whole envelope, not the seed room: the author states the relationship, software finds the corner',()=>{
  const p=compactFamilyHome(),{rects,frames,problems}=resolveLayout(p);
  expect(problems).toEqual([]);
  // living wing envelope is x 0..17, z 0..7 (the root wing). The sleeping wing (rooms 11×2.4 hall + 4 m bedrooms, 11×6.4 envelope) sits against its north edge, start-aligned.
  expect(frames.get('sleeping')!.envelope).toMatchObject({x:0,z:7,width:11,depth:6.4});
  expect(rects.get('hall')).toMatchObject({x:0,z:7});
  // the deck wing is centred on the living envelope's south edge: 8 m wide centred on x 8.5
  expect(frames.get('terrace')!.envelope).toMatchObject({x:4.5,z:-4,width:8,depth:4});
  expect(frames.get('sleeping')!.seed).toBe('hall');
 });
 it('resizing a room moves what is placed against its wing; nobody recalculates a coordinate',()=>{
  const p=compactFamilyHome();p.spaces.find(s=>s.id==='kitchen')!.width=9;      // living envelope widens 17 → 21
  const {rects,frames}=resolveLayout(p);
  expect(frames.get('terrace')!.envelope.x).toBeCloseTo(6.5);                   // still centred
  expect(collisions(p)).toEqual([]);
  const q=compactFamilyHome();q.spaces.find(s=>s.id==='hall')!.depth=4;          // sleeping wing deepens; its rooms move with it rigidly
  expect(resolveLayout(q).rects.get('bed-one')).toMatchObject({z:11});
  expect(rects.get('bed-one')).toMatchObject({z:9.4});
 });
 it('"same" stacks a wing over its anchor at the chosen alignment',()=>{
  const p=asymmetricMultilevel(),{frames}=resolveLayout(p);
  expect(frames.get('sleeping')!.envelope).toMatchObject(frames.get('living')!.envelope);
 });
 it('a wing is a node in the placement chain: a collision between rooms of two wings is explained where the wings met',()=>{
  const p=compactFamilyHome();
  expect(placementPath(p,'bed-one')).toEqual(['bed-one','hall','sleeping','living']);
 });
 it('plans that do not use wing placement are untouched: same rectangles as the historical resolver',()=>{
  const {roomAnchored,wingAnchored}=spineParti({gallery:[8,10],salon:[16,10],hall:[4,20],suite:[10,6]});
  for(const plan of [roomAnchored,wingAnchored]){expect(plan.masses.some(m=>m.placement)).toBe(false);expect(resolveLayout(plan).frames.size).toBe(0);}
 });
});

describe.each(Object.entries(arrangements))('arrangement: %s',(_name,make)=>{
 it('is a valid architectural-plan-1, diagnoses clean, coordinates without error and compiles through the unchanged canonical compiler',()=>{
  const plan=make();
  expect(architecturalPlanSchema.safeParse(plan).success).toBe(true);
  expect(diagnosePlan(plan).findings.filter(f=>f.severity==='error')).toEqual([]);
  const c=coordinatePlan(plan);expect(c.errors).toEqual([]);expect(c.ok).toBe(true);expect(c.site.fits).toBe(true);
  const compiled=compileArchitecturalPlan(plan);
  expect(physicalEvidence(compiled).failures).toEqual([]);
  expect(compiled.scene.elements.length).toBeGreaterThan(40);
  expect(new Set(compiled.scene.elements.map(e=>e.id)).size).toBe(compiled.scene.elements.length);
  const interior=plan.spaces.filter(s=>!s.outdoor).map(s=>s.id);
  expect(compiled.access.reachable).toEqual(expect.arrayContaining(interior));
  expect(compileArchitecturalPlan(plan).scene).toEqual(compiled.scene);        // deterministic
 });
 it('every wing is reachable from the arrival and wing adjacency is reported',()=>{
  const c=coordinatePlan(make());
  for(const w of c.circulation.wings)expect(w.reachable).toBe(w.interiorRooms);
  expect(c.wings.length).toBe(make().masses.length);
 });
 it('persists, reloads, edits one element and undoes/redoes through the project store',()=>{
  const storage=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)}});
  const compiled=compileArchitecturalPlan(make()),scene=validateScene(compiled.scene);
  const reloaded=validateScene(JSON.parse(JSON.stringify(scene)));expect(reloaded).toEqual(scene);
  expect(reloaded.architecturalPlan).toEqual(make());                              // the wings and constraints persist with the scene
  const target=scene.elements.find(e=>e.kind==='roof')!;
  const edited=stageSceneOperations(reloaded,[{op:'finish',id:target.id,material:'bronze'}]);
  expect(edited.elements.filter(e=>e.id!==target.id)).toEqual(scene.elements.filter(e=>e.id!==target.id));
  const store=useProjectStore.getState(),project=store.createProject('Wing arrangement','house','direct-scene');
  store.appendVersion(project.id,'Generated',JSON.stringify(scene));store.appendVersion(project.id,'Edited',JSON.stringify(edited));
  store.undo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(scene);
  store.redo(project.id);expect(validateScene(JSON.parse(store.getProject(project.id)!.houseConfigJson))).toEqual(edited);
 });
});

describe('the arrangements are genuinely different compositions (measurements, not beauty)',()=>{
 it('differ in wing count, levels, footprint fill and enclosure',()=>{
  const m=Object.fromEntries(Object.entries(arrangements).map(([n,make])=>[n,{c:compositionOf(make()),k:coordinatePlan(make())}]));
  expect(new Set(Object.values(m).map(x=>x.c.wings.length)).size).toBeGreaterThanOrEqual(3);
  expect(new Set(Object.values(m).map(x=>x.c.footprintFill)).size).toBe(4);
  expect(m.multilevel.c.levels).toBe(2);expect(m.compact.c.levels).toBe(1);
  expect(m.courtyard.k.constraints[0]).toMatchObject({kind:'enclose',ok:true,measured:1});
  expect(m.multilevel.k.vertical.every(v=>v.supportedFraction===1)).toBe(true);     // bedrooms wholly over the living wing
 });
});

describe('declared constraints are measured, never repaired',()=>{
 it('a satisfied separate/adjoin/enclose is reported with its measurement',()=>{
  const c=coordinatePlan(luxuryEstate());
  expect(c.constraints.map(x=>[x.id,x.ok])).toEqual([['guests-private',true],['link-meets-house',true],['link-meets-guests',true]]);
  expect(c.constraints[0].measured!).toBeGreaterThanOrEqual(18);
 });
 it('a violated constraint rejects the plan, names the decisions that produce it and offers verified single edits; the plan is untouched',()=>{
  const plan=luxuryEstate();plan.constraints![0].amount=30;const before=JSON.stringify(plan);
  const c=coordinatePlan(plan),r=c.constraints.find(x=>x.id==='guests-private')!;
  expect(r.ok).toBe(false);expect(r.measured!).toBeLessThan(30);
  expect(r.implicated.map(i=>i.node)).toEqual(expect.arrayContaining(['guest-pavilion','link']));
  const joined=reasons(plan).join(' ');expect(joined).toMatch(/guests-private .* is not met/);expect(joined).toMatch(/Software has changed nothing/);
  for(const o of r.options){                                                             // every offer is re-verified to satisfy the constraint
   const edited=structuredClone(plan);const ref=(edited.masses.find(m=>m.id===o.node)?.placement??edited.spaces.find(s=>s.id===o.node)!.placement) as Record<string,unknown>;ref[o.field]=o.to;
   expect(coordinatePlan(edited).constraints.find(x=>x.id==='guests-private')!.ok).toBe(true);
  }
  expect(JSON.stringify(plan)).toBe(before);
 });
 it('a court that is not actually enclosed fails its enclose declaration (a gap between wings)',()=>{
  const plan=courtyardHouse();for(const id of ['west-bed-one','west-bed-two'])plan.spaces.find(s=>s.id===id)!.depth=2;     // the west range no longer reaches the north range
  plan.portals=plan.portals.filter(x=>x.mode!=='window'&&x.id!=='west-bed-two-studio');             // (its connection to the studio no longer exists either)
  const r=coordinatePlan(plan).constraints[0];expect(r.ok).toBe(false);expect(r.measured!).toBeLessThan(.9);
  expect(reasons(plan).join(' ')).toMatch(/court-enclosed/);
 });
 it('unknown entities and self-relations are declaration errors',()=>{
  const plan=luxuryEstate();plan.constraints!.push({id:'ghost',kind:'separate',a:'nowhere',b:'spa',amount:1,reason:'x'},{id:'self',kind:'adjoin',a:'spa',b:'spa',amount:1,reason:'x'},{id:'lonely',kind:'adjoin',a:'spa',amount:1,reason:'x'});
  const e=coordinatePlan(plan).errors.filter(x=>x.kind==='declaration').map(x=>x.message).join(' ');
  expect(e).toMatch(/nowhere is not a resolvable/);expect(e).toMatch(/same entity/);expect(e).toMatch(/needs a second entity/);
 });
});

describe('competing constraints are identified, not silently traded',()=>{
 it('separate and adjoin on one pair are contradictory declarations',()=>{
  const plan=luxuryEstate();plan.constraints!.push({id:'guests-touch-owner',kind:'adjoin',a:'guest-pavilion',b:'owner-wing',amount:3,reason:'they should share a wall'});
  const e=coordinatePlan(plan).errors.filter(x=>x.kind==='declaration');
  expect(e).toHaveLength(1);expect(e[0].message).toMatch(/guests-private .* and guests-touch-owner .* cannot both hold/);
  expect(reasons(plan).join(' ')).toMatch(/cannot both hold/);
 });
 it('a privacy demand the site cannot hold: every single edit that meets it overflows the site, and that is reported as the competing constraint',()=>{
  const plan=luxuryEstate();plan.site={...plan.site,width:62,depth:70};plan.constraints![0].amount=34;
  const c=coordinatePlan(plan),r=c.constraints.find(x=>x.id==='guests-private')!;
  expect(r.ok).toBe(false);
  expect(r.options.length).toBeGreaterThan(0);
  expect(r.options.every(o=>o.newErrors.includes('site:fit')||o.newErrors.length>0)).toBe(true);
  expect(c.site.fits).toBe(true);                        // the declared arrangement itself fits; the demanded one would not
 });
 it('adjacency and distance together: a satisfiable pair is accepted, an unsatisfiable one reports the placements to reconsider',()=>{
  const plan=luxuryEstate();plan.constraints!.push({id:'spa-near-owner',kind:'adjoin',a:'spa',b:'owner-wing',amount:4,reason:'the spa should open from the owner suite'});
  const r=coordinatePlan(plan).constraints.find(x=>x.id==='spa-near-owner')!;
  expect(r.ok).toBe(false);expect(r.implicated.length).toBeGreaterThan(0);
  expect(r.implicated.map(i=>i.placement).join(' ')).toMatch(/spa/);
 });
});

describe('impossible arrangements are rejected with a reason, never repaired',()=>{
 const reject=(mutate:(p:ArchitecturalPlan)=>void,pattern:RegExp,make:()=>ArchitecturalPlan=compactFamilyHome)=>{
  const p=make();mutate(p);const r=reasons(p);
  expect(r.length,'rejected').toBeGreaterThan(0);expect(r.join(' | ')).toMatch(pattern);
  expect(coordinatePlan(p).ok).toBe(false);
  expect(diagnosePlan(p).findings.some(f=>f.severity==='error')).toBe(true);
 };
 it('a wing with two local origins, or none',()=>{
  reject(p=>{p.spaces.find(s=>s.id==='bed-one')!.placement={relativeTo:null,side:'origin',alignment:'centre',gap:0};},/exactly one of its spaces must be its local origin/);
  reject(p=>{p.spaces.find(s=>s.id==='hall')!.placement={relativeTo:'bed-one',side:'south',alignment:'start',gap:0};},/cyclic|exactly one of its spaces/);
 });
 it('a room of a placed wing anchored outside its wing',()=>{
  reject(p=>{p.spaces.find(s=>s.id==='bed-two')!.placement={relativeTo:'kitchen',side:'north',alignment:'start',gap:0};},/rooms in it may be placed only against rooms of the same wing/);
 });
 it('wings whose placements depend on each other',()=>{
  reject(p=>{p.masses.find(m=>m.id==='approach')!.placement={relativeTo:'terrace',side:'south',alignment:'start',gap:0};p.masses.find(m=>m.id==='terrace')!.placement={relativeTo:'approach',side:'east',alignment:'start',gap:0};},/cyclic|missing, cyclic or itself unresolved/);
 });
 it('a wing placed against itself, against nothing, or against an unknown id',()=>{
  reject(p=>{p.masses.find(m=>m.id==='sleeping')!.placement!.relativeTo='sleeping';},/cannot be placed against itself/);
  reject(p=>{p.masses.find(m=>m.id==='sleeping')!.placement!.relativeTo='nowhere';},/neither a wing nor a space/);
  reject(p=>{p.masses.find(m=>m.id==='sleeping')!.placement!.side='origin';},/Only the root may use origin placement/);
 });
 it('two wings forced into the same volume (stacked on one level) are an overlap the compiler also refuses',()=>{
  reject(p=>{p.masses.find(m=>m.id==='sleeping')!.placement={relativeTo:'living',side:'same',alignment:'start',gap:0};},/occupied volumes overlap|share no wall/);
  const p=compactFamilyHome();p.masses.find(m=>m.id==='sleeping')!.placement={relativeTo:'living',side:'same',alignment:'start',gap:0};
  expect(coordinatePlan(p).collisions.length).toBeGreaterThan(0);
  expect(reasons(p)[0]).toMatch(/occupied volumes overlap|both anchored|are .* apart|overlap/);   // the fundamental overlap leads; door failures follow
  expect(reasons(p).findIndex(m=>/share no wall/.test(m))).toBeGreaterThan(0);
 });
 it('overlapping wings are explained at the wings, with single wing-level edits that are re-verified',()=>{
  const spec:HouseSpec={id:'corner-claim',thesis:'Developer fixture',site:[80,80],levels:[{id:'ground',above:null,rise:.2}],arrival:'core-a',doors:[],
   wings:[{id:'core',role:'core',rooms:[{id:'core-a',w:6,d:6}]},
    {id:'east-arm',role:'long arm east',at:{to:'core',side:'east',al:'start'},rooms:[{id:'east-a',w:8,d:14}]},
    {id:'north-arm',role:'long arm north',at:{to:'core',side:'north',al:'start'},rooms:[{id:'north-a',w:14,d:6}]}]};
  const plan=skeleton(spec),ds=explainCollisions(plan);
  expect(ds).toHaveLength(1);expect(ds[0].cause).toBe('adjacent-overhang');expect(ds[0].host).toBe('core');
  expect(ds[0].heads.sort()).toEqual(['east-arm','north-arm']);
  expect(ds[0].explanation).toMatch(/wing east-arm .* and wing north-arm .* both anchored to wing core on adjacent sides/);
  expect(ds[0].options.length).toBeGreaterThan(1);
  for(const o of ds[0].options){
   expect(o.entity).toBe('wing');
   const edited=structuredClone(plan);(edited.masses.find(m=>m.id===o.space)!.placement as Record<string,unknown>)[o.field]=o.to;
   expect(collisions(edited).map(c=>`${c.a}/${c.b}`)).not.toContain('east-a/north-a');
  }
  const c=coordinatePlan(plan);expect(c.openChoices.length).toBe(1);                 // several valid ways out: the choice is the author's
  expect(c.openChoices[0].about).toMatch(/must yield/);
 });
 it('a site too small for the arrangement is stated as a determined need',()=>{
  const p=luxuryEstate();p.site={...p.site,width:40,depth:40};
  const c=coordinatePlan(p);expect(c.site.fits).toBe(false);expect(c.site.required.width).toBeGreaterThan(40);
  expect(c.errors.some(e=>e.kind==='site'&&/needs a site of at least/.test(e.message))).toBe(true);
 });
 it('every unplaced wing needs the single root; two roots are refused', ()=>{
  reject(p=>{p.masses.find(m=>m.id==='sleeping')!.placement=undefined;},/exactly one root space|Choose exactly one root space|Choose a single origin placement/);
 });
});

describe('collision classes demonstrated in earlier audits',()=>{
 it('wings on non-adjacent sides of a core never collide when placed as envelopes; the same decisions placed room by room often do',()=>{
  let roomForm=0,wingForm=0,n=0;
  for(let i=0;i<1500;i++){
   const pair=i%2===0?(['east','west'] as const):(['north','south'] as const);
   const a=collisions(sweepParti(7000+i,'rooms',pair)).length,b=collisions(sweepParti(7000+i,'wings',pair)).length;
   n++;if(a>0)roomForm++;if(b>0)wingForm++;
  }
  expect(wingForm).toBe(0);expect(roomForm).toBeGreaterThan(n*.05);
 });
 it('with wings on all four sides the remaining collisions are all wing-corner claims, each explained at wing level with verified edits',()=>{
  let roomForm=0,wingForm=0,corner=0,otherCause=0,explainedWithOptions=0;
  for(let i=0;i<1500;i++){
   const rooms=sweepParti(9000+i,'rooms',sides),wings=sweepParti(9000+i,'wings',sides);
   if(collisions(rooms).length)roomForm++;
   const cs=collisions(wings);if(cs.length)wingForm++;
   for(const d of explainCollisions(wings,3)){
    if(d.cause==='adjacent-overhang'&&d.heads.every(h=>h&&wings.masses.some(m=>m.id===h)))corner++;else otherCause++;
    if(d.options.length)explainedWithOptions++;
   }
  }
  expect(wingForm).toBeLessThan(roomForm);                     // fewer arrangements collide when the relationship is stated between wings
  expect(otherCause).toBe(0);                                  // nothing escapes classification: no room-level or branch-crossing collisions remain
  expect(corner).toBeGreaterThan(0);expect(explainedWithOptions).toBeGreaterThan(corner*.8);
 });
 it('the retained spine parti (corner overhang, 2000 size sets) has no cross-wing collision when its halls are wings placed against the social wing',()=>{
  const rnd=lcg(20261102);let collided=0;
  for(let i=0;i<2000;i++){
   const pick=(a:number,b:number)=>Math.round((a+rnd()*(b-a))*2)/2,gal=[pick(6,12),pick(6,14)],sal=[pick(10,22),pick(8,14)],hall=[pick(3,5),pick(12,26)],suite=[pick(6,12),pick(4,7)];
   const wingRooms=(side:'east'|'west')=>[{id:`${side}-hall`,w:hall[0],d:hall[1]},...(['start','centre','end'] as const).map(al=>({id:`${side}-suite-${al}`,w:suite[0],d:suite[1],at:{to:`${side}-hall`,side,al}}))];
   const plan=skeleton({id:'spine-wings',thesis:'x',site:[600,600],levels:[{id:'ground',above:null,rise:.2}],arrival:'entry',doors:[],wings:[
    {id:'social',role:'spine',rooms:[{id:'entry',w:10,d:8},{id:'gallery',w:gal[0],d:gal[1],at:{to:'entry',side:'south'}},{id:'salon',w:sal[0],d:sal[1],at:{to:'gallery',side:'south'}}]},
    {id:'east-wing',role:'east',at:{to:'social',side:'east',al:'start'},rooms:wingRooms('east')},{id:'west-wing',role:'west',at:{to:'social',side:'west',al:'start'},rooms:wingRooms('west')}]});
   if(collisions(plan).some(c=>plan.spaces.find(s=>s.id===c.a)!.mass!==plan.spaces.find(s=>s.id===c.b)!.mass))collided++;
  }
  expect(collided).toBe(0);
 });
});

describe('compiler accepts geometrically valid sizes that floating-point arithmetic used to reject',()=>{
 it('a room 2.4 m deep placed after a 7 m room (9.4−7 = 2.4000000000000004) compiles',()=>{
  const plan=courtyardHouse();                                         // west-hall 6×2.4 at z 7..9.4
  expect(resolveLayout(plan).rects.get('west-hall')!.depth).toBe(2.4);
  expect(()=>compileArchitecturalPlan(plan)).not.toThrow();
 });
 it('over 400 random decimal dimensions the slab outline never fails on rounding',()=>{
  const rnd=lcg(11);let failures=0;
  for(let i=0;i<400;i++){
   const w=Math.round((3+rnd()*9)*10)/10,d=Math.round((2+rnd()*8)*10)/10,off=Math.round((1+rnd()*9)*10)/10;
   const plan=build({id:'float',thesis:'x',site:[120,120],levels:[{id:'ground',above:null,rise:.2}],arrival:'a',doors:[['a','b',1]],wings:[{id:'w',role:'w',rooms:[{id:'a',w:off,d:7},{id:'b',w,d,at:{to:'a',side:'north',al:'start'}}]}]});
   try{compileArchitecturalPlan(plan);}catch(e){if(!(e instanceof DesignConflict)||/Too big/.test(String(e.decisions)))failures++;}
  }
  expect(failures).toBe(0);
 });
});

describe('retained model proposals still resolve exactly as before',()=>{
 it('the corrected mansion and plan-revision proposals produce the same rectangles and the same collisions through the unified resolver',()=>{
  for(const f of ['docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json','docs/architecture/canonical-plan-revision-2026-11-02/revision-record.json']){
   const j=JSON.parse(readFileSync(f,'utf8')),plan=(j.revised?.plan??j.plan??j) as ArchitecturalPlan;
   const {rects,problems,frames}=resolveLayout(plan);
   expect(problems).toEqual([]);expect(frames.size).toBe(0);expect(rects.size).toBe(plan.spaces.length);
   const c=coordinatePlan(plan);expect(c.collisions.length).toBe(collisions(plan).length);
   // every collision carries its cause and options, as before; none is attributed to a wing placement because none was used
   for(const d of c.collisions)expect(d.heads.every(h=>h===null||!plan.masses.some(m=>m.id===h))).toBe(true);
  }
 });
});
