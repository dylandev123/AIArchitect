import type { V3Scene } from './scene';
import { materializeV3ArchitecturalScene } from './architecture';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { roofHostId } from './compositionPolicies';

/** Conservative composition diagnostics, NOT a roof boolean or proof of a collision.
 * Reports envelope candidates; no geometry/intent is silently moved to hide a junction.
 */
export function auditV3RoofComposition(input: V3Scene) {
  const scene = materializeV3ArchitecturalScene(input);
  const roofs = scene.objects.filter(o => o.type === 'roof-form' || o.type === 'building-mass' && !scene.objects.some(r => r.type === 'roof-form' && roofHostId(r) === o.id)).map(o => {
    const [w,,d] = scaledDimensionsOf(o), e = o.overhang ?? .75, yaw = o.transform.rotation[1];
    const base = o.type === 'building-mass' ? getObjectTopY(o) : getObjectBaseY(o);
    const pitched = ['hip','gable','mono-pitch'].includes(o.roofForm ?? 'flat');
    const rise = pitched ? Math.tan((o.pitch ?? 12) * Math.PI / 180) * (o.roofForm === 'mono-pitch' ? d + 2*e : Math.min(w,d)/2 + e) : 0;
    return {o, base, top:base+rise+.5, x:w/2+e, z:d/2+e, axes:[[Math.cos(yaw),-Math.sin(yaw)],[Math.sin(yaw),Math.cos(yaw)]]};
  }).sort((a,b)=>a.o.id.localeCompare(b.o.id));
  const issues: {code:string; targets:string[]; message:string}[] = [];
  for (let i=0;i<roofs.length;i++) for(let j=i+1;j<roofs.length;j++) {
    const a=roofs[i], b=roofs[j];
    const delta=[b.o.transform.position[0]-a.o.transform.position[0],b.o.transform.position[2]-a.o.transform.position[2]];
    const dot=(u:number[],v:number[])=>u[0]*v[0]+u[1]*v[1];
    const overlaps=[...a.axes,...b.axes].every(axis => Math.abs(dot(delta,axis)) < a.x*Math.abs(dot(a.axes[0],axis))+a.z*Math.abs(dot(a.axes[1],axis))+b.x*Math.abs(dot(b.axes[0],axis))+b.z*Math.abs(dot(b.axes[1],axis)));
    if (!overlaps) continue;
    const targets=[a.o.id,b.o.id], diff=Math.abs(a.base-b.base);
    if(diff>.01 && diff<.6) issues.push({code:'NEAR_ROOF_DATUM',targets,message:'Nearby eaves differ by less than 0.6 m; explicitly align or separate their authored datums.'});
    if(a.top>b.base && b.top>a.base) issues.push({code:'ROOF_JUNCTION_REVIEW',targets,message:'Roof envelopes overlap. V3 has no cross-mass valley, union, skew intersection or flashing solver; inspect this junction.'});
  }
  return issues;
}
