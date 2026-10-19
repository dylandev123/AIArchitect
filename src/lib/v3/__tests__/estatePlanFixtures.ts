import type { V3Scene, V3SceneObject } from '../scene';
import type { V3EstatePlan } from '../estatePlan';
import { materializeV3ArchitecturalObject } from '../architecture';

const object = (id: string, type: string, x: number, z: number, width: number, depth: number, height: number, rotationY = 0): V3SceneObject => materializeV3ArchitecturalObject({
  ...(type==='building-mass'?{levels:1,composition:{openings:[{id:`${id}-door`,type:'door' as const,facade:'south' as const,floors:'ground' as const,start:.4,end:.6}]}}:{}),
  id, type, label: id, semanticRole: id, geometryKind: 'box',
  architecture: { x,z,width,depth,height,baseElevation:0,rotationY },
  transform: {position:[x,height/2,z],rotation:[0,0,0],scale:[1,1,1]}, dimensions:[width,height,depth],
  material: {id:'limestone',color:'#c8bdac'}, collision:type==='building-mass'?'solid':'walkable',
});

/** Three different property programs, not amenity substitutions in a common mansion template. */
export function estateFixtures(): V3Scene[] {
  const sculptural = [object('sculpture-house','building-mass',0,0,24,12,4,.25), object('arrival-walk','path',0,12,3,12,.1), object('wild-meadow','landscape-zone',0,24,36,12,.05)];
  const compound = [object('main-residence','building-mass',0,0,30,18,4),object('guest-lodge','building-mass',-35,0,12,12,3),object('atelier','building-mass',35,0,14,10,5),object('orchard-walk','path',0,17,3,16,.1),object('orchard','landscape-zone',0,32,60,18,.05)];
  const urban = [object('urban-residence','building-mass',0,0,12,16,9),object('entry-passage','path',0,8.5,2,1,.1),object('walled-garden','landscape-zone',0,12,12,6,.05)];
  urban[0].levels=3;
  return [sculptural,compound,urban].map((objects,i)=>{
    const residence=objects[0], path=objects.find(o=>o.type==='path')!, garden=objects.at(-1)!;
    const [width,depth]=[[80,80],[120,100],[20,36]][i];
    const plan: V3EstatePlan={version:1,
      concept:['A solitary rotated limestone sculpture in wild meadow','A dispersed family estate with guest lodge and independent artist atelier','A vertical urban sanctuary with a secluded rear garden'][i],
      character:['Quiet, monolithic and landscape-led','Informal orchard compound with distinct destinations','Private street frontage and compact layered living'][i],
      requirements:[{id:'size-brief',source:'user',statement:`Site ${width} metres wide`,metric:'siteWidth',objectIds:[],range:{min:width,max:width}}, {id:'area-brief',source:'user',statement:'Preserve the explicit residence floor area',metric:'floorArea',objectIds:[residence.id],range:{min:residence.dimensions[0]*residence.dimensions[2]*(residence.levels??1),max:residence.dimensions[0]*residence.dimensions[2]*(residence.levels??1)}}],
      program:objects.map(o=>({id:`program-${o.id}`,role:o.label,kind:o===residence?'residence':o.type==='building-mass'?'building':'landscape',objectIds:[o.id],source:'design'})),
      zones:[{id:'residential-domain',purpose:'Residence and its immediate setting',objectIds:[residence.id],allocation:{x:0,z:0,width:i===2?14:36,depth:i===2?18:28}}, {id:'open-land',purpose:'Intentional usable garden clearing',objectIds:[garden.id],allocation:{x:garden.transform.position[0],z:garden.transform.position[2],width:garden.dimensions[0],depth:garden.dimensions[2]},clearSpace:{x:0,z:garden.transform.position[2],width:6,depth:4,baseElevation:.1,height:2}}],
      circulation:[{id:'pedestrian-arrival',purpose:i===1?'Shared pedestrian and service approach':'Pedestrian arrival',from:garden.id,to:residence.id,via:[path.id]}],
      relationships:[],considerations:[{id:'garden-privacy',kind:'privacy',intent:'Keep the garden sheltered from arrival',objectIds:[residence.id,garden.id]}]};
    return {version:3,...(i===2 ? {interior:{storeys:[],rooms:[],circulation:[{id:'urban-stair',type:'stair' as const,hostMassId:residence.id,fromLevel:0,toLevel:2,footprint:{x:0,z:0,width:2.6,depth:4.6},stairType:'u-shaped' as const}]}} : {}),site:{width,depth,baseElevation:0},objects,estatePlan:plan,relationships:[{from:garden.id,to:path.id,kind:'connects'},{from:path.id,to:residence.id,kind:'connects'}],metadata:{}};
  });
}
