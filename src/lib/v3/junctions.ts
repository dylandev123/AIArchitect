import { FLAT_ROOF_GAP } from './construction';
import type { V3Scene, V3SceneObject, Vec3 } from './scene';
import { materializeV3ArchitecturalScene } from './architecture';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { roofHostId } from './compositionPolicies';
import { gableRoofGeometry, hipRoofGeometry } from '@/lib/architecture/geometry/pitchedRoof';
import type { JunctionPlane } from './junctionGeometry';
import { dot3 } from './junctionGeometry';

export type JunctionFacade = 'north'|'south'|'east'|'west';
export interface V3SharedWallRegion {
  massId:string; facade:JunctionFacade; at:number; span:[number,number]; elevation:[number,number];
  kind:'internal'|'coincident'|'intentional-partition';
}
export interface V3MassJunction {
  id:string; massA:string; massB:string; relationship:'touching'|'overlapping'|'connected-separated';
  supported:boolean; sharedWalls:V3SharedWallRegion[]; relativeElevation:{baseDelta:number;topDelta:number;shared:[number,number]};
  roof:{a:string;b:string;relationship:'same-datum'|'stepped'|'near-datum'|'unsupported'};
  materialTransition:'continuous'|'expressed-edge'; priorityMassId:string;
}
export interface V3JunctionDiagnostic {code:string;junctionId:string;message:string;}
const EPS=1e-5;
export const junctionId=(a:string,b:string)=>`junction:${[a,b].sort().join('|')}:envelope`;
export const massPriority=(o:V3SceneObject)=>({primary:2,secondary:1,connector:0}[o.composition?.massHierarchy??'secondary']);
export const preferredMass=(a:V3SceneObject,b:V3SceneObject)=>massPriority(a)!==massPriority(b)?(massPriority(a)>massPriority(b)?a:b):(a.id<b.id?a:b);
export function worldPoint(o:V3SceneObject,x:number,y:number,z:number):Vec3 {
  const t=o.transform.position,r=o.transform.rotation[1];return [t[0]+x*Math.cos(r)+z*Math.sin(r),y,t[2]-x*Math.sin(r)+z*Math.cos(r)];
}
function localPoint(o:V3SceneObject,x:number,z:number):[number,number] {
  const dx=x-o.transform.position[0],dz=z-o.transform.position[2],r=o.transform.rotation[1];return [dx*Math.cos(r)-dz*Math.sin(r),dx*Math.sin(r)+dz*Math.cos(r)];
}
export function localPlane(o:V3SceneObject,normal:Vec3,constant:number):JunctionPlane {
  const r=o.transform.rotation[1],n:Vec3=[normal[0]*Math.cos(r)+normal[2]*Math.sin(r),normal[1],-normal[0]*Math.sin(r)+normal[2]*Math.cos(r)];
  return {normal:n,constant:constant+n[0]*o.transform.position[0]+n[2]*o.transform.position[2]};
}
export function massVolume(o:V3SceneObject,expand=0):JunctionPlane[] {
  const [w,,d]=scaledDimensionsOf(o);
  return [localPlane(o,[1,0,0],w/2+expand),localPlane(o,[-1,0,0],w/2+expand),localPlane(o,[0,0,1],d/2+expand),localPlane(o,[0,0,-1],d/2+expand),{normal:[0,1,0],constant:getObjectTopY(o)},{normal:[0,-1,0],constant:-getObjectBaseY(o)}];
}
function relativeRect(a:V3SceneObject,b:V3SceneObject) {
  const [w,,d]=scaledDimensionsOf(b),points=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z])=>{const p=worldPoint(b,x,0,z);return localPoint(a,p[0],p[2]);});
  return {x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),z0:Math.min(...points.map(p=>p[1])),z1:Math.max(...points.map(p=>p[1]))};
}
export function roofForMass(s:V3Scene,m:V3SceneObject):V3SceneObject {
  const roof=s.objects.find(o=>o.type==='roof-form'&&roofHostId(o)===m.id);
  if(roof)return roof;
  const [w,,d]=scaledDimensionsOf(m);
  return {...m,architecture:undefined,type:'roof-form',dimensions:[w,.25,d],transform:{...m.transform,position:[m.transform.position[0],getObjectTopY(m)+.125,m.transform.position[2]],scale:[1,1,1]},roofForm:m.roofForm??'flat'};
}
export function deriveV3MassJunctions(input:V3Scene):{junctions:V3MassJunction[];diagnostics:V3JunctionDiagnostic[]} {
  const s=materializeV3ArchitecturalScene(input),masses=s.objects.filter(o=>o.type==='building-mass').sort((a,b)=>a.id.localeCompare(b.id));
  const junctions:V3MassJunction[]=[],diagnostics:V3JunctionDiagnostic[]=[];
  for(let i=0;i<masses.length;i++)for(let j=i+1;j<masses.length;j++) {
    const a=masses[i],b=masses[j],[w,,d]=scaledDimensionsOf(a),r=relativeRect(a,b);
    const ox=Math.min(w/2,r.x1)-Math.max(-w/2,r.x0),oz=Math.min(d/2,r.z1)-Math.max(-d/2,r.z0);
    const lo=Math.max(getObjectBaseY(a),getObjectBaseY(b)),hi=Math.min(getObjectTopY(a),getObjectTopY(b));
    const explicit=(s.relationships??[]).some(r=>r.kind==='connects'&&((r.from===a.id&&r.to===b.id)||(r.from===b.id&&r.to===a.id)));
    const contact=ox>=-EPS&&oz>=-EPS&&Math.max(ox,oz)>EPS&&hi-lo>EPS;
    if(!contact&&!explicit)continue;
    const id=junctionId(a.id,b.id),orthogonal=Math.abs(Math.sin(2*(a.transform.rotation[1]-b.transform.rotation[1])))<EPS;
    const upright=[a,b].every(o=>Math.abs(o.transform.rotation[0])+Math.abs(o.transform.rotation[2])<EPS);
    const supported=contact&&orthogonal&&upright,priority=preferredMass(a,b);
    const sharedWalls:V3SharedWallRegion[]=[];
    if(supported)for(const [host,other] of [[a,b],[b,a]]) {
      const [hw,,hd]=scaledDimensionsOf(host),v=relativeRect(host,other);
      for(const [facade,at,nx,nz] of [['north',-hd/2,0,-1],['south',hd/2,0,1],['west',-hw/2,-1,0],['east',hw/2,1,0]] as const) {
        const alongX=nz!==0,span:[number,number]=alongX?[Math.max(-hw/2,v.x0),Math.min(hw/2,v.x1)]:[Math.max(-hd/2,v.z0),Math.min(hd/2,v.z1)];
        const nlo=alongX?v.z0:v.x0,nhi=alongX?v.z1:v.x1;
        if(span[1]-span[0]<=EPS||at<nlo-EPS||at>nhi+EPS)continue;
        const normal=nx||nz,probe=at+normal*.001;
        const internal=probe>nlo&&probe<nhi;
        if(!internal&&priority.id===host.id)continue;
        const explicitDoor=host.composition?.openings?.some(op=>op.facade===facade&&op.type==='door'&&op.end*(alongX?hw:hd)-(alongX?hw:hd)/2>span[0]&&op.start*(alongX?hw:hd)-(alongX?hw:hd)/2<span[1]);
        // An authored connecting door is a deliberate partition, not an accidental exterior wall.
        const nworld=worldPoint(host,nx,0,nz),direction=localPoint(other,other.transform.position[0]+(nworld[0]-host.transform.position[0]),other.transform.position[2]+(nworld[2]-host.transform.position[2]));
        const otherFacade:JunctionFacade=Math.abs(direction[0])>Math.abs(direction[1])?(direction[0]>0?'west':'east'):(direction[1]>0?'north':'south');
        const competingDoor=other.composition?.openings?.some(op=>op.facade===otherFacade&&op.type==='door');
        const keepDoor=explicitDoor&&(!competingDoor||priority.id===host.id);
        sharedWalls.push({massId:host.id,facade,at,span,elevation:[lo,hi],kind:keepDoor?'intentional-partition':internal?'internal':'coincident'});
        if(keepDoor)diagnostics.push({code:'JUNCTION_AUTHORED_PARTITION',junctionId:id,message:`${host.id} has an authored door on the shared face; its aperture/partition is retained and the opposite exterior facade is removed.`});
        if(explicitDoor&&competingDoor)diagnostics.push({code:'JUNCTION_OPENING_CONFLICT',junctionId:id,message:'Both meeting facades author doors. Semantic hierarchy selects one partition; review the conflicting opening intent.'});
      }
    }
    const ra=roofForMass(s,a),rb=roofForMass(s,b),delta=getObjectBaseY(rb)-getObjectBaseY(ra);
    const roofSupported=[ra,rb].every(r=>['flat','floating-flat','gable','hip','mono-pitch'].includes(r.roofForm??'flat')&&Math.abs(r.transform.rotation[0])+Math.abs(r.transform.rotation[2])<EPS&&Math.abs(Math.sin(2*(r.transform.rotation[1]-a.transform.rotation[1])))<EPS);
    const roofRelationship=!supported||!roofSupported?'unsupported':Math.abs(delta)<EPS?'same-datum':Math.abs(delta)<.6-EPS?'near-datum':'stepped';
    junctions.push({id,massA:a.id,massB:b.id,relationship:!contact?'connected-separated':ox>EPS&&oz>EPS?'overlapping':'touching',supported,sharedWalls,
      relativeElevation:{baseDelta:getObjectBaseY(b)-getObjectBaseY(a),topDelta:getObjectTopY(b)-getObjectTopY(a),shared:[lo,hi]},roof:{a:ra.id,b:rb.id,relationship:roofRelationship},
      materialTransition:a.material.color===b.material.color&&a.material.surface===b.material.surface?'continuous':'expressed-edge',priorityMassId:priority.id});
    const note=(code:string,message:string)=>diagnostics.push({code,junctionId:id,message});
    if(!contact)note('JUNCTION_SEPARATED','Connected masses do not share an envelope; no bridge or wall opening is invented.');
    else if(!supported)note('JUNCTION_SKEW_UNSUPPORTED','Skew or tilted mass junction retained; rectangular orthogonal junctions only.');
    else if(!roofSupported)note('JUNCTION_ROOF_UNSUPPORTED','Terrace/parapet, skew or tilted roof meeting retained for authored resolution.');
    else if(roofRelationship==='near-datum')note('JUNCTION_AMBIGUOUS_DATUM','Nearby roof datums differ. Authored heights are preserved; author a common roof datum deliberately.');
  }
  // Three mutually intersecting roof participants need a multi-way topology solver, not pairwise flashing.
  for(let i=0;i<masses.length;i++)for(let j=i+1;j<masses.length;j++)for(let k=j+1;k<masses.length;k++) {
    const ids=[masses[i].id,masses[j].id,masses[k].id],edges=junctions.filter(q=>q.supported&&ids.includes(q.massA)&&ids.includes(q.massB));
    if(edges.length!==3)continue;
    for(const edge of edges) {
      edge.roof.relationship='unsupported';
      if(!diagnostics.some(d=>d.code==='JUNCTION_MULTI_ROOF_UNSUPPORTED'&&d.junctionId===edge.id))diagnostics.push({code:'JUNCTION_MULTI_ROOF_UNSUPPORTED',junctionId:edge.id,message:'Three mutually meeting masses require a multi-way roof solution. Their authored roofs are retained; shared walls are still resolved.'});
    }
  }
  return {junctions,diagnostics};
}
export interface JunctionRoofEnvelope {roof:V3SceneObject; footprint:JunctionPlane[]; slopes:JunctionPlane[];slopeRoles:string[];volume:JunctionPlane[];}
/** Convex top-envelope for the five existing rectangular roof families, using the production plane rules. */
export function junctionRoofEnvelope(roof:V3SceneObject,overhang:number):JunctionRoofEnvelope {
  const [w,h,d]=scaledDimensionsOf(roof),base=getObjectBaseY(roof),pitch=Math.max(1,Math.min(60,roof.pitch??12)),e=overhang;
  const footprint=[localPlane(roof,[1,0,0],w/2+e),localPlane(roof,[-1,0,0],w/2+e),localPlane(roof,[0,0,1],d/2+e),localPlane(roof,[0,0,-1],d/2+e)];
  let slopes:JunctionPlane[],slopeRoles:string[];
  if(roof.roofForm==='gable'||roof.roofForm==='hip') {
    const g=(roof.roofForm==='gable'?gableRoofGeometry:hipRoofGeometry)({rect:{x0:-w/2,x1:w/2,z0:-d/2,z1:d/2},wallPlateY:base,pitchDeg:pitch,overhang:e});
    slopeRoles=g.planes.map(p=>p.id);
    slopes=g.planes.map(p=>localPlane(roof,[...p.normal] as Vec3,dot3([...p.origin] as Vec3,[...p.normal] as Vec3)));
  } else if(roof.roofForm==='mono-pitch') {
    const rise=Math.max(.45,Math.tan(pitch*Math.PI/180)*(d+2*e)),slope=rise/(d+2*e);
    slopeRoles=['shed'];
    slopes=[localPlane(roof,[0,1,slope],base+Math.min(.24,h)+slope*(d/2+e))];
  } else { slopeRoles=['flat']; slopes=[{normal:[0,1,0],constant:base+(roof.roofForm==='floating-flat'?FLAT_ROOF_GAP:0)+Math.max(.18,Math.min(h,.35))}]; }
  return {roof,footprint,slopes,slopeRoles,volume:[...footprint,...slopes,{normal:[0,-1,0],constant:-(base-.5)}]};
}
export function sharedWallVolume(host:V3SceneObject,r:V3SharedWallRegion):JunctionPlane[] {
  const alongX=r.facade==='north'||r.facade==='south', [a,b]=r.span;
  return [localPlane(host,alongX?[1,0,0]:[0,0,1],b),localPlane(host,alongX?[-1,0,0]:[0,0,-1],-a),
    localPlane(host,alongX?[0,0,1]:[1,0,0],r.at+.5),localPlane(host,alongX?[0,0,-1]:[-1,0,0],-r.at+.5),
    {normal:[0,1,0],constant:r.elevation[1]},{normal:[0,-1,0],constant:-r.elevation[0]}];
}

/** Roof-family authority is component-local; a detached wing cannot recolour another building. */
export function junctionRoofScopes(scene:V3Scene,junctions:V3MassJunction[]):Map<string,V3Scene> {
  const scopes=new Map<string,V3Scene>();
  for(const mass of scene.objects.filter(o=>o.type==='building-mass')) {
    if(scopes.has(mass.id))continue;
    const ids=new Set([mass.id]);let changed=true;
    while(changed){changed=false;for(const j of junctions.filter(j=>j.supported))if(ids.has(j.massA)||ids.has(j.massB))for(const id of [j.massA,j.massB])if(!ids.has(id)){ids.add(id);changed=true;}}
    const objects=scene.objects.filter(o=>ids.has(o.id)||o.type==='roof-form'&&ids.has(roofHostId(o)??'')),scope={...scene,objects};
    for(const o of objects)scopes.set(o.id,scope);
  }
  return scopes;
}
