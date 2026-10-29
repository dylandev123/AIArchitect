"use client";
import { VILLA_LIMITS as L } from '@/lib/villa/limits';
import type { CompositionPatch, VillaComposition } from '@/lib/villa/composition';
import { STYLE_RULES } from '@/lib/villa/design';

/** A staged form submits the same atomic patch used by Terra. */
export function CompositionEditor({current,disabled,onApply}:{current:VillaComposition;disabled:boolean;onApply:(patch:CompositionPatch)=>void}) {
  return <form key={JSON.stringify(current)} onSubmit={event=>{
    event.preventDefault();
    const data=new FormData(event.currentTarget), number=(name:string)=>Number(data.get(name));
    onApply({appearance:{exterior:data.get('exterior') as VillaComposition['appearance']['exterior'],roof:data.get('roof') as VillaComposition['appearance']['roof'],glazing:data.get('glazing') as VillaComposition['appearance']['glazing']},
      wings:current.wings.map(w=>({type:'adjust',id:w.id,changes:{
        x:number(`${w.id}-x`),z:number(`${w.id}-z`),width:number(`${w.id}-width`),depth:number(`${w.id}-depth`),
        veranda:number(`${w.id}-veranda`),balcony:number(`${w.id}-balcony`),storeyHeight:number(`${w.id}-height`),storeys:number(`${w.id}-storeys`) as 1|2,
        orientation:number(`${w.id}-orientation`),
        ...(w.roofRise!==undefined?{roofRise:number(`${w.id}-roofRise`)}:{}),
        ...(w.facadeOpenings?{facadeOpenings:w.facadeOpenings.map((f,fi)=>({...f,openings:f.openings.map((o,oi)=>({...o,...Object.fromEntries((['offset','width','sill','height'] as const).map(k=>[k,number(`${w.id}-${fi}-${oi}-${k}`)]))}))}))}:{}),
        ...(w.eave !== undefined ? {eave:number(`${w.id}-eave`)} : {}),
      }})),
      terraces:current.terraces.map(t=>({type:'put',terrace:{...t,x:number(`${t.id}-x`),z:number(`${t.id}-z`),width:number(`${t.id}-width`),depth:number(`${t.id}-depth`),timber:data.get(`${t.id}-timber`)==='on'}})),
      ...(data.get('apply-site') ? {garden:{x:number('site-x'),z:number('site-z'),width:number('site-width'),depth:number('site-depth')}} : {}),
      ...(current.estateLandscape ? {estateLandscape:{...current.estateLandscape,
        routes:current.estateLandscape.routes.map(r=>({...r,width:number(`${r.id}-route-width`),planting:data.get(`${r.id}-planting`) as typeof r.planting,
          points:r.points.map((p,i)=>({x:number(`${r.id}-${i}-x`),z:number(`${r.id}-${i}-z`)}))})),
        ...(current.estateLandscape.court ? {court:{...current.estateLandscape.court,
          x:number('court-x'),z:number('court-z'),width:number('court-width'),depth:number('court-depth'),
          island:data.get('court-island') as 'none'|'planted'|'fountain',islandWidth:number('court-islandWidth'),islandDepth:number('court-islandDepth'),
        }} : {}),
      }} : {}),
    });
  }}>
    <fieldset disabled={disabled}>
      <label>Exterior<select name="exterior" aria-label="Composition exterior" defaultValue={current.appearance.exterior}>{['ivory','sand','limestone','warm-stone'].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Roof<select name="roof" aria-label="Composition roof" defaultValue={current.appearance.roof}>{STYLE_RULES[current.appearance.style].roofs.map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Glazing<select name="glazing" aria-label="Composition glazing" defaultValue={current.appearance.glazing}>{['panoramic','divided'].map(v=><option key={v}>{v}</option>)}</select></label>
      <p>Unspecified wing faces use a generated rhythm. Explicit windows and doors retain individual positions, sizes and frames; single-image dimensions remain estimates.</p>
      {current.wings.map(w=><details key={w.id}><summary>{w.id} · {w.detached?'detached':w.role}</summary>
        {(['x','z','width','depth','veranda','balcony'] as const).map(field=><label key={field}>{field} (m)<input aria-label={`${w.id} ${field}`} name={`${w.id}-${field}`} type="number" step="0.1" defaultValue={w[field]} required /></label>)}
        {w.eave !== undefined && <label>Eave (m)<input aria-label={`${w.id} eave`} name={`${w.id}-eave`} type="number" min="0.3" max="3" step="0.1" defaultValue={w.eave} required /></label>}
        {w.roofRise!==undefined&&<label>Roof rise above eaves (m)<input aria-label={`${w.id} roof rise`} name={`${w.id}-roofRise`} type="number" min="0.5" max="8" step="0.1" defaultValue={w.roofRise} required/></label>}
        {w.facadeOpenings?.map((f,fi)=><details key={`${f.face}-${f.level}`}><summary>{f.face} · storey {f.level+1} · individual openings</summary>{f.openings.map((o,oi)=><div key={o.id}><p>{o.id} · {o.kind} · {o.frame} frame</p>{(['offset','width','sill','height'] as const).map(k=><label key={k}>{k} (m)<input aria-label={`${w.id} ${o.id} ${k}`} name={`${w.id}-${fi}-${oi}-${k}`} type="number" step="0.05" defaultValue={o[k]} required/></label>)}</div>)}</details>)}
        <label>Storey height (m)<input aria-label={`${w.id} height`} name={`${w.id}-height`} type="number" min="3" max={L.storeyHeight} step="0.1" defaultValue={w.storeyHeight} required /></label>
        <label>Storeys<select name={`${w.id}-storeys`} defaultValue={w.storeys}><option value="1">1</option><option value="2">2</option></select></label>
        <label>Faces<select aria-label={`${w.id} orientation`} name={`${w.id}-orientation`} defaultValue={w.orientation}>{(w.detached ? Array.from({length:24},(_,i)=>[i*15,`${i*15}°`]) : [[0,'South'],[90,'East'],[180,'North'],[270,'West']]).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      </details>)}
      {current.terraces.map(t=><details key={t.id}><summary>{t.id} · {t.kind}</summary>{(['x','z','width','depth'] as const).map(field=><label key={field}>{field} (m)<input aria-label={`${t.id} ${field}`} name={`${t.id}-${field}`} type="number" min={(field==='width'||field==='depth') ? .6 : undefined} step="0.1" defaultValue={t[field]} required /></label>)}<label><input name={`${t.id}-timber`} aria-label={`${t.id} timber`} type="checkbox" defaultChecked={t.timber} /> Timber paving</label></details>)}
      {current.estateLandscape && <details><summary>Arrival and garden circulation</summary>
        <p>Stage the arrival, walks and planting together. Apply to check the full property.</p>
        {current.estateLandscape.court && <details><summary>Motor court</summary>
          {(['x','z','width','depth','islandWidth','islandDepth'] as const).map(field=><label key={field}>{field.replace('island','Island ')} (m)<input aria-label={`Court ${field}`} name={`court-${field}`} type="number" step="0.1" defaultValue={current.estateLandscape!.court![field]} required /></label>)}
          <label>Centre<select aria-label="Court centre" name="court-island" defaultValue={current.estateLandscape.court.island}>{['none','planted','fountain'].map(v=><option key={v}>{v}</option>)}</select></label>
        </details>}
        {current.estateLandscape.routes.map(r=><details key={r.id}><summary>{r.id} · {r.kind==='drive'?'driveway':'walk'}</summary>
          <label>Clear width (m)<input aria-label={`${r.id} route width`} name={`${r.id}-route-width`} type="number" step="0.1" min={r.kind==='drive'?3.5:.9} max={r.kind==='drive'?L.driveWidth:L.walkWidth} defaultValue={r.width} required /></label>
          <label>Planting<select aria-label={`${r.id} planting`} name={`${r.id}-planting`} defaultValue={r.planting}>{['avenue','border','none'].map(v=><option key={v}>{v}</option>)}</select></label>
          {r.points.map((p,i)=><div key={i}><p>Path control {i+1}</p>{(['x','z'] as const).map(field=><label key={field}>{field} (m)<input aria-label={`${r.id} control ${i+1} ${field}`} name={`${r.id}-${i}-${field}`} type="number" step="0.1" defaultValue={p[field]} required /></label>)}</div>)}
        </details>)}
      </details>}
      {current.estateLandscape && <details><summary>Site boundary</summary><p>{current.siteMode==='derived'?'Garden fits the full composition automatically.':'The current site boundary is fixed.'}</p>
        <label><input name="apply-site" aria-label="Set fixed boundary" type="checkbox" /> Set a fixed site boundary</label>
        {(['x','z','width','depth'] as const).map(field=><label key={field}>{field} (m)<input aria-label={`Boundary ${field}`} name={`site-${field}`} type="number" step="any" defaultValue={current.garden[field]} required /></label>)}
      </details>}
      <button type="submit">Apply composition changes</button>
    </fieldset>
  </form>;
}
