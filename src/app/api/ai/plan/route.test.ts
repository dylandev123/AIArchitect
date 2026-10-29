import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APICallError } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import { NextRequest } from 'next/server';
import { BLANK_V3_SCENE, compileV3Scene } from '@/lib/v3/scene';
import * as compiler from '@/lib/v3/scene';
import { planningStudioBlueprint } from '@/lib/v3/parity/planningStudio';
import { distinctArchitecturalBlueprints } from '@/lib/v3/parity/architecturalBlueprint';
import { splitV3ArchitecturalBlueprint, sameArchitecturalPlan } from '@/lib/v3/architecturalPlanFirst';
import { checkoutPlanEvaluation, preparePlanEvaluation, DEFAULT_PLAN_EXTERIOR_REQUEST } from '@/lib/v3/architecturalPlanEvaluation';
import paidPlan from '@/lib/v3/__tests__/fixtures/paid-plan-548137db.json';
import { useProjectStore } from '@/store/useProjectStore';
import { revisionOf } from '@/lib/house/revision';
import { deriveArchitecturalPlan } from '@/lib/v3/architecturalPlanning';
import * as evaluation from '@/lib/v3/architecturalPlanEvaluation';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GET, POST } from './route';

const mocks=vi.hoisted(()=>({model:vi.fn()}));
vi.mock('@/lib/ai/model',()=>({getAiModel:()=>mocks.model(),getAiModelId:()=> 'gpt-5.6-terra',isAiConfigured:()=>true,AI_PROVIDER_OPTIONS:{}}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:async(_meta:unknown,run:()=>Promise<unknown>)=>run()}));
const fixture=()=>splitV3ArchitecturalBlueprint(planningStudioBlueprint());
function model(output:unknown,finish:'stop'|'length'='stop',rawText?:string){
  const result:LanguageModelV3GenerateResult={content:[{type:'text',text:rawText??JSON.stringify(output)}],finishReason:{unified:finish,raw:finish},warnings:[],usage:{inputTokens:{total:100,noCache:100,cacheRead:0,cacheWrite:0},outputTokens:{total:50,text:50,reasoning:0}}};
  const m=new MockLanguageModelV3({doGenerate:[result]});mocks.model.mockReturnValue(m);return m;
}
const post=(extra:Record<string,unknown>={})=>{
  const body={action:'design',projectId:'offline-plan',prompt:'A courtyard estate',currentHouseJson:JSON.stringify(BLANK_V3_SCENE),...extra};
  return POST(new NextRequest('http://localhost/api/ai/plan',{method:'POST',body:JSON.stringify({baseRevision:revisionOf(body.currentHouseJson),...body})}));
};
let directory:string;
beforeEach(async()=>{directory=await mkdtemp(path.join(os.tmpdir(),'plan-route-'));vi.spyOn(process,'cwd').mockReturnValue(directory);vi.stubEnv('AI_V3_PLAN_EVALUATION','1');vi.stubGlobal('fetch',vi.fn(()=>{throw Error('External network forbidden');}));const data=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)}});useProjectStore.setState({projects:[]});mocks.model.mockReset();});
afterEach(async()=>{expect(fetch).not.toHaveBeenCalled();vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();await rm(directory,{recursive:true,force:true});});

