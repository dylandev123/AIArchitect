import { describe, expect, it } from 'vitest';
import { estateFixtures } from './estatePlanFixtures';
import { auditV3EstatePlan, v3EstatePlanSchema } from '../estatePlan';
import { normalizeV3GenerationOutput } from '../generation';
import { executeV3SceneOperations } from '../operations';
import { validateV3Scene } from '../validation';
import { assessV3Revision } from '../safeRevision';
import { reviewV3Architecture, type V3DesignReview } from '../designReview';
import { compileV3Scene, type V3Scene } from '../scene';
import { v3SceneArchitectPrompt } from '../schema';
import { readFileSync } from 'node:fs';

const review = (scene: V3Scene): V3DesignReview => {const diagnostics=auditV3EstatePlan(scene);return {diagnostics,significant:diagnostics.filter(d=>d.severity==='significant').length,repairRecommended:diagnostics.some(d=>d.severity==='significant')};};
describe('estate master planning',()=>{
  for (const [i,scene] of estateFixtures().entries()) it(`keeps distinct fixture ${i} through normalization, serialization and local edits`,()=>{
    expect(v3EstatePlanSchema.safeParse(scene.estatePlan).success).toBe(true);
    expect(auditV3EstatePlan(scene)).toEqual([]);
    const normalized=normalizeV3GenerationOutput(scene).scene;
    expect(normalized.estatePlan).toEqual(scene.estatePlan);
    const restored=JSON.parse(JSON.stringify(normalized));
    const edit=executeV3SceneOperations(restored,{intent:'Change only the residence finish',operations:[{op:'changeMaterial',target:scene.objects[0].id,material:{id:'bronze',color:'#665544'}}]});
    expect(edit.errors).toEqual([]);
    expect(edit.scene.estatePlan).toEqual(scene.estatePlan);
    expect(auditV3EstatePlan(edit.scene)).toEqual([]);
    expect(edit.scene.objects.map(o=>o.id)).toEqual(scene.objects.map(o=>o.id));
  });
  it('diagnoses missing program without silently dropping references',()=>{
    const scene=estateFixtures()[1]; scene.objects=scene.objects.filter(o=>o.id!=='atelier');
    const normalized=normalizeV3GenerationOutput(scene).scene;
    expect(normalized.estatePlan).toEqual(scene.estatePlan);
    expect(auditV3EstatePlan(normalized)).toContainEqual(expect.objectContaining({code:'ESTATE_MISSING_OBJECT',targetIds:['atelier']}));
    expect(validateV3Scene(normalized,{lenient:true}).ok).toBe(true);
    expect(reviewV3Architecture(normalized).repairRecommended).toBe(true);
  });
  it('checks rotated allocations, reserved space, access and explicit area',()=>{
    const scene=estateFixtures()[0]; scene.estatePlan!.zones[0].allocation!.width=10;
    scene.estatePlan!.zones[1].clearSpace!.z=0;
    scene.relationships=[];
    scene.estatePlan!.requirements[1].range={min:100,max:100};
    expect(auditV3EstatePlan(scene).map(d=>d.code)).toEqual(expect.arrayContaining(['ESTATE_ALLOCATION_CONFLICT','ESTATE_OPEN_SPACE_BLOCKED','ESTATE_ACCESS_MISSING','ESTATE_REQUIREMENT_CONFLICT']));
  });
  it('can edit intent explicitly and rejects malformed plans atomically',()=>{
    const scene=estateFixtures()[0], plan=structuredClone(scene.estatePlan!); plan.character='A quieter palette';
    const result=executeV3SceneOperations(scene,{intent:'Revise character',operations:[{op:'replaceEstatePlan',estatePlan:plan}]});
    expect(result.ok).toBe(true);expect(result.scene.estatePlan).toEqual(plan);
    expect(executeV3SceneOperations(scene,{intent:'Invalid',operations:[{op:'replaceEstatePlan',estatePlan:{version:1}}]}).ok).toBe(false);
  });
  it('accepts exact missing program repair and refuses redesign or plan erasure',()=>{
    const fixed=estateFixtures()[1], broken=structuredClone(fixed);broken.objects=broken.objects.filter(o=>o.id!=='atelier');
    expect(assessV3Revision(broken,fixed,review(broken),review(fixed)).accepted).toBe(true);
    const redesign=structuredClone(fixed);redesign.objects[0].roofForm='hip';
    expect(assessV3Revision(broken,redesign,review(broken),review(redesign)).accepted).toBe(false);
    const erased=structuredClone(broken); delete erased.estatePlan;
    expect(assessV3Revision(broken,erased,review(broken),review(erased)).accepted).toBe(false);
  });
  it('permits only exact missing planned graph edges',()=>{
    const fixed=estateFixtures()[2], broken=structuredClone(fixed);broken.relationships=[];
    expect(assessV3Revision(broken,fixed,review(broken),review(fixed)).accepted).toBe(true);
    fixed.relationships.push({from:fixed.objects[0].id,to:fixed.objects[2].id,kind:'contains'});
    expect(assessV3Revision(broken,fixed,review(broken),review(fixed)).accepted).toBe(false);
  });
  it('checks physical access even when declared graph edges exist',()=>{
    const scene=estateFixtures()[0];
    scene.objects.find(o=>o.type==='path')!.transform.position[0]=35;
    expect(auditV3EstatePlan(scene).map(d=>d.code)).toContain('ESTATE_ACCESS_DISCONNECTED');
  });
  it('retains budget/style intent without claiming cost or aesthetic verification',()=>{
    const scene=estateFixtures()[0];scene.estatePlan!.requirements.push({id:'budget',source:'user',statement:'US$6M maximum',metric:'budget',objectIds:[],range:{min:0,max:6000000}});
    expect(auditV3EstatePlan(scene)).toEqual([expect.objectContaining({code:'ESTATE_REQUIREMENT_UNVERIFIED',severity:'advisory'})]);
  });
  it('keeps all three captured mansions plan-free and compiles identically after round-trip',()=>{
    for(const id of ['91d583fe','f2149916','9646933e']) {
      const scene=JSON.parse(readFileSync(new URL(`./fixtures/mansions/mansion-${id}.json`,import.meta.url),'utf8')).v3Scene as V3Scene;
      const restored=JSON.parse(JSON.stringify(scene));
      expect(restored.estatePlan).toBeUndefined();expect(auditV3EstatePlan(restored)).toEqual([]);
      expect(compileV3Scene(restored)).toEqual(compileV3Scene(scene));
      expect(normalizeV3GenerationOutput(scene).scene.estatePlan).toBeUndefined();
    }
  });
  it('requests concept-first planning in both generation modes without forced amenities',()=>{
    for(const mode of ['flat','advanced'] as const) {
      const prompt=v3SceneArchitectPrompt(mode);
      expect(prompt).toContain('Establish estatePlan before objects in this same response');
      expect(prompt).toContain('Never enlarge explicitly sized buildings');
    }
  });
});
