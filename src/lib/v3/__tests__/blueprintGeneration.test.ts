import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { v3BlueprintFirstEnabled, V3_BLUEPRINT_FIRST_PROMPT, V3_BLUEPRINT_REPAIR_PROMPT } from '../blueprintGeneration';
import { v3BlueprintSchema } from '../blueprintSchema';
import { v3SceneArchitectPrompt, v3SceneOutputSchema } from '../schema';
import { ingestV3GenerationOutput } from '../ingestion';
import { compileV3Scene, type V3Scene } from '../scene';
import { assessV3ObjectiveRevision, assessV3Revision } from '../safeRevision';
import { reviewV3Architecture } from '../designReview';
import { materializeV3ArchitecturalObject } from '../architecture';
import { blueprintProviderFixtures } from './blueprintProviderFixtures';

const options = {requireBlueprint:true,requireDesignConsistency:true};
const fixtures = blueprintProviderFixtures();
const ingest = (raw: unknown) => ingestV3GenerationOutput(JSON.parse(JSON.stringify(raw)), 'flat', options);
const circle = () => ingest(fixtures[2].output).scene;
const conventional = () => ingest(fixtures[4].output).scene;

describe('blueprint-first generation contract (no provider)',()=>{
  it('requires exact server opt-in and leaves advanced terrain unchanged',()=>{
    for (const value of [undefined,'','0','true','false']) expect(v3BlueprintFirstEnabled(value,'flat')).toBe(false);
    expect(v3BlueprintFirstEnabled('1','flat')).toBe(true);
    expect(v3BlueprintFirstEnabled('1','advanced')).toBe(false);
    expect(v3SceneArchitectPrompt('flat')).not.toContain('BLUEPRINT-FIRST AUTHORING');
    expect(v3SceneArchitectPrompt('flat',{blueprintFirst:true})).toContain(V3_BLUEPRINT_FIRST_PROMPT);
  });

  it.each(fixtures)('ingests and compiles provider-shaped $name with stable references',({output})=>{
    expect(v3SceneOutputSchema.safeParse(output).error?.issues).toBeUndefined();
    const snapshot=JSON.stringify(output), result=ingest(output);
    expect(result.validation.errors).toEqual([]);
    expect(result.consistency?.ok).toBe(true);
    expect(result.geometryAudit?.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.blueprintApproval).toBeDefined();
    expect(JSON.stringify(output)).toBe(snapshot);
    const plain=structuredClone(result.scene);delete plain.estatePlan!.blueprint;
    expect(compileV3Scene(result.scene)).toEqual(compileV3Scene(plain));
    expect(assessV3ObjectiveRevision(result.scene,result.scene,[]).accepted).toBe(true);
  });

  it('keeps legacy generations without blueprints compatible and permits adding only a missing index',()=>{
    const fixed=conventional(), missing=structuredClone(fixed);delete missing.estatePlan!.blueprint;
    expect(ingestV3GenerationOutput(missing,'flat').ok).toBe(true);
    const failure=ingest(missing);
    expect(failure.validation.errors.join(' ')).toContain('BLUEPRINT_MISSING');
    expect(assessV3ObjectiveRevision(failure.scene,fixed,failure.validation.issues).accepted).toBe(true);
    fixed.estatePlan!.character='An unrelated replacement style';
    expect(assessV3ObjectiveRevision(failure.scene,fixed,failure.validation.issues).accepted).toBe(false);
  });

  const contradictions: [string,(s:V3Scene)=>void,string][] = [
    ['dangling building identity',s=>{s.estatePlan!.blueprint!.buildings[0].objectId='missing-mass';},'BLUEPRINT_REFERENCE'],
    ['entrance on nonexistent wall',s=>{s.objects[0].composition!.openings![0].segmentId='absent-wall';},'BLUEPRINT_ENTRANCE_WALL'],
    ['unsupported circular gable',s=>{s.objects[0].roofForm='gable';},'ROOF_FOOTPRINT_UNSUPPORTED'],
    ['erased circular commitment',s=>{delete s.objects[0].composition!.footprint;},'ESTATE_FORM_UNBUILT'],
    ['main entrance not indexed',s=>{s.estatePlan!.blueprint!.entrances=[];},'BLUEPRINT_MAIN_ENTRY'],
    ['missing planned route',s=>{s.estatePlan!.blueprint!.routeIds=['ghost-route'];},'BLUEPRINT_REFERENCE'],
  ];
  it.each(contradictions)('rejects %s with a precise diagnostic',(_name,mutate,code)=>{
    const s=circle();mutate(s);const result=ingest(s);
    expect(result.ok).toBe(false);
    expect(result.blueprint?.findings.some(f=>f.code===code && f.targetIds.length>0 && f.message.length>10),JSON.stringify(result.validation.errors)).toBe(true);
    expect(result.geometryAudit).toBeUndefined();
  });

  it.each([null,[],{version:2}, {version:1,buildings:'wrong'}])('rejects malformed blueprint %j without stripping it',blueprint=>{
    const raw=structuredClone(fixtures[2].output) as {estatePlan:{blueprint:unknown}};
    raw.estatePlan.blueprint=blueprint;
    const result=ingest(raw);
    expect(result.ok).toBe(false);
    expect(result.validation.errors.join(' ')).toContain('BLUEPRINT_INVALID_INPUT');
    expect(result.scene.estatePlan!.blueprint).toEqual(blueprint);
  });

  it('accepts only a diagnosed path correction on an unapproved plan, keeping buildings and index intact',()=>{
    const fixed=conventional(), bad=structuredClone(fixed);
    // Use the non-spatial path contract to exercise actual door contact and path repair permissions.
    delete fixed.estatePlan!.circulation[0].spatial;delete bad.estatePlan!.circulation[0].spatial;
    const path=bad.objects.find(o=>o.type==='path')!;path.architecture!.z+=2;
    bad.objects=bad.objects.map(materializeV3ArchitecturalObject);
    const failure=ingest(bad), candidate=ingest(fixed);
    expect(failure.ok).toBe(false);expect(failure.blueprintApproval).toBeUndefined();expect(candidate.ok).toBe(true);
    expect(failure.validation.errors.join(' ')).toContain('BLUEPRINT_ROUTE_THRESHOLD');
    expect(assessV3ObjectiveRevision(failure.scene,candidate.scene,failure.validation.issues).accepted).toBe(true);
    candidate.scene.objects[0].architecture!.x+=1;
    expect(assessV3ObjectiveRevision(failure.scene,candidate.scene,failure.validation.issues).accepted).toBe(false);
  });

  it('repairs an incompatible roof within the existing permissions without replacing the circular footprint',()=>{
    const fixed=circle(), bad=structuredClone(fixed);bad.objects[0].roofForm='gable';
    const failure=ingest(bad), candidate=ingest(fixed);
    expect(failure.ok).toBe(false);expect(candidate.ok).toBe(true);
    expect(assessV3ObjectiveRevision(failure.scene,candidate.scene,failure.validation.issues).accepted).toBe(true);
    delete candidate.scene.objects[0].composition!.footprint;
    expect(assessV3ObjectiveRevision(failure.scene,candidate.scene,failure.validation.issues).accepted).toBe(false);
  });

  it.each([
    ['curved form replaced',s=>{delete s.objects[0].composition!.footprint;}],
    ['main entry redirected',s=>{s.objects[0].composition!.mainEntry!.openingId='other';}],
    ['blueprint erased',s=>{delete s.estatePlan!.blueprint;}],
    ['style changed',s=>{s.estatePlan!.character='An unrelated architectural style';}],
    ['planned amenity removed',s=>{s.objects=s.objects.filter(o=>o.type!=='landscape-zone');}],
    ['unrelated building moved',s=>{s.objects[0].architecture!.x+=1;s.objects=s.objects.map(materializeV3ArchitecturalObject);}],
  ] satisfies [string,(s:V3Scene)=>void][])('rejects repair drift: %s',(_name,mutate)=>{
    const original=_name==='planned amenity removed'?conventional():circle(), candidate=structuredClone(original);
    mutate(candidate);
    const initial=ingest(original);
    expect(ingestV3GenerationOutput(candidate,'flat',{...options,approvedBlueprint:initial.blueprintApproval}).ok).toBe(false);
    expect(assessV3ObjectiveRevision(original,candidate,[{code:'INVALID_ARCHITECTURE',targetId:original.objects[0].id,message:'synthetic construction issue'}]).accepted).toBe(false);
    const review=reviewV3Architecture(original);
    expect(assessV3Revision(original,candidate,review,review).accepted).toBe(false);
  });

  it('preserves an approved layout during a permitted detail repair',()=>{
    const original=circle(), candidate=structuredClone(original), initial=ingest(original);
    candidate.objects[0].material={id:'repair-finish',color:'#cccccc'};
    expect(ingestV3GenerationOutput(candidate,'flat',{...options,approvedBlueprint:initial.blueprintApproval}).ok).toBe(true);
    expect(assessV3ObjectiveRevision(original,candidate,[{code:'INVALID_MATERIAL',targetId:original.objects[0].id,message:'Invalid finish'}]).accepted).toBe(true);
  });

  it('records reproducible output overhead and offline acceptance evidence',()=>{
    const evidence=fixtures.map(({name,output})=>{
      const r=ingest(output), bp=JSON.stringify(r.scene.estatePlan!.blueprint), legacy=structuredClone(output) as {estatePlan:{blueprint?:unknown}};
      delete legacy.estatePlan.blueprint;
      return {name,ok:r.ok,fatalCodes:r.validation.issues.filter(i=>i.severity==='fatal').map(i=>i.code),
        blueprintCharacters:bp.length,estimatedBlueprintTokens:Math.ceil(bp.length/4),
        responseCharacters:JSON.stringify(output).length,legacyResponseCharacters:JSON.stringify(legacy).length,
        compiled:r.geometryAudit?.ok??false};
    });
    expect(evidence.every(e=>e.ok)).toBe(true);
    const rejected=contradictions.map(([name,mutate,expectedCode])=>{
      const s=circle();mutate(s);const r=ingest(s);
      return {name,ok:r.ok,expectedCode,findings:r.blueprint?.findings.filter(f=>f.severity==='fatal')};
    });
    expect(rejected.every(r=>!r.ok && r.findings?.some(f=>f.code===r.expectedCode))).toBe(true);
    const malformed=[null,[],{version:2},{version:1,buildings:'wrong'}].map(blueprint=>{
      const raw=structuredClone(fixtures[2].output) as {estatePlan:{blueprint:unknown}};raw.estatePlan.blueprint=blueprint;
      const r=ingest(raw);return {blueprint,ok:r.ok,findings:r.blueprint?.findings};
    });
    const fixed=circle(), badRoof=structuredClone(fixed);badRoof.objects[0].roofForm='gable';
    const failed=ingest(badRoof), approved=ingest(fixed), moved=structuredClone(fixed);
    moved.objects[0].architecture!.x+=1;moved.objects=moved.objects.map(materializeV3ArchitecturalObject);
    const repairEvidence={roofOnlyAccepted:assessV3ObjectiveRevision(failed.scene,fixed,failed.validation.issues).accepted,
      approvedRelocationAccepted:ingestV3GenerationOutput(moved,'flat',{...options,approvedBlueprint:approved.blueprintApproval}).ok};
    expect(repairEvidence).toEqual({roofOnlyAccepted:true,approvedRelocationAccepted:false});
    if(process.env.BLUEPRINT_GENERATION_REPLAY_OUTPUT) writeFileSync(process.env.BLUEPRINT_GENERATION_REPLAY_OUTPUT,JSON.stringify({
      offline:true,providerCalls:0,tokenEstimate:'characters / 4 heuristic; not a tokenizer measurement',
      addedPromptCharacters:V3_BLUEPRINT_FIRST_PROMPT.length,estimatedAddedPromptTokens:Math.ceil(V3_BLUEPRINT_FIRST_PROMPT.length/4),
      repairGuidanceCharacters:V3_BLUEPRINT_REPAIR_PROMPT.length,estimatedRepairGuidanceTokens:Math.ceil(V3_BLUEPRINT_REPAIR_PROMPT.length/4),
      blueprintSchemaCharacters:JSON.stringify(z.toJSONSchema(v3BlueprintSchema)).length,
      addedTransmittedSchemaCharacters:0,exactProviderSchemaTransmitted:false,fixtures:evidence,rejected,malformed,repairEvidence,
      repeatedProviderSpatialContradictions:'Not measured: synthetic fixtures cannot establish a reduction in provider failures or creative quality.',
    },null,2)+'\n');
  });
});
