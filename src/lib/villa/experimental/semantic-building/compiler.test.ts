import {describe,it,expect} from 'vitest';
import {compileBuilding,reviseBuilding,DesignConflict} from './compiler';
import {estateIntent,compactIntent} from './fixtures';
import {physicalEvidence} from './physical';
import {sceneSpatialGeometry} from '../../scene/spatial';
import {applySceneOperations} from '../../scene/model';
describe('isolated semantic compiler',()=>{
 for(const factory of [estateIntent,compactIntent])it(`${factory().id}: deterministic editable geometry and surface evidence`,()=>{
  const intent=factory(),r=compileBuilding(intent);
  expect(compileBuilding(JSON.parse(JSON.stringify(intent)))).toEqual(r);
  expect(Object.keys(r.provenance).sort()).toEqual(r.scene.elements.map(e=>e.id).sort());
  expect(physicalEvidence(r).failures).toEqual([]);
  expect(r.access.reachable.sort()).toEqual(intent.requiredAccess.sort());
  const changed=applySceneOperations(r.scene,[{op:'finish',id:r.scene.elements[0].id,material:'sage'}]);
  expect(changed.elements[0].material).toBe('sage');
 });
 it('derives rotated panel positions from actual wall-local cuts across frames',()=>{
  for(const yaw of [-1.13,0,.63,2.47]){
   const p=estateIntent();p.frame={origin:[13.7,-21.3],yaw};const r=compileBuilding(p),g=sceneSpatialGeometry(r.scene);
   for(const wall of r.scene.elements.filter(e=>e.opening)){
    const portal=p.portals.find(p=>r.provenance[wall.id].sources.includes(p.id))!;if(portal.mode!=='door')continue;
    const door=r.scene.elements.find(e=>e.id===portal.id)!,w=g.world(wall),d=g.world(door),o=wall.opening!;
    expect(d[0]).toBeCloseTo(w[0]+Math.cos(w[3])*o.x,9);
    expect(d[2]).toBeCloseTo(w[2]-Math.sin(w[3])*o.x,9);
    expect(d[1]-door.size[1]/2).toBeCloseTo(g.bottom(wall),9);
   }
  }
 });
 it('revises hosted opening and preserves unrelated manual work atomically',()=>{
  const p=estateIntent(),r=compileBuilding(p),id='suite-east-3-roof';
  const current=applySceneOperations(r.scene,[{op:'finish',id,material:'sage'}]);p.portals[0].offset+=.2;
  const revision=reviseBuilding(r,p,current);
  expect(revision.operations.map(o=>'id' in o?o.id:'add').sort()).toEqual(['gallery-1-e3-wall','west-threshold-1']);
  expect(revision.scene.elements.find(e=>e.id===id)?.material).toBe('sage');
  const manual=applySceneOperations(current,[{op:'move',id:'west-threshold-1',at:[1,2,3]}]);
  expect(()=>reviseBuilding(r,p,manual)).toThrow('manual edit conflicts');
  expect(manual.elements.find(e=>e.id==='west-threshold-1')?.at).toEqual([1,2,3]);
 });
 it('propagates level change into actual stair endpoint and upper floor',()=>{
  const p=compactIntent(),r=compileBuilding(p);p.levels[1].top+=.16;p.spaces.filter(s=>s.level==='street'&&!s.outdoor).forEach(s=>s.height+=.16);
  const n=reviseBuilding(r,p,r.scene);expect(n.next.stairEvidence[0]).toMatchObject({endpoint:3.56});
  expect(physicalEvidence(n.next).failures).toEqual([]);
  expect(n.scene.elements.map(e=>e.id)).toEqual(r.scene.elements.map(e=>e.id));
 });
 it.each(['missing host','gap','oversize','no access','window access','stair fit','stair headroom','overlap','concave','duplicate IDs'])("refuses %s instead of inventing architecture",kind=>{
  const p=compactIntent();
  if(kind==='missing host')p.portals[0].host.space='absent';
  if(kind==='gap')p.spaces.find(s=>s.id==='rear-deck')!.polygon.forEach(v=>v[1]+=2);
  if(kind==='oversize')p.portals[0].width=10;
  if(kind==='no access')p.portals=p.portals.filter(p=>p.id!=='sleep-door');
  if(kind==='window access')p.portals.find(p=>p.id==='sleep-door')!.mode='window';
  if(kind==='stair fit')p.stairs[0].run=8;
  if(kind==='stair headroom')p.stairs[0].headroom=4;
  if(kind==='overlap')p.spaces.find(s=>s.id==='day-room')!.polygon.forEach(v=>v[0]-=1);
  if(kind==='concave')p.spaces[0].polygon.splice(2,0,[1,-1]);
  if(kind==='duplicate IDs')p.spaces[1].id=p.spaces[0].id;
  expect(()=>compileBuilding(p)).toThrow(DesignConflict);
 });
 it('constructs a partial shared edge without moving authored outlines',()=>{
  const p=compactIntent();p.spaces[0].polygon[0][0]=.5;p.spaces[0].polygon[3][0]=.5;
  const r=compileBuilding(p);expect(r.intent.spaces).toEqual(p.spaces);expect(r.boundaries.some(b=>b.id.includes('-s'))).toBe(true);expect(physicalEvidence(r).failures).toEqual([]);
 });
 it('surface query detects a real floor gap and an obstructed opening',()=>{
  const r=compileBuilding(estateIntent());
  r.scene=applySceneOperations(r.scene,[{op:'move',id:'arrival-court-floor',at:[200,0,200]}]);
  expect(physicalEvidence(r).failures.length).toBeGreaterThan(0);
  const good=compileBuilding(compactIntent()),wall=good.scene.elements.find(e=>e.id==='stair-hall-e1-wall')!;
  const solid={...wall};delete solid.opening;good.scene=applySceneOperations(good.scene,[{op:'replace',id:solid.id,element:solid}]);
  expect(physicalEvidence(good).failures.some(f=>f.message.includes('obstruction'))).toBe(true);
 });
});
