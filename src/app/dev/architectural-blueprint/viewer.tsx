'use client';
// Offline design input → preliminary gate → real production construction/rendering.
import { Suspense,useMemo,useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls,Sky } from '@react-three/drei';
import * as THREE from 'three';
import { distinctArchitecturalBlueprints,crescentEstateBlueprint } from '@/lib/v3/parity/architecturalBlueprint';
import { fullPropertyBlueprint } from '@/lib/v3/parity/fullPropertyBlueprint';
import { planV3ArchitecturalBlueprint,constructV3ArchitecturalBlueprint,reviseV3ArchitecturalBlueprint,checkoutV3ArchitecturalBlueprint,type V3ArchitecturalPlanningResult,type V3ArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprint';
import { compileV3Scene,type V3Scene } from '@/lib/v3/scene';
import { executeV3SceneOperations } from '@/lib/v3/operations';
import { ingestV3GenerationOutput } from '@/lib/v3/ingestion';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { applyEdgeDetail,RENDER_BASE_BEVEL } from '@/lib/house/architecture/edgeDetail';
import { SunLight } from '@/components/workspace/viewport/SunLight';
import { SceneEnvironment } from '@/components/workspace/viewport/scenery/SceneEnvironment';
import { PostFx } from '@/components/workspace/viewport/PostFx';
import { TIME_OF_DAY } from '@/lib/timeOfDay';

const DESIGNS=[...distinctArchitecturalBlueprints(),{name:'full-property',blueprint:fullPropertyBlueprint()}];
export function ArchitecturalBlueprintViewer(){
  const [name,setName]=useState('crescent-estate'),[raw,setRaw]=useState(()=>JSON.stringify(crescentEstateBlueprint(),null,2));
  const [planning,setPlanning]=useState<V3ArchitecturalPlanningResult>(),[scene,setScene]=useState<V3Scene>(),[status,setStatus]=useState('Independent design loaded. Validate before construction.'),[section,setSection]=useState(false);
  const [detail,setDetail]=useState('estate');
  const cameraView=section?{position:[48,44,-56],target:[0,1,5]}:detail==='balcony'?{position:[48,18,-22],target:[16,4,0]}:detail==='portico'?{position:[-53,15,-26],target:[-36,2,0]}:detail==='outdoor'?{position:[28,18,12],target:[5,2,31]}:{position:[95,95,-118],target:[0,2,5]};
  const primitives=useMemo(()=>scene?applyEdgeDetail(compileV3Scene(scene).primitives,RENDER_BASE_BEVEL):[],[scene]);
  const cfg=TIME_OF_DAY.midday;
  const load=(key:string)=>{
    const bp=structuredClone(DESIGNS.find(d=>d.name===key)?.blueprint??crescentEstateBlueprint());
    if(key==='unsupported-roof')bp.buildings[0].roof.form='dome';
    setName(key);setRaw(JSON.stringify(bp,null,2));setPlanning(undefined);setScene(undefined);setSection(false);setDetail('estate');setStatus('Independent design loaded. Validate before construction.');
  };
  const validate=()=>{
    try{const p=planV3ArchitecturalBlueprint(JSON.parse(raw));setPlanning(p);setScene(undefined);setStatus(p.ok?'Blueprint approved. Detailed V3 construction has not run.':`Planning rejected: ${p.findings.filter(f=>f.severity==='fatal').map(f=>`${f.code}: ${f.message}`).join(' | ')}`);}
    catch(e){setPlanning(undefined);setScene(undefined);setStatus(`Planning rejected: ${String(e)}`);}
  };
  const construct=()=>{
    const result=constructV3ArchitecturalBlueprint(planning!.approval!);
    setScene(result.scene);setStatus(result.ok?`Constructed editable V3: ${result.scene!.objects.length} objects; ${result.model!.primitives.length} primitives. Blueprint document is not persisted in the scene.`:`Construction rejected: ${result.findings.map(f=>f.message).join(' | ')}`);
  };
  const move=()=>{
    const bp=JSON.parse(raw) as V3ArchitecturalBlueprint;bp.buildings[0].location.x+=3;
    const result=reviseV3ArchitecturalBlueprint(scene!,planning!.approval!,bp);
    if(result.ok){setScene(result.scene);setRaw(JSON.stringify(bp,null,2));setPlanning(planV3ArchitecturalBlueprint(bp));setName('moved-estate');setStatus('Replanned +3m: residence, host roof, entrance contacts and routes updated; stable IDs retained.');}
    else setStatus(`Replan rejected: ${result.findings.map(f=>f.message).join(' | ')}`);
  };
  const editReload=()=>{
    const edited=executeV3SceneOperations(scene!,{intent:'Change atelier finish through the existing V3 editor',operations:[{op:'changeMaterial',target:'orchard-atelier',material:{id:'ochre-stucco',color:'#c49a68',surface:'stucco'}}]});
    if(!edited.ok){setStatus(edited.errors.join(' | '));return;}
    const reloaded=ingestV3GenerationOutput(JSON.parse(JSON.stringify(edited.scene)),'flat',{requireBlueprint:true,requireDesignConsistency:true});
    const checkout=checkoutV3ArchitecturalBlueprint(reloaded.scene);
    if(!reloaded.ok||!checkout.ok||!checkout.blueprint){setStatus(`Reload/checkout rejected: ${checkout.findings.map(f=>f.message).join(' | ')}`);return;}
    setScene(reloaded.scene);setPlanning(checkout);setRaw(JSON.stringify(checkout.blueprint,null,2));setName('edit-reload');setStatus('Existing V3 material edit survived JSON reload. Blueprint reopened from current V3 semantics.');
  };
  return <main style={{height:'100vh',display:'flex',flexDirection:'column',background:'#e8e5de',color:'#23302e',fontFamily:'sans-serif'}}>
    <header style={{padding:'14px 20px',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><strong>Architectural authority · <span data-testid="fixture">{name}</span></strong>{[...DESIGNS.map(d=>d.name),'unsupported-roof'].map(key=><button key={key} onClick={()=>load(key)}>{key}</button>)}</header>
    <div style={{display:'flex',flex:1,minHeight:0}}>
      <aside style={{width:330,padding:'0 16px 16px',display:'flex',flexDirection:'column',gap:10}}>
        <p>Independent architectural blueprint<br/><small>Metres · north −Z · no detailed scene objects</small></p>
        <textarea aria-label="Architectural blueprint JSON" value={raw} onChange={e=>{setRaw(e.target.value);setPlanning(undefined);setScene(undefined);setStatus('Design changed. Validate before construction.');}} style={{flex:1,minHeight:0,fontSize:11,fontFamily:'monospace',padding:10,border:'1px solid #aaa',borderRadius:4}}/>
        <button onClick={validate}>Validate blueprint</button><button disabled={!planning?.approval} onClick={construct}>Construct V3</button>
        <button disabled={!scene||!planning?.approval} onClick={move}>Move residence +3m</button>
        <button disabled={!scene?.objects.some(o=>o.id==='orchard-atelier')} onClick={editReload}>Edit and reload V3</button>
        <button disabled={!scene} onClick={()=>{setSection(s=>!s);setName('interior-section');}}>Toggle interior section</button>
        {['estate','balcony','portico','outdoor'].map(view=><button key={view} disabled={!scene} onClick={()=>setDetail(view)}>{view} view</button>)}
      </aside>
      <div style={{flex:1,minHeight:0,position:'relative'}}>{scene?<Canvas key={`${name}-${section}-${detail}`} shadows="soft" dpr={[1,1.5]} camera={{position:cameraView.position as [number,number,number],fov:42,near:.1,far:5000}} gl={{toneMapping:THREE.NeutralToneMapping,localClippingEnabled:true}} onCreated={({gl})=>{if(section)gl.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),3.7)];}}>
        <Suspense fallback={null}><Sky {...cfg.sky}/><SceneEnvironment {...cfg.sky} intensity={cfg.envIntensity}/><ambientLight {...cfg.ambient}/><hemisphereLight args={[cfg.hemi.sky,cfg.hemi.ground,cfg.hemi.intensity]}/>{cfg.fills.map((f,i)=><directionalLight key={i} {...f}/>)}<SunLight {...cfg.sun}/>{primitives.map(p=><PrimitiveMesh key={p.id} primitive={p} surface={p.surface} readOnly/>)}<PostFx exposure={cfg.exposure}/></Suspense><OrbitControls makeDefault target={cameraView.target as [number,number,number]}/>
      </Canvas>:<div style={{position:'absolute',inset:0,display:'grid',placeContent:'center',padding:40,fontSize:24}}>Blueprint → Validation → V3 construction</div>}</div>
    </div>
    <p data-testid="pipeline-status" style={{margin:0,padding:'14px 20px',background:'#23302e',color:'#eee',fontSize:13}}>{status}</p>
  </main>;
}
