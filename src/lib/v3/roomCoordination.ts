/** Explicit, reviewable proposal for legacy independent rectangles. Never runs on
 * generation, loading, persistence or exterior handoff. No program/name-specific rules.
 * Only unambiguous facing edges are coordinated; a failed storey stays unchanged. */
import type { V3ArchitecturalPlan } from './architecturalPlanFirst';
import { lowerV3ArchitecturalPlan } from './architecturalPlanFirst';
import { localRectangleFits } from './blueprint';
import { sharedBoundaryLength, type V3RoomFootprint } from './interior';
import { roomsShareAccessBoundary } from './roomLayout';

type Edges=[number,number,number,number];
const edges=(f:V3RoomFootprint):Edges=>[f.x-f.width/2,f.x+f.width/2,f.z-f.depth/2,f.z+f.depth/2];
const rect=([l,r,t,b]:Edges):V3RoomFootprint=>({x:(l+r)/2,z:(t+b)/2,width:r-l,depth:b-t});
const circulation=(program:string)=>/\b(hall|foyer|gallery|corridor|circulation|landing|entry|vestibule)\b/i.test(program);
const overlap=(a:Edges,b:Edges)=>Math.min(a[1],b[1])-Math.max(a[0],b[0])>1e-7&&Math.min(a[3],b[3])-Math.max(a[2],b[2])>1e-7;
const contains=(a:Edges,b:Edges)=>a[0]<=b[0]+1e-7&&a[1]>=b[1]-1e-7&&a[2]<=b[2]+1e-7&&a[3]>=b[3]-1e-7;
export function proposeRoomCoordination(input:V3ArchitecturalPlan){
  const plan=structuredClone(input),shell=lowerV3ArchitecturalPlan({...plan,connections:[]});
  const diagnostics:{storeyId:string;message:string}[]=[],changes:{roomId:string;before:V3RoomFootprint;after:V3RoomFootprint}[]=[];
  for(const building of plan.buildings)for(const [level,storey] of building.storeys.entries()){
    const rooms=storey.spaces,host=shell.objects.find(o=>o.id===building.id)!;
    const original=rooms.map(r=>edges(r.footprint)),values=original.flat(),parents=values.map((_,i)=>i);
    const failures:string[]=[];
    const find=(i:number):number=>parents[i]===i?i:(parents[i]=find(parents[i]));
    const join=(a:number,b:number)=>{parents[find(a)]=find(b);};
    const constraints:[number,number][]=[];
    const facing=(i:number,j:number):[number,number]|undefined=>{
      const a=original[i],b=original[j],options:{pair:[number,number];distance:number}[]=[];
      for(const axis of [0,2]){
        const orth=axis===0?2:0;
        if(Math.min(a[orth+1],b[orth+1])-Math.max(a[orth],b[orth])<.8-1e-7)continue;
        const delta=(a[axis]+a[axis+1]-b[axis]-b[axis+1])/2;
        if(Math.abs(delta)<1e-7)continue;
        const ae=axis+(delta<0?1:0),be=axis+(delta<0?0:1);
        options.push({pair:[i*4+ae,j*4+be],distance:Math.abs(a[ae]-b[be])});
      }
      options.sort((a,b)=>a.distance-b.distance);
      if(!options.length||options.length>1&&Math.abs(options[0].distance-options[1].distance)<1e-7)return;
      return options[0].pair;
    };
    for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++){
      const required=plan.roomAdjacencies.some(p=>p.from===rooms[i].id&&p.to===rooms[j].id||p.to===rooms[i].id&&p.from===rooms[j].id);
      const existing=sharedBoundaryLength(rooms[i].footprint,rooms[j].footprint)>=.8;
      if(!required&&!existing&&!overlap(original[i],original[j]))continue;
      const pair=facing(i,j);
      if(!pair){failures.push(`Facing boundary is ambiguous for ${rooms[i].id} and ${rooms[j].id}.`);continue;}
      constraints.push(pair);join(...pair);
    }
    const groups=new Map<number,number[]>();
    values.forEach((_,i)=>groups.set(find(i),[...groups.get(find(i))??[],i]));
    for(const members of groups.values()){
      // Shell contacts and overruns can only resolve onto the same unchanged
      // rectangle boundary. Articulated hosts are validated, never box-clipped.
      const pinned=building.plan.kind==='rectangle'?members.flatMap(i=>{
        const span=i%4<2?building.plan.kind==='rectangle'?building.plan.width:0:building.plan.kind==='rectangle'?building.plan.depth:0;
        const limit=(i%2===0?-1:1)*span/2;
        return i%2===0?values[i]<=limit+1e-7?[limit]:[]:values[i]>=limit-1e-7?[limit]:[];
      }):[];
      if(pinned.some(v=>Math.abs(v-pinned[0])>1e-7)){failures.push('Conflicting fixed shell contacts.');continue;}
      const guides=members.filter(i=>circulation(rooms[Math.floor(i/4)].program));
      // Preserve the narrow circulation skeleton; broad stair halls retain
      // their fixed reservation, checked below. Equal guides use a shared seam.
      const narrow=Math.min(...guides.map(i=>Math.min(rooms[Math.floor(i/4)].footprint.width,rooms[Math.floor(i/4)].footprint.depth)));
      const preferred=guides.filter(i=>Math.abs(Math.min(rooms[Math.floor(i/4)].footprint.width,rooms[Math.floor(i/4)].footprint.depth)-narrow)<1e-7);
      const source=preferred.length?preferred:members;
      const value=pinned[0]??source.reduce((sum,i)=>sum+values[i],0)/source.length;
      for(const i of members)values[i]=value;
    }
    const next=rooms.map((_,i)=>rect(values.slice(i*4,i*4+4) as Edges));
    for(const [i,f] of next.entries()){
      if(Math.min(f.width,f.depth)<(circulation(rooms[i].program)?.9:.8)-1e-7||!localRectangleFits(host,f,level))failures.push(`No valid bounded rectangle for ${rooms[i].id}.`);
      for(let j=0;j<i;j++)if(overlap(edges(f),edges(next[j])))failures.push(`Unresolved overlap: ${rooms[i].id}, ${rooms[j].id}.`);
      for(const c of plan.verticalCirculation.filter(c=>c.hostMassId===building.id&&level>=c.fromLevel&&level<=c.toLevel))
        if(contains(original[i],edges(c.footprint))&&!contains(edges(f),edges(c.footprint)))failures.push(`Coordination would displace the fixed ${c.id} approach.`);
    }
    for(const [a,b] of constraints){
      if(!roomsShareAccessBoundary(next[Math.floor(a/4)],next[Math.floor(b/4)]))failures.push('A required or previously valid shared boundary would be lost.');
    }
    if(failures.length){diagnostics.push(...[...new Set(failures)].map(message=>({storeyId:storey.id,message})));continue;}
    rooms.forEach((r,i)=>{if(JSON.stringify(r.footprint)!==JSON.stringify(next[i])){changes.push({roomId:r.id,before:structuredClone(r.footprint),after:next[i]});r.footprint=next[i];}});
  }
  return {plan,changes,diagnostics,requiresReview:true as const};
}
