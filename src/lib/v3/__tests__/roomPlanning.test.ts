import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {preparePlanEvaluation,checkoutPlanEvaluation,reviseDraftRoomLayout} from '../architecturalPlanEvaluation';
import {v3PlanAuthoringSchema,v3RelationshipPlanAuthoringSchema,expandPlanAuthoring} from '../architecturalPlanAuthoring';
import {planConstructionBlockers,sameArchitecturalPlan,elaborateV3ArchitecturalPlan,lowerV3ArchitecturalPlan} from '../architecturalPlanFirst';
import {auditV3Interior} from '../interior';
import {deriveArchitecturalPlan} from '../architecturalPlanning';
import {localRectangleFits} from '../blueprint';
import {planV3ArchitecturalBlueprint,constructV3ArchitecturalBlueprint} from '../architecturalBlueprint';
import {proposeRoomCoordination} from '../roomCoordination';
import {roomPlanningExamples,relationshipGardenHome,relationshipCourtEstate,roomPlanningExterior} from '../parity/roomPlanning';
import {roomsShareAccessBoundary,type RoomLayoutDraft} from '../roomLayout';
import {executeV3SceneOperations} from '../operations';
import {generateV3FromArchitecturalBlueprint} from '../architecturalBlueprintGeneration';

const fixtureText=readFileSync(new URL('./fixtures/terra-estate-2026-10-22.response.json',import.meta.url),'utf8');
const roomWarnings=(scene:Parameters<typeof auditV3Interior>[0])=>auditV3Interior(scene).filter(f=>['ROOM_OUTSIDE_HOST','ROOM_OVERLAP','ROOM_ADJACENCY_NO_SHARED_BOUNDARY'].includes(f.code));

describe('the exact natural Terra estate, preserved without reinterpretation',()=>{
 it('reproduces all 17 warnings and never silently coordinates paid or saved geometry',()=>{
  expect(createHash('sha256').update(fixtureText).digest('hex')).toBe('65036c5f32b6c9b8be56fc6c57886715bb9bd469b2480fe938199f4427eb88ad');
  const raw=JSON.parse(fixtureText),before=JSON.stringify(raw),s=preparePlanEvaluation(raw),warnings=roomWarnings(s.scene!);
  expect(s.ok).toBe(true);
  expect(warnings.filter(f=>f.code==='ROOM_OUTSIDE_HOST')).toHaveLength(3);
  expect(warnings.filter(f=>f.code==='ROOM_OVERLAP')).toHaveLength(6);
  expect(warnings.filter(f=>f.code==='ROOM_ADJACENCY_NO_SHARED_BOUNDARY')).toHaveLength(8);
  expect(s.plan!.buildings.flatMap(b=>b.storeys.flatMap(s=>s.spaces.map(r=>r.footprint)))).toEqual(raw.buildings.flatMap((b:typeof raw.buildings[number])=>b.storeys.flatMap((s:typeof b.storeys[number])=>s.spaces.map((r:typeof s.spaces[number])=>r.footprint))));
  const reload=checkoutPlanEvaluation(JSON.parse(JSON.stringify(s.scene)));
  expect(reload.ok).toBe(true);expect(sameArchitecturalPlan(s.scene!,reload.scene!)).toBe(true);
  expect(roomWarnings(reload.scene!)).toEqual(warnings);expect(JSON.stringify(raw)).toBe(before);
 });
 it('offers a separate general boundary proposal, preserves ambiguity atomically, and never edits its source',()=>{
  const source=preparePlanEvaluation(JSON.parse(fixtureText)).plan!,before=JSON.stringify(source);
  const c=proposeRoomCoordination(source),stage=preparePlanEvaluation(c.plan);
  expect(c.requiresReview).toBe(true);expect(c.changes).toHaveLength(7);expect(roomWarnings(stage.scene!)).toHaveLength(9);
  expect(c.diagnostics.some(f=>f.message.includes('ambiguous'))).toBe(true);
  expect(c.plan.buildings[0].storeys[1]).toEqual(source.buildings[0].storeys[1]);
  expect(c.plan.buildings.map(b=>({plan:b.plan,location:b.location}))).toEqual(source.buildings.map(b=>({plan:b.plan,location:b.location})));
  expect(c.plan.roomAdjacencies).toEqual(source.roomAdjacencies);expect(c.plan.verticalCirculation).toEqual(source.verticalCirculation);
  expect(c.plan.features).toEqual(source.features);expect(c.plan.connections).toEqual(source.connections);
  expect(JSON.stringify(source)).toBe(before);
 });
});

