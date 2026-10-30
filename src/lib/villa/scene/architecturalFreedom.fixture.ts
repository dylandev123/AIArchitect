/** Developer construction proof, deliberately excluded from generation context. */
import {operationSchema, type SceneOperation, type SceneElement} from './model';
import {resolveSceneResult} from './terra';
export function architecturalFreedomStudy(){
 const operations:SceneOperation[]=[];
 const part=(id:string,kind:SceneElement['kind'],at:number[],size:number[],material='ivory',rotation=0,parent?:string)=>operations.push(operationSchema.parse({op:'add',element:{id,label:id,kind,at,size,material,rotation,parent}}));
 const bay=(id:string,parent:string,x:number,z:number,w:number,h:number,material='ivory',rotation=0,door=false)=>operations.push(operationSchema.parse({op:'assemble',assembly:{kind:'facade-bay',parameters:{id,parent,at:[x,.14,z],rotation,width:w,height:h,thickness:.3,openingX:0,sill:door?0:.35,openingWidth:door?2.2:w-.65,openingHeight:door?h-.4:h-.8,infill:door?'entrance':'glazing',panels:Math.max(1,Math.round(w/1.5)),material}}}));
 const room=(id:string,x:number,y:number,z:number,w:number,d:number,h:number,rotation=0,material='ivory')=>{
  part(id,'plate',[x,y-.14,z],[w,.28,d],'limestone',rotation);
  const widths=[w*.24,w*.42,w*.34];let edge=-w/2;
  for(let i=0;i<3;i++){const bw=widths[i],cx=edge+bw/2;edge+=bw;bay(`${id}-front-${i}`,id,cx,d/2-.15,bw,h,material,0,i===1);bay(`${id}-rear-${i}`,id,cx,-d/2+.15,bw,h,material,0,i===1);}
  bay(`${id}-west`,id,-w/2+.15,0,d-.6,h,material,Math.PI/2);
  bay(`${id}-east`,id,w/2-.15,0,d-.6,h,material,Math.PI/2);
 };
 // The upper slab roofs the entire lower west volume. Its recessed envelope leaves
 // a deep wraparound loggia; this is not a stacked residential-wing assembly.
 room('west-ground',-10,.28,0,18,14,3.92);
 room('west-upper',-10,4.2,0,18,14,3.2);
 // Recess the upper enclosure by moving its selected boundary segments inward.
 for(const op of operations){if(op.op==='assemble'&&op.assembly.kind==='facade-bay'&&op.assembly.parameters.parent==='west-upper'){
  const p=op.assembly.parameters;
  if(p.id.includes('front'))p.at[2]-=1.8;
  if(p.id.includes('rear'))p.at[2]+=1.2;
  if(p.id.endsWith('west')||p.id.endsWith('east')){p.width-=3;p.openingWidth-=3;p.at[2]=-.3;}
  if(p.id.endsWith('west')){p.infill='entrance';p.sill=0;p.openingX=-.55;p.openingWidth=1.8;p.openingHeight=2.7;}
 }}
 part('west-crown','roof',[-10,7.62,-.3],[19.6,.32,15.2],'bronze');
 // Tall stone threshold between different occupied heights, with a real door.
 room('arrival-hall',3,.28,-1,7.4,10,7.8,0,'limestone');
 // Short door beneath a separately fitted clerestory, rather than a giant pivot slab.
 for(const op of operations)if(op.op==='assemble'&&op.assembly.kind==='facade-bay'&&['arrival-hall-front-1','arrival-hall-rear-1'].includes(op.assembly.parameters.id)){op.assembly.parameters.height=4.3;op.assembly.parameters.openingHeight=4;}
 for(const [side,z] of [['front',3.85],['rear',-5.85]] as const)operations.push(operationSchema.parse({op:'assemble',assembly:{kind:'facade-bay',parameters:{id:`portal-transom-${side}`,at:[2.63,4.58,z],width:3.108,height:3.5,thickness:.3,openingX:0,sill:.1,openingWidth:2.8,openingHeight:3.1,infill:'glazing',panels:2,material:'limestone'}}}));
 part('portal-crown','roof',[3,8.26,-1],[8.6,.36,11.8],'limestone');
 part('portal-left','volume',[-.25,4.18,-7],[.65,7.8,2.2],'limestone');
 part('portal-right','volume',[6.25,4.18,-7],[.65,7.8,2.2],'limestone');
 part('portal-lintel','volume',[3,8.05,-7],[7.8,.4,2.6],'limestone');
 part('arrival-approach','plate',[3,.14,-11],[7.4,.28,10],'limestone');
 // A rotated subordinate pavilion changes the plan silhouette without new meshes.
 room('east-salon',16,.28,1,14,16,4.3,-.19,'sage');
 part('east-roof','roof',[16,4.78,1],[16,.4,18],'bronze',-.19);
 part('east-clerestory-band','volume',[16,4.5,1],[14,.2,16],'timber',-.19);
 // Recessed glazing, a loggia, and individually selectable timber sun fins.
 for(let i=0;i<15;i++)part(`upper-fin-${i}`,'volume',[-18.4+i*1.2,5.8,6.6],[.1,3.2,.65],'timber');
 for(let i=0;i<9;i++)part(`west-stone-rib-${i}`,'volume',[-18.9+i*.16,2.1,-7.12],[.065,3.6,.15],'limestone');
 part('upper-balcony-guard','balcony',[-10,4.75,6.88],[17.8,1.1,.05],'bronze');
 part('upper-guard-west-rear','balcony',[-18.88,4.75,-3.775],[6.25,1.1,.05],'bronze',Math.PI/2);
 part('upper-guard-west-front','balcony',[-18.88,4.75,4.025],[5.75,1.1,.05],'bronze',Math.PI/2);
 part('upper-guard-east','balcony',[-1.12,4.75,0],[13.8,1.1,.05],'bronze',Math.PI/2);
 part('upper-guard-rear','balcony',[-10,4.75,-6.88],[17.8,1.1,.05],'bronze');
 // Solid stairs connect a landing to the fitted upper west door through a guard gap.
 operations.push(operationSchema.parse({op:'assemble',assembly:{kind:'straight-stair',parameters:{id:'external-stair',at:[-20,.28,-7],width:1.5,rise:3.92,run:6.5,risers:22,material:'limestone'}}}));
 part('stair-base','plate',[-20,.14,-3.75],[1.6,.28,6.5],'limestone');
 part('stair-landing','plate',[-19.55,4.06,.25],[2.5,.28,1.5],'limestone');
 part('landing-pier','volume',[-20,2.1,.25],[.3,3.92,.3],'bronze');
 part('garden-terrace','plate',[2,.14,12],[44,.28,10],'limestone');
 operations.push(operationSchema.parse({op:'assemble',assembly:{kind:'rectangular-pool',parameters:{id:'lagoon',at:[2,.13,17.75],width:20,depth:9,basinDepth:1.4,material:'limestone'}}}));
 // Freely rotated segments make a faceted outdoor room, not a polygonal solid.
 for(let i=0;i<7;i++){const angle=-.65+i*.21,x=18+7*Math.sin(angle),z=17+7*Math.cos(angle);part(`garden-blade-${i}`,'wall',[x,1.65,z],[1.1,2.74,.3],'limestone',angle);}
 for(const x of [-17,-7,3,13,23])part(`loggia-column-${x+17}`,'volume',[x,2.05,15.8],[.25,3.54,.25],'bronze');
 part('loggia-beam','volume',[3,3.95,15.8],[40.5,.3,.35],'timber');
 for(let i=0;i<31;i++)part(`loggia-rafter-${i}`,'volume',[-17+i*1.33,4.18,13.4],[.12,.2,5.3],'timber');
 return resolveSceneResult({mode:'generate',prompt:'Developer-authored tropical exterior expressiveness proof'}, {name:'DEVELOPER: Headland House — geometry proof',summary:'Two occupied levels, tall stone arrival, angled salon, recessed loggia and water garden. Developer-authored, never model quality evidence.',unsupported:['Interiors unfinished. Engineering and site design unverified.','Exterior stair guards remain unfinished; full route, headroom and accessibility unverified.'],operations});
}
