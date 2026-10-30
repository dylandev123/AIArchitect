import { Box3, BoxGeometry, Matrix4, Ray, Triangle, Vector3 } from 'three';
import type { SceneElement } from './model';
import { buildProfileGeometry } from './profileGeometry';
type Placed = SceneElement & {world:number[];yaw:number};
type Solid = {triangles:Triangle[];bounds:Box3;vertices:Vector3[]};
/** Narrow phase only after the existing oriented bounds test. Uses rendered
 * extrusion triangles, including holes; bounds never count as filled geometry. */
export function profileContactTester(){
 const cache=new Map<string,Solid>();
 let comparisons=0;
 function solid(e:Placed):Solid{
  const found=cache.get(e.id);if(found)return found;
  const geometry=e.geometry?buildProfileGeometry(e.geometry,e.size):new BoxGeometry(...e.size).toNonIndexed();
  const matrix=new Matrix4().makeRotationY(e.yaw);matrix.setPosition(e.world[0],e.world[1],e.world[2]);
  geometry.applyMatrix4(matrix);
  const p=geometry.getAttribute('position');const vertices=Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i));
  const triangles=Array.from({length:vertices.length/3},(_,i)=>new Triangle(vertices[i*3],vertices[i*3+1],vertices[i*3+2]));
  const result={triangles,vertices,bounds:new Box3().setFromPoints(vertices)};geometry.dispose();cache.set(e.id,result);return result;
 }
 function inside(point:Vector3,s:Solid){
  if(!s.bounds.containsPoint(point))return false;
  const ray=new Ray(point,new Vector3(.731,.413,.543).normalize()),hits:number[]=[];
  for(const t of s.triangles){const hit=ray.intersectTriangle(t.a,t.b,t.c,false,new Vector3());if(hit){const d=hit.distanceTo(point);if(d<1e-7)return true;if(!hits.some(h=>Math.abs(h-d)<1e-7))hits.push(d);}}
  return hits.length%2===1;
 }
 function touch(a:Triangle,b:Triangle,tolerance:number){
  if(++comparisons>2000000)throw Error('Profile contact computation budget exceeded; reduce interacting profile resolution or split the transaction');
  if(!new Box3().setFromPoints([a.a,a.b,a.c]).expandByScalar(tolerance).intersectsBox(new Box3().setFromPoints([b.a,b.b,b.c])))return false;
  const av=[a.a,a.b,a.c],bv=[b.a,b.b,b.c];
  const edges=(v:Vector3[])=>v.map((p,i)=>v[(i+1)%3].clone().sub(p));
  const ae=edges(av),be=edges(bv),an=a.getNormal(new Vector3()),bn=b.getNormal(new Vector3());
  // Coplanar edge normals are necessary as well as the usual 3D SAT axes.
  const axes=[an,bn,...ae.flatMap(x=>be.map(y=>x.clone().cross(y))),...ae.map(e=>e.clone().cross(an)),...be.map(e=>e.clone().cross(bn))];
  return axes.every(axis=>{if(axis.lengthSq()<1e-18)return true;axis.normalize();const x=av.map(v=>v.dot(axis)),y=bv.map(v=>v.dot(axis));return Math.max(...x)+tolerance>=Math.min(...y)&&Math.max(...y)+tolerance>=Math.min(...x);});
 }
 return (a:Placed,b:Placed,tolerance=.001)=>{
  if(!a.geometry&&!b.geometry)return true; // Caller already checked legacy bounds.
  const x=solid(a),y=solid(b);
  if(!x.bounds.clone().expandByScalar(tolerance).intersectsBox(y.bounds))return false;
  return x.triangles.some(t=>y.triangles.some(u=>touch(t,u,tolerance)))||inside(x.vertices[0],y)||inside(y.vertices[0],x);
 };
}

/** Clip a railing's complete base line against actual horizontal top triangles.
 * Triangulated holes contribute no support; the caller unions these intervals. */
export function profileDeckIntervals(slab:Placed,rail:Placed):[number,number][]{
 if(!slab.geometry)return [];
 const geometry=buildProfileGeometry(slab.geometry,slab.size),p=geometry.getAttribute('position');
 const c=Math.cos(slab.yaw),s=Math.sin(slab.yaw),dx=rail.world[0]-slab.world[0],dz=rail.world[2]-slab.world[2];
 const origin=[c*dx-s*dz,s*dx+c*dz];
 const angle=rail.yaw-slab.yaw,direction=[Math.cos(angle),-Math.sin(angle)];
 const intervals:[number,number][]=[];
 for(let i=0;i<p.count;i+=3){
  if([0,1,2].some(j=>Math.abs(p.getY(i+j)-slab.size[1]/2)>1e-5))continue;
  const v=[0,1,2].map(j=>[p.getX(i+j),p.getZ(i+j)]);
  const cross=(a:number[],b:number[])=>a[0]*b[1]-a[1]*b[0];
  const winding=Math.sign(cross([v[1][0]-v[0][0],v[1][1]-v[0][1]],[v[2][0]-v[0][0],v[2][1]-v[0][1]]));
  if(!winding)continue;
  let lo=-rail.size[0]/2,hi=rail.size[0]/2;
  for(let j=0;j<3;j++){
   const a=v[j],b=v[(j+1)%3],edge=[b[0]-a[0],b[1]-a[1]];
   const start=winding*cross(edge,[origin[0]-a[0],origin[1]-a[1]]),rate=winding*cross(edge,direction);
   if(Math.abs(rate)<1e-10){if(start< -1e-6)hi=-Infinity;}
   else if(rate>0)lo=Math.max(lo,(-1e-6-start)/rate);else hi=Math.min(hi,(-1e-6-start)/rate);
  }
  if(hi>=lo)intervals.push([lo,hi]);
 }
 geometry.dispose();return intervals;
}
