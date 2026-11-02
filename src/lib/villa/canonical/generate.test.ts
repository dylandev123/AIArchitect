import { beforeEach,expect,it,vi } from 'vitest';
const mocks=vi.hoisted(()=>({generate:vi.fn(),knowledge:vi.fn()}));
vi.mock('ai',async importOriginal=>({...await importOriginal<typeof import('ai')>(),generateText:mocks.generate}));
vi.mock('@/lib/ai/model',()=>({getAiModel:vi.fn(()=>({}))}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:(_meta:unknown,call:()=>unknown)=>call()}));
vi.mock('../scene/knowledgeContext',()=>({architecturalRequestContext:mocks.knowledge}));
import { generateCanonical } from './generate';
import { canonicalFixture } from './fixture';
import { architecturalPlanSchema } from './plan';
beforeEach(()=>{vi.clearAllMocks();mocks.knowledge.mockResolvedValue({trace:{text:'approved knowledge'},evidence:[]});});
it('requests only a high-level plan once and rejects operation responses without fallback',async()=>{
 mocks.generate.mockResolvedValue({finishReason:'stop',output:{operations:[]}});
 const response=await generateCanonical({mode:'generate',prompt:'A house'},{model:'test'},new AbortController().signal);
 expect(response.status).toBe(422);expect(mocks.generate).toHaveBeenCalledTimes(1);
 expect(mocks.generate.mock.calls[0][0].system).toContain('sole new-house');
});
it('compiles a provider plan to a pending review candidate with durable plan metadata',async()=>{
 const plan=architecturalPlanSchema.parse(canonicalFixture());
 mocks.generate.mockResolvedValue({finishReason:'stop',output:{status:'proposed',plan,limitations:['Envelope scope']}});
 const response=await generateCanonical({mode:'generate',prompt:'A house'},{model:'test'},new AbortController().signal);
 const body=await response.json();expect(response.status,body.error).toBe(200);expect(body.providerCalls).toBe(1);expect(body.scene.generationStatus).toBe('pending-visual-review');expect(body.scene.architecturalPlan).toEqual(plan);expect(body.operations.length).toBe(body.scene.elements.length);
});
it('returns unsupported decisions without constructing a substitute house',async()=>{
 mocks.generate.mockResolvedValue({finishReason:'stop',output:{status:'decision-required',decisions:['Grading unsupported']}});
 const response=await generateCanonical({mode:'generate',prompt:'Hillside house'},{model:'test'},new AbortController().signal);
 expect(response.status).toBe(422);expect((await response.json()).scene).toBeUndefined();expect(mocks.generate).toHaveBeenCalledTimes(1);
});

it('normal canonical boundary accepts the extended composition without an operations author',async()=>{
 const {compositionFixture}=await import('./compositions.fixture');
 const plan=compositionFixture('waterfront');
 mocks.generate.mockResolvedValue({finishReason:'stop',output:{status:'proposed',plan,limitations:['Developer mocked response; no AI quality evidence']}});
 const response=await generateCanonical({mode:'generate',prompt:'Multilevel waterfront exterior'},{model:'test'},new AbortController().signal);
 const body=await response.json();expect(response.status,body.error).toBe(200);
 expect(body.scene.architecturalPlan).toEqual(plan);expect(body.scene.elements.some((e:{kind:string})=>e.kind==='screen')).toBe(true);
 expect(body.repairBudget).toBe(0);expect(mocks.generate).toHaveBeenCalledTimes(1);
});
