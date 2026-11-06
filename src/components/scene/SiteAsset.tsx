'use client';
import {useLayoutEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import type {SceneElement} from '@/lib/villa/scene/model';
import {buildVegetation} from '@/lib/landscaping/vegetationGeometry';
import {TropicalPalm} from './tropical-palm';
import {Box,FinishBox,Sofa} from './architecture';

const shrubCache=new Map<string,ReturnType<typeof buildVegetation>>();
let rosette:ReturnType<typeof buildVegetation>|undefined;
function tropicalRosette(){
  if(rosette)return rosette;
  const vertices:number[]=[],colors:number[]=[];
  const triangle=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,color:THREE.Color)=>{for(const p of [a,b,c]){vertices.push(p.x,p.y,p.z);colors.push(color.r,color.g,color.b);}};
  for(let leaf=0;leaf<9;leaf++){
    const angle=leaf*2.39996,forward=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),across=new THREE.Vector3(-forward.z,0,forward.x);
    const point=(t:number)=>forward.clone().multiplyScalar(.62*t).add(new THREE.Vector3(0,.12+.58*Math.sin(t*Math.PI*.8)+.12*t,0));
    for(let j=0;j<8;j++){
      const t=j/8,u=(j+1)/8,a=point(t),b=point(u),wa=.12*Math.sin(Math.PI*t),wb=.12*Math.sin(Math.PI*u),color=new THREE.Color(leaf%2?'#618D45':'#3E743D');
      const al=a.clone().addScaledVector(across,wa),ar=a.clone().addScaledVector(across,-wa),bl=b.clone().addScaledVector(across,wb),br=b.clone().addScaledVector(across,-wb);
      a.y+=.025;b.y+=.025;
      triangle(a,al,bl,color);triangle(a,bl,b,color);triangle(a,b,br,color);triangle(a,br,ar,color.clone().multiplyScalar(.88));
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  rosette={leaf:geometry,bark:null,height:.85,radius:.67};return rosette;
}
const treeCache=new Map<number,ReturnType<typeof buildVegetation>>();
/** Broad canopy tree from the existing stylised oak meshes, scaled to the element's measured crown envelope. */
function CanopyTree({e}:{e:SceneElement}){
  const [w,h]=e.size,variant=e.panels%2,parts=useMemo(()=>{let g=treeCache.get(variant);if(!g){g=buildVegetation(variant?'oak-tall':'oak',variant);treeCache.set(variant,g);}return g;},[variant]);
  const s=Math.min(h/parts.height,(w/2)/parts.radius);
  return <group position={[0,-h/2,0]} scale={[s,s,s]}>{parts.bark&&<mesh geometry={parts.bark} castShadow><meshStandardMaterial vertexColors roughness={.95}/></mesh>}<mesh geometry={parts.leaf} castShadow receiveShadow><meshStandardMaterial vertexColors color='#9DB07A' roughness={.9}/></mesh></group>;
}
function Lawn({e}:{e:SceneElement}){
  const ref=useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(()=>{const mesh=ref.current;if(!mesh)return;const matrix=new THREE.Matrix4();
    for(const [i,[x,z,w,d]]of e.sitePatches!.entries()){matrix.makeScale(w*e.size[0],e.size[1],d*e.size[2]);matrix.setPosition(x*e.size[0],0,z*e.size[2]);mesh.setMatrixAt(i,matrix);}
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  },[e]);
  return <instancedMesh ref={ref} args={[undefined,undefined,e.sitePatches!.length]} receiveShadow><boxGeometry args={[1,1,1]}/><meshStandardMaterial color={e.color??'#779659'} roughness={.98}/></instancedMesh>;
}
function shrub(kind:'shrub'|'shrub-flowering'){
  let g=shrubCache.get(kind);if(!g){g=buildVegetation(kind,0);shrubCache.set(kind,g);}return g;
}
/** Each bed is one editable horticultural grouping; leaf meshes are shared instances, never authored scene elements. */
function Planting({e}:{e:SceneElement}){
  const refs=useRef<(THREE.InstancedMesh|null)[]>([]),[w,h,d]=e.size;
  const mixed=e.siteAsset==='planting';
  const parts=useMemo(()=>mixed?[shrub('shrub-flowering'),tropicalRosette()]:[shrub('shrub')],[mixed]);
  const count=e.panels;
  useLayoutEffect(()=>{
    const cols=Math.max(1,Math.ceil(Math.sqrt(count*w/d))),rows=Math.ceil(count/cols);
    const cellW=w/cols,cellD=d/rows;
    const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3();
    for(let i=0;i<count;i++){
      const group=mixed?i%2:0,mesh=refs.current[group],p=parts[group];if(!mesh)continue;
      const scale=Math.min((h-.1)/p.height,.46*Math.min(cellW,cellD)/p.radius);
      const col=i%cols,row=Math.floor(i/cols);
      v.set(-w/2+(col+.5)*cellW,-h/2+.1,-d/2+(row+.5)*cellD);
      q.setFromAxisAngle(new THREE.Vector3(0,1,0),(i%3)*2.094);
      matrix.compose(v,q,new THREE.Vector3(scale,scale*(i%2?.92:1),scale));mesh.setMatrixAt(mixed?Math.floor(i/2):i,matrix);
    }
    for(const mesh of refs.current)if(mesh){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  },[w,h,d,count,parts,mixed]);
  return <><Box at={[0,-h/2+.05,0]} size={[w,.1,d]} color='#544B38'/>{parts.map((p,i)=><instancedMesh key={i} ref={mesh=>{refs.current[i]=mesh;}} args={[p.leaf,undefined,mixed?(i?Math.floor(count/2):Math.ceil(count/2)):count]} castShadow receiveShadow dispose={null}><meshStandardMaterial vertexColors color={e.color??'#ABC193'} roughness={.9} side={THREE.DoubleSide}/></instancedMesh>)}</>;
}

/** Existing scene primitives with opt-in botanical/furniture detail. Every root remains selectable and transformable. */
export function SiteAsset({element:e}:{element:SceneElement}){
  const [w,h,d]=e.size,base=-h/2;
  const wood={surface:'timber' as const,roughness:.72,metalness:0};
  const part=(id:string,at:[number,number,number],size:[number,number,number],color='#8C6A48')=><FinishBox key={id} name={`${e.id}-${id}`} at={at} size={size} color={color} physical={wood}/>;
  if(e.siteAsset==='canopy-tree')return <CanopyTree e={e}/>;
  if(e.siteAsset==='palm')return <group position={[0,base,0]}><TropicalPalm height={h/1.1} variant={e.panels-1}/></group>;
  if(e.siteAsset==='planting'||e.siteAsset==='hedge')return <Planting e={e}/>;
  if(e.siteAsset==='lawn'&&e.sitePatches)return <Lawn e={e}/>;
  if(e.siteAsset==='paving'||e.siteAsset==='lawn')return <FinishBox name={e.id} at={[0,0,0]} size={e.size} color={e.color} physical={{surface:e.siteAsset==='lawn'?'grass':'paving',roughness:.88,metalness:0,...(e.siteAsset==='paving'?{procedural:{tileMeters:3,bumpScale:.006,contrast:.18}}:{})}}/>;
  if(e.siteAsset==='sofa')return <><Sofa at={[0,base,0]} width={w}/>{[-1,1].flatMap(x=>[-1,1].map(z=>part(`foot-${x}-${z}`,[x*(w/2-.22),base+.05,z*.36],[.1,.1,.1])))}</>;
  if(e.siteAsset==='bollard')return <>{part('stem',[0,0,0],[w,h,d],'#3B4138')}<Box at={[0,h/2-.08,0]} size={[w+.04,.06,d+.04]} color='#E4C790' glow/><Box at={[0,h/2,0]} size={[w+.07,.05,d+.07]} color='#41493F'/></>;
  if(e.siteAsset==='table'||e.siteAsset==='coffee-table')return <>{part('top',[0,h/2-.035,0],[w,.07,d])}{[-1,1].flatMap(x=>[-1,1].map(z=>part(`leg-${x}-${z}`,[x*(w/2-.12),-.035,z*(d/2-.12)],[.07,h-.07,.07])))}</>;
  if(e.siteAsset==='chair')return <>{part('seat',[0,base+.43,0],[w,.08,d])}<Box at={[0,base+.5,0]} size={[w-.08,.09,d-.07]} color='#E7DDC9'/>{part('back',[0,base+.76,-d/2+.04],[w,.48,.07])}{[-1,1].flatMap(x=>[-1,1].map(z=>part(`leg-${x}-${z}`,[x*(w/2-.06),base+.23,z*(d/2-.06)],[.05,.46,.05])))}</>;
  if(e.siteAsset==='lounger')return <>{part('frame',[0,base+.24,0],[w,.12,d])}<Box at={[0,base+.34,-.3]} size={[w-.1,.12,d*.6]} color='#EAE1CF'/><group position={[0,base+.44,d*.29]} rotation={[-.32,0,0]}><Box at={[0,0,0]} size={[w-.1,.12,d*.35]} color='#EAE1CF'/></group>{[-1,1].map(x=>part(`runner-${x}`,[x*(w/2-.09),base+.12,0],[.07,.24,d-.3]))}</>;
  return null;
}
