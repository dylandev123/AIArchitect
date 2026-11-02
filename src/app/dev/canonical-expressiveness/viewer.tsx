'use client';
import {useState} from 'react';
import {useProjectStore} from '@/store/useProjectStore';
import {compileArchitecturalPlan,architecturalPlanSchema} from '@/lib/villa/canonical/plan';
import {validateScene,type ArchitecturalScene} from '@/lib/villa/scene/model';
import {SemanticViewer} from '../semantic-building/viewer';
/** Offline lifecycle harness, not a live architectural revision implementation. */
export function CanonicalCheckpoint({initial}:{initial:ArchitecturalScene}){
 const [scene,setScene]=useState(initial),[projectId,setProjectId]=useState<string>();
 function revision(){
  const store=useProjectStore.getState(),id=projectId??store.createProject('Developer canonical fixture','house','direct-scene').id;
  if(!projectId)store.appendVersion(id,'Original fixture',JSON.stringify(scene));
  const plan=architecturalPlanSchema.parse(scene.architecturalPlan);plan.portals[0].width-=.1;
  const next=compileArchitecturalPlan(plan).scene;store.appendVersion(id,'Explicit developer plan revision',JSON.stringify(next));setProjectId(id);setScene(next);
 }
 function travel(direction:'undo'|'redo'){
  if(!projectId)return;const store=useProjectStore.getState();store[direction](projectId);setScene(validateScene(JSON.parse(store.getProject(projectId)!.houseConfigJson)));
 }
 return <><p>Developer-only canonical lifecycle harness. Full recompilation for fixture history testing; live revision remains disabled.</p><button onClick={revision}>Revise fixture plan</button><button onClick={()=>travel('undo')}>Undo</button><button onClick={()=>travel('redo')}>Redo</button><button onClick={()=>localStorage.setItem('canonical-fixture-save',JSON.stringify(scene))}>Save locally</button><button onClick={()=>setScene(validateScene(JSON.parse(localStorage.getItem('canonical-fixture-save')!)))}>Reload saved geometry</button><SemanticViewer scene={scene} thesis={architecturalPlanSchema.parse(scene.architecturalPlan).thesis} source="Developer-authored canonical fixture · not AI output"/></>;
}
