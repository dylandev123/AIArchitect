import { VILLA_LIMITS as L } from '../limits';
import { z } from 'zod';

/** Version-pinned procedural component; also retained for the original local studies. Metres, +Y up,
 * local origin at floor centre, open entrance toward +Z; yaw uses Three.js positive Y rotation. */
export const pavilionPlacementSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  builder: z.literal('curved-pavilion@1'),
  x: z.number().min(-L.position).max(L.position), z: z.number().min(-L.position).max(L.position),
  orientation: z.number().min(0).max(359),
  width: z.number().min(6).max(L.pavilionWidth), depth: z.number().min(5).max(L.pavilionDepth),
  height: z.number().min(3).max(L.pavilionHeight),
  material: z.enum(['ivory', 'limestone']),
}).strict();
export type PavilionPlacement = z.infer<typeof pavilionPlacementSchema>;
export const PAVILION_EAVE = .65;
/** Exact AABB of the rotated elliptical roof, including its overhang. */
export function pavilionBounds(p: PavilionPlacement) {
  const a=p.orientation*Math.PI/180, rx=p.width/2+PAVILION_EAVE, rz=p.depth/2+PAVILION_EAVE;
  const dx=Math.hypot(rx*Math.cos(a),rz*Math.sin(a)), dz=Math.hypot(rx*Math.sin(a),rz*Math.cos(a));
  return {left:p.x-dx,right:p.x+dx,rear:p.z-dz,front:p.z+dz};
}
export function pavilionEntry(p: PavilionPlacement) {
  const a=p.orientation*Math.PI/180;
  // Anchor the 2.4 m approach at a chord that fits inside the elliptical floor.
  const offset=p.depth/2*Math.sqrt(1-(1.2/(p.width/2))**2);
  return {position:[p.x+Math.sin(a)*offset,.47,p.z+Math.cos(a)*offset], normal:[Math.sin(a),0,Math.cos(a)], width:2.4};
}

/** Conservative AABB of the 2.4 m wide pedestrian approach, from entry chord outward. */
export function pavilionApproachBounds(p: PavilionPlacement) {
  const entry=pavilionEntry(p), a=p.orientation*Math.PI/180;
  const points=[-1.2,1.2].flatMap(side=>[0,2.4].map(distance=>({
    x:entry.position[0]+Math.cos(a)*side+Math.sin(a)*distance,
    z:entry.position[2]-Math.sin(a)*side+Math.cos(a)*distance,
  })));
  return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),rear:Math.min(...points.map(p=>p.z)),front:Math.max(...points.map(p=>p.z))};
}
