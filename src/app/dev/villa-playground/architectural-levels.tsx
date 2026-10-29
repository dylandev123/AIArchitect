'use client';
import { useMemo } from 'react';
import { footprintOutline, resolveArchitecturalLevels, type FootprintBuilding, type PlanPoint } from '@/lib/villa/footprint';
import { FootprintLevel } from './footprint-building';
import { FinishBox, Glazing, Sofa, Slats } from './architecture';

export function insideOutline(q:PlanPoint,v:PlanPoint[]){
 let hit=false;for(let i=0,j=v.length-1;i<v.length;j=i++){
  const a=v[i],b=v[j];if((a.z>q.z)!==(b.z>q.z)&&q.x<(b.x-a.x)*(q.z-a.z)/(b.z-a.z)+a.x)hit=!hit;
 }return hit;
}
const distance=(q:PlanPoint,a:PlanPoint,b:PlanPoint)=>{
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.z-a.z)*dz)/(dx*dx+dz*dz)));
 return Math.hypot(q.x-a.x-t*dx,q.z-a.z-t*dz);
};
/** Original outlines and source-edge facades survive the support graph unchanged. */
export function ArchitecturalLevels({placement:p}:{placement:FootprintBuilding}){
 const levels=useMemo(()=>resolveArchitecturalLevels(p),[p]);
 return <group name={`Architectural support graph · ${p.id}`} position={[p.x,0,p.z]} rotation={[0,p.orientation*Math.PI/180,0]}>
  {levels.map(l=>{
   const outline=footprintOutline(l),roof=l.bottom+l.height+.26;
   const obstacles=levels.filter(o=>o.bottom>=roof-.001).map(o=>({outline:footprintOutline(o),bottom:o.bottom}));
   const clear=(q:PlanPoint,r:number)=>insideOutline(q,outline)&&outline.every((a,i)=>distance(q,a,outline[(i+1)%outline.length])>=r)&&obstacles.every(o=>!insideOutline(q,o.outline)&&o.outline.every((a,i)=>distance(q,a,o.outline[(i+1)%o.outline.length])>=r));
   const seats:PlanPoint[]=[];
   const minX=Math.min(...outline.map(q=>q.x)),maxX=Math.max(...outline.map(q=>q.x)),minZ=Math.min(...outline.map(q=>q.z)),maxZ=Math.max(...outline.map(q=>q.z));
   const nx=Math.max(1,Math.floor((maxX-minX)/7)),nz=Math.max(1,Math.floor((maxZ-minZ)/7));
   if(l.rooftop==='lounge'||l.rooftop==='shaded')for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    const q={x:minX+(i+.5)*(maxX-minX)/nx,z:minZ+(j+.5)*(maxZ-minZ)/nz};if(clear(q,3.2))seats.push(q);
   }
   return <group key={l.id} name={`Architectural volume · ${l.id} · storey ${l.level+1}`}>
    <group position={[0,l.bottom,0]}><FootprintLevel placement={{...p,...l,id:p.id+'-'+l.id,x:0,z:0,orientation:0,levels:undefined,stack:undefined,upper:undefined,volumes:undefined}} furnished /></group>
    {l.rooftop!=='none'&&<group position={[0,.47+roof,0]} name={`Architectural rooftop · ${l.id}`}>
     {outline.map((a,i)=>{
      const b=outline[(i+1)%outline.length],n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.4);
      // Clip each short span against upper facade shells, including cantilevers.
      const spans:{start:number;end:number}[]=[];
      for(let j=0;j<n;j++){
       const q={x:a.x+(b.x-a.x)*(j+.5)/n,z:a.z+(b.z-a.z)*(j+.5)/n};
       if(obstacles.some(o=>o.bottom<roof+1.1&&(insideOutline(q,o.outline)||o.outline.some((c,k)=>distance(q,c,o.outline[(k+1)%o.outline.length])<.55))))continue;
       const last=spans.at(-1);if(last&&Math.abs(last.end-j/n)<1e-8)last.end=(j+1)/n;else spans.push({start:j/n,end:(j+1)/n});
      }
      return spans.map(({start,end},j)=><group key={`${i}-${j}`} position={[a.x+(b.x-a.x)*(start+end)/2,0,a.z+(b.z-a.z)*(start+end)/2]} rotation={[0,-Math.atan2(b.z-a.z,b.x-a.x),0]}><Glazing at={[0,.55,0]} width={Math.hypot(b.x-a.x,b.z-a.z)*(end-start)} height={1.1} railing /></group>);
     })}
     {seats.slice(0,3).map((q,i)=><group key={i} position={[q.x,0,q.z]} name="Clear architectural roof lounge">
      <FinishBox name="architectural-roof-deck" at={[0,.025,0]} size={[4.4,.05,4.4]} color="#9a8060" surface="timber"/>
      <Sofa at={[0,.06,-1.2]} width={3}/><FinishBox name="architectural-roof-table" at={[0,.45,.5]} size={[1.6,.2,.8]} color="#b9aa8b"/>
      {l.rooftop==='shaded'&&i===0&&<group name="Architectural roof pergola">
       {[-2,2].flatMap(x=>[-2,2].map(z=><FinishBox name="architectural-pergola-post" key={`${x}-${z}`} at={[x,1.5,z]} size={[.15,3,.15]} color="#71563d" surface="timber"/>))}
       <Slats at={[-2,3.05,0]} count={13} spacing={.33} size={[.12,.18,4.4]} color="#71563d"/>
      </group>}
     </group>)}
    </group>}
   </group>;
  })}
 </group>;
}
