import { expect, it, vi } from 'vitest';
import { estateConceptStudy, estateStudyBrief } from './estateConcepts.fixture';
import { applySceneOperations, validateScene } from './model';
import { sceneRelationshipIssues } from './relationships';
import { sceneSystemPrompt, sceneProviderOutputSchema } from './terra';
import { ARCHITECTURAL_CONCEPT_GUIDANCE } from './designGuide';
it('represents two original estate organizations above 1500 m² through the same executor without uniform scaling',()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Network forbidden'));
 try {
  const studies=['court','promenade'].map(c=>estateConceptStudy(c as 'court'|'promenade'));
  for(const scene of studies){
   expect(sceneRelationshipIssues(scene)).toEqual([]);
   const wings=scene.elements.filter(e=>e.assemblyKind==='residential-wing');
   expect(wings).toHaveLength(4);expect(wings.reduce((n,e)=>n+e.size[0]*e.size[2],0)).toBeGreaterThan(1500);
   expect(scene.elements.length).toBeLessThan(400);
   expect(validateScene(JSON.parse(JSON.stringify(scene)))).toEqual(scene);
   const edited=applySceneOperations(scene,[{op:'finish',id:'primary-reveal-0',material:'bronze'}]);
   expect(edited.elements.map(e=>e.id)).toEqual(scene.elements.map(e=>e.id));
   expect(edited.architecturalPlan).toEqual(scene.architecturalPlan);
  }
  expect(studies[0].elements.find(e=>e.id==='guest')!.rotation).not.toBe(studies[1].elements.find(e=>e.id==='guest')!.rotation);
  expect(studies[0].architecturalPlan).not.toEqual(studies[1].architecturalPlan);
  expect(network).not.toHaveBeenCalled();
 } finally {network.mockRestore();}
});
it('keeps the existing plan and construction contracts authoritative',()=>{
 const input={mode:'generate' as const,prompt:estateStudyBrief};
 expect(sceneSystemPrompt(input)).toContain('400 elements');
 expect(ARCHITECTURAL_CONCEPT_GUIDANCE).toContain('not a preset menu');
 expect(sceneProviderOutputSchema(input).safeParse({name:'Concept only',summary:'No geometry',unsupported:[],architecturalPlan:{},operations:[]}).success).toBe(false);
});
