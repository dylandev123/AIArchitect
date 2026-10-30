import {expect,it} from 'vitest';
import {Box3,PerspectiveCamera,Vector3} from 'three';
import {presentationDistance} from './presentation';
it.each([[7,7,30],[50,6,10],[9,30,9]])('frames all corners of a %s×%s×%s building at varied aspect ratios',(w,h,d)=>{
 const box=new Box3(new Vector3(40,0,-30),new Vector3(40+w,h,-30+d));
 const target=box.getCenter(new Vector3());
 for(const aspect of [16/9,1,.65])for(const direction of [new Vector3(1,.25,1),new Vector3(.35,1.4,.45),new Vector3(0,.2,1)]){
  const camera=new PerspectiveCamera(40,aspect,.1,4000);
  camera.position.copy(target).addScaledVector(direction.clone().normalize(),presentationDistance(box,direction,40,aspect));
  camera.lookAt(target);camera.updateMatrixWorld();
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const p=new Vector3(x,y,z).project(camera);
   expect(Math.abs(p.x)).toBeLessThan(1);expect(Math.abs(p.y)).toBeLessThan(1);expect(p.z).toBeLessThan(1);expect(p.z).toBeGreaterThan(-1);
  }
 }
});
