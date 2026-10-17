import type { V3Scene, V3SceneObject } from './scene';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';

/** Compile-only eave limit. Authored roof family, pitch and placement remain authority.
 * Only parallel rectangular roof footprints with overlapping vertical envelopes participate;
 * low connectors beneath a roof and vertically separated storeys must not shorten its eaves.
 */
export function roofClearanceOverhangs(scene: V3Scene): Map<string, number> {
  const roofs = scene.objects.flatMap(o => {
    if (o.type !== 'building-mass' && o.type !== 'roof-form') return [];
    if (o.type === 'building-mass' && scene.objects.some(r => r.type === 'roof-form' && (r.hostId ?? r.support?.hostId ?? r.support?.objectId) === o.id)) return [];
    const [w,,d] = scaledDimensionsOf(o), overhang = Math.max(0,o.overhang ?? .75);
    const base = o.type === 'building-mass' ? getObjectTopY(o) : getObjectBaseY(o);
    const pitched = ['gable','hip','mono-pitch'].includes(o.roofForm ?? 'flat');
    const rise = pitched ? Math.tan(Math.min(60,Math.max(1,o.pitch ?? 12))*Math.PI/180)*(o.roofForm === 'mono-pitch' ? d+2*overhang : Math.min(w,d)/2) : 0;
    return [{o,w,d,overhang,lo:base-(pitched?.43:0),hi:base+rise+.45}];
  });
  const result = new Map(roofs.map(r => [r.o.id,r.overhang]));
  for(let i=0;i<roofs.length;i++) for(let j=i+1;j<roofs.length;j++) {
    const a=roofs[i],b=roofs[j];
    if(a.hi < b.lo || b.hi < a.lo) continue;
    // Avoid guessing a clipping solution for unrelated orientations.
    if(Math.abs(Math.sin(a.o.transform.rotation[1]-b.o.transform.rotation[1])) > 1e-6) continue;
    const local=(o:V3SceneObject):[number,number] => {
      const dx=o.transform.position[0]-a.o.transform.position[0], dz=o.transform.position[2]-a.o.transform.position[2], yaw=a.o.transform.rotation[1];
      return [dx*Math.cos(yaw)-dz*Math.sin(yaw),dx*Math.sin(yaw)+dz*Math.cos(yaw)];
    };
    const [x,z]=local(b.o), dx=Math.abs(x)-(a.w+b.w)/2,dz=Math.abs(z)-(a.d+b.d)/2;
    // Overlapping footprints may be intentionally stacked/composed; no Boolean redesign here.
    if(dx < -1e-6 && dz < -1e-6) continue;
    const gap=Math.hypot(Math.max(0,dx),Math.max(0,dz));
    if(a.overhang+b.overhang <= gap-.05) continue;
    const reach=Math.max(.25,(gap-.05)/2);
    result.set(a.o.id,Math.min(result.get(a.o.id)!,reach));
    result.set(b.o.id,Math.min(result.get(b.o.id)!,reach));
  }
  return result;
}
