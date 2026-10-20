/** Independently authored OFFLINE designs. Never imported by generation or saved-project loading. */
import type { V3ArchitecturalBlueprint } from '../architecturalBlueprint';

export function crescentEstateBlueprint():V3ArchitecturalBlueprint {
  return {
    format:'v3-architectural-blueprint-1',
    concept:'Crescent Lantern: an inhabited limestone arc and a quiet orchard atelier frame a long water garden.',
    character:'A two-storey curved salon, low copper roof, deep arrival gallery and an independent terracotta atelier; the pool is offset to preserve dry garden circulation.',
    site:{width:130,depth:120,baseElevation:0,north:'-z',groundColor:'#61754b',access:[{id:'north-gate',boundary:'north',point:[-3,0,-60]}]},
    materials:[
      {id:'limestone',color:'#d5c7ad',roughness:.78,surface:'stone'},
      {id:'copper',color:'#47665c',roughness:.55,metalness:.55,surface:'metal'},
      {id:'terracotta',color:'#ac6548',roughness:.8,surface:'stone'},
      {id:'water',color:'#2f8594',roughness:.1,opacity:.8,surface:'water'},
      {id:'paving',color:'#c7bda5',roughness:.82,surface:'paving'},
      {id:'court-paving',color:'#b8ad98',roughness:.74,surface:'paving'},
      {id:'meadow',color:'#61754b',roughness:.9,surface:'grass'},
      {id:'timber',color:'#84654b',roughness:.72,surface:'wood'},
    ],
    buildings:[{
      id:'crescent-house',label:'Crescent Lantern residence',role:'Primary residence',materialId:'limestone',location:{x:0,z:0,baseElevation:0,rotationY:0},
      plan:{kind:'outline',segments:[
        {id:'arrival-wall',type:'line',start:[-18,-10],end:[12,-10]},
        {id:'inhabited-arc',type:'arc',center:[12,0],radius:10,startAngle:-90,sweep:180},
        {id:'garden-wall',type:'line',start:[12,10],end:[-8,10]},
        {id:'court-return',type:'line',start:[-8,10],end:[-8,4]},
        {id:'west-wing',type:'line',start:[-8,4],end:[-18,4]},
        {id:'west-wall',type:'line',start:[-18,4],end:[-18,-10]},
      ]},
      storeys:[
        {id:'house-ground',label:'Garden storey',role:'Reception and living',height:4,spaces:[
          {id:'west-study',label:'Library and stair gallery',role:'Quiet west wing',program:'study',footprint:{x:-14,z:-3,width:6,depth:10}},
          {id:'arrival-gallery',label:'Arrival gallery',role:'Arrival circulation',program:'hall',footprint:{x:-4,z:-6,width:12,depth:6}},
          {id:'kitchen',label:'Garden kitchen',role:'Cooking and service',program:'kitchen',footprint:{x:5,z:-6,width:6,depth:6}},
          {id:'service-room',label:'Service and powder room',role:'Ground services',program:'bathroom',footprint:{x:10,z:-6,width:4,depth:6}},
          {id:'garden-salon',label:'Garden salon and dining',role:'Open living suite',program:'living',footprint:{x:4,z:3,width:20,depth:10}},
        ]},
        {id:'house-upper',label:'Private storey',role:'Family suites',height:4,spaces:[
          {id:'west-suite',label:'West suite',role:'Guest suite',program:'bedroom',footprint:{x:-14,z:-3,width:6,depth:10}},
          {id:'upper-gallery',label:'Upper gallery',role:'Private circulation',program:'hall',footprint:{x:-4,z:-6,width:12,depth:6}},
          {id:'arc-suite',label:'Arc suite',role:'Principal suite',program:'bedroom',footprint:{x:4,z:4,width:16,depth:8}},
          {id:'family-bath',label:'Family bath and dressing',role:'Private services',program:'bathroom',footprint:{x:10,z:-6,width:6,depth:6}},
        ]},
      ],
      facade:{massHierarchy:'primary',openings:[
        {id:'house-entry',type:'door',facade:'north',segmentId:'arrival-wall',start:.45,end:.55,height:3,floors:'ground'},
        {id:'salon-glass',type:'glazing-zone',facade:'east',segmentId:'inhabited-arc',start:.06,end:.94,heightRatio:.76},
        {id:'garden-door',type:'glazed-door',facade:'south',segmentId:'garden-wall',start:.25,end:.45,height:3,floors:'ground',operation:'sliding'},
      ],mainEntry:{openingId:'house-entry',canopyDepth:1.6}},
      roof:{id:'crescent-roof',form:'flat',materialId:'copper',pitchDegrees:0,overhang:.4,thickness:.25},
    },{
      id:'orchard-atelier',label:'Orchard atelier',role:'Independent studio',materialId:'limestone',location:{x:-36,z:0,baseElevation:0,rotationY:0},
      plan:{kind:'rectangle',width:12,depth:10},storeys:[{id:'atelier-ground',label:'Atelier floor',role:'Creative retreat',height:3.6,spaces:[{id:'atelier-room',label:'Orchard studio',role:'Art and music',program:'studio',footprint:{x:0,z:0,width:10,depth:8}}]}],
      facade:{massHierarchy:'secondary',openings:[{id:'atelier-entry',type:'door',facade:'north',start:.4,end:.6,height:2.7,floors:'ground'}]},
      roof:{id:'atelier-roof',form:'hip',materialId:'terracotta',pitchDegrees:25,overhang:.6,thickness:.25},
    }],
    entrances:[{id:'principal-entry',objectId:'crescent-house',openingId:'house-entry',level:0},{id:'atelier-entrance',objectId:'orchard-atelier',openingId:'atelier-entry',level:0},{id:'salon-exit',objectId:'crescent-house',openingId:'garden-door',level:0}],
    features:[
      {id:'arrival-court',label:'Lawn court with limestone perimeter',role:'Arrival and gathering',type:'courtyard',materialId:'court-paving',location:{x:-3,z:-27,baseElevation:0,rotationY:0},width:24,depth:12,height:.14},
      {id:'pool-deck',label:'Deep timber pool belvedere',role:'Outdoor living',type:'terrace',materialId:'timber',location:{x:5,z:34,baseElevation:0,rotationY:0},width:26,depth:26,height:.12},
      {id:'long-pool',label:'Long water garden',role:'Swimming pool',type:'pool',materialId:'water',location:{x:5,z:39,baseElevation:-1.4,rotationY:0},width:18,depth:12,height:1.4},
      {id:'orchard',label:'Quiet orchard clearing',role:'Landscape and privacy',type:'landscape-zone',materialId:'meadow',location:{x:-35,z:29,baseElevation:0,rotationY:0},width:24,depth:25,height:.12},
    ],
    connections:[
      {id:'gate-arrival',surfaceId:'arrival-drive',purpose:'North gate to arrival court',from:{kind:'site-access',accessId:'north-gate'},to:{kind:'surface',objectId:'arrival-court',local:[0,-6]},use:'vehicle',width:5,waypoints:[],materialId:'paving'},
      {id:'principal-approach',surfaceId:'entry-walk',purpose:'Court to principal gallery',from:{kind:'surface',objectId:'arrival-court',local:[0,6]},to:{kind:'entrance',entranceId:'principal-entry',approachDistance:3},use:'pedestrian',width:2.8,waypoints:[],materialId:'paving'},
      {id:'atelier-approach',surfaceId:'atelier-walk',purpose:'Sheltered arrival to orchard atelier',from:{kind:'surface',objectId:'arrival-court',local:[-10,0]},to:{kind:'entrance',entranceId:'atelier-entrance',approachDistance:3},use:'pedestrian',width:1.8,waypoints:[[-36,0,-27]],materialId:'paving'},
      {id:'garden-approach',surfaceId:'garden-walk',purpose:'Salon to dry pool belvedere',from:{kind:'entrance',entranceId:'salon-exit',approachDistance:3},to:{kind:'surface',objectId:'pool-deck',local:[0,-13]},use:'pedestrian',width:2,waypoints:[],materialId:'paving'},
    ],
    verticalCirculation:[{id:'library-stair',type:'stair',hostMassId:'crescent-house',fromLevel:0,toLevel:1,footprint:{x:-14,z:-3,width:1.6,depth:8},stairType:'straight',direction:'south',label:'Library gallery stair'}],
    requirements:[],
    program:[
      {id:'residence-program',role:'Primary family residence',kind:'residence',objectIds:['crescent-house'],source:'design'},
      {id:'atelier-program',role:'Independent creative retreat',kind:'building',objectIds:['orchard-atelier'],source:'design',access:'required'},
      {id:'outdoor-program',role:'Pool and dry outdoor living',kind:'amenity',objectIds:['pool-deck','long-pool'],source:'design'},
      {id:'orchard-program',role:'Orchard landscape',kind:'landscape',objectIds:['orchard'],source:'design',access:'optional'},
    ],
    zones:[{id:'inhabited-domain',purpose:'Residence, arrival and outdoor living',objectIds:['crescent-house','arrival-court','pool-deck','long-pool'],allocationMode:'derived'}],
    forms:[{id:'crescent-intent',objectIds:['crescent-house'],form:'curved',intent:'Preserve the inhabited east arc and articulated west library wing'}],
    relationships:[{id:'deck-water-edge',from:'pool-deck',to:'long-pool',kind:'contains',intent:'Dry belvedere surrounds the offset water basin'}],
    considerations:[{id:'orchard-privacy',kind:'privacy',intent:'The atelier turns toward its own orchard rather than the family water garden',objectIds:['orchard-atelier','orchard']}],
    roomAdjacencies:[{from:'kitchen',to:'service-room'}],
    partitions:[{id:'service-partition',storeyId:'house-ground',roomAId:'kitchen',roomBId:'service-room',boundaryId:'boundary:kitchen|service-room',partitionType:'wall',semanticRole:'Service separation'}],
    doors:[{id:'service-door',partitionId:'service-partition',offset:3,width:.9,program:'door',semanticRole:'Service access'}],
  };
}

