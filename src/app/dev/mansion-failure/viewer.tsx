'use client';

// DEV-only, read-only fixture. No project writes or generation requests.
import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { recoveredCloister, explicitlyCorrectedCloister } from '@/lib/v3/parity/unifiedSpatial';
import { compileV3Scene } from '@/lib/v3/scene';
import { footprintDiagnostics } from '@/lib/v3/footprintDiagnostics';
import original from '@/lib/v3/__tests__/fixtures/canopy-meridian-attempt-0.json';
import repaired from '@/lib/v3/__tests__/fixtures/canopy-meridian-attempt-1.json';
import { ingestV3GenerationOutput } from '@/lib/v3/ingestion';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { applyEdgeDetail, RENDER_BASE_BEVEL } from '@/lib/house/architecture/edgeDetail';
import { SunLight } from '@/components/workspace/viewport/SunLight';
import { SceneEnvironment } from '@/components/workspace/viewport/scenery/SceneEnvironment';
import { PostFx } from '@/components/workspace/viewport/PostFx';
import { TIME_OF_DAY } from '@/lib/timeOfDay';

/** Camera position, orbit target and optional horizontal section cut (world Y; everything above is clipped). */
type View = { camera: [number, number, number]; target: [number, number, number]; cut?: number };
const VIEWS: Record<string, View> = {
 overview: {camera:[85,65,100],target:[0,2,5]},
 plan: {camera:[0,120,.1],target:[0,0,0]},
 section: {camera:[26,32,34],target:[0,1,0],cut:2.8},
 arrival: {camera:[28,16,-57],target:[0,3,-8]},
 pool: {camera:[48,25,65],target:[0,3,17]},
 recess: {camera:[12,12,-29],target:[0,3,-10]},
 roof: {camera:[40,30,-38],target:[0,8,0]},
 balcony: {camera:[14,9,36],target:[0,4,13]},
 pavilions: {camera:[0,38,-70],target:[0,2,0]},
};
export function MansionFailureViewer({attempt,estate='canopy'}:{attempt:0|1;estate?:'canopy'|'cloister'|'corrected'}) {
 const views=VIEWS,names=Object.keys(views);
 const [view,setView]=useState(names[0]);
 const {primitives,audit}=useMemo(()=>{
  const scene=estate==='corrected'?explicitlyCorrectedCloister():estate==='cloister'?recoveredCloister(attempt):ingestV3GenerationOutput(structuredClone(attempt===0?original:repaired),'flat').scene;
  return {primitives:applyEdgeDetail(compileV3Scene(scene).primitives,RENDER_BASE_BEVEL),audit:footprintDiagnostics(scene)};
 },[attempt,estate]);
  const cfg = TIME_OF_DAY.midday, current = views[view];
  return <main style={{height:'100vh', display:'flex', flexDirection:'column'}}>
    <nav style={{padding:12, display:'flex', gap:16, alignItems:'center'}}>
      <strong>Offline {estate} mansion · attempt {attempt} · {view}</strong>
      {names.map(v => <button key={v} onClick={() => setView(v)}>{v}</button>)}
    </nav>
    <div style={{flex:1, minHeight:0}}>
      <Canvas key={view} shadows="soft" dpr={[1,1.75]} camera={{position:current.camera,fov:40,near:.1,far:5000}}
        gl={{toneMapping:THREE.NeutralToneMapping, localClippingEnabled:true}}
        onCreated={({gl}) => { gl.clippingPlanes = current.cut === undefined ? [] : [new THREE.Plane(new THREE.Vector3(0,-1,0), current.cut)]; }}>
        <Suspense fallback={null}>
          <fog attach="fog" args={[cfg.fog.color,cfg.fog.near,cfg.fog.far]} />
          <Sky {...cfg.sky}/>
          <SceneEnvironment {...cfg.sky} intensity={cfg.envIntensity}/>
          <ambientLight {...cfg.ambient}/>
          <hemisphereLight args={[cfg.hemi.sky,cfg.hemi.ground,cfg.hemi.intensity]}/>
          {cfg.fills.map((f,i) => <directionalLight key={i} {...f}/>)}
          <SunLight {...cfg.sun}/>
          {primitives.map(p => <PrimitiveMesh key={p.id} primitive={p} surface={p.surface} readOnly/>)}
          <PostFx exposure={cfg.exposure}/>
        </Suspense>
        <OrbitControls makeDefault target={current.target} />
      </Canvas>
    </div>
    <p style={{fontSize:12,padding:8}}>Production PrimitiveMesh + edge finishing + sky/environment + sun/shadows + PostFx. Section views clip everything above the cut. Footprint diagnostics: {audit.map(f => f.code).join(', ') || 'none'}</p>
  </main>;
}
