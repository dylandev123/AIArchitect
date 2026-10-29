import { expect, it } from 'vitest';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS as entries } from './seeds';
import { retrieveArchitecturalKnowledge as retrieve } from './retrieval';
import { resolveSceneResult, SCENE_SYSTEM_PROMPT } from '@/lib/villa/scene/terra';
import { laderaScene } from '@/lib/villa/scene/example';
import { validateScene, applySceneOperations } from '@/lib/villa/scene/model';
import { reviewSceneArchitecture } from '@/lib/villa/scene/planning';
const intent={scaleRationale:'Offline fixture',arrivalAndCirculation:'Existing fixture route',volumeHierarchy:'Existing fixture volumes',relationshipsAndViews:'Assumed views',roofFacadeAndMaterials:'Existing fixture enclosure',intendedSpaces:['living']};
it('retains uncited selections and distinguishes dispositions using actual geometry after reload and edits',()=>{
 const evidence=['built','partial','missing','guidance','considered','unsupported','uncited'].map(id=>({id,version:1,requiredKinds:['plate','water'] as ('plate'|'water')[]}));
 const plate=laderaScene.elements.find(e=>e.kind==='plate')!;
 const water=laderaScene.elements.find(e=>e.kind==='water')!;
 const decisions=evidence.slice(0,-1).map(e=>({knowledgeId:e.id,decision:'Offline intent',elementIds:e.id==='built'?[plate.id,water.id]:e.id==='partial'?[plate.id]:[],limitation:'',disposition:(['guidance','considered','unsupported'].includes(e.id)?e.id:'constructed') as 'constructed'|'guidance'|'considered'|'unsupported'}));
 const result=resolveSceneResult({mode:'generate',prompt:'Offline'}, {name:'Offline',summary:'Offline',unsupported:[],architecturalPlan:{...intent,designDecisions:decisions},operations:laderaScene.elements.map(element=>({op:'add',element}))},evidence);
 expect(result.scene.knowledgeEvidence).toHaveLength(7);
 expect(result.architecturalAudit.knowledgeUse.map(e=>e.status)).toEqual(['construction-evidence','partial-construction','selected-missing','guidance','considered','unsupported','selected-missing']);
 expect(result.architecturalAudit.knowledgeUse.every(e=>!e.verifiedComplete)).toBe(true);
 const restored=validateScene(JSON.parse(JSON.stringify(result.scene)));
 const edited=resolveSceneResult({mode:'edit',prompt:'Repaint floor',current:restored},{name:'Edited',summary:'Edited',unsupported:[],operations:[{op:'finish',id:plate.id,material:'sage'}]},[]);
 expect(edited.scene.knowledgeEvidence).toEqual(evidence);
 const removed=applySceneOperations(edited.scene,[{op:'remove',id:water.id}]);
 expect(reviewSceneArchitecture(removed).knowledgeUse[0].status).toBe('partial-construction');
});
it('retrieves distinct compatible pool options within unchanged adaptive budgets',()=>{
 const briefs=[
  'A luxury waterfront estate with an infinity edge pool, stone deck and ocean-facing lounge',
  'A family villa with a pool sun shelf and submerged seating beside a shaded terrace',
  'A compact Mediterranean courtyard villa with a private pool without spa or gym',
 ];
 const results=briefs.map(b=>retrieve(entries,b));
 expect(results[0].selected.some(e=>e.id==='pool-infinity-limit')).toBe(true);
 expect(results[1].selected.some(e=>['pool-shallow-zone','pool-sun-shelf'].includes(e.id))).toBe(true);
 expect(new Set(results.map(r=>r.selected.map(e=>e.id).join(','))).size).toBe(3);
 for(const r of results){expect(r.chars).toBeLessThanOrEqual(r.budget.chars);expect(r.selected.length).toBeLessThanOrEqual(r.budget.entries);}
 expect(results[2].selected.some(e=>/spa|gym/.test(e.id))).toBe(false);
 expect(SCENE_SYSTEM_PROMPT).toContain('KNOWLEDGE APPLICATION');
});
