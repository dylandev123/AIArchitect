import {elementCap} from './grouping';
import {poolWaterNorth,requirePool} from './poolGeometry';
import {allRooms, blockRect, rectDiff, overlapArea, snap, type R} from './layout';
import {compileHouse} from './compile';
import {poolFootprint, siteObstacles, verandaRect, type Finding} from './validate';
import {siteDesignSchema} from './siteContract';
import type {HouseSpec, Rect} from './spec';

export const STAGE4_BASE = 'docs/architecture/staged-villa/stage4-corrections/corrected-v5';
export const toRect = (r: R): Rect => ({x: snap((r.x0+r.x1)/2), z: snap((r.z0+r.z1)/2), w: snap(r.x1-r.x0), d: snap(r.z1-r.z0)});
export const fromRect = (r: Rect): R => ({x0:r.x-r.w/2,x1:r.x+r.w/2,z0:r.z-r.d/2,z1:r.z+r.d/2});
const inflate = (r:R, m:number):R => ({x0:r.x0-m,x1:r.x1+m,z0:r.z0-m,z1:r.z1+m});
const contains = (a:R,b:R) => b.x0>=a.x0-1e-5 && b.x1<=a.x1+1e-5 && b.z0>=a.z0-1e-5 && b.z1<=a.z1+1e-5;
const hit = (a:R,bs:R[]) => bs.some(b=>overlapArea(a,b)>.001);
/** Coalesce exact adjacent remnants; no area is added and no obstacle is covered. */
export function mergeSiteRectangles(input:R[]):R[]{
  const rs=input.map(r=>({...r}));let merged=true;
  while(merged){merged=false;outer:for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){
    const a=rs[i],b=rs[j],near=(x:number,y:number)=>Math.abs(x-y)<1e-6;
    if((near(a.x0,b.x0)&&near(a.x1,b.x1)&&(near(a.z1,b.z0)||near(b.z1,a.z0)))||(near(a.z0,b.z0)&&near(a.z1,b.z1)&&(near(a.x1,b.x0)||near(b.x1,a.x0)))){
      rs[i]={x0:Math.min(a.x0,b.x0),x1:Math.max(a.x1,b.x1),z0:Math.min(a.z0,b.z0),z1:Math.max(a.z1,b.z1)};rs.splice(j,1);merged=true;break outer;
    }
  }}return rs;
}
const finding = (code:string, subject:string, message:string):Finding => ({stage:5,code,subject,message});

/** Measured reservations, not designer-supplied coordinates. Full crown envelopes are used for palms. */
export function siteMeasurements(spec:HouseSpec) {
  const building=compileHouse(spec,4), v=spec.exterior.verandas.find(v=>v.side==='s');
  const veranda=v && verandaRect(spec,v.id), court=siteObstacles(spec).find(o=>o.id==='entrance-court')?.rect;
  const main=spec.exterior.doors.find(d=>d.id===spec.exterior.entrance.door);
  const doorRoutes=spec.exterior.doors.filter(d=>d.side==='s').flatMap(d=>{
    const r=allRooms(spec).find(r=>r.id===d.room); if(!r || r.level!==0)return [];
    const wall=building.scene.elements.find(e=>e.id.startsWith(`w-${r.id}-s-`)&&e.opening&&!e.opening.glazed);
    if(!wall)return [];
    const x=wall.at[0]+(wall.opening?.x??0), edge=blockRect(spec.blocks.find(b=>b.id===r.block)!).z1;
    return [{id:d.id,rect:{x0:x-d.width/2-.3,x1:x+d.width/2+.3,z0:edge,z1:edge+(r.block===v?.block?4.5:3.0)}}];
  });
  const site={x0:-spec.site.width/2,x1:spec.site.width/2,z0:-spec.site.depth/2,z1:spec.site.depth/2};
  return {building,veranda,court,main,doorRoutes,site,remainingElements:elementCap(spec)-building.scene.elements.length,
    southDepth:veranda?site.z1-veranda.z1:0, poolAssemblyElements:14, legacyPalmElements:4, compactPalmElements:1};
}

