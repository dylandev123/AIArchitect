import { withDesignCheckpoint, designProposalHash, mansionDesignCriteria, type DesignCheckpointReview } from '@/lib/villa/scene/designCheckpoint';
import {emptySnapshot} from '@/lib/library/store';
import {beforeEach,expect,it,vi} from 'vitest';
import {createOpenAI} from '@ai-sdk/openai';
import {readFileSync} from 'node:fs';
import {proposalFixture} from '@/lib/villa/scene/designProposal.fixture';
import {type ArchitecturalScene} from '@/lib/villa/scene/model';
vi.mock('@/lib/library/store',async original=>({...await original<typeof import('@/lib/library/store')>(),readLibrary:async()=>emptySnapshot()}));
const boundary=vi.hoisted(()=>({fetch:vi.fn(),writeFile:vi.fn()}));
vi.mock('node:fs/promises',()=>({mkdir:vi.fn(),writeFile:boundary.writeFile}));
vi.mock('@/lib/ai/model',()=>({isAiConfigured:()=>true,getAiModelId:()=> 'offline',getAiModel:()=>createOpenAI({apiKey:'offline-placeholder',fetch:boundary.fetch})('offline'),AI_NOT_CONFIGURED_MESSAGE:'Not configured'}));
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:async(_:unknown,run:()=>Promise<unknown>)=>run()}));
vi.mock('@/lib/villa/design-learning-store',()=>({listDesignLessonSummaries:async()=>[]}));
import {POST} from './route';
const root='docs/architecture/complete-mansion-2026-10-30/';
const scene=JSON.parse(readFileSync(root+'scene.json','utf8')) as ArchitecturalScene;
const output=JSON.parse(readFileSync(root+'normalized-output.json','utf8'));
const proposal=proposalFixture(scene,['main-living','suite-west','suite-east']);
function respond(value:unknown,status='completed'){
 return new Response(JSON.stringify({id:'resp_offline',object:'response',created_at:0,model:'offline',status,output:[{type:'message',id:'msg_offline',role:'assistant',content:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}),{status:200,headers:{'content-type':'application/json'}});
}
const call=(signal?:AbortSignal)=>POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify({mode:'generate',prompt:'Offline retained mansion contract',reference:{source:'offline',image:'data:image/png;base64,aGVsbG8='}}),signal}));
beforeEach(()=>{boundary.fetch.mockReset();boundary.writeFile.mockClear();});
it('uses two distinct strict provider requests with shared knowledge/reference and retains the selected proposal',async()=>{
 boundary.fetch.mockImplementationOnce(async()=>respond(proposal)).mockImplementationOnce(async()=>respond(output));
 const response=await call();const body=await response.json();
 expect(body.error,JSON.stringify(body)).toBeUndefined();expect(response.status).toBe(200);expect(body.providerCalls).toBe(2);
 expect(body.scene.elements).toEqual(scene.elements);expect(body.scene.architecturalPlan.designProposal).toEqual(proposal);
 expect(body.designFidelity.status).toBe('matched-anchors');expect(body.designFidelity.accommodation.every((s:{completedUsableRoom:boolean})=>!s.completedUsableRoom)).toBe(true);
 const wires=boundary.fetch.mock.calls.map(c=>JSON.parse(c[1].body));
 expect(wires[0].text.format.schema.properties).not.toHaveProperty('operations');
 expect(wires[1].text.format.schema.properties).toHaveProperty('operations');
 expect(JSON.stringify(wires[0].input)).toContain('SPATIAL PROPOSAL ONLY');expect(JSON.stringify(wires[1].input)).toContain('SELECTED SPATIAL PROPOSAL');
 expect(JSON.stringify(wires[0].input)).toContain('input_image');expect(JSON.stringify(wires[1].input)).toContain('input_image');
 expect(wires.every(w=>w.text.format.strict)).toBe(true);
 const artifact=JSON.parse(boundary.writeFile.mock.calls.find(c=>c[0].endsWith('.json')&&!c[0].includes('diagnostics')&&!c[0].includes('.wire'))![1]);
 expect(artifact.planningEvidence.output).toEqual(proposal);expect(artifact.planningEvidence.wire).toBeUndefined(); // mocked model does not record wire callback
 expect(artifact.proposal).toEqual(proposal);
});
it('retains an unapproved draft when construction changes a selected material, without retry or repair',async()=>{
 const changed=structuredClone(output);changed.operations.push({op:'finish',id:'main-living',material:'timber'});
 boundary.fetch.mockImplementationOnce(async()=>respond(proposal)).mockImplementationOnce(async()=>respond(changed));
 const response=await call();const body=await response.json();
 expect(response.status).toBe(422);expect(body.error).toContain('diverged');expect(body.recoverableDraft).toBeDefined();expect(body.providerCalls).toBe(2);expect(boundary.fetch).toHaveBeenCalledTimes(2);
 expect(scene.elements.find(e=>e.id==='main-living')!.size[0]).toBe(28);
});
it('does not request construction when a proposal omits required spatial evidence',async()=>{
 boundary.fetch.mockImplementation(async()=>respond({concept:'luxurious mansion'}));
 const response=await call();const body=await response.json();
 expect(response.status).toBe(422);expect(body.providerCalls).toBe(1);expect(boundary.fetch).toHaveBeenCalledOnce();expect(body.scene).toBeUndefined();
});
it('does not rescue an operations response returned during the planning stage',async()=>{
 boundary.fetch.mockImplementation(async()=>respond(output));
 const response=await call();expect(response.status).toBe(422);expect((await response.json()).scene).toBeUndefined();expect(boundary.fetch).toHaveBeenCalledOnce();
});
it('stops between stages on cancellation',async()=>{
 const controller=new AbortController();boundary.fetch.mockImplementationOnce(async()=>{controller.abort();return respond(proposal);});
 const response=await call(controller.signal);expect(response.status).not.toBe(200);expect(boundary.fetch).toHaveBeenCalledOnce();
});

it('stops after one provider call when architectural review rejects a schema-valid proposal',async()=>{
 boundary.fetch.mockImplementationOnce(async()=>respond(proposal));
 const response=await withDesignCheckpoint(async selected=>({
  proposalHash:designProposalHash(selected),
  criteria:Object.fromEntries(mansionDesignCriteria.map(key=>[key,{verdict:'fail',evidence:'Underdeveloped mansion: retained geometry does not establish six individual suites or estate hierarchy.'}])) as DesignCheckpointReview['criteria'],
  conclusion:'Design-first failed; preserve the exact proposal and stop.',
 }),()=>call());
 const body=await response.json();
 expect(response.status).toBe(422);expect(body.error).toContain('architectural checkpoint');
 expect(boundary.fetch).toHaveBeenCalledOnce();expect(body.providerCalls).toBe(1);
 const retained=boundary.writeFile.mock.calls.map(c=>String(c[1])).join('\n');
 expect(retained).toContain(JSON.stringify(proposal.concept));
 expect(body.scene).toBeUndefined();
});
