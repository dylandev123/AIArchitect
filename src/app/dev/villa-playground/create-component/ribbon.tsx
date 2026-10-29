'use client';
import { useMemo } from 'react';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import type { TriMeshPrimitive } from '@/lib/house/types';
import { Box } from '../architecture';
import { ribbonMesh, sampleRibbon, type CreationProposal, type Placement } from '@/lib/villa/creation/model';
export function CreatedRibbon({proposal,placement}:{proposal:CreationProposal;placement:Placement}) {
  const vertices=useMemo(()=>ribbonMesh(proposal),[proposal]);
  const color={ivory:'#e5dfcf',limestone:'#cabc9d',bronze:'#92704d'}[proposal.geometry.material];
  const surface=proposal.geometry.material==='limestone'?'stone':proposal.geometry.material==='bronze'?'metal':'render';
  const primitive=useMemo<TriMeshPrimitive>(()=>({kind:'triMesh',id:'Invented swept ribbon',label:proposal.name,category:'landscape',vertices,color,surface,roughness:surface==='metal'?.36:.78,metalness:surface==='metal'?.7:0}),[proposal.name,vertices,color,surface]);
  return <group name={`Created component ${proposal.id} · swept-ribbon@1`} position={[placement.x,.47,placement.z]} rotation={[0,placement.orientation*Math.PI/180,0]}>
    <PrimitiveMesh primitive={primitive} surface={surface} readOnly />
    {[.08,.92].flatMap(t=>[-.88,.88].map(v=>{const [x,h,z]=sampleRibbon(proposal,t,v);return <Box key={`${t}-${v}`} at={[x,h/2,z]} size={[.16,h,.16]} color="#766044" />;}))}
  </group>;
}
