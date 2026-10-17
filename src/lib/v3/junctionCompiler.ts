import { shade } from '@/lib/house/architecture/parts';
import { compileDetailedRoof } from './construction';
import { worldPoint, localPlane, junctionRoofScopes } from './junctions';
import { roofFinish, compositionRoofMaterial } from './compositionPolicies';
import type { HousePrimitive } from '@/lib/house/types';
import type { V3Scene, V3SceneObject, Vec3 } from './scene';
import { resolvedFacadeComposition } from './composition';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { clipJunctionSegment, subtractJunctionVolume, primitiveTriangles, type JunctionPlane } from './junctionGeometry';
import { deriveV3MassJunctions, junctionRoofEnvelope, roofForMass, massVolume, sharedWallVolume, type V3MassJunction, type JunctionRoofEnvelope, type JunctionFacade } from './junctions';

function facadeMap(o:V3SceneObject) {
  const [w,h,d]=scaledDimensionsOf(o),levels=o.levels??Math.max(1,Math.round(h/3.4));
  const c=resolvedFacadeComposition(o,w,d,h/levels), map=new Map<string,JunctionFacade>();
  for(const op of c.openings??[]) {
    map.set(op.id,op.facade);
    if(op.type==='opening-rhythm')for(let i=0;i<op.count;i++)map.set(`${op.id}-${i}`,op.facade);
  }
  return map;
}
function facadeOf(p:HousePrimitive,o:V3SceneObject,map:Map<string,JunctionFacade>):JunctionFacade|undefined {
  const key=p.id.slice(o.id.length+1).split(':')[0];
  if(map.has(key))return map.get(key);
  if(['north','south','east','west'].includes(key))return key as JunctionFacade;
  if(p.componentRole==='floor slab edge')return p.id.split('-').at(-1) as JunctionFacade;
}
/** Coplanar flat meeting: own the upper AND underside surface once, and suppress buried vertical edges.
 * This avoids shaving a slab to a zero-thickness skin in the common footprint.
 */
function flatMeeting(part:HousePrimitive,other:JunctionRoofEnvelope,owner:boolean):HousePrimitive|undefined {
  if(!owner||['roof fascia','roof flashing'].includes(part.componentRole??''))return subtractJunctionVolume(part,other.footprint);
  const mesh=primitiveTriangles(part),horizontal:number[]=[],vertical:number[]=[];
  for(let i=0;i<mesh.vertices.length;i+=9) {
    const t=mesh.vertices.slice(i,i+9);
    (Math.abs(t[1]-t[4])+Math.abs(t[1]-t[7])<1e-6?horizontal:vertical).push(...t);
  }
  if(!vertical.length)return part;
  const side:HousePrimitive={...part,kind:'triMesh',vertices:vertical};
  const clipped=subtractJunctionVolume(side,other.footprint);
  if(clipped===side)return part;
  const vertices=[...horizontal,...(clipped?.kind==='triMesh'?clipped.vertices:[])];
  if(!vertices.length)return;
  return {...side,vertices};
}

const surfacePlane=(p:JunctionPlane)=>({x:-p.normal[0]/p.normal[1],z:-p.normal[2]/p.normal[1],c:p.constant/p.normal[1]});
/** Visible roof-plane intersections only; endpoints clipped to both convex top envelopes.
 * Two inclined faces make a simple valley; flat/inclined meetings receive transition flashing.
 */
