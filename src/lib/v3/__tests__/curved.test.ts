import { primitiveTriangles } from '../junctionGeometry';
import { ingestV3GenerationOutput } from '../ingestion';
import { resolveV3Circulation } from '../circulation';
import { describe,test,expect } from 'vitest';
import * as THREE from 'three';
import { CURVED_FIXTURES,curvedFixture } from '../parity/curved';
import { compileV3Scene } from '../scene';
import { footprintDiagnostics } from '../footprintDiagnostics';
import { resolveFootprint,footprintContains } from '../footprint';
import { segmentPoint,segmentNormal,resolvePath,offsetPath } from '../curvedFootprint';
import { v3CompositionSchema,v3GenerationCompositionSchema } from '../composition';
import { executeV3SceneOperations } from '../operations';
import { materializeV3ArchitecturalObject } from '../architecture';
import { validateV3Scene } from '../validation';
import type { HousePrimitive } from '@/lib/house/types';
function hits(parts:HousePrimitive[],point:number[],normal:number[]){
 const ray=new THREE.Raycaster(new THREE.Vector3(...point),new THREE.Vector3(...normal),0,2);
 return parts.some(p=>{if(p.kind!=='triMesh')return false;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.vertices,3));const m=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(g,m);mesh.updateMatrixWorld();const hit=ray.intersectObject(mesh).length>0;g.dispose();m.dispose();return hit;});
}
describe('curved architecture production construction',()=>{
 for(const name of CURVED_FIXTURES)test(name,()=>{
  const scene=curvedFixture(name),mass=scene.objects[0],model=compileV3Scene(scene),parts=model.primitives.filter(p=>p.sourceObjectId===mass.id);
  expect(v3CompositionSchema.safeParse(mass.composition).success).toBe(true);
  expect(v3GenerationCompositionSchema.safeParse(mass.composition).success).toBe(true);
  expect(validateV3Scene(scene,{lenient:true}).ok,JSON.stringify(validateV3Scene(scene,{lenient:true}))).toBe(true);
  expect(footprintDiagnostics(scene)).toEqual([]);
  expect(parts.length).toBeGreaterThan(10);
  expect(parts.filter(p=>p.semanticRole!=='vertical circulation').every(p=>p.kind==='triMesh')).toBe(true);
  expect(parts.every(p=>primitiveTriangles(p).vertices.every(Number.isFinite))).toBe(true);
  expect(new Set(parts.map(p=>p.id)).size).toBe(parts.length);
  expect(compileV3Scene(JSON.parse(JSON.stringify(scene)))).toEqual(model);
  // Each authored opening is actually punched in the wall and contains glazing/door geometry.
  for(const op of mass.composition!.openings!){
   if(!('start' in op))continue;
   const s=mass.composition!.footprint!.segments!.find(s=>s.id===op.segmentId)!,u=(op.start+op.end)/2,p=segmentPoint(s,u),n=segmentNormal(s,u),origin=[p[0]+n[0],1.8,p[1]+n[1]],dir=[-n[0],0,-n[1]];
   expect(hits(parts.filter(p=>p.category==='wall'),origin,dir),op.id+' wall cutout').toBe(false);
   expect(hits(parts.filter(p=>p.id.includes(`:${op.id}:`)),origin,dir),op.id+' glazing location').toBe(true);
  }
  // No floor/roof triangles cover the empty envelope corners.
  for(const p of [[-13,10],[13,10]])expect(hits(parts.filter(p=>p.category==='floor'||p.category==='roof'),[p[0],5,p[1]],[0,-1,0])).toBe(false);
 });
 test('circle wall/slab/roof radii, area and material are real, not envelope boxes',()=>{
  const scene=curvedFixture('circular-pavilion'),mass=scene.objects[0],fp=resolveFootprint(mass,0)!;
  expect(fp.polygon.length).toBeGreaterThan(100);
  expect(fp.polygon.every(p=>Math.abs(Math.hypot(...p)-8)<1e-8)).toBe(true);
  const area=fp.polygon.reduce((a,p,i)=>{const q=fp.polygon[(i+1)%fp.polygon.length];return a+(p[0]*q[1]-q[0]*p[1])/2;},0);
  expect(Math.abs(area-Math.PI*64)).toBeLessThan(.05);
  const parts=compileV3Scene(scene).primitives.filter(p=>p.sourceObjectId===mass.id);
  const roof=parts.find(p=>p.category==='roof')!;
  expect(roof.kind).toBe('triMesh');
  if(roof.kind==='triMesh')for(let i=0;i<roof.vertices.length;i+=3)expect(Math.hypot(roof.vertices[i],roof.vertices[i+2])).toBeCloseTo(8.4,3);
  expect(parts.filter(p=>p.label==='Wall').every(p=>p.surface==='stone')).toBe(true);
  expect(footprintContains(mass,[[-1,-1],[1,-1],[1,1],[-1,1]])).toBe(true);
  expect(footprintContains(mass,[[7,7],[8,7],[8,8],[7,8]])).toBe(false);
 });
 test('semantic editing keeps ids and unrelated geometry, without mesh data in persistence',()=>{
  const scene=curvedFixture('circular-pavilion'),before=compileV3Scene(scene),composition=structuredClone(scene.objects[0].composition!);
  composition.footprint!.segments![0].radius=7;
  const result=executeV3SceneOperations(scene,{intent:'Resize rotunda',operations:[{op:'setComposition',target:'residence',composition}]});
  expect(result.ok,result.errors.join(';')).toBe(true);
  const after=compileV3Scene(result.scene);
  expect(after.primitives.map(p=>p.id)).toEqual(before.primitives.map(p=>p.id));
  expect(after.primitives.filter(p=>p.sourceObjectId!=='residence')).toEqual(before.primitives.filter(p=>p.sourceObjectId!=='residence'));
  expect(JSON.stringify(result.scene)).not.toContain('vertices');
  expect(after).not.toEqual(before);
 });
 test('line/arc joins, concave arcs and irregular polygons remain semantic geometry',()=>{
  const polygon=resolvePath([{id:'a',type:'line',start:[-4,-4],end:[4,-4]},{id:'b',type:'line',start:[4,-4],end:[3,4]},{id:'c',type:'line',start:[3,4],end:[-4,2]},{id:'d',type:'line',start:[-4,2],end:[-4,-4]}]);
  expect(polygon?.polygon).toHaveLength(4);
  expect(offsetPath(polygon!.polygon,.3).every(p=>p.every(Number.isFinite))).toBe(true);
  const scene=curvedFixture('circular-pavilion');scene.objects[0].composition!.footprint!.segments=[{id:'top',type:'line',start:[-6,-5],end:[6,-5]},{id:'right',type:'line',start:[6,-5],end:[6,5]},{id:'r-return',type:'line',start:[6,5],end:[5,5]},{id:'inward',type:'arc',center:[0,5],radius:5,startAngle:0,sweep:-180},{id:'l-return',type:'line',start:[-5,5],end:[-6,5]},{id:'left',type:'line',start:[-6,5],end:[-6,-5]}];
  expect(resolveFootprint(scene.objects[0],0)).toBeDefined();
  expect(footprintContains(scene.objects[0],[[-.5,3],[.5,3],[.5,4],[-.5,4]])).toBe(false);
 });
 test('invalid outlines and unsupported roofs never construct rectangular substitutes',()=>{
  const scene=curvedFixture('circular-pavilion'),mass=scene.objects[0];
  mass.roofForm='hip';
  expect(footprintDiagnostics(scene).map(d=>d.code)).toContain('ROOF_FOOTPRINT_UNSUPPORTED');
  expect(compileV3Scene(scene).primitives.some(p=>p.sourceObjectId===mass.id&&p.category==='roof')).toBe(false);
  mass.composition!.footprint!.segments![0].sweep=180;
  expect(footprintDiagnostics(scene).map(d=>d.code)).toContain('FOOTPRINT_INVALID');
  expect(compileV3Scene(scene).primitives.some(p=>p.sourceObjectId===mass.id)).toBe(false);
 });
 test('hosted and mono-pitch roofs follow their host and retain ownership',()=>{
  const scene=curvedFixture('circular-pavilion'),host=scene.objects[0];
  scene.objects.push(materializeV3ArchitecturalObject({...host,id:'roof',type:'roof-form',hostId:host.id,composition:undefined,roofForm:'mono-pitch',architecture:{...host.architecture!,height:.3,baseElevation:4.35}}));
  expect(footprintDiagnostics(scene)).toEqual([]);
  const parts=compileV3Scene(scene).primitives;
  expect(parts.some(p=>p.sourceObjectId==='roof'&&p.label==='Roof Slope'&&p.kind==='triMesh')).toBe(true);
  expect(parts.some(p=>p.sourceObjectId===host.id&&p.category==='roof')).toBe(false);
 });
 test('missing segment addresses diagnose openings and assemblies rather than placing on compass box',()=>{
  const scene=curvedFixture('sweeping-residence');delete scene.objects[0].composition!.openings![0].segmentId;
  const part=scene.objects[0].composition!.assemblies![0].parts[0];if(part.type!=='railing')part.segmentId='missing';
  expect(footprintDiagnostics(scene).map(d=>d.code)).toEqual(expect.arrayContaining(['FOOTPRINT_SEGMENT_UNRESOLVED','FOOTPRINT_ASSEMBLY_UNRESOLVED']));
  expect(compileV3Scene(scene).primitives.some(p=>p.id.startsWith('residence:entry:'))).toBe(false);
 });
});

