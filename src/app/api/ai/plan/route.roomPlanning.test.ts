import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {NextRequest} from 'next/server';
import {readFileSync} from 'node:fs';
import {BLANK_V3_SCENE} from '@/lib/v3/scene';
import {revisionOf} from '@/lib/house/revision';
import {roomPlanningExamples,roomPlanningExterior,relationshipGardenHome} from '@/lib/v3/parity/roomPlanning';
import {checkoutPlanEvaluation,reviseDraftRoomLayout} from '@/lib/v3/architecturalPlanEvaluation';
import {sameArchitecturalPlan,planConstructionBlockers} from '@/lib/v3/architecturalPlanFirst';
import {auditV3Interior} from '@/lib/v3/interior';
import {RELATIONSHIP_FIRST_ROOM_GUIDANCE} from '@/lib/v3/architecturalDesignGuidance';
import {POST} from './route';
vi.mock('@/lib/ai/usage/track',()=>({withUsageLogging:async(_meta:unknown,run:()=>Promise<unknown>)=>run()}));
vi.mock('@/lib/ai/planResponseArtifact',()=>({
 retainPlanResponse:async(raw:string)=>({rawResponse:raw,sha256:createHash('sha256').update(raw).digest('hex')}),
 planResponseEvidence:(raw:string)=>({sha256:createHash('sha256').update(raw).digest('hex')}),
}));
vi.mock('@/lib/ai/planFailure',async importOriginal=>({...await importOriginal<typeof import('@/lib/ai/planFailure')>(),retainPlanFailure:async()=>undefined}));
let output:unknown,responseText:string|undefined,wires:{input:unknown;max_output_tokens:number}[];
beforeEach(()=>{
 wires=[];responseText=undefined;vi.stubEnv('OPENAI_API_KEY','offline-placeholder-never-sent');vi.stubEnv('AI_V3_PLAN_EVALUATION','1');vi.stubEnv('AI_HOUSE_MODEL','gpt-5.6-terra');
 vi.stubGlobal('fetch',vi.fn(async(_input:unknown,init?:RequestInit)=>{
  const wire=JSON.parse(String(init?.body));wires.push(wire);
  return Response.json({id:'offline-only',model:wire.model,created_at:1,status:'completed',output:[{type:'message',id:'offline-message',role:'assistant',status:'completed',content:[{type:'output_text',text:responseText??JSON.stringify(output),annotations:[]}]}],usage:{input_tokens:100,output_tokens:50,total_tokens:150}});
 }));
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();vi.unstubAllEnvs();});
const post=(action:string,json:string)=>POST(new NextRequest('http://localhost/api/ai/plan',{method:'POST',body:JSON.stringify({action,prompt:action==='design'?'A thoughtful home with clear circulation':'',currentHouseJson:json,baseRevision:revisionOf(json)})}));

it.each(roomPlanningExamples())('production SDK/API: $name → saved/editor geometry → reload → exterior → V3, without external transport',async({make})=>{
 output=make();const response=await post('design',JSON.stringify(BLANK_V3_SCENE)),saved=await response.json();
 expect(response.status,JSON.stringify(saved)).toBe(200);expect(wires).toHaveLength(1);expect(JSON.stringify(wires[0].input)).toContain(RELATIONSHIP_FIRST_ROOM_GUIDANCE.trim().split('\n')[0].slice(0,70));
 expect(saved.recovery.rawResponse).toBe(JSON.stringify(output));
 const root=JSON.parse(saved.json),stage=checkoutPlanEvaluation(JSON.parse(JSON.stringify(root.v3Scene)));
 expect(stage.ok).toBe(true);expect(planConstructionBlockers(stage)).toEqual([]);expect(auditV3Interior(stage.scene!).filter(f=>f.code.startsWith('ROOM_'))).toEqual([]);
 wires=[];output=roomPlanningExterior(output);
 const development=await post('elaborate',saved.json),built=await development.json();
 expect(development.status,JSON.stringify(built)).toBe(200);expect(wires).toHaveLength(1);expect(built.outcome).toBe('complete');
 expect(sameArchitecturalPlan(root.v3Scene,JSON.parse(built.json).v3Scene)).toBe(true);
 expect(JSON.stringify(wires[0].input)).toContain('Approved plan (immutable)');
},20000);

it('persists infeasible intent as an editable plan, refuses exterior before provider use, and accepts explicit refinement',async()=>{
 const raw=relationshipGardenHome();Object.assign(raw.buildings[0].storeys[0].spaces[0],{size:{minWidth:99}});output=raw;
 const response=await post('design',JSON.stringify(BLANK_V3_SCENE)),body=await response.json();expect(response.status,JSON.stringify(body)).toBe(200);
 const root=JSON.parse(body.json);expect(root.v3Scene.metadata.roomLayoutDrafts).toHaveLength(1);expect(root.v3Scene.interior.rooms).toEqual([]);
 wires=[];const blocked=await post('elaborate',body.json);expect(blocked.status).toBe(409);expect((await blocked.json()).providerCalls).toBe(0);expect(wires).toEqual([]);
 const draft=root.v3Scene.metadata.roomLayoutDrafts[0];delete draft.spaces[0].size;
 const revised=reviseDraftRoomLayout(root.v3Scene,draft.storeyId,{spaces:draft.spaces,layout:draft.layout});expect(revised.ok,JSON.stringify(revised.findings)).toBe(true);
 expect(planConstructionBlockers(revised)).toEqual([]);
 output=roomPlanningExterior(relationshipGardenHome());const built=await post('elaborate',JSON.stringify({...root,v3Scene:revised.scene}));expect(built.status,JSON.stringify(await built.json())).toBe(200);expect(wires).toHaveLength(1);
});

it('retains the exact natural paid response through the real production design route without automatic repair',async()=>{
 const text=readFileSync(new URL('../../../../lib/v3/__tests__/fixtures/terra-estate-2026-10-22.response.json',import.meta.url),'utf8');output=JSON.parse(text);responseText=text;
 const response=await post('design',JSON.stringify(BLANK_V3_SCENE)),saved=await response.json();expect(response.status).toBe(200);
 expect(saved.recovery.rawResponse).toBe(text);expect(saved.recovery.sha256).toBe('65036c5f32b6c9b8be56fc6c57886715bb9bd469b2480fe938199f4427eb88ad');expect(wires).toHaveLength(1);
 const scene=JSON.parse(saved.json).v3Scene;expect(auditV3Interior(scene).filter(f=>['ROOM_OUTSIDE_HOST','ROOM_OVERLAP','ROOM_ADJACENCY_NO_SHARED_BOUNDARY'].includes(f.code))).toHaveLength(17);
});