function meetingFlashing(j:V3MassJunction,a:JunctionRoofEnvelope,b:JunctionRoofEnvelope):HousePrimitive[] {
  const out:HousePrimitive[]=[];
  for(let ai=0;ai<a.slopes.length;ai++)for(let bi=0;bi<b.slopes.length;bi++) {
    const ap=surfacePlane(a.slopes[ai]),bp=surfacePlane(b.slopes[bi]),nx=ap.x-bp.x,nz=ap.z-bp.z,len=Math.hypot(nx,nz);
    if(len<1e-6)continue;
    const constant=bp.c-ap.c, x=nx*constant/(len*len),z=nz*constant/(len*len),dx=-nz/len,dz=nx/len;
    const point=(t:number):Vec3=>[x+dx*t,ap.x*(x+dx*t)+ap.z*(z+dz*t)+ap.c,z+dz*t];
    const segment=clipJunctionSegment(point(-10000),point(10000),[...a.footprint,...b.footprint,...a.slopes,...b.slopes]);
    if(!segment||Math.hypot(segment[1][0]-segment[0][0],segment[1][2]-segment[0][2])<.12)continue;
    const [start,end]=segment,vertices:number[]=[];
    // On each side follow the surviving upper plane, making a folded flashing (not a floating flat ribbon).
    for(const sign of [-1,1]) {
      const edge=(p:Vec3):Vec3=>{const x=p[0]+sign*nx/len*.1,z=p[2]+sign*nz/len*.1;return [x,Math.max(ap.x*x+ap.z*z+ap.c,bp.x*x+bp.z*z+bp.c)+.012,z];};
      const s:Vec3=[start[0],start[1]+.012,start[2]],e:Vec3=[end[0],end[1]+.012,end[2]],se=edge(start),ee=edge(end);
      vertices.push(...s,...e,...ee,...s,...ee,...se);
    }
    const valley=Math.hypot(ap.x,ap.z)>1e-6&&Math.hypot(bp.x,bp.z)>1e-6;
    out.push({kind:'triMesh',id:`${j.id}:roof-meeting:${a.slopeRoles[ai]}|${b.slopeRoles[bi]}`,label:valley?'Junction Valley Flashing':'Junction Transition Flashing',category:'roof',vertices,color:'#303638',surface:'metal',roughness:.45,metalness:.7,sourceObjectId:j.priorityMassId,sourceObjectIds:[j.massA,j.massB],semanticRole:'connected mass junction',componentRole:valley?'junction valley flashing':'junction roof flashing'});
  }
  return out;
}
/** Two collinear rectangular roofs of the same family/finish become one finished assembly.
 * Only an exact rectangular union is accepted; complex chains retain the bounded clipping path.
 */
