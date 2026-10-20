import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import canopy0 from './fixtures/canopy-meridian-attempt-0.json';
import canopy1 from './fixtures/canopy-meridian-attempt-1.json';
import cloister0 from './fixtures/blueprint-cloister-attempt-0.json';
import cloister1 from './fixtures/blueprint-cloister-attempt-1.json';
import { diverseBlueprintFixtures, indexBlueprint } from './blueprintFixtures';
import { blueprintProviderOutput } from './blueprintProviderFixtures';
import { compileV3Scene, type V3Scene } from '../scene';
import { normalizeV3GenerationOutput } from '../generation';
import { ingestV3GenerationOutput } from '../ingestion';
import { resolveV3ZoneGeometry } from '../zoneGeometry';
import { auditV3EstatePlan, v3EstatePlanSchema } from '../estatePlan';
import { spatialPlanPoints } from '../routeGeometry';
import { resolveV3Circulation, v3StairAccessGeometry } from '../circulation';
import { auditV3StairUsability } from '../stairUsability';
import { assessV3ObjectiveRevision } from '../safeRevision';
import { auditV3Blueprint } from '../blueprint';
import { approveV3Blueprint } from '../blueprintApproval';
import { stairFixture } from '../parity/geometryAuthority';


const ingest=(scene:V3Scene)=>ingestV3GenerationOutput(blueprintProviderOutput(scene),'flat',{requireDesignConsistency:true,requireBlueprint:!!scene.estatePlan?.blueprint});
const audit=(s:V3Scene)=>auditV3StairUsability(s,compileV3Scene(s).primitives);
const derived=(s:V3Scene)=>{const copy=structuredClone(s);for(const zone of copy.estatePlan!.zones){zone.allocationMode='derived';delete zone.allocation;}return copy;};

