import { describe, it, expect } from 'vitest';
import retained from './__tests__/fixtures/first-live-vision.json';
import { constructVision } from './image-vision';
import { replayFirstImageFidelity } from './image-fidelity';
import { buildComposition, executeCompositionPatch } from './composition';
import { FINISHES } from './design';

describe('audited offline fidelity correction',()=>{
  it('corrects only two conflicting palette selections after exact replay, preserving all geometry and evidence',()=>{
    const original=JSON.stringify(retained), exact=constructVision(retained), corrected=replayFirstImageFidelity(retained);
    expect(corrected.spec).toEqual(exact.spec);
    expect(corrected.config).toEqual({...exact.config,appearance:{...exact.config.appearance,exterior:'sand',glazing:'panoramic'}});
    expect(FINISHES[buildComposition(corrected.config).config.exterior].surface).toBe('render');
    expect(JSON.stringify(retained)).toBe(original);
    expect(()=>replayFirstImageFidelity({...retained,materials:'different'})).toThrow('exact first retained');
  });
  it('round-trips the existing terrace, glazing and eave controls through validated construction',()=>{
    const exact=constructVision(retained).config;
    const edited=executeCompositionPatch(exact,{appearance:{glazing:'panoramic'},wings:[{type:'adjust',id:'main-house',changes:{eave:1.6}}],terraces:[{type:'put',terrace:{...exact.terraces[0],x:-13,z:2,timber:true}}]});
    const built=buildComposition(edited);
    expect(built.config.glazing).toBe('panoramic');expect(built.wings[0].eave).toBe(1.6);
    expect(built.terraces[0]).toMatchObject({x:-13,z:2,timber:true});
    expect(()=>executeCompositionPatch(exact,{wings:[{type:'adjust',id:'main-house',changes:{eave:4}}]})).toThrow();
  });
});