function mergedRoof(scene:V3Scene,j:V3MassJunction,a:JunctionRoofEnvelope,b:JunctionRoofEnvelope):HousePrimitive[]|undefined {
  const ar=a.roof,br=b.roof,form=ar.roofForm??'flat';
  if(!['flat','floating-flat','gable'].includes(form)||form!==(br.roofForm??'flat')||Math.abs(getObjectBaseY(ar)-getObjectBaseY(br))>1e-5||Math.abs((ar.pitch??12)-(br.pitch??12))>1e-5||Math.abs(ar.transform.rotation[1]-br.transform.rotation[1])>1e-5)return;
  const [aw,ah,ad]=scaledDimensionsOf(ar),[bw,bh,bd]=scaledDimensionsOf(br),yaw=ar.transform.rotation[1];
  const dx=br.transform.position[0]-ar.transform.position[0],dz=br.transform.position[2]-ar.transform.position[2],x=dx*Math.cos(yaw)-dz*Math.sin(yaw),z=dx*Math.sin(yaw)+dz*Math.cos(yaw);
  const alongX=Math.abs(z)<1e-5&&Math.abs(ad-bd)<1e-5&&Math.abs(Math.abs(x)-(aw+bw)/2)<1e-5;
  const alongZ=Math.abs(x)<1e-5&&Math.abs(aw-bw)<1e-5&&Math.abs(Math.abs(z)-(ad+bd)/2)<1e-5;
  if(!alongX&&!alongZ)return;
  if(form==='gable'&&!(alongX&&aw>=ad&&bw>=bd||alongZ&&ad>aw&&bd>bw))return;
  const material=(r:V3SceneObject)=>r.id===j.massA||r.id===j.massB?compositionRoofMaterial(scene):roofFinish(scene,r);
  const ma=material(ar),mb=material(br);
  // Finish boundaries never decide topology or child identity.
  const e=Math.max(ar.overhang??.75,br.overhang??.75);
  // Preserve authored thickness and unequal eaves; these use the clipping path instead of a merged recipe.
  if(Math.abs(ah-bh)>1e-5||Math.abs((ar.overhang??.75)-(br.overhang??.75))>1e-5)return;
  const cx=alongX?(Math.min(-aw/2,x-bw/2)+Math.max(aw/2,x+bw/2))/2:0,cz=alongZ?(Math.min(-ad/2,z-bd/2)+Math.max(ad/2,z+bd/2))/2:0;
  const centre=worldPoint(ar,cx,getObjectBaseY(ar)+ah/2,cz),host=scene.objects.find(o=>o.id===j.priorityMassId)!;
  const joined:V3SceneObject={...ar,id:j.id+':joined-roof',architecture:undefined,dimensions:[alongX?aw+bw:aw,ah,alongZ?ad+bd:ad],transform:{...ar.transform,position:centre,scale:[1,1,1]},overhang:e,material:j.priorityMassId===j.massA?ma:mb};
  const seam=alongX?(x>0?aw/2:-aw/2):(z>0?ad/2:-ad/2),sign=(alongX?x:z)>0?1:-1;
  const pieces:HousePrimitive[]=[];
  for(const [massId,r,finish,side] of [[j.massA,ar,ma,1],[j.massB,br,mb,-1]] as const) {
    const normal:Vec3=alongX?[-sign*side,0,0]:[0,0,-sign*side],cut=localPlane(ar,normal,-sign*side*seam);
    const mass=scene.objects.find(o=>o.id===massId)!;
    for(const p of compileDetailedRoof(joined,host.material)??[]) {
      const clipped=subtractJunctionVolume(p,[cut]);if(!clipped)continue;
      const wall=p.componentRole==='roof wall infill'||p.componentRole==='roof soffit',dark=['roof flashing','roof fascia'].includes(p.componentRole??'');
      pieces.push({...clipped,id:`${p.id}:zone:${massId}`,sourceObjectId:r.id,sourceObjectIds:[...new Set([j.massA,j.massB,j.roof.a,j.roof.b])],semanticRole:'connected roof',componentRole:`junction ${p.componentRole}`,
        color:wall?mass.material.color:dark?shade(finish.color,.6):p.componentRole==='shadow reveal'?p.color:finish.color,
        roughness:wall?mass.material.roughness:finish.roughness??p.roughness,
        metalness:wall?mass.material.metalness??0:finish.metalness??p.metalness,
        surface:wall?(mass.material.surface==='stone'?'stone':mass.material.surface==='wood'?'wood':'stucco'):p.surface});
    }
  }
  return pieces;
}
function abutmentFlashing(j:V3MassJunction,host:V3SceneObject,other:V3SceneObject,roof:JunctionRoofEnvelope):HousePrimitive[] {
  if(getObjectTopY(other)<=getObjectBaseY(roof.roof)+.05)return [];
  const out:HousePrimitive[]=[];
  for(const region of j.sharedWalls.filter(r=>r.massId===host.id&&r.kind!=='coincident')) {
    const alongX=region.facade==='north'||region.facade==='south';
    for(let i=0;i<roof.slopes.length;i++) {
      const slope=surfacePlane(roof.slopes[i]);
      const point=(t:number):Vec3=>{const p=worldPoint(host,alongX?t:region.at,0,alongX?region.at:t);p[1]=slope.x*p[0]+slope.z*p[2]+slope.c;return p;};
      const segment=clipJunctionSegment(point(region.span[0]),point(region.span[1]),[...roof.footprint,...roof.slopes,{normal:[0,1,0],constant:getObjectTopY(other)-.02}]);
      if(!segment)continue;
      const [a,b]=segment,up=(p:Vec3):Vec3=>[p[0],Math.min(getObjectTopY(other),p[1]+.18),p[2]];
      const outward=worldPoint(host,alongX?0:(region.facade==='east'?-1:1),0,alongX?(region.facade==='south'?-1:1):0);
      const nx=outward[0]-host.transform.position[0],nz=outward[2]-host.transform.position[2];
      const toe=(p:Vec3):Vec3=>{const x=p[0]+nx*.12,z=p[2]+nz*.12;return [x,slope.x*x+slope.z*z+slope.c+.012,z];};
      const aa:Vec3=[a[0]+nx*.006,a[1]+.012,a[2]+nz*.006],bb:Vec3=[b[0]+nx*.006,b[1]+.012,b[2]+nz*.006];
      out.push({kind:'triMesh',id:`${j.id}:abutment:${host.id}:${region.facade}:${roof.slopeRoles[i]}`,label:'Junction Abutment Flashing',category:'roof',vertices:[...aa,...bb,...up(bb),...aa,...up(bb),...up(aa),...aa,...toe(a),...toe(b),...aa,...toe(b),...bb],color:'#303638',surface:'metal',roughness:.45,metalness:.7,sourceObjectId:j.priorityMassId,sourceObjectIds:[j.massA,j.massB],semanticRole:'connected mass junction',componentRole:'junction abutment flashing'});
    }
  }
  return out;
}

