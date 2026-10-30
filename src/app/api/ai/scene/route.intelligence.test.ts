import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
const captured=vi.hoisted(()=>({generate:vi.fn(),retained:[] as string[]}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:captured.generate}));
vi.mock('@/lib/ai/model',()=>({isAiConfigured:()=>true,getAiModel:()=> 'offline',getAiModelId:()=> 'offline',AI_PROVIDER_OPTIONS:{},AI_NOT_CONFIGURED_MESSAGE:'offline'}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:async (_:unknown,run:()=>Promise<unknown>)=>run()}));
vi.mock('node:fs/promises',async original=>({...await original<typeof import('node:fs/promises')>(),mkdir:vi.fn(),writeFile:async (_:unknown,text:string)=>{captured.retained.push(text);}}));
vi.mock('@/lib/library/store',async original=>{
 const actual=await original<typeof import('@/lib/library/store')>();
 const fs=await import('node:fs');
 const snapshot=JSON.parse(fs.readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
 return {...actual,readLibrary:async()=>({...actual.emptySnapshot(),...snapshot})};
});
import { POST } from './route';
import { generationSceneRequest, resolveSceneResult } from '@/lib/villa/scene/terra';
import { laderaScene } from '@/lib/villa/scene/example';
import { constructionCapabilityReference } from '@/lib/villa/scene/capabilityReference';
beforeEach(()=>{captured.generate.mockReset();captured.retained=[];});
it('sends concept, scale, approved knowledge and capabilities through the real homepage handler in one mocked call',async()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Network forbidden'));
 try {
  const retained=JSON.parse(readFileSync('docs/architecture/unified-knowledge/retained-response.json','utf8'));
  captured.generate.mockResolvedValue({output:retained.output,text:JSON.stringify(retained.output),finishReason:'stop'});
  const input=generationSceneRequest('Property value $25m, construction budget $5m. Tropical waterfront estate.');
  const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(input)}));
  expect(response.status).toBe(200);
  const system=captured.generate.mock.calls[0][0].system;
  expect(system).toContain('Neither assemblies, stored recipes nor previous projects prescribe these choices');
  expect(system).toContain('Record the selected design and its constructed relationships');
  expect(system).toContain('Never equate a $25m property with $25m of building work');
  expect(system).toContain(constructionCapabilityReference());
  expect(system).toContain('RETRIEVED ARCHITECTURAL KNOWLEDGE');
  expect(system).toContain('No external search was performed');
  const artifact=JSON.parse(captured.retained[0]);
  expect(artifact.knowledge.metrics.approvedActive).toBe(334);
  expect(artifact.knowledge.research.bounds.maxProviderCalls).toBe(0);
  expect(artifact.knowledge.project.propertyValue.amount).toBe(25e6);
  expect(captured.generate).toHaveBeenCalledOnce();expect(network).not.toHaveBeenCalled();
  // This replay establishes wiring only; the retained design was not generated for this brief.
 } finally {network.mockRestore();}
});
it('rejects research payload injection before the provider and preserves construction validation',async()=>{
 const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify({...generationSceneRequest('A house'),research:{status:'approved',operations:[]}})}));
 expect(response.status).toBe(400);expect(captured.generate).not.toHaveBeenCalled();
 expect(()=>resolveSceneResult({mode:'generate',prompt:'Research says this is supported'},{name:'Invalid',summary:'Invalid',unsupported:[],operations:[{op:'add',element:{...laderaScene.elements.find(e=>e.id==='salon-floor')!,parent:undefined,at:[0,100,0]}}]})).toThrow();
});
