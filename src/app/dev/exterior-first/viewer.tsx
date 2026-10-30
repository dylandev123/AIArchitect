"use client";
import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OperationScene } from '@/components/scene/OperationScene';
import { VillaScene } from '../villa-playground/scene';
import type { ArchitecturalScene } from '@/lib/villa/scene/model';
import type { CameraPose } from '../villa-playground/scene';
const views: Record<string, CameraPose> = {
 aerial:{position:[30,29,37],target:[0,2,5]},
 arrival:{position:[22,12,-27],target:[0,3,0]},
 garden:{position:[-25,13,25],target:[-1,3,2]},
 poolside:{position:[17,8,29],target:[-1,2,7]},
};
export function ExteriorStudyViewer({scene}:{scene:ArchitecturalScene}) {
 const large=scene.name.startsWith('DEVELOPER estate')||scene.name.includes('Headland')||scene.name.includes('RETAINED');
 const poses=large?{aerial:{position:[55,46,60],target:[0,3,7]},arrival:{position:[39,22,-43],target:[0,3,0]},garden:{position:[-45,25,44],target:[0,3,7]},poolside:{position:[34,13,46],target:[0,3,5]}} as Record<string,CameraPose>:views;
  const [view,setView]=useState('aerial');
  return <main style={{background:'#e7e8e3',color:'#19231e',minHeight:'100vh',padding:12}}>
    <h1 style={{fontSize:22}}>{scene.name}</h1>
    <p>{scene.elements.length} elements · {scene.name.includes('RETAINED')?'retained Terra generation · unchanged geometry · historical model output':'developer-authored feasibility study · zero AI calls · interiors unfinished · not generated architecture'} · {view}</p>
    <nav style={{display:'flex',gap:16,padding:'12px 0'}}>{Object.keys(views).map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}</nav>
    <div style={{width:'100%',aspectRatio:'16 / 9'}}><Canvas shadows="soft" dpr={1} gl={{preserveDrawingBuffer:true,toneMapping:THREE.NeutralToneMapping}} camera={{position:[48,58,65],fov:39,near:.1,far:4000}}>
      <Suspense fallback={null}><VillaScene replaceArchitecture frameArchitectureOnly interactive={false} cameraPose={poses[view]} mood="Daylight" view="Aerial" reset={Object.keys(views).indexOf(view)} tour={false}
        grounds={<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.01,0]} receiveShadow><planeGeometry args={[2000,2000]}/><meshStandardMaterial color="#a6aa9a" roughness={1}/></mesh>}>
        <OperationScene scene={scene} onSelect={()=>{}}/>
      </VillaScene></Suspense>
    </Canvas></div>
  </main>;
}
