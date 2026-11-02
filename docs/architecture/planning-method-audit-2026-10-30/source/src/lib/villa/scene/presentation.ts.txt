import {Box3,Vector3} from 'three';

/** Fit actual projected bounds instead of a sphere around a long thin property.
 * Includes depth towards the camera; every box corner remains inside the frame. */
export function presentationDistance(bounds:Box3,direction:Vector3,verticalFov:number,aspect:number) {
 const centre=bounds.getCenter(new Vector3());
 const forward=direction.clone().normalize();
 const right=new Vector3(0,1,0).cross(forward).normalize();
 const up=forward.clone().cross(right).normalize();
 const tanV=Math.tan(verticalFov*Math.PI/360),tanH=tanV*aspect;
 let distance=0;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const p=new Vector3(x,y,z).sub(centre);
  distance=Math.max(distance,p.dot(forward)+Math.max(Math.abs(p.dot(right))/tanH,Math.abs(p.dot(up))/tanV));
 }
 return Math.max(1,distance*1.1);
}
