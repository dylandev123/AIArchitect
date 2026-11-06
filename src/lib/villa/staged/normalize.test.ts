import {expect,it} from 'vitest';
import {assertUniqueJsonKeys,normalizeStage,NormalizationError} from './normalize';
import {emptyDraft,runStagedGeneration} from './pipeline';
import {stageSchemas} from './spec';
import {readFileSync} from 'node:fs';
const evidence=JSON.parse(readFileSync('docs/architecture/automatic-house/first-automatic-live/evidence.json','utf8'));
const draft=()=>emptyDraft({width:60,depth:48});
it('replays the unmodified real Terra massing, records all six ID changes and builds valid editable geometry',async()=>{
 const raw=evidence.calls[1].raw,original=JSON.parse(raw);
 expect(stageSchemas[2].safeParse(original).success).toBe(false);
 const normalized=normalizeStage(2,original,draft());
 expect(normalized.changes).toHaveLength(6);expect(JSON.stringify(original)).toBe(raw);
 const result=await runStagedGeneration({designer:{label:'Recorded real Terra responses; offline replay',design:async stage=>({value:JSON.parse(evidence.calls[stage-1].raw),raw:evidence.calls[stage-1].raw}),correct:async()=>{throw Error('No retries');}},brief:evidence.run.source.input.brief,site:evidence.run.source.input.site,maxCorrectionsPerStage:0,stopAfter:2});
 expect(result.status,JSON.stringify(result.findings)).toBe('paused');expect(result.lastGood?.stage).toBe(2);expect(result.findings).toEqual([]);
 expect(result.checkpoints[1].normalizations).toEqual(normalized.changes);expect(result.calls[1].raw).toBe(raw);
 const spec=result.spec!;
 expect([...spec.blocks,...spec.openSpaces].map(b=>[b.cx,b.cz,b.w,b.d])).toEqual(original.blocks.map((b:{cx:number;cz:number;w:number;d:number})=>[b.cx,b.cz,b.w,b.d]));
 expect(spec.blocks[1].role).toBe(original.blocks[1].role);expect(spec.blocks[1].role.length).toBeGreaterThan(80);
 expect(result.scene!.elements).toHaveLength(6);expect(result.components!['mass-private-wing']).toBe('block:private-wing');
});
it('rejects duplicate or colliding IDs, and never changes the caller response',()=>{
 for(const ids of [['social_main','social-main'],['same','same']]){
  const input={blocks:ids.map(id=>({id}))},before=JSON.stringify(input);
  expect(()=>normalizeStage(2,input,draft())).toThrow(/duplicates or collides/);expect(JSON.stringify(input)).toBe(before);
 }
});
it('normalizes declarations, block references, connections and stairs together, rejecting unresolved references',()=>{
 const d=draft();d.blocks=[{id:'social-main'}] as typeof d.blocks;
 const input={rooms:[{id:'entry_room',block:'social_main'},{id:'bed_room',block:'social-main'}],connections:[{a:'entry_room',b:'bed_room'}],stairs:[{id:'main_stair',room:'entry_room',landing:'bed_room'}]};
 const n=normalizeStage(3,input,d).value;
 expect(n.rooms.map((r:{id:string})=>r.id)).toEqual(['entry-room','bed-room']);expect(n.connections).toEqual([{a:'entry-room',b:'bed-room'}]);expect(n.stairs).toEqual([{id:'main-stair',room:'entry-room',landing:'bed-room'}]);
 expect(()=>normalizeStage(3,{...input,connections:[{a:'entry_room',b:'missing'}]},d)).toThrow('Unresolved reference');
 expect(()=>normalizeStage(3,{...input,connections:[{a:'entry_room',b:'bed_room'},{a:'bed-room',b:'entry-room'}]},d)).toThrow('Duplicate or contradictory');
});
it('detects normalized record-key collisions instead of overwriting a design',()=>{
 const d=draft();d.blocks=[{id:'social-main',cx:0,cz:0,w:12,d:12,level:0,plan:{room:{id:'entry-room',name:'Entry',type:'foyer'}}}] as typeof d.blocks;
 expect(()=>normalizeStage(4,{roofs:{social_main:{form:'gable'},'social-main':{form:'flat'}}},d)).toThrow(NormalizationError);
});
it('normalizes legacy plan declarations/references, exterior identity references and typed landscape IDs',()=>{
 const d=draft();d.blocks=[{id:'social-main',cx:0,cz:0,w:12,d:12,level:0,plan:{room:{id:'entry-room',name:'Entry',type:'foyer'}}}] as typeof d.blocks;
 const legacy=normalizeStage(3,{plans:{social_main:{room:{id:'entry_room',name:'Entry',type:'foyer'}}},links:[],stairs:[]},d);
 expect(legacy.value.plans['social-main'].room.id).toBe('entry-room');
 const exterior=normalizeStage(4,{roofs:{social_main:{}},exterior:{facades:{'social_main:s':'solid'},doors:[{id:'main_door',room:'entry_room'}],entrance:{door:'main_door'},verandas:[{id:'garden_veranda',block:'social_main'}]}},d);
 expect(exterior.value.exterior.entrance.door).toBe('main-door');expect(exterior.value.exterior.facades).toEqual({'social-main:s':'solid'});
 const site=normalizeStage(5,{finishes:{social_main:{}},siteWork:{lawns:[{id:'main_garden'}],trees:[{id:'main_garden'}]}},d);
 expect(site.value.siteWork.lawns[0].id).toBe('main-garden');expect(site.changes).toHaveLength(3);
 expect(()=>normalizeStage(5,{siteWork:{trees:[{id:'main_garden'},{id:'main-garden'}]}},d)).toThrow('collides');
});
it('does not coerce enums, numbers or descriptive text; invalid physical plans remain rejected',async()=>{
 const input={blocks:[{id:'a_block',role:'Do_not_change_this',w:'12 m',level:'ground',open:'false'}]};
 const n=normalizeStage(2,input,draft());expect(n.value.blocks[0]).toEqual({...input.blocks[0],id:'a-block'});expect(stageSchemas[2].safeParse(n.value).success).toBe(false);
 const bad=JSON.parse(evidence.calls[1].raw);bad.blocks[1].cx=bad.blocks[0].cx;bad.blocks[1].cz=bad.blocks[0].cz;
 const r=await runStagedGeneration({designer:{label:'Synthetic physical conflict',design:async s=>({value:s===1?JSON.parse(evidence.calls[0].raw):bad}),correct:async()=>{throw Error('No corrections');}},brief:evidence.run.source.input.brief,site:evidence.run.source.input.site,maxCorrectionsPerStage:0,stopAfter:2});
 expect(r.status).toBe('failed');expect(r.lastGood?.stage).toBe(1);expect(r.findings.length).toBeGreaterThan(0);
});

it('rejects duplicate raw JSON keys, including escaped equivalents, before parsing can overwrite them',()=>{
 expect(()=>assertUniqueJsonKeys('{"roofs":{"a":{},"a":{}}}')).toThrow('Duplicate JSON object key');
 expect(()=>assertUniqueJsonKeys('{"a":1,"\\u0061":2}')).toThrow('Duplicate JSON object key');
 expect(()=>assertUniqueJsonKeys('{"a":{"same":1},"b":{"same":2},"text":"escaped \\" quotes {}"}')).not.toThrow();
});
it('records only the documented optional-null conversion and is idempotent',()=>{
 const original={palette:{roofColor:null},name:'Do_not_rewrite_descriptions'};
 const n=normalizeStage(1,original,draft());
 expect(n.value).toEqual({palette:{},name:'Do_not_rewrite_descriptions'});
 expect(n.changes).toEqual([{path:'palette.roofColor',from:null,to:'(omitted)',reason:'documented unspecified optional color'}]);
 expect(normalizeStage(1,n.value,draft()).changes).toEqual([]);expect(original.palette.roofColor).toBeNull();
});
