import type {ArchitecturalScene} from './model';
import type {CompletionFinding} from './completion';
import {sceneSpatialGeometry} from './spatial';

/** Necessary visual/construction evidence, never a beauty score or safety waiver.
 * Inspect world transforms so root-level panels cannot evade host-wall review. */
export function generationQualityFindings(scene: ArchitecturalScene): CompletionFinding[] {
 const {world,separation}=sceneSpatialGeometry(scene);
 const findings:CompletionFinding[]=[];
 const seen=new Map<string,string>();
 const round=(n:number)=>Math.round(n*100000)/100000;
 // Independent primitive roofs do not pass through the assembly-junction audit.
 // Report exact primary-box penetration for rectangular flat roofs only. Touching
 // edges are allowed; profiles, slopes and decorative trim need other evidence.
 const roofs=scene.elements.filter(e=>e.kind==='roof'&&!e.geometry&&(!e.roofForm||e.roofForm==='flat'));
 for(let i=0;i<roofs.length;i++)for(const b of roofs.slice(i+1)) {
  const a=roofs[i],p=world(a),q=world(b);
  const penetration=Math.min(p[1]+a.size[1]/2,q[1]+b.size[1]/2)-Math.max(p[1]-a.size[1]/2,q[1]-b.size[1]/2);
  if(penetration>.001&&separation(a,b)<-.001)findings.push({code:'flat-roof-junction-review',category:'likely-architectural-incompleteness',elementIds:[a.id,b.id],message:`${a.id} and ${b.id}: flat roof primary solids overlap vertically by ${round(penetration)} m with intersecting plan footprints. Author a separated or explicitly detailed junction; trim, drainage and weatherproofing remain unverified. No automatic union or repair was applied.`});
 }
 for(const e of scene.elements) {
  // Compare only identical rendered rectangular parts; profiled/pinned composites
  // and openings have different shape/origin semantics and are not inferred here.
  if(e.geometry || e.opening || ['pavilion','sofa','screen','glazing','entrance','balcony'].includes(e.kind))continue;
  const p=world(e);
  const signature=JSON.stringify([e.kind,p.slice(0,3).map(round),round(Math.atan2(Math.sin(p[3]),Math.cos(p[3]))),e.size,e.material,e.color,e.roofForm,e.overhang]);
  const previous=seen.get(signature);
  if(previous)findings.push({code:'duplicate-rendered-part',category:'confirmed-technical-defect',elementIds:[previous,e.id],message:`${previous} and ${e.id}: coincident identical parts duplicate rendered geometry; review before claiming a finished exterior.`});
  else seen.set(signature,e.id);
 }
 for(const door of scene.elements.filter(e=>e.kind==='entrance'&&!e.geometry)) {
  const p=world(door);
  for(const wall of scene.elements.filter(e=>e.kind==='wall'&&!e.geometry)) {
   const q=world(wall);
   if(Math.abs(Math.sin(p[3]-q[3]))>.001)continue;
   const dx=p[0]-q[0],dz=p[2]-q[2];
   const x=Math.cos(q[3])*dx-Math.sin(q[3])*dz;
   const z=Math.sin(q[3])*dx+Math.cos(q[3])*dz;
   const y=p[1]-q[1];
   if(Math.abs(z)>(wall.size[2]+door.size[2])/2+.02 ||
      Math.abs(x)+door.size[0]/2>wall.size[0]/2+.01 ||
      Math.abs(y)+door.size[1]/2>wall.size[1]/2+.01)continue;
   const o=wall.opening;
   if(o&&!o.glazed&&Math.abs(x-o.x)+door.size[0]/2<=o.width/2+.01&&
      Math.abs(y-(-wall.size[1]/2+o.sill+o.height/2))+door.size[1]/2<=o.height/2+.01)continue;
   findings.push({code:'entrance-solid-wall',category:'confirmed-technical-defect',elementIds:[door.id,wall.id],message:`${door.id}: entrance lies against ${wall.id} without a fitting unglazed passage; an applied door does not cut a wall.`});
  }
 }
 return findings;
}
