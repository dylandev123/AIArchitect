import { describe, expect, it, vi } from 'vitest';
import { distinctArchitecturalBlueprints } from '../parity/architecturalBlueprint';
import { lowerV3ArchitecturalBlueprint } from '../architecturalBlueprint';
import { prepareV3ArchitecturalPlan, splitV3ArchitecturalBlueprint, v3PlanFirstDesignSchema } from '../architecturalPlanFirst';
import { generateV3FromArchitecturalBlueprint, v3ArchitecturalBlueprintPrompt } from '../architecturalBlueprintGeneration';
import { endpointFits, estateEndpoint, type EstateRoute } from '../routeGeometry';

describe('design freedom without weakening construction safety',()=>{
  it.each(distinctArchitecturalBlueprints().filter(d=>d.name!=='rotunda'))('supports vehicle drop-off at a narrow pedestrian entrance on $name',({blueprint})=>{
    const scene=lowerV3ArchitecturalBlueprint(blueprint),entry=blueprint.entrances[0],host=scene.objects.find(o=>o.id===entry.objectId)!;
    const route:EstateRoute={id:'drop-off',purpose:'Arrival',from:blueprint.site.access[0].id,to:host.id,via:['drive-owner'],spatial:{from:{},to:{entranceId:entry.id,approachDistance:3},width:5.8,use:'vehicle'}};
    const point=estateEndpoint(scene,route,'to')!;expect(point).toBeDefined();
    const access={point,openingId:entry.openingId};
    expect(endpointFits(host,{...access,approachDistance:3},5.8,'vehicle',scene)).toBe(true);
    expect(endpointFits(host,access,5.8,'vehicle',scene)).toBe(false);
    expect(endpointFits(host,{...access,point:[point[0]+100,point[1],point[2]+100],approachDistance:3},5.8,'vehicle',scene)).toBe(false);
  });
  it('omits empty supporting ledgers and deferred interiors on the actual author wire while retaining exact geometric authority',async()=>{
    const full=splitV3ArchitecturalBlueprint(distinctArchitecturalBlueprints().find(d=>d.name==='classical-villa')!.blueprint);
    const raw=JSON.parse(JSON.stringify(full));
    for(const key of ['forms','zones','relationships','considerations','roomAdjacencies'])delete raw.plan[key];
    delete raw.exterior.partitions;delete raw.exterior.doors;
    const author=vi.fn(async()=>({output:raw,finishReason:'stop'}));
    const result=await generateV3FromArchitecturalBlueprint('A garden house',author,{requirePlanFirst:true});
    expect(result.ok,JSON.stringify(result.findings)).toBe(true);expect(author).toHaveBeenCalledTimes(1);
    expect(result.scene!.interior!.partitions).toEqual([]);expect(result.scene!.interior!.doors).toEqual([]);
    const schema=JSON.parse(v3ArchitecturalBlueprintPrompt().slice(v3ArchitecturalBlueprintPrompt().indexOf('{')));
    expect(schema.properties.plan.required).not.toContain('zones');expect(schema.properties.exterior.required).not.toContain('partitions');
    expect(schema.properties.plan.required).toContain('program');expect(schema.properties.plan.required).toContain('requirements');
    expect(schema.properties.exterior.additionalProperties).toBe(false);
    expect(v3PlanFirstDesignSchema.safeParse({...raw,exterior:{...raw.exterior,location:{x:0,z:0}}}).success).toBe(false);
  });
  it('preserves authored reservations and refuses malformed ones rather than defaulting them away',()=>{
    const raw=splitV3ArchitecturalBlueprint(distinctArchitecturalBlueprints()[0].blueprint);
    const reservation={id:'explicit-reservation',purpose:'Keep an independent site reservation',objectIds:['crescent-house'],allocationMode:'reserved' as const,allocation:{x:40,z:40,width:4,depth:4}};
    raw.plan.zones=[reservation];
    expect(v3PlanFirstDesignSchema.parse(raw).plan.zones).toEqual([reservation]);
    const stage=prepareV3ArchitecturalPlan(raw.plan);
    expect(stage.scene!.estatePlan!.zones).toEqual([reservation]);
    expect(stage.findings.some(f=>f.code==='ESTATE_ALLOCATION_CONFLICT')).toBe(true);
    expect(v3PlanFirstDesignSchema.safeParse({...raw,plan:{...raw.plan,zones:null}}).success).toBe(false);
    expect(v3PlanFirstDesignSchema.safeParse({...raw,plan:{...raw.plan,zones:[{...reservation,allocation:{...reservation.allocation,width:-4}}]}}).success).toBe(false);
  });
});
