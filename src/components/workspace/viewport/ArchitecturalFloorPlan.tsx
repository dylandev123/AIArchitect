'use client';

import { useMemo, useRef, useState } from 'react';
import type { HouseModel } from '@/lib/house/types';
import type { V3Scene } from '@/lib/v3/scene';
import { deriveArchitecturalPlan } from '@/lib/v3/architecturalPlanning';
import { isV3PlanEvaluation } from '@/lib/v3/architecturalPlanEvaluation';
import { estateEndpoint, type EstateRoute } from '@/lib/v3/routeGeometry';
import { useSceneStore } from '@/store/useSceneStore';

// Node and browser trigonometry may differ below a micrometre. Quantize only
// SVG serialization so curved paths hydrate identically; semantic geometry is untouched.
const coordinate=(v:number)=>Number(v.toFixed(6));
const points=(p:number[][])=>p.map(v=>v.map(coordinate).join(',')).join(' ');
const pathData=(paths:number[][][],closed=false)=>paths.map(p=>`M${p.map(v=>v.map(coordinate).join(',')).join('L')}${closed?'Z':''}`).join('');
const surfaceColor=(category:string)=>category==='pool'||category==='waterway'?'#c6e3e8':category==='landscape'?'#d6e2c8':category==='driveway'?'#d6d0c2':category==='stairs'?'#d5d0c5':'#e8e3d8';
export function ArchitecturalFloorPlan({scene,model,floor,buildingId,readOnly=false}:{scene:V3Scene;model:HouseModel|null;floor:number|null;buildingId:string|null;readOnly?:boolean}) {
  const evaluation=isV3PlanEvaluation(scene);
  const entrances=evaluation?(scene.estatePlan?.blueprint?.entrances??[]).flatMap(e=>{
    if(floor!==null&&floor!==e.level)return [];
    const p=estateEndpoint(scene,{from:e.objectId,spatial:{from:{entranceId:e.id}}} as EstateRoute,'from');
    const op=scene.objects.find(o=>o.id===e.objectId)?.composition?.openings?.find(o=>o.id===e.openingId);
    const label=op&&'serves' in op?scene.interior?.rooms.find(r=>r.id===op.serves)?.label:undefined;
    return p?[{id:e.id,label:label??'Entrance',point:p}]:[];
  }):[];
  const drawing=useMemo(()=>deriveArchitecturalPlan(scene,model,floor),[scene,model,floor]);
  const selected=useSceneStore(s=>s.selectedKey),select=useSceneStore(s=>s.selectKey);
  const [navigation,setNavigation]=useState({zoom:1,x:0,z:0});
  const drag=useRef<{x:number;y:number;ox:number;oz:number;moved:boolean}|null>(null);
  const focus=drawing.buildings.find(b=>b.id===buildingId);
  const boundary=focus?.polygon??[[-scene.site.width/2,-scene.site.depth/2],[scene.site.width/2,scene.site.depth/2]];
  const minX=Math.min(...boundary.map(p=>p[0])),maxX=Math.max(...boundary.map(p=>p[0])),minZ=Math.min(...boundary.map(p=>p[1])),maxZ=Math.max(...boundary.map(p=>p[1]));
  const pad=focus?3:7,width=(maxX-minX+pad*2)/navigation.zoom,depth=(maxZ-minZ+pad*2)/navigation.zoom;
  const x=(minX+maxX-width)/2+navigation.x,z=(minZ+maxZ-depth)/2+navigation.z;
  const font=focus?.65:1.1,stroke=focus?.075:.12,scale=focus?5:10;
  const choose=(id:string)=>{if(!readOnly&&!drag.current?.moved)select(id);};
  const interactive=(id:string)=>({role:'button' as const,tabIndex:readOnly?-1:0,onClick:()=>choose(id),onKeyDown:(e:React.KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(id);}},style:{cursor:readOnly?'default':'pointer'}});
  return <div className="absolute inset-0 bg-[#f6f3eb] text-[#253d3b]" data-testid="architectural-floor-plan">
    <svg role="img" aria-label={floor===null?'Estate master plan':`Architectural floor plan, level ${floor}`} viewBox={`${x} ${z} ${width} ${depth}`} className="h-full w-full touch-none select-none"
      onWheel={e=>setNavigation(n=>({...n,zoom:Math.max(.5,Math.min(8,n.zoom*(e.deltaY<0?1.15:1/1.15)))}))}
      onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY,ox:navigation.x,oz:navigation.z,moved:false};}}
      onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>4)d.moved=true;if(d.moved){e.currentTarget.setPointerCapture(e.pointerId);const bounds=e.currentTarget.getBoundingClientRect(),units=Math.max(width/bounds.width,depth/bounds.height);setNavigation(n=>({...n,x:d.ox-dx*units,z:d.oz-dy*units}));}}}
      onPointerUp={()=>{const d=drag.current;queueMicrotask(()=>{if(drag.current===d)drag.current=null;});}} onPointerCancel={()=>{drag.current=null;}}>
      <title>Coordinated V3 architectural drawing · metres · north −Z</title>
      <defs><pattern id="architectural-plan-grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#c5cbc3" strokeWidth=".025"/></pattern></defs>
      <rect x={-scene.site.width/2} y={-scene.site.depth/2} width={scene.site.width} height={scene.site.depth} fill="url(#architectural-plan-grid)" stroke="#7e8b80" strokeWidth={stroke} strokeDasharray="1 .5"/>
      {drawing.parts.filter(p=>!p.section&&p.category!=='stairs').map(p=><g key={p.id} aria-label={p.owner} {...interactive(p.owner)} fill={selected===p.owner?'#efc99a':surfaceColor(p.category)}><path d={pathData(p.paths,true)}/></g>)}
      {drawing.siteFeatures.map(f=><g key={`feature-label-${f.id}`} pointerEvents="none" aria-label={`Site feature ${f.label}`}><text x={f.centre[0]} y={f.centre[1]+(['terrace','driveway','courtyard'].includes(f.type)?f.depth*.4:font*.9)} textAnchor="middle" fontSize={font*.55} fill="#546b5d">{f.label}</text>{f.type==='fountain'&&<g stroke="#468a9a" strokeWidth={stroke}><circle cx={f.centre[0]} cy={f.centre[1]} r={font*.4} fill="#f6f3eb"/><path d={`M${f.centre[0]-font*.8} ${f.centre[1]}h${font*1.6}m${-font*.8} ${-font*.8}v${font*1.6}`}/></g>}</g>)}
      {drawing.buildings.map(b=><g key={b.id} {...interactive(b.id)} aria-label={b.label}>
        <polygon points={points(b.polygon)} fill={selected===b.id?'#f1dfbe':'#fffdf7'} stroke={selected===b.id?'#c47f3a':'#465b56'} strokeWidth={stroke*1.5}/>
        {floor===null&&<text x={b.polygon.reduce((s,p)=>s+p[0],0)/b.polygon.length} y={b.polygon.reduce((s,p)=>s+p[1],0)/b.polygon.length} textAnchor="middle" fontSize={font} fill="#294a45">{b.label}</text>}
      </g>)}
      {drawing.rooms.map(r=><g key={r.id} {...interactive(r.id)} aria-label={r.label}>
        <polygon points={points(r.polygon)} fill={selected===r.id?'#f1dfbe':/hall|entry|circulation/.test(r.program)?'#e9ede5':'#f3efe5'} fillOpacity=".75" stroke={evaluation?'#899789':'#bdc4b8'} strokeDasharray={evaluation?undefined:'.18 .12'} strokeWidth={stroke*(evaluation?.8:.45)}/>
        <text x={r.centre[0]} y={r.centre[1]-.08} textAnchor="middle" fill="#314d47" fontSize={Math.min(font*.65,r.width/Math.max(6,r.label.length)*1.6)}>{r.label}</text>
        <text x={r.centre[0]} y={r.centre[1]+font*.65} textAnchor="middle" fill="#78827a" fontSize={font*.45}>{r.width.toFixed(1)} × {r.depth.toFixed(1)} m</text>
      </g>)}
      {drawing.parts.filter(p=>!p.section&&p.category==='stairs').map(p=><g key={p.id} {...interactive(p.owner)} fill="#c1c6b8" stroke="#727f6e" strokeWidth={stroke*.5}><path d={pathData(p.paths,true)}/></g>)}
      {evaluation&&floor!==null&&(scene.interior?.circulation??[]).filter(c=>floor>=c.fromLevel&&floor<=c.toLevel).map(c=>{const p=drawing.parts.find(p=>p.id===c.id)?.paths[0];if(!p)return null;return <text key={`reservation-${c.id}`} x={p.reduce((s,v)=>s+v[0],0)/p.length} y={p.reduce((s,v)=>s+v[1],0)/p.length} textAnchor="middle" fontSize={font*.55} fill="#435846" pointerEvents="none">{c.type==='lift'?'LIFT':floor===c.toLevel?'STAIR ↓':'STAIR ↑'}</text>;})}
      {drawing.parts.filter(p=>p.section).map(p=><g key={p.id} aria-label={p.owner} {...interactive(p.owner)} fill="none" stroke={selected===p.owner?'#c47f3a':p.category==='window'?'#4690a0':p.category==='door'?'#9a754c':'#243f3b'} strokeWidth={p.category==='window'?stroke*.8:stroke} strokeLinecap="square"><path d={pathData(p.paths)}/></g>)}
      {entrances.map(e=><g key={e.id} aria-label={`Entrance ${e.id}`} {...interactive(e.id)}><circle cx={e.point[0]} cy={e.point[2]} r={font*.45} fill="#a48657"/><text x={e.point[0]+font*.7} y={e.point[2]} fontSize={font*.5} fill="#785c36">{e.label}</text></g>)}
      {drawing.openings.map(o=><polyline key={o.id} {...interactive(o.id)} aria-label={`Door opening ${o.id}`} points={points(o.segment)} fill="none" stroke={selected===o.id?'#cc833a':'#a48657'} strokeWidth={stroke*1.5} strokeDasharray=".12 .12"/>)}
      {drawing.buildings.filter(b=>!focus||b.id===focus.id).map(b=>{
        const bx=Math.min(...b.polygon.map(p=>p[0])),ex=Math.max(...b.polygon.map(p=>p[0])),bz=Math.min(...b.polygon.map(p=>p[1]));
        return <g key={b.id+'dimension'} fill="#6a7c72" stroke="#94a193" strokeWidth={stroke*.5} pointerEvents="none"><path d={`M${bx} ${bz-.6}v-1.2m0 .5H${ex}m0 .7v-1.2`} fill="none"/><text x={(bx+ex)/2} y={bz-1.5} textAnchor="middle" stroke="none" fontSize={font*.6}>{(ex-bx).toFixed(2)} m</text></g>;
      })}
      <g transform={`translate(${x+width-scale-2} ${z+depth-2})`} stroke="#40594e" fill="#40594e" strokeWidth={stroke} pointerEvents="none"><path d={`M0 -.5V0H${scale}V-.5`} fill="none"/><text x={scale/2} y={-.8} stroke="none" fontSize={font*.65} textAnchor="middle">{scale} m</text></g>
    </svg>
    <div className="pointer-events-none absolute bottom-5 left-5 rounded-md border border-[#d6d8cc] bg-[#faf8f0]/95 px-4 py-3 text-xs shadow-sm">
      <div className="mb-2 font-semibold tracking-widest">{floor===null?'ESTATE MASTER PLAN':`LEVEL ${String(floor).padStart(2,'0')} · ${focus?.label??'ALL BUILDINGS'}`}</div>
      <div className="flex items-end gap-5"><span className="font-semibold">↑ N</span><span>Dimensions in metres · drag to pan</span></div>
      <div className="mt-2 text-[#798379]">{evaluation?'Conceptual zones · gold: entrances · shaded: circulation and outdoor features':'Solid: built walls · dashed: room extent · blue: glazing'}</div>
    </div>
    <div className="absolute bottom-5 right-5 flex gap-1 rounded-lg border border-[#d6d8cc] bg-[#faf8f0] p-1 text-sm shadow-sm">
      <button className="rounded px-3 py-2 hover:bg-[#e4e8db]" aria-label="Zoom out plan" onClick={()=>setNavigation(n=>({...n,zoom:Math.max(.5,n.zoom/1.3)}))}>−</button>
      <button className="rounded px-3 py-2 hover:bg-[#e4e8db]" onClick={()=>setNavigation({zoom:1,x:0,z:0})}>Fit plan</button>
      <button className="rounded px-3 py-2 hover:bg-[#e4e8db]" aria-label="Zoom in plan" onClick={()=>setNavigation(n=>({...n,zoom:Math.min(8,n.zoom*1.3)}))}>+</button>
    </div>
  </div>;
}
