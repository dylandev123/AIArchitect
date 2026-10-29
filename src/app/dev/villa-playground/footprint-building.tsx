'use client';
import { PreciseFacade } from './precise-facade';
import { ArchitecturalLevels } from './architectural-levels';
import { StackedBuilding } from './stacked-building';
import { useMemo,useEffect } from 'react';
import { footprintPlate,validateFootprint,footprintFacadeSegments,type FootprintBuilding as Placement } from '@/lib/villa/footprint';
import { Box,FinishBox,Glazing,Sofa,Slats } from './architecture';
/** One sampled outline drives every plate and facade: no independent roof approximation. */
export function FootprintBuilding({placement:p}:{placement:Placement}) {
  if(p.levels)return <ArchitecturalLevels placement={p} />;
  if(p.stack)return <StackedBuilding placement={p} />;
  return <group name={`Principal footprint · ${p.id}`}>
    <FootprintLevel placement={p} terrace={!!p.upper} furnished={!!p.upper || !!p.volumes} />
    {p.volumes?.map((level,i)=><group key={i} position={[0,p.height+.26,0]}><FootprintLevel placement={{...p,...level,facades:level.facades,preciseOpenings:level.preciseOpenings,upper:undefined,volumes:undefined,id:p.id+'-volume-'+i}} furnished /></group>)}
    {p.upper && <group position={[0,p.height+.26,0]}><FootprintLevel placement={{...p,...p.upper,facades:p.upper.facades,preciseOpenings:p.upper.preciseOpenings,upper:undefined,volumes:undefined,id:p.id+'-upper'}} furnished /></group>}
  </group>;
}
export function FootprintLevel({placement:p,terrace=false,furnished=false,omitRoof=false}:{placement:Placement;terrace?:boolean;furnished?:boolean;omitRoof?:boolean}) {
  const v=useMemo(()=>validateFootprint(p),[p]);
  const seats=useMemo(()=>{
    if(!furnished)return [];
    const inside=(x:number,z:number)=>{let hit=false;for(let i=0,j=v.length-1;i<v.length;j=i++){
      const a=v[i],b=v[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)hit=!hit;
    }return hit;};
    const seats:{x:number;z:number}[]=[];
    for(let x=Math.min(...v.map(q=>q.x))+3;x<Math.max(...v.map(q=>q.x))-2;x+=8)
      for(let z=Math.min(...v.map(q=>q.z))+3;z<Math.max(...v.map(q=>q.z))-2;z+=7){
        // A 2.8m clearance disk contains the rug and all furniture corners.
        const clear=v.every((a,i)=>{const b=v[(i+1)%v.length],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)>=2.8;});
        if(inside(x,z)&&clear)seats.push({x,z});
      }
    return seats.slice(0,12);
  },[v,furnished]);
  const plates=useMemo(()=>[footprintPlate(v,.3),footprintPlate(v,.26),footprintPlate(v,.06)],[v]);
  useEffect(()=>()=>plates.forEach(g=>g.dispose()),[plates]);
  const segments=useMemo(()=>footprintFacadeSegments(p),[p]);
  const palette={ivory:'#e4dfd1',sand:'#d4c5ab',limestone:'#cabc9d','warm-stone':'#b6a080'};
  const color=palette[p.material];
  return <group name={`Footprint building · ${p.id}`} position={[p.x,.47,p.z]} rotation={[0,p.orientation*Math.PI/180,0]}>
    {plates.map((g,i)=>i===1&&omitRoof?null:<mesh key={i} name={['footprint-floor','footprint-roof','footprint-soffit'][i]} geometry={g} position={[0,i===0?-.3:i===1?p.height:p.height-.06,0]} castShadow receiveShadow><meshStandardMaterial color={i===2?'#997a54':color} roughness={.78}/></mesh>)}
    {seats.map((s,i)=><group key={`seating-${i}`} position={[s.x,0,s.z]}>
      <FinishBox name="footprint-woven-rug" at={[0,.025,0]} size={[3.8,.04,3.6]} color="#b8b19a" surface="render" />
      <Sofa at={[0,.04,-.9]} width={2.8} />
      <FinishBox name="footprint-coffee-table" at={[0,.44,.55]} size={[1.3,.18,.65]} color="#a99b7c" />
    </group>)}
    {p.preciseOpenings!==undefined && p.points.map((a,edge)=>{
      const b=p.points[(edge+1)%p.points.length],length=Math.hypot(b.x-a.x,b.z-a.z);
      const openings=p.preciseOpenings!.filter(o=>o.edge===edge);
      const section=p.facades?.find(s=>s.edges.includes(edge));
      if(!openings.length||a.curve||(section&&section.treatment!=='solid'))return null; // Curved solid edges retain the sampled shell below.
      return <group key={`precise-${edge}`} name={`Precise facade · edge ${edge}`} position={[a.x,0,a.z]} rotation={[0,-Math.atan2(b.z-a.z,b.x-a.x),0]}>
        <PreciseFacade length={length} height={p.height} openings={openings} color={palette[section?.material??p.material]} surface={(section?.material??p.material).includes('stone')?'stone':'render'}/>
        {terrace&&<Glazing at={[length/2,p.height+.83,0]} width={length} height={1.1} railing/>}
      </group>;
    })}
    {segments.filter(s=>!p.preciseOpenings?.some(o=>o.edge===s.edge)).map(({a,b,index:i,edge,bay,count,outward,section})=>{const length=Math.hypot(b.x-a.x,b.z-a.z),solid=p.openings==='private'?i%4!==0:p.openings==='rhythm'?i%3===0:i%12===0;
      if(section)return <group key={i} name={`Facade ${section.treatment} · edge ${edge}`} position={[(a.x+b.x)/2,0,(a.z+b.z)/2]} rotation={[0,-Math.atan2(b.z-a.z,b.x-a.x),0]}>
        <ArticulatedBay length={length} height={p.height} treatment={section.treatment==='entrance' && Math.abs(bay-(count-1)/2)>1?'solid':section.treatment} color={palette[section.material??p.material]} outward={outward} rhythm={bay%3===0} start={bay===0} end={bay===count-1} />
        {terrace && (section.terraceEdge==='solid'?<FinishBox name="terrace-parapet" at={[0,p.height+.72,0]} size={[length+.04,.9,.22]} color={palette[section.material??p.material]}/>:<Glazing at={[0,p.height+.83,0]} width={length} height={1.1} railing />)}
      </group>;
      return <group key={i} position={[(a.x+b.x)/2,0,(a.z+b.z)/2]} rotation={[0,-Math.atan2(b.z-a.z,b.x-a.x),0]}>
        {solid?<FinishBox name="footprint-wall" at={[0,p.height/2,0]} size={[length+.045,p.height,.24]} color={color} surface={p.material.includes('stone')?'stone':'render'}/>:<>
          <FinishBox name="footprint-spandrel" at={[0,.22,0]} size={[length+.03,.44,.24]} color={color}/>
          <Glazing at={[0,(p.height+.44-.22)/2,0]} width={length+.015} height={p.height-.66} panels={1}/>
          <FinishBox name="footprint-lintel" at={[0,p.height-.11,0]} size={[length+.03,.22,.24]} color={color}/>
        </>}
        {terrace && <Glazing at={[0,p.height+.83,0]} width={length} height={1.1} railing />}
        <Box at={[-length/2,p.height/2,0]} size={[.09,p.height,.26]} color="#795239"/>
      </group>;
    })}
  </group>;
}

