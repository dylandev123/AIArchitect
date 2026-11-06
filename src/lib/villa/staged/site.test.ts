import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {Output} from 'ai';
import type {ReactElement} from 'react';
import type {BufferGeometry} from 'three';
import {TropicalPalm} from '@/components/scene/tropical-palm';
import {deriveSite,fromRect,siteDryRouteIssues,siteLayoutIssues,siteMeasurements,STAGE4_BASE} from './site';
import {offlineSiteDesign} from './site.fixture';
import {siteAssetSchema,siteDesignSchema,SITE_ASSETS} from './siteContract';
import {siteDesignRequest} from './siteDesigner';
import {strictSchemaIssues} from '../scene/strictSchema';
import {measure} from './pipeline';
import {runEdit} from './edits';
import {saveHouse,loadHouse} from './save';
import {overlapArea} from './layout';

const base=JSON.parse(readFileSync(`${STAGE4_BASE}.checkpoint.json`,'utf8')).spec;
const original=JSON.parse(readFileSync(`${STAGE4_BASE}.scene.json`,'utf8'));
const derived=deriveSite(base,offlineSiteDesign),built=measure(derived.spec,5,4,3);

describe('Stage 5 offline infrastructure on the actual Terra house; landscape fixture is NOT Terra',()=>{
  it('uses a strict coordinate-free design contract and measured immutable-house request',async()=>{
    const wire=(await (Output.object({schema:siteDesignSchema}) as unknown as {responseFormat:Promise<{schema:Record<string,unknown>}>}).responseFormat).schema;
    expect(strictSchemaIssues(wire)).toEqual([]);
    expect(JSON.stringify(wire)).not.toMatch(/"(x|z|cx|cz|at|rect|finishes)"/);
    const req=siteDesignRequest(base);expect(req.system).toContain('immutable');expect(req.prompt).toContain('groundDoorReservations');
    expect(req.prompt).not.toContain(offlineSiteDesign.statement);
    for(const asset of SITE_ASSETS)expect(siteAssetSchema.parse(asset)).toBe(asset);
    for(const bad of ['PALM','palm-extra','palm\n','lawn\npalm','unknown',''])expect(siteAssetSchema.safeParse(bad).success).toBe(false);
  });
  it('preserves every one of 314 actual Stage 4 elements and all source plans, within 400',()=>{
    expect(derived.findings).toEqual([]);expect(built.findings).toEqual([]);
    const scene=built.scene!,after=new Map(scene.elements.map(e=>[e.id,e]));
    for(const e of original.elements)expect(JSON.stringify(after.get(e.id)),e.id).toBe(JSON.stringify(e));
    for(const k of ['blocks','links','stairs','exterior','trim','openSpaces','site','direction']as const)expect(derived.spec[k]).toEqual(base[k]);
    expect(scene.terrain).toBeUndefined();expect(scene.elements).toHaveLength(375);
    expect(siteMeasurements(base).southDepth).toBe(11.5);
  });
  it('preserves all dry reservations, lawn masks and separately editable furniture/palm IDs',()=>{
    const spec=derived.spec;
    expect(siteLayoutIssues(spec)).toEqual([]);
    expect(spec.siteWork.trees).toHaveLength(8);
    expect(built.scene!.elements.filter(e=>e.siteAsset==='palm')).toHaveLength(8);
    expect(built.scene!.elements.filter(e=>e.siteAsset==='chair')).toHaveLength(4);
    expect(built.scene!.elements.filter(e=>e.siteAsset==='lounger')).toHaveLength(4);
    expect(spec.siteWork.lawns.length).toBeLessThanOrEqual(4);
    for(const l of spec.siteWork.lawns)for(const p of l.patches!)for(const q of spec.siteWork.paths)expect(overlapArea(fromRect(p),fromRect(q.rect))).toBeLessThan(.001);
    expect(built.scene!.elements.filter(e=>e.kind==='water')).toHaveLength(1);
  });
  it('rebuilds a saved landscape with its masks and individual identities intact',()=>{
    const saved=saveHouse(derived.spec,built.scene!);expect(JSON.stringify(loadHouse(saved).scene)).toBe(JSON.stringify(built.scene));
    expect(loadHouse(saved).components).toEqual(built.components);
  });
  it('moves one palm through semantic spec edits; rejects an out-of-property move atomically',async()=>{
    const edit=(dx:number)=>runEdit({planner:{label:'OFFLINE explicit operation test; no AI',plan:async()=>({plan:{summary:'Move one palm',ops:[{op:'move-site-item',id:'palm-5',dx,dz:0}]}})},instruction:'Move this palm',spec:derived.spec,scene:built.scene!,components:built.components!,requiredBedrooms:4});
    const accepted=await edit(.2);expect(accepted.accepted).toBe(true);expect(accepted.diff!.changed).toEqual(['tree-palm-5']);
    expect(accepted.diff!.removed).toEqual([]);expect(accepted.diff!.added).toEqual([]);
    const rejected=await edit(-20);expect(rejected.accepted).toBe(false);expect(rejected.spec).toBe(derived.spec);expect(rejected.scene).toBe(built.scene);
  });
  it('bounds the actual feathered-palm meshes by their declared conservative crown envelope',()=>{
    for(const variant of [0,1]){
      const element=TropicalPalm({height:8,variant});
      const meshes=element.props.children as ReactElement<{geometry:BufferGeometry}>[];
      for(const mesh of meshes){const g=mesh.props.geometry;g.computeBoundingBox();const b=g.boundingBox!;
        expect(Math.max(Math.abs(b.min.x),Math.abs(b.max.x),Math.abs(b.min.z),Math.abs(b.max.z))*8/11).toBeLessThanOrEqual(4);
        expect(b.max.y*8/11).toBeLessThanOrEqual(8.8);expect(b.min.y*8/11).toBeGreaterThanOrEqual(-.001);
      }
    }
  });
  it('rejects unsupported/invalid design selections without replacing the last good house',()=>{
    expect(deriveSite(base,{...offlineSiteDesign,pool:{...offlineSiteDesign.pool,scale:'giant'}}).spec).toBe(base);
    expect(deriveSite({...base,site:{width:60,depth:32}},offlineSiteDesign).findings.some(f=>f.code==='pool-space')).toBe(true);
    expect(deriveSite({...base,exterior:{...base.exterior,verandas:[]}},offlineSiteDesign).findings[0].code).toBe('site-orientation');
  });
  it('rejects the demonstrated corner-only garden-walk connection',()=>{
    const spec=derived.spec;
    const broken={...spec,siteWork:{...spec.siteWork,paths:spec.siteWork.paths.map(p=>p.id==='garden-walk'?{...p,rect:{...p.rect,z:p.rect.z+.75,d:p.rect.d-1.5}}:p)}};
    expect(siteDryRouteIssues(spec)).toEqual([]);
    expect(siteDryRouteIssues(broken).some(f=>f.code==='dry-route'&&f.subject==='veranda')).toBe(true);
  });
  it('checks pool, alignment and arrival variations rather than only the preview fixture',()=>{
    let successes=0,failures=0;
    for(const scale of ['intimate','generous','lap']as const)for(const alignment of ['veranda-centre','living-axis']as const)for(const boundary of ['north','west']as const){
      const r=deriveSite(base,{...offlineSiteDesign,pool:{...offlineSiteDesign.pool,scale,alignment},arrival:{...offlineSiteDesign.arrival,boundary}});
      if(r.findings.length){failures++;console.log('Rejected offline variant',scale,alignment,boundary,r.findings);expect(r.spec).toBe(base);continue;}
      const m=measure(r.spec,5,4,3);expect(m.findings,`${scale}/${alignment}/${boundary}`).toEqual([]);expect(m.scene!.elements.length).toBeLessThanOrEqual(400);successes++;
    }
    expect(successes).toBe(12);expect(failures).toBe(0);console.log('Offline site design variation audit:',{successes,failures});
  });
  it('constructs the other planting, seating, route and lighting intents within the measured budget',()=>{
    for(const palms of ['six','eight','ten']as const)for(const character of ['palm-avenue','garden-court']as const)for(const stature of ['medium','varied-tall']as const){
      const r=deriveSite(base,{...offlineSiteDesign,pool:{...offlineSiteDesign.pool,separation:'promenade',water:'deep-jade'},terrace:{finish:'warm-paving',sunbeds:'two',social:'dining'},arrival:{...offlineSiteDesign.arrival,character},planting:{palms,stature,beds:'restrained-tropical',lawn:'open-lawn'},lighting:'arrival-only'});
      expect(r.findings,`${palms}/${character}/${stature}`).toEqual([]);
      const m=measure(r.spec,5,4,3);expect(m.findings).toEqual([]);expect(m.scene!.elements.length).toBeLessThanOrEqual(400);
      expect(r.spec.siteWork.trees).toHaveLength({six:6,eight:8,ten:10}[palms]);expect(r.spec.siteWork.lawns).toHaveLength(1);
    }
  });
  it('fits ten-palm west-approach compositions at the widest pool and terrace settings',()=>{
    for(const character of ['palm-avenue','garden-court']as const)for(const stature of ['medium','varied-tall']as const)for(const alignment of ['veranda-centre','living-axis']as const){
      const r=deriveSite(base,{...offlineSiteDesign,pool:{...offlineSiteDesign.pool,scale:'lap',alignment,separation:'promenade'},arrival:{...offlineSiteDesign.arrival,boundary:'west',character},planting:{...offlineSiteDesign.planting,palms:'ten',stature}});
      expect(r.findings,`${character}/${stature}/${alignment}`).toEqual([]);const m=measure(r.spec,5,4,3);expect(m.findings).toEqual([]);expect(m.scene!.elements.length).toBeLessThanOrEqual(400);
    }
  });
});
