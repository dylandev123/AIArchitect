/** Offline diagnostic triangle SAT; never imported into production acceptance. */
import {readFileSync,writeFileSync} from 'node:fs';
import {BoxGeometry,Vector3,Euler} from 'three';
import {buildSceneRoof} from '../src/lib/villa/scene/roofs';
import {sceneSpatialGeometry} from '../src/lib/villa/scene/spatial';
import {validateScene} from '../src/lib/villa/scene/model';
const scene=validateScene(JSON.parse(readFileSync('docs/architecture/terra-controlled-estate-2026-10-29/draft.REJECTED.json','utf8'))),g=sceneSpatialGeometry(scene);
type Tri=Vector3[];
function triangles(id:string):Tri[]{
 const e=g.map.get(id)!,p=g.world(e),out:Tri[]=[];
 for(const part of buildSceneRoof(e,{color:'#eeeeee',roughness:.7,metalness:0})){
  let data:number[];
  if(part.kind==='triMesh')data=part.vertices;
  else {const geometry=new BoxGeometry(...part.size).toNonIndexed();data=Array.from(geometry.attributes.position.array);for(let i=0;i<data.length;i+=3){const v=new Vector3(...data.slice(i,i+3) as [number,number,number]).applyEuler(new Euler(...part.rotation)).add(new Vector3(...part.position));data.splice(i,3,...v.toArray());}geometry.dispose();}
  for(let i=0;i<data.length;i+=9)out.push([0,3,6].map(j=>new Vector3(...data.slice(i+j,i+j+3) as [number,number,number]).applyAxisAngle(new Vector3(0,1,0),p[3]).add(new Vector3(p[0],p[1],p[2]))));
 }return out;
}
function intersects(a:Tri,b:Tri){
 const edges=(t:Tri)=>t.map((v,i)=>t[(i+1)%3].clone().sub(v));
 const ae=edges(a),be=edges(b),an=ae[0].clone().cross(ae[1]),bn=be[0].clone().cross(be[1]);
 const axes=[an,bn,...ae.flatMap(x=>be.map(y=>x.clone().cross(y))),...ae.map(x=>an.clone().cross(x)),...be.map(x=>bn.clone().cross(x))];
 return axes.every(axis=>{if(axis.lengthSq()<1e-18)return true;axis.normalize();const ap=a.map(v=>v.dot(axis)),bp=b.map(v=>v.dot(axis));return Math.min(...ap)<=Math.max(...bp)+1e-7&&Math.min(...bp)<=Math.max(...ap)+1e-7;});
}
const findings=JSON.parse(readFileSync('docs/architecture/terra-controlled-estate-2026-10-29/relationship-findings.json','utf8'));
const pairs=[...new Set<string>(findings.filter((f:{rule:string})=>f.rule==='assembly-roof-junction').map((f:{id:string;relatedIds:string[]})=>[f.id,f.relatedIds[0]].sort().join('|')))];
const results=pairs.map(pair=>{const [a,b]=pair.split('|'),at=triangles(a),bt=triangles(b);return {a,b,envelopeSeparation:g.separation(g.map.get(a)!,g.map.get(b)!),renderedTriangleIntersections:at.reduce((n,t)=>n+bt.filter(u=>intersects(t,u)).length,0)};});
writeFileSync('docs/architecture/terra-estate-diagnosis/roof-mesh-probe.json',JSON.stringify({method:'Triangle separating axes including coplanar edge axes; exact builder surfaces plus fascia box surfaces, 1e-7 m tolerance. Surface intersections only; not a solid containment or structural certificate.',results},null,2));console.log(results);
