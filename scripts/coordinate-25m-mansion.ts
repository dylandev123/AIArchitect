/** Hand-authored offline contract study, never a new provider response. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {applySceneOperations,validateScene,type SceneOperation} from '../src/lib/villa/scene/model';
import {auditArchitecturalPlan} from '../src/lib/villa/scene/planning';
const source='docs/villa-playground/25m-mansion-recovery';
const dir='docs/villa-playground/plan-to-construction';mkdirSync(dir,{recursive:true});
const before=validateScene(JSON.parse(readFileSync(`${source}/corrected.scene.json`,'utf8')));
const plan=JSON.parse(readFileSync(`${source}/corrected.response.json`,'utf8')).architecturalPlan;
const ops:SceneOperation[]=[];
function change(id:string,patch:object){ops.push({op:'replace',id,element:{...before.elements.find(e=>e.id===id)!,...patch}});}
// Partition the existing 16x12 upper footprint, rather than enlarging it.
for(const [prefix,x,width] of [['owner',-3,10],['guest',5,6]] as const){
 change(`${prefix}-floor`,{at:[x,3.5,-1],size:[width,.2,10]});
 change(`${prefix}-north-wall`,{at:[x,5.2,4],size:[width,3.2,.3]});
 for(const e of before.elements.filter(e=>e.id.startsWith(prefix)&&e.kind==='wall'&&!e.id.includes('north')&&!e.id.includes('south')))
  change(e.id,{at:[e.at[0],5.2,-1],size:[10,3.2,.3]});
 change(`${prefix}-south-wall`,{at:[x,5.2,-6]});
}
change('retreat-floor',{at:[0,3.5,5],size:[16,.2,2]});
for(const [edge,x,z,width,rotation] of [['north',0,6,16,0],['south',0,4,16,0],['west',-8,5,2,Math.PI/2],['east',8,5,2,Math.PI/2]] as const)
 change(`retreat-${edge}-wall`,{at:[x,5.2,z],size:[width,3.2,.3],rotation});
// Use one wall per shared boundary; lower salon enclosure stops at upper slab top.
for(const e of before.elements.filter(e=>e.id.startsWith('salon-')&&e.kind==='wall'))
 change(e.id,{at:[e.at[0],1.9,e.at[2]],size:[e.size[0],3.4,.3],...(e.opening?{opening:{...e.opening,sill:.2,height:3}}:{})});
change('salon-ocean-glazing',{at:[0,1.9,-6.16],size:[12,3,.12]});
ops.push({op:'remove',id:'guest-divider-wall'},{op:'remove',id:'retreat-south-wall'});
// Align roof underside with upper enclosure top 6.8; reduce heavy roof edges.
change('salon-roof',{at:[0,6.9,0],size:[17,.2,13],material:'ivory'});
for(const e of before.elements.filter(e=>e.kind==='roof'&&e.id!=='salon-roof'))change(e.id,{material:'ivory'});
// Secondary arrival bays use real cuts in the existing walls.
for(const id of ['lounge-north-wall','dining-north-wall','kitchen-north-wall'])
 change(id,{opening:{x:0,sill:.6,width:4,height:2,glazed:true}});
change('gallery-north-wall',{opening:{x:0,sill:0,width:3.2,height:2.8,glazed:false}});
change('main-entrance',{at:[0,1.6,9.82],size:[3.2,2.8,.16]});
for(const side of ['east','west'])ops.push({op:'place-on',id:`${side}-terrace-rail`,support:`${side}-terrace-deck`,offset:[0,-4.8],rotation:0});
const scene=applySceneOperations(before,ops);
for(const s of plan.spaces){s.enclosureIds=s.enclosureIds.flatMap((id:string)=>id==='guest-divider-wall'?['owner-east-wall']:id==='retreat-south-wall'?['owner-north-wall','guest-north-wall']:[id]);s.areaM2=s.floorIds.reduce((sum:number,id:string)=>{const e=scene.elements.find(e=>e.id===id)!;return sum+e.size[0]*e.size[2];},0);}
plan.enclosedAreaM2=plan.spaces.filter((s:any)=>s.use==='interior').reduce((a:number,s:any)=>a+s.areaM2,0);
const kinds:Record<string,string[]>={entrance:['entrance'],circulation:['plate'],'primary-volume':['plate','wall','volume'],'secondary-volume':['plate','wall','volume'],roof:['roof'],facade:['wall','glazing','screen'],terrace:['plate']};
for(const c of plan.commitments)c.elementIds=c.elementIds.filter((id:string)=>kinds[c.kind].includes(scene.elements.find(e=>e.id===id)!.kind));
plan.scaleRationale='Offline coordination study: 656 m² allocated enclosed floor evidence in the existing footprint. Two suites and a shared upper gallery; no modeled service accommodation or stair. This is not a complete $25m design.';
plan.arrivalAndCirculation='Ground walking datum .2 m; upper 3.6 m; roof terrace 3.65 m. Upper shared retreat is a 2 m deep gallery. Vertical circulation remains unmodeled.';
plan.volumeHierarchy='Existing central two-storey volume with lower wings. Upper slabs occupy its entire footprint; the salon is not double height.';
plan.commitments.find((c:any)=>c.kind==='primary-volume').description='Central two-storey primary volume; no double-height claim.';
const audit=auditArchitecturalPlan(scene,plan);
writeFileSync(`${dir}/operations.json`,JSON.stringify(ops,null,2));
writeFileSync(`${dir}/corrected.scene.json`,JSON.stringify(scene,null,2));
writeFileSync(`${dir}/plan.json`,JSON.stringify(plan,null,2));
writeFileSync(`${dir}/audit.json`,JSON.stringify({providerCalls:0,authorship:'hand-authored offline study',before:auditArchitecturalPlan(before,JSON.parse(readFileSync(`${source}/corrected.response.json`,'utf8')).architecturalPlan),after:audit},null,2));
console.log(audit);