describe('zone geometry authority',()=>{
  it('requires an unambiguous mode and preserves legacy reservations',()=>{
    const plan=diverseBlueprintFixtures()[0].scene.estatePlan!;
    for(const zone of [
      {id:'zone',purpose:'group',objectIds:[],allocationMode:'derived'},
      {id:'zone',purpose:'garden',objectIds:[],allocation:{x:0,z:0,width:5,depth:5}},
      {id:'zone',purpose:'garden',objectIds:[],allocationMode:'reserved',allocation:{x:0,z:0,width:5,depth:5}},
    ])expect(v3EstatePlanSchema.safeParse({...plan,zones:[zone]}).success).toBe(true);
    for(const zone of [{id:'zone',purpose:'missing boundary',objectIds:[]},{id:'zone',purpose:'competing geometry',objectIds:[],allocationMode:'derived',allocation:{x:0,z:0,width:5,depth:5}}])expect(v3EstatePlanSchema.safeParse({...plan,zones:[zone]}).success).toBe(false);
  });
  it('measures complex footprints from existing objects and updates without persistence',()=>{
    const scene=diverseBlueprintFixtures()[0].scene;
    const zone={id:'derived',purpose:'Sculpture',objectIds:scene.objects.filter(o=>o.type==='building-mass').map(o=>o.id),allocationMode:'derived' as const};
    scene.estatePlan!.zones=[zone];
    const snapshot=JSON.stringify(scene),measurement=resolveV3ZoneGeometry(scene,zone);
    const points=zone.objectIds.flatMap(id=>spatialPlanPoints(scene,scene.objects.find(o=>o.id===id)!));
    expect(measurement.envelope!.width).toBeCloseTo(Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])));
    expect(JSON.stringify(scene)).toBe(snapshot);
    const moved=structuredClone(scene);for(const o of moved.objects)if(zone.objectIds.includes(o.id)){if(o.architecture)o.architecture.x+=2;else o.transform.position[0]+=2;}
    expect(resolveV3ZoneGeometry(moved,zone).envelope!.x).toBeCloseTo(measurement.envelope!.x+2);
    expect(auditV3Blueprint(scene).findings.filter(f=>f.code==='ESTATE_ALLOCATION_CONFLICT')).toEqual([]);
  });
  it('shares canonical bent ribbon geometry across overlapping memberships',()=>{
    const scene=normalizeV3GenerationOutput(cloister1,'flat').scene;
    const owner=scene.estatePlan!.circulation.find(r=>r.id==='route-guest')!.via[0];
    const a={id:'a',purpose:'walk',objectIds:[owner],allocationMode:'derived' as const},b={...a,id:'b'};
    scene.estatePlan!.zones=[a,b];
    const ribbon=spatialPlanPoints(scene,scene.objects.find(o=>o.id===owner)!);
    expect(resolveV3ZoneGeometry(scene,a)).toEqual(resolveV3ZoneGeometry(scene,b));
    expect(resolveV3ZoneGeometry(scene,a).envelope!.width).toBeCloseTo(Math.max(...ribbon.map(p=>p[0]))-Math.min(...ribbon.map(p=>p[0])));
    expect(auditV3EstatePlan(scene).filter(f=>f.code==='ESTATE_ALLOCATION_CONFLICT')).toEqual([]);
  });
  it('measures hierarchy route ribbons from construction instead of their compatibility boxes',()=>{
    const scene=stairFixture();scene.interior=undefined;
    scene.objects.push({...structuredClone(scene.objects[0]),id:'walk',type:'path',levels:undefined,dimensions:[99,.1,99],transform:{position:[0,.05,0],rotation:[0,0,0],scale:[1,1,1]}});
    scene.siteHierarchy={levels:[{id:'ground',elevation:0,region:{x:0,z:0,width:60,depth:60},supportType:'pad'}],connections:[{id:'walk-route',type:'path',fromLevelId:'ground',toLevelId:'ground',route:[[0,0,10],[10,0,10],[10,0,20]],width:2,surfaceObjectId:'walk'}]};
    const zone={id:'route-zone',purpose:'Measured route',objectIds:['walk'],allocationMode:'derived' as const};
    expect(resolveV3ZoneGeometry(scene,zone).envelope).toEqual({x:5.5,z:14.5,width:11,depth:11});
  });
  it('retains garden boundaries and independent empty courtyard volumes',()=>{
    const scene=stairFixture();scene.estatePlan={...diverseBlueprintFixtures()[0].scene.estatePlan!,blueprint:undefined,program:[],zones:[{id:'garden',purpose:'Reserved future garden',objectIds:['house'],allocationMode:'reserved',allocation:{x:0,z:0,width:2,depth:2}},{id:'court',purpose:'Keep courtyard empty',objectIds:[],allocationMode:'derived',clearSpace:{x:0,z:0,width:3,depth:3,baseElevation:0,height:2}}]};
    const before=JSON.stringify(scene.estatePlan);
    expect(auditV3EstatePlan(scene).map(f=>f.code)).toEqual(expect.arrayContaining(['ESTATE_ALLOCATION_CONFLICT','ESTATE_OPEN_SPACE_BLOCKED']));
    scene.estatePlan.zones[0].allocation!.x=100;
    expect(auditV3EstatePlan(scene).some(f=>f.message.includes('exceeds the site boundary'))).toBe(true);
    scene.estatePlan.zones[0].allocation!.x=0;
    expect(JSON.stringify(scene.estatePlan)).toBe(before);
  });
});

