import {describe,it,expect} from 'vitest';
import {advancePromptRun,promptInput,type PromptRun} from './promptGeneration';
import {MOCK_BRIEFS,PromptMockDesigner} from './promptMocks';
import {allRooms} from './layout';
import {loadHouse} from './save';

describe('prompt-driven Studio stages (offline authored model doubles)',()=>{
 for(const [index,brief] of MOCK_BRIEFS.entries())it(`constructs distinct request ${index+1} from five stage answers`,async()=>{
  const run:PromptRun={input:promptInput.parse({brief})},d=new PromptMockDesigner(brief);
  let out;
  for(let stage=1;stage<=5;stage++){
   out=await advancePromptRun(run,d);
   expect(out.findings,JSON.stringify(out.findings)).toEqual([]);
   expect(out.stage).toBe(stage);
  }
  expect(out!.status).toBe('complete');
  expect(d.requests.map(r=>r.brief)).toEqual(Array(5).fill(brief));
  const h=loadHouse(out!.save!);
  expect(allRooms(h.spec).filter(r=>r.type==='bedroom')).toHaveLength([3,4,6][index]);
  expect(Math.max(...h.spec.blocks.map(b=>b.level))).toBe(index===1?1:0);
  expect(h.scene.terrain).toBeUndefined();
  expect(out!.calls).toBe(5);expect(out!.costUsd).toBe(0);
 });
});

describe('preservation and editable source',()=>{
 it('retains Stage 3 byte-for-byte when Stage 4 fails, without retries',async()=>{
  const run:PromptRun={input:promptInput.parse({brief:MOCK_BRIEFS[0]})},d=new PromptMockDesigner(MOCK_BRIEFS[0]);
  for(let i=0;i<3;i++)await advancePromptRun(run,d);
  const before=JSON.stringify(run.result!.scene);
  const fail={label:'offline failure',design:async()=>{throw Error('model unavailable');},correct:async()=>{throw Error('must not retry');}};
  const out=await advancePromptRun(run,fail);
  expect(out.status).toBe('failed');expect(out.stage).toBe(3);
  expect(JSON.stringify(out.scene)).toBe(before);
  expect(out.checkpoints.map(c=>c.stage)).toEqual([1,2,3]);
  expect(out.calls).toBe(4);
  await expect(advancePromptRun(run,d)).rejects.toThrow('run stopped');
 });
 it('produces different dimensions, roof language and materials; each source accepts an isolated finish edit',async()=>{
  const {runEdit}=await import('./edits');
  const outputs=[];
  for(const brief of MOCK_BRIEFS){
   const run:PromptRun={input:promptInput.parse({brief})},d=new PromptMockDesigner(brief);
   let out;for(let i=0;i<5;i++)out=await advancePromptRun(run,d);
   const h=loadHouse(out!.save!);outputs.push(h);
   const first=h.spec.blocks[0];
   const edited=await runEdit({spec:h.spec,scene:h.scene,components:h.components,instruction:'Change this block to sage.',planner:{label:'offline constrained edit',plan:async()=>({plan:{summary:'Sage finish',ops:[{op:'set-finish',block:first.id,wall:'sage'}]}})}});
   expect(edited.accepted,JSON.stringify(edited.findings)).toBe(true);
   expect(edited.spec.blocks[0].wall).toBe('sage');
   expect(loadHouse(out!.save!).spec.blocks[0].wall).toBe(first.wall);
   expect(()=>loadHouse(JSON.stringify({format:'staged-house-save-1',spec:edited.spec,scene:edited.scene,history:[]}))).not.toThrow();
  }
  expect(new Set(outputs.map(o=>JSON.stringify(o.spec.blocks.map(b=>[b.cx,b.cz,b.w,b.d,b.level])))).size).toBe(3);
  expect(outputs[0].spec.blocks.reduce((s,b)=>s+b.w*b.d,0)).toBeLessThan(outputs[2].spec.blocks.reduce((s,b)=>s+b.w*b.d,0));
  expect(outputs[1].spec.blocks.some(b=>b.roof.color==='#A04A2B')).toBe(true);
  expect(outputs[2].spec.blocks.every(b=>b.roof.form==='flat')).toBe(true);
  // Actual open courtyard: the two lower wings flank a north garden court with the covered loggia on its south edge.
  const court=outputs[1].spec;
  expect(court.exterior.verandas).toEqual([expect.objectContaining({id:'courtyard-loggia',block:'hall-wing',side:'n'})]);
  expect(court.blocks.filter(b=>b.level===0&&b.id.endsWith('-wing')&&b.id!=='hall-wing').map(b=>b.cx).sort((a,b)=>a-b)).toEqual([-10.5,10.5]);
  expect(court.siteWork.pool!.z).toBeLessThan(-2);
 });
});

