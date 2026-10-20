'use client';
// Read-only offline construction verification. No provider, persistence or project writes.
import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { stairFixture } from '@/lib/v3/parity/geometryAuthority';
import { compileV3Scene } from '@/lib/v3/scene';
import { auditV3StairUsability } from '@/lib/v3/stairUsability';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { applyEdgeDetail, RENDER_BASE_BEVEL } from '@/lib/house/architecture/edgeDetail';
import { SunLight } from '@/components/workspace/viewport/SunLight';
import { SceneEnvironment } from '@/components/workspace/viewport/scenery/SceneEnvironment';
import { PostFx } from '@/components/workspace/viewport/PostFx';
import { TIME_OF_DAY } from '@/lib/timeOfDay';
const CASES=['straight','l-shaped','u-shaped','spiral','spiral-left','roof-deck','blocked','tiny'] as const;
export function GeometryAuthorityViewer(){
  const [fixture,setFixture]=useState<typeof CASES[number]>('straight');
  const {primitives,failures}=useMemo(()=>{
    const scene=stairFixture(fixture==='spiral-left'?'spiral':fixture==='l-shaped'||fixture==='u-shaped'||fixture==='spiral'?fixture:'straight');
    if(fixture==='spiral-left')scene.interior!.circulation![0].turn='left';
    if(fixture==='tiny'){scene.interior!.circulation![0].footprint.width=.4;scene.interior!.circulation![0].footprint.depth=.5;}
    if(fixture==='blocked')scene.objects.push({...structuredClone(scene.objects[0]),id:'barrier',type:'volume',geometryKind:'box',levels:undefined,dimensions:[2,3,.4],transform:{position:[0,1.76,2.95],rotation:[0,0,0],scale:[1,1,1]}});
    if(fixture==='roof-deck'){
      const host=scene.objects[0];host.levels=1;host.dimensions[1]=3.2;host.transform.position[1]=1.6;
      scene.objects.push({...structuredClone(host),id:'roof-deck',type:'terrace',levels:undefined,hostId:'house',dimensions:[20,.2,20],transform:{position:[0,3.3,0],rotation:[0,0,0],scale:[1,1,1]}});
    }
    const model=compileV3Scene(scene);
    return {primitives:applyEdgeDetail(model.primitives,RENDER_BASE_BEVEL),failures:auditV3StairUsability(scene,model.primitives)};
  },[fixture]);
  const cfg=TIME_OF_DAY.midday;
  return <main style={{height:'100vh',display:'flex',flexDirection:'column'}}>
    <nav style={{padding:12,display:'flex',gap:14}}><strong>Offline stair · {fixture}</strong>{CASES.map(c=><button key={c} onClick={()=>setFixture(c)}>{c}</button>)}</nav>
    <div style={{flex:1,minHeight:0}}><Canvas key={fixture} shadows="soft" dpr={[1,1.75]} camera={{position:[6,9,8],fov:40,near:.1,far:5000}} gl={{toneMapping:THREE.NeutralToneMapping,localClippingEnabled:true}} onCreated={({gl})=>{gl.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),fixture==='roof-deck'?3.55:3.85)];}}>
      <Suspense fallback={null}>
        <Sky {...cfg.sky}/><SceneEnvironment {...cfg.sky} intensity={cfg.envIntensity}/><ambientLight {...cfg.ambient}/><hemisphereLight args={[cfg.hemi.sky,cfg.hemi.ground,cfg.hemi.intensity]}/>
        {cfg.fills.map((f,i)=><directionalLight key={i} {...f}/>)}<SunLight {...cfg.sun}/>
        {primitives.map(p=><PrimitiveMesh key={p.id} primitive={p} surface={p.surface} readOnly/>)}<PostFx exposure={cfg.exposure}/>
      </Suspense><OrbitControls makeDefault target={[0,1.6,0]}/>
    </Canvas></div>
    <p style={{padding:12}} data-testid="usability">{failures.length?failures.map(f=>`${f.code}: ${f.message}`).join(' | '):'Usable authored access; actual floor opening and approaches verified.'}</p>
  </main>;
}
