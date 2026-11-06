import {readFileSync} from 'node:fs';
import {afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import {loadHouse} from './save';
import {checkVisualReviewProposal,prepareVisualReview,REVIEW_VIEWS,reviewCostBound,verifyReviewWire,visualReviewPreservationIssues,visualReviewSchema,type ReviewImage} from './visualReviewRequest';
import {strictSchemaIssues} from '../scene/strictSchema';

const path='docs/architecture/staged-villa/stage5-site';
const saved=loadHouse(readFileSync(`${path}/terra-stage5.save.json`,'utf8'));
const checkpoint=JSON.parse(readFileSync(`${path}/terra-stage5.checkpoint.json`,'utf8'));
const browser=JSON.parse(readFileSync(`${path}/terra-stage5-browser.json`,'utf8'));
const images:ReviewImage[]=REVIEW_VIEWS.map(view=>{const c=browser.captures.find((c:{view:string})=>c.view.toLowerCase()===view);return {view,png:readFileSync(`${path}/terra-stage5-${view}.png`),camera:c.camera,target:c.target};});
let packet:Awaited<ReturnType<typeof prepareVisualReview>>;
const categories=['beauty','proportions','roofs','facades','materials','entrance','pool','landscaping'];
// Software response-shape fixtures only. No edit operations are executed in this suite.
const review={summary:'OFFLINE response contract fixture, not AI judgment',assessments:categories.map(category=>({category,judgment:'Test observation only',views:['garden'],components:['roof:upper-bedroom-bar']})),weaknesses:[{priority:1,category:'roofs',responsibility:'architecture',views:['garden'],components:['roof:upper-bedroom-bar'],evidence:'Synthetic evidence used only to test contract boundaries'}],refinements:[{priority:1,weaknessPriority:1,targetComponent:'roof:upper-bedroom-bar',operation:{op:'set-roof',blocks:['upper-bedroom-bar'],roof:{...saved.spec.blocks.find(b=>b.id==='upper-bedroom-bar')!.roof,rise:2.4}},expectedVisualBenefit:'Hypothetical hierarchy improvement',acceptance:'Inspect silhouette in identical garden and aerial cameras; no accepted improvement claimed'}],noSupportedRefinementReason:null};
afterEach(()=>vi.unstubAllGlobals());
beforeAll(async()=>{vi.stubGlobal('fetch',()=>{throw Error('Network prohibited in offline packet tests');});packet=await prepareVisualReview(saved.spec,checkpoint.preservedPlanWarnings,images);});
describe('Exact Stage 5 visual-review request, no live call and no refinement execution',()=>{
 it('serializes through the installed Responses provider without invoking global fetch',()=>{
  expect(packet.endpoint).toBe('https://api.openai.com/v1/responses');expect(packet.transport).toEqual({localSerializations:1,providerRequests:0,credentialReads:0});
  expect(packet.wire.model).toBe('gpt-5.6-terra');expect(packet.wire.max_output_tokens).toBe(4000);expect(packet.wire.reasoning.effort).toBe('medium');
  expect(packet.wire.store).toBe(false);expect(packet.wire.service_tier).toBe('default');expect(packet.wire.truncation).toBe('disabled');
 });
 it('contains all four original PNG byte contents, high detail, in labelled order',()=>{
  expect(()=>verifyReviewWire(packet.wire,packet.imageManifest)).not.toThrow();
  const content=packet.wire.input.flatMap(m=>Array.isArray(m.content)?m.content:[]);
  expect(content.filter(p=>p.type==='input_image')).toHaveLength(4);
  expect(packet.imageManifest.map(i=>i.view)).toEqual(REVIEW_VIEWS);
  for(const im of packet.imageManifest)expect(im).toMatchObject({width:2400,height:1040});
  expect(content.filter(p=>p.type==='input_text').map(p=>p.text).join('\n')).toContain('VIEW: arrival');
 });
 it.each(['missing','path-only','reordered','wrong-detail','changed-model','changed-cap'])('rejects %s image/control corruption',mode=>{
  const body=structuredClone(packet.wire),user=body.input.find(m=>m.role==='user')!,parts=user.content as Exclude<typeof user.content,string>,indices=parts.flatMap((p,i)=>p.type==='input_image'?[i]:[]);
  if(mode==='missing')parts.splice(indices[0],1);
  if(mode==='path-only')parts[indices[0]].image_url='/private/local/arrival.png';
  if(mode==='reordered')[parts[indices[0]],parts[indices[1]]]=[parts[indices[1]],parts[indices[0]]];
  if(mode==='wrong-detail')parts[indices[0]].detail='low';
  if(mode==='changed-model')body.model='different-model';
  if(mode==='changed-cap')body.max_output_tokens=8000;
  expect(()=>verifyReviewWire(body,packet.imageManifest)).toThrow();
 });
 it('pins real source context and retains every programme warning without changing the source',()=>{
  expect(packet.context.provenance).toContain('actual live Terra Stage 5');expect(packet.context.currentElements).toBe(377);expect(packet.context.rooms).toHaveLength(23);
  expect(packet.context.rooms.filter(r=>r.type==='bedroom')).toHaveLength(4);expect(packet.context.rooms.filter(r=>r.type==='bath')).toHaveLength(5);
  expect(packet.context.retainedRoomPlanWarnings).toEqual(checkpoint.preservedPlanWarnings);
  expect(saved.scene.elements).toHaveLength(377);expect(saved.spec.blocks).toEqual(checkpoint.spec.blocks);
 });
 it('uses strict closed response objects and exact semantic ID enums',()=>{
  expect(strictSchemaIssues(packet.schema)).toEqual([]);expect(packet.wire.text.format.strict).toBe(true);
  expect(visualReviewSchema(saved.spec).safeParse(review).success).toBe(true);
  expect(checkVisualReviewProposal(saved.spec,review)).toEqual({valid:true,reasons:[],requiresBoundedExecutor:true});
  const bad=structuredClone(review);bad.refinements[0].targetComponent='roof:invented';expect(checkVisualReviewProposal(saved.spec,bad).valid).toBe(false);
 });
 it('accounts for image tokens separately from base64 transport bytes, with cache-write and output margins',()=>{
  expect(packet.cost.imageInputTokenBound).toBe(12000);expect(packet.cost.outputTokenBound).toBe(4000);expect(packet.cost.conservativeBoundUsd).toBeLessThanOrEqual(.20);
  expect(packet.cost.rates.cacheWriteMultiplier).toBe(1.25);expect(packet.cost.exactProviderTokenCount).toBe(false);expect(packet.cost.approved).toBe(false);
  const bloated=structuredClone(packet.wire);bloated.input.push({role:'user',content:'x'.repeat(100000)});expect(()=>reviewCostBound(bloated)).toThrow();
 });
 it('rejects image duplicates or incomplete image lists before serialization',async()=>{
  await expect(prepareVisualReview(saved.spec,[],images.slice(0,3))).rejects.toThrow(/four/);
  await expect(prepareVisualReview(saved.spec,[],images.map((im,i)=>i===1?{...im,png:images[0].png}:im))).rejects.toThrow(/Duplicate/);
 });
 it.each(['renderer-only','excess-roof-rise','changed-form','changed-eave','invented-operation','wrong-target','duplicated-assessment'])('rejects %s proposals without applying them',mode=>{
  const x=structuredClone(review);
  if(mode==='renderer-only')x.weaknesses[0].responsibility='renderer';
  if(mode==='excess-roof-rise')x.refinements[0].operation.roof.rise=4;
  if(mode==='changed-form')x.refinements[0].operation.roof.form='gable';
  if(mode==='changed-eave')x.refinements[0].operation.roof.overhang=1;
  if(mode==='invented-operation')Object.assign(x.refinements[0].operation,{op:'resize-room'});
  if(mode==='wrong-target')x.refinements[0].targetComponent='roof:entry-pavilion';
  if(mode==='duplicated-assessment')x.assessments[1].category=x.assessments[0].category;
  expect(checkVisualReviewProposal(saved.spec,x).valid).toBe(false);
 });
 it('permits an honest no-supported-edit response',()=>{
  expect(checkVisualReviewProposal(saved.spec,{...review,refinements:[],noSupportedRefinementReason:'No supported refinement materially improves the visible design.'})).toMatchObject({valid:true,requiresBoundedExecutor:false});
 });
 it('checks programme, circulation, stair, core identity and flat-site preservation without executing edits',()=>{
  const noEdit={...review,refinements:[],noSupportedRefinementReason:'No edit in this test.'};
  expect(visualReviewPreservationIssues(saved.spec,saved.spec,377,undefined,noEdit)).toEqual([]);
  for(const change of ['rooms','stairs','links','pool','massing']){
    const damaged=structuredClone(saved.spec);
    if(change==='rooms')damaged.blocks[0].plan={room:{id:'replacement',name:'replacement',type:'living'}};
    if(change==='stairs')damaged.stairs=[];
    if(change==='links')damaged.links=[];
    if(change==='pool')damaged.siteWork.pool!.w=10;
    if(change==='massing')damaged.blocks[0].cx+=1;
    expect(visualReviewPreservationIssues(saved.spec,damaged,377,undefined,noEdit)).not.toEqual([]);
  }
  expect(visualReviewPreservationIssues(saved.spec,saved.spec,401,undefined,noEdit)).not.toEqual([]);
  expect(visualReviewPreservationIssues(saved.spec,saved.spec,377,{},noEdit)).not.toEqual([]);
 });
});
