import { afterEach, describe, expect, it, vi } from 'vitest';
import original from './fixtures/plan-first-estate.plan.json';
import * as compiler from '../scene';
import { preparePlanEvaluation, checkoutPlanEvaluation } from '../architecturalPlanEvaluation';
import { deriveArchitecturalPlan } from '../architecturalPlanning';
import { elaborateV3ArchitecturalPlan, prepareV3ArchitecturalPlan, splitV3ArchitecturalBlueprint } from '../architecturalPlanFirst';
import { expandPlanAuthoring } from '../architecturalPlanAuthoring';
import { planningStudioBlueprint } from '../parity/planningStudio';
import { authoredOverlap, authoredPlan, planArea } from '../authoredPlan';
import { endpointFits } from '../routeGeometry';
import { plannedSiteType } from '../plannedSiteGeometry';

// Independently authored fixture + verbatim failed vocabulary. NOT the missing paid response.
const regression = () => {
  const plan=structuredClone(original);
  for(const f of plan.features)f.type=({courtyard:'paved arrival court',terrace:'paved terrace',pool:'swimming pool','landscape-zone':'lawn'} as Record<string,string>)[f.type]??f.type;
  return plan;
};
afterEach(()=>vi.restoreAllMocks());
describe('ordinary planned site geometry before detailed construction',()=>{
  it('accepts the reported paid-failure vocabulary, retains all geometry and resolves dry-surface routes',()=>{
    const plan=regression(),unchanged=JSON.stringify(plan),compile=vi.spyOn(compiler,'compileV3Scene');
    const result=preparePlanEvaluation(plan);expect(result.ok,JSON.stringify(result.findings)).toBe(true);
    expect(JSON.stringify(plan)).toBe(unchanged);expect(compile).not.toHaveBeenCalled();
    expect(result.findings.filter(f=>['PLAN_FEATURE','PLAN_REFERENCE','PLAN_CONTACT'].includes(f.code))).toEqual([]);
    for(const f of plan.features){
      const o=result.scene!.objects.find(o=>o.id===f.id)!;
      expect(o.type).toBe(plannedSiteType(f.type));
      expect(o.architecture).toEqual({...f.location,width:f.width,depth:f.depth,height:f.height});
      const paths=deriveArchitecturalPlan(result.scene!,null,null).parts.find(p=>p.owner===f.id)!.paths;
      if(o.type==='terrace'){
        const pool=result.scene!.objects.find(p=>p.type==='pool')!;
        expect(paths.reduce((n,p)=>n+planArea(p),0)).toBeCloseTo(planArea(authoredPlan(o))-authoredOverlap(o,pool),6);
      }else expect(paths).toEqual([authoredPlan(o)]);
    }
    expect(checkoutPlanEvaluation(JSON.parse(JSON.stringify(result.scene))).ok).toBe(true);
  });
  it.each(['deck','garden zone','path','walkway','driveway'])('accepts %s without finish or equipment decisions',type=>{
    const plan=regression();plan.features.find(f=>f.id==='east-garden')!.type=type;
    expect(preparePlanEvaluation(plan).ok).toBe(true);
  });
  it('allows absent construction depth without inventing it in the editable plan',()=>{
    const plan=regression() as unknown as Record<string,unknown> & {features:Record<string,unknown>[]};
    for(const f of plan.features)delete f.height;
    const compile=vi.spyOn(compiler,'compileV3Scene'),result=preparePlanEvaluation(plan);
    expect(result.ok,JSON.stringify(result.findings)).toBe(true);expect(compile).not.toHaveBeenCalled();
    const reopened=checkoutPlanEvaluation(JSON.parse(JSON.stringify(result.scene)));
    expect(reopened.ok,JSON.stringify(reopened.findings)).toBe(true);
    expect(reopened.plan!.features.every(f=>f.height===undefined)).toBe(true);
    const exterior=splitV3ArchitecturalBlueprint(planningStudioBlueprint()).exterior;
    expect(elaborateV3ArchitecturalPlan(reopened,exterior).findings.some(f=>f.code==='EXTERIOR_HEIGHT_REQUIRED')).toBe(true);
  });
  it('draws and round-trips a rotated authored site outline, including its concave boundary',()=>{
    const plan=regression();const f=plan.features.find(f=>f.id==='east-garden')!;
    f.location.rotationY=.3;
    const polygon=[[-9,-17],[9,-17],[9,0],[0,0],[0,17],[-9,17]];
    Object.assign(f,{footprint:{kind:'outline',operations:[],segments:polygon.map((a,i)=>({id:`garden-edge-${i}`,type:'line',start:a,end:polygon[(i+1)%polygon.length]}))}});
    const result=preparePlanEvaluation(plan);expect(result.ok,JSON.stringify(result.findings)).toBe(true);
    const o=result.scene!.objects.find(o=>o.id===f.id)!;
    expect(authoredPlan(o)).toHaveLength(6);expect(planArea(authoredPlan(o))).toBeCloseTo(459);
    const local=[5,8],a=f.location.rotationY;
    expect(endpointFits(o,{point:[f.location.x+local[0]*Math.cos(a)+local[1]*Math.sin(a),.12,f.location.z-local[0]*Math.sin(a)+local[1]*Math.cos(a)]},1,'pedestrian',result.scene)).toBe(false);
    const reopened=checkoutPlanEvaluation(JSON.parse(JSON.stringify(result.scene)));
    expect(reopened.ok,JSON.stringify(reopened.findings)).toBe(true);expect(reopened.plan!.features.find(p=>p.id===f.id)!.footprint).toEqual(o.composition!.footprint);
  });
  it.each(['pool','missing','canopy','unsupported','outside'])('withholds only the route with an invalid %s destination, without substituting another contact',kind=>{
    const plan=regression(),route=plan.connections[0],e=route.to as {kind:string;objectId:string;local:number[]};
    e.objectId=kind==='pool'?'long-pool':kind==='canopy'?'arrival-shade':kind==='missing'?'absent':e.objectId;
    if(kind==='unsupported')plan.features.find(f=>f.id===e.objectId)!.type='suspension bridge';
    if(kind==='outside')e.local=[100,100];
    const authored=structuredClone(route.to);
    const result=preparePlanEvaluation(plan);
    expect(result.ok,JSON.stringify(result.findings)).toBe(true);
    const item=result.unresolved!.find(i=>i.id===route.id)!;
    expect(item.kind).toBe('connection');
    expect(item.findings.some(f=>f.code===(kind==='outside'?'PLAN_CONTACT':'PLAN_REFERENCE'))).toBe(true);
    // The authored intent is retained verbatim and nothing else is lost.
    expect((item.raw as {to:unknown}).to).toEqual(authored);
    expect(result.scene!.estatePlan!.circulation.some(r=>r.id===route.id)).toBe(false);
    expect(result.scene!.objects.filter(o=>o.type==='building-mass')).toHaveLength(plan.buildings.length);
    // Every connection is either drawn or retained as unresolved; none is dropped.
    expect(result.scene!.estatePlan!.circulation.length+result.unresolved!.length).toBe(plan.connections.length);
    // The saved scene reopens to the same plan, with the unresolved route still editable.
    const reopened=checkoutPlanEvaluation(JSON.parse(JSON.stringify(result.scene)));
    expect(reopened.ok,JSON.stringify(reopened.findings)).toBe(true);
    expect(reopened.plan!.connections.find(c=>c.id===route.id)!.to).toEqual(authored);
    expect(reopened.unresolved!.map(i=>i.id)).toContain(route.id);
    expect(reopened.unresolved!.length).toBe(result.unresolved!.length);
    // Outside the plan-only boundary the same plan is still rejected as a whole.
    expect(prepareV3ArchitecturalPlan(expandPlanAuthoring(plan).data).ok).toBe(false);
  });
  it('withholds a contact in a concave cutout rather than using the envelope',()=>{
    const plan=regression(),f=plan.features.find(f=>f.id==='east-garden')!;
    const polygon=[[-9,-17],[9,-17],[9,0],[0,0],[0,17],[-9,17]];
    Object.assign(f,{footprint:{kind:'outline',operations:[],segments:polygon.map((a,i)=>({id:`edge-${i}`,type:'line',start:a,end:polygon[(i+1)%polygon.length]}))}});
    plan.connections[0].to={kind:'surface',objectId:f.id,local:[5,8]};
    const result=preparePlanEvaluation(plan);expect(result.ok).toBe(true);
    expect(result.unresolved!.map(i=>i.id)).toContain(plan.connections[0].id);
    expect(result.findings.some(f=>f.code==='PLAN_CONTACT')).toBe(true);
    expect(prepareV3ArchitecturalPlan(expandPlanAuthoring(plan).data).ok).toBe(false);
  });
  it('retains a curved pool boundary without requiring a basin assembly',()=>{
    const plan=regression(),f=plan.features.find(f=>f.id==='long-pool')!;
    Object.assign(f,{footprint:{kind:'outline',operations:[],segments:[{id:'pool-arc',type:'arc',center:[0,0],radius:5,startAngle:0,sweep:360}]}});
    const result=preparePlanEvaluation(plan);expect(result.ok,JSON.stringify(result.findings)).toBe(true);
    const o=result.scene!.objects.find(o=>o.id===f.id)!;
    expect(authoredPlan(o).length).toBeGreaterThan(12);expect(planArea(authoredPlan(o))).toBeCloseTo(Math.PI*25,0);
    expect(checkoutPlanEvaluation(result.scene!).plan!.features.find(p=>p.id===f.id)!.footprint).toEqual(o.composition!.footprint);
  });
  it('retains localized room errors and gives an accurate unsupported-geometry diagnostic',()=>{
    const plan=regression();plan.buildings[0].storeys[0].spaces[0].footprint.x=100;
    const result=preparePlanEvaluation(plan);expect(result.ok).toBe(true);expect(result.findings.some(f=>f.code==='BLUEPRINT_SPACE_OUTSIDE_HOST')).toBe(true);
    plan.features.find(f=>f.id==='east-garden')!.type='suspension bridge';const unsupported=preparePlanEvaluation(plan);
    expect(unsupported.ok,JSON.stringify(unsupported.findings)).toBe(true);expect(unsupported.findings.some(f=>f.code==='PLAN_FEATURE_CONSTRUCTION_DEFERRED'&&f.targetIds.includes('east-garden'))).toBe(true);
    expect(unsupported.scene!.objects.find(o=>o.id==='east-garden')!.type).toBe('suspension bridge');
    expect(checkoutPlanEvaluation(unsupported.scene!).ok).toBe(true);
  });
});
