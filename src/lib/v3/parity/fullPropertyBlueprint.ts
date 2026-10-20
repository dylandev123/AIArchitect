/** Explicit offline design extension, never a generation template or legacy-scene rewrite. */
import { crescentEstateBlueprint } from './architecturalBlueprint';
import type { V3ArchitecturalBlueprint } from '../architecturalBlueprint';

export function fullPropertyBlueprint():V3ArchitecturalBlueprint {
  const bp=crescentEstateBlueprint(),house=bp.buildings[0],atelier=bp.buildings[1];
  bp.concept='Crescent Lantern, developed property: curved private balcony, atelier portico and slatted poolside room.';
  const glass=house.facade.openings!.find(o=>o.id==='salon-glass')!;
  glass.floors='ground';
  house.facade.openings!.push({id:'suite-balcony-door',type:'glazed-door',facade:'east',segmentId:'inhabited-arc',start:.3,end:.5,height:2.8,floors:'upper',operation:'sliding',serves:'arc-balcony'});
  house.facade.assemblies=[{id:'arc-balcony',intent:'Private upper arc balcony',parts:[
    {id:'deck',type:'slab',facade:'east',segmentId:'inhabited-arc',start:.25,end:.65,depth:1.6,level:1,elevation:.06,thickness:.2},
    {id:'guard',type:'railing',slabId:'deck',edges:['outer','start','end'],height:1.1},
  ]}];
  atelier.facade.assemblies=[{id:'atelier-portico',intent:'Sheltered atelier entrance',parts:[
    {id:'cover',type:'slab',facade:'north',start:.1,end:.9,depth:2.4,elevation:3.0,thickness:.2},
    {id:'left-post',type:'post',facade:'north',at:.15,depth:2.1,height:3,size:.2},
    {id:'right-post',type:'post',facade:'north',at:.85,depth:2.1,height:3,size:.2},
    {id:'lintel',type:'beam',facade:'north',start:.1,end:.9,depth:2.1,height:.22,elevation:2.8,thickness:.2},
  ]}];
  bp.features.push({id:'poolside-shade',label:'Slatted poolside room',role:'Covered outdoor living',type:'canopy',canopyStyle:'slatted',materialId:'timber',location:{x:5,z:27,baseElevation:.12,rotationY:0},width:10,depth:6,height:3.2});
  bp.program.push({id:'shade-program',kind:'amenity',role:'Covered outdoor living',objectIds:['poolside-shade'],source:'design',access:'optional'});
  bp.relationships.push({id:'shade-on-deck',from:'pool-deck',to:'poolside-shade',kind:'contains',intent:'Shade occupies the dry north part of the pool belvedere'});
  return bp;
}
