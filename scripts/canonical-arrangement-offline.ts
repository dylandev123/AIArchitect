/** Offline evidence for concept-first arrangement. Reads retained plans, never writes to them; no provider, database or network.
 * Fixtures are developer-authored and show mechanics, not architectural quality.
 *   npx vite-node --config vitest.config.mts scripts/canonical-arrangement-offline.ts */
import {readdirSync,readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {architecturalPlanSchema,type ArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {resolveRects,volumeCollisions,explainCollisions,compositionOf,renderConceptSvg} from '../src/lib/villa/canonical/arrangement';
import {conceptFixtures,spineParti} from '../src/lib/villa/canonical/arrangement.fixture';
const ROOT='docs/architecture',OUT=`${ROOT}/canonical-concept-first-2026-11-02`;
mkdirSync(`${OUT}/diagrams`,{recursive:true});
const found=new Map<string,{plan:ArchitecturalPlan;where:string[]}>();
const scan=(v:unknown,where:string,path:string)=>{
 if(!v||typeof v!=='object')return;
 const o=v as Record<string,unknown>;
 if(o.version==='architectural-plan-1'&&Array.isArray(o.spaces)){
  const parsed=architecturalPlanSchema.safeParse(o);if(!parsed.success)return;
  const h=createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0,10),e=found.get(h);
  if(e)e.where.push(`${where}#${path}`);else found.set(h,{plan:parsed.data,where:[`${where}#${path}`]});
  return;
 }
 for(const [k,x] of Object.entries(o))scan(x,where,path?`${path}.${k}`:k);
};
const walk=(d:string)=>{for(const n of readdirSync(d)){const p=join(d,n),s=statSync(p);if(s.isDirectory()){if(!n.includes('node_modules'))walk(p);}else if(n.endsWith('.json')&&s.size<8e6&&!p.startsWith(OUT)&&!n.includes('request')&&!n.includes('provider-')){try{scan(JSON.parse(readFileSync(p,'utf8')),p.slice(ROOT.length+1),'');}catch{/* not json plan */}}}};
walk(ROOT);
// Only houses with a mansion-scale programme (more than 12 spaces) are compared here.
const retained=[...found.entries()].filter(([,v])=>v.plan.spaces.length>12).map(([hash,v])=>({hash,...v}));
const rows=retained.map(({hash,plan,where})=>{
 const {rects,problems}=resolveRects(plan),cs=volumeCollisions(plan,rects),ds=explainCollisions(plan,3),comp=compositionOf(plan);
 const byCause:Record<string,number>={};ds.forEach(d=>byCause[d.cause]=(byCause[d.cause]??0)+1);
 const massOf=(id:string)=>plan.spaces.find(s=>s.id===id)!.mass,byWings:Record<string,number>={};
 ds.forEach(d=>{const k=[...new Set(d.pair.map(massOf))].sort().join(' × ');byWings[k]=(byWings[k]??0)+1;});
 return {hash,id:plan.id,where:where.slice(0,3),extraLocations:Math.max(0,where.length-3),spaces:plan.spaces.length,masses:plan.masses.length,levels:plan.levels.length,unresolvedPlacements:problems.length,
  collisions:cs.length,collisionsByCause:byCause,collisionsByWingPair:byWings,collisionsWithSideEffectFreeSingleEdge:ds.filter(d=>d.options.some(o=>o.newCollisions.length===0)).length,collisionsWithAnyVerifiedSingleEdge:ds.filter(d=>d.options.length).length,
  composition:{spine:comp.spine,bilateral:comp.bilateral.map(b=>({host:b.host,sides:Object.fromEntries(Object.entries(b.sides).map(([k,v])=>[k,v.length]))})),mirrorShare:comp.mirrorShare,mirrorAxis:comp.mirrorAxis,repeated:comp.repeated,distinctFootprints:comp.distinctFootprints,indoorRooms:comp.indoorRooms,maxChainDepth:comp.maxChainDepth,levels:comp.levels,roofForms:comp.roofForms,footprintFill:comp.footprintFill,wings:comp.wings.map(w=>({id:w.id,rooms:w.rooms,w:Number(w.bounds.width.toFixed(1)),d:Number(w.bounds.depth.toFixed(1)),fill:w.fill}))}};
});
const svgs:Record<string,string>={};
for(const r of retained){const p=r.plan;svgs[`retained-${r.hash}`]=renderConceptSvg(p,{title:`RETAINED (read-only) ${p.id} ${r.hash}`,caption:'DIAGNOSTIC concept view of a retained Terra proposal: wing envelopes derived from its authored placements. Not modified, not a repair.',showRooms:true});}
for(const [name,make] of Object.entries(conceptFixtures))svgs[`fixture-concept-${name}`]=renderConceptSvg(make(),{title:`FIXTURE concept: ${name}`,caption:'DEVELOPER FIXTURE concept diagram (wing envelopes only). Not Terra output.'});
const sizes={gallery:[8,10] as [number,number],salon:[16,10] as [number,number],hall:[4,20] as [number,number],suite:[10,6] as [number,number]},pair=spineParti(sizes);
svgs['fixture-spine-room-anchored']=renderConceptSvg(pair.roomAnchored,{title:'FIXTURE: halls anchored to the gallery (room)',caption:'DEVELOPER FIXTURE reproducing the retained parti with room anchoring: overlaps are real geometry.',showRooms:true});
svgs['fixture-spine-wing-anchored']=renderConceptSvg(pair.wingAnchored,{title:'FIXTURE: same sizes, halls anchored to the social wing',caption:'DEVELOPER FIXTURE: identical sizes, only the anchor changed from a room to its wing.',showRooms:true});
// Property sweep.
const lcg=(seed:number)=>()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
const rnd=lcg(20261102),N=2000;let roomCollide=0,wingCollide=0,corner=0;
for(let i=0;i<N;i++){
 const pick=(a:number,b:number)=>Math.round((a+rnd()*(b-a))*2)/2;
 const s={gallery:[pick(6,12),pick(6,14)] as [number,number],salon:[pick(10,22),pick(8,14)] as [number,number],hall:[pick(3,5),pick(12,26)] as [number,number],suite:[pick(6,12),pick(4,7)] as [number,number]};
 const {roomAnchored,wingAnchored}=spineParti(s),cr=volumeCollisions(roomAnchored,resolveRects(roomAnchored).rects),cw=volumeCollisions(wingAnchored,resolveRects(wingAnchored).rects);
 if(cr.length)roomCollide++;
 const mass=(p:ArchitecturalPlan,id:string)=>p.spaces.find(s=>s.id===id)!.mass;
 if(cw.some(c=>mass(wingAnchored,c.a)!==mass(wingAnchored,c.b)))wingCollide++;
 if(explainCollisions(roomAnchored,0).some(d=>d.cause==='adjacent-overhang'))corner++;
}
(async()=>{
 const sharp=(await import('sharp')).default;
 for(const [n,svg] of Object.entries(svgs)){writeFileSync(`${OUT}/diagrams/${n}.svg`,svg);await sharp(Buffer.from(svg)).png().toFile(`${OUT}/diagrams/${n}.png`);}
 const fixtureRows=Object.entries(conceptFixtures).map(([n,make])=>{const p=make(),c=compositionOf(p);return {fixture:n,wings:c.wings.length,collisions:volumeCollisions(p,resolveRects(p).rects).length,mirrorShare:c.mirrorShare,mirrorAxis:c.mirrorAxis,footprintFill:c.footprintFill,wingSizes:c.wings.map(w=>`${w.id} ${w.bounds.width.toFixed(0)}×${w.bounds.depth.toFixed(0)}`)};});
 const out={generatedBy:'scripts/canonical-arrangement-offline.ts',note:'Offline. Retained plans read, never written. Fixtures developer-authored. No quality claim.',retained:rows,fixtures:fixtureRows,
  spineSweep:{samples:N,seed:20261102,roomAnchored:{withAnyCollision:roomCollide,share:Number((roomCollide/N).toFixed(3)),withCornerOverhangCause:corner},wingAnchored:{withCrossWingCollision:wingCollide}}};
 writeFileSync(`${OUT}/evidence.json`,JSON.stringify(out,null,1));
 console.log(JSON.stringify({retained:rows.map(r=>({id:r.id,hash:r.hash,spaces:r.spaces,collisions:r.collisions,causes:r.collisionsByCause,wingPairs:r.collisionsByWingPair,cleanEdit:r.collisionsWithSideEffectFreeSingleEdge,withEdit:r.collisionsWithAnyVerifiedSingleEdge,spine:r.composition.spine,bil:r.composition.bilateral.length,mirror:r.composition.mirrorShare,rep:r.composition.repeated,fill:r.composition.footprintFill,depth:r.composition.maxChainDepth,lv:r.composition.levels,locs:r.where[0]})),fixtures:fixtureRows,sweep:out.spineSweep},null,1));
})();
