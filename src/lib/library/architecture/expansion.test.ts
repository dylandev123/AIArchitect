import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS as entries } from './seeds';
import { EXPANDED_ARCHITECTURAL_GUIDANCE as expanded } from './expanded';
import { knowledgeInputSchema, knowledgeCategories } from './model';
import { knowledgeCategory, constructionFor } from './constructibility';
import { retrieveArchitecturalKnowledge as retrieve } from './retrieval';
import { importArchitecturalKnowledge, inspectArchitecturalKnowledge } from './service';
import { resolveSceneResult } from '@/lib/villa/scene/terra';
import { reviewSceneArchitecture } from '@/lib/villa/scene/planning';
import { applySceneOperations, validateScene } from '@/lib/villa/scene/model';
import { laderaScene } from '@/lib/villa/scene/example';
const intent={scaleRationale:'Offline contract fixture, not generated output.',arrivalAndCirculation:'Retain the fixture entrance route.',volumeHierarchy:'Retain the fixture hierarchy.',relationshipsAndViews:'Orientation unverified.',roofFacadeAndMaterials:'Retain existing roof and enclosure.',intendedSpaces:['residence']};
afterEach(()=>vi.unstubAllEnvs());
it('provides 310 unique valid entries, eleven categories and constructibility for every recipe',()=>{
 expect(entries).toHaveLength(310);expect(expanded).toHaveLength(240);
 expect(new Set(entries.map(e=>e.id)).size).toBe(entries.length);
 expect(new Set(entries.map(e=>e.title.toLowerCase().replace(/[^a-z0-9]/g,''))).size).toBe(entries.length);
 expect(new Set(expanded.map(e=>e.placement))).toHaveLength(expanded.length);
 expect(new Set(entries.map(e=>knowledgeCategory(e))).size).toBe(knowledgeCategories.length);
 for(const {version,updatedAt,...entry} of entries){void version;void updatedAt;expect(knowledgeInputSchema.safeParse(entry).success).toBe(true);expect(constructionFor({...entry,version:1,updatedAt:''})?.unsupported).toBeTruthy();}
});
it('covers complementary categories and explicitly requested amenities within the complex budget',()=>{
 const r=retrieve(entries,'A luxury estate with a grand entrance, private bedroom wing, rooftop terrace, pool, gym and garage');
 expect(r.budget).toEqual({entries:12,chars:18000,tier:'complex'});
 expect(r.selected.some(e=>e.id==='window-rhythm')).toBe(false); // No default facade-pattern recipe without a relevant request.
 for(const category of ['composition','programme','arrival','roof-outdoor'])expect(r.metrics.categories).toContain(category);
 expect(r.selected.some(e=>/gym|fitness/.test(e.id))).toBe(true);
 expect(r.selected.some(e=>/pool/.test(e.id))).toBe(true);
 expect(r.selected.some(e=>/garage/.test(e.id))).toBe(true);
 expect(r.chars).toBeLessThanOrEqual(r.budget.chars);
 expect(r.selected.every(e=>e.reasons.length>0)).toBe(true);
});
it('keeps compact briefs and one-window edits focused with no unwanted programme',()=>{
 const small=retrieve(entries,'A compact three-bedroom family home without pool or gym');
 expect(small.budget.entries).toBe(5);expect(small.chars).toBeLessThanOrEqual(6500);
 expect(small.selected.some(e=>/pool|gym|fitness/.test(e.id))).toBe(false);
 const edit=retrieve(entries,'Add one bedroom window','edit');
 expect(edit.selected.every(e=>e.category==='envelope')).toBe(true);
 expect(edit.selected.some(e=>/bath|stair|guest|rental/.test(e.id))).toBe(false);
 expect(retrieve(entries,'Construct an editable scene').selected).toHaveLength(0);
});
it('uses actual primitive kinds rather than names as construction evidence and keeps this evidence through edits/reload',()=>{
 const retrieval=retrieve(entries,'A luxury estate with a grand entrance');
 const requirement=retrieval.evidence.find(e=>e.id==='covered-threshold')!;
 expect(requirement).toBeTruthy();
 const floor=laderaScene.elements.find(e=>e.kind==='plate')!;
 const plan={...intent,designDecisions:[{knowledgeId:requirement.id,decision:'Grand entrance completed',elementIds:[floor.id],limitation:''}]};
 const result=resolveSceneResult({mode:'generate',prompt:'Grand entrance'},{name:'Fixture',summary:'Offline fixture',unsupported:[],architecturalPlan:plan,operations:laderaScene.elements.map(element=>({op:'add',element}))},[requirement]);
 const decision=result.architecturalAudit.designDecisions[0];
 expect(decision.missingKinds).toEqual(expect.arrayContaining(['wall','entrance','roof']));
 expect(decision.status).toBe('missing-evidence');expect(decision.verifiedComplete).toBe(false);
 const restored=validateScene(JSON.parse(JSON.stringify(result.scene)));
 const edited=applySceneOperations(restored,[{op:'finish',id:floor.id,material:'sage'}]);
 expect(edited.knowledgeEvidence).toEqual(result.scene.knowledgeEvidence);
 expect(reviewSceneArchitecture(edited).designDecisions[0].status).toBe('missing-evidence');
 // A complete set of kinds is a necessary condition only, never certified completeness.
 const ids=['plate','wall','entrance','roof'].map(kind=>edited.elements.find(e=>e.kind===kind)!.id);
 const actual={...edited,architecturalPlan:{...plan,designDecisions:[{...plan.designDecisions[0],elementIds:ids}]}};
 expect(reviewSceneArchitecture(actual).designDecisions[0].missingKinds).toEqual([]);
 expect(reviewSceneArchitecture(actual).designDecisions[0].verifiedComplete).toBe(false);
});
it('round-trips every expanded entry through the existing atomic 100-entry bulk importer',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'terra-expansion-'));
 try{
 vi.stubEnv('AI_LIBRARY_PATH',path.join(dir,'library.json'));vi.stubEnv('DATABASE_URL','');vi.stubEnv('POSTGRES_URL','');vi.stubEnv('VERCEL','');
 for(let i=0;i<expanded.length;i+=100){
  const batch=expanded.slice(i,i+100).map(({version,updatedAt,...entry})=>{void version;void updatedAt;return {entry,expectedVersion:1};});
  await importArchitecturalKnowledge(batch);
 }
 const stored=await inspectArchitecturalKnowledge();
 expect(stored).toHaveLength(310);
 expect(stored.filter(e=>e.revisions.length===2)).toHaveLength(240);
 expect(stored.find(e=>e.id===expanded[0].id)?.revisions.at(-1)?.construction).toEqual(expanded[0].construction);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it('distinguishes a water plane with a bottom from a basin with actual perimeter geometry',()=>{
 const baseline=reviewSceneArchitecture(laderaScene);
 expect(baseline.issues.join(' ')).toContain('water perimeter lacks local basin wall evidence');
 const water=laderaScene.elements.find(e=>e.kind==='water')!;
 const [x,,z]=water.at;
 const walls=([-1,1] as const).flatMap(sign=>[
  {id:`basin-long-${sign}`,kind:'wall' as const,label:'Basin edge',at:[x,.67,z+sign*2.5] as [number,number,number],size:[11.7,.4,.2] as [number,number,number],rotation:0,material:'limestone' as const},
  {id:`basin-end-${sign}`,kind:'wall' as const,label:'Basin edge',at:[x+sign*5.75,.67,z] as [number,number,number],size:[5.2,.4,.2] as [number,number,number],rotation:Math.PI/2,material:'limestone' as const},
 ]);
 const built=validateScene({...laderaScene,elements:[...laderaScene.elements,...walls]});
 expect(reviewSceneArchitecture(built).issues.join(' ')).not.toContain('water perimeter lacks local basin wall evidence');
 expect(built.elements.filter(e=>e.id.startsWith('basin-'))).toHaveLength(4);
});
