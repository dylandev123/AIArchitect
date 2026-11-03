/** The single authority for where every space of an architectural-plan-1 sits in the plan frame.
 * Compiler (`derive`), diagnosis, arrangement analysis and spatial coordination all call `resolveLayout`; there is
 * no second resolver to drift from it.
 *
 * Two relationship scales share one vocabulary (relativeTo / side / alignment / gap):
 *  - ROOM placement: a space is placed against another space, or against the bounding rectangle of a whole wing
 *    (historical meaning, unchanged);
 *  - WING placement (optional, `masses[].placement`): a wing is placed as one rigid body by its ENVELOPE. Its rooms
 *    are arranged in a wing-local frame (exactly one local origin), the envelope follows from them, and the whole wing
 *    is translated so that its envelope has the declared relationship to its anchor. The author states how wings
 *    relate; the translation, the envelope extents and every room's world position are consequences.
 * A mass without `placement` behaves exactly as before. Pure functions; nothing here edits a plan. */
import {DesignConflict} from '../experimental/semantic-building/compiler';
import type {ArchitecturalPlan} from './plan';
import {isMassAnchor,massMembers,primaryMembers,boundsOf,massAnchorProblem} from './massAnchor';
export type Rect={x:number;z:number;width:number;depth:number};
export type Placement={relativeTo:string|null;side:'origin'|'north'|'east'|'south'|'west'|'same';alignment:'start'|'centre'|'end';gap:number};
const fail=(message:string):never=>{throw new DesignConflict([message]);};
export function locate(width:number,depth:number,p:Placement,base?:Rect):Rect{
 if(!base){if(p.relativeTo!==null||p.side!=='origin'||p.gap!==0)fail('Choose a single origin placement.');return {x:0,z:0,width,depth};}
 if(p.side==='origin')fail('Only the root may use origin placement.');
 const align=(a:number,b:number)=>p.alignment==='start'?0:p.alignment==='end'?a-b:(a-b)/2;
 let x=base.x+align(base.width,width),z=base.z+align(base.depth,depth);
 if(p.side==='east')x=base.x+base.width+p.gap;
 if(p.side==='west')x=base.x-width-p.gap;
 if(p.side==='north')z=base.z+base.depth+p.gap;
 if(p.side==='south')z=base.z-depth-p.gap;
 if(p.side==='same'&&p.gap!==0)fail('Stacked placement cannot include a horizontal gap.');
 return {x,z,width,depth};
}
/** Rectangles that define a wing's own volume (see primaryMembers). The same rule for the wing being placed and the wing it is placed against. */
function extentRects(plan:ArchitecturalPlan,massId:string,parts:{m:ArchitecturalPlan['spaces'][number];r:Rect}[]):Rect[]{
 const own=new Set(primaryMembers(plan,massId).map(m=>m.id));
 return parts.filter(p=>own.has(p.m.id)).map(p=>p.r);
}
export type LayoutProblem={id:string;message:string};
export type WingFrame={
 id:string;
 /** The one wing-local origin space. */
 seed:string;
 /** Envelope in the wing's own frame (seed at the origin) and in the plan frame. */
 local:Rect;envelope:Rect;
 /** Rigid translation applied to every member: local → plan frame. */
 offset:[number,number];
 anchor:string;placement:Placement;
};
export const placementOfMass=(plan:ArchitecturalPlan,massId:string):Placement|undefined=>plan.masses.find(m=>m.id===massId)?.placement;
export const isPlacedWing=(plan:ArchitecturalPlan,massId:string):boolean=>!!placementOfMass(plan,massId);
/** Is the space the local origin of its (placed) wing? */
export const isWingSeed=(plan:ArchitecturalPlan,s:ArchitecturalPlan['spaces'][number]):boolean=>isPlacedWing(plan,s.mass)&&s.placement.relativeTo===null;
/** Spaces that must not be both root and seed: the plan's single root is the null-anchored space of an unplaced wing. */
export const rootSpaces=(plan:ArchitecturalPlan)=>plan.spaces.filter(s=>s.placement.relativeTo===null&&!isPlacedWing(plan,s.mass));

