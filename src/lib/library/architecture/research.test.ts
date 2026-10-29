import { afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { researchIntakeFixture } from './research.fixture';
import { prepareArchitecturalResearch, researchKnowledgeProposals } from './research';
import { monetaryBriefContext, propertyValueContext, propertyAmbitionGuidance } from './propertyValue';
import { retrieveArchitecturalKnowledge } from './retrieval';
import { ARCHITECTURAL_KNOWLEDGE_SEEDS } from './seeds';
import { generationKnowledge, importArchitecturalKnowledge, inspectArchitecturalKnowledge } from './service';
import { knowledgeInputSchema } from './model';
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
it('separates multiple money roles, currency uncertainty and explicit compact constraints',()=>{
 const brief='Property value: $25m, construction budget $4m, land value $12m';
 expect(monetaryBriefContext(brief).map(s=>[s.kind,s.amount])).toEqual([['property-value',25e6],['construction-budget',4e6],['land-value',12e6]]);
 expect(propertyValueContext(brief)?.amount).toBe(25e6);
 for(const prompt of ['construction budget $25m','a $25m construction budget','land value $25m','a $25m land value','budget $25m','EC$25m house','CAD $25m house'])expect(propertyValueContext(prompt),prompt).toBeUndefined();
 expect(propertyValueContext('$25m waterfront house on land in Saint Lucia')?.amount).toBe(25e6);
 expect(propertyValueContext('$100m+ estate')?.profileId).toBe('property-value-50m-100m-plus');
 expect(propertyValueContext('$25m estate')?.currencyAssumption).toContain('assumed USD');
 expect(propertyAmbitionGuidance(brief)).toContain('Never equate a $25m property');
 expect(retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,'$25m house').project.scale).toBe('estate');
 expect(retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,'$25m compact home').project.scale).toBe('compact');
});
it('uses bounded explicit research policies after approved retrieval without making network calls',()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Offline'));
 const known=retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,'A family house');
 expect(prepareArchitecturalResearch('A family house',known,'off','unfamiliar regional material').recommended).toBe(false);
 expect(prepareArchitecturalResearch('A family house',known,'on-request','unfamiliar regional material').recommended).toBe(false);
 const plan=prepareArchitecturalResearch('Research Caribbean waterfront precedents',known,'on-request');
 expect(plan.recommended).toBe(true);expect(plan.queries.length).toBeLessThanOrEqual(2);expect(plan.bounds.maxProviderCalls).toBe(0);
 expect(prepareArchitecturalResearch('A family house',known,'when-needed','unfamiliar material').recommended).toBe(true);
 expect(network).not.toHaveBeenCalled();
});
it('keeps findings proposed through the real shared store; only reviewed revisions enter Generate with citations',async()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Offline'));
 const dir=await mkdtemp(path.join(tmpdir(),'terra-research-'));
 vi.stubEnv('AI_LIBRARY_PATH',path.join(dir,'library.json'));vi.stubEnv('DATABASE_URL','');vi.stubEnv('POSTGRES_URL','');vi.stubEnv('VERCEL','');
 try {
  const proposals=researchKnowledgeProposals([researchIntakeFixture]);
  expect(proposals[0].entry.capabilities).toBe(researchIntakeFixture.limitations);
  expect(proposals[0].entry.status).toBe('proposed');expect(proposals[0].entry.sources[0].verified).toBe(false);
  for(const override of [{status:'approved'},{review:'approved'},{operations:[]},{sources:[{...researchIntakeFixture.sources[0],verified:true}]}])expect(()=>researchKnowledgeProposals([{...researchIntakeFixture,...override}])).toThrow();
  expect(()=>researchKnowledgeProposals([{...researchIntakeFixture,sources:[{...researchIntakeFixture.sources[0],basis:'search-snippet'}]}])).toThrow();
  await importArchitecturalKnowledge(proposals);
  const prompt=researchIntakeFixture.title+' for a tropical waterfront estate';
  expect((await generationKnowledge(prompt,'generate')).selected.map(e=>e.id)).not.toContain(researchIntakeFixture.id);
  const stored=(await inspectArchitecturalKnowledge(researchIntakeFixture.title)).find(e=>e.id===researchIntakeFixture.id)!.revisions.at(-1)!;
  const {version,updatedAt,...entry}=stored;void updatedAt;
  expect(()=>knowledgeInputSchema.parse({...entry,status:'approved',review:'reviewed'})).toThrow();
  // Simulate a deliberate reviewer revision. This is test-only approval of synthetic content.
  await importArchitecturalKnowledge([{expectedVersion:version,entry:{...entry,status:'approved',sources:entry.sources.map(s=>({...s,verified:true})),review:'Test-only reviewer revision; not an approval of real source content.'}}]);
  const next=await generationKnowledge(prompt,'generate');
  expect(next.selected.map(e=>e.id)).toContain(researchIntakeFixture.id);
  expect(next.text).toContain(researchIntakeFixture.sources[0].url);expect(next.text).toContain(researchIntakeFixture.sources[0].researchedAt);
  expect(next.chars).toBeLessThanOrEqual(next.budget.chars);expect(network).not.toHaveBeenCalled();
 } finally {await rm(dir,{recursive:true,force:true});}
});
