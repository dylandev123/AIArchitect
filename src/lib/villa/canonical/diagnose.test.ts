/** Read-only collect-everything diagnosis. Developer-authored plans and the retained Terra proposal exercise the
 * checker only; nothing here is accepted generated geometry. */
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {diagnosePlan} from './diagnose';
import {compileArchitecturalPlan,type ArchitecturalPlan,type Rect} from './plan';
import {placePortals} from './coordination';
import {canonicalFixture} from './fixture';
import {compositionFixture} from './compositions.fixture';
import {DesignConflict} from '../experimental/semantic-building/compiler';
type Plan=ArchitecturalPlan;
const errors=(plan:unknown)=>diagnosePlan(plan).findings.filter(f=>f.severity==='error');
const retained=():Plan=>JSON.parse(readFileSync('docs/architecture/canonical-roof-retrieval-2026-11-02/proposal.normalized.json','utf8')).plan;
const compilerDecisions=(plan:Plan)=>{try{compileArchitecturalPlan(plan);return [] as string[];}catch(e){if(e instanceof DesignConflict)return e.decisions;throw e;}};

describe('no false positives on plans the compiler accepts (different arrangements)',()=>{
 it.each([['two-level',()=>canonicalFixture()],['compact',()=>compositionFixture('compact')],['waterfront',()=>compositionFixture('waterfront')],['courtyard',()=>compositionFixture('courtyard')]] as const)('%s',(_n,make)=>{
  const plan=make();expect(compilerDecisions(plan)).toEqual([]);
  expect(errors(plan)).toEqual([]);
 });
});

describe('detects faults one at a time on a valid arrangement',()=>{
 it('a window on a wall shared with another room',()=>{
  const plan=canonicalFixture();plan.portals.push({id:'bad-window',host:{space:'hall',side:'east'},to:'exterior',alignment:'centre',width:1,height:1,mode:'window',sill:.9});
  expect(errors(plan).map(f=>f.id)).toContain('bad-window');
 });
 it('rooms overlapping on one level, with the shared extent',()=>{
  const plan=canonicalFixture();plan.spaces.find(s=>s.id==='day-room')!.placement={relativeTo:'hall',side:'same',alignment:'start',gap:0};
  const f=errors(plan).find(f=>f.stage==='volumes')!;expect(f.message).toMatch(/overlap by [\d.]+×[\d.]+ m/);
 });
 it('a site item outside the site',()=>{
  const plan=canonicalFixture();plan.site={...plan.site,width:20,depth:20};
  expect(errors(plan).some(f=>f.stage==='site')).toBe(true);
 });
 it('an unreachable room and a roofless room',()=>{
  const plan=canonicalFixture();plan.portals=plan.portals.filter(p=>p.id!=='day-door');plan.roofs=plan.roofs.filter(r=>r.space!=='sleep-room');
  const f=errors(plan);expect(f.some(x=>x.stage==='access'&&x.id==='day-room')).toBe(true);expect(f.some(x=>x.stage==='roofs')).toBe(true);
 });
 it('never mutates the plan and tolerates unresolved references',()=>{
  const plan=canonicalFixture();plan.spaces[1].placement={relativeTo:'ghost',side:'east',alignment:'start',gap:0};
  const before=JSON.stringify(plan);
  expect(()=>diagnosePlan(plan)).not.toThrow();expect(JSON.stringify(plan)).toBe(before);
  expect(errors(plan).some(f=>f.stage==='resolution')).toBe(true);
 });
 it('reports a contract-invalid plan instead of throwing',()=>{expect(errors({version:'x'}).every(f=>f.stage==='contract')).toBe(true);});
});

describe('retained Terra mansion (never edited)',()=>{
 it('agrees exactly with the compiler on the occupied-volume overlaps it reports, and finds more',()=>{
  const d=errors(retained());
  const mine=d.filter(f=>f.stage==='volumes').map(f=>f.id).sort();
  const theirs=compilerDecisions(retained()).filter(m=>m.includes('occupied volumes overlap')).map(m=>m.split(':')[0]).sort();
  expect(mine).toEqual(theirs);expect(mine).toHaveLength(3);
  expect(d.length).toBeGreaterThan(mine.length);
 });
 it('finds the independent errors: lawn outside site, misdirected opening alignments, window and screen on a shared wall',()=>{
  const d=errors(retained());
  expect(d.find(f=>f.id==='waterfront-lawn-reserve')?.message).toMatch(/10\.\d m outside/);
  // Four doors authored on an explicit side whose whole-edge position missed the wall they share were once reported here; they are now fitted into the shared run (coordination.ts), so none is a finding.
  expect(d.filter(f=>f.stage==='openings'&&/shared segment/.test(f.message)).map(f=>f.id)).toEqual([]);
  expect(placePortals(retained(),diagnosePlan(retained()).rects as Record<string,Rect>).get('kitchen-pantry-door')?.refitted).toBeDefined();
  expect(d.find(f=>f.id==='living-east-window')?.message).toMatch(/faces media-lounge/);
  expect(d.some(f=>f.id==='living-timber-sun-screen'&&/interior boundary/.test(f.message))).toBe(true);
 });
 it('finds roof eaves that abut neighbouring roofs and taller volumes, and records the observations',()=>{
  const r=diagnosePlan(retained());
  expect(r.findings.filter(f=>f.stage==='roofs').length).toBeGreaterThan(30);
  expect(r.metrics).toMatchObject({levels:1,roofForms:['flat']});
  expect(r.findings.some(f=>f.severity==='observation'&&f.id==='daylight')).toBe(true);
 });
});

describe('portal alignment direction (documented counter-clockwise convention)',()=>{
 /** A 1.6 m nook north of the 3 m hall, aligned to the hall's west (low-x) end: it shares the WEST part of the hall's north wall. */
 const withNook=(alignment:'start'|'end'):Plan=>{
  const plan=canonicalFixture();
  plan.spaces.push({id:'nook',mass:'base-mass',level:'ground',use:'nook',width:1.6,depth:3,height:3.2,outdoor:false,placement:{relativeTo:'hall',side:'north',alignment:'start',gap:0}});
  plan.portals.push({id:'nook-door',host:{space:'hall',side:'north'},to:'nook',alignment,width:1,height:2.3,mode:'door'});
  plan.roofs.push({space:'nook',form:'flat'});
  return plan;
 };
 it('on a north wall, end reaches the west end; a start that misses the shared run is fitted into it, in the compiler and the diagnosis alike',()=>{
  const ok=withNook('end');expect(compilerDecisions(ok)).toEqual([]);expect(errors(ok)).toEqual([]);
  const refit=withNook('start');
  expect(compilerDecisions(refit)).toEqual([]);expect(errors(refit)).toEqual([]);
  const placed=placePortals(refit,diagnosePlan(refit).rects as Record<string,Rect>).get('nook-door')!;
  expect(placed.refitted).toBeDefined();expect(placed.centre).toBeGreaterThan(3-1.6);expect(placed.centre).toBeLessThan(3);
  // An opening too wide for the shared 1.6 m boundary is refused with the same reason by both.
  const wide=withNook('start');wide.portals.find(p=>p.id==='nook-door')!.width=1.5;
  expect(compilerDecisions(wide).join('\n')).toMatch(/nook-door.*cannot fit the shared boundary/);
  expect(errors(wide).map(f=>f.id)).toContain('nook-door');
 });
});
