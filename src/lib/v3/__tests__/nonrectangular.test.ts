import { describe,test,expect } from 'vitest';
import { compileV3Scene } from '../scene';
import { footprintFixture, FOOTPRINT_FIXTURES } from '../parity/nonrectangular';
import { footprintContains,resolveFootprint } from '../footprint';
import { footprintDiagnostics } from '../footprintDiagnostics';
import { executeV3SceneOperations } from '../operations';
import { validateV3Scene } from '../validation';
import { v3CompositionSchema } from '../composition';
import { deriveV3MassJunctions } from '../junctions';

describe('articulated footprint construction',()=>{
 for(const name of FOOTPRINT_FIXTURES)test(name,()=>{
  const scene=footprintFixture(name),mass=scene.objects[0],model=compileV3Scene(scene),parts=model.primitives.filter(p=>p.sourceObjectId===mass.id);
  expect(validateV3Scene(scene,{lenient:true}).ok).toBe(true);
  expect(footprintDiagnostics(scene)).toEqual([]);
  expect(new Set(parts.map(p=>p.id)).size).toBe(parts.length);
  expect(parts.some(p=>p.category==='roof'&&p.kind==='triMesh')).toBe(true);
  expect(parts.some(p=>p.category==='window')).toBe(true);
  expect(resolveFootprint(mass,0)?.polygon.length).toBeGreaterThan(4);
  expect(compileV3Scene(JSON.parse(JSON.stringify(scene)))).toEqual(model);
 });
 test('courtyard slabs and roof do not bridge the void; glazing sits on the setback wall',()=>{
  const scene=footprintFixture('u-courtyard'),mass=scene.objects[0],parts=compileV3Scene(scene).primitives.filter(p=>p.sourceObjectId===mass.id);
  expect(footprintContains(mass,[[-2,4],[2,4],[2,7],[-2,7]])).toBe(false);
  const door=parts.filter(p=>p.id.includes(':garden-door:')&&p.kind==='box');
  expect(door.length).toBeGreaterThan(0);
  expect(door.every(p=>p.kind==='box'&&Math.abs(p.position[2]+1)<.3)).toBe(true);
  for(const p of parts.filter(p=>p.category==='floor'&&p.kind==='box'))if(p.kind==='box')expect(Math.abs(p.position[0])<p.size[0]/2&&Math.abs(5-p.position[2])<p.size[2]/2).toBe(false);
 });
 test('footprint edit leaves unrelated construction and semantic envelope unchanged',()=>{
  const scene=footprintFixture('l-residence'),before=compileV3Scene(scene),composition=structuredClone(scene.objects[0].composition!);
  composition.footprint!.operations=[{id:'garden-cut',type:'notch',corner:'se',width:7,depth:5}];
  const result=executeV3SceneOperations(scene,{intent:'Edit the footprint',operations:[{op:'setComposition',target:'residence',composition}]});
  expect(result.ok,result.errors.join(';')).toBe(true);
  expect(result.scene.objects[0].architecture).toEqual(scene.objects[0].architecture);
  expect(compileV3Scene(result.scene).primitives.filter(p=>p.sourceObjectId==='unrelated-studio')).toEqual(before.primitives.filter(p=>p.sourceObjectId==='unrelated-studio'));
  expect(compileV3Scene(result.scene).primitives.filter(p=>p.sourceObjectId==='residence')).not.toEqual(before.primitives.filter(p=>p.sourceObjectId==='residence'));
 });
 test('unsupported pitched roofs retain intent and do not flatten',()=>{
  const scene=footprintFixture('l-residence');scene.objects[0].roofForm='hip';
  expect(footprintDiagnostics(scene).some(d=>d.code==='ROOF_FOOTPRINT_UNSUPPORTED')).toBe(true);
  expect(compileV3Scene(scene).primitives.filter(p=>p.sourceObjectId==='residence'&&p.category==='roof')).toEqual([]);
  expect(scene.objects[0].roofForm).toBe('hip');
 });
 test('invalid geometry is diagnosed and falls back without discarding openings',()=>{
  const scene=footprintFixture('l-residence');scene.objects[0].composition!.footprint!.operations=[{type:'notch',corner:'se',width:40,depth:30}];
  expect(footprintDiagnostics(scene).some(d=>d.code==='FOOTPRINT_INVALID')).toBe(true);
  expect(compileV3Scene(scene).primitives.some(p=>p.id.includes(':entry:'))).toBe(true);
 });
 test('projection stays inside unchanged envelope and has exterior glazing',()=>{
  const scene=footprintFixture('l-residence'),mass=scene.objects[0];
  mass.composition={footprint:{kind:'articulated',operations:[{type:'projection',facade:'south',start:.3,end:.7,depth:3}]},openings:[{id:'projection-glass',type:'glazing-zone',facade:'south',start:.35,end:.65,heightRatio:.8}]};
  expect(footprintDiagnostics(scene)).toEqual([]);
  const fp=resolveFootprint(mass,0)!;expect(fp.polygon.every(([x,z])=>Math.abs(x+fp.frame.x)<=12&&Math.abs(z+fp.frame.z)<=9)).toBe(true);
  expect(compileV3Scene(scene).primitives.some(p=>p.id.includes(':projection-glass:')&&p.kind==='box'&&Math.abs(p.position[2]-9)<.3)).toBe(true);
 });
 test('ambiguous facade span is diagnosed instead of duplicated across depths',()=>{
  const scene=footprintFixture('u-courtyard');scene.objects[0].composition!.openings=[{id:'ambiguous',type:'door',facade:'south',start:.1,end:.9}];delete scene.objects[0].composition!.mainEntry;
  expect(footprintDiagnostics(scene).some(d=>d.code==='FOOTPRINT_FACADE_AMBIGUOUS')).toBe(true);
  expect(compileV3Scene(scene).primitives.some(p=>p.id.includes(':ambiguous:'))).toBe(false);
 });
 test('junctions do not erase articulated walls',()=>{
  const scene=footprintFixture('l-residence');scene.objects[1]={...scene.objects[0],id:'touching',architecture:undefined};
  expect(deriveV3MassJunctions(scene).junctions.every(j=>!j.supported)).toBe(true);
 });
 test('schema accepts operations without requiring a template',()=>{
  expect(v3CompositionSchema.safeParse({}).success).toBe(true);
  expect(v3CompositionSchema.safeParse({footprint:{kind:'articulated',operations:[]}}).success).toBe(true);
 });
});

