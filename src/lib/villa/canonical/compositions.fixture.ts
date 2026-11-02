import { canonicalFixture } from './fixture';
import type { ArchitecturalPlan } from './plan';
type Side=ArchitecturalPlan['spaces'][number]['placement']['side'];
const place=(relativeTo:string|null,side:Side,alignment:'start'|'centre'|'end'='start',gap=0)=>({relativeTo,side,alignment,gap});
/** Developer-authored capability studies. No AI output or aesthetic success claim. */
export function compositionFixture(name:'compact'|'waterfront'|'courtyard'):ArchitecturalPlan{
 if(name==='compact'){
  const p=canonicalFixture();p.id='compact-family';p.pools=[];p.landscape=[];
  p.roofs=p.roofs.map(r=>({...r,rise:.22}));
  p.portals.push({id:'living-window',host:{space:'day-room',side:'east'},to:'exterior',alignment:'centre',width:3,height:1.6,sill:.8,mode:'window'});
  p.screens=[{id:'living-shade',space:'day-room',side:'east',alignment:'centre',width:3.4,height:2,sill:.5,standOff:.6,depth:.14,panels:15,material:'timber'}];
  return p;
 }
 const p=canonicalFixture();p.id=`${name}-study`;p.site={width:120,depth:120,elevation:0,grade:0,fall:'z'};p.spaces=[];p.portals=[];p.stairs=[];p.roofs=[];p.pools=[];p.landscape=[];p.terraces=[];
 const room=(id:string,w:number,d:number,relativeTo:string|null,side:Side,options:{level?:string;height?:number;outdoor?:boolean;alignment?:'start'|'centre'|'end';material?:'ivory'|'limestone'|'timber'}={})=>{
  p.spaces.push({id,mass:options.level==='upper'?'upper-mass':'base-mass',level:options.level??'ground',use:id,width:w,depth:d,height:options.height??3.2,outdoor:options.outdoor??false,placement:place(relativeTo,side,options.alignment),facadeMaterial:options.material});
 };
 const portal=(id:string,space:string,side:'south'|'north'|'east'|'west',to:string,width:number,alignment:'start'|'centre'|'end'='centre',mode:'door'|'open'|'window'='door',height=2.5,sill=0)=>p.portals.push({id,host:{space,side},to,width,height,alignment,mode,sill});
 if(name==='waterfront'){
  p.thesis='Developer waterfront study: tall arrival/stair spine, offset sleeping volume, lower living wing, waterfront veranda and lap pool.';
  p.levels[1].rise=4.2;
  room('stair-hall',5,12,null,'origin',{height:4.2});room('salon',12,12,'stair-hall','east',{height:4.2,material:'limestone'});
  room('guest-wing',7,7,'stair-hall','west',{height:4.2,alignment:'end',material:'timber'});
  room('arrival',5,4,'stair-hall','south',{outdoor:true});p.arrival='arrival';
  room('upper-gallery',5,12,'stair-hall','same',{level:'upper',height:3.6});
  room('master-suite',7,7,'guest-wing','same',{level:'upper',height:3.2,material:'limestone'});
  room('veranda',12,4,'salon','north',{height:3,outdoor:true});p.terraces=['veranda'];
  portal('estate-entry','stair-hall','south','arrival',2.8,'centre','door',2.9);
  portal('salon-passage','stair-hall','east','salon',2,'end','open');
  portal('guest-passage','stair-hall','west','guest-wing',1.2,'start');
  portal('suite-passage','upper-gallery','west','master-suite',1.4,'start');
  portal('garden-sliders','salon','north','veranda',7,'centre','door',3.2);
  portal('salon-east-a','salon','east','exterior',3,'start','window',2.6,.8);
  portal('salon-east-b','salon','east','exterior',3,'end','window',2.6,.8);
  portal('suite-view','master-suite','north','exterior',4,'centre','window',2,.7);
  portal('guest-north-view','guest-wing','north','exterior',4,'centre','window',2.4,.8);
  portal('guest-front-view','guest-wing','south','exterior',3.5,'centre','window',2.4,.8);
  portal('gallery-view','upper-gallery','north','exterior',3,'centre','window',2.3,.7);
  p.stairs=[{id:'estate-stair',lower:'stair-hall',upper:'upper-gallery',width:1.5,run:6.3,landing:1.3,headroom:2.2}];
  p.roofs=[{space:'salon',form:'flat',rise:.25},{space:'upper-gallery',form:'flat',rise:.25,overhang:.4},{space:'master-suite',form:'flat',rise:.25},{space:'veranda',form:'flat',rise:.2},{space:'arrival',form:'flat',rise:.22}];
  p.pools=[{id:'lap-pool',placement:place('veranda','north','centre',1),width:12,depth:4,waterDepth:1.4,level:'ground'}];
  p.screens=[{id:'salon-sun-filter',space:'salon',side:'east',alignment:'centre',width:10,height:3.5,sill:.3,standOff:.7,depth:.15,panels:32,material:'bronze'}];
 }else{
  p.thesis='Developer asymmetric courtyard study: unequal wings around an open garden, separate hip and flat roof sections, shaded veranda.';
  p.levels=p.levels.slice(0,1);
  room('gallery',14,4,null,'origin',{height:3.8});
  room('west-wing',4,9,'gallery','north',{height:3,material:'timber'});
  room('east-wing',5,7,'gallery','north',{height:3.2,alignment:'end',material:'limestone'});
  room('arrival',4,3,'gallery','south',{outdoor:true,alignment:'centre'});p.arrival='arrival';
  room('court',5,7,'west-wing','east',{outdoor:true,height:2.7});p.terraces=['court'];
  portal('court-entry','gallery','south','arrival',2.5,'centre','door',2.8);
  portal('west-door','gallery','north','west-wing',1.2,'end');
  portal('east-door','gallery','north','east-wing',1.5,'start');
  portal('west-court','west-wing','east','court',3,'centre');
  portal('east-court','east-wing','west','court',3,'centre');
  portal('gallery-court','gallery','north','court',3);
  portal('west-window','west-wing','west','exterior',3,'centre','window',1.6,.8);
  p.roofs=[{space:'gallery',form:'hip',rise:1.5,overhang:.35},{space:'west-wing',form:'flat',rise:.2},{space:'east-wing',form:'flat',rise:.22}];
  p.landscape=[{id:'garden-bed',kind:'bed',placement:place('court','north','start',2),width:5,depth:3}];
 }
 return p;
}
