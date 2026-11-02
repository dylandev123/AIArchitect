/** Offline measurement only. No provider, scene repair, new acceptance gate or score. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateScene,type SceneElement,type SceneOperation} from '../src/lib/villa/scene/model';
import {sceneSpatialGeometry} from '../src/lib/villa/scene/spatial';
import {profileRings} from '../src/lib/villa/scene/profileGeometry';
import {reviewSceneArchitecture} from '../src/lib/villa/scene/planning';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {sceneResponseFormatSchema} from '../src/lib/villa/scene/terra';
import {assemblyOperations} from '../src/lib/villa/scene/assemblies';
type Point=[number,number];
type Polygon=Point[][];
// Vertical-strip integration of polygon unions, including holes and rotations.
// All vertices and edge intersections split the sweep: interval endpoints are
// linear within each strip. Quarter samples avoid ambiguous vertex crossings.
function unionArea(polygons:Polygon[]):number {
 const edges=polygons.flatMap(poly=>poly.flatMap(r=>r.map((p,i)=>[p,r[(i+1)%r.length]])));
 const cuts=edges.flatMap(([a,b])=>[a[0],b[0]]);
 for(let i=0;i<edges.length;i++)for(let j=0;j<i;j++){
  const [a,b]=edges[i],[c,d]=edges[j],r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]];
  const cross=(u:number[],v:number[])=>u[0]*v[1]-u[1]*v[0],den=cross(r,s);
  if(Math.abs(den)<1e-12)continue;
  const q=[c[0]-a[0],c[1]-a[1]],t=cross(q,s)/den,u=cross(q,r)/den;
  if(t>0&&t<1&&u>0&&u<1)cuts.push(a[0]+t*r[0]);
 }
 const xs=[...new Set(cuts)].sort((a,b)=>a-b);
 const length=(x:number)=>{
  const intervals=polygons.flatMap(poly=>{
   const ys=poly.flatMap(r=>r.flatMap((a,i)=>{const b=r[(i+1)%r.length];return (a[0]>x)!==(b[0]>x)?[a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0])]:[];})).sort((a,b)=>a-b);
   assert.equal(ys.length%2,0);return ys.filter((_,i)=>i%2===0).map((y,i)=>[y,ys[i*2+1]]);
  }).sort((a,b)=>a[0]-b[0]);
  let total=0,lo=0,hi=0;
  for(const [a,b] of intervals){if(a>hi){total+=hi-lo;lo=a;hi=b;}else{if(hi===0&&lo===0){lo=a;hi=b;}else hi=Math.max(hi,b);}}
  return total+hi-lo;
 };
 return xs.slice(1).reduce((sum,b,i)=>{const a=xs[i],d=b-a;return sum+d*(length(a+d*.25)+length(a+d*.75))/2;},0);
}
const rect=(x:number,z:number,w:number,d:number):Polygon=>[[[x,z],[x+w,z],[x+w,z+d],[x,z+d]]];
assert.equal(unionArea([rect(0,0,2,2)]),4);
assert.equal(unionArea([rect(-3,-3,2,2),rect(-2,-3,2,2)]),6);
assert.equal(unionArea([[rect(0,0,4,4)[0],rect(1,1,2,2)[0]]]),12);
assert(Math.abs(unionArea([rect(0,0,2,2),[[[0,1],[1,0],[2,1],[1,2]]]])-4)<1e-9);
assert(Math.abs(unionArea([rect(0,0,2,2),[[[1,0],[2,-1],[3,0],[2,1]]]])-5.5)<1e-9);
assert.equal(unionArea([rect(0,0,2,2),rect(0,0,2,2)]),4);
if(process.argv.includes('--self-test')){console.log('Offline area checks passed: overlap, negative coordinates, holes, rotated polygon. Provider calls: 0');process.exit(0);}
globalThis.fetch=async()=>{throw Error('Offline review prohibits all network');};
const fixture=process.argv.includes('--fixture');
const root='docs/architecture/complete-mansion-2026-10-30';
const dir=fixture?`${root}/preparation-measurement`:root;
const source=fixture?'docs/architecture/generation-quality/final-family':root;
if(fixture){const {mkdirSync}=await import('node:fs');mkdirSync(dir,{recursive:true});}
const read=(name:string)=>JSON.parse(readFileSync(`${source}/${fixture?({'route-response.json':'result.json','provider-response.exact.json':'provider-response.json'} as Record<string,string>)[name]??name:name}`,'utf8'));
const save=(name:string,value:unknown)=>writeFileSync(`${dir}/${name}`,JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const route=read('route-response.json'),retained=read('retained.json');
let wire;try{wire=read('provider-response.exact.json');}catch{wire={};save('provider-json-error.json',{note:'Raw provider body missing or not JSON; see exact response or transport-error evidence. No reconstruction attempted.'});}
let output=retained.output;
if(!output){
 const text=(wire.output??[]).flatMap((o:{content?:{type:string;text?:string}[]})=>o.content??[]).filter((c:{type:string})=>c.type==='output_text').map((c:{text:string})=>c.text).join('');
 if(text){save('raw-output.json',JSON.parse(text));const schema=await sceneResponseFormatSchema(read('request.json'));const checked=await schema.validate!(JSON.parse(text));if(typeof checked==='object'&&checked.success)output=checked.value;else save('schema-error.json',typeof checked==='object'?String(checked.error):'Validation returned false');}
}
if(output&&Array.isArray(output.operations)){
 save('normalized-output.json',output);save('programme.json',output.architecturalPlan);save('operations.json',output.operations);
 const indexed=output.operations.flatMap((operation:SceneOperation,authoredIndex:number)=>(operation.op==='assemble'?assemblyOperations(operation.assembly):[operation]).map((primitive:unknown)=>({authoredIndex,operation:primitive})));
 save('expanded-operations.json',indexed);
}
const sourceScene=route.scene??route.recoverableDraft;
if(sourceScene){
 const scene=validateScene(sourceScene),g=sceneSpatialGeometry(scene);
 const plan=scene.architecturalPlan as {physicalProgramme?:{allocations:{name:string;quantity:number;unitNetAreaM2:number;allowanceM2:number;floorIds:string[]}[]};programme?:{name:string;zone:string;floorIds:string[]}[]};
 const ids=[...new Set([...(plan?.physicalProgramme?.allocations??[]).flatMap(a=>a.floorIds),...(plan?.programme??[]).filter(p=>['public','private','service'].includes(p.zone)).flatMap(p=>p.floorIds)])];
 const floorElements=ids.flatMap(id=>{const e=g.map.get(id);return e?.kind==='plate'?[e]:[];});
 function polygon(e:SceneElement):Polygon|null {
  if(e.geometry&&e.geometry.axis!=='y')return null;
  const rings=e.geometry?profileRings(e.geometry):{outline:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],holes:[]};
  const p=g.world(e),c=Math.cos(p[3]),s=Math.sin(p[3]);
  return [rings.outline,...rings.holes].map(r=>r.map(([x,z])=>[p[0]+c*x*e.size[0]+s*z*e.size[2],p[2]-s*x*e.size[0]+c*z*e.size[2]] as Point));
 }
 const ledger=scene.elements.map(e=>({id:e.id,kind:e.kind,parent:e.parent??null,size:e.size,world:g.world(e),bottom:g.bottom(e),top:g.top(e),material:e.material,roofForm:e.roofForm,opening:e.opening,geometry:e.geometry,horizontalPolygon:e.kind==='plate'||e.kind==='water'?polygon(e):undefined}));
 const projected=floorElements.map(polygon),polygons=projected.filter((p):p is Polygon=>!!p);
 const bounds=polygons.flatMap(p=>p[0]);
 const datums=[...new Set(floorElements.map(e=>Math.round(g.top(e)*1000)/1000))];
 const levels=datums.map(datum=>{const elements=floorElements.filter(e=>Math.round(g.top(e)*1000)/1000===datum),ps=elements.map(polygon);return {datum,floorIds:elements.map(e=>e.id),horizontalSurfaceUnionM2:ps.some(p=>!p)?null:unionArea(ps as Polygon[])};});
 const complete=ids.length>0&&floorElements.length===ids.length&&projected.every(Boolean);
 save('scene.json',scene);save('geometry-ledger.json',ledger);save('architecture-audit.json',reviewSceneArchitecture(scene));save('relationship-findings.json',sceneRelationshipIssues(scene));
 save('measurements.json',{
  accepted:!!route.scene,plannedDemandM2:plan?.physicalProgramme?.allocations.reduce((sum,a)=>sum+a.quantity*a.unitNetAreaM2+a.allowanceM2,0)??null,
  occupiedFloorIds:ids,missingOrInvalidFloorIds:ids.filter(id=>!floorElements.some(e=>e.id===id)),
  occupiedProjectionUnionM2:complete?unionArea(polygons):null,
  occupiedProjectionBounds:bounds.length?{minX:Math.min(...bounds.map(p=>p[0])),maxX:Math.max(...bounds.map(p=>p[0])),minZ:Math.min(...bounds.map(p=>p[1])),maxZ:Math.max(...bounds.map(p=>p[1])),width:Math.max(...bounds.map(p=>p[0]))-Math.min(...bounds.map(p=>p[0])),depth:Math.max(...bounds.map(p=>p[1]))-Math.min(...bounds.map(p=>p[1]))}:null,
  levels,constructedReferencedHorizontalAreaM2:complete&&levels.every(l=>l.horizontalSurfaceUnionM2!==null)?levels.reduce((sum,l)=>sum+l.horizontalSurfaceUnionM2!,0):null,
  editableElementIds:scene.elements.map(e=>e.id),terrain:scene.terrain,
  limitations:['Occupied classification comes from model references and requires inspection against all plates in geometry-ledger.json. Missing/unreferenced habitable floors must be reported separately.','Projection union is occupied slab footprint across levels, not site area, net enclosed floor area or roof/eave footprint.','Union removes overlaps within each 1 mm datum bucket; near-duplicate slabs at different heights need manual review. Slab datums do not certify storeys or usable stair connections.','Horizontal y-axis profiles use actual polygons with holes; other axes remain unverified.','Use the full programme/physical/relationship audits and rendered review for enclosure, six distinct suites, access, major spaces, infinity edge, landscaping and design. No area total establishes success.']});
}
save('review-summary.json',{analysisProviderCalls:0,fixture,sourceProviderResponseId:wire.id,sceneAvailable:!!sourceScene,accepted:!!route.scene,error:route.error,usage:wire.usage,quality:'Pending human inspection of unchanged rendered geometry; no automatic aesthetic score.'});
save('sha256.json',Object.fromEntries(readdirSync(dir,{withFileTypes:true}).filter(e=>e.isFile()&&e.name!=='sha256.json').map(e=>[e.name,createHash('sha256').update(readFileSync(`${dir}/${e.name}`)).digest('hex')])));
