'use client';
import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { Vegetation } from '@/components/workspace/viewport/scenery/vegetation';
import { circulationPlanting, routeSamples, routeVertices, type EstateRoute } from '@/lib/villa/estate-landscape';
import { ellipseArc, ellipsePlate } from '@/lib/villa/experimental/pavilion-geometry';
import { wingBounds, type WingComposition } from './wing-composition';
import { Surface } from './curved-pavilion';
import { Box, FinishBox } from './architecture';
import { TropicalPalm } from './tropical-palm';

const tint=new THREE.Color('#758466');
function Route({route:r}:{route:EstateRoute}) {
  const geometry=useMemo(()=>({edge:routeVertices(r,r.width+.32),pave:routeVertices(r)}),[r]);
  const samples=useMemo(()=>routeSamples(r,7),[r]);
  return <group name={`Circulation ${r.id} · ${r.kind} · ${r.width}m clear`} position={[0,r.kind==='drive'?.1:.16,0]}>
    <Surface name={`${r.id}-stone-edging`} vertices={geometry.edge} color="#d6cbb2" surface="stone" />
    <group position={[0,.016,0]}><Surface name={`${r.id}-continuous-ribbon`} vertices={geometry.pave} color={r.kind==='drive'?'#a49e8b':'#d4c7ab'} surface="paving" /></group>
    {samples.slice(1,-1).filter((_,i)=>i%2===0).map((p,i)=>{
      const a=samples[Math.min(i*2+2,samples.length-1)],b=samples[i*2],len=Math.hypot(a.x-b.x,a.z-b.z)||1;
      const x=p.x-(a.z-b.z)/len*(r.width/2+.45),z=p.z+(a.x-b.x)/len*(r.width/2+.45);
      return <group key={i} position={[x,-.2,z]} name="Circulation bollard"><Box at={[0,.23,0]} size={[.1,.48,.1]} color="#444e40" /><Box at={[0,.39,0]} size={[.11,.08,.11]} color="#ffdfa8" glow /></group>;
    })}
  </group>;
}
function Fountain({rx,rz}:{rx:number;rz:number}) {
  return <group name="Tiered circular fountain · stone basin and water" position={[0,.3,0]}>
    <Surface name="fountain-basin" vertices={ellipsePlate(rx,rz,.22)} color="#bdae91" surface="stone" />
    <group position={[0,.22,0]}><Surface name="fountain-water" vertices={ellipsePlate(rx-.2,rz-.2,.025)} color="#538d83" /></group>
    <group position={[0,.21,0]}><Surface name="fountain-rim" vertices={ellipseArc(rx,rz,.18,.19,0,360)} color="#d5c4a1" surface="stone" /></group>
    <mesh position={[0,.65,0]} castShadow><cylinderGeometry args={[.21,.4,1.1,32]} /><meshStandardMaterial color="#c4b599" roughness={.72} /></mesh>
    {[{y:.88,r:.95},{y:1.48,r:.52}].map(({y,r})=><group key={y} position={[0,y,0]}>
      <Surface name="fountain-tier" vertices={ellipsePlate(r,r,.13)} color="#d4c3a3" surface="stone" />
      <group position={[0,.135,0]}><Surface name="fountain-tier-water" vertices={ellipsePlate(r-.09,r-.09,.015)} color="#7aa59b" /></group>
    </group>)}
    <mesh position={[0,1.76,0]} castShadow><sphereGeometry args={[.15,20,16]} /><meshStandardMaterial color="#cbbd9e" roughness={.6} /></mesh>
    {Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return <mesh key={i} position={[Math.sin(a)*.79,.57,Math.cos(a)*.79]}><cylinderGeometry args={[.012,.018,.6,5]} /><meshPhysicalMaterial color="#b6ded3" transparent opacity={.65} roughness={.12} /></mesh>;})}
  </group>;
}
/** Opt-in estate kit. Reuses the villa materials, vegetation, palms and curved extrusion. */
export const EstateGrounds=memo(function EstateGrounds({composition:c}:{composition:WingComposition}) {
  const l=c.estateLandscape!;
  const plants=useMemo(()=>circulationPlanting(l,[...c.wings.map(w=>{
    const b=wingBounds(w);return {left:b.left-1,right:b.right+1,rear:b.rear-1,front:b.front+1};
  }),...c.terraces.map(t=>({left:t.x-t.width/2,right:t.x+t.width/2,rear:t.z-t.depth/2,front:t.z+t.depth/2})),
  ...(c.pool.enabled===false?[]:[{left:c.pool.x-c.pool.width/2-3,right:c.pool.x+c.pool.width/2+5,rear:c.pool.z-c.pool.depth/2-2,front:c.pool.z+c.pool.depth/2+3}])]),[c,l]);
  const court=l.court;
  return <group name="Estate landscape · estate-landscape@1">
    {l.routes.map(r=><Route key={r.id} route={r} />)}
    {court && <group position={[court.x,-.08,court.z]} name={`Oval motor court · ${court.width} × ${court.depth}m · ${court.island}`}>
      <Surface name="court-stone-curb" vertices={ellipsePlate(court.width/2+.16,court.depth/2+.16,.18)} color="#d6cbb2" surface="stone" />
      <group position={[0,.18,0]}><Surface name="court-paving" vertices={ellipsePlate(court.width/2,court.depth/2,.018)} color="#b3aa94" surface="paving" /></group>
      <group position={[0,.2,0]}><Surface name="court-inlaid-border" vertices={ellipseArc(court.width/2-.5,court.depth/2-.5,.13,.012,0,360)} color="#e4d7ba" surface="stone" /></group>
      {court.island!=='none' && <>
        <group position={[0,.2,0]}><Surface name="island-stone-edge" vertices={ellipsePlate(court.islandWidth/2,court.islandDepth/2,.2)} color="#c4b596" surface="stone" /></group>
        {court.island==='fountain' ? <Fountain rx={court.islandWidth/2-.25} rz={court.islandDepth/2-.25} /> : <>
          <group position={[0,.4,0]}><Surface name="island-planting" vertices={ellipsePlate(court.islandWidth/2-.18,court.islandDepth/2-.18,.04)} color="#6d7e52" surface="grass" /></group>
          <group position={[0,.44,0]}>{c.config.landscape==='tropical'?<TropicalPalm height={6.5} variant={1} />:<Vegetation kind="oak" variant={0} height={4} tint={tint} />}</group>
          {Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return <group key={i} position={[Math.sin(a)*(court.islandWidth/2-.7),.44,Math.cos(a)*(court.islandDepth/2-.7)]}><Vegetation kind="shrub-flowering" variant={i%2} height={.6} tint={tint} /></group>;})}
        </>}
      </>}
    </group>}
    {plants.map((p,i)=><group key={i} name={p.tree?'Arrival avenue planting':'Path border planting'} position={[p.x,-.43,p.z]}>
      {p.tree ? c.config.landscape==='tropical'?<TropicalPalm height={6.5+i%3*.6} variant={i%2} />:<Vegetation kind="cypress" height={6+i%2} variant={0} tint={tint} /> : <Vegetation kind={i%4===0?'shrub-flowering':'shrub'} variant={i%2} height={.65+i%2*.15} tint={tint} />}
    </group>)}
    {l.beds.map(b=><group key={b.id} position={[b.x,-.16,b.z]} name={`Formal garden · ${b.id}`}>
      <FinishBox name="garden-bed-stone-edge" at={[0,-.12,0]} size={[b.width,.32,b.depth]} color="#bbae8c" surface="stone" />
      <FinishBox name="garden-bed-soil" at={[0,.05,0]} size={[b.width-.22,.04,b.depth-.22]} color="#717d55" surface="grass" />
      {[-1,1].flatMap(s=>Array.from({length:Math.max(2,Math.floor(b.width/.8))},(_,i)=>{
        const n=Math.max(2,Math.floor(b.width/.8));return <group key={`${s}-x-${i}`} position={[-b.width/2+.5+i*(b.width-1)/(n-1),.08,s*(b.depth/2-.45)]}><Vegetation kind="shrub" variant={0} height={.65} tint={tint} /></group>;
      }))}
      {[-1,1].flatMap(s=>Array.from({length:Math.max(1,Math.floor((b.depth-1.5)/.85))},(_,i)=><group key={`${s}-z-${i}`} position={[s*(b.width/2-.45),.08,-b.depth/2+1.2+i*.85]}><Vegetation kind="shrub" variant={0} height={.65} tint={tint} /></group>))}
      <Vegetation kind="oak" variant={0} height={3.5} tint={tint} />
    </group>)}
  </group>;
});
