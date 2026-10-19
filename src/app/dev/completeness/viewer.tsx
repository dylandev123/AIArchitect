'use client';

// DEV-only, read-only fixture. No project writes or generation requests.
import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { compileV3Scene } from '@/lib/v3/scene';
import { auditV3Completeness } from '@/lib/v3/completeness';
import { functionalMansion, savedMansion, type SavedMansion } from '@/lib/v3/parity/functionalMansions';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { applyEdgeDetail, RENDER_BASE_BEVEL } from '@/lib/house/architecture/edgeDetail';
import { SunLight } from '@/components/workspace/viewport/SunLight';
import { SceneEnvironment } from '@/components/workspace/viewport/scenery/SceneEnvironment';
import { PostFx } from '@/components/workspace/viewport/PostFx';
import { TIME_OF_DAY } from '@/lib/timeOfDay';

/** Camera position, orbit target and optional horizontal section cut (world Y; everything above is clipped). */
type View = { camera: [number, number, number]; target: [number, number, number]; cut?: number };
const VIEWS: Record<SavedMansion, Record<string, View>> = {
  'f2149916': {
    pool: { camera: [6, 9, 44], target: [0, 4, 4] },
    'section-upper': { camera: [-14, 22, 20], target: [-5, 4.2, 3], cut: 5.6 },
    'section-ground': { camera: [-12, 13, 16], target: [-5, 1, 3], cut: 2.4 },
    'stair-detail': { camera: [-9.5, 9.5, 10.5], target: [-5, 2.6, 3], cut: 5.6 },
  },
  '91d583fe': {
    garden: { camera: [8, 9, 46], target: [0, 4, 0] },
    'section-upper': { camera: [-16, 24, 18], target: [-6, 4.3, -4], cut: 5.8 },
  },
  '9646933e': {
    garden: { camera: [10, 11, 48], target: [0, 4, 2] },
    'sky-terrace': { camera: [34, 16, 24], target: [16, 5, 0] },
    'section-gallery': { camera: [-22, 24, 16], target: [-9, 5, -3], cut: 6.4 },
  },
};

export function CompletenessViewer({ fixture, variant }: { fixture: SavedMansion; variant: 'functional' | 'saved' }) {
  const views = VIEWS[fixture], names = Object.keys(views);
  const [view, setView] = useState(names[0]);
  const { primitives, audit } = useMemo(() => {
    const scene = variant === 'functional' ? functionalMansion(fixture) : savedMansion(fixture);
    return { primitives: applyEdgeDetail(compileV3Scene(scene).primitives, RENDER_BASE_BEVEL), audit: auditV3Completeness(scene) };
  }, [fixture, variant]);
  const cfg = TIME_OF_DAY.midday, current = views[view];
  return <main style={{height:'100vh', display:'flex', flexDirection:'column'}}>
    <nav style={{padding:12, display:'flex', gap:16, alignItems:'center'}}>
      <strong>DEV completeness {fixture} · {variant} · {view}</strong>
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
    <p style={{fontSize:12,padding:8}}>Production PrimitiveMesh + edge finishing + sky/environment + sun/shadows + PostFx. Section views clip everything above the cut. Completeness: {audit.significant} significant · {audit.findings.map(f => f.code).join(', ') || 'none'}</p>
  </main>;
}
