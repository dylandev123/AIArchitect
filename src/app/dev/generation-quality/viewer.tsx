'use client';
import {Suspense,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import type {ArchitecturalScene} from '@/lib/villa/scene/model';
import {OperationScene} from '@/components/scene/OperationScene';
import {SceneTerrain} from '@/components/scene/SceneTerrain';
import {VillaScene,type View} from '../villa-playground/scene';

const views:View[]=['Arrival','Aerial','Garden','Poolside'];
export function GenerationQualityViewer({scene,accepted}:{scene:ArchitecturalScene;accepted:boolean}) {
 const [view,setView]=useState<View>('Arrival');
 return <main style={{background:'#e7e8e3',color:'#19231e',minHeight:'100vh',padding:12}}>
  <h1 style={{fontSize:22}}>{scene.name}</h1>
  <p>Fresh Terra output · {accepted?'construction accepted; visual quality unapproved':'REJECTED construction draft; not an accepted house'} · {scene.elements.length} elements · {view}</p>
  <p>Exterior-designed, interiors unfinished · unchanged model geometry · no added planting, furniture or corrective construction</p>
  <nav style={{display:'flex',gap:16,padding:'12px 0'}}>{views.map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}</nav>
  <div style={{width:'100%',aspectRatio:'16 / 9'}}><Canvas shadows dpr={1} gl={{preserveDrawingBuffer:true}} camera={{position:[33,18,43],fov:40}}>
   <Suspense fallback={null}><VillaScene replaceArchitecture frameArchitectureOnly interactive={false} mood="Daylight" view={view} reset={views.indexOf(view)} tour={false} entranceElementId={scene.elements.find(e => e.kind === 'entrance')?.id} poolElementId={scene.elements.find(e=>e.kind==='water')?.id}
    grounds={<SceneTerrain terrain={scene.terrain??{width:120,depth:120,elevation:0,grade:0,fall:'z'}}/>}>
    <OperationScene scene={scene} onSelect={()=>{}}/>
   </VillaScene></Suspense>
  </Canvas></div>
 </main>;
}
