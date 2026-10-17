// Offline diagnostic viewer: npm exec esbuild scripts/parity-viewer.mjs -- --bundle --outfile=/tmp/cottage-parity/viewer.js
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const data=await (await fetch('./models.json')).json();
const cameras=[],controls=[];
for(const key of ['v2','v3']){
 const el=document.getElementById(key),scene=new THREE.Scene();scene.background=new THREE.Color('#dce4e5');
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth/2,innerHeight-70);renderer.setPixelRatio(devicePixelRatio);renderer.shadowMap.enabled=true;el.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(40,(innerWidth/2)/(innerHeight-70),.1,300);camera.position.set(30,23,37);cameras.push(camera);
 const control=new OrbitControls(camera,renderer.domElement);control.target.set(-2,1,2);control.update();controls.push(control);
 scene.add(new THREE.HemisphereLight('#ffffff','#6b7059',2));const sun=new THREE.DirectionalLight('#fff3de',3);sun.position.set(15,30,20);scene.add(sun);
 for(const p of data[key].primitives){let g;
 if(p.kind==='box')g=new THREE.BoxGeometry(...p.size);
 else if(p.kind==='triMesh'){g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.vertices,3));g.computeVertexNormals();}else continue;
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:p.color,roughness:p.roughness??.7,metalness:p.metalness??0,transparent:p.transparent??false,opacity:p.opacity??1,side:THREE.DoubleSide}));
 if(p.kind==='box'){mesh.position.set(...p.position);mesh.rotation.set(...p.rotation);}scene.add(mesh);
 }
 renderer.setAnimationLoop(()=>renderer.render(scene,camera));
}
let syncing=false;controls.forEach((c,i)=>c.addEventListener('change',()=>{if(syncing)return;syncing=true;cameras[1-i].position.copy(cameras[i].position);controls[1-i].target.copy(c.target);controls[1-i].update();syncing=false;}));
document.getElementById('view').onclick=()=>{const north=cameras[0].position.z>0; cameras[0].position.set(north?-28:30, north?17:23,north?-36:37);controls[0].update();};
