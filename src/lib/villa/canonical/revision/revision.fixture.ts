import {readFileSync} from 'node:fs';
import type {ArchitecturalPlan} from '../plan';
import {canonicalFixture} from '../fixture';
import {compositionFixture} from '../compositions.fixture';
/** MOCKS AND DEVELOPER FIXTURES ONLY. None of these is model output, and none is evidence that the model can
 * revise its own work; they exercise parsing, validation, comparison and persistence. */
export const MANSION_PATH='docs/architecture/canonical-roof-retrieval-2026-11-02/proposal.normalized.json';
export const mansionBytes=()=>readFileSync(MANSION_PATH);
/** The saved Terra proposal, byte for byte as parsed. */
export const mansionOriginal=():ArchitecturalPlan=>JSON.parse(mansionBytes().toString()).plan;
/** Mock A: a coordinate-only repair of the saved mansion (chain moved, openings re-keyed, eaves removed, site grown).
 * Physically valid, architecturally the same concept. It exists to prove that validity is not read as success. */
export function mansionCoordinateRepairMock():ArchitecturalPlan{
 const p=structuredClone(mansionOriginal()),portal=(id:string)=>p.portals.find(x=>x.id===id)!;
 p.spaces.find(s=>s.id==='kitchen')!.placement={relativeTo:'dining-room',side:'west',alignment:'start',gap:0};
 p.roofs.forEach(r=>{r.overhang=0;});p.site={...p.site,width:140,depth:120};p.levels[0].rise=.2;
 Object.assign(portal('dining-kitchen-opening'),{host:{space:'dining-room',side:'west' as const},alignment:'end' as const});
 portal('kitchen-pantry-door').alignment='end';portal('kitchen-laundry-door').alignment='start';
 portal('west-hall-suite-1-door').alignment='end';portal('west-hall-suite-3-door').alignment='start';
 Object.assign(portal('living-east-window'),{alignment:'start' as const,width:3});Object.assign(portal('dining-west-window'),{alignment:'start' as const,width:2.5});
 p.screens=p.screens!.filter(s=>s.id!=='living-timber-sun-screen');p.portals=p.portals.filter(x=>x.id!=='terrace-terrace-opening');
 return p;
}
/** Mock B: claims a repair but leaves the colliding chain untouched. */
export function mansionStillInvalidMock():ArchitecturalPlan{const p=structuredClone(mansionOriginal());p.roofs.forEach(r=>{r.overhang=0;});return p;}
const at=(relativeTo:string|null,side:ArchitecturalPlan['spaces'][number]['placement']['side'],alignment:'start'|'centre'|'end'='centre',gap=0)=>({relativeTo,side,alignment,gap});
type Room={id:string;w:number;d:number;h:number;pl:ReturnType<typeof at>;use?:string;outdoor?:boolean;mass?:string};
function house(id:string,thesis:string,rooms:Room[],portals:ArchitecturalPlan['portals'],roofs:ArchitecturalPlan['roofs'],arrival:string):ArchitecturalPlan{
 return {version:'architectural-plan-1',id,thesis,orientation:0,site:{width:80,depth:80,elevation:0,grade:0,fall:'z'},levels:[{id:'ground',above:null,rise:.2}],masses:[{id:'main',role:'principal'},{id:'wing',role:'secondary'}],
  spaces:rooms.map(r=>({id:r.id,mass:r.mass??'main',level:'ground',use:r.use??r.id,width:r.w,depth:r.d,height:r.h,outdoor:!!r.outdoor,placement:r.pl})),portals,stairs:[],arrival,roofs,terraces:[],pools:[],landscape:[],materials:{floor:'limestone',wall:'ivory',roof:'timber'},cameraViews:['Aerial','Arrival','Garden','Poolside']};
}
const door=(id:string,space:string,side:'south'|'east'|'north'|'west',to:string,width=1,alignment:'start'|'centre'|'end'='centre',mode:'door'|'open'|'window'='door',height=2.2,sill?:number):ArchitecturalPlan['portals'][number]=>({id,host:{space,side},to,alignment,width,height,mode,...(sill?{sill}:{})});
/** Valid and compiler-accepted, but deliberately ordinary: a hall flanked by six identical bedroom cells under identical flat roofs. */
export function weakRowHouse():ArchitecturalPlan{
 const rooms:Room[]=[{id:'hall',w:4,d:21,h:3.2,pl:at(null,'origin'),use:'entry hall and circulation spine'},{id:'forecourt',w:4,d:3,h:3.2,pl:at('hall','north'),outdoor:true,use:'arrival forecourt'},
  {id:'living',w:14,d:8,h:3.2,pl:at('hall','south'),use:'living room'},{id:'kitchen',w:5,d:6,h:3.2,pl:at('living','east','end'),use:'kitchen'}];
 const portals=[door('front-door','hall','north','forecourt',1.2),door('hall-living','living','north','hall',1.2),door('living-kitchen','kitchen','west','living',1.2),door('living-view','living','south','exterior',3,'centre','window',1.6,.8),door('kitchen-view','kitchen','east','exterior',2,'centre','window',1.2,.9)];
 const roofs:ArchitecturalPlan['roofs']=[{space:'living',form:'flat',rise:.2},{space:'kitchen',form:'flat',rise:.2},{space:'hall',form:'flat',rise:.2}];
 (['w','e'] as const).forEach(sd=>[1,2,3].forEach((n,i)=>{
  const id=`bed-${sd}${n}`;rooms.push({id,w:5,d:7,h:3.2,use:`bedroom ${sd==='w'?n:n+3}`,pl:at('hall',sd==='w'?'west':'east',(['start','centre','end'] as const)[i]),mass:'wing'});
  portals.push(door(`${id}-door`,id,sd==='w'?'east':'west','hall',1),door(`${id}-view`,id,sd==='w'?'west':'east','exterior',1.6,'centre','window',1.2,.9));roofs.push({space:id,form:'flat',rise:.2});
 }));
 return house('weak-row-house','Developer fixture: a spine hall with six identical bedroom cells under identical flat roofs.',rooms,portals,roofs,'forecourt');
}
/** Mock C: a different-concept redesign of the same programme (six bedrooms, living, kitchen, entry). Developer-authored. */
export function rowHouseRedesignMock():ArchitecturalPlan{
 const rooms:Room[]=[{id:'entry-hall',w:4,d:8,h:3.8,pl:at(null,'origin'),use:'entry hall'},{id:'forecourt',w:4,d:5,h:3,pl:at('entry-hall','west'),outdoor:true,use:'arrival forecourt'},
  {id:'gallery',w:3,d:18,h:3.6,pl:at('entry-hall','north'),use:'circulation gallery'},{id:'living',w:12,d:9,h:5.2,pl:at('entry-hall','south'),use:'living room'},{id:'kitchen',w:6,d:6,h:3.4,pl:at('living','east','end'),use:'kitchen',mass:'wing'},
  {id:'bed-1',w:6,d:5,h:3,pl:at('gallery','west','start'),use:'bedroom 1',mass:'wing'},{id:'bed-2',w:7,d:6,h:3.4,pl:at('bed-1','north','end'),use:'bedroom 2',mass:'wing'},{id:'bed-3',w:5,d:7,h:3,pl:at('bed-2','north','end'),use:'bedroom 3',mass:'wing'},
  {id:'bed-4',w:7,d:5,h:3.1,pl:at('gallery','east','start'),use:'bedroom 4',mass:'wing'},{id:'bed-5',w:6,d:6,h:3.5,pl:at('bed-4','north','start'),use:'bedroom 5',mass:'wing'},{id:'bed-6',w:8,d:7,h:3.2,pl:at('bed-5','north','start'),use:'bedroom 6',mass:'wing'}];
 const portals=[door('front-door','entry-hall','west','forecourt',1.3),door('entry-living','living','north','entry-hall',1.2,'centre','open'),door('entry-gallery','entry-hall','north','gallery',1.2),door('living-kitchen','kitchen','west','living',1.2),
  door('living-south','living','south','exterior',4,'centre','window',2.2,.4),door('living-west','living','west','exterior',3,'centre','window',2.2,.4),door('kitchen-view','kitchen','east','exterior',2,'centre','window',1.2,.9),door('gallery-end','gallery','north','exterior',1.6,'centre','window',2,.6)];
 const roofs:ArchitecturalPlan['roofs']=[{space:'entry-hall',form:'flat',rise:.3},{space:'gallery',form:'flat',rise:.22},{space:'living',form:'flat',rise:.4},{space:'kitchen',form:'flat',rise:.25}];
 ['bed-1','bed-2','bed-3'].forEach((id,i)=>{portals.push(door(`${id}-door`,id,'east','gallery',1),door(`${id}-view`,id,'west','exterior',1.8,'centre','window',1.2,.9));roofs.push({space:id,form:'flat',rise:[.2,.3,.25][i]});});
 ['bed-4','bed-5','bed-6'].forEach((id,i)=>{portals.push(door(`${id}-door`,id,'west','gallery',1),door(`${id}-view`,id,'east','exterior',1.8,'centre','window',1.2,.9));roofs.push({space:id,form:'flat',rise:[.35,.2,.28][i]});});
 const p=house('row-house-redesign-mock','Mock redesign: a tall living volume at the heart, a quiet gallery spine, and two bedroom wings of unequal rooms stepping in height and roof thickness.',rooms,portals,roofs,'forecourt');
 p.terraces=['forecourt'];return p;
}
/** A materially different compact two-level house with a stair (developer fixture), with and without an authored fault. */
export const compactTwoLevel=():ArchitecturalPlan=>compositionFixture('compact');
export function compactTwoLevelFaulty():ArchitecturalPlan{
 const p=canonicalFixture();p.id='compact-faulty';
 p.spaces.find(s=>s.id==='day-room')!.placement={relativeTo:'hall',side:'same',alignment:'start',gap:0};
 p.portals.push({id:'bad-window',host:{space:'hall',side:'east'},to:'exterior',alignment:'centre',width:1,height:1,mode:'window',sill:.9});
 return p;
}
/** The compact house with its fault corrected by changing only the two faulty entities (mock response). */
export function compactTwoLevelRepairMock():ArchitecturalPlan{
 const p=canonicalFixture();p.id='compact-faulty';return p;
}
