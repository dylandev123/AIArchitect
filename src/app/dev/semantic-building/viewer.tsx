'use client';
import {Suspense,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OperationScene} from '@/components/scene/OperationScene';
import {SceneTerrain} from '@/components/scene/SceneTerrain';
import {VillaScene,type View} from '../villa-playground/scene';
import type {ArchitecturalScene} from '@/lib/villa/scene/model';
export function SemanticViewer({scene,thesis,source="Developer-authored design fixture"}:{scene:ArchitecturalScene;thesis:string;source?:string}){
 const [view,setView]=useState<View>('Arrival');const views:View[]=['Arrival','Aerial','Garden','Poolside'];
 return <main style={{padding:16,background:'#e7e8e3',color:'#19231e',minHeight:'100vh'}}><h1>Semantic building proof · {scene.name}</h1><p>{source} · {scene.elements.length} editable elements · architectural quality unapproved</p><p>{thesis}</p><p>Closed door panels shown; access checks assume open doors. Guards, fit-out and planting incomplete.</p><nav>{views.map(v=><button style={{marginRight:24}} key={v} onClick={()=>setView(v)}>{v}</button>)}</nav><div style={{height:850}}><Canvas shadows dpr={1} gl={{preserveDrawingBuffer:true}} camera={{position:[33,18,43],fov:40}}><Suspense fallback={null}><VillaScene replaceArchitecture frameArchitectureOnly interactive={false} mood="Daylight" view={view} reset={views.indexOf(view)} tour={false} poolElementId={scene.elements.find(e=>e.kind==='water')?.id} entranceElementId={scene.elements.find(e=>e.kind==='entrance')?.id} grounds={<SceneTerrain terrain={{width:120,depth:120,elevation:0,grade:0,fall:'z'}}/>}><OperationScene scene={scene} onSelect={()=>{}}/></VillaScene></Suspense></Canvas></div></main>;
}
