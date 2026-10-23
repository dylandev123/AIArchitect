import { afterEach, describe, expect, it, vi } from 'vitest';
import * as compiler from '../scene';
import { planningStudioBlueprint } from '../parity/planningStudio';
import { distinctArchitecturalBlueprints } from '../parity/architecturalBlueprint';
import { constructV3PlanMassing, elaborateV3ArchitecturalPlan, inspectV3ArchitecturalPlan, prepareV3ArchitecturalPlan, sameArchitecturalPlan, splitV3ArchitecturalBlueprint, v3PlanFirstDesignSchema } from '../architecturalPlanFirst';
import { generateV3FromArchitecturalBlueprint, v3ArchitecturalBlueprintPrompt } from '../architecturalBlueprintGeneration';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } from '../architecturalBlueprint';
import { deriveArchitecturalPlan } from '../architecturalPlanning';

afterEach(()=>vi.restoreAllMocks());
describe('authoritative 2D plan before construction',()=>{
  it('prepares a real, inspectable estate without invoking the compiler or requiring exterior design',()=>{
    const input=splitV3ArchitecturalBlueprint(planningStudioBlueprint());
    const compile=vi.spyOn(compiler,'compileV3Scene');
    const stage=prepareV3ArchitecturalPlan(input.plan);
    expect(stage.ok,JSON.stringify(stage.findings)).toBe(true);
    expect(compile).not.toHaveBeenCalled();
    expect(stage.scene!.objects.some(o=>o.type==='roof-form')).toBe(false);
    expect(stage.scene!.interior!.rooms.length).toBeGreaterThan(8);
    expect(stage.scene!.objects.find(o=>o.id==='crescent-house')!.composition!.footprint!.segments).toEqual(input.plan.buildings[0].plan.kind==='outline'?input.plan.buildings[0].plan.segments:[]);
    expect(inspectV3ArchitecturalPlan(JSON.parse(JSON.stringify(stage.scene)))).toEqual(inspectV3ArchitecturalPlan(stage.scene!));
  });
  it('constructs plan → massing → exterior with one offline author response and exact shared geometry',async()=>{
    const input=splitV3ArchitecturalBlueprint(planningStudioBlueprint()),stages:string[]=[];
    const author=vi.fn(async()=>({output:input,finishReason:'stop'}));
    const result=await generateV3FromArchitecturalBlueprint('A garden residence',author,{requirePlanFirst:true,onStage:stage=>{stages.push(stage.stage);}});
    expect(result.ok,JSON.stringify(result.findings)).toBe(true);
    expect(author).toHaveBeenCalledTimes(1);expect(stages).toEqual(['plan','massing','exterior']);
    expect(sameArchitecturalPlan(result.planningScene!,result.scene!)).toBe(true);
    expect(result.scene!.metadata.designPipeline).toMatchObject({format:'v3-plan-first-1',authority:'v3-semantic-plan'});
    for(const floor of [null,0,1]){
      const drawing=deriveArchitecturalPlan(result.scene!,compiler.compileV3Scene(result.scene!),floor);
      for(const b of drawing.buildings)expect(b.polygon).toEqual(inspectV3ArchitecturalPlan(result.planningScene!).buildings.find(p=>p.id===b.id)!.polygons[floor===1&&b.floorY===undefined?0:floor??0]);
    }
  },30000);
  it.each(distinctArchitecturalBlueprints())('preserves independently authored $name topology',({blueprint})=>{
    const input=splitV3ArchitecturalBlueprint(blueprint),plan=prepareV3ArchitecturalPlan(input.plan);
    expect(plan.ok,JSON.stringify(plan.findings)).toBe(true);
    expect(constructV3PlanMassing(plan)!.model.primitives.length).toBeGreaterThan(0);
    const elaborated=elaborateV3ArchitecturalPlan(plan,input.exterior);
    expect(elaborated.blueprint,JSON.stringify(elaborated.findings)).toBeDefined();
    const approved=planV3ArchitecturalBlueprint(elaborated.blueprint,{buildFirst:true});
    const built=approved.approval&&constructV3ArchitecturalBlueprint(approved.approval);
    expect(built&&built.ok,JSON.stringify(approved.findings)).toBe(true);
    expect(sameArchitecturalPlan(plan.scene!,built!.scene!)).toBe(true);
  });
  it('blocks invalid primary plan geometry before massing while retaining an inspectable plan',()=>{
    const input=splitV3ArchitecturalBlueprint(planningStudioBlueprint());input.plan.buildings[0].location.x=200;
    const compile=vi.spyOn(compiler,'compileV3Scene'),stage=prepareV3ArchitecturalPlan(input.plan);
    expect(stage.ok).toBe(false);expect(stage.scene).toBeDefined();expect(compile).not.toHaveBeenCalled();
    expect(constructV3PlanMassing(stage)).toBeUndefined();
  });
  it('keeps local room allocation problems visible without erasing valid building geometry',()=>{
    const input=splitV3ArchitecturalBlueprint(planningStudioBlueprint());input.plan.buildings[0].storeys[0].spaces[0].footprint.x=100;
    const stage=prepareV3ArchitecturalPlan(input.plan);expect(stage.ok,JSON.stringify(stage.findings)).toBe(true);
    expect(stage.scene!.interior!.rooms[0].footprint.x).toBe(100);
    expect(stage.findings.some(f=>f.code==='BLUEPRINT_SPACE_OUTSIDE_HOST')).toBe(true);
  });
  it('rejects exterior footprint overrides, repeated entrance addresses, missing/duplicate host IDs and legacy production output',async()=>{
    const input=splitV3ArchitecturalBlueprint(planningStudioBlueprint()),stage=prepareV3ArchitecturalPlan(input.plan);
    expect(v3PlanFirstDesignSchema.safeParse({...input,exterior:{...input.exterior,buildings:input.exterior.buildings.map(b=>({...b,location:{x:0,z:0}}))}}).success).toBe(false);
    const heightOverride=structuredClone(input);Object.assign(heightOverride.exterior.buildings[0].facade,{spaceHeight:'double-height'});expect(v3PlanFirstDesignSchema.safeParse(heightOverride).success).toBe(false);
    const repeat=structuredClone(input.exterior);repeat.buildings[0].facade.openings!.push(input.plan.buildings[0].accessOpenings[0]);
    expect(elaborateV3ArchitecturalPlan(stage,repeat).findings[0].code).toBe('EXTERIOR_PLAN_OVERRIDE');
    const missing=structuredClone(input.exterior);missing.buildings.pop();expect(elaborateV3ArchitecturalPlan(stage,missing).findings[0].code).toBe('EXTERIOR_HOSTS');
    const result=await generateV3FromArchitecturalBlueprint('Residence',async()=>({output:planningStudioBlueprint()}),{requirePlanFirst:true});
    expect(result.ok).toBe(false);expect(result.findings[0].code).toBe('PLAN_FIRST_REQUIRED');
    expect(v3ArchitecturalBlueprintPrompt()).toContain('v3-plan-first-1');
  });
});

