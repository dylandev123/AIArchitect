'use client';
// Read-only offline variants; production mesh/material/light pipeline. No model or project writes.
import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { blueprintCanopy, blueprintCloister, blueprintCircle } from '@/lib/v3/parity/blueprintConstruction';
import { compileV3Scene, type Vec3 } from '@/lib/v3/scene';
import { estateEndpoint } from '@/lib/v3/routeGeometry';
import { auditEstateSpatial } from '@/lib/v3/estateSpatial';
import { normalizeV3GenerationOutput } from '@/lib/v3/generation';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { applyEdgeDetail, RENDER_BASE_BEVEL } from '@/lib/house/architecture/edgeDetail';
import { SunLight } from '@/components/workspace/viewport/SunLight';
import { SceneEnvironment } from '@/components/workspace/viewport/scenery/SceneEnvironment';
import { PostFx } from '@/components/workspace/viewport/PostFx';
import { TIME_OF_DAY } from '@/lib/timeOfDay';
const CASES=['canopy-wide','canopy-entry','canopy-entry-moved','canopy-guest','cloister-wide','cloister-guest','circle-entry','circle-moved','blocked'] as const;
export function BlueprintConstructionViewer(){
  const [fixture,setFixture]=useState<typeof CASES[number]>('canopy-entry');
  const {primitives,failures,contact,target,camera}=useMemo(()=>{
    let scene=fixture.startsWith('circle')?blueprintCircle():fixture.startsWith('canopy')?blueprintCanopy():blueprintCloister();
    const route=scene.estatePlan!.circulation.find(r=>r.id===(fixture.startsWith('circle')?'circle-route':fixture==='canopy-guest'?'plan-guest-walk':fixture.startsWith('canopy')?'plan-entry-walk':fixture==='cloister-guest'?'route-guest':'route-entry'))!;
    if(fixture.endsWith('moved')){
      const host=scene.objects.find(o=>o.id===route.to)!,entry=scene.estatePlan!.blueprint!.entrances.find(e=>e.id===route.spatial!.to.entranceId)!;
      const opening=host.composition!.openings!.find(o=>o.id===entry.openingId)!;
      if('start' in opening){opening.start+=fixture==='circle-moved'?.025:.02;opening.end+=fixture==='circle-moved'?.025:.02;}
    }
    if(fixture==='blocked')scene.objects.push({...structuredClone(scene.objects.find(o=>o.id==='arrivalCourt')!),id:'barrier',type:'volume',collision:'solid',architecture:{x:0,z:-14,width:4,depth:1,height:2,baseElevation:0}});
    scene=normalizeV3GenerationOutput(scene,'flat').scene;
    const contact=estateEndpoint(scene,route,'to')!,wide=fixture.endsWith('wide');
    const target:Vec3=wide?[0,1,0]:[contact[0],1,contact[2]];
    const offset=wide?[105,110,-130]:fixture==='canopy-guest'?[18,13,8]:fixture==='cloister-guest'?[-18,13,-8]:[9,14,-18];
    const camera:Vec3=[target[0]+offset[0],target[1]+offset[1],target[2]+offset[2]];
    return {contact,target,camera,primitives:applyEdgeDetail(compileV3Scene(scene).primitives,RENDER_BASE_BEVEL),failures:auditEstateSpatial(scene).filter(f=>['ESTATE_ROUTE_BLOCKED','ESTATE_ACCESS_POINT_MISSING','ESTATE_ROUTE_UNSUPPORTED','ESTATE_POOL_CROSSING'].includes(f.code))};
  },[fixture]);
  const cfg=TIME_OF_DAY.midday;
  return <main style={{height:'100vh',display:'flex',flexDirection:'column'}}>
    <nav style={{padding:12,display:'flex',flexWrap:'wrap',gap:12}}><strong>Offline blueprint · {fixture}</strong>{CASES.map(c=><button key={c} onClick={()=>setFixture(c)}>{c}</button>)}</nav>
    <div style={{flex:1,minHeight:0}}><Canvas key={fixture} shadows="soft" dpr={[1,1.5]} camera={{position:camera,fov:42,near:.1,far:5000}} gl={{toneMapping:THREE.NeutralToneMapping,localClippingEnabled:true}} onCreated={({gl})=>{if(!fixture.endsWith('wide'))gl.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),3.4)];}}>
      <Suspense fallback={null}>
        <Sky {...cfg.sky}/><SceneEnvironment {...cfg.sky} intensity={cfg.envIntensity}/><ambientLight {...cfg.ambient}/><hemisphereLight args={[cfg.hemi.sky,cfg.hemi.ground,cfg.hemi.intensity]}/>
        {cfg.fills.map((f,i)=><directionalLight key={i} {...f}/>)}<SunLight {...cfg.sun}/>
        {primitives.map(p=><PrimitiveMesh key={p.id} primitive={p} surface={p.surface} readOnly/>)}<PostFx exposure={cfg.exposure}/>
      </Suspense><OrbitControls makeDefault target={target}/>
    </Canvas></div>
    <p style={{padding:12}} data-testid="construction">{failures.length?failures.map(f=>`${f.code}: ${f.message}`).join(' | '):'Resolved route contact and authored approach; no corridor blockers.'} Contact: {contact.map(v=>v.toFixed(3)).join(', ')}. Canopy retains unrelated estate contradictions.</p>
  </main>;
}
