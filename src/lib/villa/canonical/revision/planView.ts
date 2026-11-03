/** Architectural planning drawing of an authored plan, one panel per level, in plan-local metres (+Z up the page).
 * Every shape is computed from the authored placements (the same resolution the compiler uses); nothing is
 * idealised or corrected. Conflicts are marked where they are measured, never repaired. */
import type {ArchitecturalPlan,Rect} from '../plan';
import {analysePlan,overlap,type PlanAnalysis} from './analysis';
import {placePortals,pointOnEdge} from '../coordination';
import {composedView} from '../composition';
const esc=(s:string)=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
const f1=(n:number)=>Number(n.toFixed(1));
const PALETTE=['#e8dcc0','#dfe9d8','#d6dfee','#eed9d9','#e5f0f0','#efe3f1','#f3ead2','#dde6e0','#e9dfd3','#d9e4ef'];
export type ViewShape={kind:'room'|'ghost'|'pool'|'lawn'|'bed'|'roof'|'overlap'|'roof-conflict'|'opening'|'stair'|'route'|'site';id:string;level?:string;x:number;z:number;width:number;depth:number;flags?:string[];data?:Record<string,string|number>};
export type PlanView={levels:{id:string;title:string;shapes:ViewShape[]}[];scale:number;legend:string[]};
/** Shapes in plan-local metres. Tests and the SVG are both derived from this, so the drawing cannot drift from the geometry. */
export function planViewModel(plan:ArchitecturalPlan,analysis:PlanAnalysis=analysePlan(plan)):PlanView{
 const rects=analysis.rects,errors=analysis.findings.filter(f=>f.severity==='error');
 const levels=plan.levels.map(l=>{
  const shapes:ViewShape[]=[],here=plan.spaces.filter(s=>s.level===l.id&&rects[s.id]);
  const s0=analysis.site;shapes.push({kind:'site',id:'site',x:s0.x0,z:s0.z0,width:s0.width,depth:s0.depth});
  // Spaces on other levels as faint outlines so stacking is legible.
  for(const s of plan.spaces)if(s.level!==l.id&&rects[s.id]&&!s.outdoor)shapes.push({kind:'ghost',id:s.id,level:s.level,...rects[s.id]});
  const bad=new Set(errors.flatMap(f=>f.stage==='volumes'||f.stage==='access'||f.stage==='site'?f.id.split('/'):[]));
  const dark=new Set(analysis.access.unreachable);
  for(const s of here){const r=rects[s.id],m=analysis.rooms.find(x=>x.id===s.id)!;shapes.push({kind:'room',id:s.id,level:l.id,...r,flags:[...(bad.has(s.id)?['conflict']:[]),...(dark.has(s.id)?['unreachable']:[]),...(s.outdoor?['outdoor']:[])],data:{mass:s.mass,use:s.use,height:m.envelopeHeight??-1,area:m.areaM2}});}
  // Measured overlaps (volume collisions) between rooms at any level whose vertical extents meet.
  for(const f of errors.filter(f=>f.stage==='volumes')){const [a,b]=f.id.split('/'),sa=plan.spaces.find(s=>s.id===a),sb=plan.spaces.find(s=>s.id===b);if(!sa||!sb||(sa.level!==l.id&&sb.level!==l.id))continue;const ov=overlap(rects[a],rects[b]);if(ov)shapes.push({kind:'overlap',id:f.id,...ov});}
  if(l.above===null){
   for(const [id,r] of Object.entries(analysis.siteRects)){const pool=plan.pools.some(p=>p.id===id);shapes.push({kind:pool?'pool':plan.landscape.find(x=>x.id===id)!.kind,id,...r,flags:errors.some(f=>f.stage==='site'&&f.id.split('/').includes(id))?['conflict']:[]});}
  }
  // Roof extents including eaves, at the level of the roofed space; conflicting eave overlaps filled.
  const view=composedView(plan,new Map(Object.entries(rects)));
  // A declared roof span is one roof over its combined footprint (the compiler's expansion), drawn once from its lead room.
  const sections=view.roofs.flatMap(r=>{const s=plan.spaces.find(x=>x.id===r.space),span=view.spans.find(q=>q.lead===r.space),rect=span?span.rect:rects[r.space];if(!s||!rect||s.level!==l.id)return [];const e=(r.overhang??0)+(r.form!=='flat'?.1:0);return [{id:r.space,rect:{x:rect.x-e,z:rect.z-e,width:rect.width+2*e,depth:rect.depth+2*e},form:r.form,overhang:r.overhang??0}];});
  for(const r of sections)shapes.push({kind:'roof',id:r.id,level:l.id,...r.rect,data:{form:r.form,overhang:r.overhang}});
  for(let i=0;i<sections.length;i++)for(let j=i+1;j<sections.length;j++){const ov=overlap(sections[i].rect,sections[j].rect);if(ov)shapes.push({kind:'roof-conflict',id:`${sections[i].id}/${sections[j].id}`,...ov});}
  // Openings drawn on the wall edge they sit on (authored, or derived from the declared relationship), at the compiler's own offset.
  const placed=placePortals(plan,rects);
  for(const p of plan.portals){const s=plan.spaces.find(x=>x.id===p.host.space),r=rects[p.host.space];if(!s||!r||s.level!==l.id)continue;const pl=placed.get(p.id);if(!pl||pl.problem!==undefined)continue;const side=pl.side,at=pointOnEdge(r,side,pl.centre),horiz=side==='south'||side==='north';
   const target=rects[p.to],touching=!!target&&((side==='south'&&Math.abs(target.z+target.depth-r.z)<1e-6)||(side==='north'&&Math.abs(target.z-(r.z+r.depth))<1e-6)||(side==='east'&&Math.abs(target.x-(r.x+r.width))<1e-6)||(side==='west'&&Math.abs(target.x+target.width-r.x)<1e-6));
   const misfit=errors.some(f=>f.stage==='openings'&&f.id.split('/').includes(p.id))||(p.to!=='exterior'&&!touching);
   shapes.push({kind:'opening',id:p.id,level:l.id,x:horiz?at[0]-p.width/2:at[0]-.12,z:horiz?at[1]-.12:at[1]-p.width/2,width:horiz?p.width:.24,depth:horiz?.24:p.width,flags:misfit?['misfit']:[],data:{mode:p.mode,to:p.to,side,w:p.width,sill:p.sill??0}});}
  for(const st of plan.stairs){const low=plan.spaces.find(s=>s.id===st.lower),up=plan.spaces.find(s=>s.id===st.upper),r=rects[st.lower];if(!low||!up||!r)continue;if(low.level!==l.id&&up.level!==l.id)continue;
   shapes.push({kind:'stair',id:st.id,level:l.id,x:r.x+r.width/2-st.width/2,z:r.z+st.landing+.1,width:st.width,depth:st.run,data:{lower:st.lower,upper:st.upper,direction:low.level===l.id?'up':'down'}});}
  // Circulation: centre-to-centre through each door/passage on this level, from the arrival.
  for(const p of plan.portals){if(p.mode==='window'||p.to==='exterior')continue;const a=rects[p.host.space],b=rects[p.to];if(!a||!b)continue;const sa=plan.spaces.find(x=>x.id===p.host.space)!,sb=plan.spaces.find(x=>x.id===p.to)!;if(sa.level!==l.id||sb.level!==l.id)continue;
   const ca:[number,number]=[a.x+a.width/2,a.z+a.depth/2],cb:[number,number]=[b.x+b.width/2,b.z+b.depth/2];shapes.push({kind:'route',id:p.id,level:l.id,x:ca[0],z:ca[1],width:cb[0]-ca[0],depth:cb[1]-ca[1]});}
  return {id:l.id,title:`Level ${l.id} · floor ${f1(analysis.levels.find(x=>x.id===l.id)!.floorDatum)} m`,shapes};
 });
 return {levels,scale:14,legend:['Rooms coloured by mass','Dashed orange: roof extent with eaves','Red fill: measured overlap','Red hatch: eave/roof overlap','Brown bar door · green passage · blue window · red ring: opening not on a shared wall','Thin green line: door/passage circulation','Hatched room: not reachable from arrival','Dotted outline: ghost of rooms on other levels']};
}
export function renderPlanSvg(plan:ArchitecturalPlan,analysis:PlanAnalysis=analysePlan(plan),options:{title?:string;caption?:string}={}):string{
 const view=planViewModel(plan,analysis),S=view.scale,pad=34;
 const all=[...Object.values(analysis.rects),...Object.values(analysis.siteRects),{x:analysis.site.x0,z:analysis.site.z0,width:analysis.site.width,depth:analysis.site.depth}];
 const x0=Math.min(...all.map(r=>r.x))-2,x1=Math.max(...all.map(r=>r.x+r.width))+2,z0=Math.min(...all.map(r=>r.z))-2,z1=Math.max(...all.map(r=>r.z+r.depth))+2;
 const pw=(x1-x0)*S,ph=(z1-z0)*S,head=54,foot=118,n=view.levels.length,cols=Math.min(n,2),rowsN=Math.ceil(n/cols);
 const W=cols*(pw+pad)+pad,H=head+rowsN*(ph+pad+22)+foot;
 const masses=[...new Set(plan.spaces.map(s=>s.mass))],colour=(m:string)=>PALETTE[masses.indexOf(m)%PALETTE.length];
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica,Arial,sans-serif" data-plan="${esc(plan.id)}"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#c00" stroke-width="1.5"/></pattern><pattern id="dark" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#c00" fill-opacity=".5"/></pattern></defs><rect width="100%" height="100%" fill="#fff"/>`;
 svg+=`<text x="${pad}" y="22" font-size="15" font-weight="bold">${esc(options.title??plan.id)}</text><text x="${pad}" y="40" font-size="10.5" fill="#555">${esc(plan.thesis.slice(0,170))}${plan.thesis.length>170?'…':''}</text>`;
 view.levels.forEach((lv,i)=>{
  const ox=pad+(i%cols)*(pw+pad),oy=head+Math.floor(i/cols)*(ph+pad+22)+16;
  const X=(x:number)=>f1(ox+(x-x0)*S),Y=(z:number)=>f1(oy+(z1-z)*S);
  svg+=`<g data-level="${esc(lv.id)}"><text x="${ox}" y="${oy-5}" font-size="12" font-weight="bold">${esc(lv.title)}</text><rect x="${ox}" y="${oy}" width="${pw}" height="${ph}" fill="#fafafa" stroke="#ddd"/>`;
  const box=(sh:ViewShape,attrs:string,label?:string)=>`<rect data-${sh.kind}="${esc(sh.id)}" data-x="${f1(sh.x)}" data-z="${f1(sh.z)}" data-w="${f1(sh.width)}" data-d="${f1(sh.depth)}" x="${X(sh.x)}" y="${Y(sh.z+sh.depth)}" width="${f1(sh.width*S)}" height="${f1(sh.depth*S)}" ${attrs}/>${label??''}`;
  for(const sh of lv.shapes){
   if(sh.kind==='site')svg+=box(sh,'fill="none" stroke="#888" stroke-dasharray="8 5"')+`<text x="${X(sh.x)+4}" y="${Y(sh.z+sh.depth)+12}" font-size="9.5" fill="#888">site ${f1(sh.width)}×${f1(sh.depth)} m (centred on room cells)</text>`;
   if(sh.kind==='pool')svg+=box(sh,`fill="#bfe0ee" stroke="${sh.flags?.length?'#c00':'#5a8'}" stroke-width="${sh.flags?.length?2.5:1}"`)+`<text x="${X(sh.x)+3}" y="${Y(sh.z+sh.depth)+11}" font-size="9">${esc(sh.id)} ${f1(sh.width)}×${f1(sh.depth)}</text>`;
   if(sh.kind==='lawn'||sh.kind==='bed')svg+=box(sh,`fill="${sh.kind==='lawn'?'#e3efd6':'#eadcc8'}" stroke="${sh.flags?.length?'#c00':'#9a8'}" stroke-width="${sh.flags?.length?2.5:1}"`)+`<text x="${X(sh.x)+3}" y="${Y(sh.z+sh.depth)+11}" font-size="9">${esc(sh.id)} ${f1(sh.width)}×${f1(sh.depth)}</text>`;
   if(sh.kind==='ghost')svg+=box(sh,'fill="none" stroke="#aaa" stroke-dasharray="2 3"');
  }
  for(const sh of lv.shapes.filter(s=>s.kind==='room')){
   const room=plan.spaces.find(s=>s.id===sh.id)!,flags=sh.flags??[];
   svg+=box(sh,`fill="${room.outdoor?'#f2f6ee':colour(room.mass)}" fill-opacity="${room.outdoor?.6:.9}" stroke="${flags.includes('conflict')||flags.includes('unreachable')?'#c00':'#333'}" stroke-width="${flags.includes('conflict')?2.5:1.2}" ${room.outdoor?'stroke-dasharray="4 3"':''}`);
   if(flags.includes('unreachable'))svg+=`<rect x="${X(sh.x)}" y="${Y(sh.z+sh.depth)}" width="${f1(sh.width*S)}" height="${f1(sh.depth*S)}" fill="url(#dark)"/>`;
   const h=sh.data!.height as number;
   if(sh.width*S>38&&sh.depth*S>26)svg+=`<text x="${f1(X(sh.x)+3)}" y="${f1(Y(sh.z+sh.depth)+10)}" font-size="8.5" font-weight="bold" fill="#222">${esc(sh.id)}</text><text x="${f1(X(sh.x)+3)}" y="${f1(Y(sh.z+sh.depth)+20)}" font-size="8" fill="#444">${f1(sh.width)}×${f1(sh.depth)} m${h>0?` · h ${f1(h)}`:''}</text>`;
   else svg+=`<text x="${f1(X(sh.x)+1)}" y="${f1(Y(sh.z+sh.depth)+9)}" font-size="6.5" fill="#222">${esc(sh.id)}</text>`;
  }
  for(const sh of lv.shapes.filter(s=>s.kind==='roof'))svg+=box(sh,'fill="none" stroke="#e08a00" stroke-width="1" stroke-dasharray="5 3"');
  for(const sh of lv.shapes.filter(s=>s.kind==='roof-conflict'))svg+=box(sh,'fill="url(#hatch)" fill-opacity=".8"');
  for(const sh of lv.shapes.filter(s=>s.kind==='overlap'))svg+=box(sh,'fill="#e00" fill-opacity=".6" stroke="#900"');
  for(const sh of lv.shapes.filter(s=>s.kind==='stair')){const rows=Math.max(3,Math.round(sh.depth/.28));svg+=box(sh,'fill="#fff" fill-opacity=".7" stroke="#555"');for(let k=1;k<rows;k++)svg+=`<line x1="${X(sh.x)}" x2="${X(sh.x+sh.width)}" y1="${Y(sh.z+sh.depth*k/rows)}" y2="${Y(sh.z+sh.depth*k/rows)}" stroke="#777" stroke-width=".6"/>`;svg+=`<text x="${X(sh.x)}" y="${Y(sh.z+sh.depth)-2}" font-size="8" fill="#333">${sh.data!.direction==='up'?'UP':'DN'} ${esc(sh.id)}</text>`;}
  for(const sh of lv.shapes.filter(s=>s.kind==='route'))svg+=`<line data-route="${esc(sh.id)}" x1="${X(sh.x)}" y1="${Y(sh.z)}" x2="${X(sh.x+sh.width)}" y2="${Y(sh.z+sh.depth)}" stroke="#2a8" stroke-width=".9" stroke-opacity=".7"/>`;
  for(const sh of lv.shapes.filter(s=>s.kind==='opening')){
   const mode=sh.data!.mode as string,bad=sh.flags?.includes('misfit'),col=bad?'#e00':mode==='window'?'#27c':mode==='door'?'#852':'#2a5';
   svg+=box(sh,`fill="${col}"`)+(bad?`<circle cx="${f1(X(sh.x+sh.width/2))}" cy="${f1(Y(sh.z+sh.depth/2))}" r="6" fill="none" stroke="#e00" stroke-width="1.5"/><text x="${f1(X(sh.x+sh.width/2)+7)}" y="${f1(Y(sh.z+sh.depth/2)-5)}" font-size="7.5" fill="#c00">${esc(sh.id)}</text>`:'');
  }
  // Arrival marker, overall dimensions and north.
  const arrival=analysis.rects[plan.arrival];
  if(arrival&&plan.spaces.find(s=>s.id===plan.arrival)?.level===lv.id)svg+=`<text x="${f1(X(arrival.x+arrival.width/2))}" y="${f1(Y(arrival.z+arrival.depth/2)+4)}" font-size="16" text-anchor="middle" fill="#a50">★</text>`;
  const b=analysis.building;
  const dy=oy+ph-26,dx=ox+pw-16;
  svg+=`<line x1="${X(b.x0)}" x2="${X(b.x1)}" y1="${dy}" y2="${dy}" stroke="#333" stroke-width=".8"/><line x1="${X(b.x0)}" x2="${X(b.x0)}" y1="${dy-4}" y2="${dy+4}" stroke="#333"/><line x1="${X(b.x1)}" x2="${X(b.x1)}" y1="${dy-4}" y2="${dy+4}" stroke="#333"/><text x="${f1((X(b.x0)+X(b.x1))/2)}" y="${dy-4}" font-size="10" text-anchor="middle">building ${f1(b.width)} m</text><line x1="${dx}" x2="${dx}" y1="${Y(b.z0)}" y2="${Y(b.z1)}" stroke="#333" stroke-width=".8"/><line x1="${dx-4}" x2="${dx+4}" y1="${Y(b.z0)}" y2="${Y(b.z0)}" stroke="#333"/><line x1="${dx-4}" x2="${dx+4}" y1="${Y(b.z1)}" y2="${Y(b.z1)}" stroke="#333"/><text transform="translate(${dx-4} ${f1((Y(b.z0)+Y(b.z1))/2)}) rotate(-90)" font-size="10" text-anchor="middle">building ${f1(b.depth)} m</text>`;
  svg+=`<g transform="translate(${ox+pw-26} ${oy+26})"><path d="M0 -16 L6 6 L0 2 L-6 6 Z" fill="#222"/><text y="-19" font-size="10" text-anchor="middle">N (+Z)</text></g><line x1="${ox+8}" x2="${ox+8+10*S}" y1="${oy+ph-10}" y2="${oy+ph-10}" stroke="#222" stroke-width="2"/><text x="${ox+8}" y="${oy+ph-14}" font-size="9">10 m</text></g>`;
 });
 const fy=H-foot+12;
 svg+=`<rect x="0" y="${fy-12}" width="${W}" height="${foot}" fill="#f5f5f2"/>`;
 view.legend.forEach((t,i)=>{svg+=`<text x="${pad+(i%2)*Math.max(300,W/2-pad)}" y="${fy+Math.floor(i/2)*13}" font-size="9.5" fill="#333">${esc(t)}</text>`;});
 svg+=`<text x="${pad}" y="${fy+62}" font-size="10" font-weight="bold" fill="#7a5a00">${esc(options.caption??'PLANNING DRAWING derived from authored placements — not accepted construction. Plan-local metres, +Z north, root space at origin; orientation applies after.')}</text>`;
 svg+=`<text x="${pad}" y="${fy+78}" font-size="9.5" fill="#555">Levels: ${esc(analysis.levels.map(l=>`${l.id} ${l.floorDatum} m`).join(', '))} · Findings: ${analysis.errorCount} errors in ${analysis.groups.length} cause groups · Masses: ${esc(masses.map(m=>m).join(', '))}</text></svg>`;
 return svg;
}
/** PNG for providers with image input. sharp is loaded lazily so the library stays usable without it. */
export async function renderPlanPng(plan:ArchitecturalPlan,analysis?:PlanAnalysis,options?:{title?:string;caption?:string}){
 const sharp=(await import('sharp')).default,svg=renderPlanSvg(plan,analysis,options);
 return {svg,png:await sharp(Buffer.from(svg)).png().toBuffer()};
}
export type {Rect};
