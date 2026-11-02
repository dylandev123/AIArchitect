import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {projectKnowledgeContext,retrieveArchitecturalKnowledge} from './retrieval';
import {ARCHITECTURAL_KNOWLEDGE_SEEDS as seeds} from './seeds';

it.each([
 ['Design a waterfront estate, not a small house.','estate'],
 ['Design a luxury estate rather than a compact representation.','estate'],
 ['Not a tiny villa; construct a six-suite waterfront estate.','estate'],
 ['Do not design a small house; create a substantial luxury residence.','estate'],
 ['Avoid a compact cottage. Build a grand mansion.','mansion'],
 ['No mansion: design a compact family home.','compact'],
 ['A small cottage, not a luxury estate.','compact'],
 ['A luxury cottage rather than a sprawling mansion.','compact'],
 ['Design a compact modern family home without a pool.','compact'],
 ['A small contemporary waterfront villa.','compact'],
 ['A tiny cabin instead of an estate.','compact'],
 ['A family home with a small pool and compact study.','family'],
 ['A family home rather than a tiny representation.','family'],
 ['Not a small house but a contemporary mansion.','mansion'],
 ['Not a mansion but a small house.','compact'],
 ['Build a mansion instead of a tiny home.','mansion'],
 ['A family house with a compact representation for review.','family'],
 ['A waterfront estate with a small guest house.','estate'],
 ['A small house worth US$25 million.','compact'],
 ['A compact family house, not a US$25 million mansion.','compact'],
 ['A US$100k home, not an estate.','compact'],
 ['Design a compact $25 million tropical home with two bedrooms.','compact'],
 ['Without a pool design a compact family house.','compact'],
 ['A mansion is not only large but carefully proportioned.','mansion'],
 ['A home that is not only small but carefully proportioned.','family'],
])('classifies positive property intent: %s',(brief,scale)=>{
 expect(projectKnowledgeContext(brief).scale).toBe(scale);
});

it('retains the exact mansion brief and retrieves estate-scale guidance despite its negative small-representation clause',()=>{
 const brief=readFileSync('docs/architecture/complete-mansion-2026-10-30/brief.txt','utf8').trimEnd();
 const result=retrieveArchitecturalKnowledge(seeds,brief);
 expect(result.project.brief).toBe(brief);
 expect(result.project.scale).toBe('estate');
 expect(result.project.propertyValue?.amount).toBe(25000000);
 expect(result.project.requirements).toContain('bedroom suites');
 expect(result.budget).toEqual({entries:12,chars:18000,tier:'complex'});
 const ids=result.selected.map(e=>e.id);
 expect(ids).toContain('waterfront-estate');
 expect(result.metrics.categories).toEqual(expect.arrayContaining(['composition','programme','arrival','envelope','roof-outdoor','climate-site']));
 expect(ids).toContain('property-value-25m-50m');
 expect(ids).not.toContain('compact-family');
 expect(result.metrics.excluded).not.toContainEqual({id:'estate-composition',reason:'incompatible scale'});
 expect(result.text).toContain('RETRIEVED ARCHITECTURAL KNOWLEDGE');
});

it('preserves compact knowledge, limits and amenity exclusions when a mansion is rejected',()=>{
 const result=retrieveArchitecturalKnowledge(seeds,'A compact three-bedroom family house, not a mansion, without pool or gym.');
 expect(result.project.scale).toBe('compact');
 expect(result.budget.tier).toBe('compact');
 expect(result.selected.map(e=>e.id)).toContain('compact-family');
 expect(result.selected.map(e=>e.id)).not.toContain('estate-composition');
 expect(result.selected.map(e=>e.id)).not.toContain('infinity-pool');
 expect(result.selected.map(e=>e.id)).not.toContain('fitness-daylight');
});
