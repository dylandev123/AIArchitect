/** Offline 850 m² tropical courtyard mansion. No provider/client imports or requests. */
import { cottageObject as obj } from './cottage';
import type { V3Scene, V3SceneObject } from '../scene';
import type { V3Room, V3Storey } from '../interior';
const plaster = { id: 'ivory-render', color: '#e6dfd1', surface: 'stucco' as const };
const stone = { id: 'warm-limestone', color: '#b9aa92', surface: 'stone' as const };
const timber = { id: 'teak', color: '#805b3e', surface: 'wood' as const };
const metal = { id: 'bronze-roof', color: '#444844', surface: 'metal' as const };
export function dreamMansion(): V3Scene {
  const wing = (id: string, x: number, z: number, w: number, d: number, h: number, extra: Partial<V3SceneObject> = {}) => obj(id, 'building-mass', x,z,w,d,h,.3, {
    material: plaster, levels: 2, roofForm: 'flat', overhang: .9,
    composition: { massHierarchy: 'secondary', facadeRoles: { north: 'private', south: 'view', east: 'private', west: 'private' } }, ...extra,
  });
  const objects = [
    // 180 m², one tall storey: no accidental intermediate slab through the great room.
    wing('great-room', 0,0,18,10,7.2, {levels:1, composition:{massHierarchy:'primary', facadeRoles:{south:'view',north:'private',east:'private',west:'private'}}, roofForm:'hip'}),
    // 280 + 240 m² flanking wings establish an asymmetric arrival court.
    wing('family-wing', -14,-5,10,14,7.2,{material:stone,roofForm:'mono-pitch',pitch:10, composition:{massHierarchy:'secondary',facadeRoles:{north:'private',south:'view',east:'private',west:'private'}}}),
    wing('primary-wing', 14,-4,10,12,7.8,{material:plaster,roofForm:'floating-flat',overhang:1.2}),
    // 36 m² lower entry link connects the tall central hall to the arrival sequence.
    wing('arrival-link', 0,-8,6,6,3.6,{levels:1,material:stone,roofForm:'floating-flat',overhang:.3,composition:{massHierarchy:'connector',facadeRoles:{north:'arrival',east:'private',west:'private'},
      openings:[{id:'front-door',type:'door',facade:'north',floors:'ground',start:.32,end:.68,height:2.9,reveal:.3}],mainEntry:{openingId:'front-door',canopyDepth:2.4,color:timber.color}}}),
    // 114 m² service / kitchen pavilion. Total enclosed gross area = 850 m².
    wing('service-wing',-25,-6,12,9.5,3.6,{levels:1,material:timber,roofForm:'flat',overhang:.6,composition:{massHierarchy:'secondary',facadeRoles:{north:'service',west:'service',south:'view',east:'private'}}}),
    obj('great-roof','roof-form',0,0,18,10,.25,7.5,{hostId:'great-room',roofForm:'hip',pitch:18,overhang:1.5,material:metal}),
    obj('pool-veranda','veranda',0,7.5,18,5,3.5,.3,{hostId:'great-room',material:timber}),
    obj('pool-deck','terrace',1,14,32,8,.25,0,{material:stone}),
    obj('pool','pool',1,14,18,4.5,1.5,-1.25,{material:{id:'water',color:'#348b9b',surface:'water'}}),
    obj('suite-balcony','balcony',14,3.5,9,3,.25,4.2,{hostId:'primary-wing',material:stone,support:{kind:'object',hostId:'primary-wing',relationship:'cantilevered-from'}}),
    obj('arrival-court','path',0,-18,18,10,.12,0,{material:stone}),
    obj('driveway','path',5,-30,5,16,.12,0,{material:stone}),
    obj('entry-walk','path',0,-13,3,4,.12,0,{material:stone}),
    obj('porte-cochere','canopy',0,-14,10,5,.25,3.1,{material:metal}),
    obj('arrival-garden-west','landscape-zone',-6,-14,4,5,.15,0),
    obj('arrival-garden-east','landscape-zone',6,-14,4,5,.15,0),
    obj('view-garden','landscape-zone',24,12,8,18,.15,0),
  ];
  const storeys: V3Storey[] = objects.filter(o=>o.type==='building-mass').flatMap(o => Array.from({length:o.levels!},(_,i)=>({id:`${o.id}-storey-${i}`,hostMassId:o.id,index:i,elevation:i*o.architecture!.height/o.levels!,height:o.architecture!.height/o.levels!,label:`${o.label} ${i}`,semanticRole:i?'upper':'ground'})));
  const rooms: V3Room[] = [];
  const room = (id:string,host:string,index:number,program:string,x:number,z:number,width:number,depth:number) => rooms.push({id,hostMassId:host,storeyId:`${host}-storey-${index}`,program,footprint:{x,z,width,depth},label:id,semanticRole:program});
  room('double-height-living','great-room',0,'living',-3,0,12,10);
  room('dining','great-room',0,'dining',6,0,6,10);
  room('arrival-hall','arrival-link',0,'entry',0,0,6,6);
  room('primary-bedroom','primary-wing',1,'bedroom',0,2,10,8);
  room('primary-bath','primary-wing',1,'bathroom',-2.5,-4,5,4);
  room('primary-dressing','primary-wing',1,'dressing',2.5,-4,5,4);
  room('office','primary-wing',0,'office',0,-3,10,6);
  room('guest-bedroom','primary-wing',0,'bedroom',0,3,10,6);
  for (let i=0;i<2;i++) for(let j=0;j<2;j++) room(`family-bedroom-${i*2+j+1}`,'family-wing',i,'bedroom',0,j?3.5:-3.5,10,7);
  room('kitchen','service-wing',0,'kitchen',3,0,6,9.5);
  room('utility','service-wing',0,'utility',-3,2.375,6,4.75);
  room('pantry','service-wing',0,'pantry',-3,-2.375,6,4.75);
  return {version:3,site:{width:110,depth:100,groundMaterial:{id:'grass',color:'#68745a',surface:'grass'}},objects,interior:{storeys,rooms},relationships:[
    {from:'great-room',to:'family-wing',kind:'connects'}, {from:'great-room',to:'primary-wing',kind:'connects'},
    {from:'arrival-link',to:'great-room',kind:'connects'}, {from:'family-wing',to:'service-wing',kind:'connects'},
  ],metadata:{fixture:'offline-dream-mansion',grossArea:850}};
}
