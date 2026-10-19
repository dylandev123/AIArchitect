/** Offline DEV/test fixture. Never used as runtime or persistence authority. */
import { compileArchitecture } from '@/lib/architecture/compiler';
import { ARCHITECTURE_FIXTURES } from '@/lib/architecture/fixtures';
import { DEFAULT_MATERIALS_CONFIG } from '@/types/house';
import type { MassVolume, MassOpening, ArchitecturalDesignDocument } from '@/lib/architecture/document';
import { compileV3Scene, type V3Scene, type V3SceneObject } from '../scene';
import { materializeV3ArchitecturalObject } from '../architecture';
import { builderOpening } from '../composition';

const stone = { id: 'stone', color: '#d3c9b8', surface: 'stone' as const, roughness: .72 };
export function cottageObject(id: string, type: string, x: number, z: number, width: number, depth: number, height: number, baseElevation = .25, extra: Partial<V3SceneObject> = {}): V3SceneObject {
  return materializeV3ArchitecturalObject({ id, type, label: id, semanticRole: id, architecture: { x,z,width,depth,height,baseElevation }, transform: { position:[0,0,0],rotation:[0,0,0],scale:[1,1,1] }, dimensions:[1,1,1], material: stone, ...extra });
}
export function expressiveCottage(): V3Scene {
  return { version:3, site:{width:64,depth:54,groundMaterial:{id:'grass',color:'#68745a',surface:'grass'}}, relationships:[], metadata:{fixture:'matched-expressive-cottage'}, objects:[
    cottageObject('living','building-mass',0,0,12,8,3.6,.25,{levels:1,facadePreset:'glass-heavy',composition:{openings:[
      {id:'view',type:'glazing-zone',facade:'south',start:.04,end:.96,heightRatio:.94},
      {id:'corner',type:'glazing-zone',facade:'east',start:.55,end:1,heightRatio:.94},
      {id:'entry',type:'door',facade:'north',start:.38,end:.53,height:2.6,reveal:.35},
      {id:'kitchen',type:'opening-rhythm',facade:'west',count:3,width:1.3,height:1.5,sill:.9},
    ]}}),
    cottageObject('bedroom','building-mass',-11,-3,7,6,3.1,.25,{levels:1,facadePreset:'punched',facadeSouth:'glass-heavy',roofForm:'mono-pitch',pitch:12,overhang:1}),
    cottageObject('connector','building-mass',-6.75,-1,1.5,3,2.8,.25,{levels:1,facadePreset:'solid',facadeNorth:'glass-heavy',facadeSouth:'glass-heavy',roofForm:'floating-flat',overhang:.25}),
    cottageObject('living-roof','roof-form',0,0,12,8,.3,3.85,{hostId:'living',roofForm:'gable',pitch:19,overhang:1.2,material:{id:'roof',color:'#42494a',surface:'metal',roughness:.55}}),
    cottageObject('veranda','veranda',0,5.7,12,3.4,3.1,.25,{material:{id:'timber',color:'#9b7554',surface:'wood'}}),
    cottageObject('accent','wall',-4.8,4.16,2.2,.18,3.4,.25,{geometryKind:'box',material:{id:'timber',color:'#9b7554',surface:'wood'}}),
    cottageObject('pool-deck','terrace',1,10,15,6,.25,0),
    cottageObject('plunge-pool','pool',3,10,6,3,1.3,-1.05,{material:{id:'water',color:'#348b9b',surface:'water'}}),
    cottageObject('entry-path','path',-1,-7,1.8,6,.12,0),
    cottageObject('driveway','path',-6,-13,4,8,.12,0),
    cottageObject('garden-east','landscape-zone',12,3,7,15,.15,0),
    cottageObject('garden-west','landscape-zone',-15,7,6,9,.15,0),
  ]};
}

/** V2 comparison input is fixture-only, derived from the same named intent. */
export function compileCottageV2(scene = expressiveCottage()) {
  const masses: MassVolume[] = scene.objects.filter(o=>o.type==='building-mass').map(o=>{
    const a=o.architecture!;
    const openings = o.composition?.openings?.map(builderOpening) ?? (['north','east','south','west'] as const).flatMap<MassOpening>(facade=>{
      const preset=o[`facade${facade[0].toUpperCase()+facade.slice(1)}` as 'facadeNorth']??o.facadePreset;
      if(preset==='solid') return [];
      return preset==='glass-heavy' ? [{type:'glazing-zone' as const,facade,start:.09,end:.91,heightRatio:.86}] : [{type:'opening-rhythm' as const,facade,count:Math.max(1,Math.floor((facade==='north'||facade==='south'?a.width:a.depth)/2.4)),width:1.2,height:1.5,sill:.8}];
    });
    const veranda=scene.objects.find(o=>o.id==='veranda')!.architecture!;
    const assemblies: MassVolume['assemblies']=o.id==='living'?[{id:'veranda',intent:'Deep covered veranda',parts:[
      {id:'deck',type:'slab',level:0,facade:'south',start:0,end:1,depth:veranda.depth,thickness:.22},
      {id:'cover',type:'slab',level:0,facade:'south',start:0,end:1,depth:veranda.depth,thickness:.2,elevation:veranda.height-.2},
      ...[0,.25,.5,.75,1].map((at,i)=>({id:'post-'+i,type:'post' as const,level:0,facade:'south' as const,at,depth:veranda.depth-.12,height:veranda.height-.42,elevation:.22,size:.16})),
      {id:'header',type:'beam',level:0,facade:'south',start:0,end:1,depth:veranda.depth-.12,height:.14,elevation:veranda.height-.34,thickness:.16},
    ]}]:undefined;
    return {id:o.id,name:o.label,role:o.id==='living'?'main-living':o.id==='bedroom'?'bedroom-wing':'connector',position:{x:a.x,z:a.z},width:a.width,depth:a.depth,height:a.height,floors:1,elevation:a.baseElevation,rotation:0,openings,assemblies};
  });
  const doc: ArchitecturalDesignDocument = {...structuredClone(ARCHITECTURE_FIXTURES.modernTropicalCourtyardVilla), massing:{composition:'pavilion-cluster',masses}, roofs:{recipes:masses.map(m=>{
    const o=scene.objects.find(o=>o.hostId===m.id&&o.type==='roof-form')??scene.objects.find(o=>o.id===m.id)!;
    return {id:m.id+'-roof',massId:m.id,kind:o.roofForm==='terrace'?'flat':o.roofForm??'flat',overhang:o.overhang??.75,pitch:o.pitch??12};
  })}};
  const result=compileArchitecture(doc,{materials:{...DEFAULT_MATERIALS_CONFIG,exterior:{material:'stone',color:stone.color},roof:{material:'metal',color:'#42494a'}}});
  // Controlled common site/amenity layer: deliberately excluded from V2 construction claims.
  const common=compileV3Scene({...scene,objects:scene.objects.filter(o=>!['building-mass','roof-form','veranda'].includes(o.type))});
  return {...result,model:{...result.model,primitives:[...common.primitives,...result.model.primitives]}};
}
