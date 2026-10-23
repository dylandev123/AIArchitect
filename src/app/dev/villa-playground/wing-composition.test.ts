import { describe, expect, it } from 'vitest';
import { COMPOSITIONS, operateWings, validateWings, wallContacts, wingBounds } from './wing-composition';

describe('local wing compositions', () => {
  it('has distinct footprints, hierarchy and detached buildings', () => {
    const presets = Object.values(COMPOSITIONS);
    for (const c of presets) expect(validateWings(c.wings)).toHaveLength(c.wings.length);
    expect(presets.map(c => c.wings.filter(w => w.role !== 'gallery').length)).toEqual([2, 3, 4]);
    expect(presets.map(c => c.wings.filter(w => w.connects).length)).toEqual([1, 2, 1]);
    expect(presets[2].wings.filter(w => w.role === 'guest')).toHaveLength(2);
    expect(wingBounds(presets[0].wings[1])).toEqual({left:-8,right:-1,rear:-.5,front:9.5});
  });
  it('galleries touch both hosts and create corresponding real wall openings', () => {
    for (const c of Object.values(COMPOSITIONS)) for (const g of c.wings.filter(w => w.connects)) {
      const faces = ['front','rear','left','right'] as const;
      expect(faces.flatMap(face => wallContacts(g,c.wings,face))).toHaveLength(2);
      for (const id of g.connects!) {
        const host = c.wings.find(w => w.id === id)!;
        expect(faces.flatMap(face => wallContacts(host,[host,g],face))).toHaveLength(1);
      }
    }
  });
  it('regenerates galleries after dimensions and placement change, removes dependent galleries', () => {
    const c=COMPOSITIONS['compact-l'];
    const moved=operateWings(c.wings,{type:'adjust',id:'garden-salon',changes:{z:5.5,depth:8,storeyHeight:4.1}});
    const g=moved.find(w=>w.role==='gallery')!;
    expect(g.width).toBe(3.4);
    expect(wingBounds(g).front).toBe(.5);
    expect(operateWings(moved,{type:'remove',id:'garden-salon'}).map(w=>w.id)).toEqual(['island-house']);
    expect(c.wings.find(w=>w.id==='garden-salon')!.z).toBe(4.5);
  });
  it('adds a detached pavilion and rejects overlaps or invalid connectors atomically', () => {
    const c=COMPOSITIONS['compact-l'];
    const guest={...c.wings[1],id:'new-guest',x:20,z:0,orientation:180 as const};
    expect(operateWings(c.wings,{type:'add',wing:guest})).toHaveLength(4);
    expect(()=>operateWings(c.wings,{type:'add',wing:{...guest,x:0,z:-6}})).toThrow('Overlapping');
    expect(operateWings(c.wings,{type:'adjust',id:'garden-salon',changes:{orientation:180}}).find(w=>w.id==='garden-salon')!.orientation).toBe(180);
    expect(()=>operateWings(c.wings,{type:'connect',id:'bad-link',from:'island-house',to:'garden-salon',width:12})).toThrow();
  });
});
