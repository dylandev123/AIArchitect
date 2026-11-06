/** Explicit OFFLINE model doubles: developer-authored stage answers for three labelled sample briefs.
 * They are NOT AI design evidence. Stages 4-5 choose only from what the measured requests offer (exactly what
 * Terra receives); software then derives and validates all geometry. No provider, credential or file access. */
import type {Designer, StageContext, StageNo} from './pipeline';
import type {Programme, ProgRoom} from './programme';
import type {ExteriorDesignV2} from './exterior';
import type {SiteDesignV2} from './siteContract';
import type {Side} from './spec';
import {exteriorWalls, roofableBlocks} from './exterior';
import {emptyDraft} from './pipeline';
import {outdoorKind} from './intentions';
import {promptRequirements} from './promptGeneration';

export {MOCK_BRIEFS} from './promptExamples';
import {MOCK_BRIEFS} from './promptExamples';
const room=(id:string,block:string,type:ProgRoom['type'],area:number,priority:ProgRoom['priority']='normal',facing:ProgRoom['facing']='any'):ProgRoom=>({id,block,type,name:id.replace(/-/g,' '),area,priority,facing});
const door=(a:string,b:string)=>({a,b,kind:'door' as const});
const open=(a:string,b:string)=>({a,b,kind:'open' as const});
const PRIMARY=new Set(['living-pavilion','sleeping-bar']);
const block=(id:string,role:string,cx:number,cz:number,w:number,d:number,level:0|1=0,isOpen=false)=>({id,role,cx,cz,w,d,level,open:isOpen,height:'standard' as const,rank:(PRIMARY.has(id)?'primary':'secondary') as 'primary'|'secondary'});
const vision=(v:Record<string,unknown>)=>({briefConstraints:[],focalPoints:['The garden-facing living rooms'],...v});
/** Structured visions matching what each sample massing actually builds (offline doubles, not AI evidence). */
const VISION:Record<MockKind,object>={
 caribbean:vision({style:'Contemporary Caribbean',character:'Low, shaded and relaxed',ambition:'comfortable',ambitionEvidence:'a compact single-storey home',composition:'linear-bar',compositionIntent:'A living pavilion and a bedroom wing in one line behind a full-width veranda.',primaryVolume:'The living pavilion under the main hip roof',heightStrategy:'uniform',roofStrategy:'primary-crown-with-lower-wings',entranceConcept:'sheltered-porch',signatureFeatures:[{feature:'covered-veranda',intent:'Deep shade across the living rooms.'}],briefConstraints:['single storey','hip roof'],scale:{footprintM2:280,grossFloorAreaM2:280,levels:1,wings:2,principalSpaces:[{name:'Living pavilion',kind:'living',approxAreaM2:52,height:'standard'}],scaleEvidence:'OFFLINE MOCK: matches the sample massing'}}),
 courtyard:vision({style:'Mediterranean courtyard villa',character:'Warm, enclosed and calm',ambition:'refined',ambitionEvidence:'a two-storey courtyard villa',composition:'u-courtyard',compositionIntent:'Three wings embrace a north garden courtyard; an upper sleeping bar crowns the hall wing.',primaryVolume:'The upper sleeping bar crowning the hall wing',heightStrategy:'pronounced-hierarchy',roofStrategy:'primary-crown-with-lower-wings',entranceConcept:'sheltered-porch',signatureFeatures:[{feature:'upper-storey-bar',intent:'A crowning sleeping storey.'},{feature:'courtyard',intent:'A garden room held by three wings.'},{feature:'loggia',intent:'A shaded edge to the court.'}],briefConstraints:['two storeys'],scale:{footprintM2:350,grossFloorAreaM2:476,levels:2,wings:3,principalSpaces:[{name:'Courtyard living room',kind:'living',approxAreaM2:62,height:'standard'}],scaleEvidence:'OFFLINE MOCK: matches the sample massing'}}),
 estate:vision({style:'Contemporary estate',character:'Long, calm and horizontal',ambition:'luxury',ambitionEvidence:'a larger multi-wing estate',composition:'central-hall-with-wings',compositionIntent:'A living pavilion between two bedroom wings, linked by an entry spine.',primaryVolume:'The glass-walled living pavilion',heightStrategy:'uniform',roofStrategy:'flat-planes',entranceConcept:'recessed-portal',signatureFeatures:[{feature:'covered-veranda',intent:'A garden loggia off the pavilion.'},{feature:'framed-garden-view',intent:'The pavilion frames the east garden.'}],briefConstraints:['single storey','flat roofs'],scale:{footprintM2:560,grossFloorAreaM2:560,levels:1,wings:4,principalSpaces:[{name:'Glass living pavilion',kind:'living',approxAreaM2:120,height:'standard'}],scaleEvidence:'OFFLINE MOCK: matches the sample massing'}}),
};
type MockKind='caribbean'|'courtyard'|'estate';
function kindFor(brief:string):MockKind {
 // Exact sample requests only. Other prompts must never silently become a template.
 const index=MOCK_BRIEFS.indexOf(brief as typeof MOCK_BRIEFS[number]);
 if(index<0)throw Error('Offline mock supports only the three labelled sample descriptions. Custom descriptions require secure live execution, which is disabled.');
 return (['caribbean','courtyard','estate'] as const)[index];
}

