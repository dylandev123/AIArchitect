import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import original from './fixtures/canopy-meridian-attempt-0.json';
import repaired from './fixtures/canopy-meridian-attempt-1.json';
import { ingestV3GenerationOutput } from '../ingestion';
import { corrected } from './correctedMansionFixture';
import { compileV3Scene, validateV3CompiledGeometry } from '../scene';
import { assessV3ObjectiveRevision } from '../safeRevision';
import { v3ConsistencyRepairInstructions } from '../designConsistency';

const ingest = (raw: unknown) => ingestV3GenerationOutput(raw, 'flat', { requireDesignConsistency: true });

describe('new generation consistency contract (offline)',()=>{
 it.each([original,repaired])('reports every remaining conflict without mutating the recovery',raw=>{
  const snapshot=JSON.stringify(raw),result=ingest(raw),findings=result.consistency!.findings;
  expect(JSON.stringify(raw)).toBe(snapshot);
  expect(result.ok).toBe(false);
  expect(findings.filter(f=>f.code==='ESTATE_ALLOCATION_CONFLICT')).toHaveLength(10);
  expect(findings.filter(f=>f.code==='ESTATE_ACCESS_DISCONNECTED')).toHaveLength(5);
  expect(findings.some(f=>f.code==='AUTHORED_ACCESS_DISCONNECTED'&&f.targetIds.includes('entryWalk'))).toBe(true);
  expect(findings.some(f=>f.code==='AUTHORED_SITE_OVERRUN'&&f.targetIds[0]==='southGarden'&&f.message.includes('67'))).toBe(true);
  expect(findings.some(f=>f.code==='NO_OUTDOOR_LIVING_ACCESS'&&f.targetIds.includes('meditationCourt')&&f.classification==='advisory')).toBe(true);
  expect(findings.some(f=>f.code==='AUTHORED_ACCESS_THRESHOLD'&&f.classification==='advisory')).toBe(true);
  const instructions=v3ConsistencyRepairInstructions(result.consistency!);
  expect(instructions.some(s=>s.includes('3.50m'))).toBe(true);
  expect(instructions.some(s=>s.includes('world plan='))).toBe(true);
 });
 it.each([original,repaired])('accepts an explicitly corrected concept while preserving masses, roofs and materials',raw=>{
  const next=corrected(raw),result=ingest(next);
  expect(result.validation.errors).toEqual([]);
  expect(result.consistency!.findings.filter(f=>f.classification!=='advisory')).toEqual([]);
  expect(result.ok).toBe(true);
  expect(result.consistency!.findings.filter(f=>['AUTHORED_ACCESS_THRESHOLD','NO_OUTDOOR_LIVING_ACCESS'].includes(f.code))).toEqual([]);
  for(const before of raw.objects){
    const after=next.objects.find(o=>o.id===before.id)!;
    expect(after.material).toEqual(before.material);
    if(['building-mass','roof-form'].includes(before.type))expect(after.architecture).toEqual(before.architecture);
    if(before.type==='roof-form')expect(after).toEqual(before);
  }
  const model=compileV3Scene(result.scene);
  expect(validateV3CompiledGeometry(result.scene,model,{lenient:true}).ok).toBe(true);
  expect(model.primitives.some(p=>p.id.startsWith('mainStair:tread-'))).toBe(true);
 });
 it('permits local allocation repairs, but refuses path enlargement and unrelated material, mass or commitment changes',()=>{
  const initial=ingest(repaired),next=structuredClone(initial.scene);
  const path=next.objects.find(o=>o.id==='guestWalk')!;
  path.architecture!.width=10;path.dimensions[0]=10;
  expect(assessV3ObjectiveRevision(initial.scene,next,initial.validation.issues).accepted).toBe(false);
  path.architecture=structuredClone(initial.scene.objects.find(o=>o.id===path.id)!.architecture);path.dimensions[0]=3;
  const zone=next.estatePlan!.zones.find(z=>z.id==='zone-guests')!;zone.allocation!.width+=5;
  expect(assessV3ObjectiveRevision(initial.scene,next,initial.validation.issues).accepted).toBe(true);
  const mass=next.objects.find(o=>o.id==='mainResidence')!;mass.material.color='#ffffff';
  expect(assessV3ObjectiveRevision(initial.scene,next,initial.validation.issues).accepted).toBe(false);
  mass.material=structuredClone(initial.scene.objects.find(o=>o.id===mass.id)!.material);
  next.estatePlan!.architecture=[];
  expect(assessV3ObjectiveRevision(initial.scene,next,initial.validation.issues).accepted).toBe(false);
 });
 it('rejects a joined gap even when both members have articulated footprints',()=>{
  const scene=ingestV3GenerationOutput(corrected(repaired),'flat').scene;
  const a=scene.objects.find(o=>o.id==='mainResidence')!;
  const b=structuredClone(a);b.id='separate-sculpture';
  b.architecture={...b.architecture!,x:60};b.transform.position[0]=60;
  scene.objects.push(b);
  scene.estatePlan!.architecture=[{id:'joined-sculptures',form:'joined',objectIds:[a.id,b.id],intent:'joined articulated volumes'}];
  expect(ingest(scene).consistency!.findings.some(f=>f.code==='ESTATE_FORM_UNBUILT'&&f.message.includes('joined-sculptures'))).toBe(true);
 });
 it('does not treat a sub-metre circulation gap as a physical connection',()=>{
  const raw=corrected(repaired);
  raw.objects.find(o=>o.id==='guestWalk')!.architecture.width=9;
  const findings=ingest(raw).consistency!.findings;
  expect(findings.filter(f=>f.code==='ESTATE_ACCESS_DISCONNECTED'&&f.message.includes('0.50m'))).toHaveLength(2);
 });
 it('does not allow an invalid door diagnostic to authorize unrelated opening changes',()=>{
  const initial=ingest(original),next=structuredClone(initial.scene);
  const door=next.objects.find(o=>o.id==='mainResidence')!.composition!.openings!.find(o=>o.id==='southLivingDoor')!;
  if('start' in door){door.end=.38;}
  expect(assessV3ObjectiveRevision(initial.scene,next,initial.validation.issues).accepted).toBe(true);
  if('height' in door)door.height=1;
  expect(assessV3ObjectiveRevision(initial.scene,next,initial.validation.issues).accepted).toBe(false);
 });
 it('retains legacy ingestion and identical compiled geometry; exports repeatable replay evidence',()=>{
  const attempts=[original,repaired].map(raw=>{
    const legacy=ingestV3GenerationOutput(raw,'flat'),current=ingest(raw);
    expect(compileV3Scene(current.scene)).toEqual(compileV3Scene(legacy.scene));
    return {ok:current.ok,findings:current.consistency!.findings,repair:v3ConsistencyRepairInstructions(current.consistency!),corrected:{ok:ingest(corrected(raw)).ok,findings:ingest(corrected(raw)).consistency!.findings}};
  });
  if(process.env.CONSISTENCY_REPLAY_OUTPUT)writeFileSync(process.env.CONSISTENCY_REPLAY_OUTPUT,JSON.stringify({attempts},null,2));
 });
});
