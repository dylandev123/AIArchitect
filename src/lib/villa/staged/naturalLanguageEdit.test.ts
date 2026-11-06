import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {POST} from '@/app/api/ai/scene/edit-staged/route';
import {editAcceptedStagedSave,stagedSaveHash} from './naturalLanguageEdit';
import {loadHouse,saveHouse} from './save';
import {poolWaterNorth} from './poolGeometry';
const saved=readFileSync('docs/architecture/staged-villa/stage5-site/terra-stage5.save.json','utf8'),original=loadHouse(saved);
const instruction='Move the swimming pool two metres closer to the veranda without changing the building.';
const proposal={summary:instruction,ops:[{op:'move-pool-relative',pool:'pool',veranda:'veranda:south-veranda',direction:'towards',distance:2}]};
const input={save:saved,instruction,expectedHash:stagedSaveHash(saved),proposal};
describe('Natural-language accepted Stage 5 editing path; mocked planner, real Terra house',()=>{
 it('accepts the real save through the route, moves water exactly two metres, preserves building and unrelated landscape, reloads',async()=>{
  const response=await POST(new Request('http://localhost/api/ai/scene/edit-staged',{method:'POST',body:JSON.stringify(input)}));expect(response.status).toBe(200);const r=await response.json();expect(r.accepted).toBe(true);expect(r.providerCalls).toBe(0);
  const h=loadHouse(r.save);expect(poolWaterNorth(original.spec.siteWork.pool!)-poolWaterNorth(h.spec.siteWork.pool!)).toBeCloseTo(2,8);expect(h.scene.elements).toHaveLength(379);
  for(const k of ['blocks','links','stairs','exterior','trim','direction','openSpaces','site','sitePresentation']as const)expect(h.spec[k]).toEqual(original.spec[k]);
  for(const k of ['trees','beds','hedges','lawns']as const)expect(h.spec.siteWork[k]).toEqual(original.spec.siteWork[k]);
  expect(r.diff.removed).toEqual([]);expect(r.diff.unchanged).toBe(362);
  for(const e of original.scene.elements)if(original.components[e.id]!=='pool'&&!original.components[e.id].startsWith('landscape:terrace-'))expect(JSON.stringify(h.scene.elements.find(n=>n.id===e.id))).toBe(JSON.stringify(e));
 });
 it('uses semantic veranda IDs rather than a Breezeway name',async()=>{
  const h=loadHouse(saved);h.spec.exterior.verandas[0].id='shaded-court';h.spec.openSpaces[0].id='shaded-court';
  for(const f of h.spec.sitePresentation!.fixtures)if(f.support==='veranda-south-veranda-deck')f.support='veranda-shaded-court-deck';
  const {compileHouse}=await import('./compile');const built=compileHouse(h.spec,5),renamed=saveHouse(h.spec,built.scene);
  const r=await editAcceptedStagedSave({...input,save:renamed,expectedHash:stagedSaveHash(renamed),proposal:{...proposal,ops:[{...proposal.ops[0],veranda:'veranda:shaded-court'}]}});expect(r.accepted).toBe(true);
 });
 it('supports a subsequent edit from the reloaded edited source',async()=>{
  const a=await editAcceptedStagedSave(input);expect(a.accepted).toBe(true);
  const b=await editAcceptedStagedSave({...input,save:a.save,expectedHash:stagedSaveHash(a.save),proposal:{...proposal,ops:[{...proposal.ops[0],direction:'away',distance:.2}]}});expect(b.accepted).toBe(true);expect(poolWaterNorth(b.source.siteWork.pool!)).toBeCloseTo(13.5,8);loadHouse(b.save);
 });
 it.each([3,10])('rejects invalid %s metre movement atomically',async distance=>{
  const r=await editAcceptedStagedSave({...input,proposal:{...proposal,ops:[{...proposal.ops[0],distance}]}});expect(r.accepted).toBe(false);expect(r.save).toBe(saved);expect(r.scene).toEqual(original.scene);
 });
 it('rejects stale baseline, unsupported target and unsupported operations before modification',async()=>{
  await expect(editAcceptedStagedSave({...input,expectedHash:'0'.repeat(64)})).rejects.toThrow('Stale');
  for(const op of [{...proposal.ops[0],pool:'invented'},{op:'set-roof',blocks:['upper-bedroom-bar'],roof:{}}])expect((await editAcceptedStagedSave({...input,proposal:{...proposal,ops:[op]}})).accepted).toBe(false);
  expect(loadHouse(saved).spec).toEqual(original.spec);
 });
});
