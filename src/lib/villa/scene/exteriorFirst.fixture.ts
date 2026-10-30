/** Developer-authored feasibility studies, never model output or house templates. */
import { operationSchema, type SceneOperation, type SceneElement } from './model';
import { resolveSceneResult } from './terra';

export function exteriorStudy(layered = true) {
 const operations: SceneOperation[]=[];
 const part=(id:string,kind:SceneElement['kind'],at:number[],size:number[],extra={})=>operations.push(operationSchema.parse({op:'add',element:{id,label:id.replaceAll('-',' '),kind,at,size,...extra}}));
 const bay=(id:string,at:number[],width:number,height:number,rotation=0,infill='glazing',sill=.3,openingWidth=width-.6,openingHeight=height-.7,openingX=0)=>operations.push(operationSchema.parse({op:'assemble',assembly:{kind:'facade-bay',parameters:{id,at,width,height,rotation,thickness:.25,openingX,sill,openingWidth,openingHeight,infill,panels:3,material:'ivory'}}}));
 const width=layered?16:10,depth=layered?10:8,h=layered?3.4:2.8;
 part('main-floor','plate',[0,.1,0],[width,.2,depth],{material:'limestone'});
 // Independently editable, varied bays rather than a solid arrival wall.
 for(const [side,z] of [['front',depth/2-.125],['rear',-depth/2+.125]] as const){
  for(let i=0;i<3;i++){
   const w=width/3,x=-width/2+(i+.5)*w,door=i===1;
   bay(`${side}-${i}`,[x,.2,z],w,h,0,door?'entrance':'glazing',door?0:.55,door?1.6:w-.65,door?2.5:h-.85);
  }
 }
 bay('west',[ -width/2+.125,.2,0],depth-.5,h,Math.PI/2,'glazing',.7,depth-2,h-1.05);
 bay('east',[ width/2-.125,.2,0],depth-.5,h,Math.PI/2,'glazing',.7,depth-2,h-1.05);
 part('arrival','plate',[0,.1,-depth/2-2],[4,.2,4],{material:'limestone'});
 if(!layered){
  part('gable-roof','roof',[0,.2+h+.6,0],[width,1.2,depth],{roofForm:'gable',overhang:.65});
  part('entry-canopy','roof',[0,2.9,-depth/2-1.1],[4,.2,2.5]);
  part('garden-terrace','plate',[0,.1,depth/2+1.5],[width,.2,3],{material:'timber'});
 }else{
  // Lower roof only covers the right-hand volume. The upper footprint is open.
  part('lower-roof','roof',[4.25,3.7,0],[8.5,.2,11]);
  part('upper-floor','plate',[-4,3.7,-1],[7,.2,7]);
  bay('upper-front',[-4,3.8,2.375],2,3,0,'entrance',0,1.3,2.7);
  bay('upper-front-west',[-6.25,3.8,2.375],2.5,3,0,'glazing',.1,2,2.6);
  bay('upper-front-east',[-1.75,3.8,2.375],2.5,3,0,'glazing',.1,2,2.6);
  bay('upper-rear',[-4,3.8,-4.375],7,3,0,'glazing',.85,5.6,1.7);
  bay('upper-west',[-7.375,3.8,-1],6.5,3,Math.PI/2,'entrance',0,1.4,2.5,-2.5);
  bay('upper-east',[-.625,3.8,-1],6.5,3,Math.PI/2,'glazing',.45,5,2.2);
  part('upper-roof','roof',[-4,6.95,-1],[8,.3,8]);
  part('balcony-deck','plate',[-4,3.7,3.75],[8,.2,2.5],{material:'timber'});
  part('balcony-guard','balcony',[-4,4.35,4.94],[8,1.1,.04]);
  for(const [id,x] of [['west',-7.94],['east',-.06]] as const)part(`balcony-${id}-return`,'balcony',[x,4.35,3.75],[2.5,1.1,.04],{rotation:Math.PI/2});
  part('upper-screen','screen',[-6.8,5.3,2.65],[1.1,3,.15],{material:'timber',panels:7});
  operations.push(operationSchema.parse({op:'assemble',assembly:{kind:'straight-stair',parameters:{id:'garden-stair',at:[-8.9,.2,-5],width:1.2,rise:3.6,run:6.3,risers:20,rotation:0,material:'limestone'}}}));
  part('stair-approach','plate',[-5.75,.1,-5.5],[7.5,.2,1]);
  part('stair-base','plate',[-8.9,.1,-1.8],[1.4,.2,6.4]);
  part('stair-landing','plate',[-8.9,3.7,1.9],[2.8,.2,1.2]);
  part('landing-pier','volume',[-8.9,1.9,1.9],[.35,3.4,.35],{material:'bronze'});
  part('terrace','plate',[0,.1,8],[16,.2,6],{material:'limestone'});
  operations.push(operationSchema.parse({op:'assemble',assembly:{kind:'rectangular-pool',parameters:{id:'pool',at:[0,.05,11.75],rotation:0,width:8,depth:9,basinDepth:1.4,material:'limestone'}}}));
  // Open pergola, separately editable horizontal members; screen slats are vertical.
  for(const x of [-7,7])part(`pergola-post-${x<0?'west':'east'}`,'volume',[x,1.8,9.5],[.18,3.2,.18],{material:'bronze'});
  part('pergola-beam','volume',[0,3.45,9.5],[14.4,.3,.22],{material:'timber'});
  for(let i=0;i<15;i++)part(`pergola-member-${i}`,'volume',[-7+i,3.65,7.9],[.1,.18,3.6],{material:'timber'});
  part('entry-canopy','roof',[0,3.2,-6.1],[4.8,.2,2.5]);
  for(const x of [-2.1,2.1])part(`entry-pier-${x<0?'west':'east'}`,'volume',[x,1.65,-6.6],[.22,2.9,.22],{material:'limestone'});
 }
 const programme=[{name:layered?'Family accommodation capacity':'Three-bedroom capacity',zone:'private',purpose:'bedroom',strategy:'Capacity allocated to envelope; room subdivision deferred',floorIds:['main-floor',...(layered?['upper-floor']:[])],enclosureIds:['front-0','rear-0',...(layered?['upper-front']:[])],roofIds:layered?['lower-roof','upper-roof','balcony-deck']:['gable-roof'],accessIds:['front-1-panel',...(layered?['upper-west-panel']:[])],limitation:'Interiors unfinished; no distinct rooms or fit-out claimed.'}];
 const architecturalPlan={constructionScope:'exterior',scaleRationale:'Developer study of envelope capacity, not value-to-area pricing',arrivalAndCirculation:'Grounded dry approach, fitted entries; layered study uses external supported stairs',volumeHierarchy:layered?'Asymmetric stepped residence with recessed upper volume':'Compact single-level gable residence',relationshipsAndViews:'Garden-facing glazing and connected outdoor surfaces',roofFacadeAndMaterials:'Independent roof sections, fitted openings, timber and limestone contrast',intendedSpaces:programme.map(s=>s.name),programme};
 return {...resolveSceneResult({mode:'generate',prompt:'Developer exterior study; interiors deferred'}, {name:`DEVELOPER: ${layered?'Layered coastal':'Compact gable'} exterior`,summary:'Developer-authored geometry feasibility study, not AI-generated quality evidence. Exterior-designed, interiors unfinished.',unsupported:['Interiors, engineering, site survey and code compliance unverified.','Stair guards and full route/headroom review remain unfinished.'],architecturalPlan,operations})};
}
