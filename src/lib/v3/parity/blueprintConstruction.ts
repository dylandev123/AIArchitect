/** Explicit OFFLINE architectural variants. Never called by generation, editing or saved-project loading.
 * Raw recovered responses remain byte-for-byte evidence. Distances/bends below are test-author decisions. */
import canopy from '../__tests__/fixtures/canopy-meridian-attempt-1.json';
import { normalizeV3GenerationOutput } from '../generation';
import { explicitlyCorrectedCloister } from './unifiedSpatial';
import { curvedFixture } from './curved';
import type { V3Scene } from '../scene';

export function blueprintCloister(): V3Scene {
  // Existing separately authored proof supplies boundary identity, reservations and external detours.
  const scene=explicitlyCorrectedCloister(), plan=scene.estatePlan!;
  for (const [id,entranceId] of [['route-entry','bp-main-entry'],['route-guest','bp-guest-entry'],['route-wellness','bp-wellness-entry']] as const) {
    const spatial=plan.circulation.find(r=>r.id===id)!.spatial!;
    spatial.to={entranceId,approachDistance:3};
    // Repeated terminal coordinates are removed, not retained as a second contact/bend.
    spatial.waypoints=id==='route-entry'?[]:id==='route-guest'?[[28,0,-23],[35,0,-8]]:[[-28,0,-23],[-35,0,-8]];
  }
  return normalizeV3GenerationOutput(scene,'flat').scene;
}

export function blueprintCanopy(): V3Scene {
  const scene=normalizeV3GenerationOutput(structuredClone(canopy),'flat').scene, plan=scene.estatePlan!;
  const entranceChoices=[['principal','mainResidence','mainEntryDoor'],['guest-departure','mainResidence','westGuestDoor'],['guest-arrival','guestPavilion','guestEastDoor'],['wellness-departure','mainResidence','eastWellnessDoor'],['wellness-arrival','wellnessPavilion','wellnessWestDoor'],['living','mainResidence','southLivingDoor'],['dining','mainResidence','southDiningDoor']] as const;
  plan.blueprint={version:1,
    buildings:scene.objects.filter(o=>o.type==='building-mass').map(o=>({id:`bp-building-${o.id}`,objectId:o.id,role:o.semanticRole})),
    entrances:entranceChoices.map(([id,objectId,openingId])=>({id:`bp-${id}`,objectId,openingId,level:0})),
    roofObjectIds:scene.objects.filter(o=>o.type==='roof-form').map(o=>o.id),
    outdoorObjectIds:scene.objects.filter(o=>['pool','terrace','landscape-zone'].includes(o.type)).map(o=>o.id),
    verticalCirculationIds:scene.interior?.circulation?.map(c=>c.id)??[],routeIds:plan.circulation.map(r=>r.id),
    allocations:plan.requirements.filter(r=>r.metric==='feature'||r.metric==='bedrooms').map(r=>({id:`bp-allocation-${r.id}`,requirementId:r.id,objectIds:[...r.objectIds],roomIds:[]})),
  };
  // Authored access design only. Retain ALL unrelated original site, reservation and joined claims.
  plan.circulation.find(r=>r.id==='plan-entry-walk')!.spatial={from:{point:[0,0,-20]},to:{entranceId:'bp-principal',approachDistance:3},use:'pedestrian',width:3};
  plan.circulation.find(r=>r.id==='plan-guest-walk')!.spatial={from:{entranceId:'bp-guest-departure',approachDistance:3},to:{entranceId:'bp-guest-arrival',approachDistance:3},use:'pedestrian',width:3,waypoints:[[-28,0,4]]};
  plan.circulation.find(r=>r.id==='plan-wellness-walk')!.spatial={from:{entranceId:'bp-wellness-departure',approachDistance:3},to:{entranceId:'bp-wellness-arrival',approachDistance:3},use:'pedestrian',width:3,waypoints:[[28,0,6]]};
  return normalizeV3GenerationOutput(scene,'flat').scene;
}

export function blueprintCircle(): V3Scene {
  const scene=curvedFixture('circular-pavilion'),mass=scene.objects[0];
  // Explicit ground-level example, with existing curved wall and opening; no simplification.
  mass.architecture!.baseElevation=0;
  scene.estatePlan={version:1,concept:'Circular pavilion approach',character:'Continuous arc facade',requirements:[],program:[],zones:[],relationships:[],considerations:[],
    blueprint:{version:1,buildings:[{id:'circle-building',objectId:mass.id,role:'Pavilion'}],entrances:[{id:'circle-entry',objectId:mass.id,openingId:'entry',level:0}],verticalCirculationIds:[],roofObjectIds:[],outdoorObjectIds:['arrival'],routeIds:['circle-route'],allocations:[]},
    circulation:[{id:'circle-route',purpose:'Authored curved entrance approach',from:'arrival',to:mass.id,via:['walk'],spatial:{from:{point:[0,0,-17]},to:{entranceId:'circle-entry',approachDistance:3},use:'pedestrian',width:1.2}}]};
  scene.objects.push({...structuredClone(mass),id:'walk',type:'path',composition:undefined,levels:undefined,architecture:{x:0,z:0,width:1,depth:1,height:.01,baseElevation:0}},
    {...structuredClone(mass),id:'arrival',type:'terrace',composition:undefined,levels:undefined,architecture:{x:0,z:-17,width:10,depth:4,height:.1,baseElevation:0}});
  return normalizeV3GenerationOutput(scene,'flat').scene;
}