describe('relationship-first floor development through existing V3 authority',()=>{
 it('advertises room intentions for new generations while retaining the legacy parser',()=>{
  expect(v3RelationshipPlanAuthoringSchema.safeParse(relationshipGardenHome()).success).toBe(true);
  const explicit=JSON.parse(fixtureText);
  expect(v3RelationshipPlanAuthoringSchema.safeParse(explicit).success).toBe(false);
  expect(expandPlanAuthoring(explicit).success).toBe(true);
 });
 it.each(roomPlanningExamples())('develops $name, preserves intentions and exact shells through editor/save/reload/exterior/construction',({make})=>{
  const raw=make(),before=JSON.stringify(raw);
  expect(v3PlanAuthoringSchema.safeParse(raw).success).toBe(true);
  const s=preparePlanEvaluation(raw);expect(s.ok,JSON.stringify(s.findings)).toBe(true);
  expect(s.plan!.buildings.map(b=>b.plan)).toEqual(raw.buildings.map(b=>b.plan));
  expect(s.plan!.buildings.map(b=>[b.location.x,b.location.z,b.storeys.length])).toEqual(raw.buildings.map(b=>[b.location.x,b.location.z,b.storeys.length]));
  expect(s.plan!.roomAdjacencies).toEqual(raw.roomAdjacencies);
  expect(s.scene!.metadata.roomLayoutDrafts).toEqual([]);expect(planConstructionBlockers(s)).toEqual([]);expect(roomWarnings(s.scene!)).toEqual([]);
  for(const pair of s.plan!.roomAdjacencies){const rooms=s.scene!.interior!.rooms;expect(roomsShareAccessBoundary(rooms.find(r=>r.id===pair.from)!.footprint,rooms.find(r=>r.id===pair.to)!.footprint)).toBe(true);}
  for(const room of s.scene!.interior!.rooms){const host=s.scene!.objects.find(o=>o.id===room.hostMassId)!;const floor=s.scene!.interior!.storeys.find(f=>f.id===room.storeyId)!;expect(localRectangleFits(host,room.footprint,floor.index)).toBe(true);}
  for(const floor of s.scene!.interior!.storeys){const drawing=deriveArchitecturalPlan(s.scene!,null,floor.index);expect(drawing.rooms.some(r=>s.scene!.interior!.rooms.some(room=>room.id===r.id&&room.storeyId===floor.id))).toBe(true);}
  const reload=checkoutPlanEvaluation(JSON.parse(JSON.stringify(s.scene)));expect(reload.ok).toBe(true);expect(sameArchitecturalPlan(s.scene!,reload.scene!)).toBe(true);
  const exterior=elaborateV3ArchitecturalPlan(reload,roomPlanningExterior(raw));expect(exterior.blueprint,JSON.stringify(exterior.findings)).toBeDefined();
  const approved=planV3ArchitecturalBlueprint(exterior.blueprint,{buildFirst:true});const built=approved.approval&&constructV3ArchitecturalBlueprint(approved.approval);
  expect(built&&built.ok,JSON.stringify(approved.findings)).toBe(true);expect(built!.outcome,JSON.stringify(built!.findings.filter(f=>f.severity==='fatal'))).toBe('complete');
  expect(sameArchitecturalPlan(s.scene!,built!.scene!)).toBe(true);expect(built!.model!.primitives.length).toBeGreaterThan(0);expect(JSON.stringify(raw)).toBe(before);
 });
 it('varies proportions, compass order, dimensions and rotation without imposing a fixed house/grid',()=>{
  for(const width of [9,13.7,18])for(const depth of [8,11.3,15]){
   const raw=relationshipGardenHome(width,depth,.37),s=preparePlanEvaluation(raw);expect(s.ok).toBe(true);expect(roomWarnings(s.scene!)).toEqual([]);
   expect(s.scene!.metadata.roomLayoutDrafts).toEqual([]);const living=s.scene!.interior!.rooms.find(r=>r.id==='garden-living')!;expect(living.footprint.width).toBeCloseTo(width*2/3);expect(living.footprint.depth).toBeCloseTo(depth*.4);
  }
 });
 it('stacks fixed circulation on all three storeys while preserving a ground-only pavilion and varied private suites',()=>{
  const raw=relationshipCourtEstate(),s=preparePlanEvaluation(raw);
  const halls=s.scene!.interior!.rooms.filter(r=>r.id.endsWith('stair-hall'));expect(halls).toHaveLength(3);expect(new Set(halls.map(r=>JSON.stringify(r.footprint))).size).toBe(1);
  expect(raw.buildings[0].storeys[1].layout).not.toEqual(raw.buildings[0].storeys[0].layout);
  expect(s.plan!.buildings.map(b=>b.storeys.length)).toEqual([3,1]);expect(s.plan!.verticalCirculation).toEqual(raw.verticalCirculation);
 });
 it('constrains upper rooms to their upper-only articulated setback without changing the ground storey',()=>{
  const raw=relationshipCourtEstate(),baseline=preparePlanEvaluation(raw);
  raw.buildings[0].plan.operations!.push(Object.assign({id:'upper-south-setback',type:'recess',facade:'south',start:.01,end:.99,depth:1},{floors:'upper'}));
  for(const floor of raw.buildings[0].storeys.slice(1))Object.assign(floor.layout.regions[2],{bounds:{x:0,z:4.5,width:24,depth:9}});
  const s=preparePlanEvaluation(raw);expect(s.ok,JSON.stringify(s.findings)).toBe(true);expect(s.scene!.metadata.roomLayoutDrafts).toEqual([]);expect(roomWarnings(s.scene!)).toEqual([]);
  expect(s.plan!.buildings[0].storeys[0].spaces).toEqual(baseline.plan!.buildings[0].storeys[0].spaces);
  const upper=s.scene!.interior!.rooms.find(r=>r.id==='court-1-stair-hall')!;expect(upper.footprint.z+upper.footprint.depth/2).toBeCloseTo(9);
 });
 it('keeps derived room rectangles directly editable; reload cannot replay an obsolete recipe',()=>{
  const s=preparePlanEvaluation(relationshipGardenHome()),room=s.scene!.interior!.rooms.find(r=>r.id==='garden-living')!;
  const edit=executeV3SceneOperations(s.scene!,{intent:'Explicit room edit',operations:[{op:'editRoom',target:room.id,room:{footprint:{...room.footprint,width:room.footprint.width-.4}}}]});
  expect(edit.ok,JSON.stringify(edit.errors)).toBe(true);
  const reload=checkoutPlanEvaluation(JSON.parse(JSON.stringify(edit.scene)));
  expect(reload.ok).toBe(true);expect(reload.scene!.interior!.rooms.find(r=>r.id===room.id)!.footprint.width).toBeCloseTo(room.footprint.width-.4);
 });
 it('supports the ordinary one-response full-property authoring path with the same room-intent contract',async()=>{
  const raw=relationshipGardenHome();let calls=0;
  const result=await generateV3FromArchitecturalBlueprint('A modest garden house',async()=>{calls++;return {output:{format:'v3-plan-first-1',plan:raw,exterior:roomPlanningExterior(raw)},finishReason:'stop'};},{allowRepair:false,requirePlanFirst:true});
  expect(calls).toBe(1);expect(result.ok,JSON.stringify(result.findings)).toBe(true);expect(roomWarnings(result.scene!)).toEqual([]);
 });
});

