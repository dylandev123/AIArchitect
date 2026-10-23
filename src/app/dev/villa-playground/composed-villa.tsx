"use client";

import { memo } from 'react';
import * as THREE from 'three';
import { Vegetation } from '@/components/workspace/viewport/scenery/vegetation';
import { Box, FinishBox, Glazing, Roof, Slats, Sofa } from './architecture';
import { Facade, PitchedRoof, Veranda, Wall } from './villa-kit';
import { Parasol, Planter, Pool, SunLounger } from './grounds';
import { TropicalPalm } from './tropical-palm';
import { wallContacts, type Wing, type WingComposition } from './wing-composition';

import { CurvedPavilion } from './curved-pavilion';
import { EstateGrounds } from './estate-grounds';

const BASE = .47;
function WallPanel({width,height,composition,back,entrance=false}:{width:number;height:number;composition:WingComposition;back:boolean;entrance?:boolean}) {
  return width < 1.8 ? <Wall name="junction-pier" at={[0,height/2,0]} size={[width,height,.28]} config={composition.config} /> : <Facade width={width} height={height} config={composition.config} back={back} entrance={entrance} />;
}
/** Four rectangular slab pieces leave a real opening over the upper stair run. */
function FloorPlate({wing:w,y,thickness,opening=false}:{wing:Wing;y:number;thickness:number;opening?:boolean}) {
  if(!opening) return <FinishBox name="wing-slab" at={[0,y,0]} size={[w.width,thickness,w.depth]} color="#d6ccb7" />;
  const a=-w.width/2+2.6,b=-w.width/2+6.15,rear=-w.depth/2+.3,front=rear+1.4;
  return <group name="Slab with stairwell opening">
    <FinishBox name="slab-front" at={[0,y,(front+w.depth/2)/2]} size={[w.width,thickness,w.depth/2-front]} color="#d6ccb7" />
    <FinishBox name="slab-rear" at={[0,y,(-w.depth/2+rear)/2]} size={[w.width,thickness,rear+w.depth/2]} color="#d6ccb7" />
    <FinishBox name="slab-left" at={[(-w.width/2+a)/2,y,(rear+front)/2]} size={[a+w.width/2,thickness,front-rear]} color="#d6ccb7" />
    <FinishBox name="slab-right" at={[(b+w.width/2)/2,y,(rear+front)/2]} size={[w.width/2-b,thickness,front-rear]} color="#d6ccb7" />
  </group>;
}
/** Cut shared wall spans locally, retaining a lintel above a lower connecting gallery. */
function WingWall({ wing, composition, face, level, width, y, height }: {
  wing: Wing; composition: WingComposition; face: 'front'|'rear'|'left'|'right'; level: number; width: number; y: number; height: number;
}) {
  const contacts = wallContacts(wing, composition.wings, face).filter(c => c.height > level * wing.storeyHeight);
  // Side facades run in opposite tangent directions after their local rotation.
  const flip = face === 'right' || face === 'rear';
  const cuts = contacts.map(c => ({ start: flip ? -c.end : c.start, end: flip ? -c.start : c.end, height: c.height })).sort((a,b) => a.start-b.start);
  const panels = []; let cursor = -width / 2;
  for (const [i,c] of cuts.entries()) {
    const start = Math.max(-width/2,c.start), end = Math.min(width/2,c.end);
    if (start > cursor + .08) panels.push(<group key={`wall-${i}`} position={[(cursor+start)/2,0,0]}><WallPanel width={start-cursor} height={height} composition={composition} back={face !== 'front'} /></group>);
    const opening = Math.min(height, c.height-level*wing.storeyHeight-.12);
    if (opening < height) panels.push(<Wall key={`lintel-${i}`} name="gallery-junction-lintel" at={[(start+end)/2,opening+(height-opening)/2,0]} size={[end-start,height-opening,.28]} config={composition.config} />);
    cursor = Math.max(cursor,end);
  }
  if (cursor < width/2-.08) panels.push(<group key="last" position={[(cursor+width/2)/2,0,0]}><WallPanel width={width/2-cursor} height={height} composition={composition} back={face !== 'front'} entrance={wing.role === 'main' && level === 0 && face === 'rear'} /></group>);
  return <group position={[0,y,0]}>{panels}</group>;
}
function ComposedWing({ wing: w, composition: c }: { wing: Wing; composition: WingComposition }) {
  const gallery = w.role === 'gallery', h = w.storeyHeight, wall = h-.24;
  const balcony = w.storeys === 2 ? w.balcony ?? 0 : 0;
  const roofY = BASE+w.storeys*h;
  // Verandas occupy only an exposed front span; connectors and neighbouring wings reserve their contact spans.
  const contacts = wallContacts(w,c.wings,'front');
  const spans: [number,number][] = []; let cursor = -w.width/2;
  for (const contact of contacts) { if (contact.start-cursor > 2.5) spans.push([cursor,contact.start]); cursor=Math.max(cursor,contact.end); }
  if(w.width/2-cursor > 2.5) spans.push([cursor,w.width/2]);
  return <group position={[w.x,0,w.z]} rotation={[0,w.orientation*Math.PI/180,0]} name={`Wing ${w.id} · ${w.role} · ${w.storeys} storeys`}>
    {Array.from({length:w.storeys},(_,level) => {
      const y=BASE+level*h, inset=level ? balcony : 0, front=w.depth/2-inset, depth=w.depth-inset;
      return <group key={level}>
        <FloorPlate wing={w} y={y-.15} thickness={.3} opening={level>0} />
        <FloorPlate wing={w} y={y+h-.12} thickness={.24} opening={w.storeys===2 && level===0} />
        <group position={[0,0,front]}><WingWall wing={w} composition={c} face="front" level={level} width={w.width} y={y} height={wall} /></group>
        <group position={[0,0,-w.depth/2]} rotation={[0,Math.PI,0]}><WingWall wing={w} composition={c} face="rear" level={level} width={w.width} y={y} height={wall} /></group>
        {([-1,1] as const).map(s=><group key={s} position={[s*w.width/2,0,-inset/2]} rotation={[0,s*Math.PI/2,0]}>
          <WingWall wing={w} composition={c} face={s===1?'right':'left'} level={level} width={depth} y={y} height={wall} />
        </group>)}
        {!gallery && <>
          <FinishBox name="woven-interior-rug" at={[0,y+.015,-.3]} size={[w.width*.62,.025,depth*.52]} color="#b8b19a" surface="render" />
          <Sofa at={[-w.width*.14,y+.03,front-2]} width={Math.min(3.8,w.width*.5)} />
          <FinishBox name="wing-coffee-table" at={[0,y+.46,front-1.1]} size={[1.5,.18,.75]} color="#a99b7c" />
          <FinishBox name="timber-storage" at={[w.width*.18,y+.55,-w.depth/2+.5]} size={[w.width*.4,1.1,.6]} surface="timber" color="#8e7050" />
          <Box at={[0,y+wall-.12,front-.18]} size={[w.width*.8,.026,.03]} color="#ffe1a0" glow />
        </>}
        {level>0 && <>
          {[.3,1.7].map(z=><Glazing key={z} at={[-w.width/2+4.375,y+.55,-w.depth/2+z]} width={3.55} height={1.1} railing />)}
          <Glazing at={[-w.width/2+2.6,y+.55,-w.depth/2+1]} width={1.4} height={1.1} railing side />
        </>}
        {level>0 && balcony>0 && <>
          <Glazing at={[0,y+.57,w.depth/2-.08]} width={w.width-.2} height={1.1} railing />
          {[-1,1].map(s=><Glazing key={s} at={[s*(w.width/2-.08),y+.57,w.depth/2-balcony/2]} width={balcony} height={1.1} railing side />)}
          <Sofa at={[w.width*.24,y+.03,front+balcony*.52]} width={2.3} />
        </>}
      </group>;
    })}
    {gallery ? <Roof at={[0,roofY+.04,0]} size={[w.width+.12,.2,w.depth+.12]} /> : c.config.roof==='flat' ?
      <Roof at={[0,roofY+.06,0]} size={[w.width+1.3,.28,w.depth+1.3]} /> :
      <group position={[0,roofY+.08,0]}><PitchedRoof width={w.width} depth={w.depth} config={c.config} /></group>}
    {!gallery && w.veranda && spans.map(([a,b],i)=><group key={i} position={[(a+b)/2,BASE,w.depth/2+.03]}>
      <Veranda width={b-a-.9} depth={w.veranda!} height={Math.min(3.35,h-.55)} config={c.config} />
    </group>)}
    {!gallery && c.config.style==='modern' && <Slats at={[-w.width/2+.22,BASE+wall/2,w.depth/2+.2]} count={9} spacing={.15} size={[.055,wall,.34]} color="#8b694b" />}
    {/* Compact interior stair in the two-storey main wing, within its envelope. */}
    {w.storeys===2 && <group position={[-w.width/2+1,BASE,-w.depth/2+1]} name="Main wing stair">
      {Array.from({length:22},(_,i)=><FinishBox key={i} name="stair-tread" at={[i*.24,(i+.5)*h/22,0]} size={[.26,h/22,1.25]} color="#baaa8c" />)}
    </group>}
  </group>;
}

