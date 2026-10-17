// CPU z-buffer geometry review: matched orthographic camera and Lambert light.
// Glass is shown opaque blue for reliable geometry inspection; this is not PBR QA.
import fs from 'node:fs';
import sharp from 'sharp';
import {Vector3,Euler} from 'three';
const phase=process.argv[2]??'after',data=JSON.parse(fs.readFileSync(`docs/architecture/parity/${phase}.json`));
for(const view of ['front','entry']){
 const W=1600,H=720,pixels=Buffer.alloc(W*H*3),depth=new Float64Array(W*H).fill(-Infinity);
 for(let i=0;i<W*H;i++){pixels[i*3]=220;pixels[i*3+1]=228;pixels[i*3+2]=229;}
 const forward=new Vector3(view==='front'?30:-28,23,view==='front'?37:-36).normalize(),right=new Vector3().crossVectors(new Vector3(0,1,0),forward).normalize(),up=new Vector3().crossVectors(forward,right),light=new Vector3(15,30,20).normalize();
 for(const [side,key] of ['v2','v3'].entries())for(const p of data[key].primitives){
   if(p.id==='v3-terrain-surface')continue;
   let vertices=[];
   if(p.kind==='triMesh')vertices=p.vertices;
   if(p.kind==='box'){
    const corners=[];for(let i=0;i<8;i++)corners.push(new Vector3((i&1?1:-1)*p.size[0]/2,(i&2?1:-1)*p.size[1]/2,(i&4?1:-1)*p.size[2]/2).applyEuler(new Euler(...p.rotation)).add(new Vector3(...p.position)));
    for(const face of [[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]])for(const i of [face[0],face[1],face[2],face[0],face[2],face[3]])vertices.push(...corners[i].toArray());
   }
   for(let i=0;i<vertices.length;i+=9){
    const pts=[0,3,6].map(j=>new Vector3(...vertices.slice(i+j,i+j+3)));const normal=new Vector3().crossVectors(pts[1].clone().sub(pts[0]),pts[2].clone().sub(pts[0])).normalize();const shade=.6+.4*Math.abs(normal.dot(light));const hex=(p.color??'#aaaaaa').replace('#','');const rgb=[0,2,4].map(k=>Math.round(parseInt(hex.slice(k,k+2),16)*shade));
    const q=pts.map(p=>[side*800+410+(p.dot(right)+2)*19,390-p.dot(up)*19,p.dot(forward)]);
    const [a,b,c]=q,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-8)continue;
    for(let y=Math.max(0,Math.floor(Math.min(...q.map(p=>p[1]))));y<=Math.min(H-1,Math.ceil(Math.max(...q.map(p=>p[1]))));y++)for(let x=Math.max(side*800,Math.floor(Math.min(...q.map(p=>p[0]))));x<=Math.min(side*800+799,Math.ceil(Math.max(...q.map(p=>p[0]))));x++){
     const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den,v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den,t=1-u-v;
     if(Math.min(u,v,t)<0)continue;const z=u*a[2]+v*b[2]+t*c[2],idx=y*W+x;if(z<=depth[idx])continue;depth[idx]=z;for(let k=0;k<3;k++)pixels[idx*3+k]=rgb[k];
    }
   }
 }
 const labels=Buffer.from(`<svg width="1600" height="720"><text x="25" y="35" font-family="sans-serif" font-size="22">V2 · ${phase} · ${view}</text><text x="825" y="35" font-family="sans-serif" font-size="22">V3 · ${phase} · ${view}</text></svg>`);
 await sharp(pixels,{raw:{width:W,height:H,channels:3}}).composite([{input:labels}]).png().toFile(`docs/architecture/parity/${phase}-${view}.png`);
}