describe('physical stair acceptance',()=>{
  it.each(['straight','l-shaped','u-shaped','spiral'] as const)('accepts authored %s access with correctly cut floor openings',type=>{
    const scene=stairFixture(type);
    expect(audit(scene)).toEqual([]);
    expect(ingest(scene).ok).toBe(true);
    const model=compileV3Scene(scene),[r]=resolveV3Circulation(scene);
    expect(v3StairAccessGeometry(r).walk.length).toBeGreaterThan(10);
    const slab=model.primitives.find(p=>p.category==='floor'&&p.id.includes('slab-2'))!;
    expect(slab.kind).toBe('triMesh');
  });
  it.each(['straight','l-shaped','u-shaped','spiral'] as const)('preserves %s stairs across turns, directions and host rotation',type=>{
    for(const direction of ['north','east','south','west'] as const)for(const turn of ['left','right'] as const){
      const scene=stairFixture(type),entry=scene.interior!.circulation![0];entry.direction=direction;entry.turn=turn;
      if(direction==='east'||direction==='west')[entry.footprint.width,entry.footprint.depth]=[entry.footprint.depth,entry.footprint.width];
      scene.objects[0].transform.rotation[1]=.35;
      expect(audit(scene),`${type} ${direction} ${turn}`).toEqual([]);
    }
  });
  it('cuts a hosted terrace walking surface along with the roof slab',()=>{
    const scene=stairFixture('u-shaped');scene.objects[0].levels=1;scene.objects[0].dimensions[1]=3.2;scene.objects[0].transform.position[1]=1.6;
    scene.objects.push({...structuredClone(scene.objects[0]),id:'roof-deck',type:'terrace',levels:undefined,hostId:'house',dimensions:[20,.2,20],transform:{position:[0,3.3,0],rotation:[0,0,0],scale:[1,1,1]}});
    // Another terrace at the same datum must not become this stair's landing by list order.
    scene.objects.splice(1,0,{...structuredClone(scene.objects[1]),id:'other-deck',dimensions:[2,.2,2],transform:{position:[7,3.3,7],rotation:[0,0,0],scale:[1,1,1]}});
    expect(audit(scene)).toEqual([]);
    expect(compileV3Scene(scene).primitives.find(p=>p.id==='roof-deck-surface')!.kind).toBe('triMesh');
  });
  it('rejects blocked entry approaches and physically intersecting obstacles',()=>{
    const scene=stairFixture(),p=v3StairAccessGeometry(resolveV3Circulation(scene)[0]).entry;
    scene.objects.push({...structuredClone(scene.objects[0]),id:'obstacle',type:'volume',geometryKind:'box',levels:undefined,dimensions:[2,3,1],transform:{position:[p[0],p[1]+1.5,p[2]],rotation:[0,0,0],scale:[1,1,1]},collision:'solid'});
    expect(audit(scene).some(f=>f.code==='STAIR_ACCESS_BLOCKED')).toBe(true);
    expect(ingest(scene).ok).toBe(false);
  });
  it('checks real partition walls and respects their constructed door openings',()=>{
    const scene=stairFixture();
    scene.interior!.storeys=[{id:'ground',hostMassId:'house',index:0,elevation:.26,height:3.2,label:'Ground',semanticRole:'ground'}];
    scene.interior!.rooms=[{id:'north',storeyId:'ground',hostMassId:'house',program:'hall',label:'North',semanticRole:'hall',footprint:{x:0,z:-3.5,width:10,depth:13}}, {id:'south',storeyId:'ground',hostMassId:'house',program:'hall',label:'South',semanticRole:'hall',footprint:{x:0,z:6.5,width:10,depth:7}}];
    scene.relationships.push({from:'north',to:'south',kind:'adjacent'});
    scene.interior!.partitions=[{id:'access-wall',storeyId:'ground',roomAId:'north',roomBId:'south',boundaryId:'boundary:north|south',partitionType:'wall',semanticRole:'stair approach wall'}];
    // The boundary z=3 sits just beyond the entry portal and across the approach to the first tread.
    scene.interior!.circulation![0].footprint.z=.5;
    expect(audit(scene).some(f=>f.code==='STAIR_ACCESS_BLOCKED')).toBe(true);
    scene.interior!.doors=[{id:'access-door',partitionId:'access-wall',offset:5,width:1.2,program:'archway',semanticRole:'stair access'}];
    expect(audit(scene)).toEqual([]);
  });
  it('rejects an unreachable upper landing even when the reservation fits',()=>{
    const scene=stairFixture();scene.interior!.circulation![0].footprint.z=-7.5;
    expect(resolveV3Circulation(scene)[0].usable).toBe(true);
    expect(audit(scene).some(f=>f.code==='STAIR_APPROACH_UNSUPPORTED')).toBe(true);
    expect(ingest(scene).ok).toBe(false);
  });
  it('rejects a mismatched intended storey and invalid level connections',()=>{
    const scene=stairFixture();scene.interior!.storeys=[{id:'upper',hostMassId:'house',index:1,elevation:4,height:3.2,label:'Upper',semanticRole:'upper'}];
    expect(audit(scene).some(f=>f.code==='STAIR_STOREY_MISMATCH')).toBe(true);
    scene.interior!.circulation![0].toLevel=3;
    expect(audit(scene).some(f=>f.code==='CIRCULATION_LEVELS_INVALID')).toBe(true);
  });
  it('audits actual floor openings and catches an intact or misplaced slab',()=>{
    const scene=stairFixture(),model=compileV3Scene(scene);
    const noStair=structuredClone(scene);noStair.interior!.circulation=[];
    const intact=compileV3Scene(noStair).primitives.find(p=>p.id==='house-slab-2')!;
    const blocked=model.primitives.map(p=>p.id===intact.id?intact:p);
    expect(auditV3StairUsability(scene,blocked).some(f=>f.code==='STAIR_OPENING_BLOCKED')).toBe(true);
    expect(auditV3StairUsability(scene,model.primitives)).toEqual([]);
  });
  it('withholds blueprint approval until physical stair access is usable',()=>{
    const scene=stairFixture();scene.estatePlan={...diverseBlueprintFixtures()[0].scene.estatePlan!,program:[],zones:[]};indexBlueprint(scene);
    scene.objects.push({...structuredClone(scene.objects[0]),id:'obstacle',type:'volume',geometryKind:'box',levels:undefined,dimensions:[2,3,1],transform:{position:[0,1.76,2.95],rotation:[0,0,0],scale:[1,1,1]}});
    const rejected=ingest(scene);
    expect(approveV3Blueprint(scene).approval).toBeUndefined();
    expect(rejected.ok).toBe(false);expect(rejected.blueprintApproval).toBeUndefined();
  });
  it('allows only a diagnosed stair correction and refuses deletion, requirement removal and unrelated changes',()=>{
    const good=stairFixture('u-shaped');
    good.estatePlan={version:1,concept:'Independent circulation',character:'Preserved intent',requirements:[{id:'access-req',source:'user',metric:'feature',statement:'Upper storey must have usable stairs',objectIds:['house']}],program:[],zones:[],circulation:[],relationships:[],considerations:[]};
    good.interior!.circulation!.push({...structuredClone(good.interior!.circulation![0]),id:'unrelated-stair',footprint:{...good.interior!.circulation![0].footprint,x:5}});
    const bad=structuredClone(good);bad.interior!.circulation![0].footprint.width=.4;
    const rejected=ingest(bad),corrected=ingest(good);
    expect(rejected.ok).toBe(false);expect(corrected.ok).toBe(true);
    expect(assessV3ObjectiveRevision(rejected.scene,corrected.scene,rejected.validation.issues).accepted).toBe(true);
    for(const mutate of [(s:V3Scene)=>{s.interior!.circulation=[];},(s:V3Scene)=>{s.objects[0].material.color='#000000';},(s:V3Scene)=>{s.interior!.circulation![0].toLevel=2;},(s:V3Scene)=>{s.estatePlan!.requirements=[];},(s:V3Scene)=>{s.interior!.circulation![1].footprint.x=6;}]){
      const candidate=structuredClone(corrected.scene);mutate(candidate);
      expect(assessV3ObjectiveRevision(rejected.scene,candidate,rejected.validation.issues).accepted).toBe(false);
    }
  });
});