/** Resolve every space. A relationship that cannot be resolved is reported with its reason and its space is left out; nothing is guessed. */
export function resolveLayout(plan:ArchitecturalPlan){
 const rects=new Map<string,Rect>(),frames=new Map<string,WingFrame>(),problems:LayoutProblem[]=[],bad=new Set<string>();
 const note=(id:string,message:string)=>{problems.push({id,message});};
 const spaces=new Map(plan.spaces.map(s=>[s.id,s])),masses=new Map(plan.masses.map(m=>[m.id,m]));
 const space=(key:string,active=new Set<string>()):Rect|undefined=>{
  if(rects.has(key))return rects.get(key);
  const s=spaces.get(key);
  if(!s||active.has(key)||bad.has(key)){bad.add(key);return undefined;}
  if(isPlacedWing(plan,s.mass)){wing(s.mass,active);return rects.get(key);}
  active.add(key);
  let base:Rect|undefined;
  const anchor=s.placement.relativeTo;
  if(anchor!==null){
   if(isMassAnchor(plan,anchor)){
    const problem=massAnchorProblem(plan,s.id,anchor,s.placement.side),parts=problem?[]:massMembers(plan,anchor).map(m=>({m,r:space(m.id,active)}));
    if(problem||parts.some(p=>!p.r)){note(s.id,problem??`${s.id}: placement anchor wing ${anchor} contains a space that is missing, cyclic or itself unresolved`);bad.add(key);return undefined;}
    base=boundsOf(extentRects(plan,anchor,parts as {m:typeof plan.spaces[number];r:Rect}[]));
   }else{base=space(anchor,active);if(!base){note(s.id,`${s.id}: placement anchor ${anchor} is missing, cyclic or itself unresolved`);bad.add(key);return undefined;}}
  }
  try{const r=locate(s.width,s.depth,s.placement,base);rects.set(key,r);return r;}catch(e){note(s.id,String((e as Error).message??e));bad.add(key);return undefined;}
 };
 const wing=(massId:string,active:Set<string>):WingFrame|undefined=>{
  const wk=`wing:${massId}`;
  if(frames.has(massId))return frames.get(massId);
  if(bad.has(wk))return undefined;
  if(active.has(wk)){bad.add(wk);note(massId,`wing ${massId} is placed against something that depends on its own position (cyclic wing placement).`);return undefined;}
  active.add(wk);
  const give=(message:string)=>{note(massId,message);bad.add(wk);return undefined;};
  const p=masses.get(massId)!.placement!,members=massMembers(plan,massId);
  if(!members.length)return give(`wing ${massId} is placed as a whole but has no spaces.`);
  const seeds=members.filter(s=>s.placement.relativeTo===null);
  if(seeds.length!==1)return give(`wing ${massId} is placed as a whole, so exactly one of its spaces must be its local origin (relativeTo:null, side:origin, gap:0); found ${seeds.length}${seeds.length?`: ${seeds.map(s=>s.id).join(', ')}`:''}.`);
  const outside=members.filter(s=>s.placement.relativeTo!==null&&spaces.get(s.placement.relativeTo)?.mass!==massId);
  if(outside.length)return give(`${outside.map(s=>`${s.id} (anchored to ${s.placement.relativeTo})`).join(', ')} belong${outside.length===1?'s':''} to wing ${massId}, which is placed as a whole: rooms in it may be placed only against rooms of the same wing. Relate the wings (placement of ${massId}), not one room to another wing's room.`);
  // Wing-local frame: the seed sits at the origin, every other member is placed against a member.
  const local=new Map<string,Rect>(),stack=new Set<string>();let ok=true;
  const loc=(id:string):Rect|undefined=>{
   if(local.has(id))return local.get(id);
   const s=spaces.get(id)!;if(stack.has(id))return undefined;stack.add(id);
   const base=s.placement.relativeTo===null?undefined:loc(s.placement.relativeTo);
   if(s.placement.relativeTo!==null&&!base){return undefined;}
   try{const r=locate(s.width,s.depth,s.placement,base);local.set(id,r);return r;}catch(e){note(s.id,String((e as Error).message??e));return undefined;}
  };
  for(const s of members)if(!loc(s.id)){ok=false;if(!problems.some(q=>q.id===s.id))note(s.id,`${s.id}: placement inside wing ${massId} is cyclic or refers to an unresolved room`);}
  if(!ok){bad.add(wk);return undefined;}
  // The wing is placed by its own volume: spaces the author declared `attached` (porch, terrace, annex) travel with it but do not enlarge the extent it is placed by.
  const envLocal=boundsOf(extentRects(plan,massId,[...local].map(([id,r])=>({m:spaces.get(id)!,r}))));
  const anchorId=p.relativeTo;
  if(anchorId===null)return give(`wing ${massId} is placed as a whole but its placement has no anchor (relativeTo:null).`);
  if(anchorId===massId||spaces.get(anchorId)?.mass===massId)return give(`wing ${massId} cannot be placed against itself.`);
  let base:Rect|undefined;
  if(spaces.has(anchorId))base=space(anchorId,active);
  else if(masses.has(anchorId)){
   if(!massMembers(plan,anchorId).length)return give(`wing ${massId} is placed against ${anchorId}, which has no spaces.`);
   const parts=massMembers(plan,anchorId).map(m=>({m,r:space(m.id,active)}));
   base=parts.some(p=>!p.r)?undefined:boundsOf(extentRects(plan,anchorId,parts as {m:typeof plan.spaces[number];r:Rect}[]));
  }else return give(`wing ${massId} is placed against ${anchorId}, which is neither a wing nor a space.`);
  if(!base)return give(`wing ${massId} is placed against ${anchorId}, which is missing, cyclic or itself unresolved.`);
  let target:Rect;
  try{target=locate(envLocal.width,envLocal.depth,p,base);}catch(e){return give(`wing ${massId}: ${String((e as Error).message??e)}`);}
  const offset:[number,number]=[target.x-envLocal.x,target.z-envLocal.z];
  for(const [id,r] of local)rects.set(id,{x:r.x+offset[0],z:r.z+offset[1],width:r.width,depth:r.depth});
  const frame:WingFrame={id:massId,seed:seeds[0].id,local:envLocal,envelope:target,offset,anchor:anchorId,placement:p};
  frames.set(massId,frame);return frame;
 };
 plan.spaces.forEach(s=>space(s.id));
 plan.masses.forEach(m=>{if(m.placement)wing(m.id,new Set());});
 return {rects,frames,problems};
}

