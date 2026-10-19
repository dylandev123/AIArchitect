import type { HousePrimitive } from '@/lib/house/types';
import type { V3SceneObject } from './scene';
import { getObjectTopY, getObjectBaseY, scaledDimensionsOf } from './elevation';

/** Repair derived bearings only. The authored roof surface and scene are immutable. */
export function supportFloatingRoof(parts: HousePrimitive[], roof: V3SceneObject, host?: V3SceneObject): HousePrimitive[] {
  if (!host || host.type !== 'building-mass' || host.composition?.footprint || roof.roofForm !== 'floating-flat') return parts;
  if (floatingRoofSupportError(roof, host)) return parts;
  const [w,,d] = scaledDimensionsOf(host), yaw = host.transform.rotation[1], c = Math.cos(yaw), s = Math.sin(yaw), top = getObjectTopY(host);
  return parts.map(p => {
    if (p.kind !== 'box' || !p.id.includes('roof-bearing-')) return p;
    const dx=p.position[0]-host.transform.position[0], dz=p.position[2]-host.transform.position[2];
    const lx=dx*c-dz*s, lz=dx*s+dz*c;
    // Keep valid bearings byte-identical. Only unsupported coordinates are moved
    // onto the top slab, retaining the existing perimeter distribution.
    const x=Math.max(-w/2+p.size[0]/2,Math.min(w/2-p.size[0]/2,lx));
    const z=Math.max(-d/2+p.size[2]/2,Math.min(d/2-p.size[2]/2,lz));
    const bottom=p.position[1]-p.size[1]/2, underside=p.position[1]+p.size[1]/2;
    if(Math.abs(bottom-top)<1e-8&&Math.abs(x-lx)+Math.abs(z-lz)<1e-8)return p;
    return {...p,position:[host.transform.position[0]+x*c+z*s,(top+underside)/2,host.transform.position[2]-x*s+z*c],size:[p.size[0],underside-top,p.size[2]]};
  });
}
export function floatingRoofSupportError(roof: V3SceneObject, host: V3SceneObject): string | undefined {
  if(roof.roofForm!=='floating-flat'||host.type!=='building-mass'||host.composition?.footprint)return;
  const [w,,d]=scaledDimensionsOf(host),[rw,,rd]=scaledDimensionsOf(roof), e=roof.overhang??.75;
  if(Math.abs(host.transform.position[0]-roof.transform.position[0])+Math.abs(host.transform.position[2]-roof.transform.position[2])+Math.abs(Math.sin(host.transform.rotation[1]-roof.transform.rotation[1]))>1e-5 || rw+2*e<w || rd+2*e<d)
    return 'Automatic bearing correction requires a centred, aligned envelope covering its host. Existing offset/partial-roof bearings are unverified; author explicit supports or verify their contact.';
  if(getObjectBaseY(roof)+.45<=getObjectTopY(host))return 'Floating roof underside intersects its host top; correct the roof datum or author explicit support geometry.';
}
