import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { dreamMansion } from '../parity/mansion';
import { PARITY_FIXTURES } from '../parity/fixtures';
import { cottageObject } from '../parity/cottage';
import { compileV3Scene, validateV3CompiledGeometry, type V3Scene } from '../scene';
import { validateV3Scene } from '../validation';
import { auditV3Interior } from '../interior';
import { normalizeV3GenerationOutput } from '../generation';
import { executeV3SceneOperations, type V3SceneOperation } from '../operations';
import { primaryCompositionMass } from '../compositionPolicies';
import { resolvedFacadeComposition, v3CompositionSchema } from '../composition';
import { auditV3RoofComposition } from '../mansionAudit';
const parts = (s:V3Scene,id:string) => compileV3Scene(s).primitives.filter(p=>p.sourceObjectId===id);
const edit = (s:V3Scene,operations:V3SceneOperation[]) => {const r=executeV3SceneOperations(s,{intent:'Offline mansion audit edit',operations});expect(r.ok,r.errors.join('\n')).toBe(true);return r.scene;};
const hash = (s:V3Scene, legacy = false) => createHash('sha256').update(JSON.stringify(compileV3Scene(s, { junctions: !legacy }))).digest('hex');
describe('offline dream mansion',()=>{
  it('has 850 m², six bedrooms, a double-height great room and coherent semantic storeys',()=>{
    const s=dreamMansion();
    expect(s.objects.filter(o=>o.type==='building-mass').reduce((a,o)=>a+o.architecture!.width*o.architecture!.depth*o.levels!,0)).toBe(850);
    expect(s.interior!.rooms.filter(r=>r.program==='bedroom')).toHaveLength(6);
    expect(auditV3Interior(s)).toEqual([]);
    expect(validateV3Scene(s,{lenient:true}).ok).toBe(true);
    expect(validateV3CompiledGeometry(s).ok).toBe(true);
    expect(primaryCompositionMass(s)?.id).toBe('great-room');
    const slabs=parts(s,'great-room').filter(p=>p.componentRole==='floor slab');
    expect(slabs).toHaveLength(2);
    expect(parts(s,'arrival-link').some(p=>p.label.startsWith('Assembly'))).toBe(true);
  });
  it('persists intent through ingestion and JSON reload; IDs are unique and independent of ordering',()=>{
    const s=dreamMansion(), model=compileV3Scene(s);
    expect(compileV3Scene(JSON.parse(JSON.stringify(s)))).toEqual(model);
    const ingested=normalizeV3GenerationOutput(s).scene;
    expect(ingested.objects.map(o=>o.composition)).toEqual(s.objects.map(o=>o.composition));
    expect(new Set(model.primitives.map(p=>p.id)).size).toBe(model.primitives.length);
    const sorted=(s:V3Scene)=>compileV3Scene(s).primitives.sort((a,b)=>a.id.localeCompare(b.id));
    expect(sorted({...s,objects:[...s.objects].reverse()})).toEqual(sorted(s));
  });
  it('room edits and removal of interior semantics cannot destabilize the exterior',()=>{
    const s=dreamMansion(), before=compileV3Scene(s);
    const changed=edit(s,[{op:'editRoom',target:'primary-bedroom',room:{footprint:{x:0,z:1.5,width:10,depth:9}}}]);
    expect(compileV3Scene(changed)).toEqual(before);
    expect(compileV3Scene({...s,interior:undefined})).toEqual(before);
  });
  it('derives distinct view/private/service sides and grades view glazing by storey',()=>{
    const s=dreamMansion(),o=s.objects.find(o=>o.id==='primary-wing')!;
    const c=resolvedFacadeComposition(o,10,12,3.9);
    expect(c.openings!.find(o=>o.id==='intent-south-view')).toMatchObject({floors:'ground',heightRatio:.88});
    expect(c.openings!.find(o=>o.id==='intent-south-upper-0')).toMatchObject({floors:'upper',heightRatio:.72});
    expect(c.openings!.find(o=>o.facade==='north')).toMatchObject({type:'opening-rhythm',sill:3.9*.57});
    expect(v3CompositionSchema.safeParse({mainEntry:{openingId:'missing',canopyDepth:2}}).success).toBe(false);
    expect(v3CompositionSchema.safeParse({openings:[{id:'d',type:'door',facade:'north',floors:'upper',start:.4,end:.6}],mainEntry:{openingId:'d',canopyDepth:2}}).success).toBe(false);
  });
  it('material edits preserve all child identities',()=>{
    const s=dreamMansion(),changed=edit(s,[{op:'changeMaterial',target:'family-wing',material:{id:'new-stone',color:'#c2b599',surface:'stone'}}]);
    expect(compileV3Scene(changed).primitives.map(p=>p.id)).toEqual(compileV3Scene(s).primitives.map(p=>p.id));
  });
  const cases: [string,(s:V3Scene)=>V3SceneOperation[],string[]][] = [
    ['suite envelope',()=>[{op:'editArchitecture',target:'primary-wing',architecture:{width:11,x:14.5}}],['primary-wing']],
    ['new bedroom wing',()=>[{op:'create',object:cottageObject('new-bedroom-wing','building-mass',28,-8,8,8,3.6,.3,{levels:1,roofForm:'flat',composition:{massHierarchy:'secondary',facadeRoles:{south:'view',north:'private'}}})}],['new-bedroom-wing']],
    ['living glazing',s=>[{op:'setComposition',target:'great-room',composition:{...s.objects[0].composition,openings:[{id:'intent-south-view',type:'glazing-zone',facade:'south',floors:'ground',start:.02,end:.98,heightRatio:.94}]}}],['great-room']],
    ['deeper pool terrace',()=>[{op:'editArchitecture',target:'pool-deck',architecture:{depth:10,z:15}}],['pool-deck']],
    ['one roof',()=>[{op:'editArchitecture',target:'great-roof',architecture:{baseElevation:8}}],['great-roof','great-room','family-wing','primary-wing','arrival-link']],
    ['pool move',()=>[{op:'editArchitecture',target:'pool',architecture:{x:3}}],['pool','pool-deck']],
    ['entry material',s=>{const c=s.objects.find(o=>o.id==='arrival-link')!.composition!;return [{op:'setComposition',target:'arrival-link',composition:{...c,mainEntry:{...c.mainEntry!,color:'#664433'}}}];},['arrival-link']],
  ];
  it.each(cases)('%s is local to its authored/dependency region',(_,ops,affected)=>{
    const s=dreamMansion(), changed=edit(s,ops(s));
    expect(validateV3CompiledGeometry(changed).ok).toBe(true);
    if (affected.includes('pool')) {
      expect(changed.objects.find(o=>o.id==='pool-deck')).toEqual(s.objects.find(o=>o.id==='pool-deck'));
      expect(parts(changed,'pool-deck')).not.toEqual(parts(s,'pool-deck'));
    }
    for(const o of s.objects.filter(o=>!affected.includes(o.id))) {
      expect(changed.objects.find(v=>v.id===o.id),o.id).toEqual(o);
      expect(parts(changed,o.id),o.id).toEqual(parts(s,o.id));
    }
  });
  it('can replace one roof family through existing local operations',()=>{
    const s=dreamMansion(), roof=s.objects.find(o=>o.id==='great-roof')!;
    const changed=edit(s,[{op:'delete',target:roof.id},{op:'create',object:{...roof,roofForm:'gable',pitch:22}}]);
    expect(validateV3CompiledGeometry(changed).ok).toBe(true);
    expect(parts(changed,roof.id)).not.toEqual(parts(s,roof.id));
    for(const o of s.objects.filter(o=>!['great-roof','great-room','family-wing','primary-wing','arrival-link'].includes(o.id))) expect(parts(changed,o.id),o.id).toEqual(parts(s,o.id));
  });
  it('main entry accent recolours only the identified door and preserves its canopy identities',()=>{
    const s=dreamMansion(),host=s.objects.find(o=>o.id==='arrival-link')!, c=host.composition!;
    const changed=edit(s,[{op:'setComposition',target:host.id,composition:{...c,mainEntry:{...c.mainEntry!,color:'#664433'}}}]);
    const before=parts(s,host.id), after=parts(changed,host.id);
    expect(after.map(p=>p.id)).toEqual(before.map(p=>p.id));
    const modified=after.filter((p,i)=>JSON.stringify(p)!==JSON.stringify(before[i]));
    expect(modified.length).toBeGreaterThan(0);
    expect(modified.every(p=>p.id.includes(':front-door:')&&p.color==='#664433')).toBe(true);
  });
  it('pins the legacy comparison path and verifies intentional junction-only changes in parity fixtures',()=>{
    // Re-pinned for Graded Site v1: only v3-terrain-surface changed (pool-edge feature lines, shell-only excavation).
    // Re-pinned for presentation repair: explicit paving/grass finishes now reach their own PBR sets (paving was clay
    // tile, grass was untextured) and landscape zones compile groundcover only (planting is presentation-only).
    // Feature fidelity: floating roofs now have .45 m of daylight and discrete bearings. Large has no floating roof and retains its hash.
    const baseline={cottage:'2242787e35c5ada184b4bd31ff2914fc41ea9e38e079e12f68aab8638d8cddc3',villa:'c776cc1e1697f89b91757334801e9369f03bb14503992ac3b2e3d8c3938f33e4',large:'584818c0031771942c117dd685c64dd9fdf05b4b430a0151790c3616dbed8251'};
    for(const key of ['cottage','villa','large'] as const) {
      const s=PARITY_FIXTURES[key]();
      expect(hash(s,true),key).toBe(baseline[key]);
      expect(hash(s),key).not.toBe(baseline[key]);
      expect(validateV3CompiledGeometry(s).ok).toBe(true);
      const unchangedIds=s.objects.filter(o=>!['building-mass','roof-form'].includes(o.type)).map(o=>o.id);
      const unchanged=(ps:ReturnType<typeof compileV3Scene>['primitives'])=>ps.filter(p=>p.id==='v3-terrain-surface'||unchangedIds.includes(p.sourceObjectId??''));
      expect(unchanged(compileV3Scene(s).primitives)).toEqual(unchanged(compileV3Scene(s,{junctions:false}).primitives));
    }
  });
  it.each([0,Math.PI/2,.4])('flags unresolved touching/rotated pitched roof junctions (%s)',rotationY=>{
    const s=dreamMansion();s.objects=[cottageObject('a','building-mass',0,0,10,10,6,0,{roofForm:'gable',pitch:25}),cottageObject('b','building-mass',8,4,10,10,6.2,0,{roofForm:'hip',pitch:20,architecture:{x:8,z:4,width:10,depth:10,height:6.2,baseElevation:0,rotationY}})];
    expect(auditV3RoofComposition(s).map(i=>i.code)).toEqual(['NEAR_ROOF_DATUM','ROOF_JUNCTION_REVIEW']);
    expect(validateV3CompiledGeometry(s).ok).toBe(true); // Finite geometry is NOT watertight roof construction.
  });
  it('exposes both unresolved seams of a U-shaped mass arrangement',()=>{
    const s=dreamMansion();s.objects=[
      cottageObject('bar','building-mass',0,0,20,8,6,0,{roofForm:'hip'}),
      cottageObject('left','building-mass',-7,10,6,12,6.2,0,{roofForm:'gable'}),
      cottageObject('right','building-mass',7,10,6,12,6,0,{roofForm:'gable'}),
    ];
    expect(auditV3RoofComposition(s).filter(i=>i.code==='ROOF_JUNCTION_REVIEW').map(i=>i.targets)).toEqual([['bar','left'],['bar','right']]);
    expect(validateV3CompiledGeometry(s).ok).toBe(true);
  });
  it('reports mansion junction risk without rewriting geometry; separated roofs are clear',()=>{
    const s=dreamMansion(),saved=JSON.stringify(s);expect(auditV3RoofComposition(s).length).toBeGreaterThan(0);expect(JSON.stringify(s)).toBe(saved);
    s.objects=[cottageObject('a','building-mass',0,0,10,10,3),cottageObject('b','building-mass',40,0,10,10,3)];expect(auditV3RoofComposition(s)).toEqual([]);
  });
});
