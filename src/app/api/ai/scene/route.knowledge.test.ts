import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import type { LibrarySnapshot } from '@/lib/library/store';
const captured = vi.hoisted(()=>({generate:vi.fn(), artifacts:[] as string[]}));
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:captured.generate}));
vi.mock('@/lib/ai/model',()=>({isAiConfigured:()=>true,getAiModel:()=> 'offline',getAiModelId:()=> 'offline',AI_PROVIDER_OPTIONS:{},AI_NOT_CONFIGURED_MESSAGE:'offline'}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:async (_:unknown,run:()=>Promise<unknown>)=>run()}));
vi.mock('node:fs/promises',async original=>({...await original<typeof import('node:fs/promises')>(),mkdir:vi.fn(),writeFile:async (_:unknown,text:string)=>{captured.artifacts.push(text);}}));
vi.mock('@/lib/library/store',async original=>{
 const actual=await original<typeof import('@/lib/library/store')>();
 const fs=await import('node:fs');
 const snapshot=JSON.parse(fs.readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
 return {...actual,readLibrary:async()=>({...actual.emptySnapshot(),...snapshot} as LibrarySnapshot)};
});
import { POST } from './route';
import { generationSceneRequest } from '@/lib/villa/scene/terra';
import { constructionCapabilityReference } from '@/lib/villa/scene/capabilityReference';
import { architecturalRequestContext } from '@/lib/villa/scene/knowledgeContext';
import { latestKnowledge } from '@/lib/library/architecture/service';
import { legacyRecipeKnowledge } from '@/lib/library/architecture/legacyRecipes';
import { retrieveArchitecturalKnowledge } from '@/lib/library/architecture/retrieval';
import { laderaScene } from '@/lib/villa/scene/example';

it('captures four actual homepage handler requests offline against the stored library snapshot',async()=>{
 const network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('Network forbidden'));
 try{
  const source='docs/architecture/unified-knowledge/retained-response.json';
  const raw=readFileSync(source,'utf8'), retained=JSON.parse(raw);
  const examples=[];
  for(const prompt of ['$250k compact family home','$1m Mediterranean courtyard villa','$5m contemporary tropical residence','$25m Caribbean waterfront mansion']){
   captured.generate.mockReset();captured.artifacts=[];
   captured.generate.mockResolvedValue({output:retained.output,text:JSON.stringify(retained.output),finishReason:'stop'});
   const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(generationSceneRequest(prompt))}));
   expect(response.status).toBe(200);
   const result=await response.json(), request=captured.generate.mock.calls[0][0];
   const artifact=JSON.parse(captured.artifacts[0]);
   expect(captured.generate).toHaveBeenCalledOnce();
   expect(request.system).toContain(constructionCapabilityReference());
   expect(artifact.knowledge.metrics.approvedActive).toBe(334);
   expect(artifact.knowledge.metrics.excluded.length+artifact.knowledge.selected.length).toBe(334);
   expect(request.system.endsWith(artifact.knowledge.text)).toBe(true);
   expect(artifact.knowledge.text.length).toBe(artifact.knowledge.chars);
   expect(request.system.split('ARCHITECTURAL DESIGN GUIDE').length-1).toBe(1);
   for(const category of artifact.knowledge.metrics.categories) expect(artifact.knowledge.selected.filter((e:{category:string})=>e.category===category).length).toBeLessThanOrEqual(Math.max(2,Math.ceil(artifact.knowledge.budget.entries/3)));
   if(prompt.includes('$5m')) expect(artifact.knowledge.metrics.categories).toEqual(expect.arrayContaining(['composition','programme','envelope','arrival','roof-outdoor']));
   expect(result.scene.elements.length).toBeGreaterThan(0);
   examples.push({brief:prompt,knowledge:artifact.knowledge,system:request.system,messages:request.messages,
    systemChars:request.system.length,messageChars:JSON.stringify(request.messages).length,
    replay:{source,sha256:createHash('sha256').update(raw).digest('hex'),elements:result.scene.elements.length,knowledgeUse:result.architecturalAudit.knowledgeUse,note:'Unchanged retained response, not a design for this brief. Uncited knowledge stays selected-missing. No model influence or new architecture claimed.'}});
  }
  expect(network).not.toHaveBeenCalled();
  mkdirSync('docs/architecture/code-driven',{recursive:true});
  writeFileSync('docs/architecture/code-driven/homepage-requests.json',JSON.stringify(examples,null,2));
 }finally{network.mockRestore();}
});

it('uses the shared context for all edit intents without imposing Refine scope on broad development',async()=>{
 for(const editIntent of ['refine','redesign','complete'] as const){
  const context=await architecturalRequestContext({mode:'edit',editIntent,prompt:'Improve roof',current:{...laderaScene,architecturalPlan:{scaleRationale:'$25m Caribbean waterfront mansion',arrivalAndCirculation:'Entrance to living',volumeHierarchy:'Main residence',relationshipsAndViews:'Ocean views',roofFacadeAndMaterials:'Tropical shade',intendedSpaces:['living']}}});
  expect(context.trace.query.includes('Retained design intent')).toBe(editIntent!=='refine');
  expect(context.system.includes('Scoped edit: preserve unrelated geometry')).toBe(editIntent==='refine');
  expect(context.trace.metrics.approvedActive).toBe(334);
 }
});

it('can select each stored legacy recipe through the same reader, while excluding unapproved revisions',()=>{
 const snapshot=JSON.parse(readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
 const legacy=legacyRecipeKnowledge(snapshot.recipes);
 const all=[...latestKnowledge(snapshot.architecturalKnowledge),...legacy];
 for(const entry of legacy){
  const scale=entry.scales.includes('mansion')?'mansion':entry.scales.includes('estate')?'estate':'family';
  const result=retrieveArchitecturalKnowledge(all,`${entry.title} ${scale} ${entry.tags.join(' ')}`);
  expect(result.selected.some(r=>r.id===entry.id),entry.title).toBe(true);
  const proposed=retrieveArchitecturalKnowledge([{...entry,status:'proposed'}],entry.title);
  expect(proposed.selected).toHaveLength(0);
  expect(proposed.metrics.excluded[0].reason).toBe('proposed');
 }
});

it('deduplicates identical selected guidance without deleting either stored record',()=>{
 const original=latestKnowledge().find(e=>e.id==='covered-threshold')!;
 const copy={...original,id:'duplicate-covered-threshold'};
 const result=retrieveArchitecturalKnowledge([original,copy],`A family house with ${original.title} ${original.tags.join(' ')}`);
 expect(result.selected).toHaveLength(1);
 expect(result.metrics.excluded).toEqual([{id:copy.id,reason:'duplicate selected guidance'}]);
});

it('allows every approved architectural record into the same relevance path for its explicit subject',()=>{
 const snapshot=JSON.parse(readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
 const entries=latestKnowledge(snapshot.architecturalKnowledge);
 for(const entry of entries){
  const brief=`${entry.title} ${entry.scales[0]??'family'} house ${entry.tags.join(' ')} ${entry.category==='property-value'?entry.when:''}`;
  const result=retrieveArchitecturalKnowledge(entries,brief);
  const excluded=result.metrics.excluded.find(e=>e.id===entry.id);
  expect(!excluded || ['retrieval budget','category diversity budget','duplicate selected guidance'].includes(excluded.reason),`${entry.id}: ${excluded?.reason}`).toBe(true);
 }
});
