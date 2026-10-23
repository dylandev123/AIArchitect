import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { planningStudioBlueprint } from '../parity/planningStudio';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint, reviseV3ArchitecturalBlueprint } from '../architecturalBlueprint';
import { compileV3Scene, type V3Scene } from '../scene';
import { deriveArchitecturalPlan, planningSectionY, primitiveTriangles, sectionTriangle } from '../architecturalPlanning';
import { resolveV3Room, resolveV3Storey } from '../interior';
import { editArchitecturalStoreyHeight } from '../architecturalPlanEdits';
import { executeV3SceneOperations } from '../operations';
import { ARCHITECTURAL_DESIGN_SEQUENCE } from '../architecturalBlueprintGeneration';

afterAll(()=>vi.unstubAllGlobals());
let scene:V3Scene;
beforeAll(()=>{
  vi.stubGlobal('fetch',vi.fn(()=>{throw Error('Provider/network forbidden in planning tests');}));
  const planned=planV3ArchitecturalBlueprint(planningStudioBlueprint(),{buildFirst:true});
  expect(planned.approval,JSON.stringify(planned.findings)).toBeDefined();
  const built=constructV3ArchitecturalBlueprint(planned.approval!);
  expect(built.ok,JSON.stringify(built.findings)).toBe(true);scene=built.scene!;
},30000);

describe('one V3 architectural authority',()=>{
  it('projects the same rooms and floor datums without mutating or fetching',()=>{
    const before=JSON.stringify(scene),model=compileV3Scene(scene);
    const ground=deriveArchitecturalPlan(scene,model,0),upper=deriveArchitecturalPlan(scene,model,1),master=deriveArchitecturalPlan(scene,model,null);
    expect(master.rooms).toHaveLength(0);expect(ground.rooms.length).toBeGreaterThan(3);expect(upper.rooms.length).toBeGreaterThan(2);
    for(const drawing of [ground,upper])for(const room of drawing.rooms)expect(room.polygon).toEqual(resolveV3Room(scene,room.id)!.corners);
    expect(ground.parts.some(p=>p.section)).toBe(true);expect(ground.parts.some(p=>p.category==='stairs')).toBe(true);
    expect(master.parts.some(p=>p.category==='pool')).toBe(true);expect(master.parts.some(p=>p.category==='path')).toBe(true);
    expect(planningSectionY(scene,'crescent-house',1)).toBeCloseTo(resolveV3Storey(scene,'house-upper')!.floorY+1.2);
    expect(JSON.stringify(scene)).toBe(before);expect(fetch).not.toHaveBeenCalled();
  });
  it('sections exact rotated production boxes and leaves headers above doors out',()=>{
    const box={kind:'box' as const,id:'header',category:'wall' as const,label:'Header',position:[5,2.5,7] as [number,number,number],rotation:[0,Math.PI/4,0] as [number,number,number],size:[3,1,.2] as [number,number,number],color:'#fff'};
    const triangles=primitiveTriangles(box);
    expect(triangles).toHaveLength(12);expect(triangles.flatMap(t=>sectionTriangle(t,1)??[])).toHaveLength(0);
    const section=triangles.flatMap(t=>{const segment=sectionTriangle(t,2.5);return segment??[];});
    expect(section.length).toBeGreaterThan(0);expect(Math.min(...section.map(p=>p[0]))).toBeCloseTo(5-1.6/Math.sqrt(2));
  });
  it('replans host placement with the same room IDs, roof and entrance-derived route',()=>{
    const bp=planningStudioBlueprint(),base=planV3ArchitecturalBlueprint(bp,{buildFirst:true});bp.buildings[1].location.x-=2;
    const result=reviseV3ArchitecturalBlueprint(scene,base.approval!,bp);
    expect(result.ok,JSON.stringify(result.findings)).toBe(true);
    const moved=result.scene!,oldRoom=resolveV3Room(scene,'atelier-room')!,newRoom=resolveV3Room(moved,'atelier-room')!;
    expect(newRoom.centre[0]).toBeCloseTo(oldRoom.centre[0]-2);
    expect(moved.objects.find(o=>o.id==='atelier-roof')!.architecture!.x).toBeCloseTo(scene.objects.find(o=>o.id==='atelier-roof')!.architecture!.x-2);
    expect(deriveArchitecturalPlan(moved,compileV3Scene(moved),0).rooms.find(r=>r.id==='atelier-room')!.centre).toEqual(newRoom.centre);
  },30000);
  it('changes one authored height and derives upper floors, partitions, mass and roof together',()=>{
    const result=editArchitecturalStoreyHeight(scene,'house-ground',4.3);
    expect(result.ok,JSON.stringify(result.errors)).toBe(true);
    const changed=result.scene;
    expect(resolveV3Storey(changed,'house-upper')!.floorY).toBeCloseTo(resolveV3Storey(scene,'house-upper')!.floorY+.3);
    expect(changed.objects.find(o=>o.id==='crescent-house')!.architecture!.height).toBeCloseTo(8.3);
    expect(changed.objects.find(o=>o.id==='crescent-roof')!.architecture!.baseElevation).toBeCloseTo(scene.objects.find(o=>o.id==='crescent-roof')!.architecture!.baseElevation+.3);
    expect(deriveArchitecturalPlan(changed,compileV3Scene(changed),1).rooms.map(r=>r.id)).toEqual(deriveArchitecturalPlan(scene,compileV3Scene(scene),1).rooms.map(r=>r.id));
  },30000);
  it('projects existing semantic room edits and retains door cutouts after serialization',()=>{
    const room=scene.interior!.rooms.find(r=>r.id==='atelier-room')!;
    const result=executeV3SceneOperations(scene,{intent:'Narrow independent studio program extent',operations:[{op:'editRoom',target:room.id,room:{footprint:{...room.footprint,width:9.8}}}]});
    expect(result.ok,result.errors.join('\n')).toBe(true);
    const reloaded=JSON.parse(JSON.stringify(result.scene));
    expect(deriveArchitecturalPlan(reloaded,compileV3Scene(reloaded),0).rooms.find(r=>r.id===room.id)!.width).toBe(9.8);
    expect(reloaded.interior.doors.map((d:{id:string})=>d.id)).toEqual(scene.interior!.doors!.map(d=>d.id));
  },30000);
  it('guides the one-call author through composition review before preserving the plan',()=>{
    const stages=['IMAGINE THE PROPERTY','COMPOSE THE SITE AND DRAW THE PLAN','REVIEW THE COMPOSITION','PRESERVE IT FOR 3D'];
    expect(stages.map(s=>ARCHITECTURAL_DESIGN_SEQUENCE.indexOf(s))).toEqual([...stages.map(s=>ARCHITECTURAL_DESIGN_SEQUENCE.indexOf(s))].sort((a,b)=>a-b));
    expect(stages.every(s=>ARCHITECTURAL_DESIGN_SEQUENCE.includes(s))).toBe(true);
    expect(ARCHITECTURAL_DESIGN_SEQUENCE).toContain('no fixed template, required amenity list or complexity quota');
  });
});