it('does not reset model-call budgets on checkpoint resume and notifies failures',async()=>{
 const {runStagedGeneration}=await import('./pipeline');
 const d=new PromptMockDesigner(MOCK_BRIEFS[0]),input=promptInput.parse({brief:MOCK_BRIEFS[0]});
 const options={designer:d,brief:input.brief,site:input.site,maxCalls:2,maxCorrectionsPerStage:0};
 const one=await runStagedGeneration({...options,stopAfter:1});
 const two=await runStagedGeneration({...options,resumeFrom:one.checkpoints,stopAfter:2});
 const notified:number[]=[];
 const three=await runStagedGeneration({...options,resumeFrom:two.checkpoints,onCheckpoint:c=>{notified.push(c.stage);}});
 expect(three.status).toBe('failed');expect(three.findings[0].code).toBe('budget');expect(three.calls).toHaveLength(2);
 expect(three.lastGood?.stage).toBe(2);expect(notified).toEqual([3]);
});

it('validates explicit brief counts and rejects a model that changes the requested storeys',async()=>{
 const {promptRequirements}=await import('./promptGeneration');
 expect(promptRequirements('A two-storey Spanish house with 4 bedrooms and two bathrooms')).toEqual({bedrooms:4,bathrooms:2,storeys:2,pool:'optional'});
 expect(()=>promptRequirements('A house with three bedrooms or four bedrooms')).toThrow('Conflicting');
 // Phase 2: the single-storey sample's Stage 1 scale plan already contradicts a two-storey brief: stopped before massing.
 const early:PromptRun={input:promptInput.parse({brief:'A two-storey three-bedroom Caribbean house'})},first=await advancePromptRun(early,new PromptMockDesigner(MOCK_BRIEFS[0]));
 expect(first.status).toBe('failed');expect(first.findings.some(f=>f.code==='brief-vision-contradiction'&&f.subject==='scale')).toBe(true);
 // Without a scale plan (a vision written before Phase 2) the Stage 2 storey guard still rejects the single-storey massing.
 const mock=new PromptMockDesigner(MOCK_BRIEFS[0]),d={label:mock.label,correct:mock.correct.bind(mock),design:async(stage:1|2|3|4|5,ctx:Parameters<typeof mock.design>[1])=>{const r=await mock.design(stage,ctx);if(stage===1)delete (r.value as {vision:{scale?:unknown}}).vision.scale;return r;}};
 const run:PromptRun={input:promptInput.parse({brief:'A two-storey three-bedroom Caribbean house'})};
 await advancePromptRun(run,d);
 const out=await advancePromptRun(run,d);
 expect(out.status).toBe('failed');expect(out.findings[0].code).toBe('brief-storeys');expect(out.stage).toBe(1);
});

it('reads common count phrasing, additive bedrooms, half baths, floors and explicit pool exclusions', async () => {
 const {promptRequirements}=await import('./requirements');
 expect(promptRequirements('A 3-bed bungalow with 2 baths and no swimming pool')).toEqual({bedrooms:3,bathrooms:2,storeys:1,pool:'excluded'});
 expect(promptRequirements('Bedrooms: 5, bathrooms: 3, two floors, lap pool')).toEqual({bedrooms:5,bathrooms:3,storeys:2,pool:'required'});
 expect(promptRequirements('A master suite and two guest bedrooms, 2.5 bathrooms')).toMatchObject({bedrooms:3,bathrooms:2,pool:'optional'});
 expect(promptRequirements('Four bedroom family home, double-storey, with a pool table room')).toMatchObject({bedrooms:4,storeys:2,pool:'optional'});
 expect(()=>promptRequirements('Three bedrooms and a pool. No swimming pool.')).toThrow('Conflicting pool');
 expect(()=>promptRequirements('A single-storey house on two floors with three bedrooms')).toThrow('Conflicting storey');
});
