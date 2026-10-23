import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {planV3ArchitecturalBlueprint,constructV3ArchitecturalBlueprint,checkoutV3ArchitecturalBlueprint,reviseV3ArchitecturalBlueprint,v3ArchitecturalBlueprintSchema} from '../architecturalBlueprint';
import {compileV3Scene} from '../scene';
import {revalidateArchitecturalScene} from '../architecturalAcceptance';
import {executeV3SceneOperations} from '../operations';
import {resolveV3Circulation} from '../circulation';
import {estateRoutePoints,estateRouteVertices} from '../routeGeometry';
import {crescentEstateBlueprint} from '../parity/architecturalBlueprint';
import {auditArchitecturalConstructionFidelity} from '../architecturalConstructionFidelity';

const source=readFileSync(new URL('./fixtures/architectural-blueprint-live-2026-10-20.json',import.meta.url),'utf8').trimEnd();
const live=()=>v3ArchitecturalBlueprintSchema.parse(JSON.parse(source));
const build=()=>{
  const plan=planV3ArchitecturalBlueprint(live(),{buildFirst:true});
  expect(plan.ok,JSON.stringify(plan.findings)).toBe(true);
  const result=constructV3ArchitecturalBlueprint(plan.approval!);
  expect(result.ok,JSON.stringify(result.findings)).toBe(true);
  return {plan,...result,scene:result.scene!,model:result.model!};
};

