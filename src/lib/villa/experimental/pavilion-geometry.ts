import * as THREE from 'three';

/** Bounded deterministic geometry; never executes model-authored code. Triangles feed the
 * existing PrimitiveMesh renderer and PBR material system, like the kit's masonry arches. */
export function ellipsePlate(rx:number, rz:number, thickness:number) {
  const shape=new THREE.Shape();
  shape.absellipse(0,0,rx,rz,0,Math.PI*2,false,0);
  return extrude(shape,thickness);
}
export function ellipseArc(rx:number,rz:number,thickness:number,height:number,start:number,end:number) {
  const shape=new THREE.Shape(), n=Math.ceil((end-start)/2);
  for(let i=0;i<=n;i++) {
    const a=(start+(end-start)*i/n)*Math.PI/180, x=rx*Math.sin(a), y=-rz*Math.cos(a);
    if(i===0) shape.moveTo(x,y); else shape.lineTo(x,y);
  }
  for(let i=n;i>=0;i--) {
    const a=(start+(end-start)*i/n)*Math.PI/180;
    shape.lineTo((rx-thickness)*Math.sin(a),-(rz-thickness)*Math.cos(a));
  }
  shape.closePath();
  return extrude(shape,height);
}
function extrude(shape:THREE.Shape,height:number) {
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:64,steps:1});
  geometry.rotateX(-Math.PI/2);
  const vertices=Array.from(geometry.attributes.position.array);
  geometry.dispose();
  return vertices;
}
