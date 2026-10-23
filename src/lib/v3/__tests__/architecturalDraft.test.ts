import {afterEach,describe,expect,it,vi} from 'vitest';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fullPropertyBlueprint} from '../parity/fullPropertyBlueprint';
import {distinctArchitecturalBlueprints} from '../parity/architecturalBlueprint';
import {constructV3ArchitecturalBlueprint,planV3ArchitecturalBlueprint,checkoutV3ArchitecturalBlueprint,type V3ArchitecturalBlueprint} from '../architecturalBlueprint';
import {revalidateArchitecturalScene, type ArchitecturalValidationState} from '../architecturalAcceptance';
import {generateV3FromArchitecturalBlueprint} from '../architecturalBlueprintGeneration';
import {executeV3SceneOperations} from '../operations';
import * as compiler from '../scene';
import {normalizeV3GenerationOutput} from '../generation';
import canopy0 from './fixtures/canopy-meridian-attempt-0.json';
import canopy1 from './fixtures/canopy-meridian-attempt-1.json';
import cloister0 from './fixtures/blueprint-cloister-attempt-0.json';
import cloister1 from './fixtures/blueprint-cloister-attempt-1.json';

afterEach(()=>vi.restoreAllMocks());
const evidence:unknown[]=[];
const build=(bp:V3ArchitecturalBlueprint)=>{
  const plan=planV3ArchitecturalBlueprint(bp,{buildFirst:true});
  return plan.approval?constructV3ArchitecturalBlueprint(plan.approval):{ok:false,outcome:'cannot-construct',findings:plan.findings};
};
const faultyDoor=(bp:V3ArchitecturalBlueprint)=>{bp.doors[0].offset=.1;};
const routeDefect=(bp:V3ArchitecturalBlueprint)=>{bp.connections.find(c=>c.id==='atelier-approach')!.waypoints=[[64.2,0,-27],[64.2,0,-20],[-36,0,-20]];};
const stairDefect=(bp:V3ArchitecturalBlueprint,alternate=true)=>{
  const spaces=bp.buildings[0].storeys[0].spaces;
  spaces[0].footprint={x:-14,z:-7.6,width:6,depth:.8};
  spaces.push({id:'library-south',label:'South library',role:'Quiet reading',program:'study',footprint:{x:-14,z:-2.6,width:6,depth:9.2}});
  bp.roomAdjacencies.push({from:'west-study',to:'library-south'});
  bp.partitions.push({id:'blocked-stair-wall',storeyId:'house-ground',roomAId:'west-study',roomBId:'library-south',boundaryId:'boundary:library-south|west-study',partitionType:'wall',semanticRole:'Wall across secondary stair'});
  if(alternate)bp.verticalCirculation.push({...bp.verticalCirculation[0],id:'gallery-stair',footprint:{x:-4,z:-3,width:1.6,depth:8}});
};

