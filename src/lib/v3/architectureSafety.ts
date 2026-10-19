import type { V3Scene } from './scene';
import { authoredOverlap } from './authoredPlan';
import { getObjectBaseY,getObjectTopY } from './elevation';
/** Construction failures must not become successful generations under lenient physical validation. */
export const BLOCKING_FOOTPRINT_CODES=new Set(['ROOF_SUPPORT_UNSUPPORTED','FOOTPRINT_INVALID','ROOF_FOOTPRINT_UNSUPPORTED','ROOF_FOOTPRINT_ALIGNMENT_UNSUPPORTED','FOOTPRINT_SEGMENT_UNRESOLVED','FOOTPRINT_COMPONENT_UNSUPPORTED','FOOTPRINT_OPENING_CLIPPED','FOOTPRINT_FACADE_AMBIGUOUS','FOOTPRINT_FACADE_UNRESOLVED','FOOTPRINT_ASSEMBLY_UNRESOLVED']);
export function curvedMassConflicts(scene:V3Scene){
 const out:{code:string;targetId:string;message:string}[]=[],masses=scene.objects.filter(o=>o.type==='building-mass');
 for(let i=0;i<masses.length;i++)for(let j=i+1;j<masses.length;j++){
  const a=masses[i],b=masses[j];
  if(![a,b].some(o=>o.composition?.footprint?.kind==='outline')||Math.min(getObjectTopY(a),getObjectTopY(b))-Math.max(getObjectBaseY(a),getObjectBaseY(b))<.2)continue;
  if(authoredOverlap(a,b)>.02)out.push({code:'CURVED_MASS_INTERSECTION_UNSUPPORTED',targetId:a.id,message:`${a.id} intersects ${b.id}'s actual footprint. Curved mass Boolean junctions are unsupported; preserve both authored forms and separate the masses or request a supported connection. Never replace either outline with a box.`});
 }
 return out;
}
