/** Offline, explicitly authored proofs. These are never generation templates. */
import original from './fixtures/canopy-meridian-attempt-0.json';
import { corrected } from './correctedMansionFixture';
import { estateFixtures } from './estatePlanFixtures';
import { curvedFixture } from '../parity/curved';
import { ingestV3GenerationOutput } from '../ingestion';
import { materializeV3ArchitecturalObject } from '../architecture';
import type { V3Scene } from '../scene';

/** Test-author index of decisions already explicitly present in the fixture. */
export function indexBlueprint(scene: V3Scene): V3Scene {
  const plan = scene.estatePlan!;
  plan.blueprint = {
    version:1,
    buildings:scene.objects.filter(o=>o.type==='building-mass').map(o=>({id:`bp-building-${o.id}`,objectId:o.id,role:o.semanticRole})),
    entrances:scene.objects.filter(o=>o.type==='building-mass').flatMap(o=>(o.composition?.openings ?? []).filter(op=>['door','glazed-door'].includes(op.type)).map(op=>({id:`bp-entry-${o.id}-${op.id}`,objectId:o.id,openingId:op.id,level:op.floors==='upper'?1:0}))),
    verticalCirculationIds:(scene.interior?.circulation ?? []).map(c=>c.id),
    roofObjectIds:scene.objects.filter(o=>o.type==='roof-form').map(o=>o.id),
    outdoorObjectIds:scene.objects.filter(o=>['pool','terrace','landscape-zone'].includes(o.type)).map(o=>o.id),
    routeIds:plan.circulation.map(r=>r.id),
    allocations:plan.requirements.filter(r=>['feature','bedrooms'].includes(r.metric)).map(r=>({id:`bp-allocation-${r.id}`,requirementId:r.id,objectIds:[...r.objectIds],roomIds:[]})),
  };
  return scene;
}

export function mansionBlueprintFixture(): V3Scene {
  // Reuse the recovered investigation's explicit synthetic corrections unchanged.
  const scene=ingestV3GenerationOutput(corrected(original),'flat').scene;
  // Additional BLUEPRINT TEST AUTHOR decision: the terrace meets the pool edge;
  // its 14m depth does not enclose the pool extending to z=36.5. Preserve geometry
  // and relationship id, correcting this semantic claim in both existing locations.
  const claim=scene.estatePlan!.relationships.find(r=>r.id==='rel-terrace-pool')!;
  claim.kind='connects';claim.intent='Pool terrace meets the water feature along its north edge';
  scene.relationships.find(r=>r.from===claim.from&&r.to===claim.to&&r.kind==='contains')!.kind='connects';
  return indexBlueprint(scene);
}

export function diverseBlueprintFixtures(): {name:string;scene:V3Scene}[] {
  const sculpture = curvedFixture('mixed-mansion');
  sculpture.estatePlan = {version:1,concept:'An asymmetric sculptural contemporary estate with a sweeping garden wall and a recessed private wing',character:'Contrasting a straight arrival face with a continuous inhabited curve',requirements:[],program:[{id:'sculpture-program',role:'Sculptural residence',kind:'residence',objectIds:['residence'],source:'design'}],zones:[],circulation:[],relationships:[],considerations:[{id:'sculpture-view',kind:'view',intent:'The sweeping facade addresses the garden horizon',objectIds:['residence']}]};
  const compound = estateFixtures()[1];
  compound.estatePlan!.concept='A Mediterranean orchard compound with a limestone family house, guest lodge and artist atelier';
  compound.estatePlan!.character='Independent terracotta hip roofs and sheltered orchard approaches';
  for (const o of compound.objects.filter(o=>o.type==='building-mass')) o.roofForm='hip';
  compound.estatePlan!.circulation[0].spatial={from:{point:[0,0,23]},to:{point:[0,0,9],openingId:'main-residence-door'},use:'pedestrian',width:1.5};
  compound.estatePlan!.zones=[];
  for (const [id,x,z] of [['guest-lodge',-35,6],['atelier',35,5]] as const) {
    const path = materializeV3ArchitecturalObject({...structuredClone(compound.objects.find(o=>o.type==='path')!),id:`walk-${id}`,architecture:{x:0,z:0,width:1,depth:1,height:.1,baseElevation:0}});
    compound.objects.push(path);
    compound.estatePlan!.circulation.push({id:`route-${id}`,purpose:`Orchard access to ${id}`,from:'main-residence',to:id,via:[path.id],spatial:{from:{point:[0,0,9],openingId:'main-residence-door'},to:{point:[x,0,z],openingId:`${id}-door`},waypoints:[[0,0,16],[x,0,16]],use:'pedestrian',width:1.5}});
  }
  const circle = curvedFixture('circular-pavilion');
  circle.estatePlan={version:1,concept:'A circular architectural residence in an uninterrupted private landscape',character:'A full arc boundary with openings addressed on the rotunda itself',requirements:[],program:[{id:'circle-program',role:'Circular residence',kind:'residence',objectIds:['residence'],source:'design'}],zones:[],circulation:[],relationships:[],considerations:[{id:'circle-privacy',kind:'privacy',intent:'Quiet perimeter planting shelters the rotunda',objectIds:['residence']}]};
  const rectangle = estateFixtures()[2];
  // Explicit test-author correction: a single 0→2 U-flight cannot fit the rise or serve level 1.
  // Two existing-location, single-storey stairs provide the intended three-storey access.
  const urbanStair=rectangle.interior!.circulation![0];
  urbanStair.toLevel=1;
  rectangle.interior!.circulation!.push({...structuredClone(urbanStair),id:'urban-upper-stair',fromLevel:1,toLevel:2,footprint:{...urbanStair.footprint,x:3.5}});
  rectangle.estatePlan!.circulation[0].spatial={from:{point:[0,0,9]},to:{point:[0,0,8],openingId:'urban-residence-door'},use:'pedestrian',width:1.5};
  return [{name:'sculptural contemporary estate',scene:sculpture},{name:'Mediterranean compound',scene:compound},{name:'circular residence',scene:circle},{name:'rectangular home',scene:rectangle}].map(f=>({...f,scene:indexBlueprint(f.scene)}));
}