describe('build-first acceptance without architectural substitution',()=>{
  it.each(distinctArchitecturalBlueprints())('keeps $name Complete',({blueprint})=>{
    const built=build(blueprint);expect(built.outcome).toBe('complete');
  });
  const cases:[string,'complete'|'draft'|'cannot-construct',(bp:V3ArchitecturalBlueprint)=>void][]=[
    ['complete full property','complete',()=>{}],
    ['one faulty interior door','draft',faultyDoor],
    ['overlapping internal doors','draft',bp=>{bp.doors.push({...bp.doors[0],id:'overlapping-service-door'});}],
    ['blocked secondary stair with working alternative','draft',bp=>stairDefect(bp)],
    ['only stair blocked','cannot-construct',bp=>stairDefect(bp,false)],
    ['minor route overrun','draft',routeDefect],
    ['invalid main footprint','cannot-construct',bp=>{bp.buildings[0].plan={kind:'outline',segments:[{id:'broken',type:'line',start:[0,0],end:[0,0]}]};}],
    ['missing essential building','cannot-construct',bp=>{bp.buildings.shift();}],
    ['unsupported primary roof','cannot-construct',bp=>{bp.buildings[0].roof.form='dome';}],
    ['unequal storey heights','complete',bp=>{bp.buildings[0].storeys[1].height=5;}],
    ['multiple local faults','draft',bp=>{faultyDoor(bp);routeDefect(bp);stairDefect(bp);}],
    ['unresolved entrance size preserves the building','draft',bp=>{const op=bp.buildings[0].facade.openings![0];if(op.type==='door')op.height=1;}],
  ];
  it.each(cases)('%s → %s',(_name,expected,mutate)=>{
    const bp=fullPropertyBlueprint();mutate(bp);const before=structuredClone(bp),built=build(bp);
    expect(built.outcome,JSON.stringify(built.findings.filter(f=>f.severity==='fatal'),null,2)).toBe(expected);
    expect(bp).toEqual(before);
    evidence.push({name:_name,expected,actual:built.outcome,objects:'scene' in built?built.scene?.objects.length:0,primitives:'model' in built?built.model?.primitives.length:0,findings:built.findings});
    if(built.ok&&'scene' in built){
      expect(built.scene!.objects.map(o=>o.id)).toEqual(bp.buildings.flatMap(b=>[b.id,b.roof.id]).concat(bp.features.map(f=>f.id),bp.connections.map(c=>c.surfaceId)));
      expect(built.scene!.objects[0].composition!.footprint!.kind).toBe('outline');
      expect(built.model!.primitives.some(p=>p.id==='long-pool-water')).toBe(true);
      expect(built.model!.primitives.some(p=>p.id==='crescent-house-assembly-arc-balcony-guard-outer')).toBe(true);
    }else expect('scene' in built).toBe(false);
  });
  it('shows a trim finish defect, retries derived construction, and keeps all geometry',()=>{
    const compile=compiler.compileV3Scene;
    const spy=vi.spyOn(compiler,'compileV3Scene').mockImplementation(scene=>{
      const m=compile(scene);return {...m,primitives:m.primitives.map(p=>p.id==='orchard-atelier-composition-assembly-atelier-portico-lintel'?{...p,color:'#ff0000'}:p)};
    });
    const built=build(fullPropertyBlueprint());expect(built.outcome).toBe('draft');expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(built.findings.some(f=>f.code==='ARCHITECTURAL_PART_FINISH')).toBe(true);
  });
  it('corrects transient derived mesh loss deterministically before another author call',async()=>{
    const compile=compiler.compileV3Scene;let damaged=false;
    vi.spyOn(compiler,'compileV3Scene').mockImplementation(scene=>{
      const m=compile(scene);if(damaged)return m;damaged=true;
      return {...m,primitives:m.primitives.filter(p=>p.id!=='crescent-house:salon-glass:level-0:glass')};
    });
    const author=vi.fn(async()=>({output:fullPropertyBlueprint()}));
    const built=await generateV3FromArchitecturalBlueprint('A curved home and complete estate',author);
    expect(built.outcome).toBe('complete');expect(author).toHaveBeenCalledTimes(1);
  });
  it('returns a one-call editable draft, then repairs its current scene and promotes only after full revalidation',async()=>{
    const bp=fullPropertyBlueprint();faultyDoor(bp);const author=vi.fn(async()=>({output:bp}));
    const draft=await generateV3FromArchitecturalBlueprint('A curved home and complete estate',author);
    expect(draft.outcome).toBe('draft');expect(author).toHaveBeenCalledTimes(1);
    const scene=JSON.parse(JSON.stringify(draft.scene)) as compiler.V3Scene;
    expect(compiler.compileV3Scene(scene).primitives.length).toBeGreaterThan(100);
    const edited=executeV3SceneOperations(scene,{intent:'Refine the service door',operations:[{op:'setDoor',door:{...scene.interior!.doors![0],offset:3}}]});
    expect(edited.errors).toEqual([]);expect(edited.ok).toBe(true);
    expect((edited.scene.metadata.architecturalValidation as ArchitecturalValidationState).status).toBe('complete');
    expect(revalidateArchitecturalScene(edited.scene).outcome).toBe('complete');
    expect(checkoutV3ArchitecturalBlueprint(edited.scene).ok).toBe(true);
  });
  it('retains overlapping-door defects during reload rather than promoting from stale metadata',()=>{
    const bp=fullPropertyBlueprint();bp.doors.push({...bp.doors[0],id:'overlapping-service-door'});
    const built=build(bp);if(!('scene' in built)||!built.scene)throw Error('fixture');
    const reloaded=revalidateArchitecturalScene(JSON.parse(JSON.stringify(built.scene)));
    expect(reloaded.outcome).toBe('draft');
    expect(reloaded.findings.some(f=>f.code==='ARCHITECTURAL_DOOR_OVERLAP'&&f.severity==='fatal')).toBe(true);
  });
  it('recomputes a stale derived route envelope and keeps the authoritative route unchanged',()=>{
    const built=build(fullPropertyBlueprint());if(!('scene' in built)||!built.scene)throw Error('fixture');
    const scene=structuredClone(built.scene),owner=scene.objects.find(o=>o.id==='entry-walk')!;
    const route=structuredClone(scene.estatePlan!.circulation.find(r=>r.id==='principal-approach'));
    owner.dimensions=[1,.1,1];owner.transform.position=[40,.05,40];
    const corrected=revalidateArchitecturalScene(scene);
    expect(corrected.outcome).toBe('complete');
    expect(corrected.diagnostics.some(f=>f.classification==='locally-recoverable')).toBe(true);
    expect(corrected.scene?.estatePlan!.circulation.find(r=>r.id==='principal-approach')).toEqual(route);
    expect(corrected.scene?.objects.find(o=>o.id==='entry-walk')).toEqual(built.scene.objects.find(o=>o.id==='entry-walk'));
  });
  it('never tolerates missing safety guards or missing main components',()=>{
    const compile=compiler.compileV3Scene;
    vi.spyOn(compiler,'compileV3Scene').mockImplementation(scene=>{const m=compile(scene);return {...m,primitives:m.primitives.filter(p=>p.id!=='crescent-house-assembly-arc-balcony-guard-outer')};});
    const built=build(fullPropertyBlueprint());expect(built.outcome).toBe('cannot-construct');
    expect(built.findings.some(f=>f.code==='ARCHITECTURAL_ASSEMBLY_UNBUILT')).toBe(true);
  });
  it('replays all recovered mansion attempts without translating or silently accepting the old contract',()=>{
    const recovered=[canopy0,canopy1,cloister0,cloister1].map(raw=>{
      const bytes=JSON.stringify(raw),scene=normalizeV3GenerationOutput(raw,'flat').scene;
      const result=revalidateArchitecturalScene(scene);
      expect(result.outcome).toBe('cannot-construct');expect(JSON.stringify(raw)).toBe(bytes);
      return {sha256:createHash('sha256').update(bytes).digest('hex'),outcome:result.outcome,diagnostics:result.diagnostics};
    });
    if(process.env.ARCHITECTURAL_DRAFT_PROOF)writeFileSync(process.env.ARCHITECTURAL_DRAFT_PROOF,JSON.stringify({cases:evidence,recovered},null,2)+'\n');
  });
});
