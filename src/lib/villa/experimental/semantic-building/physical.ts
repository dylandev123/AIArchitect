/** Independent mesh-based offline queries for the supported renderer subset.
 * Profiles use the renderer's exact geometry builder; opening boxes mirror
 * OperationScene. Doors are assessed in their assumed open state, not as swing proofs. */
import {BoxGeometry,BufferGeometry,Float32BufferAttribute,DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {buildSceneRoof} from '../../scene/roofs';
import {buildProfileGeometry} from '../../scene/profileGeometry';
import {sceneSpatialGeometry} from '../../scene/spatial';
import type {ArchitecturalScene} from '../../scene/model';
import type {compileBuilding,Point} from './compiler';
export function physicalMeshes(scene:ArchitecturalScene,openDoors=true){
 const g=sceneSpatialGeometry(scene),meshes:Mesh[]=[],material=new MeshBasicMaterial({side:DoubleSide});
 for(const e of scene.elements){
  if(openDoors&&e.kind==='entrance')continue;
  const [x,y,z,yaw]=g.world(e),[w,h,d]=e.size;
  const add=(size:number[],at:number[])=>{if(size.some(v=>v<=0))return;const m=new Mesh(new BoxGeometry(...size as [number,number,number]),material);m.name=e.id;m.position.set(x+Math.cos(yaw)*at[0]+Math.sin(yaw)*at[2],y+at[1],z-Math.sin(yaw)*at[0]+Math.cos(yaw)*at[2]);m.rotation.y=yaw;m.updateMatrixWorld();meshes.push(m);};
  if(e.geometry){const m=new Mesh(buildProfileGeometry(e.geometry,e.size),material);m.name=e.id;m.position.set(x,y,z);m.rotation.y=yaw;m.updateMatrixWorld();meshes.push(m);}
  else if(e.kind==='screen'){for(let i=0;i<e.panels;i++)add([.07,h,d],[-w/2+i*w/(e.panels-1||1),0,0]);}
  else if(e.kind==='roof'&&e.roofForm&&e.roofForm!=='flat'){
   for(const part of buildSceneRoof(e,{color:'#ffffff',roughness:.7,metalness:0})){
    if(part.kind==='box'){const before=meshes.length;add(part.size,part.position);meshes[before].rotation.set(...part.rotation);meshes[before].rotation.y+=yaw;meshes[before].updateMatrixWorld();}
    else if(part.kind==='triMesh'){const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(part.vertices,3));geometry.computeVertexNormals();const m=new Mesh(geometry,material);m.name=e.id;m.position.set(x,y,z);m.rotation.y=yaw;m.updateMatrixWorld();meshes.push(m);}
   }
  }
  else if(e.opening){const o=e.opening,l=o.x-o.width/2,r=o.x+o.width/2;add([l+w/2,h,d],[(-w/2+l)/2,0,0]);add([w/2-r,h,d],[(w/2+r)/2,0,0]);add([o.width,o.sill,d],[o.x,-h/2+o.sill/2,0]);add([o.width,h-o.sill-o.height,d],[o.x,(o.sill+o.height)/2,0]);if(o.glazed)add([o.width,o.height,.05],[o.x,-h/2+o.sill+o.height/2,0]);}
  else add(e.size,[0,0,0]);
 }
 return {meshes,dispose:()=>{meshes.forEach(m=>m.geometry.dispose());material.dispose();}};
}
export function physicalEvidence(result:ReturnType<typeof compileBuilding>){
 const {intent}=result,{meshes,dispose}=physicalMeshes(result.scene),ray=new Raycaster(),checks:{id:string;samples:number;failures:string[]}[]=[];
 const world=(p:Point,y:number)=>new Vector3(intent.frame.origin[0]+Math.cos(intent.frame.yaw)*p[0]+Math.sin(intent.frame.yaw)*p[1],y,intent.frame.origin[1]-Math.sin(intent.frame.yaw)*p[0]+Math.cos(intent.frame.yaw)*p[1]);
 const check=(id:string,points:{p:Point;y:number}[],radius=.3)=>{
  const failures:string[]=[];
  for(const {p,y} of points)for(let j=0;j<9;j++){
   const angle=j*Math.PI/4,q:Point=j===8?p:[p[0]+Math.cos(angle)*radius,p[1]+Math.sin(angle)*radius],v=world(q,y+.005);
   ray.set(v,new Vector3(0,-1,0));ray.far=.015;
   if(!ray.intersectObjects(meshes).length){
    // Triangle edges can lose an exact seam hit after rotated transforms.
    const seamHit=[[1e-6,0],[-1e-6,0],[0,1e-6],[0,-1e-6]].some(([dx,dz])=>{ray.set(world([q[0]+dx,q[1]+dz],y+.005),new Vector3(0,-1,0));return ray.intersectObjects(meshes).length>0;});
    if(!seamHit)failures.push(`unsupported ${p} @ ${y}`);
   }
   ray.set(world(q,y+.01),new Vector3(0,1,0));ray.far=100;
   const tested=new Set<string>();
   for(const hit of ray.intersectObjects(meshes)){
    if(tested.has(hit.object.uuid))continue;tested.add(hit.object.uuid);
    // An upward-facing exit also detects a probe starting inside a tall solid.
    if(hit.distance<1.99||(hit.face?.normal.y??0)>.5)failures.push(`head/body obstruction ${hit.object.name} at ${p}`);
   }
  }
  checks.push({id,samples:points.length*9,failures:[...new Set(failures)]});
 };
 for(const p of result.portalEvidence as {id:string;from:string;local:Point;passable?:boolean}[]){
  if(p.passable===false)continue;
  const b=result.boundaries.find(b=>b.id===(p as typeof p & {host:string}).host)!;
  const dx=b.b[0]-b.a[0],dz=b.b[1]-b.a[1],len=Math.hypot(dx,dz),s=intent.spaces.find(s=>s.id===p.from)!,top=intent.levels.find(l=>l.id===s.level)!.top;
  check(p.id,Array.from({length:21},(_,i)=>({p:[p.local[0]-dz/len*(i/20-.5),p.local[1]+dx/len*(i/20-.5)] as Point,y:top})));
  for(const id of b.spaces){
   const cell=intent.spaces.find(s=>s.id===id)!;
   if(intent.stairs.some(st=>st.lower===id||st.upper===id))continue;
   const centre=cell.polygon.reduce((a,v)=>[a[0]+v[0]/cell.polygon.length,a[1]+v[1]/cell.polygon.length] as Point,[0,0] as Point);
   const sign=b.spaces.indexOf(id)===0?1:-1;
   const end:Point=[p.local[0]-dz/len*.5*sign,p.local[1]+dx/len*.5*sign];
   const count=Math.ceil(Math.hypot(centre[0]-end[0],centre[1]-end[1])/.05);
   check(`${p.id}-route-${id}`,Array.from({length:count+1},(_,i)=>({p:[centre[0]+(end[0]-centre[0])*i/count,centre[1]+(end[1]-centre[1])*i/count] as Point,y:top})));
  }
 }
 for(const st of intent.stairs){
  const lower=intent.spaces.find(s=>s.id===st.lower)!,upper=intent.spaces.find(s=>s.id===st.upper)!,base=intent.levels.find(l=>l.id===lower.level)!.top,top=intent.levels.find(l=>l.id===upper.level)!.top;
  // Each whole tread is discrete; use transverse body clearance and centre support.
  for(let i=0;i<st.risers;i++)check(`${st.id}-tread-${i+1}`,[{p:[st.start[0],st.start[1]+(i+.5)*st.run/st.risers],y:base+(i+1)*(top-base)/st.risers}],0);
  const lane=st.start[0]+st.width/2+.1+.32;
  check(`${st.id}-upper-side-route`,Array.from({length:121},(_,i)=>({p:[lane,st.start[1]-st.landing/2+i/120*(st.run+st.landing)] as Point,y:top})));
  const lowerApproach:Point=[st.start[0],st.start[1]-st.landing/2],upperApproach:Point=[st.start[0],st.start[1]+st.run+st.landing/2];
  for(const [id,y,landing] of [[st.lower,base,lowerApproach],[st.upper,top,upperApproach]] as [string,number,Point][]){
   const endpoints=(result.portalEvidence as {local:Point;from:string;to:string;passable?:boolean}[]).filter(p=>p.passable!==false&&(p.from===id||p.to===id));
   for(const [index,p] of endpoints.entries()){
    const points=[landing,[lane,landing[1]] as Point,[lane,p.local[1]] as Point,p.local];
    // The front threshold is directly aligned with the lower landing.
    if(p.local[1]<st.start[1]&&Math.abs(p.local[0]-landing[0])<1e-6)points.splice(1,2);
    for(let k=0;k<points.length-1;k++){const a=points[k],b=points[k+1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.05));check(`${st.id}-${id}-portal-${index}-segment-${k}`,Array.from({length:n+1},(_,i)=>({p:[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n] as Point,y})));}
   }
  }
  check(`${st.id}-landings`,[{p:[st.start[0],st.start[1]-st.landing/2],y:base},{p:[st.start[0],st.start[1]+st.run+st.landing/2],y:top}]);
 }
 dispose();return {checks,failures:checks.flatMap(c=>c.failures.map(message=>({id:c.id,message}))),scope:'Sampled actual profile/box surfaces, 0.6m diameter threshold/landing/side-lane probe and 2m vertical clearance; tread centres tested separately. Open door assumption. Not continuous swept-body stair or whole-house navigation proof.'};
}
