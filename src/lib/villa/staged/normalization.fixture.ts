/** OFFLINE ONLY authored downstream decisions for the actual retained Terra massing.
 * Stage 3–5 model calls have never occurred. This fixture is not used by any live route. */
import type {StageContext,StageNo} from './pipeline';
import {exteriorWalls,roofableBlocks} from './exterior';
import {outdoorKind} from './intentions';
const room=(id:string,block:string,type:string,area:number,priority='normal',facing='any')=>({id,block,type,name:id.replaceAll('_',' '),area,priority,facing});
const link=(a:string,b:string,kind='door')=>({a,b,kind});
export const retainedMassingProgramme={rooms:[room('entry_foyer','arrival_entry','foyer',30,'core','s'),room('living_room','social_main','living',90,'core'),room('dining_room','social_main','dining',60),room('kitchen_room','social_main','kitchen',66),room('private_hall','private_wing','hall',36,'flex'),...[1,2,3].map(n=>room(`bed_${n}`,'private_wing','bedroom',36)),...[1,2].map(n=>room(`bath_${n}`,'private_wing','bath',9))],connections:[link('entry_foyer','living_room','open'),link('living_room','dining_room','open'),link('dining_room','kitchen_room','open'),link('entry_foyer','private_hall'),...[1,2,3].map(n=>link('private_hall',`bed_${n}`)),link('bed_1','bath_1'),link('bed_2','bath_2')],stairs:[],intentions:['OFFLINE MOCK: interior programme on retained Terra massing']};
export function retainedMassingDownstream(stage:StageNo,ctx:StageContext):unknown{
 if(stage===3)return structuredClone(retainedMassingProgramme);
 if(stage===4)return {roofs:Object.fromEntries(ctx.draft.blocks.map(b=>[b.id.replaceAll('-','_'),{form:'gable',rise:b.id==='social-main'?2:1.2,overhang:.3,material:'timber',color:'#B65A36'}])),exterior:{facades:Object.fromEntries(ctx.draft.blocks.map(b=>[`${b.id.replaceAll('-','_')}:s`,'large-windows'])),doors:[{id:'main_entry',room:'entry_foyer',side:'s',kind:'main',width:1.2,t:.5}],entrance:{door:'main_entry',canopy:{depth:1,width:2.4,material:'timber'},court:{w:3,d:3}},verandas:[{id:'garden_veranda',block:'social_main',side:'s',from:-3,to:5.5,depth:4.5,columns:4,roofMaterial:'timber',deckMaterial:'limestone'}]}};
 if(stage===5)return {siteWork:{pool:{sourceIntent:'garden_pool',intentResolution:'The original 5 × 5 m pool intention is too small for the existing 8.2 × 7.4 m basin/deck assembly and touches the house. Keep the same pool intention and move this one assembly to x=8,z=10 for clear separation; original conceptual footprint remains recorded.',x:8,z:10,w:5,d:3,basinDepth:1.4},lawns:[{id:'garden_lawn',rect:{x:20,z:10,w:6,d:6},material:'sage'}],beds:[{id:'aromatic_bed',rect:{x:22,z:-16,w:4,d:2}}],trees:[{id:'sculptural_tree',x:23,z:-8,height:3,kind:'canopy'}],hedges:[],paths:[]},finishes:Object.fromEntries(ctx.draft.blocks.map(b=>[b.id.replaceAll('-','_'),{wall:'ivory',wallColor:'#F2ECDD'}]))};
 throw Error('Fixture supplies only authored offline Stages 3–5');
}

/** The same authored OFFLINE downstream programme, with Stage 4/5 in the automatic design-intent contracts (v2).
 * Identifiers are deliberately underscore-spelled to exercise canonicalization; choices come from measured walls. */
export function retainedMassingDownstreamV2(stage:StageNo,ctx:StageContext):unknown{
 const u=(id:string)=>id.replaceAll('-','_');
 if(stage===3)return structuredClone(retainedMassingProgramme);
 if(stage===4){
  const walls=exteriorWalls(ctx.draft),main=walls.find(w=>w.type==='foyer'&&w.level===0&&w.free>=2.4)!;
  const garden=walls.filter(w=>w.level===0&&['living','dining','bedroom'].includes(w.type)&&w.free>=2.1&&w.outside!=='garden / forecourt at ground level'||w.level===0&&w.type==='living'&&w.free>=2.1).slice(0,4);
  return {statement:'OFFLINE authored exterior for the retained Terra massing.',roofFinish:'terracotta',wallFinish:'cream-stucco',stone:'pale-limestone',timber:'teak',
   blockFinishes:ctx.draft.blocks.map(b=>({block:u(b.id),finish:b.id==='arrival-entry'?'stone':'stucco'})),
   roofs:roofableBlocks(ctx.draft).map(b=>({block:u(b.id),form:'hip',pitchDeg:b.id==='social-main'?26:22,eaves:'deep'})),
   facades:ctx.draft.blocks.map(b=>({block:u(b.id),side:'s',style:'large-windows'})),windowTrim:'stone-and-shutters',railing:'parapet',details:{plinth:true,cornice:true},
   entrance:{room:u(main.room),side:main.side,canopy:'deep',portal:true,court:'generous'},
   doors:garden.map(w=>({room:u(w.room),side:w.side,kind:'garden'})),
   verandas:ctx.draft.openSpaces.filter(o=>outdoorKind(o)==='veranda').map(o=>({openSpace:u(o.id),columns:'stone-piers',spacing:'generous',ceiling:'timber-beams',roof:'timber',deck:'limestone'})),intentions:[]};
 }
 if(stage===5)return {statement:'OFFLINE authored site design for the retained Terra massing.',pool:{scale:'plunge',anchor:'pool-intention',separation:'close',water:'turquoise'},terrace:{finish:'limestone',sunbeds:'two',social:'dining'},arrival:{finish:'limestone',character:'garden-court'},planting:{trees:'canopy',count:'six',stature:'medium',beds:'restrained',lawn:'garden-panels'},lighting:'arrival-and-garden',intentions:['Restrained planting around a limestone terrace.']};
 throw Error('Fixture supplies only authored offline Stages 3–5');
}
