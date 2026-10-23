"use client";
import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import type { TriMeshPrimitive } from '@/lib/house/types';
import { ellipseArc, ellipsePlate } from '@/lib/villa/experimental/pavilion-geometry';
import { pavilionPlacementSchema, type PavilionPlacement } from '@/lib/villa/experimental/curved-pavilion';
import { Box, FinishBox, Sofa } from './architecture';

export function Surface({name,vertices,color,surface='render'}:{name:string;vertices:number[];color:string;surface?:TriMeshPrimitive['surface']}) {
  const primitive=useMemo<TriMeshPrimitive>(()=>({kind:'triMesh',id:name,label:name,category:'landscape',vertices,color,surface,roughness:.78}),[name,vertices,color,surface]);
  return <PrimitiveMesh primitive={primitive} surface={surface} readOnly />;
}
function CurvedGlass({vertices}:{vertices:number[]}) {
  const geometry=useMemo(()=>{
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
  },[vertices]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="pavilion-curved-glass" geometry={geometry} position={[0,.05,0]}>
    <meshPhysicalMaterial color="#9fbdaf" transparent opacity={.18} roughness={.08} metalness={.1} depthWrite={false} />
  </mesh>;
}
/** Reusable open elliptical lounge. Curved wall, floor, roof, bench and glass are new
 * generated geometry; furniture, finishes, lighting and renderer reuse the villa kit. */
export function CurvedPavilion({placement}:{placement:PavilionPlacement}) {
  const p=pavilionPlacementSchema.parse(placement), rx=p.width/2,rz=p.depth/2,h=p.height;
  const parts=useMemo(()=>({
    plinth:ellipsePlate(rx+.15,rz+.15,.6), floor:ellipsePlate(rx+.25,rz+.25,.3), roof:ellipsePlate(rx+.65,rz+.65,.24),
    soffit:ellipsePlate(rx+.48,rz+.48,.07), cap:ellipsePlate(rx+.38,rz+.38,.05),
    wall:ellipseArc(rx,rz,.26,h,118,242), bench:ellipseArc(rx-.32,rz-.32,.65,.42,125,235),
    cushion:ellipseArc(rx-.34,rz-.34,.61,.12,126,234),
    glass: [ellipseArc(rx-.04,rz-.04,.025,h-.18,65,118),ellipseArc(rx-.04,rz-.04,.025,h-.18,242,295)],
  }),[rx,rz,h]);
  return <group name={`Experimental curved-pavilion@1 · ${p.id}`} position={[p.x,.47,p.z]} rotation={[0,p.orientation*Math.PI/180,0]}>
    <group position={[0,-.9,0]}><Surface name="pavilion-curved-plinth" vertices={parts.plinth} color="#b0a48d" surface="concrete" /></group>
    <group position={[0,-.3,0]}><Surface name="pavilion-elliptical-floor" vertices={parts.floor} color="#cfc1a7" surface="concrete" /></group>
    <Surface name="pavilion-curved-shell" vertices={parts.wall} color={p.material==='limestone'?'#cabc9d':'#e5dfcf'} surface={p.material==='limestone'?'stone':'render'} />
    <group position={[0,h,0]}><Surface name="pavilion-elliptical-roof" vertices={parts.roof} color="#e5dfcf" /></group>
    <group position={[0,h-.07,0]}><Surface name="pavilion-timber-soffit" vertices={parts.soffit} color="#997a54" surface="timber" /></group>
    <group position={[0,h+.24,0]}><Surface name="pavilion-roof-cap" vertices={parts.cap} color="#b6b1a2" /></group>
    <Surface name="pavilion-curved-bench" vertices={parts.bench} color="#a38b66" surface="timber" />
    <group position={[0,.42,0]}><Surface name="pavilion-curved-cushion" vertices={parts.cushion} color="#d8ceba" /></group>
    {parts.glass.map((vertices,i)=><CurvedGlass vertices={vertices} key={i} />)}
    {[65,91,118,242,269,295].map(a=>{
      const t=a*Math.PI/180;
      return <Box key={a} at={[(rx-.12)*Math.sin(t),h/2,(rz-.12)*Math.cos(t)]} size={[.085,h,.085]} color="#42473e" />;
    })}
    <Sofa at={[0,.02,-rz*.12]} width={Math.min(3.1,p.width*.43)} />
    <FinishBox name="pavilion-coffee-table" at={[0,.4,rz*.4]} size={[1.55,.2,.7]} color="#ac9d80" />
    <Box at={[0,h-.11,-rz*.52]} size={[2,.022,.04]} color="#ffdfa1" glow />
  </group>;
}
