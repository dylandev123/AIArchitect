import { describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import original from './fixtures/canopy-meridian-attempt-0.json';
import { auditV3Blueprint } from '../blueprint';
import { approveV3Blueprint, auditV3BlueprintElaboration } from '../blueprintApproval';
import { v3EstatePlanSchema } from '../estatePlan';
import { ingestV3GenerationOutput } from '../ingestion';
import { compileV3Scene, validateV3CompiledGeometry, type V3Scene } from '../scene';
import * as construction from '../footprintConstruction';
import * as sceneModule from '../scene';
import { diverseBlueprintFixtures, indexBlueprint, mansionBlueprintFixture } from './blueprintFixtures';

const fatal = (scene: unknown) => auditV3Blueprint(scene).findings.filter(f=>f.severity==='fatal');

describe('V3 architectural blueprint foundation (offline)',()=>{
  it('validates the synthetic recovered mansion without facade construction or mutations',()=>{
    const scene=mansionBlueprintFixture(), snapshot=JSON.stringify(scene);
    const mass=vi.spyOn(construction,'compileFootprintMass'), roof=vi.spyOn(construction,'compileFootprintRoof'), compiler=vi.spyOn(sceneModule,'compileV3Scene');
    try {
      expect(fatal(scene)).toEqual([]);
      expect(mass).not.toHaveBeenCalled(); expect(roof).not.toHaveBeenCalled(); expect(compiler).not.toHaveBeenCalled();
      expect(JSON.stringify(scene)).toBe(snapshot);
      const minimal={...scene,objects:scene.objects.map(o=>{
        const next=structuredClone(o); delete (next as Partial<typeof next>).material;
        if(next.composition){delete next.composition.assemblies;delete next.composition.mainEntry;next.composition.openings=next.composition.openings?.filter(op=>['door','glazed-door'].includes(op.type));}
        return next;
      })};
      expect(fatal(minimal)).toEqual([]);
    } finally { vi.restoreAllMocks(); }
  });

  it.each(diverseBlueprintFixtures())('retains $name as a distinct valid architectural possibility',({scene})=>{
    expect(fatal(scene)).toEqual([]);
    expect(ingestV3GenerationOutput(scene,'flat',{requireBlueprint:true}).ok).toBe(true);
    const plain=structuredClone(scene);delete plain.estatePlan!.blueprint;
    expect(compileV3Scene(scene)).toEqual(compileV3Scene(plain));
    expect(validateV3CompiledGeometry(scene,compileV3Scene(scene),{lenient:true}).ok).toBe(true);
  });

  it('exposes recovered contradictions independently of the construction investigation',()=>{
    const scene=indexBlueprint(ingestV3GenerationOutput(original,'flat').scene), findings=fatal(scene);
    expect(findings.some(f=>f.code==='BLUEPRINT_ENTRANCE_WALL'&&f.targetIds.includes('southLivingDoor'))).toBe(true);
    expect(findings.some(f=>f.code==='BLUEPRINT_SITE_BOUNDS'&&f.targetIds.includes('southGarden'))).toBe(true);
    expect(findings.some(f=>f.code==='ESTATE_ACCESS_DISCONNECTED')).toBe(true);
    expect(findings.some(f=>f.code==='ESTATE_ALLOCATION_CONFLICT')).toBe(true);
    expect(approveV3Blueprint(scene).approval).toBeUndefined();
  });

  it.each([
    ['fixed site boundary',(s:V3Scene)=>{s.site.width=20;},'BLUEPRINT_SITE_BOUNDS'],
    ['missing building',(s:V3Scene)=>{s.estatePlan!.blueprint!.buildings[0].objectId='absent';},'BLUEPRINT_REFERENCE'],
    ['missing entrance',(s:V3Scene)=>{s.estatePlan!.blueprint!.entrances[0].openingId='absent';},'BLUEPRINT_ENTRANCE'],
    ['missing route',(s:V3Scene)=>{s.estatePlan!.blueprint!.routeIds.push('absent');},'BLUEPRINT_REFERENCE'],
    ['missing vertical circulation',(s:V3Scene)=>{s.interior!.circulation=[];s.estatePlan!.blueprint!.verticalCirculationIds=[];},'BLUEPRINT_VERTICAL'],
    ['stair outside host',(s:V3Scene)=>{s.interior!.circulation![0].footprint.x=999;},'BLUEPRINT_VERTICAL'],
    ['roof incompatible with outline',(s:V3Scene)=>{s.objects.find(o=>o.id==='mainRoof')!.roofForm='hip';},'ROOF_FOOTPRINT_UNSUPPORTED'],
    ['roof missing its host',(s:V3Scene)=>{s.objects.find(o=>o.id==='mainRoof')!.hostId='absent';},'BLUEPRINT_ROOF_HOST'],
    ['door targets wrong level',(s:V3Scene)=>{s.estatePlan!.blueprint!.entrances.find(e=>e.openingId==='southUpperDoor')!.level=0;},'BLUEPRINT_ENTRANCE'],
    ['unallocated requirement',(s:V3Scene)=>{s.estatePlan!.blueprint!.allocations=[];},'BLUEPRINT_ALLOCATION'],
    ['unresolved allocation',(s:V3Scene)=>{s.estatePlan!.blueprint!.allocations[0].roomIds=['missing-room'];},'BLUEPRINT_REFERENCE'],
    ['roof alignment',(s:V3Scene)=>{s.objects.find(o=>o.id==='mainRoof')!.architecture!.x+=1;},'ROOF_FOOTPRINT_ALIGNMENT_UNSUPPORTED'],
    ['disconnected stair',(s:V3Scene)=>{s.interior!.circulation![0].fromLevel=1;},'BLUEPRINT_VERTICAL'],
  ] as const)('rejects %s without choosing a replacement',(_name,change,code)=>{
    const scene=mansionBlueprintFixture();change(scene);const snapshot=JSON.stringify(scene);
    expect(fatal(scene).some(f=>f.code===code)).toBe(true);
    expect(JSON.stringify(scene)).toBe(snapshot);
  });

  it('checks line/arc entrance addresses without prescribing compass walls',()=>{
    const scene=diverseBlueprintFixtures()[2].scene;
    expect(fatal(scene)).toEqual([]);
    scene.objects[0].composition!.openings![0].segmentId='missing-arc';
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_ENTRANCE_WALL')).toBe(true);
    expect(auditV3Blueprint({...scene,objects:scene.objects.map(o=>({...o,roofForm:'unsupported-dome'}))}).ok).toBe(false);
  });

  it('rejects a path touching a building away from the actual designated door',()=>{
    const scene=mansionBlueprintFixture(),path=scene.objects.find(o=>o.id==='entryWalk')!;
    path.architecture!.x=15;path.architecture!.depth=16;path.architecture!.z=-18;
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_ROUTE_THRESHOLD')).toBe(true);
  });

  it('requires an explicit joining decision for overlapping building volumes',()=>{
    const scene=diverseBlueprintFixtures()[2].scene,copy=structuredClone(scene.objects[0]);copy.id='second-rotunda';
    scene.objects.push(copy);scene.estatePlan!.blueprint!.buildings.push({id:'second-building',objectId:copy.id,role:'Independent rotunda'});
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_BUILDING_OVERLAP')).toBe(true);
  });

  it('checks containment and roof-host commitments while leaving unspecified axes advisory',()=>{
    const scene=mansionBlueprintFixture();
    const claim={id:'pool-inside-arrival',kind:'contains' as const,from:'arrivalCourt',to:'reflectionPool',intent:'An impossible pool allocation'};
    scene.estatePlan!.relationships.push(claim);scene.relationships.push(claim);
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_CONTAINMENT')).toBe(true);
    scene.estatePlan!.relationships.pop();scene.relationships.pop();
    const host={id:'wrong-roof-host',kind:'hosts' as const,from:'guestPavilion',to:'mainRoof',intent:'A contradictory roof host'};
    scene.estatePlan!.relationships.push(host);scene.relationships.push(host);
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_ROOF_HOST')).toBe(true);
    scene.estatePlan!.relationships.pop();scene.relationships.pop();
    const axis={id:'open-view-axis',kind:'aligns' as const,from:'mainResidence',to:'reflectionPool',intent:'An architectural view alignment'};
    scene.estatePlan!.relationships.push(axis);scene.relationships.push(axis);
    expect(auditV3Blueprint(scene).findings.some(f=>f.code==='BLUEPRINT_RELATIONSHIP_UNVERIFIED'&&f.severity==='advisory')).toBe(true);
  });

  it('preserves shared stairs in touching, explicitly connected wings and planned stacked landings',()=>{
    const scene=diverseBlueprintFixtures()[3].scene,base=scene.objects[0],wing=structuredClone(base);
    scene.site.width=60;
    const brief=scene.estatePlan!.requirements.find(r=>r.metric==='siteWidth')!;
    brief.statement='Site 60 metres wide';brief.range={min:60,max:60};
    wing.id='joined-wing';wing.architecture!.x=12;scene.objects.push(wing);
    scene.relationships.push({from:base.id,to:wing.id,kind:'connects'});
    indexBlueprint(scene);
    expect(fatal(scene)).toEqual([]);
    // A one-storey upper mass is reached by an explicit stair ending at the host roof.
    const upper=structuredClone(base);upper.id='upper-mass';upper.levels=1;
    upper.architecture={...upper.architecture!,height:3,baseElevation:9,width:8,depth:10};upper.hostId=base.id;
    upper.composition={openings:[{id:'upper-local-door',type:'door',facade:'south',floors:'ground',start:.4,end:.6}]};
    scene.objects=[base,upper,...scene.objects.filter(o=>o.type!=='building-mass')];scene.relationships=[];
    scene.interior!.circulation!.push({...structuredClone(scene.interior!.circulation![0]),id:'upper-mass-stair',fromLevel:2,toLevel:3});indexBlueprint(scene);
    expect(fatal(scene)).toEqual([]);
    upper.architecture.x=8;
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_VERTICAL'&&f.targetIds.includes('upper-mass'))).toBe(true);
  });

  it('reports invalid optional hierarchy and duplicate semantic ids without crashing',()=>{
    const scene=mansionBlueprintFixture();
    expect(auditV3Blueprint({...scene,siteHierarchy:{}}).ok).toBe(false);
    scene.interior!.circulation![0].id=scene.objects[0].id;
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_DUPLICATE_ID')).toBe(true);
  });

  it('rejects overlapping rooms and allocation outside an actual sculptural boundary',()=>{
    const scene=diverseBlueprintFixtures()[0].scene;
    scene.interior!.storeys=[{id:'ground-storey',hostMassId:'residence',index:0,elevation:0,height:3.8,label:'Ground',semanticRole:'ground'}];
    const room={id:'living-room',hostMassId:'residence',storeyId:'ground-storey',program:'living',label:'Living',semanticRole:'living',footprint:{x:0,z:0,width:3,depth:3}};
    scene.interior!.rooms=[room,{...structuredClone(room),id:'other-room'}];
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_SPACE_OVERLAP')).toBe(true);
    scene.interior!.rooms=[{...room,footprint:{x:-8,z:6,width:2,depth:2}}];
    expect(fatal(scene).some(f=>f.code==='BLUEPRINT_SPACE_OUTSIDE_HOST')).toBe(true);
  });

  it.each([null,{}, {version:3,site:{width:NaN,depth:20}}, {version:3,objects:[null]}])('returns fatal diagnostics for malformed prerequisites %j',input=>{
    expect(()=>auditV3Blueprint(input)).not.toThrow();expect(auditV3Blueprint(input).ok).toBe(false);
  });

  it('detects duplicate stable references and retains unknown style/budget as advisory intent',()=>{
    const scene=mansionBlueprintFixture();
    expect(auditV3Blueprint(scene).findings.some(f=>f.severity==='advisory'&&f.code==='ESTATE_REQUIREMENT_UNVERIFIED')).toBe(true);
    scene.estatePlan!.blueprint!.entrances[0].id=scene.estatePlan!.program[0].id;
    expect(v3EstatePlanSchema.safeParse(scene.estatePlan).success).toBe(false);
    expect(auditV3Blueprint(scene).ok).toBe(false);
  });

  it('allows finishes/facade elaboration and rejects major spatial drift',()=>{
    const scene=mansionBlueprintFixture(), {approval}=approveV3Blueprint(scene);expect(approval).toBeDefined();
    scene.objects[0].material.color='#ffffff';
    const mass=scene.objects.find(o=>o.id==='mainResidence')!;
    mass.composition!.assemblies=[];
    expect(auditV3BlueprintElaboration(approval!,scene).ok).toBe(true);
    mass.architecture!.rotationY=.01;
    expect(auditV3BlueprintElaboration(approval!,scene).ok).toBe(false);
  });

  it('protects site constraints, approved identity, stairs, roof and outdoor geometry',()=>{
    const scene=mansionBlueprintFixture(),approval=approveV3Blueprint(scene).approval!;
    const changes=[(s:V3Scene)=>{s.site.width+=1;},(s:V3Scene)=>{s.estatePlan!.concept='A different concept';},(s:V3Scene)=>{s.interior!.circulation![0].footprint.x+=.1;},(s:V3Scene)=>{s.objects.find(o=>o.id==='mainRoof')!.pitch=1;},(s:V3Scene)=>{s.objects.find(o=>o.id==='reflectionPool')!.architecture!.width-=.1;}];
    for(const change of changes){const next=structuredClone(scene);change(next);expect(auditV3BlueprintElaboration(approval,next).ok).toBe(false);}
  });

  it('rejects contradictory blueprints at ingestion before detailed compilation; legacy remains opt-in',()=>{
    const scene=mansionBlueprintFixture();scene.estatePlan!.blueprint!.entrances[0].openingId='missing';
    const compile=vi.spyOn(sceneModule,'compileV3Scene'),mass=vi.spyOn(construction,'compileFootprintMass');
    try{
      const result=ingestV3GenerationOutput(scene,'flat');
      expect(result.ok).toBe(false);expect(result.blueprint?.ok).toBe(false);expect(result.geometryAudit).toBeUndefined();
      expect(compile).not.toHaveBeenCalled();expect(mass).not.toHaveBeenCalled();
    }finally{vi.restoreAllMocks();}
    delete scene.estatePlan!.blueprint;
    expect(ingestV3GenerationOutput(scene,'flat').ok).toBe(true);
    expect(ingestV3GenerationOutput(scene,'flat',{requireBlueprint:true}).ok).toBe(false);
  });

  it('accepts approved elaboration through existing ingestion and refuses a changed site',()=>{
    const scene=mansionBlueprintFixture(), approval=approveV3Blueprint(scene).approval!;
    expect(ingestV3GenerationOutput(scene,'flat',{approvedBlueprint:approval}).ok).toBe(true);
    scene.site.depth+=2;
    const result=ingestV3GenerationOutput(scene,'flat',{approvedBlueprint:approval});
    expect(result.ok).toBe(false);expect(result.blueprint!.findings.some(f=>f.code==='BLUEPRINT_DECISION_DRIFT')).toBe(true);
  });

  it('exports repeatable offline blueprint evidence when requested',()=>{
    const fixtures=[{name:'synthetic corrected recovered mansion',scene:mansionBlueprintFixture()},...diverseBlueprintFixtures()];
    const evidence=fixtures.map(({name,scene})=>({name,blueprint:scene.estatePlan!.blueprint,site:scene.site,audit:auditV3Blueprint(scene),geometry:validateV3CompiledGeometry(scene,compileV3Scene(scene),{lenient:true}).ok}));
    expect(evidence.every(e=>e.audit.ok&&e.geometry)).toBe(true);
    if(process.env.BLUEPRINT_REPLAY_OUTPUT)writeFileSync(process.env.BLUEPRINT_REPLAY_OUTPUT,JSON.stringify({offline:true,fixtures:evidence},null,2)+'\n');
  });
});