describe('faithful recovered mansion, offline',{timeout:20000},()=>{
  it('constructs the unchanged original deterministically, retaining every unresolved design record',()=>{
    vi.stubGlobal('fetch',()=>{throw Error('No network during mansion replay');});
    try{
      expect(createHash('sha256').update(source).digest('hex')).toBe('9733be300b2fbb316ea248201c4af87df86665fb63fb9c6d63012aa49f1af9ed');
      const bp=live(),before=JSON.stringify(bp),a=build(),b=build();
      expect(a.outcome).toBe('draft');expect(a.scene).toEqual(b.scene);expect(a.model).toEqual(b.model);
      expect(JSON.stringify(bp)).toBe(before);
      expect(a.scene.objects).toHaveLength(13);
      expect(a.scene.interior!.rooms.map(r=>r.footprint)).toEqual(bp.buildings.flatMap(b=>b.storeys.flatMap(s=>s.spaces.map(r=>r.footprint))));
      expect(a.scene.interior!.partitions).toEqual(bp.partitions);expect(a.scene.interior!.doors).toEqual(bp.doors);
      expect(a.scene.estatePlan!.zones).toEqual(bp.zones);
      for(const object of a.scene.objects)expect(a.model.primitives.some(p=>p.sourceObjectId===object.id)).toBe(true);
      expect(auditArchitecturalConstructionFidelity(a.scene,a.model)).toEqual([]);
      expect(revalidateArchitecturalScene(JSON.parse(JSON.stringify(a.scene))).outcome).toBe('draft');
    }finally{vi.unstubAllGlobals();}
  });
  it('uses exact cumulative heights for slabs, upper glazing, roof and stair landings',()=>{
    const {scene,model}=build();
    expect(scene.interior!.storeys.map(s=>[s.elevation,s.height])).toEqual([[.26,4.2],[4.46,3.5],[.26,3.6]]);
    const upper=model.primitives.find(p=>p.id==='main-villa-slab-2')!;
    expect(upper.kind).toBe('triMesh'); // stair opening is cut through the actual 4.2m slab
    const vertices=upper.kind==='triMesh'?upper.vertices:[];
    expect(Math.min(...vertices.filter((_,i)=>i%3===1))).toBeCloseTo(4.2);
    expect(Math.max(...vertices.filter((_,i)=>i%3===1))).toBeCloseTo(4.46);
    const stair=resolveV3Circulation(scene)[0];
    expect(stair.datums).toEqual([0,4.2,7.7]);expect(stair.fromY).toBeCloseTo(.26);expect(stair.toY).toBeCloseTo(4.46);expect(stair.usable).toBe(true);
    expect(scene.objects.find(o=>o.id==='villa-roof')!.architecture!.baseElevation).toBe(7.7);
    expect(model.primitives.some(p=>p.id.startsWith('main-stair:well-'))).toBe(true);
    for(const [host,door,depth] of [['main-villa','villa-south-entry',2.4],['guest-pavilion','guest-south-entry',1.8]] as const){
      expect(model.primitives.some(p=>p.id===`${host}:${door}:level-0:door-panel`&&p.transparent)).toBe(true);
      expect(model.primitives.find(p=>p.id===`${host}:${door}:level-0:frame-left`)!.color).toBe('#292b29');
      const canopy=model.primitives.find(p=>p.id===`${host}-composition-assembly-entry-${door}-canopy`)!;
      expect(canopy?.kind).toBe('box');if(canopy.kind==='box')expect(canopy.size[2]).toBeCloseTo(depth);
    }
    const route=scene.estatePlan!.circulation[0],points=estateRoutePoints(route,scene),verticesRoute=estateRouteVertices(scene,route);
    expect(points[0]).toEqual([0,0,50]);expect(route.spatial!.waypoints).toEqual(live().connections[0].waypoints);
    expect(Math.max(...verticesRoute.filter((_,i)=>i%3===2))).toBeLessThanOrEqual(50);
  });
  it('checks out, edits a blueprint, merges a local finish, reloads and reconstructs the same architecture',()=>{
    const {scene}=build(),checkout=checkoutV3ArchitecturalBlueprint(scene);
    expect(checkout.ok,JSON.stringify(checkout.findings)).toBe(true);
    const bp=structuredClone(checkout.blueprint!);bp.buildings[0].storeys[1].height=3.8;
    const local=executeV3SceneOperations(scene,{intent:'Edit guest finish',operations:[{op:'changeMaterial',target:'guest-pavilion',material:{id:'volcanic-stone',color:'#514d47',roughness:.86,metalness:0,opacity:1,surface:'stone'}}]});
    expect(local.ok,JSON.stringify(local.errors)).toBe(true);
    const revised=reviseV3ArchitecturalBlueprint(local.scene,checkout.approval!,bp);
    expect(revised.ok,JSON.stringify(revised.findings)).toBe(true);
    expect(revised.scene!.objects.find(o=>o.id==='guest-pavilion')!.material.color).toBe('#514d47');
    expect(revised.scene!.objects.find(o=>o.id==='villa-roof')!.architecture!.baseElevation).toBe(8);
    const reloaded=JSON.parse(JSON.stringify(revised.scene));
    expect(compileV3Scene(reloaded)).toEqual(revised.model);
    expect(checkoutV3ArchitecturalBlueprint(reloaded).blueprint!.buildings[0].storeys.map(s=>s.height)).toEqual([4.2,3.8]);
  });
  it('supports unequal heights and glazed main entries on the existing outline builder',()=>{
    const bp=crescentEstateBlueprint();bp.buildings[0].storeys[1].height=3.5;
    const entry=bp.buildings[0].facade.openings!.find(o=>o.id===bp.buildings[0].facade.mainEntry!.openingId)!;
    Object.assign(entry,{type:'glazed-door',operation:'hinged'});delete (entry as {frame?:boolean}).frame;
    const plan=planV3ArchitecturalBlueprint(bp,{buildFirst:true}),built=constructV3ArchitecturalBlueprint(plan.approval!);
    expect(built.ok,JSON.stringify([...plan.findings,...built.findings])).toBe(true);
    expect(built.outcome).toBe('complete');
    expect(built.model!.primitives.some(p=>p.id.includes(`entry-${entry.id}-canopy`))).toBe(true);
    expect(auditArchitecturalConstructionFidelity(built.scene!,built.model!)).toEqual([]);
  });
});
