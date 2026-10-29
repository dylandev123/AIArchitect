import {describe,it,expect} from 'vitest';
import {PROPERTY_VALUE_GUIDANCE,propertyValueContext,VALUE_BANDS} from './propertyValue';
import {ARCHITECTURAL_KNOWLEDGE_SEEDS} from './seeds';
import {knowledgeInputSchema} from './model';
import {retrieveArchitecturalKnowledge} from './retrieval';
describe('composable property value guidance',()=>{
 it('preserves all 301 existing entries and includes reviewed qualitative value guidance',()=>{
  expect(ARCHITECTURAL_KNOWLEDGE_SEEDS).toHaveLength(310);
  PROPERTY_VALUE_GUIDANCE.forEach(e=>{const {version,updatedAt,...input}=e; void version; void updatedAt; expect(knowledgeInputSchema.safeParse(input).success).toBe(true);expect(e.status).toBe('approved');});
 });
 it('selects one reference at each boundary in production retrieval',()=>{
  const approved=ARCHITECTURAL_KNOWLEDGE_SEEDS.map(e=>e.category==='property-value'?{...e,status:'approved' as const}:e);
  for(const [id,amount]of VALUE_BANDS){
   const brief=`USD ${amount} contemporary tropical waterfront residence with pool entrance roof and private bedroom wing`;
   const result=retrieveArchitecturalKnowledge(approved,brief);
   expect(result.selected.filter(e=>e.category==='property-value').map(e=>e.id)).toEqual([`property-value-${id}`]);
   expect(result.selected.some(e=>e.category==='composition'||e.category==='programme')).toBe(true);
   expect(result.chars).toBeLessThanOrEqual(result.budget.chars);
  }
  expect(retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,'$25m tropical estate').selected.some(e=>e.category==='property-value')).toBe(true);
 });
 it('does not invent values; distinguishes compact and regional contexts',()=>{
  expect(propertyValueContext('luxurious tropical mansion')).toBeUndefined();
  expect(propertyValueContext('$100 million residence')?.profileId).toBe('property-value-50m-100m-plus');
  const a=ARCHITECTURAL_KNOWLEDGE_SEEDS.map(e=>e.category==='property-value'?{...e,status:'approved' as const}:e);
  const small=retrieveArchitecturalKnowledge(a,'$100k family home');
  expect(small.project.scale).toBe('compact');expect(small.selected.some(e=>e.id==='estate-composition')).toBe(false);
  const tropical=retrieveArchitecturalKnowledge(a,'$25m tropical waterfront estate with pool');
  const urban=retrieveArchitecturalKnowledge(a,'$25m Mediterranean urban mansion with courtyard');
  expect(tropical.selected.map(e=>e.id)).not.toEqual(urban.selected.map(e=>e.id));
 });
});

it('keeps regional identity available for modest villas and exposes budget omissions',()=>{
 const villa=retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,'$1m Mediterranean courtyard villa');
 expect(villa.selected.map(e=>e.id)).toContain('mediterranean-courtyard');
 expect(villa.selected.map(e=>e.id)).toContain('property-value-1m-3m');
 const tropical=retrieveArchitecturalKnowledge(ARCHITECTURAL_KNOWLEDGE_SEEDS,'$5m contemporary tropical residence');
 expect(tropical.selected.map(e=>e.id)).toContain('tropical-envelope');
 expect(tropical.selected.map(e=>e.id)).not.toContain('compact-family');
 expect(tropical.metrics.excludedByBudget.length).toBe(tropical.metrics.omitted);
 // Approval filtering remains active for user proposals and retired recipes.
 const proposed=ARCHITECTURAL_KNOWLEDGE_SEEDS.map(e=>({...e,status:'proposed' as const}));
 expect(retrieveArchitecturalKnowledge(proposed,'$25m Caribbean waterfront mansion').selected).toEqual([]);
});
