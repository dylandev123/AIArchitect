'use client';

// DEV-only, read-only terrain audit fixture. Same production render stack as /dev/cottage-parity. No generation requests.
import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { TERRAIN_FIXTURES, type TerrainFixtureName } from '@/lib/v3/parity/terrain';
import { compileV3Scene, type V3Scene } from '@/lib/v3/scene';
import { v3NaturalGroundHeight } from '@/lib/v3/grading';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { applyEdgeDetail, RENDER_BASE_BEVEL } from '@/lib/house/architecture/edgeDetail';
import { SunLight } from '@/components/workspace/viewport/SunLight';
import { SceneEnvironment } from '@/components/workspace/viewport/scenery/SceneEnvironment';
import { PostFx } from '@/components/workspace/viewport/PostFx';
import { TIME_OF_DAY } from '@/lib/timeOfDay';

/** [camera, target]. North (-z) is uphill/road; south (+z) is the downhill/view side. */
const views = {
  arrival: [[30, 22, -75], [0, 0, -10]],
  downhill: [[-55, 18, 75], [0, -2, 0]],
  side: [[95, 12, 10], [0, -4, 5]],
  aerial: [[70, 85, 85], [0, -4, 5]],
  /** Low, from over the sea / downhill side, looking back at the cliff or lower grade breaks. */
  coast: [[75, -8, 110], [0, -10, 15]],
} satisfies Record<string, [[number, number, number], [number, number, number]]>;

/** `scene` replays a captured scene; `lift` raises every camera to that scene's natural-ground datum. */
export function TerrainAuditViewer({ fixture, scene: captured, lift = 0, accepted }: { fixture: TerrainFixtureName | 'captured-mansion'; scene?: V3Scene; lift?: number; accepted?: boolean }) {
  const [view, setView] = useState<keyof typeof views>('aerial');
  const scene = useMemo(() => captured ?? TERRAIN_FIXTURES[fixture as TerrainFixtureName](), [captured, fixture]);
  const primitives = useMemo(() => applyEdgeDetail(compileV3Scene(scene).primitives, RENDER_BASE_BEVEL), [scene]);
  const cfg = TIME_OF_DAY.midday;
  const lifted = views[view].map(([x, y, z]) => [x, y + lift, z] as [number, number, number]);
  // A captured slope can rise above a fixed audit camera: keep the camera clear of the natural ground below it.
  const [camera, target] = captured ? [[lifted[0][0], Math.max(lifted[0][1], v3NaturalGroundHeight(scene.site, lifted[0][0], lifted[0][2]) + 8), lifted[0][2]] as [number, number, number], lifted[1]] : lifted;
  return <main style={{height:'100vh', display:'flex', flexDirection:'column'}}>
    <nav style={{padding:12, display:'flex', gap:16, alignItems:'center'}}>
      <strong>DEV terrain {fixture}{accepted === undefined ? '' : accepted ? ' (accepted)' : ' (REJECTED)'} · {view}</strong>
      {(Object.keys(views) as (keyof typeof views)[]).map(v => <button key={v} onClick={() => setView(v)}>{v}</button>)}
    </nav>
    <div style={{flex:1, minHeight:0}}>
      <Canvas key={view} shadows="soft" dpr={[1,1.75]} gl={{toneMapping:THREE.NeutralToneMapping}} camera={{position:camera,fov:40,near:.1,far:5000}}>
        <Suspense fallback={null}>
          <fog attach="fog" args={[cfg.fog.color,cfg.fog.near*3,cfg.fog.far*3]} />
          <Sky {...cfg.sky}/>
          <SceneEnvironment {...cfg.sky} intensity={cfg.envIntensity}/>
          <ambientLight {...cfg.ambient}/>
          <hemisphereLight args={[cfg.hemi.sky,cfg.hemi.ground,cfg.hemi.intensity]}/>
          {cfg.fills.map((f,i) => <directionalLight key={i} {...f}/>)}
          <SunLight {...cfg.sun}/>
          {primitives.map(p => <PrimitiveMesh key={p.id} primitive={p} surface={p.surface} readOnly/>)}
          <PostFx exposure={cfg.exposure}/>
        </Suspense>
        <OrbitControls makeDefault target={target} />
      </Canvas>
    </div>
  </main>;
}
