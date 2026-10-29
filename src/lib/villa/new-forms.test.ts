import { describe, expect, it } from 'vitest';
import retained from './__tests__/fixtures/garden-boundary.response.json';
import { COMPOSITION_EXAMPLES } from './composition-examples';
import { buildComposition, validateComposition, executeCompositionPatch, wingEnvelope } from './composition';
import { resolveVillaResult, villaProviderOutputSchema } from './terra';
import { experimentalExamples } from './experimental/examples';
import { ellipseArc, ellipsePlate } from './experimental/pavilion-geometry';
import { pavilionBounds, pavilionEntry, pavilionPlacementSchema } from './experimental/curved-pavilion';
import { approvedComponents } from './component-record';
import { EXPERIMENTAL_COMPONENTS } from './experimental/catalog';


describe('fictional-site derivation and experimental reusable geometry (offline)',()=>{
  it('replays the exact latest failure without changing or dropping any architectural feature',()=>{
    expect(()=>validateComposition({...retained.changes,character:'Offline retained estate'})).toThrow('wings.main-villa: Roof/veranda extends outside the garden');
    const original=structuredClone(retained);
    const result=resolveVillaResult({mode:'generate',prompt:'Fictional estate, no site restriction'},retained);
    if(!('version' in result.config)) throw Error('Expected composition');
    const c=result.config,built=buildComposition(c);
    for(const key of ['wings','connections','terraces','pool','appearance'] as const) expect(c[key]).toEqual(retained.changes[key]);
    expect(c.garden).toEqual({x:-1.0749999999999993,z:-.45000000000000107,width:54.15,depth:53.3});
    expect(c.siteMode).toBe('derived');expect(built.wings).toHaveLength(6);
    for(const w of built.wings) {
      const b=wingEnvelope(w,c);
      expect(b.left).toBeGreaterThanOrEqual(c.garden.x-c.garden.width/2+2-1e-9);
      expect(b.front).toBeLessThanOrEqual(c.garden.z+c.garden.depth/2-2+1e-9);
    }
    expect(retained).toEqual(original);
  });
  it('retains fixed site validation from explicit model intent AND authoritative request data',()=>{
    expect(()=>resolveVillaResult({mode:'generate',prompt:'Explicit fixed site'}, {...retained,changes:{...retained.changes,siteMode:'fixed'}})).toThrow('outside the garden');
    expect(()=>resolveVillaResult({mode:'generate',prompt:'Fixed lot',site:retained.changes.garden},{...retained,changes:{...retained.changes,siteMode:'derived'}})).toThrow('outside the garden');
    const c=COMPOSITION_EXAMPLES[0], site={x:0,z:4,width:50,depth:50};
    expect(resolveVillaResult({mode:'generate',prompt:'Fixed lot',site},{changes:c,summary:'House',unsupported:[]}).config).toMatchObject({siteMode:'fixed',garden:site});
  });
  it('recomputes only derived sites on edits; fixed and legacy gardens stay strict',()=>{
    const current=validateComposition({...COMPOSITION_EXAMPLES[0],siteMode:'derived'});
    const snapshot=structuredClone(current);
    const changed=executeCompositionPatch(current,{wings:[{type:'adjust',id:'main',changes:{x:28}}]});
    expect(changed.garden.width).toBeGreaterThan(current.garden.width);
    expect(current).toEqual(snapshot);expect(changed.pool).toEqual(current.pool);
    expect(()=>executeCompositionPatch({...current,siteMode:'fixed'},{wings:[{type:'adjust',id:'main',changes:{x:28}}]})).toThrow('outside the garden');
    const fixed=executeCompositionPatch(current,{garden:{x:0,z:4,width:60,depth:60}});
    expect(fixed.siteMode).toBe('fixed');expect(fixed.garden.width).toBe(60);
    expect(()=>validateComposition({...current,siteMode:undefined,garden:{x:0,z:0,width:12,depth:12}})).toThrow('outside the garden');
    expect(()=>executeCompositionPatch(current,{pool:{z:-5},terraces:[{type:'remove',id:'garden-room'}]})).toThrow('intersects');
  });
  it('includes terraces, rotated roofs and disabled pools deterministically and idempotently',()=>{
    const c=validateComposition({...COMPOSITION_EXAMPLES[0],siteMode:'derived',pool:null,terraces:[{id:'far-deck',kind:'terrace',x:28,z:29,width:14,depth:12,timber:true}]});
    expect(c.garden.x+c.garden.width/2).toBeGreaterThanOrEqual(37);
    expect(c.garden.z+c.garden.depth/2).toBeGreaterThanOrEqual(37);
    expect(validateComposition(c)).toEqual(c);expect(buildComposition(c).pool.enabled).toBe(false);
  });
  it('reuses the same builder at different dimensions/yaws in two validated compositions',()=>{
    const examples=experimentalExamples();
    expect(examples.map(c=>c.experimentalForms![0].builder)).toEqual(['curved-pavilion@1','curved-pavilion@1']);
    expect(examples[0].experimentalForms![0].width).not.toBe(examples[1].experimentalForms![0].width);
    const p=examples[0].experimentalForms![0];
    for(const orientation of [0,25,90,105,180,270,359]) {
      const rotated={...p,orientation},b=pavilionBounds(rotated),r=orientation*Math.PI/180;
      for(let i=0;i<360;i++) {
        const a=i*Math.PI/180,x=(p.width/2+.65)*Math.sin(a),z=(p.depth/2+.65)*Math.cos(a);
        const wx=p.x+Math.cos(r)*x+Math.sin(r)*z,wz=p.z-Math.sin(r)*x+Math.cos(r)*z;
        expect(wx).toBeGreaterThanOrEqual(b.left-1e-8);expect(wx).toBeLessThanOrEqual(b.right+1e-8);
        expect(wz).toBeGreaterThanOrEqual(b.rear-1e-8);expect(wz).toBeLessThanOrEqual(b.front+1e-8);
      }
    }
    expect(pavilionEntry({...p,orientation:90})).toMatchObject({position:[p.x+p.depth/2*Math.sqrt(1-(1.2/(p.width/2))**2),.47,p.z],normal:[1,0,expect.any(Number)]});
    expect(pavilionPlacementSchema.safeParse({...p,width:21}).success).toBe(false);
    expect(pavilionPlacementSchema.safeParse({...p,orientation:NaN}).success).toBe(false);
  });
  it('produces finite genuine curved surfaces across supported dimension limits',()=>{
    for(const [w,d,h] of [[6,5,3],[10,8,4.2]]) {
      for(const vertices of [ellipsePlate(w/2+.65,d/2+.65,.24),ellipseArc(w/2,d/2,.26,h,118,242)]) {
        expect(vertices.length%9).toBe(0);expect(vertices.length).toBeGreaterThan(1000);
        expect(vertices.every(Number.isFinite)).toBe(true);
        expect(new Set(vertices.filter((_,i)=>i%3===0).map(x=>x.toFixed(4))).size).toBeGreaterThan(25);
      }
    }
  });
  it('promotes the reviewed builder while keeping legacy experimental fields out of provider output',()=>{
    expect(approvedComponents(EXPERIMENTAL_COMPONENTS).filter(c=>c.availability!=='local').map(c=>c.reference)).toEqual([{kind:'builder',id:'curved-pavilion@1'},{kind:'builder',id:'estate-landscape@1'},{kind:'builder',id:'rotated-detached-wing@1'},{kind:'builder',id:'footprint-building@1'}]);
    const c={...COMPOSITION_EXAMPLES[0],siteMode:'derived',experimentalForms:experimentalExamples()[0].experimentalForms};
    expect(villaProviderOutputSchema({mode:'generate',prompt:'x'}).safeParse({changes:c,summary:'x',unsupported:[]}).success).toBe(false);
    const original=structuredClone(COMPOSITION_EXAMPLES);
    experimentalExamples();expect(COMPOSITION_EXAMPLES).toEqual(original);
    expect(()=>validateComposition({...c,experimentalForms:c.experimentalForms!.map(p=>({...p,x:0,z:-5}))})).toThrow('clearance');
    expect(()=>validateComposition({...c,siteMode:'fixed',garden:{x:0,z:0,width:24,depth:36}})).toThrow('outside');
  });
});