/** Finite, auditable placements. Unsupported compositions return findings, never silently remove architecture. */
export function deriveSite(base:HouseSpec,input:unknown):{spec:HouseSpec;findings:Finding[];adjustments:string[]} {
  const parsed=siteDesignSchema.safeParse(input);
  if(!parsed.success)return {spec:base,findings:[finding('site-design-schema','design',parsed.error.message)],adjustments:[]};
  const d=parsed.data, m=siteMeasurements(base), findings:Finding[]=[], adjustments:string[]=[];
  if(!m.veranda||!m.court||m.main?.side!=='n')return {spec:base,findings:[finding('site-orientation','site','This site solver requires a south veranda and north entrance court.')],adjustments};
  if(d.statement.length>900 || d.intentions.length>6 || d.intentions.some(s=>s.length>250))return {spec:base,findings:[finding('site-text-budget','design','Statement must be <=900 chars; at most six intentions <=250 chars each.')],adjustments};
  const vr=m.veranda, court=m.court, dims={intimate:[10,4],generous:[12,4.5],lap:[14,4]}[d.pool.scale];
  const living=allRooms(base).find(r=>r.type==='living'&&r.level===0);
  const cx=d.pool.alignment==='living-axis'&&living?(living.x0+living.x1)/2:(vr.x0+vr.x1)/2;
  const pool={x:snap(cx),z:snap(vr.z1+(d.pool.separation==='close'?.6:1.2)),w:dims[0],d:dims[1],basinDepth:1.4};
  const pf=poolFootprint(pool);
  if(!contains(m.site,pf))findings.push(finding('pool-space','pool','Chosen pool and full coping/deck reservation do not fit; use a smaller scale or closer separation.'));
  const bare=siteObstacles({...base,siteWork:{...base.siteWork,pool}}).filter(o=>o.id!=='pool');
  if(hit(pf,bare.map(o=>o.rect)))findings.push(finding('pool-overlap','pool','Chosen pool reservation crosses retained architecture.'));
  if(findings.length)return {spec:base,findings,adjustments};
  const terrace:R={x0:Math.max(m.site.x0+1,vr.x0-2.2),x1:Math.min(m.site.x1-1,Math.max(...base.blocks.filter(b=>!b.level).map(b=>blockRect(b).x1))+1.8),z0:vr.z0,z1:Math.min(m.site.z1-1,pf.z1+.5)};
  const paths:HouseSpec['siteWork']['paths']=rectDiff(terrace,[...bare.map(o=>o.rect),pf]).map((r,i)=>({id:`terrace-${i+1}`,rect:toRect(r)}));
  const driveway:R=d.arrival.boundary==='north'?{x0:(court.x0+court.x1)/2-2.4,x1:(court.x0+court.x1)/2+2.4,z0:m.site.z0,z1:court.z0}
    :{x0:m.site.x0,x1:court.x0,z0:(court.z0+court.z1)/2-2.4,z1:(court.z0+court.z1)/2+2.4};
  if(hit(driveway,bare.filter(o=>o.id!=='entrance-court').map(o=>o.rect)))return {spec:base,findings:[finding('arrival-space','driveway','Driveway approach crosses retained building geometry.')],adjustments};
  paths.push({id:'arrival-drive',rect:toRect(driveway)});
  // A measured west-side garden walk connects the entrance court, around the pavilion, to the pool terrace.
  const pavilion=base.blocks.find(b=>allRooms({blocks:[b]}).some(r=>r.id===m.main!.room))!;
  const edge=blockRect(pavilion).x0, walkX=edge-1.5;
  const gardenWalk:R={x0:walkX-.75,x1:walkX+.75,z0:court.z1-1.5,z1:vr.z1};
  paths.push({id:'garden-walk',rect:toRect(gardenWalk)});
  paths.push({id:'garden-link',rect:toRect({x0:walkX+.75,x1:terrace.x0,z0:vr.z1-1.5,z1:vr.z1})});
  // Arrival court joins the west walk through a short paved shoulder, clear of the entry wall.
  if(d.arrival.boundary==='north')paths.push({id:'arrival-walk-link',rect:toRect({x0:walkX+.75,x1:court.x0,z0:court.z1-1.5,z1:court.z1})});
  // Different arrival approaches can share the walk shoulder. Keep the exact union without stacked slabs.
  const disjoint:typeof paths=[];
  for(const p of paths){const pieces=rectDiff(fromRect(p.rect),disjoint.map(p=>fromRect(p.rect)));for(const [i,r]of pieces.entries())disjoint.push({id:i?`${p.id}-${i+1}`:p.id,rect:toRect(r)});}
  paths.splice(0,paths.length,...disjoint);
  if(paths.length>16)return {spec:base,findings:[finding('site-path-budget','terraces',`${paths.length} hardscape patches exceed the sixteen-path construction budget.`)],adjustments};
  const hard=[...bare.map(o=>o.rect),pf,...paths.map(p=>fromRect(p.rect))];
  const boundaryBands:R[]=[
    {x0:m.site.x0+1,x1:m.site.x0+3.2,z0:-7,z1:m.site.z1-1},
    {x0:m.site.x1-3.2,x1:m.site.x1-1,z0:-7,z1:m.site.z1-1},
    {x0:2,x1:m.site.x1-4,z0:m.site.z0+1,z1:m.site.z0+3},
    {x0:m.site.x0+4,x1:m.site.x1-4,z0:m.site.z1-2.6,z1:m.site.z1-1},
  ];
  const beds=boundaryBands.slice(0,d.planting.beds==='layered-tropical'?4:3).flatMap(r=>rectDiff(r,hard.map(h=>inflate(h,.25)))).filter(r=>(r.x1-r.x0)*(r.z1-r.z0)>2).map((r,i)=>({id:`border-${i+1}`,rect:toRect(r)}));
  const hedges:HouseSpec['siteWork']['hedges']=[{id:'arrival-screen',rect:{x:19,z:-13,w:12,d:1.2}}].filter(h=>!hit(fromRect(h.rect),hard));
  const height=d.planting.stature==='medium'?6.2:7.2;
  const avenue=d.arrival.boundary==='north'?[[-20.3,-20],[-3.8,-20],[-21.4,-12.1],[-3.8,-12.1]]:[[-25,-18],[-25,-4]];
  const garden=[[-24,17],[25.8,17],[-24,d.arrival.boundary==='west'?6:2],[25.8,2],[14,-15],[25.8,-11],[4,-20],d.arrival.boundary==='north'?[-25,-11]:[-10,-20]];
  const count={six:6,eight:8,ten:10}[d.planting.palms];
  const avenueCount=d.arrival.boundary==='west'||d.arrival.character==='garden-court'||count===6?2:4;
  const points=[...avenue.slice(0,avenueCount),...garden.slice(0,count-avenueCount)];
  const trees:HouseSpec['siteWork']['trees']=[];
  for(const [i,[x,z]]of points.entries()){
    const nominal=height+(d.planting.stature==='varied-tall'?(i%3)*.6:0);
    const allHard=[...hard.map(r=>inflate(r,.4)),...trees.map(t=>({x0:t.x-t.height/2,x1:t.x+t.height/2,z0:t.z-t.height/2,z1:t.z+t.height/2}))];
    const maxRadius=Math.min(x-m.site.x0,m.site.x1-x,z-m.site.z0,m.site.z1-z,...allHard.map(r=>Math.max(r.x0-x,x-r.x1,r.z0-z,z-r.z1)));
    const h=snap(Math.min(nominal,2*maxRadius-.02)),radius=h/2;
    const r={x0:x-radius,x1:x+radius,z0:z-radius,z1:z+radius};
    if(h<5.5||!contains(m.site,r)||hit(r,allHard)){
      findings.push(finding('palm-clearance',`palm-${i+1}`,`Requested palm composition has insufficient full-crown clearance at its measured slot ${i+1}; choose medium stature/fewer palms or another arrival approach.`));continue;
    }
    if(h<nominal-.02)adjustments.push(`palm-${i+1}: height fitted from ${nominal.toFixed(1)} to ${h.toFixed(2)} m for full-crown clearance.`);
    trees.push({id:`palm-${i+1}`,x,z,height:h,kind:'palm'});
  }
  const lawnPieces=mergeSiteRectangles(rectDiff({x0:m.site.x0+.3,x1:m.site.x1-.3,z0:m.site.z0+.3,z1:m.site.z1-.3},[...hard,...beds.map(b=>fromRect(b.rect)),...hedges.map(h=>fromRect(h.rect))])).filter(r=>(r.x1-r.x0)*(r.z1-r.z0)>.25);
  const groups=new Map<string,R[]>();
  for(const r of lawnPieces){const x=(r.x0+r.x1)/2,z=(r.z0+r.z1)/2;const key=d.planting.lawn==='open-lawn'?'estate':x< -15?'west':x>20?'east':z<0?'arrival':'garden';groups.set(key,[...(groups.get(key)??[]),r]);}
  const lawns=[...groups].map(([key,patches])=>({id:`lawn-${key}`,material:'sage' as const,rect:toRect({x0:Math.min(...patches.map(p=>p.x0)),x1:Math.max(...patches.map(p=>p.x1)),z0:Math.min(...patches.map(p=>p.z0)),z1:Math.max(...patches.map(p=>p.z1))}),patches:patches.map(toRect)}));
  const fixtures:NonNullable<HouseSpec['sitePresentation']>['fixtures']=[];
  const add=(id:string,asset:typeof fixtures[number]['asset'],rect:Rect,height:number,support:string,rotation=0)=>fixtures.push({id,asset,rect,height,support,rotation});
  // Fit the dining grouping between the *actual* garden door reservations, not in front of them.
  let diningX:number|undefined;
  for(let x=vr.x0+2.2;x<=vr.x1-2.2;x+=.2){const r={x0:x-1.8,x1:x+1.8,z0:vr.z0+.5,z1:vr.z1-.6};if(!hit(r,m.doorRoutes.map(d=>d.rect))){diningX=snap(x);break;}}
  if(diningX===undefined)findings.push(finding('dining-clearance','dining','No four-seat dining arrangement clears the fixed veranda door routes.'));
  else{
    const z=(vr.z0+vr.z1)/2;
    add('dining-table','table',{x:diningX,z,w:2.3,d:1},.78,`veranda-${base.exterior.verandas[0].id}-deck`);
    for(let i=0;i<4;i++)add(`dining-chair-${i+1}`,'chair',{x:diningX+(i%2? .7:-.7),z:z+(i<2?-1.05:1.05),w:.65,d:.6},1,`veranda-${base.exterior.verandas[0].id}-deck`,i<2?Math.PI:0);
  }
  const sunbeds=d.terrace.sunbeds==='four'?4:2, startX=pf.x1+1.3;
  for(let i=0;i<sunbeds;i++)add(`sunbed-${i+1}`,'lounger',{x:startX+i*1.45,z:(pf.z0+pf.z1)/2,w:.85,d:2.2},.65,'terrace');
  if(d.terrace.social==='dining-and-lounge'){
    const x=terrace.x1-3,z=vr.z0+2;
    add('garden-sofa','sofa',{x,z,w:3,d:1.15},1.1,'terrace');
    add('garden-coffee-table','coffee-table',{x,z:z+1.65,w:1.3,d:.8},.45,'terrace');
  }
  const lights=d.lighting==='arrival-and-garden'?6:2;
  const lightSlots=[{x:court.x0-.7,z:court.z0+1},{x:court.x1+.7,z:court.z0+1},{x:walkX-1.1,z:1},{x:terrace.x1+.6,z:vr.z1+1},{x:terrace.x0-.6,z:pf.z1-1},{x:terrace.x1+.6,z:pf.z1-1}];
  for(const [i,p]of lightSlots.slice(0,lights).entries())add(`path-light-${i+1}`,'bollard',{...p,w:.22,d:.22},.65,'ground');
  const candidate:HouseSpec={...base,siteWork:{pool,paths,beds,hedges,trees,lawns},sitePresentation:{version:'staged-site-1',design:d,fixtures,routes:[{id:'arrival',from:'site-boundary',to:'entrance-court',width:4.8},{id:'garden',from:'entrance-court',to:'pool',width:1.5}]}};
  findings.push(...siteLayoutIssues(candidate));
  return {spec:findings.length?base:candidate,findings,adjustments};
}

