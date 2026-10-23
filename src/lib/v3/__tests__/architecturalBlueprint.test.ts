import { describe,it,expect,vi } from 'vitest';
import * as sceneModule from '../scene';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { planV3ArchitecturalBlueprint,constructV3ArchitecturalBlueprint,reviseV3ArchitecturalBlueprint,checkoutV3ArchitecturalBlueprint,v3ArchitecturalBlueprintSchema } from '../architecturalBlueprint';
import { crescentEstateBlueprint,distinctArchitecturalBlueprints } from '../parity/architecturalBlueprint';
import { compileV3Scene } from '../scene';
import { executeV3SceneOperations } from '../operations';
import { ingestV3GenerationOutput } from '../ingestion';
import { estateEndpoint,estateRouteVertices } from '../routeGeometry';
import { resolveFootprint } from '../footprint';
import { materializeV3ArchitecturalObject,runtimeGeometryMatchesArchitecture } from '../architecture';
import canopy0 from './fixtures/canopy-meridian-attempt-0.json';
import canopy1 from './fixtures/canopy-meridian-attempt-1.json';
import cloister0 from './fixtures/blueprint-cloister-attempt-0.json';
import cloister1 from './fixtures/blueprint-cloister-attempt-1.json';
const build=(bp=crescentEstateBlueprint())=>{
  const planning=planV3ArchitecturalBlueprint(bp);
  expect(planning.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(planning.ok).toBe(true);
  const built=constructV3ArchitecturalBlueprint(planning.approval!);
  expect(built.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(built.ok).toBe(true);
  return {planning,built,scene:built.scene!};
};

describe('independent complete architectural blueprint → existing V3 construction',{timeout:20_000},()=>{
  it.each(distinctArchitecturalBlueprints())('constructs $name with the approved forms and identities',({blueprint})=>{
    const before=structuredClone(blueprint),{scene,built}=build(blueprint);
    expect(blueprint).toEqual(before);expect('objects' in blueprint).toBe(false);
    expect(scene.objects.map(o=>o.id)).toEqual(blueprint.buildings.flatMap(b=>[b.id,b.roof.id]).concat(blueprint.features.map(f=>f.id),blueprint.connections.map(c=>c.surfaceId)));
    for(const b of blueprint.buildings){
      const mass=scene.objects.find(o=>o.id===b.id)!,roof=scene.objects.find(o=>o.id===b.roof.id)!;
      expect(runtimeGeometryMatchesArchitecture(mass)).toBe(true);
      expect(roof.hostId).toBe(b.id);expect(roof.architecture!.x).toBe(b.location.x);
      expect(roof.architecture!.baseElevation).toBe(b.location.baseElevation+b.storeys.reduce((sum,s)=>sum+s.height,0));
      if(b.plan.kind==='outline')expect(mass.composition!.footprint!.segments).toEqual(b.plan.segments);
      if(b.plan.kind!=='rectangle')expect(resolveFootprint(mass,0)).toBeDefined();
      expect(built.model!.primitives.some(p=>p.sourceObjectId===roof.id&&p.category==='roof')).toBe(true);
    }
    for(const route of scene.estatePlan!.circulation){
      const mesh=built.model!.primitives.find(p=>p.id===`v3-connection-estate:${route.id}`)!;
      expect(mesh.kind).toBe('triMesh');if(mesh.kind==='triMesh')expect(mesh.vertices).toEqual(estateRouteVertices(scene,route));
    }
    expect(JSON.stringify(scene)).not.toContain('v3-architectural-blueprint-1');
    const reload=ingestV3GenerationOutput(JSON.parse(JSON.stringify(scene)),'flat',{requireBlueprint:true,requireDesignConsistency:true});
    expect(reload.ok).toBe(true);expect(compileV3Scene(reload.scene)).toEqual(built.model);
  });
  it('approves independently, captures immutable decisions and refuses forged/serialized evidence',()=>{
    const bp=crescentEstateBlueprint(),approval=planV3ArchitecturalBlueprint(bp).approval!;
    expect(approval).toEqual({kind:'v3-architectural-approval'});
    bp.buildings[0].location.x=200;bp.buildings[0].plan={kind:'rectangle',width:1,depth:1};
    expect(constructV3ArchitecturalBlueprint(approval).scene!.objects[0].architecture!.x).toBe(0);
    expect(constructV3ArchitecturalBlueprint(JSON.parse(JSON.stringify(approval))).ok).toBe(false);
  });
  it('never invokes detailed V3 compilation during preliminary validation',()=>{
    const compile=vi.spyOn(sceneModule,'compileV3Scene');
    try{
      const planned=planV3ArchitecturalBlueprint(crescentEstateBlueprint());
      expect(planned.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(planned.ok).toBe(true);expect(compile).not.toHaveBeenCalled();
      expect(constructV3ArchitecturalBlueprint(planned.approval!).ok).toBe(true);expect(compile).toHaveBeenCalled();
    }finally{compile.mockRestore();}
  });
  it('keeps preliminary approval separate from detailed physical acceptance and returns no contradictory scene',()=>{
    const bp=crescentEstateBlueprint(),spaces=bp.buildings[0].storeys[0].spaces;
    spaces[0].footprint={x:-14,z:-7.6,width:6,depth:.8};
    spaces.push({id:'library-south',label:'South library',role:'Quiet reading',program:'study',footprint:{x:-14,z:-2.6,width:6,depth:9.2}});
    bp.roomAdjacencies.push({from:'west-study',to:'library-south'});
    bp.partitions.push({id:'blocked-stair-wall',storeyId:'house-ground',roomAId:'west-study',roomBId:'library-south',boundaryId:'boundary:library-south|west-study',partitionType:'wall',semanticRole:'Explicit wall across the stair'});
    const planned=planV3ArchitecturalBlueprint(bp);
    expect(planned.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(planned.ok).toBe(true);
    const result=constructV3ArchitecturalBlueprint(planned.approval!);
    expect(result.ok).toBe(false);expect(result.scene).toBeUndefined();expect(result.model).toBeUndefined();
    expect(result.findings.some(f=>f.code.startsWith('STAIR_')&&f.severity==='fatal')).toBe(true);
  });
  it('refuses erased architecture even when the remaining geometry is finite and renderable',()=>{
    const planned=planV3ArchitecturalBlueprint(crescentEstateBlueprint()),compile=sceneModule.compileV3Scene;
    const spy=vi.spyOn(sceneModule,'compileV3Scene').mockImplementation(scene=>{const model=compile(scene);return {...model,primitives:model.primitives.filter(p=>p.sourceObjectId!=='atelier-roof')};});
    try{
      const result=constructV3ArchitecturalBlueprint(planned.approval!);
      expect(result.ok).toBe(false);expect(result.scene).toBeUndefined();
      expect(result.findings.some(f=>f.code==='ARCHITECTURAL_COMPONENT_UNBUILT'&&f.targetIds.includes('atelier-roof'))).toBe(true);
    }finally{spy.mockRestore();}
  });
  it.each(distinctArchitecturalBlueprints())('reopens $name from persisted V3 semantics without a second persisted blueprint',({blueprint})=>{
    const {scene}=build(JSON.parse(JSON.stringify(blueprint)));
    const checkout=checkoutV3ArchitecturalBlueprint(JSON.parse(JSON.stringify(scene)));
    expect(checkout.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(checkout.ok).toBe(true);
    expect(constructV3ArchitecturalBlueprint(checkout.approval!).model).toEqual(compileV3Scene(scene));
    const next=structuredClone(checkout.blueprint!);next.buildings[0].location.x+=1;
    const edited=reviseV3ArchitecturalBlueprint(scene,checkout.approval!,next);
    expect(edited.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(edited.ok).toBe(true);
  });
  it('diagnoses legacy gaps and unsupported data instead of manufacturing a complete blueprint',()=>{
    for(const raw of [canopy0,canopy1,cloister0,cloister1]){
      const scene=ingestV3GenerationOutput(raw,'flat').scene,before=structuredClone(scene),checkout=checkoutV3ArchitecturalBlueprint(scene);
      expect(checkout.ok).toBe(false);expect(checkout.blueprint).toBeUndefined();expect(checkout.approval).toBeUndefined();expect(scene).toEqual(before);
    }
    const {scene}=build();scene.objects[0].composition!.assemblies=[{id:'sunshade',intent:'Explicit shade assembly',parts:[]}];
    expect(checkoutV3ArchitecturalBlueprint(scene).findings.map(f=>f.code)).toContain('ARCHITECTURAL_CHECKOUT_UNSUPPORTED');
  });
  it.each([
    ['unsupported dome',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.buildings[0].roof.form='dome';},'ARCHITECTURAL_ROOF_UNSUPPORTED'],
    ['hip over curve',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.buildings[0].roof.form='hip';b.buildings[0].roof.pitchDegrees=25;},'ROOF_FOOTPRINT_UNSUPPORTED'],
    ['tiny stair',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.verticalCirculation[0].footprint.width=.4;b.verticalCirculation[0].footprint.depth=.5;},'CIRCULATION_NOT_USABLE'],
    ['missing material',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.buildings[0].materialId='missing';},'ARCHITECTURAL_MATERIAL'],
    ['unsupported feature',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.features[0].type='tennis-court';},'ARCHITECTURAL_FEATURE_UNSUPPORTED'],
    ['missing entrance',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.entrances[0].openingId='missing';},'BLUEPRINT_ENTRANCE'],
    ['duplicate identity',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.features[0].id=b.buildings[0].id;},'ARCHITECTURAL_DUPLICATE_ID'],
    ['site overrun',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.features[3].location.x=-80;},'BLUEPRINT_SITE_BOUNDS'],
    ['route through house',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.connections[2].waypoints=[[0,0,0]];},'ESTATE_ROUTE_BLOCKED'],
    ['room outside curve',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.buildings[0].storeys[0].spaces[0].footprint.x=-40;},'BLUEPRINT_SPACE_OUTSIDE_HOST'],
    ['erased storeys via double-height',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.buildings[0].facade.spaceHeight='double-height';},'ARCHITECTURAL_COMPILER_OVERRIDE'],
    ['replaced roof finish',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.buildings[0].roof.materialId='limestone';},'ARCHITECTURAL_COMPILER_OVERRIDE'],
    ['unsupported ground datum',(b:ReturnType<typeof crescentEstateBlueprint>)=>{Object.assign(b.site,{baseElevation:3});},'ARCHITECTURAL_BLUEPRINT_INPUT'],
    ['custom courtyard finish',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.features[0].materialId='timber';},'ARCHITECTURAL_COMPILER_OVERRIDE'],
    ['thin landscape proxy',(b:ReturnType<typeof crescentEstateBlueprint>)=>{b.features[3].height=.01;},'ARCHITECTURAL_COMPILER_OVERRIDE'],
  ] as const)('fails preliminary planning for %s without a construction permit',(_name,mutate,code)=>{
    const bp=crescentEstateBlueprint();mutate(bp);const result=planV3ArchitecturalBlueprint(bp);
    expect(result.ok).toBe(false);expect(result.approval).toBeUndefined();expect(result.findings.map(f=>f.code)).toContain(code);
  });
  it('rejects second independent placement fields and malformed/erased outline segments',()=>{
    const bp=crescentEstateBlueprint();
    for(const extra of [{objects:[]},{...bp,buildings:[{...bp.buildings[0],transform:{position:[0,0,0]}}]}])expect(planV3ArchitecturalBlueprint({...bp,...extra}).ok).toBe(false);
    const outline=bp.buildings[0].plan;if(outline.kind!=='outline')throw Error('fixture');
    outline.segments[0].end=[0,0];expect(planV3ArchitecturalBlueprint(bp).ok).toBe(false);
    expect(v3ArchitecturalBlueprintSchema.safeParse({...bp,site:{...bp.site,north:'+x'}}).success).toBe(false);
  });
  it('moves/resizes the approved arc and derives host roof, entrance and approach once',()=>{
    const bp=crescentEstateBlueprint(),{planning,scene}=build(bp),next=structuredClone(bp);
    next.buildings[0].location.x=3;
    const result=reviseV3ArchitecturalBlueprint(scene,planning.approval!,next);
    expect(result.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(result.ok).toBe(true);
    expect(result.scene!.objects.find(o=>o.id==='crescent-roof')!.architecture!.x).toBe(3);
    const route=scene.estatePlan!.circulation.find(r=>r.id==='principal-approach')!;
    expect(estateEndpoint(result.scene!,route,'to')![0]-estateEndpoint(scene,route,'to')![0]).toBeCloseTo(3);
    expect(result.scene!.objects[0].composition!.footprint).toEqual(scene.objects[0].composition!.footprint);
    expect(result.model).not.toEqual(compileV3Scene(scene));
  });
  it('updates articulated dimensions, roof outline and surface-relative access on replan',()=>{
    const bp=distinctArchitecturalBlueprints()[2].blueprint,{scene,planning}=build(bp),next=structuredClone(bp);
    if(next.buildings[0].plan.kind!=='articulated')throw Error('fixture');
    next.buildings[0].plan.width=34;next.features[0].location.x=1;
    const result=reviseV3ArchitecturalBlueprint(scene,planning.approval!,next);
    expect(result.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(result.ok).toBe(true);
    expect(result.scene!.objects.find(o=>o.type==='roof-form')!.architecture!.width).toBe(34);
    expect(resolveFootprint(result.scene!.objects[0],0)!.polygon).not.toEqual(resolveFootprint(scene.objects[0],0)!.polygon);
  });
  it('keeps existing scene material/opening edits and unrelated additions during an explicit geometry replan',()=>{
    const bp=crescentEstateBlueprint(),{scene,planning}=build(bp),composition=structuredClone(scene.objects[0].composition!);
    composition.openings!.push({id:'library-window',type:'glazing-zone',facade:'west',segmentId:'west-wall',start:.1,end:.3,heightRatio:.5});
    const edit=executeV3SceneOperations(scene,{intent:'Edit the actual V3 scene',operations:[{op:'changeMaterial',target:'orchard-atelier',material:{id:'local-stucco',color:'#e3d5bc',surface:'stucco'}},{op:'setComposition',target:'crescent-house',composition}]});
    expect(edit.errors).toEqual([]);expect(edit.ok).toBe(true);
    const localAddition=structuredClone(edit.scene.objects.find(o=>o.id==='orchard')!);localAddition.id='new-clearing';localAddition.architecture!.x=42;localAddition.architecture!.z=29;
    edit.scene.objects.push(localAddition);
    const next=structuredClone(bp);next.buildings[0].location.x=2;
    const result=reviseV3ArchitecturalBlueprint(edit.scene,planning.approval!,next);
    expect(result.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(result.ok).toBe(true);
    expect(result.scene!.objects.find(o=>o.id==='orchard-atelier')!.material.id).toBe('local-stucco');
    expect(result.scene!.objects[0].composition!.openings!.some(o=>o.id==='library-window')).toBe(true);
    expect(result.scene!.objects.find(o=>o.id==='new-clearing')).toEqual(materializeV3ArchitecturalObject(localAddition));
    const reload=ingestV3GenerationOutput(JSON.parse(JSON.stringify(result.scene)),'flat',{requireBlueprint:true,requireDesignConsistency:true});
    expect(reload.ok).toBe(true);expect(compileV3Scene(reload.scene)).toEqual(result.model);
  });
  it('preserves correct finished-floor authority and tests true outline resizing without a copied envelope',()=>{
    const bp=distinctArchitecturalBlueprints()[1].blueprint,{scene,planning}=build(bp),next=structuredClone(bp);
    const p=next.buildings[0].plan;if(p.kind!=='outline')throw Error('fixture');p.segments[0].radius=12;
    const result=reviseV3ArchitecturalBlueprint(scene,planning.approval!,next);
    expect(result.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(result.ok).toBe(true);
    expect(result.scene!.objects[0].architecture!.width).toBe(24);
    expect(result.scene!.objects[1].architecture!.width).toBe(24);
    expect(result.scene!.interior!.storeys[0].elevation).toBe(.26);
  });
  it('rotates an approved curved residence without replacing its arc, entrance or roof',()=>{
    const bp=distinctArchitecturalBlueprints()[1].blueprint,{scene,planning}=build(bp),next=structuredClone(bp);
    next.buildings[0].location.rotationY=.2;
    const result=reviseV3ArchitecturalBlueprint(scene,planning.approval!,next);
    expect(result.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(result.ok).toBe(true);
    expect(result.scene!.objects[0].composition!.footprint).toEqual(scene.objects[0].composition!.footprint);
    expect(result.scene!.objects[1].architecture!.rotationY).toBe(.2);
    const r=scene.estatePlan!.circulation[0];expect(estateEndpoint(result.scene!,r,'to')).not.toEqual(estateEndpoint(scene,r,'to'));
  });
  it('fails conflicting local geometry edits atomically',()=>{
    const bp=crescentEstateBlueprint(),{planning,scene}=build(bp),current=structuredClone(scene),before=structuredClone(current),next=structuredClone(bp);
    current.objects[0].architecture!.x=1;next.buildings[0].location.x=2;
    const snapshot=structuredClone(current),result=reviseV3ArchitecturalBlueprint(current,planning.approval!,next);
    expect(result.ok).toBe(false);expect(result.findings.map(f=>f.code)).toContain('ARCHITECTURAL_EDIT_CONFLICT');
    expect(current).toEqual(snapshot);expect(scene).toEqual(before);
  });
  it('records all four untouched failed mansion responses beside independently authored designs',()=>{
    const originals=[['canopy-initial',canopy0],['canopy-repair',canopy1],['cloister-initial',cloister0],['cloister-repair',cloister1]] as const;
    const recovered=originals.map(([name,raw])=>{const bytes=JSON.stringify(raw),r=ingestV3GenerationOutput(raw,'flat',{requireBlueprint:name.startsWith('cloister'),requireDesignConsistency:true});expect(r.ok).toBe(false);expect(JSON.stringify(raw)).toBe(bytes);return {name,sha256:createHash('sha256').update(bytes).digest('hex'),ok:r.ok,issues:r.validation.issues};});
    const designs=distinctArchitecturalBlueprints().map(({name,blueprint})=>{const {planning,built}=build(blueprint);return {name,blueprintCharacters:JSON.stringify(blueprint).length,estimatedBlueprintTokens:Math.ceil(JSON.stringify(blueprint).length/4),sceneCharacters:JSON.stringify(built.scene).length,primitives:built.model!.primitives.length,planningFindings:planning.findings,constructionFindings:built.findings,blueprint,scene:built.scene};});
    if(process.env.ARCHITECTURAL_BLUEPRINT_PROOF)writeFileSync(process.env.ARCHITECTURAL_BLUEPRINT_PROOF,JSON.stringify({recovered,designs},null,2)+'\n');
  },20_000);
});