export const ComposedVilla = memo(function ComposedVilla({composition:c}:{composition:WingComposition}) {
  return <group name={`Local composition · ${c.id}`}>{c.wings.map(w=><ComposedWing key={w.id} wing={w} composition={c} />)}{[...(c.components ?? []),...(c.experimentalForms ?? [])].map(p=><CurvedPavilion key={p.id} placement={p} />)}</group>;
});
const tint=new THREE.Color('#7e8977');
export const CompositionGrounds = memo(function CompositionGrounds({composition:c}:{composition:WingComposition}) {
  const p=c.pool,g=c.garden,tropical=c.config.landscape==='tropical';
  return <group name={`Grounds · ${c.id}`}>
    <FinishBox name="landscape" at={[g.x,-.61,g.z]} size={[Math.max(500,g.width*3),.2,Math.max(500,g.depth*3)]} color="#788268" surface="grass" />
    <FinishBox name="estate-base" at={[g.x,-.58,g.z]} size={[g.width,.3,g.depth]} color={c.authored ? (tropical ? "#7c8a66" : "#92916e") : "#ada38a"} surface={c.authored ? "grass" : undefined} />
    {c.terraces.map(t=><group key={t.id}>
      <FinishBox name={t.id} at={[t.x,.15,t.z]} size={[t.width,.3,t.depth]} color={t.timber?'#b39b77':'#d3c9b2'} surface={t.timber?'timber':'paving'} />
      <Slats at={[t.x-t.width/2+.6,.304,t.z]} count={Math.max(1,Math.floor(t.width/2.4))} spacing={2.4} size={[.012,.008,t.depth-.1]} color="#b4ae9d" />
    </group>)}
    {p.enabled !== false && <>
    <group position={[p.x+2,0,p.z-12.4]}><Pool width={p.width} depth={p.depth} /></group>
    {[0,1,2].map(i=><SunLounger key={i} at={[p.x+p.width/2+1.5,.3,p.z-1.9+i*1.9]} rotation={Math.PI/2} />)}
    <Parasol at={[p.x+p.width/2+2.2,.3,p.z-1]} />
    <Planter at={[p.x-p.width/2-1.5,.3,p.z-1]} width={1.2} depth={3.2} />
    <Planter at={[p.x,.2,p.z+p.depth/2+1.5]} width={Math.min(8,p.width)} depth={.8} />
    </>}
    {!c.authored && c.id==='courtyard-u' && <group name="Axial courtyard fountain">
      <FinishBox name="fountain-plinth" at={[0,.48,2]} size={[3.2,.35,3.2]} color="#b6a080" />
      <Box at={[0,.67,2]} size={[2.8,.06,2.8]} color="#6a9b8d" />
      <mesh position={[0,1,2]}><sphereGeometry args={[.5,24,16]} /><meshStandardMaterial color="#d5c4a5" roughness={.7} /></mesh>
      {[-5,5].map(x=><Planter key={x} at={[x,.3,5]} width={1.5} depth={1.5} />)}
    </group>}
    {c.estateLandscape ? <EstateGrounds composition={c} /> : <>
    {[-1,1].flatMap(s=>[0,1,2,3].map(i=><group key={`${s}-${i}`} position={[(c.authored?g.x:0)+s*(g.width/2+(c.authored?5:1.5)+i%2*1.6),-.5,c.authored?g.z-g.depth/2+(i+.5)*g.depth/4:-8+i*7]}>
      {tropical ? <TropicalPalm variant={i%2} height={8+i%3} /> : <Vegetation kind={i%2?'cypress':'oak'} variant={0} height={i%2?8:5} tint={tint} />}
    </group>))}
    {[-1,1].flatMap(s=>Array.from({length:12},(_,i)=><group key={`${s}-${i}`} position={[(c.authored?g.x:0)+s*(g.width/2-.7),-.4,c.authored?g.z-g.depth/2+1+i*(g.depth-2)/11:-10+i*2.5]}><Vegetation kind={i%3?'shrub':'shrub-flowering'} variant={i%2} height={.8+i%3*.2} tint={tint} /></group>))}
    {Array.from({length:23},(_,i)=><group key={i} position={[(c.authored?g.x:0)-g.width/2+i*g.width/22,-.5,g.z-g.depth/2-1]}><Vegetation kind="shrub" variant={i%2} height={1+i%3*.2} tint={tint} /></group>)}
    {[-1,1].map(s=><FinishBox key={s} name="arrival-path" at={[(c.authored?g.x:0)+s*(g.width/2-2),-.15,c.authored?g.z:2]} size={[1.4,.2,g.depth-6]} color="#cfc7af" surface="paving" />)}
    </>}
  </group>;
});
