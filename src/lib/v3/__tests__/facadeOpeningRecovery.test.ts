import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it,vi} from 'vitest';
import live from './fixtures/architectural-blueprint-live-2026-10-21.json';
import {constructV3ArchitecturalBlueprint,planV3ArchitecturalBlueprint} from '../architecturalBlueprint';
import {revalidateArchitecturalScene} from '../architecturalAcceptance';
import {generateV3FromArchitecturalBlueprint} from '../architecturalBlueprintGeneration';
import {architecturalOpeningPreflight} from '../architecturalBlueprintPreflight';
import {buildArchitecturalFacadeOpenings,resolveFacadeOpeningBands} from '../facadeOpeningRecovery';
import {semanticOpeningIds} from '../composition';
import {executeV3SceneOperations} from '../operations';
import {fullPropertyBlueprint} from '../parity/fullPropertyBlueprint';
import type {V3Scene} from '../scene';

const build=(bp:unknown)=>{
  const plan=planV3ArchitecturalBlueprint(bp,{buildFirst:true});
  if(!plan.approval)throw Error(JSON.stringify(plan.findings));
  return constructV3ArchitecturalBlueprint(plan.approval);
};
const materials={exterior:{color:'#eeeeee',roughness:.8,metalness:0},trim:{color:'#222222',roughness:.4,metalness:0},glass:{color:'#aabbcc',roughness:.1,metalness:0}};
type Opening=Parameters<typeof resolveFacadeOpeningBands>[0][number];
const rectangle=(openings:Opening[])=>buildArchitecturalFacadeOpenings([{facade:'north',a:[-9,-5],b:[9,-5]}],18,10,openings,0,0,4,'wall',materials,semanticOpeningIds('host','north',0)).primitives;

