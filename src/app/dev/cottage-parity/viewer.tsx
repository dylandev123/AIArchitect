'use client';

// DEV-only, read-only fixture. No project writes or generation requests.
import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { PARITY_FIXTURES, compileFixtureV2, type ParityFixtureName } from '@/lib/v3/parity/fixtures';
import { dreamMansion } from '@/lib/v3/parity/mansion';
import { compileV3Scene } from '@/lib/v3/scene';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { applyEdgeDetail, RENDER_BASE_BEVEL } from '@/lib/house/architecture/edgeDetail';
import { SunLight } from '@/components/workspace/viewport/SunLight';
import { SceneEnvironment } from '@/components/workspace/viewport/scenery/SceneEnvironment';
import { PostFx } from '@/components/workspace/viewport/PostFx';
import { TIME_OF_DAY } from '@/lib/timeOfDay';
import { parityMetrics } from '@/lib/v3/parity/metrics';

const views = {
  arrival: [0, 9, -42],
  rear: [0, 8, 40],
  aerial: [30, 25, 35],
  front: [-3, 7, 36],
  oblique: [25, 17, 30],
  entry: [-27, 14, -30],
  glazing: [4, 2.4, 12],
  junction: [-17, 7, 12],
} satisfies Record<string, [number, number, number]>;

// Cameras scale with the fixture so every scale is framed the same way.
const FRAME: Record<ParityFixtureName, number> = { cottage: 1, villa: 1.45, large: 2 };

export function CottageParityViewer({ fixture = 'cottage' }: { fixture?: ParityFixtureName | 'mansion' }) {
  const k = fixture === 'mansion' ? 2.2 : FRAME[fixture];
  const [version, setVersion] = useState<'v2' | 'v3'>(fixture === 'mansion' ? 'v3' : 'v2');
  const [view, setView] = useState<keyof typeof views>('front');
  const [roof, setRoof] = useState(true);
  const models = useMemo(() => {
    const scene = fixture === 'mansion' ? dreamMansion() : PARITY_FIXTURES[fixture]();
    return { scene, v2: fixture === 'mansion' ? compileV3Scene(scene) : compileFixtureV2(scene).model, v3: compileV3Scene(scene) };
  }, [fixture]);
  const primitives = useMemo(() => applyEdgeDetail(models[version].primitives, RENDER_BASE_BEVEL), [models, version]);
  const cfg = TIME_OF_DAY.midday;
  return <main style={{height:'100vh', display:'flex', flexDirection:'column'}}>
    <nav style={{padding:12, display:'flex', gap:16, alignItems:'center'}}>
      <strong>DEV {fixture} · {version.toUpperCase()} · {view}</strong>
      {(fixture === 'mansion' ? ['v3'] as const : ['v2','v3'] as const).map(v => <button key={v} onClick={() => setVersion(v)}>{v.toUpperCase()}</button>)}
      {(Object.keys(views) as (keyof typeof views)[]).map(v => <button key={v} onClick={() => setView(v)}>{v}</button>)}
      <button onClick={() => setRoof(!roof)}>{roof ? 'Hide roofs' : 'Show roofs'}</button>
    </nav>
    <div style={{flex:1, minHeight:0}}>
      <Canvas key={view} shadows="soft" dpr={[1,1.75]} gl={{toneMapping:THREE.NeutralToneMapping}} camera={{position:views[view].map(v => v * k) as [number,number,number],fov:40,near:.1,far:5000}}>
        <Suspense fallback={null}>
          <fog attach="fog" args={[cfg.fog.color,cfg.fog.near,cfg.fog.far]} />
          <Sky {...cfg.sky}/>
          <SceneEnvironment {...cfg.sky} intensity={cfg.envIntensity}/>
          <ambientLight {...cfg.ambient}/>
          <hemisphereLight args={[cfg.hemi.sky,cfg.hemi.ground,cfg.hemi.intensity]}/>
          {cfg.fills.map((f,i) => <directionalLight key={i} {...f}/>)}
          <SunLight {...cfg.sun}/>
          {primitives.filter(p => roof || p.category !== 'roof').map(p => <PrimitiveMesh key={`${version}-${p.id}`} primitive={p} surface={p.surface ?? (version === 'v2' && p.color.toLowerCase() === '#d3c9b8' && ['wall','roof'].includes(p.category) ? 'stone' : undefined)} readOnly/>)}
          <PostFx exposure={cfg.exposure}/>
        </Suspense>
        <OrbitControls makeDefault target={view === 'glazing' ? [0,2,2] : [-3*k,2,2*k]} />
      </Canvas>
    </div>
    <p style={{fontSize:12,padding:8}}>Production PrimitiveMesh + edge finishing + sky/environment + sun/shadows + PostFx. Matched midday, camera and common site. No generation. {JSON.stringify(parityMetrics(models.scene,models[version]))}</p>
  </main>;
}