describe('footprint integration',()=>{
 test('ingestion and provider schema preserve articulated intent',async()=>{
  const {ingestV3GenerationOutput}=await import('../ingestion');
  const {v3GenerationCompositionSchema}=await import('../composition');
  const scene=footprintFixture('chamfered'),result=ingestV3GenerationOutput(scene);
  expect(result.ok).toBe(true);
  expect(result.scene.objects[0].composition?.footprint).toEqual(scene.objects[0].composition?.footprint);
  expect(v3GenerationCompositionSchema.safeParse(scene.objects[0].composition).success).toBe(true);
 });
 test('safe revision cannot remove or simplify a footprint',async()=>{
  const {assessV3Revision}=await import('../safeRevision');
  const scene=footprintFixture('l-residence'),revised=structuredClone(scene);
  delete revised.objects[0].composition!.footprint;
  const review={diagnostics:[],significant:0,repairRecommended:false};
  const decision=assessV3Revision(scene,revised,review,review);
  expect(decision.accepted).toBe(false);
  expect(decision.reasons.some(r=>r.includes('composition.footprint'))).toBe(true);
 });
 test('circulation inside the envelope but in the courtyard is blocked',async()=>{
  const {resolveV3Circulation}=await import('../circulation');
  const scene=footprintFixture('u-courtyard');
  scene.interior={storeys:[],rooms:[],circulation:[{id:'stair',type:'stair',hostMassId:'residence',fromLevel:0,toLevel:1,footprint:{x:0,z:4,width:1.2,depth:5.5},direction:'north'}]};
  expect(resolveV3Circulation(scene)[0].issues.some(i=>i.code==='CIRCULATION_OUTSIDE_HOST')).toBe(true);
  scene.interior.circulation![0].footprint.x=-9;
  expect(resolveV3Circulation(scene)[0].issues.some(i=>i.code==='CIRCULATION_OUTSIDE_HOST')).toBe(false);
 });
 test('corner-only containment does not certify a terrace bridging a courtyard',async()=>{
  const {rooftopTerraces}=await import('../rooftopFeatures');
  const {materializeV3ArchitecturalObject}=await import('../architecture');
  const scene=footprintFixture('u-courtyard'),host=scene.objects[0];
  expect(footprintContains(host,[[-10,-5],[10,-5],[10,5],[-10,5]],1)).toBe(false);
  scene.objects.push(materializeV3ArchitecturalObject({...host,id:'terrace',type:'terrace',hostId:host.id,composition:undefined,architecture:{x:0,z:3,width:20,depth:4,height:.2,baseElevation:6.95}}));
  expect(rooftopTerraces(scene)).toEqual([]);
  expect(footprintDiagnostics(scene).some(d=>d.code==='FOOTPRINT_SUPPORT_OUTSIDE_HOST')).toBe(true);
 });
 test('entry recess relocates door and its canopy to the same resolved wall',()=>{
  const scene=footprintFixture('l-residence'),host=scene.objects[0];
  host.composition!.footprint!.operations=[{type:'entry-recess',facade:'north',width:6,depth:2}];
  host.composition!.openings=host.composition!.openings!.filter(o=>o.id==='entry');
  const parts=compileV3Scene(scene).primitives;
  expect(footprintDiagnostics(scene)).toEqual([]);
  expect(parts.filter(p=>p.id.includes(':entry:')).every(p=>p.kind==='box'&&Math.abs(p.position[2]+7)<.3)).toBe(true);
  expect(parts.some(p=>p.id.includes('entry-entry-canopy')&&p.kind==='box'&&Math.abs(p.position[2]+7.7)<.01)).toBe(true);
 });
 test('authored hosted roof uses the polygon and retains thickness, overhang and ownership',async()=>{
  const {materializeV3ArchitecturalObject}=await import('../architecture');
  const scene=footprintFixture('l-residence'),host=scene.objects[0];
  scene.objects.push(materializeV3ArchitecturalObject({...host,id:'roof',type:'roof-form',hostId:host.id,composition:undefined,architecture:{...host.architecture!,height:.6,baseElevation:3.75},overhang:1}));
  const parts=compileV3Scene(scene).primitives.filter(p=>p.sourceObjectId==='roof');
  expect(parts.length).toBeGreaterThan(0);
  expect(parts.every(p=>p.kind==='triMesh')).toBe(true);
  const ys=parts.flatMap(p=>p.kind==='triMesh'?p.vertices.filter((_,i)=>i%3===1):[]);
  expect(Math.max(...ys)-Math.min(...ys)).toBeCloseTo(.6);
  expect(compileV3Scene(scene).primitives.some(p=>p.sourceObjectId===host.id&&p.category==='roof')).toBe(false);
 });
 test('floor-scoped operations preserve different storey outlines',()=>{
  const scene=footprintFixture('u-courtyard'),host=scene.objects[0];
  host.composition!.footprint!.operations[0].floors='ground';
  expect(resolveFootprint(host,0)!.polygon.length).toBe(8);
  expect(resolveFootprint(host,1)!.polygon.length).toBe(4);
  host.roofForm='gable';
  expect(footprintDiagnostics(scene).some(d=>d.code==='ROOF_FOOTPRINT_UNSUPPORTED')).toBe(false);
 });
});

