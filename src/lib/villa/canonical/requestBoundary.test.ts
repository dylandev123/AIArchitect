/** The exact provider-facing canonical Generate request, built by the real handler path with the
 * retained 334-record approved library and the SDK's own HTTP serialisation. The network is a stub:
 * no key, database or provider is used. */
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createOpenAI} from '@ai-sdk/openai';
const mocks=vi.hoisted(()=>({bodies:[] as string[]}));
const snapshot=JSON.parse(readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
vi.mock('@/lib/library/store',()=>({readLibrary:async()=>snapshot,mutateLibrary:async()=>{throw Error('read-only test')}}));
vi.mock('../design-learning-store',()=>({listDesignLessonSummaries:async()=>[]}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_meta:unknown,call:()=>unknown)=>call()}));
vi.mock('@/lib/ai/model',()=>({getAiModel:()=>createOpenAI({apiKey:'offline-test-key',fetch:async(_url,init)=>{mocks.bodies.push(String(init?.body));return new Response(JSON.stringify({error:{message:'offline stub'}}),{status:400,headers:{'content-type':'application/json'}});}})('gpt-5.6-terra')}));
import {generateCanonical} from './generate';
import {architecturalRequestContext} from '../scene/knowledgeContext';
import {generationSceneRequest} from '../scene/terra';
import {strictSchemaIssues} from '../scene/strictSchema';
import {withoutRetiredGuidance,canonicalGuidanceText} from '@/lib/library/architecture/canonicalKnowledge';
const brief=JSON.parse(readFileSync('docs/architecture/canonical-live-mansion-2026-11-02/brief.NOT-SUBMITTED.json','utf8')).prompt as string;
/** Vocabulary of the retired operations author that must not reach the canonical planner as instruction. */
const RETIRED=/scene operations?|supported scene|"operations":|"requiredKinds"|"construction":|place-on|component-registry|scene\/terra|direct-scene|defers interior fit-out|"capabilities":|scene construction contract|changed element ID/i;
const request=async()=>{mocks.bodies.length=0;await generateCanonical(generationSceneRequest(brief),{model:'gpt-5.6-terra'},new AbortController().signal);return JSON.parse(mocks.bodies[0]);};
beforeEach(()=>{mocks.bodies.length=0;});

describe('canonical Generate provider request',()=>{
 it('carries design knowledge but no retired scene-operations instruction',async()=>{
  const body=await request(),developer=body.input[0].content as string;
  expect(body.input.map((m:{role:string})=>m.role)).toEqual(['developer','user']);
  expect(developer).toContain('RETRIEVED ARCHITECTURAL KNOWLEDGE');
  expect(developer).toContain('architectural-plan-1 contract prevail');
  // Retained useful knowledge: design fields of selected records are present.
  expect(developer).toMatch(/"placement":"[^"]{20,}/);expect(developer).toMatch(/"principles":"[^"]{20,}/);
  expect(developer).toContain('DESIGN AUTHORITY');
  // Everything after the planner contract is retrieved/guidance material.
  const retrieved=developer.slice(developer.indexOf('RETRIEVED ARCHITECTURAL KNOWLEDGE'),developer.indexOf('CONTRACT PRECEDENCE'));
  expect(retrieved.length).toBeGreaterThan(5000);
  expect(retrieved.match(RETIRED)).toBeNull();
  // Only the planner contract ("Never return scene operations") and the precedence clause that tells the planner to disregard such wording may name them.
  expect(developer.match(/scene operations?/gi)).toHaveLength(2);
  expect(developer).toContain('Never return scene operations');
  expect(developer.indexOf('CONTRACT PRECEDENCE')).toBeGreaterThan(developer.indexOf('RETRIEVED ARCHITECTURAL KNOWLEDGE'));
 });
 it('selects exactly the same records as the unfiltered path, with the same evidence',async()=>{
  const legacy=await architecturalRequestContext(generationSceneRequest(brief)),canonical=await architecturalRequestContext(generationSceneRequest(brief),{canonical:true});
  expect(canonical.trace.selected).toEqual(legacy.trace.selected);expect(canonical.evidence).toEqual(legacy.evidence);
  expect(canonical.trace.metrics.canonicalFilter?.droppedFields).toEqual(['capabilities','sources','construction']);
  expect(canonical.trace.text.length).toBeLessThan(legacy.trace.text.length);
  expect(canonical.trace.chars).toBeLessThanOrEqual(canonical.trace.budget.chars);
 });
 it('proves the check is meaningful: the unfiltered path for the same brief does contain the retired wording',async()=>{
  const legacy=await architecturalRequestContext(generationSceneRequest(brief));
  expect(legacy.trace.text.match(RETIRED)).not.toBeNull();
 });
 it('leaves the default (operations-author) context unfiltered',async()=>{
  const legacy=await architecturalRequestContext(generationSceneRequest(brief));
  expect(legacy.trace.metrics.canonicalFilter).toBeUndefined();
 });
});

describe('filter semantics',()=>{
 it('removes only the offending sentence',()=>{
  expect(withoutRetiredGuidance('Keep a shaded entrance. Translate ideas into scene operations. Protect privacy.')).toEqual({text:'Keep a shaded entrance. Protect privacy.',removed:1});
  expect(canonicalGuidanceText('A. Exterior scope defers interior fit-out.\nB.')).toBe('A.\nB.');
 });
 it('leaves ordinary architectural vocabulary alone',()=>{
  const text='Operations of the service court stay discrete. Roofs overhang the terrace; place the pool near the living room.';
  expect(withoutRetiredGuidance(text).removed).toBe(0);
 });
});

describe('frozen controlled mansion request (SUBMITTED ONCE; authorization consumed)',()=>{
 const dir='docs/architecture/canonical-roof-retrieval-2026-11-02';
 const frozen=readFileSync(`${dir}/provider-request.prepared.NOT-SUBMITTED.json`);
 it('is retained byte for byte, is what was actually sent, and carries no retired scene-operations wording',()=>{
  const sha=createHash('sha256').update(frozen).digest('hex');
  expect(sha).toBe(JSON.parse(readFileSync(`${dir}/verification.json`,'utf8')).requestSha256);
  expect(sha).toBe(JSON.parse(readFileSync(`${dir}/call-started.json`,'utf8')).sha256);
  expect(frozen.equals(readFileSync(`${dir}/provider-request.exact.json`))).toBe(true);
  const developer=JSON.parse(frozen.toString()).input[0].content as string;
  expect(developer.slice(developer.indexOf('RETRIEVED ARCHITECTURAL KNOWLEDGE'),developer.indexOf('CONTRACT PRECEDENCE')).match(RETIRED)).toBeNull();
  expect(strictSchemaIssues(JSON.parse(frozen.toString()).text.format.schema)).toEqual([]);
 });
 // The live instructions have since moved on (site anchors); a new call needs a new preparation, so no
 // equality with the current handler output is asserted for this consumed file.
});
