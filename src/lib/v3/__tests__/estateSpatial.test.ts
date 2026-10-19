import { describe, expect, it } from 'vitest';
import { estateFixtures } from './estatePlanFixtures';
import { auditEstateSpatial, estateRouteSupported } from '../estateSpatial';
import { auditV3EstatePlan, v3EstatePlanSchema } from '../estatePlan';
import { compileV3Scene, type V3Scene } from '../scene';
import { assessV3Revision } from '../safeRevision';
import { normalizeV3GenerationOutput } from '../generation';
import { SAVED_MANSIONS, savedMansion } from '../parity/functionalMansions';
import { materializeV3ArchitecturalObject } from '../architecture';

function estate(): V3Scene {
  const scene=estateFixtures()[1];
  scene.estatePlan!.program=scene.estatePlan!.program.filter(p=>!p.objectIds.some(id=>['guest-lodge','atelier'].includes(id)));
  scene.estatePlan!.circulation[0].spatial={from:{point:[0,0,24]},to:{point:[0,0,9],openingId:'main-residence-door'},use:'pedestrian',width:2};
  return scene;
}
const codes=(s:V3Scene)=>auditEstateSpatial(s).map(d=>d.code);
const review=(s:V3Scene)=>{const diagnostics=auditEstateSpatial(s);return {diagnostics,significant:diagnostics.filter(d=>d.severity==='significant').length,repairRecommended:true};};
describe('estate spatial realization',()=>{
  it('constructs only an authored route with stable owner, leaves persistence untouched',()=>{
    const scene=estate(), before=structuredClone(scene);
    expect(v3EstatePlanSchema.safeParse(scene.estatePlan).success).toBe(true);
    expect(auditEstateSpatial(scene)).toEqual([]);
    const meshes=compileV3Scene(scene).primitives.filter(p=>p.id.includes('v3-connection-estate:'));
    expect(meshes).toHaveLength(1);
    expect(meshes[0]).toMatchObject({sourceObjectId:'orchard-walk',kind:'triMesh'});
    expect(scene).toEqual(before);
    expect(normalizeV3GenerationOutput(scene).scene.estatePlan).toEqual(scene.estatePlan);
  });
  it('detects width collisions, pool crossings, missing doors and elevation discontinuity',()=>{
    const scene=estate(), obstacle=structuredClone(scene.objects[1]);
    obstacle.id='obstacle';obstacle.architecture={x:1.4,z:17,width:1,depth:2,height:3,baseElevation:0};
    scene.objects.push(materializeV3ArchitecturalObject(obstacle));
    expect(codes(scene)).toContain('ESTATE_ROUTE_BLOCKED');
    scene.objects.at(-1)!.type='pool';
    expect(codes(scene)).toContain('ESTATE_POOL_CROSSING');
    scene.estatePlan!.circulation[0].spatial!.to.openingId='window';
    expect(codes(scene)).toContain('ESTATE_ACCESS_POINT_MISSING');
    scene.estatePlan!.circulation[0].spatial!.to.point[1]=3;
    expect(codes(scene)).toContain('ESTATE_ROUTE_UNSUPPORTED');
  });
  it('accepts a narrowly scoped authored detour and rejects unrelated restyling or width changes',()=>{
    const scene=estate(), obstacle=structuredClone(scene.objects[1]);
    obstacle.id='obstacle';obstacle.architecture={x:0,z:17,width:2,depth:2,height:3,baseElevation:0};
    scene.objects.push(materializeV3ArchitecturalObject(obstacle));
    const fixed=structuredClone(scene);
    fixed.estatePlan!.circulation[0].spatial!.waypoints=[[4,0,24],[4,0,11],[0,0,11]];
    expect(auditEstateSpatial(fixed)).toEqual([]);
    expect(assessV3Revision(scene,fixed,review(scene),review(fixed)).accepted).toBe(true);
    fixed.objects[0].roofForm='hip';
    expect(assessV3Revision(scene,fixed,review(scene),review(fixed)).accepted).toBe(false);
    delete fixed.objects[0].roofForm;
    fixed.estatePlan!.circulation[0].spatial!.width=.5;
    expect(assessV3Revision(scene,fixed,review(scene),review(fixed)).accepted).toBe(false);
  });
  it('connects a multi-building compound at real door endpoints',()=>{
    const scene=estate(), route=scene.estatePlan!.circulation[0];
    route.from='guest-lodge';route.to='main-residence';
    route.spatial={from:{point:[-35,0,6],openingId:'guest-lodge-door'},to:{point:[0,0,9],openingId:'main-residence-door'},width:2,use:'pedestrian',waypoints:[[-35,0,12],[0,0,12]]};
    expect(auditEstateSpatial(scene)).toEqual([]);
    route.spatial.from.point[0]=-30;
    expect(codes(scene)).toContain('ESTATE_ACCESS_POINT_MISSING');
  });
  it('checks off-centre south doors and missing planned destination access',()=>{
    const scene=estate(), mass=scene.objects[0], route=scene.estatePlan!.circulation[0];
    mass.composition!.openings![0]={id:'side-door',type:'door',facade:'south',floors:'ground',start:.1,end:.2};
    route.spatial!.to={point:[-10.5,0,9],openingId:'side-door'};
    route.spatial!.waypoints=[[-10.5,0,24]];
    expect(auditEstateSpatial(scene)).toEqual([]);
    scene.estatePlan!.program.push({id:'guest-program',role:'Guest lodge',kind:'building',source:'design',objectIds:['guest-lodge']});
    expect(codes(scene)).toContain('ESTATE_ACCESS_MISSING');
  });
  it('rejects ambiguous owners and zero segments without inventing geometry',()=>{
    const scene=estate(), route=scene.estatePlan!.circulation[0];
    route.spatial!.waypoints=[route.spatial!.from.point];
    expect(estateRouteSupported(scene,route)).toBe(false);
    expect(compileV3Scene(scene).primitives.some(p=>p.id.includes('v3-connection-estate:'))).toBe(false);
    delete route.spatial!.waypoints;
    scene.estatePlan!.circulation.push({...route,id:'duplicate'});
    expect(estateRouteSupported(scene,route)).toBe(false);
  });
  it('preserves saved modern mansions and diagnoses circular concepts instead of certifying boxes',()=>{
    for (const id of SAVED_MANSIONS) {
      const scene=savedMansion(id), snapshot=structuredClone(scene), model=compileV3Scene(scene);
      expect(auditEstateSpatial(scene)).toEqual([]);
      expect(compileV3Scene(JSON.parse(JSON.stringify(scene)))).toEqual(model);
      expect(scene).toEqual(snapshot);
      const mass=scene.objects.find(o=>o.type==='building-mass')!;
      scene.estatePlan={...estate().estatePlan!,program:[],zones:[],requirements:[],circulation:[],considerations:[],architecture:[{id:'circular-concept',objectIds:[mass.id],form:'circular',intent:'Circular monumental residence'}]};
      expect(codes(scene)).toContain('ESTATE_FORM_UNBUILT');
      expect(compileV3Scene(scene)).toEqual(model);
    }
  });
  it('retains Mediterranean identity and irregular rectangular arrangements, checks declared scale',()=>{
    const scene=estate();
    scene.estatePlan!.character='Mediterranean limestone estate with pitched tile roofs and shaded loggias';
    scene.objects.filter(o=>o.type==='building-mass').forEach(o=>{o.roofForm='hip';o.pitch=25;});
    scene.estatePlan!.architecture=[{id:'composition',form:'irregular',intent:'Dispersed pavilions',objectIds:['main-residence','guest-lodge','atelier']}];
    expect(auditEstateSpatial(scene)).toEqual([]);
    expect(compileV3Scene(scene).primitives.length).toBeGreaterThan(0);
    scene.estatePlan!.architecture.push({id:'grand-entry',form:'rectangular',intent:'Monumental entrance',objectIds:['main-residence'],minHeight:10});
    expect(codes(scene)).toContain('ESTATE_REQUIREMENT_CONFLICT');
    scene.estatePlan!.architecture[0].form='U-shaped';
    expect(codes(scene)).toContain('ESTATE_FORM_UNBUILT');
    expect(auditV3EstatePlan(scene).length).toBeGreaterThan(0);
  });
});
