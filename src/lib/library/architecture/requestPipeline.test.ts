import {expect,it} from 'vitest';
import {monetaryBriefContext,propertyValueContext} from './propertyValue';
import {projectKnowledgeContext,retrieveArchitecturalKnowledge} from './retrieval';
import {ARCHITECTURAL_KNOWLEDGE_SEEDS as entries} from './seeds';

it('keeps qualified construction and land costs out of property-value retrieval',()=>{
 for(const label of ['construction budget of about','construction cost is approximately','building budget: around','land value of about']) {
  const brief=`A family house with ${label} $25 million.`;
  expect(monetaryBriefContext(brief)[0].kind).toBe(label.startsWith('land')?'land-value':'construction-budget');
  expect(propertyValueContext(brief)).toBeUndefined();
  expect(retrieveArchitecturalKnowledge(entries,brief).selected.some(e=>e.category==='property-value')).toBe(false);
 }
 expect(monetaryBriefContext('A property worth $25 million with a construction budget of about $2 million.').map(s=>s.kind)).toEqual(['property-value','construction-budget']);
 expect(propertyValueContext('An island worth $25 million.')?.amount).toBe(25000000);
});

it('recognizes residential compounds without requiring a house keyword or mandatory amenities',()=>{
 const result=retrieveArchitecturalKnowledge(entries,'Design a $100 million private tropical compound.');
 for(const category of ['composition','programme','arrival'])expect(result.metrics.categories).toContain(category);
 expect(result.selected.map(e=>e.id)).toContain('property-value-50m-100m-plus');
 expect(result.selected.some(e=>/pool|gym|cinema|garage/.test(e.id))).toBe(false);
});

it('retains explicit plural room requirements and filters excluded amenities in retrieval metadata',()=>{
 const brief='A house with 4 bedrooms and 3 bathrooms, without pool or gym.';
 const project=projectKnowledgeContext(brief);
 expect(project.brief).toBe(brief);
 expect(project.requirements).toEqual(['4 bedrooms','3 bathrooms']);
 expect(projectKnowledgeContext('Six bedroom suites and two bathrooms with an outdoor kitchen.').requirements).toEqual(['Six bedroom suites','two bathrooms','outdoor kitchen']);
});

import {readFileSync} from 'node:fs';
import {vi} from 'vitest';
import {latestKnowledge} from './service';
import {legacyRecipeKnowledge} from './legacyRecipes';
import {requestPipelineFixtures} from './requestPipeline.fixture';
import {generationSceneRequest,sceneMessages} from '@/lib/villa/scene/terra';

it('checks scales, exclusions, distinct value records and exact provider messages against all 334 retained approved records',()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Offline only'));
 try {
  const snapshot=JSON.parse(readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
  const catalogue=[...latestKnowledge(snapshot.architecturalKnowledge),...legacyRecipeKnowledge(snapshot.recipes)];
  for(const fixture of requestPipelineFixtures) {
   const result=retrieveArchitecturalKnowledge(catalogue,fixture.brief);
   expect(result.metrics.approvedActive).toBe(334);
   expect(result.selected.filter(e=>e.category==='property-value').map(e=>e.id)).toEqual(fixture.profile?[fixture.profile]:[]);
   expect(result.chars).toBeLessThanOrEqual(result.budget.chars);
   expect(result.selected.some(e=>/gym|cinema/.test(e.id))).toBe(false);
   const content=sceneMessages(generationSceneRequest(fixture.brief))[0].content[0];
   expect(content.type).toBe('text');
   if(content.type==='text')expect(JSON.parse(content.text).prompt).toBe(fixture.brief);
   expect(result.project.brief).toBe(fixture.brief);
   if(fixture.id==='compact-luxury')expect(result.project.scale).toBe('compact');
   if(fixture.id==='compound')expect(result.metrics.categories).toEqual(expect.arrayContaining(['composition','programme','arrival']));
  }
  expect(network).not.toHaveBeenCalled();
 }finally{network.mockRestore();}
});

it('excludes negative room requests without treating a preceding word as a count',()=>{
 expect(projectKnowledgeContext('A home without bedrooms or bathrooms.').requirements).toEqual([]);
 expect(projectKnowledgeContext('A home with bedrooms and bathrooms.').requirements).toEqual(['bedrooms','bathrooms']);
});
