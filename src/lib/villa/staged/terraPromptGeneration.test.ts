import {afterEach,describe,it,expect,vi} from 'vitest';
const {generateText}=vi.hoisted(()=>({generateText:vi.fn()}));
vi.mock('ai',async importOriginal=>({...await importOriginal<typeof import('ai')>(),generateText}));
vi.mock('@/lib/ai/model',()=>({getAiModelId:()=> 'gpt-5.6-terra',getAiModel:()=> 'mock-provider-no-network'}));
import {advanceTerraPromptRun} from './terraPromptGeneration';
import {LiveDesigner} from './liveDesigner';
import {emptyDraft,type StageContext,type StageNo} from './pipeline';
import {promptInput,promptRequirements,type PromptRun} from './promptGeneration';
import {PromptMockDesigner,MOCK_BRIEFS} from './promptMocks';
import {computeCostUsd} from '@/lib/ai/pricing';
afterEach(()=>{generateText.mockReset();vi.unstubAllEnvs();});
describe('existing Terra Stage 1–5 adapter with mocked SDK, no API calls',()=>{
 for(const brief of MOCK_BRIEFS)it(`forwards every stage of ${brief}`,async()=>{
  const run:PromptRun={input:promptInput.parse({brief})},mock=new PromptMockDesigner(brief);
  let stage=0;
  generateText.mockImplementation(async options=>{
   stage++;const accepted=run.result?.checkpoints.filter(c=>c.accepted)??[];
   const req=promptRequirements(brief);
   const ctx:StageContext={brief,site:run.input.site,draft:run.result?.spec??emptyDraft(run.input.site),requiredBedrooms:req.bedrooms??0,requiredBaths:0,checkpoints:accepted};
   expect(options.prompt).toContain(`BRIEF: ${brief}`);
   if(stage>1)expect(options.prompt).toContain('STAGE 1 ACCEPTED:');
   expect(options.maxRetries).toBe(0);expect(options.maxOutputTokens).toBe(12000);
   const r=await mock.design(stage as StageNo,ctx);
   return {output:r.value,text:JSON.stringify(r.value),finishReason:'stop',usage:{inputTokens:1000,outputTokens:200,inputTokenDetails:{cacheReadTokens:500}}};
  });
  let out;
  for(let i=0;i<5;i++)out=await advanceTerraPromptRun(run);
  expect(out!.status).toBe('complete');expect(out!.findings).toEqual([]);
  const {exteriorRequest}=await import('./exteriorDesigner');
  const {siteDesignRequest}=await import('./siteDesigner');
  expect(exteriorRequest(brief,run.result!.spec!).prompt).toContain(brief);
  expect(siteDesignRequest(run.result!.spec!,{},brief).prompt).toContain(brief);
  expect(generateText).toHaveBeenCalledTimes(5);
  expect(out!.costUsd).toBeCloseTo(5*computeCostUsd('gpt-5.6-terra',{inputTokens:1000,outputTokens:200,cachedInputTokens:500})!);
 });
 it('retains billed usage when lazy structured-output access fails',async()=>{
  generateText.mockResolvedValue({get output(){throw Error('unusable output');},text:'unusable',usage:{inputTokens:1000,outputTokens:200},finishReason:'length'});
  const run:PromptRun={input:promptInput.parse({brief:MOCK_BRIEFS[0]})};
  const r=await advanceTerraPromptRun(run);
  expect(r.status).toBe('failed');expect(r.calls).toBe(1);expect(r.costUsd).toBeGreaterThan(0);
  expect(run.result!.calls[0].failure?.raw).toBe('unusable');
  expect(generateText).toHaveBeenCalledTimes(1);
 });
 it('offers only the room-programme schema to Stage 3',()=>{
  const provider=new LiveDesigner();
  expect(Object.keys(provider.schema(3).shape)).toEqual(['rooms','connections','stairs','intentions']);
 });
});
