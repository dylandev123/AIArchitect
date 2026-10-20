import { describe,it,expect,vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { fullPropertyBlueprint } from '../parity/fullPropertyBlueprint';
import { planV3ArchitecturalBlueprint,constructV3ArchitecturalBlueprint,checkoutV3ArchitecturalBlueprint,reviseV3ArchitecturalBlueprint } from '../architecturalBlueprint';
import { generateV3FromArchitecturalBlueprint,assessV3ArchitecturalBlueprintRepair,v3ArchitecturalBlueprintPrompt } from '../architecturalBlueprintGeneration';
import { compileV3Scene } from '../scene';
import * as sceneModule from '../scene';
import { executeV3SceneOperations } from '../operations';

const build=()=>{
  const blueprint=fullPropertyBlueprint(),plan=planV3ArchitecturalBlueprint(blueprint);
  expect(plan.findings.filter(f=>f.severity==='fatal')).toEqual([]);
  const built=constructV3ArchitecturalBlueprint(plan.approval!);
  expect(built.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(built.ok).toBe(true);
  return {blueprint,plan,built};
};
describe('expanded independent full-property construction',()=>{
  it('constructs actual curved balcony/guards, portico and pergola, then round trips without sidecar authority',()=>{
    const {blueprint,built}=build(),model=built.model!;
    for(const label of ['Assembly Slab','Assembly Railing','Assembly Post','Assembly Beam','pergola slat'])expect(model.primitives.some(p=>p.label===label||p.label.toLowerCase().includes(label.toLowerCase()))).toBe(true);
    for(const [host,assembly] of [['crescent-house','arc-balcony'],['orchard-atelier','atelier-portico']])expect(model.primitives.some(p=>p.sourceObjectId===host&&p.id.includes(assembly))).toBe(true);
    const saved=JSON.parse(JSON.stringify(built.scene)),checkout=checkoutV3ArchitecturalBlueprint(saved);
    expect(checkout.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(checkout.ok).toBe(true);
    expect(constructV3ArchitecturalBlueprint(checkout.approval!).model).toEqual(model);
    expect(checkout.blueprint!.buildings[0].facade.assemblies).toEqual(blueprint.buildings[0].facade.assemblies);
    if(process.env.FULL_PROPERTY_BLUEPRINT_PROOF)writeFileSync(process.env.FULL_PROPERTY_BLUEPRINT_PROOF,JSON.stringify({blueprint,scene:built.scene,primitives:model.primitives.length,findings:built.findings,blueprintCharacters:JSON.stringify(blueprint).length,promptCharacters:v3ArchitecturalBlueprintPrompt().length},null,2)+'\n');
  });
  it('moves curved assemblies with the host and keeps their IDs across ordinary edits and reload',()=>{
    const {blueprint,plan,built}=build(),next=structuredClone(blueprint);next.buildings[0].location.x+=2;
    const edited=executeV3SceneOperations(built.scene!,{intent:'Local atelier finish',operations:[{op:'changeMaterial',target:'orchard-atelier',material:{id:'ochre',color:'#d6bb84',surface:'stucco'}}]});expect(edited.ok).toBe(true);
    const revised=reviseV3ArchitecturalBlueprint(edited.scene,plan.approval!,next);
    expect(revised.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(revised.ok).toBe(true);
    const ids=(model:typeof built.model)=>model!.primitives.filter(p=>p.id.includes('arc-balcony')).map(p=>p.id);
    expect(ids(revised.model)).toEqual(ids(built.model));
    expect(revised.scene!.objects.find(o=>o.id==='orchard-atelier')!.material.id).toBe('ochre');
    expect(compileV3Scene(JSON.parse(JSON.stringify(revised.scene)))).toEqual(revised.model);
  });
  it('constructs a declared lift and a solid canopy through existing builders without choosing stair geometry',()=>{
    const bp=fullPropertyBlueprint(),stair=bp.verticalCirculation[0];
    bp.verticalCirculation=[{id:stair.id,type:'lift',hostMassId:stair.hostMassId,fromLevel:0,toLevel:1,footprint:{x:-14,z:-3,width:2,depth:2}}];
    bp.features.at(-1)!.canopyStyle='solid';
    const planned=planV3ArchitecturalBlueprint(bp);expect(planned.findings.filter(f=>f.severity==='fatal')).toEqual([]);
    const built=constructV3ArchitecturalBlueprint(planned.approval!);expect(built.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(built.ok).toBe(true);
    expect(built.model!.primitives.some(p=>p.id.startsWith(`${stair.id}:`)&&p.label.toLowerCase().includes('lift'))).toBe(true);
    expect(built.model!.primitives.some(p=>p.sourceObjectId==='poolside-shade'&&p.label.toLowerCase().includes('canopy roof'))).toBe(true);
  });
  it('rejects the loss of one curved guard edge even when its slab and other guards remain renderable',()=>{
    const planned=planV3ArchitecturalBlueprint(fullPropertyBlueprint()),compile=sceneModule.compileV3Scene;
    const spy=vi.spyOn(sceneModule,'compileV3Scene').mockImplementation(scene=>{const model=compile(scene);return {...model,primitives:model.primitives.filter(p=>p.id!=='crescent-house-assembly-arc-balcony-guard-outer')};});
    try{const built=constructV3ArchitecturalBlueprint(planned.approval!);expect(built.ok).toBe(false);expect(built.scene).toBeUndefined();expect(built.findings.some(f=>f.code==='ARCHITECTURAL_ASSEMBLY_UNBUILT')).toBe(true);}finally{spy.mockRestore();}
  });
  it.each(['host','level','empty','rail','canopy-choice'] as const)('rejects incomplete %s decisions before construction',kind=>{
    const bp=fullPropertyBlueprint(),a=bp.buildings[0].facade.assemblies![0];
    if(kind==='host'&&a.parts[0].type==='slab')delete a.parts[0].segmentId;
    if(kind==='level'&&a.parts[0].type==='slab')a.parts[0].level=3;
    if(kind==='empty')a.parts=[];
    if(kind==='rail'&&a.parts[1].type==='railing')a.parts[1].slabId='missing';
    if(kind==='canopy-choice')delete bp.features.at(-1)!.canopyStyle;
    const plan=planV3ArchitecturalBlueprint(bp);expect(plan.ok).toBe(false);expect(plan.approval).toBeUndefined();
  });
  it('one author response creates an editable property; missing design/unsupported capability needs no repair',async()=>{
    const author=vi.fn().mockResolvedValue({output:fullPropertyBlueprint()});
    const result=await generateV3FromArchitecturalBlueprint('A curved home with covered outdoor living and a balcony',author);
    expect(result.findings.filter(f=>f.severity==='fatal')).toEqual([]);expect(result.ok).toBe(true);expect(author).toHaveBeenCalledTimes(1);
    for(const mutate of [(b:ReturnType<typeof fullPropertyBlueprint>)=>{b.buildings[0].roof.form='dome';},(b:ReturnType<typeof fullPropertyBlueprint>)=>{b.entrances=[];}]){
      const bp=fullPropertyBlueprint();mutate(bp);author.mockReset().mockResolvedValue({output:bp});
      const failed=await generateV3FromArchitecturalBlueprint('Residence',author);expect(failed.ok).toBe(false);expect(failed.scene).toBeUndefined();expect(author).toHaveBeenCalledTimes(1);
    }
  });
  it('allows only the diagnosed stair correction, bounded to two calls, preserving all other decisions',async()=>{
    const bad=fullPropertyBlueprint();bad.verticalCirculation[0].footprint.depth=.5;
    const failures=planV3ArchitecturalBlueprint(bad).findings;
    expect(assessV3ArchitecturalBlueprintRepair(bad,fullPropertyBlueprint(),failures)).toBe(true);
    const redesign=fullPropertyBlueprint();redesign.buildings[0].location.x+=2;
    expect(assessV3ArchitecturalBlueprintRepair(bad,redesign,failures)).toBe(false);
    const author=vi.fn().mockResolvedValueOnce({output:bad}).mockResolvedValueOnce({output:fullPropertyBlueprint()});
    const result=await generateV3FromArchitecturalBlueprint('Residence',author);expect(result.ok).toBe(true);expect(result.attempts).toBe(2);expect(author).toHaveBeenCalledTimes(2);
    author.mockReset().mockResolvedValue({output:bad});const rejected=await generateV3FromArchitecturalBlueprint('Residence',author);expect(rejected.ok).toBe(false);expect(author).toHaveBeenCalledTimes(2);
  });
  it('does not grant a third call or accept a route repair that changes its entrance, width or material',async()=>{
    const bp=fullPropertyBlueprint();bp.connections[2].waypoints=[[0,0,0]];
    const failures=planV3ArchitecturalBlueprint(bp).findings;
    const fixed=fullPropertyBlueprint();expect(assessV3ArchitecturalBlueprintRepair(bp,fixed,failures)).toBe(true);
    for(const mutate of [(b:typeof bp)=>{b.connections[2].width=4;},(b:typeof bp)=>{b.connections[2].materialId='timber';},(b:typeof bp)=>{b.connections[2].to={kind:'entrance',entranceId:'principal-entry'};}]){
      const changed=structuredClone(fixed);mutate(changed);expect(assessV3ArchitecturalBlueprintRepair(bp,changed,failures)).toBe(false);
    }
    const author=vi.fn().mockResolvedValue({output:bp}),result=await generateV3FromArchitecturalBlueprint('Residence',author);
    expect(result.ok).toBe(false);expect(result.scene).toBeUndefined();expect(author).toHaveBeenCalledTimes(2);
  });
  it('requires explicit stair orientation and facade decisions, and validates articulated assembly attachment without compiling',()=>{
    for(const mutate of [(b:ReturnType<typeof fullPropertyBlueprint>)=>{delete b.verticalCirculation[0].direction;},(b:ReturnType<typeof fullPropertyBlueprint>)=>{delete b.buildings[0].facade.openings;}]){
      const bp=fullPropertyBlueprint();mutate(bp);expect(planV3ArchitecturalBlueprint(bp).approval).toBeUndefined();
    }
    const bp=fullPropertyBlueprint(),b=bp.buildings[1];
    b.plan={kind:'articulated',width:12,depth:10,operations:[{id:'entry',type:'entry-recess',facade:'north',width:4,depth:2}]};
    b.facade.assemblies=[{id:'ambiguous-cover',intent:'Invalid spanning cover',parts:[{id:'cover',type:'slab',facade:'north',start:.2,end:.55,depth:2,elevation:3}]}];
    const spy=vi.spyOn(sceneModule,'compileV3Scene');
    try{const result=planV3ArchitecturalBlueprint(bp);expect(result.ok).toBe(false);expect(result.findings.some(f=>f.code==='ARCHITECTURAL_ASSEMBLY_HOST')).toBe(true);expect(spy).not.toHaveBeenCalled();}finally{spy.mockRestore();}
  });
  it('reports explicit unsupported brief intent before spending a provider call, even if a model could omit it',async()=>{
    const author=vi.fn().mockResolvedValue({output:fullPropertyBlueprint()});
    const result=await generateV3FromArchitecturalBlueprint('A circular residence with a dome roof',author);
    expect(result.ok).toBe(false);expect(result.attempts).toBe(0);expect(result.phase).toBe('brief');expect(author).not.toHaveBeenCalled();
    expect((await generateV3FromArchitecturalBlueprint('A home without a dome roof',author)).ok).toBe(true);expect(author).toHaveBeenCalledTimes(1);
  });
});