test('provider ingestion keeps curved semantics; malformed outlines cannot become rectangular masses',()=>{
 const scene=curvedFixture('circular-pavilion'),result=ingestV3GenerationOutput(scene,'flat');
 expect(result.ok).toBe(true);
 expect(result.scene.objects.find(o=>o.id==='residence')?.composition?.footprint).toEqual(scene.objects[0].composition!.footprint);
 expect(result.scene.objects.find(o=>o.id==='residence')?.composition?.openings).toEqual(scene.objects[0].composition!.openings);
 scene.objects[0].composition!.footprint!.segments![0].radius=undefined;
 const bad=ingestV3GenerationOutput(scene,'flat');
 expect(bad.ok).toBe(false);
});
test('curved mansion retains valid circulation and a real slab opening',()=>{
 const scene=curvedFixture('mixed-mansion');
 const resolved=resolveV3Circulation(scene);
 expect(resolved).toHaveLength(1);
 expect(resolved[0].usable).toBe(true);
 expect(resolved[0].issues).toEqual([]);
 const model=compileV3Scene(scene),slabs=model.primitives.filter(p=>p.sourceObjectId==='residence'&&p.label==='Floor slab');
 expect(hits(slabs,[-8,5,-2],[0,-1,0])).toBe(false);
 expect(hits(slabs,[-6,5,-2],[0,-1,0])).toBe(true);
});

test('curved assembly slabs and rails follow their host; floating roof bearings use metres, not tessellation',()=>{
 const scene=curvedFixture('circular-pavilion'),mass=scene.objects[0];mass.roofForm='floating-flat';
 mass.composition!.assemblies=[{id:'balcony',intent:'Curved terrace edge',parts:[{id:'deck',type:'slab',facade:'south',segmentId:'rotunda',start:.05,end:.35,depth:1,elevation:0},{id:'guard',type:'railing',slabId:'deck',edges:['outer','start','end'],height:1.1}]}];
 expect(footprintDiagnostics(scene)).toEqual([]);
 const parts=compileV3Scene(scene).primitives.filter(p=>p.sourceObjectId===mass.id),rails=parts.filter(p=>p.label==='Assembly Railing');
 expect(rails).toHaveLength(3);
 const outer=rails.find(p=>p.id.endsWith('outer'))!;
 expect(outer.kind).toBe('triMesh');
 if(outer.kind==='triMesh')for(let i=0;i<outer.vertices.length;i+=3)expect(Math.abs(Math.hypot(outer.vertices[i],outer.vertices[i+2])-9)).toBeLessThan(.03);
 expect(parts.filter(p=>p.label==='Floating roof bearing')).toHaveLength(13);
});
