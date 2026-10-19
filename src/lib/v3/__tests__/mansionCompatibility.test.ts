import { describe, it, expect } from 'vitest';
import original from './fixtures/canopy-meridian-attempt-0.json';
import repaired from './fixtures/canopy-meridian-attempt-1.json';
import { ingestV3GenerationOutput } from '../ingestion';
import { compileV3Scene, validateV3CompiledGeometry } from '../scene';
import { footprintDiagnostics } from '../footprintDiagnostics';
import { getObjectTopY, scaledDimensionsOf } from '../elevation';
import { auditV3Completeness } from '../completeness';

const sceneOf=(raw:unknown)=>ingestV3GenerationOutput(structuredClone(raw),'flat').scene;
describe('recovered mansion construction compatibility',()=>{
 it('constructs the complete projected glazing band on all three north planes without changing authored openings',()=>{
  const scene=sceneOf(original),mass=scene.objects.find(o=>o.id==='mainResidence')!;
  const panes=compileV3Scene(scene).primitives.filter(p=>p.id.includes(':northUpperGlass:')&&p.kind==='box'&&p.transparent);
  expect(panes).toHaveLength(3);
  const xs=panes.flatMap(p=>p.kind==='box'?[p.position[0]-p.size[0]/2,p.position[0]+p.size[0]/2]:[]);
  expect(Math.min(...xs)).toBeCloseTo(-10.07);expect(Math.max(...xs)).toBeCloseTo(10.07);
  expect(mass.composition!.openings).toEqual(original.objects.find(o=>o.id===mass.id)!.composition!.openings);
  expect(footprintDiagnostics(scene).filter(d=>d.message.includes('northUpperGlass'))).toEqual([]);
  expect(footprintDiagnostics(scene).filter(d=>d.code==='FOOTPRINT_FACADE_AMBIGUOUS')).toHaveLength(3);
 });
 it('constructs rectangular bridging slabs and rails on authored outer shoulders, retaining their full spans',()=>{
  const scene=sceneOf(original),mass=scene.objects.find(o=>o.id==='mainResidence')!;
  const parts=compileV3Scene(scene).primitives;
  const slab=parts.find(p=>p.id==='mainResidence-assembly-mainSouthBalcony-mainSouthBalconySlab');
  expect(slab?.kind).toBe('box');if(slab?.kind==='box'){expect(slab.position[0]).toBeCloseTo(0);expect(slab.position[1]).toBeCloseTo(4.11);expect(slab.position[2]).toBeCloseTo(15.2);}
  if(slab?.kind==='box'){expect(slab.size[0]).toBeCloseTo(14.72);expect(slab.size[2]).toBeCloseTo(2.4);}
  expect(parts.filter(p=>p.id.includes('mainSouthBalconyRail'))).toHaveLength(3);
  const portico=parts.find(p=>p.id==='mainResidence-assembly-northPortico-northPorticoSlab');
  expect(portico?.kind).toBe('box');
  if(portico?.kind==='box')for(const p of parts.filter(p=>p.id.includes('northPorticoPost'))){if(p.kind!=='box')continue;
   expect(Math.abs(p.position[0]-portico.position[0])+p.size[0]/2).toBeLessThan(portico.size[0]/2);
   expect(Math.abs(p.position[2]-portico.position[2])+p.size[2]/2).toBeLessThan(portico.size[2]/2);
   expect(p.position[1]+p.size[1]/2).toBeCloseTo(portico.position[1]-portico.size[1]/2);
  }
  expect(footprintDiagnostics(scene).some(d=>d.code==='FOOTPRINT_ASSEMBLY_UNRESOLVED')).toBe(false);
  const anchor=mass.composition!.assemblies![0].parts[0];if(anchor.type==='slab')anchor.start=.4;
  expect(footprintDiagnostics(scene).some(d=>d.code==='FOOTPRINT_ASSEMBLY_UNRESOLVED')).toBe(true);
 });
 it('recognizes explicit eaves encoded redundantly in the roof envelope, retaining articulated geometry',()=>{
  const scene=sceneOf(original),roof=scene.objects.find(o=>o.id==='mainRoof')!;
  const parts=compileV3Scene(scene).primitives.filter(p=>p.sourceObjectId===roof.id);
  const plate=parts.find(p=>p.label==='Roof Plane · expression');expect(plate?.kind).toBe('triMesh');
  if(plate?.kind==='triMesh'){
   expect(Math.max(...plate.vertices.filter((_,i)=>i%3===0))).toBeCloseTo(24.2);
   expect(Math.min(...plate.vertices.filter((_,i)=>i%3===0))).toBeCloseTo(-24.2);
  }
  roof.architecture!.width+=.5;
  expect(footprintDiagnostics(scene).some(d=>d.code==='ROOF_FOOTPRINT_ALIGNMENT_UNSUPPORTED')).toBe(true);
  expect(validateV3CompiledGeometry(scene,compileV3Scene(scene),{lenient:true}).ok).toBe(false);
 });
 it.each([original,repaired])('grounds every derived floating bearing on its host while retaining all semantic objects',raw=>{
  const scene=sceneOf(raw),snapshot=JSON.stringify(scene),parts=compileV3Scene(scene).primitives;
  for(const roof of scene.objects.filter(o=>o.type==='roof-form')){
   const host=scene.objects.find(o=>o.id===roof.hostId)!,[w,,d]=scaledDimensionsOf(host);
   const bearings=parts.filter(p=>p.sourceObjectId===roof.id&&p.id.includes('roof-bearing-'));
   expect(bearings.length).toBeGreaterThan(0);
   for(const p of bearings){expect(p.kind).toBe('box');if(p.kind!=='box')continue;
    expect(p.position[1]-p.size[1]/2).toBeCloseTo(getObjectTopY(host));
    expect(Math.abs(p.position[0]-host.transform.position[0])).toBeLessThanOrEqual(w/2+.00001);
    expect(Math.abs(p.position[2]-host.transform.position[2])).toBeLessThanOrEqual(d/2+.00001);
   }
  }
  expect(JSON.stringify(scene)).toBe(snapshot);
 });
 it('diagnoses unverified offset roofs and blocks host intersections even without articulated footprints',()=>{
  const scene=sceneOf(repaired),roof=scene.objects.find(o=>o.id==='guestRoof')!;
  roof.transform.position[0]+=3;
  expect(footprintDiagnostics(scene).some(d=>d.targetId===roof.id&&d.code==='ROOF_SUPPORT_UNVERIFIED')).toBe(true);
  roof.transform.position[0]-=3;roof.architecture!.baseElevation=4;
  expect(footprintDiagnostics(scene).some(d=>d.targetId===roof.id&&d.code==='ROOF_SUPPORT_UNSUPPORTED')).toBe(true);
 });
 it('reports recessed entry and authored route thresholds without inventing connections',()=>{
  const scene=sceneOf(repaired),audit=auditV3Completeness(scene);
  for(const id of ['entryWalk','guestWalk','wellnessWalk'])expect(audit.findings.some(d=>d.code==='AUTHORED_ACCESS_DISCONNECTED'&&d.targetIds.includes(id))).toBe(true);
  expect(audit.findings.some(d=>d.code==='AUTHORED_ACCESS_THRESHOLD'&&d.targetIds.includes('poolTerrace'))).toBe(true);
  expect(audit.findings.some(d=>d.code==='NO_OUTDOOR_LIVING_ACCESS'&&d.targetIds.includes('meditationCourt'))).toBe(true);
 });
});