it('rebuilds a changed 2D footprint into matching walls and roof without losing other plan identities',async()=>{
  const {editArchitecturalBuildingFootprint}=await import('../architecturalPlanEdits');
  const input=splitV3ArchitecturalBlueprint(planningStudioBlueprint());
  const result=await generateV3FromArchitecturalBlueprint('Garden residence',async()=>({output:input}),{requirePlanFirst:true});
  expect(result.ok,JSON.stringify(result.findings)).toBe(true);
  const edited=editArchitecturalBuildingFootprint(result.scene!,'orchard-atelier',{kind:'rectangle',width:13,depth:10});
  expect(edited.ok,JSON.stringify(edited.errors)).toBe(true);
  expect(edited.scene.objects.find(o=>o.id==='orchard-atelier')!.architecture!.width).toBe(13);
  expect(edited.scene.objects.find(o=>o.id==='atelier-roof')!.architecture!.width).toBe(13);
  expect(edited.scene.interior!.rooms).toEqual(result.scene!.interior!.rooms);
  const reloaded=JSON.parse(JSON.stringify(edited.scene));
  expect(inspectV3ArchitecturalPlan(reloaded)).toEqual(inspectV3ArchitecturalPlan(edited.scene));
  expect(compiler.compileV3Scene(reloaded)).toEqual(compiler.compileV3Scene(edited.scene));
  expect(edited.scene.metadata.designPipeline).toEqual(result.scene!.metadata.designPipeline);
},30000);

it('uses supported upper-floor setbacks from the plan for the upper mass and roof',()=>{
  const bp=distinctArchitecturalBlueprints().find(f=>f.name==='courtyard-house')!.blueprint,b=bp.buildings[0];
  if(b.plan.kind!=='articulated')throw Error('Expected articulated offline case');
  b.plan.operations[1].floors='upper';
  b.storeys.push({...structuredClone(b.storeys[0]),id:'court-upper',spaces:b.storeys[0].spaces.map(r=>({...r,id:'upper-'+r.id}))});
  bp.verticalCirculation=[{id:'court-stair',type:'stair',hostMassId:b.id,fromLevel:0,toLevel:1,footprint:{x:-12,z:0,width:1.6,depth:8},stairType:'straight',direction:'south'}];
  const document=splitV3ArchitecturalBlueprint(bp),plan=prepareV3ArchitecturalPlan(document.plan);
  expect(plan.ok,JSON.stringify(plan.findings)).toBe(true);
  const geometry=inspectV3ArchitecturalPlan(plan.scene!).buildings[0];expect(geometry.polygons[0]).not.toEqual(geometry.polygons[1]);
  const exterior=elaborateV3ArchitecturalPlan(plan,document.exterior),approved=planV3ArchitecturalBlueprint(exterior.blueprint,{buildFirst:true});
  const built=approved.approval&&constructV3ArchitecturalBlueprint(approved.approval);expect(built&&built.ok,JSON.stringify(approved.findings)).toBe(true);
  expect(sameArchitecturalPlan(plan.scene!,built!.scene!)).toBe(true);
});

it('diagnoses malformed line/arc geometry before envelope resolution or construction',()=>{
  const input=splitV3ArchitecturalBlueprint(planningStudioBlueprint());
  if(input.plan.buildings[0].plan.kind!=='outline')throw Error('Expected outline');
  delete input.plan.buildings[0].plan.segments[0].start;
  const compile=vi.spyOn(compiler,'compileV3Scene');
  const result=prepareV3ArchitecturalPlan(input.plan);
  expect(result.ok).toBe(false);expect(result.findings.some(f=>f.code==='PLAN_GEOMETRY')).toBe(true);
  expect(compile).not.toHaveBeenCalled();expect(result.plan).toBeDefined();
});
