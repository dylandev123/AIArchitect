'use client';
import { useMemo } from 'react';
import type { FootprintBuilding } from '@/lib/villa/footprint';
import { resolveStack,rectangleFromPoints,rectanglePoints,exposedRoof,roofRails } from '@/lib/villa/stacked-volumes';
import { FootprintLevel } from './footprint-building';
import { FinishBox,Glazing,Sofa,Slats } from './architecture';

export function StackedBuilding({placement:p}:{placement:FootprintBuilding}){
 const levels=useMemo(()=>{
  const base={...rectangleFromPoints(p.points),id:'base',parentId:'',height:p.height,bottom:0,level:0,rooftop:p.rooftop??'none'};
  return [base,...resolveStack(base,p.height,p.stack??[])];
 },[p]);
 return <group name={`Principal footprint · ${p.id}`} position={[p.x,0,p.z]} rotation={[0,p.orientation*Math.PI/180,0]}>
  {levels.map(v=>{
   const roof=v.bottom+v.height+.26,above=levels.filter(o=>o.bottom>=roof-.001);
   const furniture=exposedRoof(v,above,1).filter(c=>c.width>=5.6&&c.depth>=5.6).sort((a,b)=>b.width*b.depth-a.width*a.depth).flatMap(c=>{
    const nx=Math.min(2,Math.max(1,Math.floor(c.width/9))),nz=Math.min(2,Math.max(1,Math.floor(c.depth/8)));
    return Array.from({length:nx*nz},(_,i)=>({x:c.x-c.width/2+(i%nx+.5)*c.width/nx,z:c.z-c.depth/2+(Math.floor(i/nx)+.5)*c.depth/nz,width:c.width/nx,depth:c.depth/nz}));
   }).slice(0,3);
   return <group key={v.id} name={`Stack volume · ${v.id} · level ${v.level+1}`}>
    <group position={[0,v.bottom,0]}><FootprintLevel placement={{...p,id:p.id+'-'+v.id,x:0,z:0,orientation:0,height:v.height,points:rectanglePoints(v),facades:v.id==='base'?p.facades:undefined,stack:undefined,upper:undefined,volumes:undefined}} furnished omitRoof /></group>
    {exposedRoof(v,levels.filter(o=>Math.abs(o.bottom-roof)<.001)).map((c,i)=><FinishBox key={`roof-${i}`} name="coordinated-exposed-roof-slab" at={[c.x,.47+roof-.13,c.z]} size={[c.width,.26,c.depth]} color={{ivory:"#e4dfd1",sand:"#d4c5ab",limestone:"#cabc9d","warm-stone":"#b6a080"}[p.material]} />)}
    {v.rooftop!=='none'&&<group position={[0,.47+roof,0]} name={`Exposed rooftop · ${v.id}`}>
     {roofRails(v,above.filter(o=>o.bottom<roof+1.1)).map((r,i)=><Glazing key={i} at={[r.x,.55,r.z]} width={r.length} height={1.1} railing side={r.side}/>)}
     {(v.rooftop==='lounge'||v.rooftop==='shaded')&&furniture.map((c,i)=>{
      const w=Math.min(c.width-1,9),d=Math.min(c.depth-1,7);
      return <group key={i} position={[c.x,0,c.z]} name="Rooftop entertainment with clear perimeter">
       <FinishBox name="roof-deck" at={[0,.025,0]} size={[w,.05,d]} color="#9a8060" surface="timber"/>
       <Sofa at={[0,.06,-d/2+1.1]} width={Math.min(4,w-1)}/>
       <Sofa at={[-w/2+1.1,.06,1]} width={2.4}/>
       <FinishBox name="roof-lounge-table" at={[0,.48,0]} size={[1.8,.2,.85]} color="#b9aa8b"/>
       <FinishBox name="roof-bar" at={[w/2-.6,.58,0]} size={[.8,1.1,2.4]} color="#c8b796"/>
       {v.rooftop==='shaded'&&i===0&&<group name="Rooftop pergola">
        {[-1,1].flatMap(x=>[-1,1].map(z=><FinishBox key={`${x}${z}`} name="pergola-post" at={[x*(w/2-.2),1.5,z*(d/2-.2)]} size={[.15,3,.15]} surface="timber" color="#71563d"/>))}
        <Slats at={[-w/2+.1,3.05,0]} count={Math.ceil(w/.35)} spacing={.35} size={[.12,.18,d]} color="#71563d"/>
       </group>}
      </group>;
     })}
    </group>}
   </group>;
  })}
 </group>;
}
