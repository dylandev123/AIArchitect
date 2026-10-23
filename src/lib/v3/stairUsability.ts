import { Euler, Quaternion, Ray, Vector3 } from 'three';
import type { HousePrimitive } from '@/lib/house/types';
import type { V3Scene, Vec3 } from './scene';
import { materializeV3ArchitecturalScene } from './architecture';
import { auditV3CirculationIntent, resolveV3Circulation, v3StairAccessGeometry, V3_FLOOR_SLAB } from './circulation';
import { footprintContains } from './footprint';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { primitiveTriangles } from './junctionGeometry';

export interface V3StairFailure { code: string; targetId: string; message: string; obstacleId?:string; }
/** Known physical failures only; no architectural invention or building-code certification.
 * Optional constructed primitives verify openings, walls and headroom against the production compiler. */
export function auditV3StairUsability(input: V3Scene, primitives?: HousePrimitive[]): V3StairFailure[] {
  const scene = materializeV3ArchitecturalScene(input);
  const failures = auditV3CirculationIntent(scene).filter(i=>i.code!=='CIRCULATION_OVERLAP');
  const add = (code:string,targetId:string,message:string,obstacleId?:string) => failures.push({code,targetId,...(obstacleId?{obstacleId}:{}),message:`${targetId}: ${message}`});
  for (const r of resolveV3Circulation(scene).filter(r=>r.entry.type==='stair'&&r.usable)) {
    const {entry,exit,walk}=v3StairAccessGeometry(r), id=r.entry.id;
    const local=(host:typeof r.host,p:Vec3):[number,number]=>{
      const dx=p[0]-host.transform.position[0],dz=p[2]-host.transform.position[2],yaw=host.transform.rotation[1];
      return [dx*Math.cos(yaw)-dz*Math.sin(yaw),dx*Math.sin(yaw)+dz*Math.cos(yaw)];
    };
    const roofLanding=r.exit==='roof'?scene.objects.find(o=>o.type==='terrace'&&(o.hostId??o.support?.hostId??o.support?.objectId)===r.host.id&&Math.abs(getObjectTopY(o)-r.toY)<.05&&(()=>{
      const [x,z]=local(o,exit),[w,,d]=scaledDimensionsOf(o);
      return Math.abs(x)+.2<=w/2&&Math.abs(z)+.2<=d/2;
    })()):undefined;
    for(const [name,p,host,level] of [
      ['entry',entry,r.host,r.entry.fromLevel],
      ['exit',exit,scene.objects.find(o=>o.id===r.stackedMassId)??roofLanding??r.host,r.exit==='stacked'?0:Math.min(r.entry.toLevel,r.datums.length-2)],
    ] as const){
      const [x,z]=local(host,p),[w,,d]=scaledDimensionsOf(host);
      const corners:[number,number][]=[[-.2,-.2],[.2,-.2],[.2,.2],[-.2,.2]].map(([dx,dz])=>[x+dx,z+dz]);
      if(corners.some(([x,z])=>Math.abs(x)>w/2-.05||Math.abs(z)>d/2-.05)||!footprintContains(host,corners,level))
        add('STAIR_APPROACH_UNSUPPORTED',id,`${name} landing/approach leaves the actual ${host.id} floor footprint at level ${level}.`);
    }
    for(const level of [r.entry.fromLevel,r.entry.toLevel]){
      const datum=scene.interior?.storeys.find(s=>s.hostMassId===r.host.id&&s.index===level);
      if(datum&&Math.abs(getObjectBaseY(r.host)+datum.elevation-(r.datums[level]+V3_FLOOR_SLAB))>.05)
        add('STAIR_STOREY_MISMATCH',id,`authored storey ${datum.id} finished elevation disagrees with the constructed stair landing.`);
    }
    if(!primitives)continue;
    const meshes=primitives.filter(p=>!(p.id.startsWith(`${id}:`) && !p.componentRole?.includes('guard') && !p.componentRole?.includes('bulkhead')) && !['landscape','path','waterway','rock'].includes(p.category)).map(p=>{
      const vertices=primitiveTriangles(p).vertices,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<vertices.length;i++){min[i%3]=Math.min(min[i%3],vertices[i]);max[i%3]=Math.max(max[i%3],vertices[i]);}
      return {p,vertices,min,max};
    });
    // Vertical body probes use actual triangles, including cut slabs; placement envelopes cannot prove a blockage.
    const hit=(point:Vec3)=>{
      const ray=new Ray(new Vector3(point[0],point[1]+.22,point[2]),new Vector3(0,1,0)),target=new Vector3();
      for(const {p,vertices,min,max} of meshes){
        if(point[0]<min[0]||point[0]>max[0]||point[2]<min[2]||point[2]>max[2]||point[1]+.22>max[1]||point[1]+2<min[1])continue;
        if(p.kind==='box'){
          const chest=new Vector3(point[0]-p.position[0],point[1]+1-p.position[1],point[2]-p.position[2]).applyQuaternion(new Quaternion().setFromEuler(new Euler(...p.rotation)).invert());
          if(Math.abs(chest.x)<p.size[0]/2&&Math.abs(chest.y)<p.size[1]/2&&Math.abs(chest.z)<p.size[2]/2)return p;
        }
        for(let i=0;i<vertices.length;i+=9){
        if(ray.intersectTriangle(new Vector3(...vertices.slice(i,i+3) as Vec3),new Vector3(...vertices.slice(i+3,i+6) as Vec3),new Vector3(...vertices.slice(i+6,i+9) as Vec3),false,target)&&target.y<point[1]+2.0-.01)return p;
        }
      }
    };
    const points=[entry,...walk,exit];
    let blocked=false;
    for(const p of points){
      // Body width probes are conservative; no normative landing-size or egress certification is claimed.
      for(const [dx,dz] of [[0,0],[.18,0],[-.18,0],[0,.18],[0,-.18]]){
        const obstacle=hit([p[0]+dx,p[1],p[2]+dz]);
        if(obstacle){add(['floor','roof'].includes(obstacle.category)?'STAIR_OPENING_BLOCKED':'STAIR_ACCESS_BLOCKED',id,`constructed approach or walking clearance intersects ${obstacle.id}.`,obstacle.sourceObjectId??obstacle.id);blocked=true;break;}
      }
      if(blocked)break;
    }
    for(const [name,point] of [['entry',entry],['exit',exit]] as const){
      const ray=new Ray(new Vector3(point[0],point[1]+.05,point[2]),new Vector3(0,-1,0)),target=new Vector3();
      const supported=meshes.some(({p,vertices,min,max})=>{
        if(!['floor','roof','patio'].includes(p.category)||point[0]<min[0]||point[0]>max[0]||point[2]<min[2]||point[2]>max[2])return false;
        for(let i=0;i<vertices.length;i+=9)if(ray.intersectTriangle(new Vector3(...vertices.slice(i,i+3) as Vec3),new Vector3(...vertices.slice(i+3,i+6) as Vec3),new Vector3(...vertices.slice(i+6,i+9) as Vec3),false,target)&&Math.abs(target.y-point[1])<.1)return true;
        return false;
      });
      if(!supported)add('STAIR_LANDING_UNSUPPORTED',id,`${name} approach has no constructed floor surface at its intended finished elevation.`);
    }
    // Thin walls between tread/landing probes must also be tested along the walking line.
    if(!blocked)for(let j=1;j<points.length;j++){
      const a=new Vector3(points[j-1][0],points[j-1][1]+1,points[j-1][2]);
      const b=new Vector3(points[j][0],points[j][1]+1,points[j][2]),delta=b.clone().sub(a),distance=delta.length();
      if(distance<.001)continue;
      const ray=new Ray(a,delta.normalize()),target=new Vector3();
      for(const {p,vertices,min,max} of meshes){
        if([0,1,2].some(k=>max[k]<Math.min(a.getComponent(k),b.getComponent(k))||min[k]>Math.max(a.getComponent(k),b.getComponent(k))))continue;
        for(let i=0;i<vertices.length;i+=9)if(ray.intersectTriangle(new Vector3(...vertices.slice(i,i+3) as Vec3),new Vector3(...vertices.slice(i+3,i+6) as Vec3),new Vector3(...vertices.slice(i+6,i+9) as Vec3),false,target)&&target.distanceTo(a)<distance-.01){
          add('STAIR_ACCESS_BLOCKED',id,`walking approach intersects ${p.id}.`,p.sourceObjectId??p.id);blocked=true;break;
        }
        if(blocked)break;
      }
      if(blocked)break;
    }
    if(!primitives.some(p=>p.id.startsWith(`${id}:tread-`)))add('STAIR_CONSTRUCTION_MISSING',id,'no stair treads were constructed.');
  }
  return failures;
}
