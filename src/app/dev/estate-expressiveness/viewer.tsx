'use client';
/** Read-only offline QA using the actual Planning Studio SVG and V3 mesh renderer.
 * No API client, project store writes, credentials or generation controls. */
import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArchitecturalFloorPlan } from '@/components/workspace/viewport/ArchitecturalFloorPlan';
import { PrimitiveMesh } from '@/components/workspace/viewport/house/PrimitiveMesh';
import { formalArrivalEstate, articulatedWingsResidence, referenceExterior } from '@/lib/v3/parity/expressiveEstate';
import { preparePlanEvaluation } from '@/lib/v3/architecturalPlanEvaluation';
import { elaborateV3ArchitecturalPlan, planConstructionBlockers, sameArchitecturalPlan } from '@/lib/v3/architecturalPlanFirst';
import { planV3ArchitecturalBlueprint, constructV3ArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprint';
import paid from '@/lib/v3/__tests__/fixtures/paid-plan-548137db.json';

export function paidEstateComparison(){
 const plan=structuredClone(paid);
 // Previously documented local corrections, applied only to this disposable fixture.
 plan.connections[2].to={kind:'surface',objectId:'sea-terrace',local:[0,0]};
 Object.assign(plan.buildings[0].accessOpenings[0],{start:.432,end:.568});
 Object.assign(plan.buildings[0].accessOpenings[3],{start:.94,end:1});
 plan.features[5].location.z=-50;
 return preparePlanEvaluation(plan);
}
export function EstateExpressivenessViewer(){
 const [design,setDesign]=useState('arrival'),[floor,setFloor]=useState<number|null>(null),[view,setView]=useState('plan'),[focus,setFocus]=useState<string|null>(null);
 const proof=useMemo(()=>{
  if(design==='before')return {stage:paidEstateComparison(),built:null,preserved:true};
  const plan=design==='arrival'?formalArrivalEstate():articulatedWingsResidence(),stage=preparePlanEvaluation(plan);
  const exterior=elaborateV3ArchitecturalPlan(stage,referenceExterior(plan)),approved=planV3ArchitecturalBlueprint(exterior.blueprint,{buildFirst:true});
  const built=approved.approval?constructV3ArchitecturalBlueprint(approved.approval):null;
  if(!built?.ok)throw Error(JSON.stringify(approved.findings));
  return {stage,built,preserved:sameArchitecturalPlan(stage.scene!,built.scene!)};
 },[design]);
 const scene=proof.stage.scene!,blockers=planConstructionBlockers(proof.stage);
 const choose=(value:string)=>{setDesign(value);setFocus(null);setFloor(null);setView('plan');};
 return <main style={{height:'100vh',display:'flex',flexDirection:'column',background:'#f6f3eb',color:'#253d3b',fontFamily:'sans-serif'}}>
  <header style={{padding:'14px 24px',background:'#233c35',color:'#faf8f0',display:'flex',gap:18,alignItems:'center',flexWrap:'wrap'}}>
   <strong>Estate expressiveness · offline evidence</strong>
   <label>Reference <select aria-label="Reference design" value={design} onChange={e=>choose(e.target.value)} style={{color:'#233c35',background:'#fff',padding:6}}><option value="before">Before · paid estate composition</option><option value="arrival">After · Sea Court and circular fountain</option><option value="wings">After · connected H wings</option></select></label>
   <button onClick={()=>setView('plan')} aria-pressed={view==='plan'}>2D Planning Studio</button><button disabled={!proof.built} onClick={()=>setView('3d')} aria-pressed={view==='3d'}>Constructed 3D</button>
   <label>Drawing <select aria-label="Reference floor" value={floor??'site'} onChange={e=>setFloor(e.target.value==='site'?null:Number(e.target.value))} style={{color:'#233c35',background:'#fff',padding:6}}><option value="site">Estate master plan</option><option value="0">Ground floor</option><option value="1">Upper floor</option></select></label>
   <label>Scope <select aria-label="Reference building" value={focus??'site'} onChange={e=>setFocus(e.target.value==='site'?null:e.target.value)} style={{color:'#233c35',background:'#fff',padding:6}}><option value="site">Whole estate</option>{scene.objects.filter(o=>o.type==='building-mass').map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
  </header>
  <p style={{margin:0,padding:'10px 24px',background:'#e2e8db',fontSize:13}}>Synthetic references prove technical capability; they are not Terra outputs or proposed replacements for the paid estate. Read-only · no saved-project writes · no provider calls.</p>
  <div style={{position:'relative',flex:1,minHeight:0}}>
   {view==='plan'?<ArchitecturalFloorPlan scene={scene} model={null} floor={floor} buildingId={focus} readOnly/>:
    <Canvas camera={{position:[110,145,150],fov:45,near:.1,far:1000}} shadows><color attach="background" args={['#e8e5de']}/><ambientLight intensity={1.2}/><directionalLight position={[60,100,30]} intensity={2} castShadow/><Suspense fallback={null}>{proof.built!.model!.primitives.map(p=><PrimitiveMesh key={p.id} primitive={p} readOnly/>)}</Suspense><OrbitControls makeDefault target={[0,0,5]}/></Canvas>}
  </div>
  <p role="status" style={{margin:0,padding:'12px 24px',background:'#233c35',color:'#faf8f0',fontSize:13}}>{blockers.length===0?'Preflight PASS':'Preflight FAIL'} · {scene.objects.filter(o=>o.type==='building-mass').length} buildings · {scene.interior?.rooms.length} rooms · {scene.estatePlan?.blueprint?.outdoorObjectIds.length} site features · {proof.built?`${proof.built.outcome} construction · geometry preservation ${proof.preserved?'PASS':'FAIL'}`:'unchanged paid composition comparison; no construction run'}</p>
 </main>;
}
