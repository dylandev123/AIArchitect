/** Offline developer studies only. Never imported by provider requests. */
import {applySceneOperations,elementSchema,type ArchitecturalScene,type SceneElement,type SceneOperation} from './model';
import type {ProfileGeometry} from './profileGeometry';
type V=[number,number,number];
export type FreedomStudy='angular'|'flowing'|'estate';
export function profileFreedomStudy(study:FreedomStudy){
 const elements:SceneElement[]=[];
 const add=(id:string,kind:SceneElement['kind'],at:V,size:V,extra:Partial<SceneElement>={})=>{elements.push(elementSchema.parse({id,label:id,kind,at,size,...extra}));};
 const polygon=(id:string,kind:SceneElement['kind'],points:number[][],y:number,h:number,extra:Partial<SceneElement>={})=>{
  const lo=[0,1].map(i=>Math.min(...points.map(p=>p[i]))),hi=[0,1].map(i=>Math.max(...points.map(p=>p[i])));
  add(id,kind,[(lo[0]+hi[0])/2,y,(lo[1]+hi[1])/2],[hi[0]-lo[0],h,hi[1]-lo[1]],{geometry:{type:'extrusion',axis:'y',outline:points.map(p=>p.map((v,i)=>(v-lo[i])/(hi[i]-lo[i])-.5)),holes:[]},...extra});
 };
 const perimeter=(prefix:string,p:number[][],base:number,height:number)=>p.forEach((a,i)=>{const b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1];add(`${prefix}-${i}`,i%3===0?'wall':'glazing',[(a[0]+b[0])/2,base+height/2,(a[1]+b[1])/2],[Math.hypot(dx,dz),height,i%3===0?.24:.08],{rotation:-Math.atan2(dz,dx),material:i%3===0?'limestone':'bronze'});});
 const arc=(id:string,kind:SceneElement['kind'],cx:number,cz:number,rx:number,rz:number,y:number,h:number,start:number,sweep:number,innerRatio:number,extra:Partial<SceneElement>={})=>{
  const segments=48,full=Math.abs(sweep-2*Math.PI)<1e-8;
  const points=Array.from({length:segments+(full?0:1)},(_,i)=>start+sweep*i/segments).flatMap(a=>[1,innerRatio].map(r=>[Math.cos(a)*rx*r,Math.sin(a)*rz*r]));
  const lo=[0,1].map(i=>Math.min(...points.map(p=>p[i]))),hi=[0,1].map(i=>Math.max(...points.map(p=>p[i])));
  add(id,kind,[cx+(lo[0]+hi[0])/2,y,cz+(lo[1]+hi[1])/2],[hi[0]-lo[0],h,hi[1]-lo[1]],{geometry:{type:'arc',axis:'y',start,sweep,innerRatio,segments},...extra});
 };
 const butterfly:ProfileGeometry={type:'extrusion',axis:'z',outline:[[-.5,.35],[0,-.5],[.5,.5],[.5,.35],[0,-.35],[-.5,.5]],holes:[]};
 // Ordering follows the roof's top left -> valley -> top right -> underside.
 butterfly.outline=[[-.5,.5],[0,-.3],[.5,.35],[.5,.15],[0,-.5],[-.5,.3]];
 if(study!=='flowing'){
  const p=[[-11,-5],[-3,-8],[8,-5],[10,2],[4,6],[-7,5]];
  polygon('ground-floor','plate',p,.12,.24);
  if(study==='angular'){
   const roofBottom=(x:number)=>x<=-.5?4.05+(-.5-x)*1.6/12:4.05+(x+.5)*1.3/12;
   p.forEach((a,i)=>{const b=p[(i+1)%p.length];const cuts=[a];if((a[0]+.5)*(b[0]+.5)<0){const t=(-.5-a[0])/(b[0]-a[0]);cuts.push([-.5,a[1]+t*(b[1]-a[1])]);}cuts.push(b);
    for(let j=0;j<cuts.length-1;j++){
     const l=cuts[j],r=cuts[j+1],dx=r[0]-l[0],dz=r[1]-l[1],width=Math.hypot(dx,dz),topL=roofBottom(l[0]),topR=roofBottom(r[0]),height=Math.max(topL,topR)-.24;
     add(`envelope-${i}-${j}`,i%3===0?'wall':'glazing',[(l[0]+r[0])/2,.24+height/2,(l[1]+r[1])/2],[width,height,i%3===0?.24:.08],{rotation:-Math.atan2(dz,dx),material:i%3===0?'limestone':'bronze',geometry:{type:'extrusion',axis:'z',outline:[[-.5,-.5],[.5,-.5],[.5,(topR-.24)/height-.5],[-.5,(topL-.24)/height-.5]],holes:[]}});
     if(i%3!==0)for(let k=0;k<=3;k++){const t=k/3,h=topL+(topR-topL)*t-.24;add(`frame-${i}-${j}-${k}`,'volume',[l[0]+dx*t,.24+h/2,l[1]+dz*t],[.065,h,.12],{material:'bronze'});}
    }
   });
  }else perimeter('envelope',p,.24,3.8);
  add('folded-roof','roof',[-.5,5.05,-1],[24,2,17],{geometry:butterfly,material:'bronze'});
  add('arrival-door','entrance',[-7,1.64,-6.5],[1.8,2.8,.14],{rotation:.359,material:'timber'});
  add('arrival-path','plate',[-7,.1,-9],[3,.2,5]);
  for(let i=0;i<8;i++)add(`entry-fin-${i}`,'volume',[-9+i*.3,2.2,-6.1],[.09,4,.4],{rotation:.359,material:'timber'});
  if(study==='estate'){
   // Upper floor replaces the folded roof above this occupied footprint.
   elements.splice(elements.findIndex(e=>e.id==='folded-roof'),1);
   polygon('upper-floor','plate',[[-8,-4],[-2,-5],[4,-3],[3,2],[-6,2]],4.15,.3);
   perimeter('upper-envelope',[[-8,-4],[-2,-5],[4,-3],[3,2],[-6,2]],4.3,3.2);
   polygon('upper-roof','roof',[[-9,-4.7],[-2,-5.8],[5,-3.5],[4,2.8],[-7,2.8]],7.7,.4,{material:'bronze'});
   polygon('lower-roof','roof',p.map(v=>v.map(n=>n*1.04)),4.16,.24,{material:'timber'});
   const lower=elements.at(-1)!;if(lower.geometry?.type==='extrusion')lower.geometry.holes=[[[-8,-4],[-2,-5],[4,-3],[3,2],[-6,2]].map(v=>[(v[0]-lower.at[0])/lower.size[0],(v[1]-lower.at[2])/lower.size[2]])];
   add('stone-core','wall',[-3,2.2,-4],[3,4,.4],{material:'limestone'});
   for(let i=0;i<23;i++)add(`stair-${i}`,'volume',[-9.8,.24+(i+1)*4.06/23/2,4.7-i*.33],[1.6,(i+1)*4.06/23,.34],{material:'limestone'});
   add('upper-landing','plate',[-8.9,4.15,-3.6],[3.4,.3,2]);
   // Circular garden salon and barrel canopy use unrelated sections.
   arc('salon-floor','plate',16,0,5,5,.12,.24,0,Math.PI*2,.01);
   arc('salon-glass','glazing',16,0,4.8,4.8,2.15,3.82,-1.35,5.8,.985);
   arc('salon-roof','roof',16,0,5.4,5.4,4.2,.28,0,Math.PI*2,.01,{material:'timber'});
   add('salon-door','entrance',[17,.24+1.6,-4.5],[1.7,3.2,.12],{material:'timber'});
   add('garden-gallery','plate',[11,.12,-4.5],[7,.24,3],{material:'limestone'});
   add('barrel-canopy','roof',[11,4.8,-5],[7,2.5,4],{geometry:{type:'arc',axis:'z',start:0,sweep:Math.PI,innerRatio:.9,segments:40},material:'bronze'});
   for(const x of [7.5,14.5])add(`canopy-post-${x===7.5?'left':'right'}`,'volume',[x,2.45,-5],[.2,4.9,.2],{material:'bronze'});
  }
 }else{
  const start=-Math.PI/2+.18,sweep=Math.PI*2-.36;
  arc('courtyard-floor','plate',0,0,12,9,.12,.24,0,Math.PI*2,.52);
  arc('courtyard-roof','roof',0,0,12.6,9.6,4.3,.3,0,Math.PI*2,.49,{material:'ivory'});
  arc('outer-stone','wall',0,0,12,9,2.15,3.82,start,sweep*.48,.98,{material:'limestone'});
  arc('outer-glass','glazing',0,0,12,9,2.15,3.82,start+sweep*.48,sweep*.52,.99);
  arc('inner-glass','glazing',0,0,6.45,4.95,2.15,3.82,start,sweep,.985);
  for(let i=0;i<18;i++){const a=.15+i*.17;add(`curved-shading-fin-${i}`,'volume',[12.2*Math.cos(a),2.2,9.2*Math.sin(a)],[.10,3.9,.6],{rotation:-a+Math.PI/2,material:'timber'});}
  arc('stone-base-band','wall',0,0,12.15,9.15,.45,.42,start,sweep*.48,.975,{material:'limestone'});
  add('arrival-door','entrance',[0,1.74,-8.8],[2.5,3,.16],{material:'timber'});
  add('courtyard-door','entrance',[0,1.74,-4.9],[1.5,3,.14],{material:'timber'});
  add('arrival-path','plate',[0,.1,-11.5],[3,.2,5]);
  add('vaulted-entry','roof',[0,4.6,-9],[5,1.5,4],{geometry:{type:'arc',axis:'z',start:0,sweep:Math.PI,innerRatio:.82,segments:40},material:'timber'});
  for(const x of [-2.5,2.5])add(`entry-post-${x<0?'l':'r'}`,'volume',[x,2.3,-9],[.2,4.6,.2],{material:'bronze'});
 }
 add('garden-deck','plate',[0,.1,10],[26,.2,4],{material:'limestone'});
 add('pool-bottom','plate',[0,-1.45,17],[16,.2,7],{material:'sage'});
 add('pool-water','water',[0,.05,17],[15.5,.05,6.5]);
 for(const x of [-8,8])add(`pool-wall-${x<0?'l':'r'}`,'wall',[x,-.6,17],[.25,1.7,7.25],{material:'limestone'});
 for(const z of [13.5,20.5])add(`pool-wall-${z===13.5?'near':'far'}`,'wall',[0,-.6,z],[16,.25+1.45,.25],{material:'limestone'});
 for(const x of [-8.8,8.8])add(`pool-deck-${x<0?'l':'r'}`,'plate',[x,.1,17],[1.35,.2,8.5],{material:'limestone'});
 add('pool-far-deck','plate',[0,.1,21.2],[19,.2,1.2],{material:'limestone'});
 const operations:SceneOperation[]=elements.map(element=>({op:'add',element}));
 const empty:ArchitecturalScene={version:'architectural-scene-1',name:`DEVELOPER ${study} · editable profile feasibility`,elements:[]};
 const scene=applySceneOperations(empty,operations);
 return {scene,operations,unsupported:['Developer-authored capability study, not Terra output or a completed residence.','Interior fit-out, full roof/access/headroom and guard provision remain unverified; no engineering/code certification.','Curves are bounded polygonal approximations; no freeform meshes, CSG or automatic roof junctions.']};
}
