import type {ArchitecturalScene, SceneElement} from './model';
import type {CompletionFinding} from './completion';
/** Sampled necessary evidence only; not a route solver, code check or approval gate. */
export function focusedConstructionFindings(scene: ArchitecturalScene): CompletionFinding[] {
 const map=new Map(scene.elements.map(e=>[e.id,e]));
 const world=(e:SceneElement):number[]=>{if(!e.parent)return [...e.at,e.rotation];const p=world(map.get(e.parent)!);return [p[0]+Math.cos(p[3])*e.at[0]+Math.sin(p[3])*e.at[2],p[1]+e.at[1],p[2]-Math.sin(p[3])*e.at[0]+Math.cos(p[3])*e.at[2],p[3]+e.rotation];};
 const local=(e:SceneElement,x:number,z:number)=>{const p=world(e),dx=x-p[0],dz=z-p[2];return [Math.cos(p[3])*dx-Math.sin(p[3])*dz,Math.sin(p[3])*dx+Math.cos(p[3])*dz];};
 const point=(e:SceneElement,x:number,z:number)=>{const p=world(e);return [p[0]+Math.cos(p[3])*x+Math.sin(p[3])*z,p[2]-Math.sin(p[3])*x+Math.cos(p[3])*z];};
 const inside=(e:SceneElement,x:number,z:number,tol=0)=>{const q=local(e,x,z);return Math.abs(q[0])<=e.size[0]/2+tol && Math.abs(q[1])<=e.size[2]/2+tol;};
 const top=(e:SceneElement)=>world(e)[1]+e.size[1]/2;
 const bottom=(e:SceneElement)=>world(e)[1]-e.size[1]/2;
 const findings:CompletionFinding[]=[];
 const add=(code:string,ids:string[],message:string,confirmed=false)=>findings.push({code,elementIds:ids,message,category:confirmed?'confirmed-technical-defect':'likely-architectural-incompleteness'});
 const treads=scene.elements.filter(e=>(e.kind==='plate'||e.kind==='volume') && /stair.*tread|tread.*stair/i.test(e.id+' '+e.label));
 const landings=scene.elements.filter(e=>e.kind==='plate' && /landing/i.test(e.id+' '+e.label));
 const contact=(a:SceneElement,b:SceneElement)=>{const p=world(a),q=world(b);return [p[3],q[3]].every(yaw=>[yaw,yaw+Math.PI/2].every(angle=>{const radius=(e:SceneElement,r:number[])=>Math.abs(Math.cos(r[3]-angle))*e.size[0]/2+Math.abs(Math.sin(r[3]-angle))*e.size[2]/2;return Math.abs((p[0]-q[0])*Math.cos(angle)-(p[2]-q[2])*Math.sin(angle))<=radius(a,p)+radius(b,q)+.03;}));};
 // A disconnected high-rise sequence must remain visible even when it never
 // qualifies for the connected-group headroom probe below.
 for(let i=0;i<treads.length;i++)for(let j=0;j<i;j++) {
  const a=treads[i],b=treads[j],rise=Math.abs(top(a)-top(b));
  if(contact(a,b)&&rise>.251&&rise<1) add('stair-rise-gap',[a.id,b.id],`${a.id} / ${b.id}: adjacent tread surfaces differ by ${rise.toFixed(3)} m; the 0.25 m circulation evidence probe cannot connect them. Review rise/run, endpoint datums and slab openings; this is not a code certification.`);
 }
 const seen=new Set<string>();
 for(const seed of treads)if(!seen.has(seed.id)){
  const group=[seed];seen.add(seed.id);
  for(let i=0;i<group.length;i++)for(const next of treads)if(!seen.has(next.id)&&Math.abs(top(group[i])-top(next))<=.251&&contact(group[i],next)){group.push(next);seen.add(next.id);}
  if(group.length<3)continue; // Do not impose a staircase model on isolated details.
  group.sort((a,b)=>top(a)-top(b));
  for(const [end,tread] of [['lower',group[0]],['upper',group[group.length-1]]] as const){
   const connected=scene.elements.some(e=>e.kind==='plate'&&!treads.includes(e)&&!/pool|basin|coping|foundation/i.test(e.id+' '+e.label)&&Math.abs(top(e)-top(tread))<=.251&&contact(e,tread));
   if(!connected)add('stair-endpoint-disconnected',[tread.id],`${tread.id}: ${end} end of connected tread group lacks nearby floor/landing contact within 0.25 m rise. Alternative ramps, lifts and special transitions require review.`);
  }
 }
 for(const tread of treads){
  const p=world(tread),height=top(tread);
  for(const landing of landings){
   if(Math.abs(top(landing)-height)>.01)continue;
   // Exact rectangle overlap for parallel frames only; do not infer rotated polygons.
   const q=local(landing,p[0],p[2]);
   if(Math.abs(Math.sin(p[3]-world(landing)[3]))<.001 && [0,1].every((axis)=>Math.min(q[axis]+tread.size[axis===0?0:2]/2,landing.size[axis===0?0:2]/2)-Math.max(q[axis]-tread.size[axis===0?0:2]/2,-landing.size[axis===0?0:2]/2)>.001))
    add('stair-landing-overlap',[tread.id,landing.id],`${tread.id}: positive-area duplicate walking surface with ${landing.id} at Y=${height.toFixed(3)}; this alone does not prove an unusable stair.`,true);
  }
  for(const obstacle of scene.elements){
   if(obstacle===tread || !['plate','volume','roof','wall','glazing'].includes(obstacle.kind) || treads.includes(obstacle))continue;
   if(top(obstacle)<=height+.01 || bottom(obstacle)>=height+2-.001)continue;
   if(!inside(obstacle,p[0],p[2]))continue;
   const [x]=local(obstacle,p[0],p[2]);
   if(obstacle.opening){const o=obstacle.opening,base=bottom(obstacle);if(!o.glazed && Math.abs(x-o.x)<o.width/2 && height>=base+o.sill-.01 && height+2<=base+o.sill+o.height)continue;}
   add('stair-headroom-obstructed',[tread.id,obstacle.id],`${tread.id}: centreline overhead solid ${obstacle.id} underside Y=${bottom(obstacle).toFixed(3)}, tread Y=${height.toFixed(3)}, clearance ${(bottom(obstacle)-height).toFixed(3)} m. Review a slab void or route redesign. The 2 m probe is a review heuristic, not a mandatory dimension or code test.`,bottom(obstacle)<=height+.01);
  }
 }
 // Landing contact is not proof of passage. Probe each landing/floor shared edge
 // at its centre; walls with an opening elsewhere must not clear this check.
 const floors=scene.elements.filter(e=>e.kind==='plate' && /floor/i.test(e.id+' '+e.label) && !/pool|basin/i.test(e.id+' '+e.label));
 for(const landing of landings)for(const floor of floors){
  if(Math.abs(top(landing)-top(floor))>.05 || Math.abs(Math.sin(world(landing)[3]-world(floor)[3]))>.001)continue;
  const p=world(floor),q=local(landing,p[0],p[2]);
  for(const axis of [0,1]){const other=1-axis,dim=axis===0?0:2,odim=other===0?0:2;
   if(Math.abs(Math.abs(q[axis])-(landing.size[dim]+floor.size[dim])/2)>.04)continue;
   const lo=Math.max(-landing.size[odim]/2,q[other]-floor.size[odim]/2),hi=Math.min(landing.size[odim]/2,q[other]+floor.size[odim]/2);if(hi-lo<.1)continue;
   const v=[0,0];v[axis]=Math.sign(q[axis])*landing.size[dim]/2;v[other]=(lo+hi)/2;const [x,z]=point(landing,v[0],v[1]);
   for(const wall of scene.elements.filter(e=>e.kind==='wall'||e.kind==='glazing')){if(!inside(wall,x,z,.02)||bottom(wall)>top(landing)+.1||top(wall)<top(landing)+1.9)continue;
    const o=wall.opening;
    if(o&&!o.glazed){
     // Clip the opening against the full shared edge, not its midpoint.
     const va=[...v],vb=[...v];va[other]=lo;vb[other]=hi;
     const a=point(landing,va[0],va[1]),b=point(landing,vb[0],vb[1]);
     const u=local(wall,a[0],a[1])[0],v2=local(wall,b[0],b[1])[0];
     const width=Math.min(Math.max(u,v2),o.x+o.width/2)-Math.max(Math.min(u,v2),o.x-o.width/2);
     if(width>=.8 && bottom(wall)+o.sill<=top(landing)+.25&&bottom(wall)+o.sill+o.height>=top(landing)+1.9){
      if(bottom(wall)+o.sill>top(landing)+.15)add('upper-access-raised-sill',[landing.id,floor.id,wall.id],`${landing.id} / ${floor.id}: aligned passage width ${width.toFixed(3)} m, but sill is ${(bottom(wall)+o.sill-top(landing)).toFixed(3)} m above both floors. Threshold accessibility requires review.`);
      continue;
     }
    }
    add('upper-access-obstructed',[landing.id,floor.id,wall.id],`${landing.id} / ${floor.id}: shared-edge centre (${x.toFixed(3)}, ${top(landing).toFixed(3)}, ${z.toFixed(3)}) lacks an aligned 0.8 m × 1.9 m clear wall passage. Other paths require review.`);
   }
  }
 }
 for(const water of scene.elements.filter(e=>e.kind==='water')){
  const p=world(water);
  const basins=scene.elements.filter(e=>['plate','volume'].includes(e.kind)&&top(e)<p[1]&&[[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]].every(([x,z])=>{const q=point(water,x*water.size[0],z*water.size[2]);return inside(e,q[0],q[1],.01);}));
  for(const basin of basins){
   if(p[1]-top(basin)<.3)add('pool-shallow-basin',[water.id,basin.id],`${water.id}: water plane Y=${p[1].toFixed(3)}, basin top Y=${top(basin).toFixed(3)}; depth ${(p[1]-top(basin)).toFixed(3)} m. May be a reflecting/wading pool; intended swimming use requires a design decision.`);
   const gaps:string[]=[];
   for(let edge=0;edge<4;edge++)for(const t of [-.4,0,.4]){const q=point(water,edge<2?t*water.size[0]:(edge===2?-.5:.5)*water.size[0],edge<2?(edge===0?-.5:.5)*water.size[2]:t*water.size[2]);
    if(!scene.elements.some(w=>['wall','volume'].includes(w.kind)&&inside(w,q[0],q[1],.02)&&bottom(w)<=top(basin)+.02&&top(w)>=p[1]))gaps.push(`${edge}:${t}`);
   }
   if(gaps.length)add('pool-wall-bottom-gap',[water.id,basin.id],`${water.id}: perimeter samples ${gaps.join(', ')} lack walls spanning basin top to water plane. Infinity edges and special details require review.`);
  }
 }
 return findings;
}
