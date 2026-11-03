'use client';
import {Suspense,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import type {ArchitecturalScene} from '@/lib/villa/scene/model';
import {OperationScene} from '@/components/scene/OperationScene';
import {SceneTerrain} from '@/components/scene/SceneTerrain';
import {VillaScene,type View} from '../villa-playground/scene';

const views:View[]=['Arrival','Aerial','Garden','Poolside'];
export function RecoveryViewer({scene,label}:{scene:ArchitecturalScene;label:string}) {
 const [view,setView]=useState<View>('Arrival');
 const banner={background:'#b00020',color:'#fff',fontWeight:700,fontSize:20,padding:'8px 12px',letterSpacing:.5} as const;
 return <main style={{background:'#e7e8e3',color:'#19231e',minHeight:'100vh',padding:12}}>
  <div style={banner}>{label}</div>
  <p>{view} · {scene.elements.length} elements · decision-assisted copy of the retained plan (living-salon shifted, dining shifted, east wing routed via service yard, arrival bed and bronze screen removed, reserve narrowed, site 110×81) · exterior only, unchanged compiled geometry</p>
  <nav style={{display:'flex',gap:16,padding:'8px 0'}}>{views.map(v=><button key={v} onClick={()=>setView(v)}>{v}</button>)}</nav>
  <div style={{width:'100%',aspectRatio:'16 / 9',position:'relative'}}>
   <Canvas shadows dpr={1} gl={{preserveDrawingBuffer:true}} camera={{position:[33,18,43],fov:40}}>
    <Suspense fallback={null}><VillaScene replaceArchitecture frameArchitectureOnly interactive={false} mood="Daylight" view={view} reset={views.indexOf(view)} tour={false} entranceElementId={scene.elements.find(e=>e.kind==='entrance')?.id} poolElementId={scene.elements.find(e=>e.kind==='water')?.id}
     grounds={<SceneTerrain terrain={scene.terrain??{width:120,depth:120,elevation:0,grade:0,fall:'z'}}/>}>
     <OperationScene scene={scene} onSelect={()=>{}}/>
    </VillaScene></Suspense>
   </Canvas>
   <div style={{...banner,position:'absolute',left:0,right:0,bottom:0,fontSize:16,opacity:.92,textAlign:'center'}}>{label} — {view}</div>
  </div>
 </main>;
}
