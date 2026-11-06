import type {HouseSpec} from './spec';
import {blockRect,overlapArea,rectDiff,snap,allRooms,type R} from './layout';
import {poolReservation,poolWaterNorth,requirePool} from './poolGeometry';

/** Measured semantic pool move, retaining architecture and unrelated horticulture.
 * Reuses the normal pool assembly, shortens only its near dry apron if needed,
 * clips only affected paving and fills its vacated reservation. Never moves plants/furniture. */
export function derivePoolMove(spec:HouseSpec,op:{pool:string;veranda:string;direction:'towards'|'away';distance:number}):HouseSpec{
 if(op.pool!=='pool')throw Error('Unknown semantic pool.');
 const id=op.veranda.replace(/^veranda:/,''),v=spec.exterior.verandas.find(v=>v.id===id),b=v&&spec.blocks.find(b=>b.id===v.block);
 if(!v||!b||v.side!=='s'||!spec.sitePresentation)throw Error('Supported pool edit requires an accepted rich-site house and a south-facing veranda.');
 if(!Number.isFinite(op.distance)||op.distance<=0||op.distance>10)throw Error('Invalid relative distance.');
 const verandaEdge=blockRect(b).z1+v.depth,old=requirePool(spec.siteWork.pool),water=poolWaterNorth(old)+(op.direction==='towards'?-op.distance:op.distance);
 // Keep all coping and at least 0.1 m of apron. No overlap with veranda permitted.
 const nearDepth=snap(Math.min(1.5,water-verandaEdge-.7));
 if(nearDepth<.1)throw Error(`Pool move leaves ${snap(water-verandaEdge)} m to the veranda; requires at least 0.8 m for coping and apron. Nothing changed.`);
 const z=snap(water-nearDepth-.7),pool={...old,z,...(nearDepth<1.5?{nearDeckDepth:nearDepth}:{})};
 if(nearDepth===1.5)delete pool.nearDeckDepth;
 const prior=poolReservation(old),next=poolReservation(pool);
 const occupiedIds=new Set(spec.siteWork.paths.map(p=>p.id));
 const paths=spec.siteWork.paths.flatMap(p=>{
  const r={x0:p.rect.x-p.rect.w/2,x1:p.rect.x+p.rect.w/2,z0:p.rect.z-p.rect.d/2,z1:p.rect.z+p.rect.d/2};
  if(overlapArea(r,next)<.000001)return [p];
  const parts=rectDiff(r,[next]);if(!parts.length)throw Error(`Pool would consume the complete retained path ${p.id}; explicit redesign required.`);
  return parts.map((r,i)=>{let id=p.id;if(i){let n=i;while(occupiedIds.has(`${p.id}-pool-${n}`))n++;id=`${p.id}-pool-${n}`;occupiedIds.add(id);}return {id,rect:toRect(r)};});
 });
 const hard=[...spec.blocks.filter(b=>!b.level).map(blockRect),...spec.exterior.verandas.map(v=>{
  const b=spec.blocks.find(b=>b.id===v.block)!;if(v.side!=='s')throw Error('Unsupported mixed veranda orientation.');return {x0:v.from,x1:v.to,z0:blockRect(b).z1,z1:blockRect(b).z1+v.depth};
 }),...paths.map(p=>fromRect(p.rect)),next,...spec.siteWork.beds.map(p=>fromRect(p.rect)),...spec.siteWork.hedges.map(p=>fromRect(p.rect)),...spec.siteWork.lawns.flatMap(p=>(p.patches??[p.rect]).map(fromRect))];
 const infill=rectDiff(prior,hard).filter(r=>(r.x1-r.x0)*(r.z1-r.z0)>.0001);
 const used=new Set(paths.map(p=>p.id));
 for(const r of infill){let n=1;while(used.has(`pool-edit-infill-${n}`))n++;const id=`pool-edit-infill-${n}`;used.add(id);paths.push({id,rect:toRect(r)});}
 if(paths.length>16)throw Error('Dependent terrace patches exceed the retained sixteen-path limit.');
 // Retain source plans/functions; validation after compilation is the acceptance authority.
 if(allRooms(spec).length===0)throw Error('No accepted room programme.');
 return {...spec,siteWork:{...spec.siteWork,pool,paths}};
}
const fromRect=(r:{x:number;z:number;w:number;d:number}):R=>({x0:r.x-r.w/2,x1:r.x+r.w/2,z0:r.z-r.d/2,z1:r.z+r.d/2});
const toRect=(r:R)=>({x:snap((r.x0+r.x1)/2),z:snap((r.z0+r.z1)/2),w:snap(r.x1-r.x0),d:snap(r.z1-r.z0)});
