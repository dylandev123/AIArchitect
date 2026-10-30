"use client";
import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OperationScene } from '@/components/scene/OperationScene';
import { VillaScene } from '../villa-playground/scene';
import type { ArchitecturalScene } from '@/lib/villa/scene/model';
import type { CameraPose } from '../villa-playground/scene';
const views: Record<string, CameraPose> = {
  aerial: {position:[48,58,65],target:[0,1,9]},
  arrival: {position:[28,12,-35],target:[0,2,-4]},
  entrance: {position:[8,4,13],target:[0,2,4]},
  poolside: {position:[25,9,33],target:[0,1,12]},
  garden: {position:[-34,15,40],target:[0,2,9]},
  roofs: {position:[-25,13,-4],target:[-10,4,0]},
  stairs: {position:[-13,7,-13],target:[-4,2,-7]},
  railing: {position:[-8,5,-16],target:[0,3.6,-9]},
};
export function EstateDiagnosisViewer({scene,developerExample}:{scene:ArchitecturalScene;developerExample?:string}) {
  const [view,setView]=useState('aerial');
  return <main style={{background:'#e7e8e3',color:'#19231e',minHeight:'100vh',padding:12}}>
    <h1 style={{fontSize:22}}>{developerExample?`Developer diagnostic correction: ${developerExample} — still incomplete`:'Original Rejected Terra Draft'}</h1>
    <p>{scene.elements.length} elements · {developerExample?'developer-authored example':'original read-only offline evidence'} · not an accepted project · {view}</p>
    <nav style={{display:'flex',gap:16,padding:'12px 0'}}>{Object.keys(views).map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}</nav>
    <div style={{width:'100%',aspectRatio:'16 / 9'}}><Canvas shadows="soft" dpr={1} gl={{preserveDrawingBuffer:true,toneMapping:THREE.NeutralToneMapping}} camera={{position:[48,58,65],fov:39,near:.1,far:4000}}>
      <Suspense fallback={null}><VillaScene replaceArchitecture frameArchitectureOnly interactive={false} cameraPose={views[view]} mood="Daylight" view="Aerial" reset={Object.keys(views).indexOf(view)} tour={false}
        grounds={<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.01,0]} receiveShadow><planeGeometry args={[2000,2000]}/><meshStandardMaterial color="#a6aa9a" roughness={1}/></mesh>}>
        <OperationScene scene={scene} onSelect={()=>{}}/>
      </VillaScene></Suspense>
    </Canvas></div>
  </main>;
}
