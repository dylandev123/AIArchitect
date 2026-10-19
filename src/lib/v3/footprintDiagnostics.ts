import { floatingRoofSupportError } from './roofSupport';
import { v3CompositionSchema } from './composition';
import type { V3Scene } from './scene';
import { compileFootprintMass, compileFootprintRoof, type FootprintDiagnostic } from './footprintConstruction';
import { resolveFootprint, footprintContains } from './footprint';
import { v3MassLevelCount, v3StoreyBase } from './stacking';
import { scaledDimensionsOf } from './elevation';
export function footprintDiagnostics(scene:V3Scene):FootprintDiagnostic[]{
 const out:FootprintDiagnostic[]=[];

 for(const o of scene.objects){
  if(!o?.material||!Array.isArray(o.transform?.position)||!Array.isArray(o.transform?.rotation)||!Array.isArray(o.transform?.scale)||!Array.isArray(o.dimensions)||![...o.transform.position,...o.transform.rotation,...o.transform.scale,...o.dimensions].every(Number.isFinite))continue;
  if(o.type==='building-mass'&&o.composition?.footprint){
   if(!v3CompositionSchema.safeParse({...o.composition,footprint:undefined}).success)continue;
   if(Array.from({length:v3MassLevelCount(o)},(_,i)=>resolveFootprint(o,i)).some(fp=>!fp)){out.push({code:'FOOTPRINT_INVALID',targetId:o.id,message:o.composition.footprint.kind==='outline'?'Invalid curved/irregular outline: check segment fields, unique ids, clockwise closure, self-intersection, 0.2m wall clearance, placement envelope and 4096-sample limit. No substitute geometry is built.':'Malformed, overlapping, degenerate or out-of-envelope footprint; rectangular construction fallback used.'});continue;}
   const explicit=scene.objects.some(r=>r?.type==='roof-form'&&(r.hostId??r.support?.hostId??r.support?.objectId)===o.id);
   out.push(...(compileFootprintMass(o,!explicit,o.overhang,o.material,v3StoreyBase(o,scene))?.diagnostics??[]));
  }
  const host=scene.objects.find(h=>h?.id===(o.hostId??o.support?.hostId??o.support?.objectId));
  if(host&&o.type==='roof-form'){const error=floatingRoofSupportError(o,host);if(error)out.push({code:error.includes('intersects')?'ROOF_SUPPORT_UNSUPPORTED':'ROOF_SUPPORT_UNVERIFIED',targetId:o.id,message:error});}
  if(host?.composition?.footprint){
   if(o.type==='roof-form')out.push(...compileFootprintRoof(host,o).diagnostics);
   if(o.type==='terrace'||o.type==='building-mass'){
    const [w,,d]=scaledDimensionsOf(o),a=host.transform.rotation[1],r=o.transform.rotation[1]-a,dx=o.transform.position[0]-host.transform.position[0],dz=o.transform.position[2]-host.transform.position[2],x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);
    if(!footprintContains(host,[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([lx,lz])=>[x+lx*Math.cos(r)+lz*Math.sin(r),z-lx*Math.sin(r)+lz*Math.cos(r)]),v3MassLevelCount(host)-1))out.push({code:'FOOTPRINT_SUPPORT_OUTSIDE_HOST',targetId:o.id,message:`${o.id} extends outside ${host.id}'s constructed footprint; bounding-box contact is not certified support.`});
   }
  }
 }
 return out.filter((d,i)=>out.findIndex(q=>q.code===d.code&&q.targetId===d.targetId&&q.message===d.message)===i);
}