/** Additional independent checks for the richer site: pairwise paved/planting reservations, furniture and crown bounds. */
export function siteLayoutIssues(spec:HouseSpec):Finding[]{
  // staged-site-2 has its own orientation-general checks (siteGeneral.generalSiteIssues).
  if(!spec.sitePresentation||spec.sitePresentation.version==='staged-site-2')return [];
  const out:Finding[]=[],m=siteMeasurements({...spec,sitePresentation:undefined}),s=spec.siteWork;
  const hard=siteObstacles(spec),planted=[...s.beds,...s.hedges].map(b=>({id:b.id,rect:fromRect(b.rect)}));
  const paths=s.paths.map(p=>({id:p.id,rect:fromRect(p.rect)}));
  for(let i=0;i<paths.length;i++)for(const other of paths.slice(i+1))if(overlapArea(paths[i].rect,other.rect)>.01)out.push(finding('paving-overlap',paths[i].id,`Paving overlaps ${other.id}; split it rather than stack slabs.`));
  for(const p of planted)if(hit(p.rect,paths.map(p=>p.rect)))out.push(finding('planting-on-route',p.id,'Planting crosses a paved route.'));
  for(const t of s.trees){const r={x0:t.x-t.height/2,x1:t.x+t.height/2,z0:t.z-t.height/2,z1:t.z+t.height/2};if(!contains(m.site,r)||hit(r,[...hard.map(o=>o.rect),...paths.map(p=>p.rect)]))out.push(finding('crown-clearance',t.id,'Full palm crown must fit inside the site and clear built areas.'));}
  for(const f of spec.sitePresentation.fixtures){
    const r=fromRect(f.rect);
    if(!contains(m.site,r))out.push(finding('fixture-outside',f.id,'Fixture outside property.'));
    const blockers=hard.filter(o=>f.support.startsWith('veranda-')?o.id!==spec.exterior.verandas.find(v=>f.support===`veranda-${v.id}-deck`)?.id:o.id!=='entrance-court').map(o=>o.rect);
    if(hit(r,blockers)||hit(r,planted.map(p=>p.rect))||hit(r,m.doorRoutes.map(d=>d.rect)))out.push(finding('fixture-clearance',f.id,'Fixture blocks architecture, planting or a real door route.'));
    if(f.support!=='ground'&&!f.support.startsWith('veranda-')&&!paths.some(p=>contains(p.rect,r)))out.push(finding('fixture-support',f.id,'Furniture must stand fully on one dry terrace patch.'));
  }
  for(let i=0;i<spec.sitePresentation.fixtures.length;i++)for(const g of spec.sitePresentation.fixtures.slice(i+1))if(overlapArea(fromRect(spec.sitePresentation.fixtures[i].rect),fromRect(g.rect))>.005)out.push(finding('fixture-overlap',spec.sitePresentation.fixtures[i].id,`Fixture overlaps ${g.id}.`));
  for(const l of s.lawns)for(const patch of l.patches??[l.rect])if(hit(fromRect(patch),[...hard.map(o=>o.rect),...paths.map(p=>p.rect),...planted.map(p=>p.rect)]))out.push(finding('lawn-mask',l.id,'A lawn patch covers a reserved building, pool, path or bed.'));
  out.push(...siteDryRouteIssues(spec));
  return out;
}