it('replays untouched estates and labels derived-mode counterfactuals without inventing corrections',()=>{
  const replay=[['canopy-initial',canopy0],['canopy-repair',canopy1],['cloister-initial',cloister0],['cloister-repair',cloister1]] as const;
  const results=replay.map(([name,raw])=>{
    const bytes=JSON.stringify(raw),scene=normalizeV3GenerationOutput(raw,'flat').scene;
    const options={requireDesignConsistency:true,requireBlueprint:name.startsWith('cloister')};
    const original=ingestV3GenerationOutput(raw,'flat',options),counterfactual=ingestV3GenerationOutput(derived(scene),'flat',options);
    const allocation=(s:V3Scene)=>auditV3EstatePlan(s).filter(f=>f.code==='ESTATE_ALLOCATION_CONFLICT');
    expect(original.ok).toBe(false);expect(counterfactual.ok).toBe(false);
    expect(allocation(derived(scene))).toEqual([]);
    expect(assessV3ObjectiveRevision(original.scene,counterfactual.scene,original.validation.issues).accepted).toBe(false);
    expect(JSON.stringify(raw)).toBe(bytes);
    return {name,sha256:createHash('sha256').update(bytes).digest('hex'),originalAccepted:original.ok,originalAllocations:allocation(scene),
      authoredStairs:audit(scene),derivedModeCounterfactual:{accepted:counterfactual.ok,allocations:allocation(derived(scene)),issues:counterfactual.validation.issues},
      note:'All legacy allocations remain intentional reservations in production. Counterfactual explicitly opts each zone into derived mode; no stair, object, route, boundary or requirement correction is inferred.'};
  });
  if(process.env.GEOMETRY_AUTHORITY_REPLAY)writeFileSync(process.env.GEOMETRY_AUTHORITY_REPLAY,JSON.stringify(results,null,2)+'\n');
},20000);