test('roof triangles leave the authored L/U cuts and chamfered corners open',()=>{
 const inTriangle=(x:number,z:number,v:number[])=>{
  const [ax,az,bx,bz,cx,cz]=[v[0],v[2],v[3],v[5],v[6],v[8]];
  const area=(bx-ax)*(cz-az)-(bz-az)*(cx-ax);if(Math.abs(area)<1e-8)return false;
  const a=(bx-x)*(cz-z)-(bz-z)*(cx-x),b=(cx-x)*(az-z)-(cz-z)*(ax-x),c=(ax-x)*(bz-z)-(az-z)*(bx-x);
  return !((a<0||b<0||c<0)&&(a>0||b>0||c>0));
 };
 for(const [name,x,z] of [['l-residence',9,6],['u-courtyard',0,5],['chamfered',11,8]] as const){
  const roofs=compileV3Scene(footprintFixture(name)).primitives.filter(p=>p.sourceObjectId==='residence'&&p.category==='roof');
  expect(roofs.length).toBeGreaterThan(0);
  for(const p of roofs)if(p.kind==='triMesh')for(let i=0;i<p.vertices.length;i+=9)expect(inTriangle(x,z,p.vertices.slice(i,i+9)),`${name}/${p.id}`).toBe(false);
 }
});