/** Floor-surface graph: corner contact alone cannot establish a usable outdoor connection. */
export function siteDryRouteIssues(spec:HouseSpec):Finding[]{
  const m=siteMeasurements(spec),p=requirePool(spec.siteWork.pool),pf=poolFootprint(p);
  if(!m.court||!m.veranda)return [finding('dry-route','site','Missing arrival court or veranda.')];
  const surfaces=[{id:'court',rect:m.court},{id:'veranda',rect:m.veranda},...spec.siteWork.paths.map(p=>({id:p.id,rect:fromRect(p.rect)})),
    {id:'pool-near',rect:{x0:pf.x0,x1:pf.x1,z0:p.z,z1:poolWaterNorth(p)}},
    {id:'pool-far',rect:{x0:pf.x0,x1:pf.x1,z0:poolWaterNorth(p)+p.d,z1:pf.z1}},
    {id:'pool-west',rect:{x0:pf.x0,x1:p.x-p.w/2,z0:poolWaterNorth(p),z1:poolWaterNorth(p)+p.d}},
    {id:'pool-east',rect:{x0:p.x+p.w/2,x1:pf.x1,z0:poolWaterNorth(p),z1:poolWaterNorth(p)+p.d}}];
  const near=(a:number,b:number)=>Math.abs(a-b)<.002;
  const connected=(a:R,b:R)=>overlapArea(a,b)>.001||((near(a.x0,b.x1)||near(a.x1,b.x0))&&Math.min(a.z1,b.z1)-Math.max(a.z0,b.z0)>=1-.002)||((near(a.z0,b.z1)||near(a.z1,b.z0))&&Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)>=1-.002);
  const reached=new Set(['court']);let changed=true;
  while(changed){changed=false;for(const a of surfaces)if(!reached.has(a.id)&&surfaces.some(b=>reached.has(b.id)&&connected(a.rect,b.rect))){reached.add(a.id);changed=true;}}
  return surfaces.filter(s=>!reached.has(s.id)).map(s=>finding('dry-route',s.id,'Dry paving is not connected to the arrival court by a shared edge at least 1 m wide; corner contact is insufficient.'));
}