/** Different topology and roof language, not substitutions of amenities in a template. */
export function distinctArchitecturalBlueprints():{name:string;blueprint:V3ArchitecturalBlueprint}[]{
  const rotunda=crescentEstateBlueprint();
  rotunda.concept='Moon Court: a single circular pavilion in a meadow';rotunda.character='An uninterrupted arc with radial wall openings';
  rotunda.buildings=[rotunda.buildings[0]];
  const circle=rotunda.buildings[0];circle.id='rotunda';circle.plan={kind:'outline',segments:[{id:'circle',type:'arc',center:[0,0],radius:10,startAngle:0,sweep:360}]};
  circle.storeys=[{id:'rotunda-floor',label:'Rotunda floor',role:'Open residence',height:4,spaces:[{id:'rotunda-salon',label:'Open salon',role:'Living and sleeping',program:'living',footprint:{x:0,z:0,width:12,depth:12}}]}];
  circle.facade={openings:[{id:'entry',type:'door',facade:'north',segmentId:'circle',start:.73,end:.77,height:2.8,floors:'ground'}]};
  rotunda.entrances=[{id:'round-entry',objectId:'rotunda',openingId:'entry',level:0}];
  rotunda.features=[rotunda.features[0]];rotunda.connections=[{...rotunda.connections[1],to:{kind:'entrance',entranceId:'round-entry',approachDistance:3}}];
  rotunda.verticalCirculation=[];rotunda.forms=[{id:'round-form',objectIds:['rotunda'],form:'circular',intent:'Complete circular inhabitable perimeter'}];rotunda.program=[{id:'round-program',role:'Open circular home',kind:'residence',objectIds:['rotunda'],source:'design'}];rotunda.zones=[];rotunda.relationships=[];rotunda.considerations=[];rotunda.roomAdjacencies=[];rotunda.partitions=[];rotunda.doors=[];
  const cloister=structuredClone(rotunda),court=cloister.buildings[0];
  cloister.concept='Ochre Court: a deeply recessed courtyard residence';cloister.character='Articulated rectilinear masonry with a low copper roof';
  court.plan={kind:'articulated',width:30,depth:22,operations:[{id:'entry-court',type:'entry-recess',facade:'north',width:12,depth:4},{id:'south-notch',type:'notch',corner:'se',width:7,depth:5}]};
  court.facade={openings:[{id:'entry',type:'door',facade:'north',start:.46,end:.54,floors:'ground',height:2.8}]};
  court.storeys[0].spaces=[{id:'court-salon',label:'West salon',role:'Living',program:'living',footprint:{x:-8,z:0,width:10,depth:10}}];
  cloister.forms=[{id:'court-form',objectIds:['rotunda'],form:'polygonal',intent:'Deep arrival court and an asymmetric garden notch'}];
  const classical=structuredClone(rotunda),villa=classical.buildings[0];
  classical.concept='Orchard Villa: a compact classical garden house';classical.character='Symmetric entry and terracotta hip roof';
  villa.plan={kind:'rectangle',width:24,depth:18};villa.roof.form='hip';villa.roof.pitchDegrees=28;villa.roof.materialId='terracotta';
  villa.facade={openings:[{id:'entry',type:'door',facade:'north',start:.45,end:.55,floors:'ground',height:3}]};
  classical.forms=[{id:'villa-form',objectIds:['rotunda'],form:'rectangular',intent:'Compact classical pavilion'}];
  return [{name:'crescent-estate',blueprint:crescentEstateBlueprint()},{name:'rotunda',blueprint:rotunda},{name:'courtyard-house',blueprint:cloister},{name:'classical-villa',blueprint:classical}];
}
