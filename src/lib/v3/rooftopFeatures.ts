import { footprintContains } from './footprint';
import { v3MassLevelCount } from './stacking';
import type { HousePrimitive } from '@/lib/house/types';
import type { V3Scene, V3SceneObject } from './scene';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { localPlane, massVolume } from './junctions';
import { subtractJunctionVolume } from './junctionGeometry';

const hostId = (o: V3SceneObject) => o.hostId ?? o.support?.hostId ?? o.support?.objectId;
/** Authored rooftop occupancy only, including small and rotated partial terraces. */
export function rooftopTerraces(scene: V3Scene): V3SceneObject[] {
 return scene.objects.filter(o => {
  const host = scene.objects.find(h => h.id === hostId(o) && h.type === 'building-mass');
  if (o.type !== 'terrace' || !host || (o.collision && o.collision !== 'walkable') || Math.abs(getObjectBaseY(o)-getObjectTopY(host)) > .35) return false;
  const [w,,d]=scaledDimensionsOf(host),[tw,,td]=scaledDimensionsOf(o),a=host.transform.rotation[1],dx=o.transform.position[0]-host.transform.position[0],dz=o.transform.position[2]-host.transform.position[2];
  const x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a),rel=o.transform.rotation[1]-a;
  if (host.composition?.footprint && !footprintContains(host,[[-tw/2,-td/2],[tw/2,-td/2],[tw/2,td/2],[-tw/2,td/2]].map(([lx,lz])=>[x+lx*Math.cos(rel)+lz*Math.sin(rel),z-lx*Math.sin(rel)+lz*Math.cos(rel)]),v3MassLevelCount(host)-1)) return false;
  // Separating-axis test in both rectangle frames (no bounding-box false positives for skew terraces).
  const axes=[a,a+Math.PI/2,o.transform.rotation[1],o.transform.rotation[1]+Math.PI/2];
  return Math.abs(x)<w/2+(tw*Math.abs(Math.cos(rel))+td*Math.abs(Math.sin(rel)))/2 && Math.abs(z)<d/2+(tw*Math.abs(Math.sin(rel))+td*Math.abs(Math.cos(rel)))/2 && axes.every(axis=>{
   const projection=Math.abs(dx*Math.cos(axis)-dz*Math.sin(axis));
   return projection < (w*Math.abs(Math.cos(axis-a))+d*Math.abs(Math.sin(axis-a))+tw*Math.abs(Math.cos(axis-o.transform.rotation[1]))+td*Math.abs(Math.sin(axis-o.transform.rotation[1])))/2;
  });
 });
}

/** Cut only the occupied patch from flat roof trim/plates; retain the rest and every stable primitive id. */
export function finishRooftopTerraces(scene: V3Scene, terraces: V3SceneObject[], parts: HousePrimitive[]): HousePrimitive[] {
 let result=parts;
 for(const terrace of terraces) {
  const [w,,d]=scaledDimensionsOf(terrace),top=getObjectTopY(terrace);
  const footprint=[localPlane(terrace,[1,0,0],w/2),localPlane(terrace,[-1,0,0],w/2),localPlane(terrace,[0,0,1],d/2),localPlane(terrace,[0,0,-1],d/2)];
  result=result.flatMap(p=>{
   const owner=scene.objects.find(o=>o.id===p.sourceObjectId),host=hostId(terrace);
   const ownsRoof=owner?.id===host || (owner?.type==='roof-form' && hostId(owner)===host);
   if(!ownsRoof || p.category!=='roof' || !['flat','floating-flat','terrace'].includes(owner?.roofForm??'flat'))return [p];
   const clipped=subtractJunctionVolume(p,footprint);return clipped?[clipped]:[];
  });
  // Explicit authored railings remain authoritative.
  if(terrace.railing === 'none' || scene.objects.some(o=>['railing','railing-run'].includes(o.type) && hostId(o)===terrace.id))continue;
  const rails:HousePrimitive[]=[],yaw=terrace.transform.rotation[1],c=Math.cos(yaw),s=Math.sin(yaw);
  const add=(id:string,x:number,y:number,z:number,size:[number,number,number])=>rails.push({kind:'box',id:`${terrace.id}-guard-${id}`,sourceObjectId:terrace.id,semanticRole:terrace.semanticRole,componentRole:'rooftop guardrail',label:'Rooftop guardrail',category:'balcony',position:[terrace.transform.position[0]+x*c+z*s,y,terrace.transform.position[2]-x*s+z*c],rotation:[0,yaw,0],size,color:'#30383b',roughness:.4,metalness:.7});
  for(const [side,alongX,offset,span] of [['north',true,-d/2,w],['south',true,d/2,w],['west',false,-w/2,d],['east',false,w/2,d]] as const){
   if(terrace.terraceOpenEdges?.includes(side))continue;
   const inset=offset-Math.sign(offset)*.06;
   for(const [suffix,y,h] of [['top',top+1.1,.06],['lower',top+.12,.04]] as const)add(`${side}-${suffix}`,alongX?0:inset,y,alongX?inset:0,alongX?[span,h,.045]:[.045,h,span]);
   const count=Math.max(1,Math.ceil(span/1.2));
   for(let i=0;i<=count;i++){const at=-span/2+.06+(span-.12)*i/count;add(`${side}-post-${i}`,alongX?at:inset,top+.55,alongX?inset:at,[.045,1.1,.045]);}
   // Slender vertical infill with clear gaps, rather than an opaque parapet.
   const infill=Math.max(1,Math.ceil(span/.14));
   for(let i=1;i<infill;i++){const at=-span/2+span*i/infill;add(`${side}-infill-${i}`,alongX?at:inset,top+.6,alongX?inset:at,[.018,.94,.018]);}
  }
  // Trim rails where a taller building occupies the edge; never run guards through a roof-access wall.
  for(const rail of rails){let p:HousePrimitive|undefined=rail;for(const mass of scene.objects.filter(o=>o.type==='building-mass'&&getObjectTopY(o)>top+.15)){if(p)p=subtractJunctionVolume(p,massVolume(mass));}if(p)result.push(p);}
 }
 return result;
}