describe('2D evaluation with real SDK parsing and offline provider responses',()=>{
  it.each([undefined,'','   '])('builds the current saved plan with no exterior instructions (%s) and Terra-authored heights',async prompt=>{
    const input=fixture(),originalHeights=new Map(input.plan.features.map(f=>[f.id,f.height]));
    for(const f of input.plan.features)delete f.height;
    input.exterior.features.forEach(f=>{f.height=originalHeights.get(f.id);});
    const stage=preparePlanEvaluation(input.plan),scene=stage.scene!;
    scene.metadata.planResponseSha256='original-2d-response';
    const currentHouseJson=JSON.stringify({...BLANK_V3_SCENE,v3Scene:scene});
    const author=model(input.exterior);
    const res=await post({action:'elaborate',prompt,currentHouseJson}),body=await res.json();
    expect(res.status,JSON.stringify(body)).toBe(200);
    expect(author.doGenerateCalls).toHaveLength(1);
    const sent=author.doGenerateCalls[0].prompt.find(p=>p.role==='user');
    expect(JSON.stringify(sent)).toContain(DEFAULT_PLAN_EXTERIOR_REQUEST);
    const serialized=JSON.stringify(sent);
    // The prompt contains the full lossless CURRENT checkout, including deferred heights.
    expect(serialized).toContain(JSON.stringify(JSON.stringify(checkoutPlanEvaluation(scene).plan)).slice(1,-1));
    expect(serialized).toContain('Not retained; use the saved plan concept and requirements.');
    const built=JSON.parse(body.json).v3Scene;
    expect(sameArchitecturalPlan(scene,built)).toBe(true);
    expect(built.metadata.planDeferredFeatureHeights).toBeUndefined();
    expect(built.metadata.planSourceResponseSha256).toBe('original-2d-response');
    expect(built.metadata.planEvaluation).toBe(false);
    expect(compileV3Scene(built).primitives.length).toBeGreaterThan(0);
    for(const f of input.plan.features)expect(built.objects.find((o:{id:string})=>o.id===f.id).architecture.height).toBe(originalHeights.get(f.id));
    expect(JSON.stringify({...BLANK_V3_SCENE,v3Scene:scene})).toBe(currentHouseJson);
  });
  it('reports the paid working plan site and wall conflicts before obtaining a provider',async()=>{
    const plan=structuredClone(paidPlan);
    plan.connections.find(c=>c.id==='pool-walk')!.to={kind:'surface',objectId:'sea-terrace',local:[0,0]};
    const entry=plan.buildings[0].accessOpenings.find(o=>o.id==='main-entry')!;
    entry.start=.432;entry.end=.568;
    const stage=preparePlanEvaluation(plan),currentHouseJson=JSON.stringify({...BLANK_V3_SCENE,v3Scene:stage.scene});
    const res=await post({action:'elaborate',prompt:undefined,currentHouseJson}),body=await res.json();
    expect(res.status).toBe(409);expect(body.providerCalls).toBe(0);
    expect(body.findings.map((f:{code:string})=>f.code)).toEqual(['BLUEPRINT_SITE_BOUNDS','BLUEPRINT_ENTRANCE_WALL']);
    expect(body.json).toBeUndefined();expect(body.recovery).toBeUndefined();
    expect(mocks.model).not.toHaveBeenCalled();
    expect(JSON.stringify({...BLANK_V3_SCENE,v3Scene:stage.scene})).toBe(currentHouseJson);
  });
  it('still requires a brief for initial design',async()=>{
    expect((await post({prompt:undefined})).status).toBe(400);
    expect((await post({prompt:'  '})).status).toBe(400);
    expect(mocks.model).not.toHaveBeenCalled();
  });
  it('uses the compact production prompt, parses its provider response and preserves its geometry through exterior construction',async()=>{
    const compact=JSON.parse(readFileSync(new URL('../../../../lib/v3/__tests__/fixtures/plan-authoring-estate.plan.json',import.meta.url),'utf8'));
    const author=model(compact),res=await post(),body=await res.json();
    expect(res.status,JSON.stringify(body)).toBe(200);
    const system=author.doGenerateCalls[0].prompt.find(p=>p.role==='system');
    expect(system?.content).toContain('V3 derives route owners');
    const schema=JSON.parse(String(system?.content).split('Schema:\n')[1]);
    expect(schema.properties).not.toHaveProperty('entrances');
    expect(schema.properties).not.toHaveProperty('program');
    expect(body.recovery.rawResponse).toBe(JSON.stringify(compact));
    const saved=JSON.parse(body.json).v3Scene;
    const ext=JSON.parse(readFileSync(new URL('../../../../lib/v3/__tests__/fixtures/plan-first-estate.exterior.json',import.meta.url),'utf8'));
    ext.connections.forEach((c:{id:string},i:number)=>{c.id=saved.estatePlan.circulation[i].id;});
    ext.partitions=[];ext.doors=[];
    ext.verticalCirculation=[{id:'library-stair',stairType:'straight',direction:'south'}];
    const exterior=model(ext),built=await post({action:'elaborate',currentHouseJson:body.json}),result=await built.json();
    expect(built.status,JSON.stringify(result)).toBe(200);
    expect(sameArchitecturalPlan(saved,JSON.parse(result.json).v3Scene)).toBe(true);
    expect(exterior.doGenerateCalls).toHaveLength(1);
  });
  it('saves a conceptual reservation but rejects an exterior flight that cannot fit it',async()=>{
    const compact=JSON.parse(readFileSync(new URL('../../../../lib/v3/__tests__/fixtures/plan-authoring-estate.plan.json',import.meta.url),'utf8'));
    compact.verticalCirculation[0].footprint={x:-14,z:-3,width:2.5,depth:3};
    const author=model(compact),designed=await post(),body=await designed.json();
    expect(designed.status,JSON.stringify(body)).toBe(200);
    expect(author.doGenerateCalls).toHaveLength(1);
    const stage=checkoutPlanEvaluation(JSON.parse(body.json).v3Scene);
    const ext=fixture().exterior;
    ext.connections.forEach((c,i)=>{c.id=stage.plan!.connections[i].id;});
    ext.partitions=[];ext.doors=[];
    ext.verticalCirculation=[{id:'library-stair',stairType:'straight',direction:'south'}];
    const exterior=model(ext);
    const built=await post({action:'elaborate',currentHouseJson:body.json}),result=await built.json();
    expect(built.status).toBe(422);expect(result.providerCalls).toBe(1);
    expect(result.json).toBeUndefined();
    expect(result.findings.some((f:{code:string})=>f.code==='CIRCULATION_NOT_USABLE')).toBe(true);
    expect(exterior.doGenerateCalls).toHaveLength(1);
  });
  it.each([undefined,'rate_limit_exceeded','insufficient_quota'])('classifies HTTP 429 (%s) without fabricating a plan, retry or provider subtype',async code=>{
    const failed=new MockLanguageModelV3({doGenerate:async()=>{throw new APICallError({message:'secret request details must not be retained',url:'https://example.invalid',requestBodyValues:{secret:'private'},statusCode:429,isRetryable:true,responseBody:JSON.stringify({error:{code}}),responseHeaders:{'x-request-id':'req-offline-429','authorization':'private'}});}});
    mocks.model.mockReturnValue(failed);
    const res=await post(),body=await res.json();
    expect(res.status).toBe(502);expect(body.failure).toMatchObject({category:'provider',code:'provider_429',status:429,requestId:'req-offline-429'});
    expect(body.failure.providerCode).toBe(code);expect(body.error).toContain('Provider failure (HTTP 429');
    expect(body.recovery).toBeUndefined();expect(body.json).toBeUndefined();expect(failed.doGenerateCalls).toHaveLength(1);
    const files=await readdir(path.join(directory,'.v3-debug/plan-evaluations'));
    expect(files).toEqual([`${body.failureId}.failure.json`]);
    const saved=await readFile(path.join(directory,'.v3-debug/plan-evaluations',files[0]),'utf8');
    const {message,...details}=body.failure;
    expect(JSON.parse(saved)).toMatchObject({projectId:'offline-plan',action:'design',failure:{...details,summary:message}});
    expect(saved).not.toContain('private');expect(saved).not.toContain('secret request');
  });
  it('separates parsing, schema, geometric planning and application normalization failures while preserving text',async()=>{
    const raw=' \n{"buildings": [';
    model(null,'stop',raw);const parsing=await (await post()).json();
    expect(parsing.failure).toMatchObject({category:'parsing',code:'invalid_json'});expect(parsing.recovery.rawResponse).toBe(raw);
    model({format:'invalid'});const schema=await (await post()).json();expect(schema.failure.category).toBe('schema');
    const plan=fixture().plan;plan.buildings[0].location.x=500;
    model(plan);const geometry=await (await post()).json();expect(geometry.failure.category).toBe('geometry');
    const valid=fixture().plan;model(valid);
    vi.spyOn(evaluation,'preparePlanEvaluation').mockImplementationOnce(()=>{throw Error('internal failure');});
    const application=await (await post()).json();expect(application.failure).toMatchObject({category:'normalization',code:'normalization_error'});
    expect(application.recovery.rawResponse).toBe(JSON.stringify(valid));expect(application.json).toBeUndefined();
  });
  it('separates output truncation, refusal and timeout from malformed JSON',async()=>{
    model(null,'length','{"unfinished":');const truncated=await (await post()).json();expect(truncated.failure.code).toBe('output_truncated');
    const refused=new MockLanguageModelV3({doGenerate:async()=>({content:[],finishReason:{unified:'content-filter',raw:'content_filter'},warnings:[],usage:{inputTokens:{total:0,noCache:0,cacheRead:0,cacheWrite:0},outputTokens:{total:0,text:0,reasoning:0}}})});
    mocks.model.mockReturnValue(refused);expect((await (await post()).json()).failure.code).toBe('provider_refusal');
    const timeout=new MockLanguageModelV3({doGenerate:async()=>{throw new DOMException('offline timeout','TimeoutError');}});
    mocks.model.mockReturnValue(timeout);expect((await (await post()).json()).failure.code).toBe('provider_timeout');expect(timeout.doGenerateCalls).toHaveLength(1);
  });
  it('is disabled by default and cannot be enabled by a request',async()=>{
    vi.stubEnv('AI_V3_PLAN_EVALUATION','');expect((await (await GET()).json()).enabled).toBe(false);
    expect((await post({enabled:true})).status).toBe(403);expect(mocks.model).not.toHaveBeenCalled();
  });
  it.each(distinctArchitecturalBlueprints())('saves $name without exterior authorship or 3D construction',async({blueprint})=>{
    const input=splitV3ArchitecturalBlueprint(blueprint),m=model(input.plan),spy=vi.spyOn(compiler,'compileV3Scene');
    const res=await post(),body=await res.json();expect(res.status,JSON.stringify(body)).toBe(200);expect(body.outcome).toBe('plan');expect(body.providerCalls).toBe(1);
    expect(m.doGenerateCalls).toHaveLength(1);expect(m.doGenerateCalls[0].maxOutputTokens).toBe(10000);expect(spy).not.toHaveBeenCalled();
    const scene=JSON.parse(body.json).v3Scene;
    expect(scene.objects.some((o:{type:string})=>o.type==='roof-form')).toBe(false);expect(scene.interior.partitions).toEqual([]);expect(scene.interior.doors).toEqual([]);
    const drawing=deriveArchitecturalPlan(scene,null,null);expect(drawing.buildings).toHaveLength(input.plan.buildings.length);
    expect(checkoutPlanEvaluation(scene).ok).toBe(true);
    const store=useProjectStore.getState(),project=store.createProject('Offline','house','v3-scene');
    store.appendVersion(project.id,'2D plan',body.json,'ai-plan-evaluation');
    expect(checkoutPlanEvaluation(JSON.parse(store.getProject(project.id)!.houseConfigJson).v3Scene).ok).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
  it('accepts the reported descriptive site vocabulary through the normal route with one offline response',async()=>{
    const plan=fixture().plan;
    for(const f of plan.features)f.type=({courtyard:'paved arrival court',terrace:'paved terrace',pool:'swimming pool','landscape-zone':'lawn'} as Record<string,string>)[f.type]??f.type;
    const raw=' \n'+JSON.stringify(plan,null,2)+'\n',m=model(plan,'stop',raw),compile=vi.spyOn(compiler,'compileV3Scene');
    const sha256=createHash('sha256').update(raw).digest('hex');
    const prepare=evaluation.preparePlanEvaluation;
    vi.spyOn(evaluation,'preparePlanEvaluation').mockImplementationOnce(input=>{
      expect(readFileSync(path.join(directory,`.v3-debug/plan-evaluations/${sha256}.response.json`),'utf8')).toBe(raw);
      return prepare(input);
    });
    const res=await post(),body=await res.json();expect(res.status,JSON.stringify(body)).toBe(200);
    expect(m.doGenerateCalls).toHaveLength(1);expect(compile).not.toHaveBeenCalled();expect(JSON.parse(raw)).toEqual(plan);
    expect(body.recovery).toMatchObject({rawResponse:raw,sha256,redacted:false,originalSha256:sha256});
    const scene=JSON.parse(body.json).v3Scene;
    expect(scene.metadata.usage.repair).toBe(false);expect(checkoutPlanEvaluation(scene).ok).toBe(true);
    expect(body.findings.some((f:{code:string})=>['PLAN_FEATURE','PLAN_REFERENCE'].includes(f.code))).toBe(false);
  });
  it.each([' \n{"format": "v3-plan-first-1", "buildings": [', 'not JSON · é\n'])('captures malformed output before SDK rejection: %s',async raw=>{
    const m=model(null,'stop',raw),response=await post(),body=await response.json();
    expect(response.status).toBe(502);expect(body).not.toHaveProperty('json');
    expect(body.recovery.rawResponse).toBe(raw);
    expect(body.recovery.sha256).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(await readFile(path.join(directory,`.v3-debug/plan-evaluations/${body.recovery.sha256}.response.json`),'utf8')).toBe(raw);
    expect(m.doGenerateCalls).toHaveLength(1);
  });
  it('redacts secrets from returned and saved captures with a verifiable content hash',async()=>{
    vi.stubEnv('TEST_CAPTURE_SECRET','offline-secret-that-must-not-leak');
    const raw='{ "format":"invalid", "api_key":"hidden-private-value", "label":"offline-secret-that-must-not-leak" }';
    const m=model(null,'stop',raw),response=await post(),body=await response.json();
    expect(response.status).toBe(422);expect(body.recovery.redacted).toBe(true);
    const safe=body.recovery.rawResponse;
    expect(safe).not.toContain('hidden-private-value');expect(safe).not.toContain('offline-secret-that-must-not-leak');
    expect(body.recovery.sha256).toBe(createHash('sha256').update(safe).digest('hex'));
    expect(body.recovery.originalSha256).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(await readFile(path.join(directory,`.v3-debug/plan-evaluations/${body.recovery.sha256}.response.json`),'utf8')).toBe(safe);
    expect(m.doGenerateCalls).toHaveLength(1);
  });
  it('keeps the exact output and hash when a local route defect leaves the plan unresolved, with no replacement call',async()=>{
    const {createHash}=await import('node:crypto');
    const plan=fixture().plan;plan.connections[0].to={kind:'surface',objectId:'long-pool',local:[0,0]};
    const raw=' \n'+JSON.stringify(plan,null,2)+'\n';
    const m=model(plan,'stop',raw),res=await post(),body=await res.json();expect(res.status).toBe(200);
    expect(body.recovery.rawResponse).toBe(raw);
    expect(body.recovery.sha256).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(body.recovery.bytes).toBe(Buffer.byteLength(raw));expect(m.doGenerateCalls).toHaveLength(1);
    expect(body.summary).toMatch(/could not be drawn/);
    const unresolved=JSON.parse(body.json).v3Scene.metadata.planUnresolved;
    expect(unresolved.map((i:{id:string})=>i.id)).toContain(plan.connections[0].id);
    expect(unresolved.find((i:{id:string})=>i.id===plan.connections[0].id).raw.to).toEqual(plan.connections[0].to);
  });
  it('still rejects, with the exact output, a plan whose primary footprint cannot be represented',async()=>{
    const {createHash}=await import('node:crypto');
    const plan=fixture().plan;plan.buildings[0].plan={kind:'outline',segments:[{id:'a',type:'line',start:[0,0],end:[10,0]},{id:'b',type:'line',start:[10,0],end:[10,10]}]};
    const raw=JSON.stringify(plan);
    const m=model(plan,'stop',raw),res=await post(),body=await res.json();expect(res.status).toBe(422);
    expect(body.recovery.sha256).toBe(createHash('sha256').update(raw).digest('hex'));expect(m.doGenerateCalls).toHaveLength(1);
    expect(body).not.toHaveProperty('json');
  });
  it('edits, saves, reloads, undoes and elaborates the current saved geometry with one separate call',async()=>{
    const input=fixture(),m=model(input.plan),body=await (await post()).json();expect(m.doGenerateCalls).toHaveLength(1);
    const store=useProjectStore.getState(),project=store.createProject('Plan','house','v3-scene');store.appendVersion(project.id,'Plan',body.json);
    const current=checkoutPlanEvaluation(JSON.parse(store.getProject(project.id)!.houseConfigJson).v3Scene);
    current.plan!.buildings.find(b=>b.id==='orchard-atelier')!.plan={kind:'rectangle',width:13,depth:10};
    const edited=preparePlanEvaluation(current.plan);expect(edited.ok).toBe(true);
    store.appendVersion(project.id,'Local plan edit',JSON.stringify({...JSON.parse(body.json),v3Scene:edited.scene}));
    const saved=store.getProject(project.id)!.houseConfigJson;
    store.undo(project.id);expect(sameArchitecturalPlan(JSON.parse(store.getProject(project.id)!.houseConfigJson).v3Scene,JSON.parse(body.json).v3Scene)).toBe(true);
    store.redo(project.id);expect(store.getProject(project.id)!.houseConfigJson).toBe(saved);
    const reopened=checkoutPlanEvaluation(JSON.parse(saved).v3Scene);expect(reopened.plan!.buildings.find(b=>b.id==='orchard-atelier')!.plan).toEqual({kind:'rectangle',width:13,depth:10});
    const exteriorModel=model(input.exterior),builtRes=await post({action:'elaborate',prompt:'Pale stone and flat roofs; choose deferred facade details',currentHouseJson:saved}),built=await builtRes.json();
    expect(builtRes.status,JSON.stringify(built)).toBe(200);expect(exteriorModel.doGenerateCalls).toHaveLength(1);expect(sameArchitecturalPlan(JSON.parse(saved).v3Scene,JSON.parse(built.json).v3Scene)).toBe(true);expect(compileV3Scene(JSON.parse(built.json).v3Scene).primitives.length).toBeGreaterThan(0);
    expect(store.getProject(project.id)!.houseConfigJson).toBe(saved);
  });
  it('retains localized room diagnostics and rejects core invalid geometry without retry',async()=>{
    const input=fixture();input.plan.buildings[0].storeys[0].spaces[0].footprint.x=100;
    const m=model(input.plan),res=await post(),body=await res.json();expect(res.status,JSON.stringify(body)).toBe(200);expect(body.findings.some((f:{code:string})=>f.code==='BLUEPRINT_SPACE_OUTSIDE_HOST')).toBe(true);expect(m.doGenerateCalls).toHaveLength(1);
    input.plan.buildings[0].location.x=500;const invalid=model(input.plan),failed=await post();expect(failed.status).toBe(422);expect(await failed.json()).not.toHaveProperty('json');expect(invalid.doGenerateCalls).toHaveLength(1);
  });
  it('preserves the plan when exterior output tries to replace geometry',async()=>{
    const input=fixture(),scene=preparePlanEvaluation(input.plan).scene;
    const exterior=structuredClone(input.exterior);Object.assign(exterior.buildings[0],{location:{x:100,z:0}});
    const m=model(exterior),res=await post({action:'elaborate',currentHouseJson:JSON.stringify({...BLANK_V3_SCENE,v3Scene:scene})});
    expect(res.status).toBe(422);expect(await res.json()).not.toHaveProperty('json');expect(m.doGenerateCalls).toHaveLength(1);
  });
  it('rejects truncation, malformed output, provider errors and does not retry',async()=>{
    const m=model(fixture().plan,'length');expect((await post()).status).toBe(502);expect(m.doGenerateCalls).toHaveLength(1);
    const malformed=model({format:'bad'});expect((await post()).status).toBe(422);expect(malformed.doGenerateCalls).toHaveLength(1);
    const failed=new MockLanguageModelV3({doGenerate:async()=>{throw new APICallError({message:'offline retryable error',url:'https://example.invalid',requestBodyValues:{},statusCode:503,isRetryable:true});}});mocks.model.mockReturnValue(failed);expect((await post()).status).toBe(502);expect(failed.doGenerateCalls).toHaveLength(1);
  });
  it('blocks ordinary chat generation and edits against a saved evaluation before any provider call',async()=>{
    const scene=preparePlanEvaluation(fixture().plan).scene;
    const {POST:house}=await import('../house/route');
    for(const mode of ['generate','edit']){
      const res=await house(new NextRequest('http://localhost/api/ai/house',{method:'POST',body:JSON.stringify({mode,generationMode:'v3-scene',prompt:'Change this plan',currentHouseJson:JSON.stringify({...BLANK_V3_SCENE,v3Scene:scene})})}));
      expect(res.status).toBe(409);
    }
    expect(mocks.model).not.toHaveBeenCalled();
  });
  it('blocks unsupported later construction before any provider request while keeping the plan valid',async()=>{
    const plan=fixture().plan;
    plan.features[0].footprint={kind:'outline',operations:[],segments:[{id:'boundary',type:'arc',center:[0,0],radius:4,startAngle:0,sweep:360}]};
    const evaluated=preparePlanEvaluation(plan);expect(evaluated.ok).toBe(true);
    const res=await post({action:'elaborate',currentHouseJson:JSON.stringify({...BLANK_V3_SCENE,v3Scene:evaluated.scene})});
    expect(res.status).toBe(409);expect((await res.json()).providerCalls).toBe(0);expect(mocks.model).not.toHaveBeenCalled();
  });
  it('guards existing projects, advanced terrain and stale revisions before using a model',async()=>{
    const scene=preparePlanEvaluation(fixture().plan).scene;
    expect((await post({currentHouseJson:JSON.stringify({...BLANK_V3_SCENE,v3Scene:scene})})).status).toBe(409);
    expect((await post({currentHouseJson:JSON.stringify({...BLANK_V3_SCENE,v3Scene:{...BLANK_V3_SCENE.v3Scene,metadata:{terrainMode:'advanced'}}})})).status).toBe(409);
    expect((await post({baseRevision:'stale'})).status).toBe(409);expect(mocks.model).not.toHaveBeenCalled();
  });
});