const DIRECTION:Record<MockKind,object>={
 caribbean:{name:'OFFLINE MOCK: Sea-Grape Veranda House',concept:'A low, deep-eaved island house: one long living pavilion and a quieter bedroom wing form an L around a shaded south garden with a small pool.',hierarchy:['Living pavilion under the main hip roof','Bedroom wing as a lower secondary mass','Full-width garden veranda'],roofLanguage:'Terracotta clay hip roofs with deep shading eaves; the pavilion roof is the crown.',entrance:'A modest covered north entrance into a bright foyer.',outdoorLiving:'A deep timber-beamed veranda across the living rooms opening to a pool terrace.',landscape:'Palms and layered tropical borders around an open lawn.',palette:{walls:'ivory',accent:'timber',roof:'timber',roofColor:null,deck:'limestone'}},
 courtyard:{name:'OFFLINE MOCK: Casa del Patio',concept:'Two stucco wings flank a north-facing garden courtyard; an upper sleeping bar crowns the central hall wing and a loggia frames the court.',hierarchy:['Upper sleeping bar as the crowning mass','Single-storey side wings embracing the court','Arcaded loggia on the courtyard'],roofLanguage:'Low-pitched terracotta hip roofs; the upper bar highest, the wings lower.',entrance:'A sheltered south door with a deep canopy into a stair hall.',outdoorLiving:'A loggia and pool in the courtyard garden between the wings.',landscape:'Broad shade trees, restrained beds and clipped hedges.',palette:{walls:'ivory',accent:'limestone',roof:'timber',roofColor:null,deck:'limestone'}},
 estate:{name:'OFFLINE MOCK: Long Meadow Pavilions',concept:'A glass living pavilion between two long bedroom wings, linked by an entry spine; flat planes and deep shade toward the east garden.',hierarchy:['Glass living pavilion as the focal volume','Two calm bedroom wings','Entry spine and garden loggia'],roofLanguage:'Flat stone-capped roof planes with deep overhangs over glass.',entrance:'A recessed west entrance into a gallery-like foyer.',outdoorLiving:'A covered loggia off the pavilion, a lap pool and a separate sun terrace.',landscape:'Mixed palms and canopy trees, layered beds and open lawns.',palette:{walls:'limestone',accent:'bronze',roof:'bronze',roofColor:null,deck:'limestone'}},
};
// Site 60 x 48 m: x -30..30 (east +), z -24..24 (south +).
const MASSING:Record<MockKind,ReturnType<typeof block>[]>={
 caribbean:[block('living-pavilion','Main living pavilion with kitchen, dining and principal suite',0,-2,20,10),block('bedroom-wing','Lower bedroom wing',-14,-2,8,10),
  block('garden-veranda','Covered garden veranda along the living pavilion',2,4.75,16,3.5,0,true),block('pool-reservation','Pool reservation in the south garden off the bedroom wing',-14,6.7,9.2,7.4,0,true)],
 courtyard:[block('hall-wing','Central hall wing with foyer, living and stair',0,4,14,9),block('kitchen-wing','East kitchen wing',10.5,0.5,7,16),block('study-wing','West study and guest wing',-10.5,0.5,7,16),
  block('sleeping-bar','Upper sleeping bar over the hall wing',0,4,14,9,1),block('courtyard-loggia','Loggia facing the courtyard garden',0,-2,14,3,0,true)],
 estate:[block('living-pavilion','Glass-walled living pavilion',3,0,16,14),block('entry-spine','Entry spine linking the wings',-9,0,8,14),block('north-wing','North bedroom wing',-13,-10.5,16,7),block('south-wing','South bedroom wing',-13,10.5,16,7),
  block('garden-loggia','Covered garden loggia east of the pavilion',13,0,4,14,0,true),block('sun-terrace','Sun terrace beside the north wing',-2,-10.5,6,7,0,true)],
};
function programme(k:MockKind):Programme{
 if(k==='caribbean')return {rooms:[
  room('foyer','living-pavilion','foyer',12,'core','n'),room('living','living-pavilion','living',52,'core','s'),room('dining','living-pavilion','dining',28,'normal','s'),room('kitchen','living-pavilion','kitchen',26,'normal','n'),
  room('main-suite','living-pavilion','bedroom',30,'core','s'),room('main-bath','living-pavilion','bath',10),room('pavilion-hall','living-pavilion','hall',10,'flex'),
  room('wing-hall','bedroom-wing','hall',14,'flex'),room('bedroom-two','bedroom-wing','bedroom',22,'core','w'),room('bedroom-three','bedroom-wing','bedroom',22,'core','s'),room('shared-bath','bedroom-wing','bath',8)],
  connections:[open('foyer','living'),open('living','dining'),open('dining','kitchen'),door('foyer','pavilion-hall'),door('pavilion-hall','main-suite'),door('main-suite','main-bath'),door('pavilion-hall','wing-hall'),door('wing-hall','bedroom-two'),door('wing-hall','bedroom-three'),door('wing-hall','shared-bath')],
  stairs:[],intentions:['Living rooms open to the south veranda and pool.','Bedrooms grouped off two short halls for privacy.']};
 if(k==='courtyard')return {rooms:[
  room('foyer','hall-wing','foyer',20,'core','s'),room('living','hall-wing','living',62,'core','n'),room('stair-hall','hall-wing','stair',22,'core'),
  room('kitchen','kitchen-wing','kitchen',40,'core','w'),room('dining','kitchen-wing','dining',44,'normal','n'),room('pantry-bath','kitchen-wing','bath',8),room('kitchen-hall','kitchen-wing','hall',20,'flex'),
  room('study','study-wing','lounge',36,'normal','n'),room('guest-room','study-wing','bedroom',40,'core','w'),room('guest-bath','study-wing','bath',10),room('study-hall','study-wing','hall',26,'flex'),
  room('landing','sleeping-bar','gallery',26,'flex'),room('main-bedroom','sleeping-bar','bedroom',30,'core','n'),room('bedroom-two','sleeping-bar','bedroom',22,'core','s'),room('bedroom-three','sleeping-bar','bedroom',22,'core','s'),room('upper-bath','sleeping-bar','bath',12)],
  connections:[open('foyer','living'),door('living','stair-hall'),door('living','kitchen-hall'),door('kitchen-hall','kitchen'),open('kitchen','dining'),door('kitchen-hall','pantry-bath'),door('living','study-hall'),door('study-hall','study'),door('study-hall','guest-room'),door('guest-room','guest-bath'),
   door('landing','main-bedroom'),door('landing','bedroom-two'),door('landing','bedroom-three'),door('landing','upper-bath')],
  stairs:[{id:'main-stair',room:'stair-hall',landing:'landing'}],intentions:['Every principal room looks into the courtyard.','The stair hall gathers the house beside the entrance.']};
 return {rooms:[
  room('foyer','entry-spine','foyer',40,'core','w'),room('powder-room','entry-spine','bath',14),room('spine-hall','entry-spine','gallery',56,'flex'),
  room('living','living-pavilion','living',112,'core','e'),room('dining','living-pavilion','dining',56,'normal','n'),room('kitchen','living-pavilion','kitchen',56,'normal','s'),
  ...(['north','south'] as const).flatMap(w=>{const facing=w==='north'?'n':'s';return [room(`${w}-gallery`,`${w}-wing`,'gallery',24,'flex'),room(`${w}-bedroom-one`,`${w}-wing`,'bedroom',24,'core',facing),room(`${w}-bedroom-two`,`${w}-wing`,'bedroom',22,'core',facing),room(`${w}-bedroom-three`,`${w}-wing`,'bedroom',22,'core',facing),room(`${w}-bath-one`,`${w}-wing`,'bath',10),room(`${w}-bath-two`,`${w}-wing`,'bath',10)];})],
  connections:[door('foyer','powder-room'),open('foyer','spine-hall'),open('spine-hall','dining'),open('dining','living'),open('living','kitchen'),
   ...(['north','south'] as const).flatMap(w=>[door('spine-hall',`${w}-gallery`),door(`${w}-gallery`,`${w}-bedroom-one`),door(`${w}-gallery`,`${w}-bedroom-two`),door(`${w}-gallery`,`${w}-bedroom-three`),door(`${w}-bedroom-one`,`${w}-bath-one`),door(`${w}-gallery`,`${w}-bath-two`)])],
  stairs:[],intentions:['Bedrooms sit in two quiet wings away from the pavilion.','The pavilion opens fully to the east garden loggia.']};
}
const GARDEN:Record<MockKind,Side>={caribbean:'s',courtyard:'n',estate:'e'};
const ENTRY:Record<MockKind,Side>={caribbean:'n',courtyard:'s',estate:'w'};
/** Mirrors a designer reading the measured request: chooses among listed walls, never invents geometry. */
function exterior(k:MockKind,ctx:StageContext):ExteriorDesignV2{
 const spec=ctx.draft,walls=exteriorWalls(spec),g=GARDEN[k];
 const main=walls.find(w=>w.type==='foyer'&&w.level===0&&w.side===ENTRY[k]&&w.free>=2.4)??walls.find(w=>w.type==='foyer'&&w.level===0&&w.free>=2.4);
 if(!main)throw Error('Mock: the measured foyer has no usable exterior wall');
 const garden=walls.filter(w=>w.level===0&&w.side===g&&w.free>=2.1&&['living','dining','kitchen','bedroom','lounge'].includes(w.type)).slice(0,5).map(w=>({room:w.room,side:w.side,kind:'garden' as const}));
 const terrace=walls.filter(w=>w.level===1&&w.free>=2.1&&w.outside.startsWith('roof terrace')).slice(0,2).map(w=>({room:w.room,side:w.side,kind:'terrace' as const}));
 const roofs=roofableBlocks(spec).map(b=>({block:b.id,form:(k==='estate'?'flat':'hip') as 'flat'|'hip',pitchDeg:k==='caribbean'?(b.id==='living-pavilion'?26:22):b.level?24:20,eaves:(k==='caribbean'?'very-deep':'deep') as 'very-deep'|'deep'}));
 const covered=spec.openSpaces.filter(o=>outdoorKind(o)==='veranda');
 return {statement:`OFFLINE MOCK exterior for ${k}.`,roofFinish:k==='estate'?'slate-grey':k==='courtyard'?'aged-terracotta':'terracotta',wallFinish:k==='courtyard'?'sand-stucco':'warm-white-stucco',stone:k==='estate'?'pale-limestone':'coral-stone',timber:k==='estate'?'dark-walnut':'teak',
  blockFinishes:spec.blocks.map(b=>({block:b.id,finish:(k==='estate'&&b.id.endsWith('-wing')?'stone':k==='courtyard'&&b.id==='kitchen-wing'?'stone':'stucco') as 'stone'|'stucco'})),
  roofs,facades:[...spec.blocks.filter(b=>b.level===0).map(b=>({block:b.id,side:g,style:(k==='estate'&&b.id==='living-pavilion'?'glass-wall':'large-windows') as 'glass-wall'|'large-windows'})),...spec.blocks.map(b=>({block:b.id,side:ENTRY[k],style:'punched' as const}))],
  windowTrim:k==='caribbean'?'stone-and-shutters':k==='courtyard'?'stone-surrounds':'plain',railing:k==='estate'?'glass':'parapet',details:{plinth:k!=='estate',cornice:k!=='estate'},
  entrance:{room:main.room,side:main.side,canopy:k==='courtyard'?'deep':'shallow',portal:k!=='estate',court:k==='caribbean'?'compact':'generous'},
  doors:[...garden,...terrace].slice(0,7),
  verandas:covered.map(o=>({openSpace:o.id,columns:k==='estate'?'slender-bronze':k==='courtyard'?'stone-piers':'timber-posts',spacing:k==='courtyard'?'tight':'generous',ceiling:k==='estate'?'plain-slab':'timber-beams',roof:k==='estate'?'limestone':'timber',deck:k==='caribbean'?'timber':'limestone'})),
  intentions:['Generous glazing toward the garden; calmer walls toward arrival.']};
}
const SITE:Record<MockKind,SiteDesignV2>={
 caribbean:{statement:'OFFLINE MOCK: palms, layered borders and a plunge pool on the reserved garden pad.',pool:{scale:'plunge',anchor:'pool-intention',separation:'close',water:'turquoise'},terrace:{finish:'limestone',sunbeds:'two',social:'dining'},arrival:{finish:'warm-paving',character:'tree-avenue'},planting:{trees:'palm',count:'eight',stature:'varied-tall',beds:'layered',lawn:'garden-panels'},lighting:'arrival-and-garden',intentions:['Palms frame the arrival drive.']},
 courtyard:{statement:'OFFLINE MOCK: a courtyard pool framed by shade trees and clipped hedges.',pool:{scale:'intimate',anchor:'veranda',separation:'close',water:'deep-jade'},terrace:{finish:'warm-paving',sunbeds:'two',social:'dining-and-lounge'},arrival:{finish:'limestone',character:'garden-court'},planting:{trees:'canopy',count:'six',stature:'medium',beds:'restrained',lawn:'garden-panels'},lighting:'arrival-and-garden',intentions:['Shade trees soften the courtyard edges.']},
 estate:{statement:'OFFLINE MOCK: a long lap pool parallel to the pavilion with mixed planting.',pool:{scale:'lap',anchor:'veranda',separation:'promenade',water:'turquoise'},terrace:{finish:'limestone',sunbeds:'four',social:'dining-and-lounge'},arrival:{finish:'limestone',character:'tree-avenue'},planting:{trees:'mixed',count:'ten',stature:'varied-tall',beds:'layered',lawn:'open-lawn'},lighting:'arrival-and-garden',intentions:['A tree-lined drive announces the entry spine.']},
};

export class PromptMockDesigner implements Designer {
 readonly label='OFFLINE MOCK: authored stage responses, zero provider calls';
 readonly requests:{stage:StageNo;brief:string}[]=[];
 private kind:MockKind;
 constructor(brief:string){this.kind=kindFor(brief);}
 async design(stage:StageNo,ctx:StageContext){
  this.requests.push({stage,brief:ctx.brief});
  const k=this.kind;
  const value:unknown=stage===1?{...emptyDraft(ctx.site).direction,...DIRECTION[k],vision:VISION[k]}:stage===2?{blocks:MASSING[k]}:stage===3?programme(k):stage===4?exterior(k,ctx):SITE[k];
  return {value:structuredClone(value),usage:{model:'offline-mock',inputTokens:0,outputTokens:0,costUsd:0}};
 }
 async correct():Promise<never>{throw Error('No mock retries');}
}
export function mockDesignerFor(brief:string){promptRequirements(brief);return new PromptMockDesigner(brief);}
