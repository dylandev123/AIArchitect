import original from './fixtures/canopy-meridian-attempt-0.json';
import repaired from './fixtures/canopy-meridian-attempt-1.json';
import { ingestV3GenerationOutput } from '../ingestion';
import { authoredPlan } from '../authoredPlan';

// Explicit TEST AUTHOR decisions. Never applied to recovered responses by production code.
export function corrected(raw: typeof original | typeof repaired) {
  const next=structuredClone(raw);
  const object=(id:string)=>next.objects.find(o=>o.id===id)!;
  const main=object('mainResidence');
  for(const [id,start,end] of [['southLivingDoor',.12,.38],['southDiningDoor',.62,.88],['southUpperDoor',.4,.6]] as const){
    const door=main.composition!.openings!.find(o=>o.id===id)!;door.start=start;door.end=end;
  }
  Object.assign(object('guestWalk').architecture,{width:10,height:.26});
  Object.assign(object('wellnessWalk').architecture,{x:27.5,width:9,height:.26});
  Object.assign(object('entryWalk').architecture,{z:-14.8,depth:10.4,height:.26});
  object('poolTerrace').architecture.height=.26;
  Object.assign(object('sunsetLawn').architecture,{z:46.75,depth:20.5});
  Object.assign(object('southGarden').architecture,{z:51});
  Object.assign(object('meditationCourt').architecture,{z:22.5,depth:9,height:.26});
  const glass=object('wellnessPavilion').composition!.openings!.find(o=>o.id==='wellnessSouthGlass')!;
  delete glass.heightRatio; delete glass.frame;
  Object.assign(glass,{type:'glazed-door',height:3.1,serves:'meditationCourt',operation:'sliding'});
  const scene=ingestV3GenerationOutput(next,'flat').scene;
  for(const zone of next.estatePlan.zones){
    const points=zone.objectIds.flatMap(id=>authoredPlan(scene.objects.find(o=>o.id===id)!));
    const xs=points.map(p=>p[0]),zs=points.map(p=>p[1]);
    zone.allocation={x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...zs)-Math.min(...zs)};
  }
  return next;
}