/** Shade stays under the original roof. Recess returns close every bay, including section transitions. */
function ArticulatedBay({length:w,height:h,treatment:t,color,outward:o,rhythm,start,end}:{length:number;height:number;treatment:string;color:string;outward:number;rhythm:boolean;start:boolean;end:boolean}){
 const recess=['loggia','screen','colonnade','entrance'].includes(t)?(t==='loggia'?1.5:.8):0;
 const z=-o*recess,doorHeight=Math.min(3.6,h*.76);
 return <group name={`Articulation · ${t}`}>
  {t==='solid'?<FinishBox name="articulated-masonry" at={[0,h/2,0]} size={[w+.04,h,.3]} color={color} surface="stone"/>:<>
   <Glazing at={[0,h/2,z]} width={w+.025} height={h-.32} panels={1}/>
   <FinishBox name="articulated-header" at={[0,h-.2,z]} size={[w+.04,.4,.28]} color={color}/>
   <FinishBox name="articulated-sill" at={[0,.13,z]} size={[w+.04,.26,.28]} color={color}/>
  </>}
  {recess>0&&<>
   <FinishBox name="shade-soffit" at={[0,h-.13,-o*recess/2]} size={[w+.05,.16,recess+.15]} color={t==='colonnade'?color:'#795239'} surface={t==='colonnade'?'render':'timber'}/>
   {([-1,1].filter(s=>s<0?start:end)).map(s=><FinishBox key={s} name="recess-return" at={[s*w/2,h/2,-o*recess/2]} size={[.09,h,recess]} color={color}/>)}
  </>}
  {(t==='screen'||(t==='loggia'&&rhythm))&&<Slats at={[-w/2+.1,h/2,-o*.16]} count={t==='screen'?4:1} spacing={w/4} size={[t==='screen'?.085:.12,h-.32,.38]} />}
  {t==='colonnade'&&<>
   <FinishBox name="loggia-deep-beam" at={[0,h-.38,0]} size={[w+.04,.75,.55]} color={color}/>
   {rhythm&&<FinishBox name="loggia-pier" at={[-w/2,h/2,0]} size={[.4,h,.5]} color={color} surface="stone"/>}
  </>}
  {t==='entrance'&&<>
   <FinishBox name="entrance-timber-door" at={[0,doorHeight/2,z+o*.08]} size={[w*.78,doorHeight,.16]} color="#6c4b32" surface="timber"/>
   <Box at={[w*.23,Math.min(1.4,doorHeight*.52),z+o*.2]} size={[.035,.8,.04]} color="#c5ac78"/>
   <FinishBox name="entrance-portal" at={[0,h-.25,0]} size={[w+.06,.5,.8]} color={color} surface="stone"/>
  </>}
 </group>;
}
