/** A placement anchor may name a mass (a wing) instead of one room. The anchor is then the bounding rectangle of every
 * space declared in that mass, so a neighbouring wing, pool or lawn is placed against the whole wing and software, not
 * the model, finds its corner. Type-only imports: plan.ts and diagnose.ts both use this without a cycle.
 * Additive: an id that names a space or a pool/landscape item keeps its historical meaning; before this a mass id was
 * simply an unresolvable reference. */
import type {ArchitecturalPlan,Rect} from './plan';
export const isMassAnchor=(plan:ArchitecturalPlan,id:string):boolean=>
 plan.masses.some(m=>m.id===id)&&!plan.spaces.some(s=>s.id===id)&&![...plan.pools,...plan.landscape].some(i=>i.id===id);
export const massMembers=(plan:ArchitecturalPlan,massId:string)=>plan.spaces.filter(s=>s.mass===massId);
export function boundsOf(rects:Rect[]):Rect{
 const x0=Math.min(...rects.map(r=>r.x)),x1=Math.max(...rects.map(r=>r.x+r.width)),z0=Math.min(...rects.map(r=>r.z)),z1=Math.max(...rects.map(r=>r.z+r.depth));
 return {x:x0,z:z0,width:x1-x0,depth:z1-z0};
}
/** Why a mass anchor cannot be used, or null. Stacking is a relation between two rooms, not a room and a wing. */
export function massAnchorProblem(plan:ArchitecturalPlan,owner:string,massId:string,side:string):string|null{
 if(side==='same')return `${owner}: stacked placement ("same") needs a space, not the wing ${massId}.`;
 const members=massMembers(plan,massId);
 if(!members.length)return `${owner}: the wing ${massId} has no spaces to anchor to.`;
 if(members.some(m=>m.id===owner))return `${owner}: cannot be placed relative to its own wing ${massId}, whose extent includes ${owner}. Anchor it to a space, or to another wing.`;
 return null;
}
