'use client';
import { useMemo } from 'react';
import { compileV3Scene } from '@/lib/v3/scene';
import type { ArchitecturalScene } from '@/lib/villa/scene/model';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
/** Only the shared natural-ground builder runs: no legacy building or blueprint ingestion. */
export function SceneTerrain({terrain}:{terrain:NonNullable<ArchitecturalScene['terrain']>}) {
 const model = useMemo(()=>{
  const {width,depth,...naturalGround}=terrain;
  return compileV3Scene({version:3,site:{width,depth,naturalGround,groundMaterial:{id:'scene-ground',color:'#738163',surface:'grass'}},objects:[],relationships:[],metadata:{}});
 },[terrain]);
 return <group name="Optional natural terrain">{model.primitives.map(p=><PrimitiveMesh key={p.id} primitive={p} readOnly />)}</group>;
}
