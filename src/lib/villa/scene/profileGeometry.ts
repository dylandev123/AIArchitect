import { z } from 'zod';
import { ExtrudeGeometry, Path, Shape, Vector2 } from 'three';

const coordinate = z.number().finite().min(-.5).max(.5);
const point = z.array(coordinate).length(2);
const ring = z.array(point).min(3).max(128);
/** Profiles occupy the full normalized bounding rectangle. size supplies metres.
 * Axis y: profile X/Z; axis z: X/Y; axis x: Z/Y. No executable input. */
export const profileGeometrySchema = z.union([
    z.object({type:z.literal('extrusion'),axis:z.enum(['x','y','z']),outline:ring,holes:z.array(ring).max(8).default([])}).strict(),
    z.object({type:z.literal('arc'),axis:z.enum(['x','y','z']),start:z.number().finite().min(-Math.PI*2).max(Math.PI*2),sweep:z.number().finite().min(.05).max(Math.PI*2),innerRatio:z.number().finite().min(.01).max(.999),segments:z.number().int().min(4).max(64)}).strict(),
]);
export type ProfileGeometry = z.infer<typeof profileGeometrySchema>;
type P = number[];
const cross=(a:P,b:P,c:P)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function on(a:P,b:P,p:P){return Math.abs(cross(a,b,p))<1e-9&&p[0]>=Math.min(a[0],b[0])-1e-9&&p[0]<=Math.max(a[0],b[0])+1e-9&&p[1]>=Math.min(a[1],b[1])-1e-9&&p[1]<=Math.max(a[1],b[1])+1e-9;}
function intersects(a:P,b:P,c:P,d:P){return (cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
function inside(p:P,r:P[]){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if(on(a,b,p))return false;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
export function profileRings(g:ProfileGeometry):{outline:number[][];holes:number[][][]} {
    if(g.type==='extrusion')return g;
    const full=Math.abs(g.sweep-Math.PI*2)<1e-8;
    const points=(radius:number)=>Array.from({length:g.segments+(full?0:1)},(_,i)=>{const t=g.start+g.sweep*i/g.segments;return [Math.cos(t)*radius,Math.sin(t)*radius];});
    const outer=points(1),inner=points(g.innerRatio);
    const outline=full?outer:[...outer,...inner.reverse()];
    const holes=full?[inner.reverse()]:[];
    const all=[...outline,...holes.flat()];
    const lo=[0,1].map(i=>Math.min(...all.map(p=>p[i]))),hi=[0,1].map(i=>Math.max(...all.map(p=>p[i])));
    const normalize=(r:number[][])=>r.map(p=>p.map((v,i)=>(v-lo[i])/(hi[i]-lo[i])-.5));
    return {outline:normalize(outline),holes:holes.map(normalize)};
}
export function validateProfile(g:ProfileGeometry){
    const {outline,holes}=profileRings(g),rings=[outline,...holes];
    if(rings.reduce((n,r)=>n+r.length,0)>256)throw Error('Profile vertex budget exceeded');
    for(const r of rings){
        let area=0;
        for(let i=0;i<r.length;i++){
            const a=r[i],b=r[(i+1)%r.length];
            if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-7)throw Error('Profile has duplicate adjacent vertices');
            area+=a[0]*b[1]-b[0]*a[1];
            for(let j=i+1;j<r.length;j++)if(j!==i+1&&!(i===0&&j===r.length-1)&&intersects(a,b,r[j],r[(j+1)%r.length]))throw Error('Profile self-intersection');
        }
        if(Math.abs(area)<1e-7)throw Error('Profile has zero area');
    }
    for(let i=0;i<rings.length;i++)for(let j=i+1;j<rings.length;j++){
        const a=rings[i],b=rings[j];
        if(a.some((p,k)=>b.some((q,l)=>intersects(p,a[(k+1)%a.length],q,b[(l+1)%b.length]))))throw Error('Profile rings intersect');
        if(i>0&&(inside(a[0],b)||inside(b[0],a)))throw Error('Nested profile holes are unsupported');
    }
    if(holes.some(h=>!inside(h[0],outline)))throw Error('Profile hole must be inside outline');
    for(const axis of [0,1])if(Math.abs(Math.min(...outline.map(p=>p[axis]))+.5)>1e-7||Math.abs(Math.max(...outline.map(p=>p[axis]))-.5)>1e-7)throw Error('Profile outline must span [-0.5,0.5] on both axes');
}
/** Shared renderer and geometric checks; all surfaces are bounded closed extrusions. */
export function buildProfileGeometry(g:ProfileGeometry,size:readonly number[]){
    const {outline,holes}=profileRings(g);
    const shape=new Shape(outline.map(p=>new Vector2(p[0],p[1])));
    shape.holes=holes.map(r=>new Path(r.map(p=>new Vector2(p[0],p[1]))));
    const geometry=new ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1,curveSegments:1});
    const p=geometry.getAttribute('position');
    for(let i=0;i<p.count;i++){
        const u=p.getX(i),v=p.getY(i),w=p.getZ(i)-.5;
        const xyz=g.axis==='y'?[u,w,v]:g.axis==='z'?[u,v,w]:[w,v,u];
        p.setXYZ(i,xyz[0]*size[0],xyz[1]*size[1],xyz[2]*size[2]);
    }
    // y/x mappings reflect handedness; reverse each triangle's winding.
    if(g.axis!=='z')for(let i=0;i<p.count;i+=3)for(let a=0;a<3;a++){const v=p.getComponent(i+1,a);p.setComponent(i+1,a,p.getComponent(i+2,a));p.setComponent(i+2,a,v);}
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    return geometry;
}
