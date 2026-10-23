/** Separately authored offline demonstration; never used as a generation template. */
import { fullPropertyBlueprint } from './fullPropertyBlueprint';
import type { V3ArchitecturalBlueprint } from '../architecturalBlueprint';

export function planningStudioBlueprint():V3ArchitecturalBlueprint {
  const bp=fullPropertyBlueprint();
  bp.concept='Lantern Garden: a sheltered arrival court, inhabited stone arc and a sequence of quiet garden rooms.';
  bp.character='A copper crown unifies the residence; a deep upper loggia shades the garden glazing. A terracotta atelier terminates the arrival axis. The dry timber belvedere surrounds a sunken water garden.';
  const home=bp.buildings[0];
  const upper=home.storeys[1];
  Object.assign(upper.spaces.find(r=>r.id==='upper-gallery')!.footprint,{x:-1,z:-2,width:20,depth:2});
  Object.assign(upper.spaces.find(r=>r.id==='arc-suite')!.footprint,{x:4,z:4,width:16,depth:10});
  Object.assign(upper.spaces.find(r=>r.id==='west-suite')!,{label:'West retreat and stair hall',program:'study',role:'Quiet retreat connected to the private gallery'});
  upper.spaces.push({id:'north-dressing',label:'North dressing room',role:'Private dressing between gallery and bath',program:'dressing',footprint:{x:-2,z:-6,width:18,depth:6}});
  for(const [a,b,id] of [
    ['arc-suite','upper-gallery','suite-gallery-wall'],
    ['north-dressing','upper-gallery','dressing-gallery-wall'],
    ['family-bath','north-dressing','bath-dressing-wall'],
    ['family-bath','upper-gallery','bath-gallery-wall'],
  ]) {
    bp.roomAdjacencies.push({from:a,to:b});
    bp.partitions.push({id,storeyId:upper.id,roomAId:a,roomBId:b,boundaryId:`boundary:${[a,b].sort().join('|')}`,partitionType:'wall',semanticRole:'Private upper-floor separation'});
  }
  bp.doors.push(
    {id:'suite-gallery-door',partitionId:'suite-gallery-wall',offset:7,width:1.2,program:'door',semanticRole:'Private suite access'},
    {id:'dressing-gallery-door',partitionId:'dressing-gallery-wall',offset:12,width:.9,program:'door',semanticRole:'Dressing access from gallery'},
    {id:'bath-dressing-door',partitionId:'bath-dressing-wall',offset:3,width:.9,program:'door',semanticRole:'Bath access through dressing'},
  );
  bp.roomAdjacencies.push({from:'west-suite',to:'upper-gallery'});
  home.facade.assemblies![0].parts.forEach(part=>{if(part.type==='slab')part.depth=2.4;});
  // Two deliberate landscape rooms frame the approach without occupying its ribbon.
  bp.features.push(
    {id:'east-garden',label:'East garden clearing',role:'Garden setting to the inhabited arc',type:'landscape-zone',materialId:'meadow',location:{x:38,z:4,baseElevation:0,rotationY:0},width:18,depth:34,height:.12},
    {id:'arrival-shade',label:'Arrival garden shelter',role:'Shaded outdoor arrival room',type:'canopy',canopyStyle:'slatted',materialId:'timber',location:{x:19,z:-27,baseElevation:.14,rotationY:0},width:8,depth:10,height:3.3},
    {id:'arrival-shade-floor',label:'Arrival shelter paving',role:'Dry garden room',type:'terrace',materialId:'paving',location:{x:19,z:-27,baseElevation:0,rotationY:0},width:9,depth:11,height:.14},
  );
  bp.connections.push({id:'court-garden-link',surfaceId:'court-garden-walk',purpose:'Arrival court to sheltered garden room',from:{kind:'surface',objectId:'arrival-court',local:[12,0]},to:{kind:'surface',objectId:'arrival-shade-floor',local:[-4.5,0]},use:'pedestrian',width:2,waypoints:[],materialId:'paving'});
  bp.program.push({id:'arrival-room-program',kind:'amenity',role:'Sheltered arrival garden',objectIds:['arrival-shade','arrival-shade-floor'],source:'design',access:'optional'});
  bp.relationships.push({id:'arrival-shade-on-floor',from:'arrival-shade-floor',to:'arrival-shade',kind:'contains',intent:'Shade is supported above a real dry terrace'});
  return bp;
}
