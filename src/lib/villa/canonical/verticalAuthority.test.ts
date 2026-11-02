/** Spatial authority: which vertical values the compiler derives, which stay with the planner,
 * and which contradictions are still (correctly) refused. Developer-authored plans exercise
 * contracts only; they are not AI output and make no architectural-quality claim. */
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {compileArchitecturalPlan,deriveBuildingIntent,type ArchitecturalPlan} from './plan';
import {canonicalFixture} from './fixture';
import {compositionFixture} from './compositions.fixture';
import {validateScene} from '../scene/model';
import {DesignConflict} from '../experimental/semantic-building/compiler';
import {coverOf,polygonArea,clipConvex} from '../experimental/semantic-building/vertical';
type Plan=ArchitecturalPlan;
const decisions=(plan:Plan):string[]=>{try{compileArchitecturalPlan(plan);return [];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};
const omit=(plan:Plan,...ids:string[]):Plan=>{const next=structuredClone(plan);for(const s of next.spaces)if(ids.includes(s.id))delete s.height;return next;};
const space=(plan:Plan,id:string)=>plan.spaces.find(s=>s.id===id)!;
const place=(relativeTo:string,side:Plan['spaces'][number]['placement']['side'],alignment:'start'|'centre'|'end'='start')=>({relativeTo,side,alignment,gap:0});
const elements=(plan:Plan)=>compileArchitecturalPlan(plan).scene.elements;

describe('geometry primitives',()=>{
 const rect=(x:number,z:number,w:number,d:number)=>[[x,z],[x+w,z],[x+w,z+d],[x,z+d]] as [number,number][];
 it('clips convex footprints exactly',()=>{
  expect(polygonArea(clipConvex(rect(0,0,4,4),rect(2,2,4,4)))).toBeCloseTo(4);
  expect(clipConvex(rect(0,0,2,2),rect(5,5,1,1))).toHaveLength(0);
 });
 it('covers by the union of several upper spaces, but only at the lowest higher datum',()=>{
  const spaces=[{id:'low',level:'g',polygon:rect(0,0,6,4)},{id:'a',level:'u',polygon:rect(0,0,3,4)},{id:'b',level:'u',polygon:rect(3,0,3,4)},{id:'roof-deck',level:'r',polygon:rect(0,0,6,4)}];
  const top=(id:string)=>({g:0,u:3,r:6}[id as 'g']);
  expect(coverOf(spaces[0],spaces,top)).toMatchObject({state:'full',datum:3,by:['a','b']});
  expect(coverOf({id:'low',level:'g',polygon:rect(0,0,6,4)},spaces.slice(0,2).concat(spaces[0]),top)).toMatchObject({state:'partial',fraction:.5});
  expect(coverOf(spaces[3],spaces,top)).toMatchObject({state:'none'});
 });
});

describe('derived envelope heights',()=>{
 it('reproduces consistently authored heights exactly (no behaviour change for valid plans)',()=>{
  const explicit=compositionFixture('compact'),derived=omit(explicit,'hall','day-room','arrival','rear-deck');
  expect(elements(derived)).toEqual(elements(explicit));
  const water=compositionFixture('waterfront'),waterDerived=omit(water,'stair-hall','salon','guest-wing');
  expect(elements(waterDerived)).toEqual(elements(water));
 });
 it('derives height from the floor datum above a stacked space and from the next storey rise otherwise',()=>{
  const plan=omit(canonicalFixture(),'hall','day-room','rear-deck');
  const byId=Object.fromEntries(compileArchitecturalPlan(plan).vertical.map(v=>[v.id,v]));
  expect(byId.hall).toMatchObject({height:3.2,heightSource:'derived:upper-datum',cover:{state:'full'}});
  expect(byId['rear-deck']).toMatchObject({height:3.2,heightSource:'derived:storey-rise',cover:{state:'none'}});
  expect(byId.gallery).toMatchObject({height:2.8,heightSource:'authored'});
 });
 it('is deterministic and survives save/reload with the plan stored as authored (heights omitted)',()=>{
  const plan=omit(canonicalFixture(),'hall','day-room');
  const a=compileArchitecturalPlan(plan),b=compileArchitecturalPlan(plan);
  expect(a.scene).toEqual(b.scene);
  const reloaded=validateScene(JSON.parse(JSON.stringify(a.scene)));
  expect(reloaded).toEqual(a.scene);
  expect((reloaded.architecturalPlan as Plan).spaces.find(s=>s.id==='hall')).not.toHaveProperty('height');
  expect(compileArchitecturalPlan(reloaded.architecturalPlan as Plan).scene.elements).toEqual(a.scene.elements);
 });
 it('never guesses: a space with nothing above and no storey rise to inherit must state its height',()=>{
  const top=omit(canonicalFixture(),'sleep-room');
  expect(decisions(top).join('\n')).toMatch(/sleep-room: height is required.*no level above/);
  const single=omit(compositionFixture('courtyard'),'gallery');
  expect(decisions(single).join('\n')).toMatch(/gallery: height is required/);
 });
 const doubleHeight=():Plan=>{
  const plan=canonicalFixture();
  plan.spaces.push({id:'atrium-lounge',mass:'base-mass',level:'ground',use:'double-height lounge',width:5,depth:6,height:6.4,outdoor:false,placement:place('rear-deck','north')});
  plan.portals.push({id:'lounge-door',host:{space:'rear-deck',side:'north'},to:'atrium-lounge',alignment:'centre',width:2,height:2.3,mode:'door'});
  plan.roofs.push({space:'atrium-lounge',form:'flat',rise:.22});
  return plan;
 };
 it('leaves a deliberate double-height room to the planner when nothing is stacked above it',()=>{
  const walls=elements(doubleHeight()).filter(e=>e.id.startsWith('atrium-lounge')&&e.kind==='wall');
  expect(walls.some(w=>Math.abs(w.size[1]-6.4)<1e-9)).toBe(true);
 });
 it('reports, rather than hides, a double-height wall that meets the line of a stacked upper wall',()=>{
  const plan=doubleHeight();plan.spaces.find(s=>s.id==='atrium-lounge')!.placement=place('day-room','south');
  plan.portals=plan.portals.filter(p=>p.id!=='lounge-door');plan.portals.push({id:'lounge-opening',host:{space:'day-room',side:'south'},to:'atrium-lounge',alignment:'centre',width:2,height:2.3,mode:'open'});
  expect(decisions(plan).join('\n')).toMatch(/unsupported-capability: staggered levels create overlapping wall sections/);
 });
});

describe('contradictions that remain model-authored and are still refused',()=>{
 it('refuses an explicit height beyond the floor above, and names the derivation as the remedy',()=>{
  const plan=canonicalFixture();space(plan,'day-room').height=6.4;
  const text=decisions(plan).join('\n');
  expect(text).toMatch(/day-room\/sleep-room: occupied volumes overlap \(2\.80m vertical\)/);
  expect(text).toMatch(/omit its height so it is derived/);
 });
 it('does not invent a void or shorten the room when the same height is stated explicitly',()=>{
  const plan=canonicalFixture();space(plan,'hall').height=4.2;
  expect(decisions(plan).join('\n')).toMatch(/hall\/gallery: occupied volumes overlap \(1\.00m vertical\)/);
 });
 it('refuses a roof on a fully covered space and says the floor above is its cover',()=>{
  const plan=omit(canonicalFixture(),'day-room');plan.roofs.push({space:'day-room',form:'flat'});
  expect(decisions(plan).join('\n')).toMatch(/day-room: roof conflicts with upper occupancy: it is fully covered by sleep-room.*Omit this roof/);
 });
 it('still reports a partly covered space that has no roof as an incomplete overhead enclosure (a roof is never implied)',()=>{
  const bare=canonicalFixture();space(bare,'sleep-room').depth=4;bare.portals.find(p=>p.id==='sleep-door')!.alignment='start';
  expect(decisions(bare).join('\n')).toMatch(/day-room: incomplete overhead enclosure: unsupported-capability: only 50% is covered by sleep-room/);
 });
 it('still refuses overlapping footprints at one level and unsupported voids',()=>{
  const plan=canonicalFixture();plan.spaces[1].placement={relativeTo:'hall',side:'same',alignment:'start',gap:0};
  expect(()=>compileArchitecturalPlan(plan)).toThrow();
 });
});

describe('stacked coverage by more than one space (representation defect fixed)',()=>{
 /** The ground day-room lies wholly under two upper rooms. Previously only a single upper polygon was recognised. */
 const split=():Plan=>{
  const plan=omit(canonicalFixture(),'day-room');
  plan.spaces=plan.spaces.filter(s=>s.id!=='sleep-room');
  plan.spaces.push({id:'sleep-a',mass:'upper-mass',level:'upper',use:'bedroom',width:5,depth:4,height:2.8,outdoor:false,placement:place('day-room','same')});
  plan.spaces.push({id:'sleep-b',mass:'upper-mass',level:'upper',use:'bedroom',width:5,depth:4,height:2.8,outdoor:false,placement:place('sleep-a','north')});
  plan.portals=plan.portals.filter(p=>p.id!=='sleep-door');
  plan.portals.push({id:'sleep-door',host:{space:'gallery',side:'east'},to:'sleep-b',alignment:'end',width:1,height:2.3,mode:'door'},{id:'sleep-link',host:{space:'sleep-a',side:'north'},to:'sleep-b',alignment:'centre',width:1.6,height:2.3,mode:'open'});
  plan.roofs=[{space:'gallery',form:'flat'},{space:'sleep-a',form:'flat'},{space:'sleep-b',form:'flat'}];
  return plan;
 };
 it('accepts a roofless ground room fully covered by the union of two upper rooms',()=>{
  expect(decisions(split())).toEqual([]);
  const evidence=compileArchitecturalPlan(split()).vertical.find(v=>v.id==='day-room')!;
  expect(evidence.cover).toMatchObject({state:'full',by:expect.arrayContaining(['sleep-a','sleep-b'])});
 });
});

describe('retained mansion (Terra response, never edited)',()=>{
 const retained=():Plan=>JSON.parse(readFileSync('docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json','utf8')).plan;
 it('is still rejected for its own explicit heights and its two fully covered roofs; the four partial roofs are no longer findings',()=>{
  const all=decisions(retained());
  const overlaps=all.filter(d=>d.includes('occupied volumes overlap')).map(d=>d.split(':')[0]).sort();
  expect(overlaps).toEqual(['foyer/upper-bath-6','foyer/upper-suite-6','gallery/upper-landing','gallery/upper-lounge','living/upper-bath-4','living/upper-suite-4']);
  expect(all.filter(d=>d.includes('unsupported-capability: roof conflicts'))).toEqual([]);
  const contradictory=all.filter(d=>d.includes('Omit this roof')).map(d=>d.split(':')[0]).sort();
  expect(contradictory).toEqual(['gallery','guest-suite-1']);
 });
 it('derivation alone removes the six height overlaps from an ALTERED COPY (diagnostic, not a Terra output)',()=>{
  const copy=retained(),stacked=[...new Set(decisions(copy).filter(d=>d.includes('occupied volumes overlap')).map(d=>d.split('/')[0]))];
  expect(stacked.sort()).toEqual(['foyer','gallery','living']);
  const altered=omit(copy,...stacked);
  const all=decisions(altered);
  expect(all.filter(d=>d.includes('occupied volumes overlap'))).toEqual([]);
  // What remains is exactly the two genuinely contradictory roofs, which are the model's to resolve.
  expect(all.every(d=>/roof conflicts with upper occupancy: it is fully covered/.test(d))).toBe(true);
  expect(all.map(d=>d.split(':')[0]).sort()).toEqual(['gallery','guest-suite-1']);
 });
 it('exposes the schema fact that the retained plan states every height and still parses',()=>{
  expect(retained().spaces.every(s=>typeof s.height==='number')).toBe(true);
  expect(()=>deriveBuildingIntent(retained())).not.toThrow();
 });
});