/** Parent in the placement graph. Nodes are space ids and wing (mass) ids: a room's parent is what it is placed against; a wing-local origin's
 * parent is its wing; a placed wing's parent is its anchor; an unplaced wing has none (a wing anchor ends the chain). */
export function placementParent(plan:ArchitecturalPlan,node:string):string|null{
 const s=plan.spaces.find(x=>x.id===node);
 if(s)return isPlacedWing(plan,s.mass)&&s.placement.relativeTo===null?s.mass:s.placement.relativeTo;
 return placementOfMass(plan,node)?.relativeTo??null;
}
/** Placement ancestry, self first. */
export function placementPath(plan:ArchitecturalPlan,id:string):string[]{
 const out:string[]=[],seen=new Set<string>();let cur:string|null=id;
 while(cur&&!seen.has(cur)){seen.add(cur);out.push(cur);cur=placementParent(plan,cur);}
 return out;
}

type SiteItem=ArchitecturalPlan['pools'][number]|ArchitecturalPlan['landscape'][number];
/** Pools and landscape are placed against a space, a whole wing, or another pool/landscape item (ids are unique across entity types). */
export function resolveSiteRects(plan:ArchitecturalPlan,rects:Map<string,Rect>){
 const defs=new Map<string,SiteItem>([...plan.pools,...plan.landscape].map(i=>[i.id,i])),out=new Map<string,Rect>(),problems:LayoutProblem[]=[],bad=new Set<string>();
 const item=(it:SiteItem,active=new Set<string>()):Rect|undefined=>{
  if(out.has(it.id))return out.get(it.id);
  if(bad.has(it.id))return undefined;
  const anchor=it.placement.relativeTo;
  const give=(message:string)=>{bad.add(it.id);problems.push({id:it.id,message});return undefined;};
  if(anchor===null)return give(`${it.id}: site allocation needs a space or site-item anchor.`);
  if(active.has(it.id)||anchor===it.id)return give(`${it.id}: cyclic site anchor.`);
  active.add(it.id);
  let base:Rect|undefined;
  if(rects.has(anchor))base=rects.get(anchor);
  else if(isMassAnchor(plan,anchor)){
   const problem=massAnchorProblem(plan,it.id,anchor,it.placement.side);if(problem)return give(problem);
   const parts=massMembers(plan,anchor).map(m=>rects.get(m.id));
   if(parts.some(r=>!r))return give(`${it.id}: site anchor wing ${anchor} contains a space that is unresolved.`);
   base=boundsOf(parts as Rect[]);
  }else if(defs.has(anchor))base=item(defs.get(anchor)!,active);
  else return give(`${it.id}: site anchor ${anchor} is neither a space, a wing nor a pool/landscape item.`);
  if(!base)return give(`${it.id}: site anchor ${anchor} is unresolved.`);
  try{const r=locate(it.width,it.depth,it.placement,base);out.set(it.id,r);return r;}catch(e){return give(`${it.id}: ${String((e as Error).message??e)}`);}
 };
 [...defs.values()].forEach(i=>item(i));
 return {rects:out,problems};
}