describe('localized facade recovery without changing architectural intent',()=>{
  it('recovers the exact second paid response in one offline attempt, including every design record',async()=>{
    const bytes=readFileSync(new URL('./fixtures/architectural-blueprint-live-2026-10-21.json',import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb');
    const before=JSON.stringify(live),author=vi.fn(async()=>({output:live,finishReason:'stop'}));
    const result=await generateV3FromArchitecturalBlueprint('A luxury Saint Lucia estate',author);
    expect(result.outcome).toBe('draft');expect(author).toHaveBeenCalledTimes(1);
    const scene=result.scene!;expect(scene.objects).toHaveLength(11);
    const receipt=revalidateArchitecturalScene(scene);expect(receipt.outcome).toBe('draft');
    expect(receipt.diagnostics.filter(f=>f.classification==='core-blocking')).toEqual([]);
    for(const b of live.buildings){
      expect(scene.objects.find(o=>o.id===b.id)!.composition).toEqual(b.facade);
      expect(scene.objects.find(o=>o.id===b.roof.id)).toMatchObject({roofForm:b.roof.form,pitch:b.roof.pitchDegrees,overhang:b.roof.overhang});
    }
    expect(scene.interior!.rooms.map(r=>r.footprint)).toEqual(live.buildings.flatMap(b=>b.storeys.flatMap(s=>s.spaces.map(r=>r.footprint))));
    expect(scene.interior!.rooms).toHaveLength(20);
    expect(scene.interior!.partitions).toEqual(live.partitions);expect(scene.interior!.doors).toEqual(live.doors);
    expect(scene.interior!.circulation).toEqual(live.verticalCirculation);expect(scene.estatePlan!.zones).toEqual(live.zones);
    expect(scene.estatePlan!.considerations).toEqual(live.considerations);expect(scene.estatePlan!.relationships).toEqual(live.relationships);
    const parts=receipt.model!.primitives;
    expect(parts.some(p=>p.componentRole==='unresolved facade wall'&&p.color==='#e6a23c')).toBe(true);
    for(const id of ['main-entry-door','service-window-rhythm-0','service-window-rhythm-1'])expect(parts.some(p=>p.id.startsWith(`main-villa:${id}:level-0:`))).toBe(false);
    for(const id of ['terrace-door-great','terrace-door-lounge','west-view-glazing'])expect(parts.some(p=>p.id.startsWith(`main-villa:${id}:level-0:`))).toBe(true);
    expect(parts.some(p=>p.id.startsWith('guest-pavilion:guest-entry-door:'))).toBe(true);
    expect(parts.some(p=>p.sourceObjectId==='guest-garden-walk-surface'&&p.componentRole==='unresolved route guide')).toBe(true);
    expect(JSON.stringify(live)).toBe(before);
    const mass=scene.objects.find(o=>o.id==='main-villa')!;
    const edited=executeV3SceneOperations(scene,{intent:'Refine service windows',operations:[{op:'setComposition',target:mass.id,composition:{...mass.composition,openings:mass.composition!.openings!.map(op=>op.id==='service-window-rhythm'?{...op,floors:'upper'}:op)}}]});
    expect(edited.ok,edited.errors.join('\n')).toBe(true);
    const refined=revalidateArchitecturalScene(edited.scene);expect(refined.outcome).toBe('draft');
    expect(refined.findings.some(f=>f.code==='ARCHITECTURAL_OPENING_OVERLAP')).toBe(false);
    expect(refined.model!.primitives.some(p=>p.id==='main-villa:main-entry-door:level-0:door-frame')).toBe(true);
    expect(refined.model!.primitives.some(p=>p.componentRole==='unresolved facade wall')).toBe(false);
  });
  it('A: constructs vertically separated windows with the same horizontal projection without covering their cuts',()=>{
    const openings:Opening[]=[{id:'lower',type:'opening-rhythm',facade:'north',count:1,width:2,height:1,sill:.5},{id:'upper',type:'opening-rhythm',facade:'north',count:1,width:2,height:.8,sill:2.5}];
    expect(resolveFacadeOpeningBands(openings,'north',18,10,0,4).conflicts).toEqual([]);
    const parts=rectangle(openings);
    expect(parts.filter(p=>p.label==='Window Glass')).toHaveLength(2);
    expect(parts.some(p=>p.label.startsWith('Unresolved'))).toBe(false);
    for(const p of parts.filter(p=>p.category==='wall'))if(p.kind==='box')for(const [bottom,top] of [[.5,1.5],[2.5,3.3]]){
      const [x,y]=p.position,[w,h]=p.size;
      expect(Math.min(x+w/2,1)-Math.max(x-w/2,-1)>1e-7&&Math.min(y+h/2,top)-Math.max(y-h/2,bottom)>1e-7).toBe(false);
    }
  });
  it('B: authoritative segment addresses distinguish separate walls with the same compass role',()=>{
    const bp=fullPropertyBlueprint(),b=bp.buildings[0];
    b.facade.openings!.push({id:'other-wall-window',type:'glazing-zone',facade:'north',segmentId:'west-wall',start:.45,end:.55,heightRatio:.5,floors:'ground'});
    expect(architecturalOpeningPreflight([b]).some(f=>f.code==='ARCHITECTURAL_OPENING_OVERLAP')).toBe(false);
  });
  it('C: withholds both conflicting cuts, preserves unaffected rhythm members, independent of author array order',()=>{
    const openings:Opening[]=[{id:'entry',type:'door',facade:'north',start:.42,end:.5,height:3.1},{id:'windows',type:'opening-rhythm',facade:'north',count:2,width:1.1,height:1.4,sill:1.25}];
    for(const ops of [openings,[...openings].reverse()]){
      const parts=rectangle(ops);
      expect(parts.some(p=>p.id.startsWith('host:entry:'))).toBe(false);
      expect(parts.some(p=>p.id.startsWith('host:windows-0:'))).toBe(false);
      expect(parts.some(p=>p.id==='host:windows-1:level-0-glass')).toBe(true);
      expect(parts.some(p=>p.label.startsWith('Unresolved facade opening:'))).toBe(true);
    }
  });
  it.each(['span','height','sill','width','target'] as const)('retains a neighboring invalid %s as a local draft',field=>{
    const bp=fullPropertyBlueprint(),b=bp.buildings[1];
    b.facade.openings!.push(field==='span'?{id:'bad',type:'glazing-zone',facade:'east',start:.7,end:.2,heightRatio:.5}:field==='target'?{id:'bad',type:'glazing-zone',facade:'east',segmentId:'missing',start:.2,end:.7,heightRatio:.5}:{id:'bad',type:'opening-rhythm',facade:'east',count:1,width:field==='width'?30:1,height:field==='height'?9:1,sill:field==='sill'?10:1});
    const result=build(bp);expect(result.outcome,JSON.stringify(result.findings)).toBe('draft');
    expect(result.model!.primitives.some(p=>p.id.startsWith(`${b.id}:bad`))).toBe(false);
    expect(result.scene!.objects.find(o=>o.id===b.id)!.composition).toEqual(b.facade);
  });
  it('promotes a general property to Complete after an explicit facade edit and full revalidation',()=>{
    const bp=fullPropertyBlueprint(),b=bp.buildings[1];
    b.facade.openings!.push({id:'conflicting-window',type:'opening-rhythm',facade:'north',count:1,width:1,height:1,sill:1});
    const draft=build(bp);expect(draft.outcome).toBe('draft');
    const mass=draft.scene!.objects.find(o=>o.id===b.id)!;
    const corrected=executeV3SceneOperations(draft.scene!,{intent:'Move window to free facade',operations:[{op:'setComposition',target:mass.id,composition:{...mass.composition,openings:mass.composition!.openings!.map(op=>op.id==='conflicting-window'?{...op,facade:'east'}:op)}}]});
    expect(corrected.ok,corrected.errors.join('\n')).toBe(true);expect(revalidateArchitecturalScene(corrected.scene).outcome).toBe('complete');
  });
  it('D: retains strict blocking for a broken primary approach and missing primary geometry, even with draft metadata',()=>{
    const result=build(live),scene=structuredClone(result.scene!);
    scene.estatePlan!.circulation.find(r=>r.id==='arrival-drive')!.spatial!.waypoints=[[0,0,0]];
    expect(revalidateArchitecturalScene(scene).outcome).toBe('cannot-construct');
    const broken=structuredClone(result.scene!);broken.objects=broken.objects.filter(o=>o.id!=='main-villa');
    expect(revalidateArchitecturalScene(broken as V3Scene).outcome).toBe('cannot-construct');
  });
});
