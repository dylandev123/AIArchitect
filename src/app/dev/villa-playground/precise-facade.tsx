"use client";
import { preciseWallPanels, type FootprintBuilding } from '@/lib/villa/footprint';
import { Box,FinishBox,Glazing } from './architecture';
/** Shared real wall cutouts for footprint levels and rectangular wings. */
export function PreciseFacade({length,height,openings,color,surface='render'}:{length:number;height:number;openings:NonNullable<FootprintBuilding['preciseOpenings']>;color:string;surface?:'stone'|'render'}){
 return <group name="Precisely placed exterior openings">
        {preciseWallPanels(length,height,openings).map((r,i)=><FinishBox key={i} name="opening-masonry" at={[r.x,r.y,0]} size={[r.width,r.height,.24]} color={color} surface={surface}/>)}
        {openings.map(o=>{const x=o.offset+o.width/2,y=o.sill+o.height/2,frame={bronze:'#69533c',timber:'#64452f',ivory:'#e4dfd1'}[o.frame];return <group key={o.id} name={`Precise ${o.kind} · ${o.id}`}>
          {o.kind==='window'?<Glazing at={[x,y,0]} width={o.width-.1} height={o.height-.1} panels={1}/>:<FinishBox name="residential-door" at={[x,y,0]} size={[o.width-.1,o.height-.05,.12]} color={frame} surface="timber"/>}
          {[-1,1].map(sign=><FinishBox key={`j${sign}`} name="opening-jamb" at={[x+sign*(o.width/2-.025),y,0]} size={[.05,o.height,.3]} color={frame}/>)}
          {[-1,1].map(sign=><FinishBox key={`h${sign}`} name="opening-frame" at={[x,y+sign*(o.height/2-.025),0]} size={[o.width,.05,.3]} color={frame}/>)}
          {o.kind==='door'&&<Box at={[x+o.width*.32,1.05,.09]} size={[.035,.35,.04]} color="#c5ac78"/>}
        </group>;})}
 </group>;
}
