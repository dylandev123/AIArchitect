/** Actual mesh-plane intersections; not intent-diagram substitutes. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Vector3} from 'three';
import {physicalMeshes} from '../src/lib/villa/experimental/semantic-building/physical';
import type {compileBuilding} from '../src/lib/villa/experimental/semantic-building/compiler';
const experimental=process.argv.includes('--semantic-generation');
const dir=experimental?'docs/architecture/semantic-generation':'docs/architecture/semantic-building-proof';
for(const name of experimental?['family','luxury']:['estate','compact']){
 const r=JSON.parse(readFileSync(`${dir}/${name}.json`,'utf8')) as ReturnType<typeof compileBuilding>;
 const {meshes,dispose}=physicalMeshes(r.scene,false),f=r.intent.frame;
 const local=(v:Vector3)=>{const dx=v.x-f.origin[0],dz=v.z-f.origin[1];return [Math.cos(f.yaw)*dx-Math.sin(f.yaw)*dz,v.y,Math.sin(f.yaw)*dx+Math.cos(f.yaw)*dz];};
 const views=r.intent.levels.map(l=>({id:`plan-${l.id}`,axis:1,cut:l.top+1.1,axes:[0,2],title:`Plan ${l.id} · mesh cut +1.1m above walking datum`}));
 views.push({id:'section',axis:0,cut:r.intent.stairs[0]?.start[0]??2,axes:[2,1],title:'Longitudinal section through actual stair / gallery meshes'});
 for(const view of views){
  const segments:number[][][]=[];
  for(const mesh of meshes){const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),p=geometry.getAttribute('position');
   for(let i=0;i<p.count;i+=3){const tri=[0,1,2].map(j=>local(new Vector3().fromBufferAttribute(p,i+j).applyMatrix4(mesh.matrixWorld))),hits:number[][]=[];
    for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],da=a[view.axis]-view.cut,db=b[view.axis]-view.cut;if((da<0&&db>=0)||(db<0&&da>=0)){const t=da/(da-db);hits.push(a.map((v,k)=>v+t*(b[k]-v)));}}
    if(hits.length===2)segments.push(hits.map(v=>[v[view.axes[0]],view.axis===0?-v[view.axes[1]]:v[view.axes[1]]]));
   }geometry.dispose();
  }
  const points=segments.flat(),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),lo=[Math.min(...xs)-1,Math.min(...ys)-1],hi=[Math.max(...xs)+1,Math.max(...ys)+1];
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1000" viewBox="${lo[0]} ${lo[1]-2} ${hi[0]-lo[0]} ${hi[1]-lo[1]+3}"><rect x="${lo[0]}" y="${lo[1]-2}" width="${hi[0]-lo[0]}" height="${hi[1]-lo[1]+3}" fill="#faf8f1"/><text x="${lo[0]+.3}" y="${lo[1]-1}" font-size=".35">${name} · ${view.title} · metres · offline mock / developer study</text><g stroke="#243d37" stroke-width=".035" fill="none">${segments.map(s=>`<path d="M${s[0]} L${s[1]}"/>`).join('')}</g></svg>`;
  writeFileSync(`${dir}/${name}.${view.id}.svg`,svg);
 }dispose();
}
