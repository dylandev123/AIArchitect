/** Explicit common roof datum intent. No roof or wall height is inferred from proximity. */
import type { V3Scene, V3SceneObject } from './scene';
import type { HousePrimitive } from '@/lib/house/types';
import { materializeV3ArchitecturalObject } from './architecture';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { roofHostId } from './compositionPolicies';
import { massPriority, worldPoint, type V3JunctionDiagnostic } from './junctions';
export function resolveV3JunctionDatums(scene:V3Scene):{scene:V3Scene;closures:HousePrimitive[];diagnostics:V3JunctionDiagnostic[]} {
  const diagnostics:V3JunctionDiagnostic[]=[],closures:HousePrimitive[]=[],overrides=new Map<string,V3SceneObject>();
  const groups=new Map<string,V3SceneObject[]>();
  for(const o of scene.objects) {
    const group=o.composition?.roofDatumGroup;if(!group)continue;
    if(o.type!=='roof-form') {diagnostics.push({code:'DATUM_EXPLICIT_ROOF_REQUIRED',junctionId:o.id,message:'A shared roof datum group belongs on explicit roof-form objects; implicit roof and wall heights are retained.'});continue;}
    groups.set(group,[...(groups.get(group)??[]),o]);
  }
  const host=(o:V3SceneObject)=>scene.objects.find(m=>m.id===roofHostId(o)&&m.type==='building-mass');
  for(const [group,roofs] of groups) {
    const sorted=[...roofs].sort((a,b)=>(host(b)?massPriority(host(b)!):0)-(host(a)?massPriority(host(a)!):0)||a.id.localeCompare(b.id));
    const anchor=sorted[0],datum=getObjectBaseY(anchor);
    for(const roof of sorted) {
      const delta=datum-getObjectBaseY(roof),m=host(roof),key=`roof-datum:${group}:${roof.id}`;
      if(Math.abs(delta)<1e-6&&(!m||Math.abs(datum-getObjectTopY(m))<1e-6))continue;
      // A bounded raised closure is constructible. Lowering through an occupied mass or a large uplift is not.
      const coversHost = m && (()=>{const [rw,,rd]=scaledDimensionsOf(roof),[mw,,md]=scaledDimensionsOf(m),yaw=m.transform.rotation[1],dx=roof.transform.position[0]-m.transform.position[0],dz=roof.transform.position[2]-m.transform.position[2],e=roof.overhang??.75;return Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw))+mw/2<=rw/2+e&&Math.abs(dx*Math.sin(yaw)+dz*Math.cos(yaw))+md/2<=rd/2+e;})();
      if(!m||!coversHost||datum<getObjectTopY(m)-1e-6||datum-getObjectTopY(m)>.6||Math.abs(roof.transform.rotation[1]-m.transform.rotation[1])>1e-6) {
        diagnostics.push({code:'DATUM_ALIGNMENT_BLOCKED',junctionId:key,message:'Explicit group alignment would penetrate its host, require >0.6 m of new wall, mismatch orientation, or fail to cover its host. Authored geometry retained.'});continue;
      }
      const adjusted=roof.architecture?materializeV3ArchitecturalObject({...roof,architecture:{...roof.architecture,baseElevation:datum}}):{...roof,transform:{...roof.transform,position:[roof.transform.position[0],roof.transform.position[1]+delta,roof.transform.position[2]] as [number,number,number]}};
      if(Math.abs(delta)>1e-6)overrides.set(roof.id,adjusted);
      const [w,,d]=scaledDimensionsOf(m),gap=datum-getObjectTopY(m);
      if(gap>1e-6)for(const [side,x,z,size] of [['north',0,-d/2+.09,[w,gap,.18]],['south',0,d/2-.09,[w,gap,.18]],['west',-w/2+.09,0,[.18,gap,d]],['east',w/2-.09,0,[.18,gap,d]]] as const) {
        closures.push({kind:'box',id:`${key}:closure:${side}`,category:'roof',label:'Shared Roof Datum Closure',position:worldPoint(m,x,getObjectTopY(m)+gap/2,z),size:[...size],rotation:[0,m.transform.rotation[1],0],color:m.material.color,roughness:m.material.roughness,surface:m.material.surface==='wood'?'wood':m.material.surface==='stone'?'stone':'stucco',sourceObjectId:roof.id,componentRole:'roof wall infill'});
      }
    }
  }
  return {scene:overrides.size?{...scene,objects:scene.objects.map(o=>overrides.get(o.id)??o)}:scene,closures,diagnostics};
}
