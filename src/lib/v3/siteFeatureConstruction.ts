/** V3 site boundaries use the same line/arc resolver and mesh vocabulary as masses.
 * No alternate scene, inferred outline or rectangular construction fallback. */
import { ellipseOutline, extrudeBand, extrudeOutline, flatPolygon, subtractConvex, triangulate, type P2 } from '@/lib/house/geometry/mesh';
import type { HousePrimitive, PrimitiveCategory } from '@/lib/house/types';
import type { V3Scene, V3SceneObject, V3Material } from './scene';
import { authoredPlan } from './authoredPlan';
import { footprintContains, resolveFootprint, simpleFootprint } from './footprint';
import { offsetPath } from './curvedFootprint';
import { getObjectBaseY, getObjectTopY } from './elevation';

export const SHAPED_SITE_TYPES = new Set(['terrace','courtyard','pool','fountain','landscape-zone','path','driveway']);
export const isWaterFeature = (o: Pick<V3SceneObject,'type'>) => o.type==='pool'||o.type==='fountain';
export const usesSiteBoundary = (o:V3SceneObject) => o.type==='fountain'||!!o.composition?.footprint&&SHAPED_SITE_TYPES.has(o.type);
const insetWidth = (o:V3SceneObject) => Math.min(.22,o.dimensions[0]*.1,o.dimensions[2]*.1);
function localBoundary(o:V3SceneObject):P2[]|undefined {
  if(!o.composition?.footprint)return [[-o.dimensions[0]/2,-o.dimensions[2]/2],[o.dimensions[0]/2,-o.dimensions[2]/2],[o.dimensions[0]/2,o.dimensions[2]/2],[-o.dimensions[0]/2,o.dimensions[2]/2]];
  const fp=resolveFootprint(o,0);
  return fp?.polygon.map(([x,z])=>[x+fp.frame.x,z+fp.frame.z]);
}
/** Plan-only checks. Pool shells and perimeter courts need a nonfolding inset. */
export function siteFeatureConstructionIssues(o:V3SceneObject):string[] {
  if(!usesSiteBoundary(o))return o.composition?.footprint?['Detailed nonrectangular construction is unsupported for this feature type.']:[];
  const p=localBoundary(o);
  if(!p)return ['Invalid site outline; no rectangular substitute is constructed.'];
  if(isWaterFeature(o)||o.type==='courtyard'){
    const inner=offsetPath(p,-insetWidth(o));
    if(!simpleFootprint(inner)||!footprintContains(o,inner))return ['Boundary is too narrow or concave for a valid inset basin/perimeter. Widen the authored neck or simplify its boundary.'];
  }
  if(o.type==='fountain'&&!footprintContains(o,[[-.06,-.06],[.06,-.06],[.06,.06],[-.06,.06]]))return ['The fountain jet must fit inside its authored basin at the local origin.'];
  return [];
}
const world = (o:V3SceneObject,p:readonly (readonly [number,number])[]):P2[] => {
  const a=o.transform.rotation[1],c=Math.cos(a),s=Math.sin(a);
  return p.map(([x,z])=>[o.transform.position[0]+x*c+z*s,o.transform.position[2]-x*s+z*c]);
};
const convex = (p:readonly (readonly [number,number])[]) => p.every((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>=-1e-8;});
/** Concave cutouts are decomposed using the existing triangulator, never their box. */
export function cutSiteSurface(outline:P2[],holes:P2[][]):P2[][] {
  if(!holes.length)return [outline];
  let pieces=convex(outline)?[outline]:triangulate(outline).map(t=>t.map(i=>outline[i]));
  for(const hole of holes)for(const cutter of convex(hole)?[hole]:triangulate(hole).map(t=>t.map(i=>hole[i])))pieces=pieces.flatMap(piece=>subtractConvex(piece,cutter));
  return pieces;
}
/** Plan and 3D use these same occupied regions: paving cannot cover pool water. */
export function siteSurfaceRegions(o:V3SceneObject,scene:V3Scene):P2[][] {
  const outline=authoredPlan(o),base=getObjectBaseY(o),top=getObjectTopY(o);
  const holes=scene.objects.filter(p=>isWaterFeature(p)&&p.id!==o.id&&base<=getObjectTopY(p)+.15&&top>=getObjectBaseY(p))
    .filter(p=>{const q=authoredPlan(p);return [0,1].every(k=>Math.max(...q.map(v=>v[k]))>Math.min(...outline.map(v=>v[k]))&&Math.min(...q.map(v=>v[k]))<Math.max(...outline.map(v=>v[k])));}).map(p=>authoredPlan(p));
  return cutSiteSurface(outline,holes);
}
/** Drawing uses actual paved regions, including a shaped courtyard's open centre. */
export function siteFeaturePlanRegions(o:V3SceneObject,scene:V3Scene):P2[][] {
  if(o.type==='courtyard'&&o.composition?.footprint){
    const p=localBoundary(o);
    return p&&!siteFeatureConstructionIssues(o).length?cutSiteSurface(world(o,p),[world(o,offsetPath(p,-insetWidth(o)))]):[];
  }
  return ['terrace','driveway','path'].includes(o.type)?siteSurfaceRegions(o,scene):[authoredPlan(o)];
}
export function compileShapedSiteFeature(o:V3SceneObject,scene:V3Scene):HousePrimitive[]|undefined {
  if(!usesSiteBoundary(o))return;
  if(siteFeatureConstructionIssues(o).length)return []; // audited; fail closed
  const p=localBoundary(o)!,outer=world(o,p),base=getObjectBaseY(o),top=getObjectTopY(o);
  const mesh=(suffix:string,role:string,vertices:number[],category:PrimitiveCategory,material:V3Material=o.material):HousePrimitive=>({
    kind:'triMesh',id:`${o.id}-${suffix}`,label:`${o.label} · ${role}`,sourceObjectId:o.id,semanticRole:o.semanticRole,componentRole:role,vertices,category,
    color:material.color,roughness:material.roughness,metalness:material.metalness,surface:material.surface==='water'?undefined:material.surface,
    ...(material.surface==='water'?{transparent:true,opacity:material.opacity??.86}:{}),
  });
  if(isWaterFeature(o)){
    const inner=world(o,offsetPath(p,-insetWidth(o))),closed=(p:P2[])=>[...p,p[0]],waterY=top-Math.min(.04,(top-base)*.04);
    const basin:V3Material={id:'pool-basin',color:'#1e586d',roughness:.34,surface:'concrete'},coping:V3Material={id:'pool-coping',color:'#d6cbb6',roughness:.68,surface:'paving'};
    const out=[mesh('basin','shaped basin floor',extrudeOutline(outer,base,base+Math.min(.2,(top-base)*.15),{bottom:true}),'pool',basin),
      mesh('shell','shaped basin shell',extrudeBand(closed(outer),closed(inner),base,top),'pool',basin),
      mesh('coping','shaped basin coping',extrudeBand(closed(outer),closed(inner),top-.03,top+.05),'pool',coping),
      mesh('water','water surface',flatPolygon(inner,waterY),'pool',{...o.material,surface:'water'})];
    if(o.type==='fountain')out.push(mesh('jet','fountain jet',extrudeOutline(world(o,ellipseOutline(.12,.12,12)),waterY,top+Math.min(3,Math.max(1,(top-base)*2))),'waterway',{...o.material,surface:'water',opacity:.72}));
    return out;
  }
  if(o.type==='courtyard'){
    const inner=world(o,offsetPath(p,-insetWidth(o)));
    return [mesh('perimeter','shaped courtyard perimeter',extrudeBand([...outer,outer[0]],[...inner,inner[0]],base,top),'patio',{id:'courtyard-paving',color:'#b8ad98',roughness:.74,surface:'paving'})];
  }
  const regions=o.type==='landscape-zone'?[outer]:siteSurfaceRegions(o,scene);
  const vertices=regions.flatMap(p=>extrudeOutline(p,base,top,{bottom:true}));
  return vertices.length?[mesh('surface',o.type==='landscape-zone'?'landscape groundcover':'authored site surface',vertices,o.type==='landscape-zone'?'landscape':o.type==='driveway'?'driveway':o.type==='path'?'path':'patio')]:[];
}