/** Read-only construction pass. Does not persist clipped meshes, mutate intent, or touch site/interior objects. */
export function compileV3MassJunctions(scene:V3Scene,primitives:HousePrimitive[],overhangs:Map<string,number>,junctions=deriveV3MassJunctions(scene).junctions):HousePrimitive[] {
  const active=junctions.filter(j=>j.supported);
  if(!active.length)return primitives;
  const masses=new Map(scene.objects.filter(o=>o.type==='building-mass').map(o=>[o.id,o]));
  const roofs=new Map([...masses].map(([id,m])=>{const r=roofForMass(scene,m);return [id,junctionRoofEnvelope(r,overhangs.get(r.id)??r.overhang??.75)];}));
  const facadeMaps=new Map([...masses].map(([id,m])=>[id,facadeMap(m)]));
  const byOwner=new Map<string,V3MassJunction[]>();
  for(const j of active)for(const id of new Set([j.massA,j.massB,j.roof.a,j.roof.b]))byOwner.set(id,[...(byOwner.get(id)??[]),j]);
  const scopes=junctionRoofScopes(scene,junctions);
  const merged=new Map<string,HousePrimitive[]>(),mergedOwners=new Set<string>();
  for(const j of active.filter(j=>j.roof.relationship==='same-datum')) {
    // Do not merge a roof that also needs another roof meeting in this pass.
    if(active.some(k=>k.id!==j.id&&[k.massA,k.massB].some(id=>id===j.massA||id===j.massB)))continue;
    const result=mergedRoof(scopes.get(j.massA)??scene,j,roofs.get(j.massA)!,roofs.get(j.massB)!);
    if(result){merged.set(j.id,result);mergedOwners.add(j.roof.a);mergedOwners.add(j.roof.b);}
  }
  const output=primitives.flatMap(original=>{
    if(original.category==='roof'&&mergedOwners.has(original.sourceObjectId??''))return [];
    const related=byOwner.get(original.sourceObjectId??'');if(!related)return [original];
    let part:HousePrimitive|undefined=original;
    for(const j of related) {
      if(!part)break;
      const massId=original.sourceObjectId===j.massA||original.sourceObjectId===j.roof.a?j.massA:j.massB;
      const otherId=massId===j.massA?j.massB:j.massA,host=masses.get(massId)!,other=masses.get(otherId)!;
      const isRoof=original.category==='roof',isInfill=original.componentRole==='roof wall infill';
      if(isRoof) {
        if(j.roof.relationship==='unsupported')continue;
        const my=roofs.get(massId)!,their=roofs.get(otherId)!;
        // No roof plate, soffit, ridge or infill may penetrate the neighbouring occupied mass.
        part=subtractJunctionVolume(part,massVolume(other).map(p=>p.normal[1]===1?{...p,constant:p.constant-1e-5}:p));if(!part)break;
        // The upper roof envelope owns the visible meeting. Coplanar ties use semantic hierarchy + id.
        const owner=j.priorityMassId===massId,epsilon=owner?-1e-5:1e-5;
        const volume=their.volume.map(p=>their.slopes.includes(p)?{...p,constant:p.constant+epsilon}:p);
        const sameFlat=my.slopes.length===1&&their.slopes.length===1&&['flat','floating-flat'].includes(my.roof.roofForm??'flat')&&my.roof.roofForm===their.roof.roofForm&&Math.abs(my.slopes[0].constant-their.slopes[0].constant)<1e-6&&Math.abs(getObjectBaseY(my.roof)-getObjectBaseY(their.roof))<1e-6;
        part=sameFlat?flatMeeting(part,their,owner):subtractJunctionVolume(part,volume);
        // Roof infill is a facade; internal gable-end faces at the common wall must also disappear.
        if(part&&isInfill&&getObjectBaseY(my.roof)<=getObjectTopY(other)+1e-5)part=subtractJunctionVolume(part,massVolume(other,.00001));
      } else if(original.sourceObjectId===host.id) {
        const side=facadeOf(original,host,facadeMaps.get(host.id)!);
        if(side)for(const region of j.sharedWalls.filter(r=>r.massId===host.id&&r.facade===side&&r.kind!=='intentional-partition')) {
          if(part)part=subtractJunctionVolume(part,sharedWallVolume(host,region));
        }
        // Overlapping horizontal slabs use one deterministic owner; touching floors remain intact.
        if(part&&j.relationship==='overlapping'&&original.componentRole==='floor slab'&&j.priorityMassId!==host.id)part=subtractJunctionVolume(part,massVolume(other));
      }
    }
    return part?[part]:[];
  });
  for(const j of active.filter(j=>j.roof.relationship!=='unsupported')) {
    if(merged.has(j.id)){output.push(...merged.get(j.id)!);continue;}
    const flashing=[...meetingFlashing(j,roofs.get(j.massA)!,roofs.get(j.massB)!),
      ...abutmentFlashing(j,masses.get(j.massA)!,masses.get(j.massB)!,roofs.get(j.massA)!),
      ...abutmentFlashing(j,masses.get(j.massB)!,masses.get(j.massA)!,roofs.get(j.massB)!)];
    // Do not leave valley trim through a third occupied wing.
    for(const p of flashing) {
      let part:HousePrimitive|undefined=p;
      for(const m of masses.values())if(m.id!==j.massA&&m.id!==j.massB&&part)part=subtractJunctionVolume(part,massVolume(m));
      if(part)output.push(part);
    }
  }
  return output;
}