describe('ambiguous/infeasible intentions stay editable Drafts, without invented footprints',()=>{
 it('retains developed geometry as a Draft when the fixed entrance serves a different room',()=>{
  const raw=relationshipGardenHome();raw.buildings[0].accessOpenings[0].serves='garden-kitchen';
  const s=preparePlanEvaluation(raw);expect(s.ok).toBe(true);expect(s.scene!.interior!.rooms).toHaveLength(7);
  expect(s.scene!.metadata.roomLayoutDrafts).toHaveLength(1);expect(planConstructionBlockers(s).length).toBeGreaterThan(0);
  const checked=checkoutPlanEvaluation(JSON.parse(JSON.stringify(s.scene)));expect(checked.ok).toBe(true);expect(checked.scene!.interior!.rooms).toEqual(s.scene!.interior!.rooms);
 });
 it('retains bedroom obligations when an unresolved floor makes its geometry count incomplete',()=>{
  const raw=relationshipCourtEstate();Object.assign(raw,{requirements:[{id:'bedroom-obligation',source:'user',statement:'Three bedrooms',metric:'bedrooms',objectIds:['court-house'],range:{min:3,max:3}}]});
  Object.assign(raw.buildings[0].storeys[1].spaces[0],{size:{minWidth:100}});
  const s=preparePlanEvaluation(raw);expect(s.ok,JSON.stringify(s.findings)).toBe(true);expect(s.scene!.metadata.roomLayoutDrafts).toEqual(expect.arrayContaining([expect.objectContaining({storeyId:'court-floor-1'})]));
  expect(s.plan!.requirements[0].range).toEqual({min:3,max:3});expect(s.findings.some(f=>f.code==='ESTATE_REQUIREMENT_UNVERIFIED')).toBe(true);
  expect(checkoutPlanEvaluation(s.scene!).ok).toBe(true);
 });
 it('retains a contradictory adjacency and the entire intent, then resolves it through an explicit editor action',()=>{
  const raw=relationshipGardenHome();raw.roomAdjacencies.push({from:'garden-entry',to:'garden-living'});
  const stage=preparePlanEvaluation(raw);expect(stage.ok,JSON.stringify(stage.findings)).toBe(true);expect(stage.scene!.interior!.rooms).toEqual([]);
  expect(stage.findings.some(f=>f.code==='ROOM_LAYOUT_UNRESOLVED')).toBe(true);expect(planConstructionBlockers(stage).length).toBeGreaterThan(0);
  const saved=JSON.parse(JSON.stringify(stage.scene)),reloaded=checkoutPlanEvaluation(saved);expect(reloaded.ok,JSON.stringify(reloaded.findings)).toBe(true);
  expect(reloaded.scene!.metadata.roomLayoutDrafts).toEqual(stage.scene!.metadata.roomLayoutDrafts);expect(planConstructionBlockers(reloaded).length).toBeGreaterThan(0);
  // Explicitly redraw the public band as two storey-height zones to satisfy the
  // new direct relationship would be a design change; the engine cannot choose it.
  // Instead the architect removes the false direct adjacency in the current plan.
  saved.metadata.planUnresolved=saved.metadata.planUnresolved.filter((i:{raw:{from?:string;to?:string}})=>!(i.raw.from==='garden-entry'&&i.raw.to==='garden-living'));
  const draft=(saved.metadata.roomLayoutDrafts as RoomLayoutDraft[])[0];
  const fixed=reviseDraftRoomLayout(saved,draft.storeyId,{spaces:draft.spaces,layout:draft.layout});
  expect(fixed.ok,JSON.stringify(fixed.findings)).toBe(true);expect(fixed.scene!.metadata.roomLayoutDrafts).toEqual([]);expect(roomWarnings(fixed.scene!)).toEqual([]);expect(planConstructionBlockers(fixed)).toEqual([]);
 });
 it.each(['cycle','unused','missing-room','size','overlap-regions','outside-shell','narrow','conflicting-footprint'] as const)('preserves %s intent without fabricating geometry',kind=>{
  const raw=relationshipGardenHome(),floor=raw.buildings[0].storeys[0];
  if(kind==='cycle'){const node=floor.layout.nodes.find(n=>n.kind==='split')!;if(node.kind==='split')node.children[0].node=node.id;}
  if(kind==='unused')floor.layout.nodes.push({id:'unused-node',kind:'reserve',purpose:'unused'});
  if(kind==='missing-room'){const node=floor.layout.nodes.find(n=>n.kind==='room')!;if(node.kind==='room')node.roomId='unknown-room';}
  if(kind==='size')Object.assign(floor.spaces[0],{size:{minWidth:99}});
  if(kind==='narrow'){const node=floor.layout.nodes.find(n=>n.id==='garden-root')!;if(node.kind==='split')node.children[1].weight=.01;}
  if(kind==='overlap-regions')floor.layout.regions=[{root:'garden-root',bounds:{x:0,z:0,width:12,depth:10}},{root:'garden-root',bounds:{x:0,z:0,width:4,depth:4}}];
  if(kind==='outside-shell')floor.layout.regions=[{root:'garden-root',bounds:{x:1,z:0,width:12,depth:10}}];
  if(kind==='conflicting-footprint')Object.assign(floor.spaces[0],{footprint:{x:0,z:0,width:1,depth:1}});
  const before=JSON.stringify(raw),s=preparePlanEvaluation(raw);expect(s.ok,JSON.stringify(s.findings)).toBe(true);expect(s.scene!.metadata.roomLayoutDrafts).toHaveLength(1);
  expect(s.scene!.interior!.rooms).toHaveLength(kind==='conflicting-footprint'?1:0);expect(planConstructionBlockers(s).length).toBeGreaterThan(0);expect(JSON.stringify(raw)).toBe(before);
 });
 it('checks actual concave storeys and exact seams rather than only envelopes or seam tolerance',()=>{
  const raw=relationshipCourtEstate();Object.assign(raw.buildings[0].storeys[0].layout.regions[0],{bounds:{x:0,z:-5,width:8,depth:10}});
  const s=preparePlanEvaluation(raw);expect(s.ok).toBe(true);expect((s.scene!.metadata.roomLayoutDrafts as RoomLayoutDraft[])[0].findings.some(f=>f.message.includes('actual'))).toBe(true);
  expect(roomsShareAccessBoundary({x:0,z:0,width:2,depth:2},{x:2.04,z:0,width:2,depth:2})).toBe(false);
 });
 it('does not relocate a stair or silently accept an unaligned landing',()=>{
  const raw=relationshipCourtEstate();raw.verticalCirculation[0].footprint.x=-8;
  const s=preparePlanEvaluation(raw);expect(s.ok).toBe(true);expect(s.scene!.metadata.roomLayoutDrafts).toHaveLength(3);expect(s.plan!.verticalCirculation).toEqual(raw.verticalCirculation);expect(planConstructionBlockers(s).length).toBeGreaterThan(0);
 });
 it('audits a legacy rectangle spanning a concave court as outside its actual shell',()=>{
  const expanded=expandPlanAuthoring(relationshipCourtEstate());expect(expanded.success).toBe(true);if(!expanded.success)return;
  const plan=expanded.data;plan.buildings[0].storeys[0].spaces[0].footprint={x:0,z:-5,width:20,depth:8};
  expect(auditV3Interior(lowerV3ArchitecturalPlan(plan)).some(f=>f.code==='ROOM_OUTSIDE_HOST'&&f.targetId===plan.buildings[0].storeys[0].spaces[0].id)).toBe(true);
 });
});
