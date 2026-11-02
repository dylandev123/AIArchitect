import { Euler, Vector3 } from 'three';
import { buildSceneRoof } from './roofs';
import type { SceneElement } from './model';

type ConvexPart = {vertices:Vector3[]; edges:Vector3[]; normals:Vector3[]};
/** Narrow phase for the existing pitched builders only. Roof slopes are surfaces,
 * fascia members are solids. Do not turn the empty space below a slope into a box.
 * No mesh changes, unions, layout correction or structural certification. */
export function pitchedRoofParts(e:SceneElement, world:number[]):ConvexPart[] {
    const yaw=new Euler(0,world[3],0),origin=new Vector3(world[0],world[1],world[2]);
    const transform=(v:Vector3)=>v.applyEuler(yaw).add(origin);
    return buildSceneRoof(e,{color:'#ffffff',roughness:1,metalness:0}).flatMap(part=>{
        if(part.kind==='box') {
            const rotation=new Euler(...part.rotation),position=new Vector3(...part.position);
            const vertices=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>transform(new Vector3(x*part.size[0]/2,y*part.size[1]/2,z*part.size[2]/2).applyEuler(rotation).add(position)))));
            const axes=[new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)].map(v=>v.applyEuler(rotation).applyEuler(yaw));
            return [{vertices,edges:axes,normals:axes}];
        }
        const triangles:ConvexPart[]=[];
        for(let i=0;i<part.vertices.length;i+=9) {
            const vertices=[0,3,6].map(j=>transform(new Vector3(part.vertices[i+j],part.vertices[i+j+1],part.vertices[i+j+2])));
            const edges=vertices.map((v,j)=>vertices[(j+1)%3].clone().sub(v));
            const normal=edges[0].clone().cross(edges[1]);
            triangles.push({vertices,edges,normals:[normal,...edges.map(edge=>normal.clone().cross(edge))]});
        }
        return triangles;
    });
}
/** Convex SAT includes coplanar triangle edge axes and contained fascia solids. */
export function pitchedRoofPartsIntersect(a:ConvexPart[],b:ConvexPart[]):boolean {
    return a.some(p=>b.some(q=>{
        const axes=[...p.normals,...q.normals,...p.edges.flatMap(x=>q.edges.map(y=>x.clone().cross(y)))];
        return axes.every(axis=>{
            if(axis.lengthSq()<1e-18)return true;
            const unit=axis.clone().normalize(),ap=p.vertices.map(v=>v.dot(unit)),bp=q.vertices.map(v=>v.dot(unit));
            return Math.min(...ap)<=Math.max(...bp)+1e-7 && Math.min(...bp)<=Math.max(...ap)+1e-7;
        });
    }));
}
