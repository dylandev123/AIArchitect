import { describe, expect, it } from 'vitest';
import { COMPOSITION_EXAMPLES, validatedCompositionExamples } from './composition-examples';
import { buildComposition, compositionFindings, executeCompositionPatch, validateComposition, type VillaComposition } from './composition';
import { resolveVillaResult, villaSystemPrompt } from './terra';
import { defaultVilla, STYLES } from './design';
import { COMPOSITIONS, wallContacts } from '@/app/dev/villa-playground/wing-composition';

const copy=(index=0)=>structuredClone(COMPOSITION_EXAMPLES[index]);
describe('versioned composable villa contract (deterministic, no provider)',()=>{
  it('builds distinct original one, two and four wing houses without preset substitution',()=>{
    const configs=validatedCompositionExamples(), built=configs.map(buildComposition);
    expect(configs.map(c=>c.wings.length)).toEqual([1,2,4]);
    expect(new Set(built.map(c=>JSON.stringify(c.wings)) ).size).toBe(3);
    for(const c of built) {
      expect(COMPOSITIONS[c.id]).toBeUndefined();
      expect(c.config.style).toBe(configs.find(x=>x.id===c.id)!.appearance.style);
      for(const g of c.wings.filter(w=>w.connects)) {
        expect((['front','rear','left','right'] as const).flatMap(face=>wallContacts(g,c.wings,face))).toHaveLength(2);
      }
    }
    expect(built[2].wings.find(w=>w.id==='retreat')!.orientation).toBe(90);
  });
  it.each(STYLES)('keeps %s component builders compatible with every cardinal orientation and storey count',style=>{
    for(const orientation of [0,90,180,270] as const) for(const storeys of [1,2] as const) {
      const c=copy(),defaults=defaultVilla(style);
      c.appearance={style,roof:defaults.roof,exterior:defaults.exterior,glazing:defaults.glazing,landscape:defaults.landscape};
      c.wings[0]={...c.wings[0],orientation,storeys,balcony:storeys===2?1.6:0};
      expect(buildComposition(c).wings[0]).toMatchObject({orientation,storeys});
    }
  });
  it('supports shared flat-roof wall contacts and the supported dimension/height extrema',()=>{
    const c=copy();c.pool=null;c.terraces=[];
    c.wings.push({...c.wings[0],id:'living',role:'living',parentId:'main',x:13,width:8,storeys:1,balcony:0,veranda:0});
    expect(buildComposition(c).wings).toHaveLength(2);
    for(const width of [8,32]) for(const depth of [4,32]) for(const storeyHeight of [3,4.5]) {
      const solo=copy();solo.wings[0]={...solo.wings[0],width,depth,storeyHeight,x:0,z:0,balcony:0};solo.pool=null;solo.terraces=[];solo.garden={x:0,z:0,width:80,depth:80};
      expect(buildComposition(solo).wings[0].width).toBe(width);
    }
  });
  it('round trips the versioned payload without losing authored choices',()=>{
    for(const c of validatedCompositionExamples()) expect(validateComposition(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(()=>validateComposition({...copy(),version:2})).toThrow();
  });
  it('adds, extends, raises and repositions a guest with the same executor',()=>{
    const original=copy();
    const guest={...original.wings[0],id:'guest',role:'guest' as const,parentId:'main',detached:true,x:16.5,z:1,width:8,depth:5,storeys:1 as const,balcony:0,orientation:270 as const,veranda:1.4};
    const added=executeCompositionPatch(original,{wings:[{type:'add',wing:guest}]});
    const edited=executeCompositionPatch(added,{wings:[{type:'adjust',id:'guest',changes:{x:16.5,z:2,width:9,storeyHeight:4.3,storeys:2}}]});
    expect(edited.wings[1]).toMatchObject({x:16.5,z:2,width:9,storeyHeight:4.3,storeys:2});
    expect(edited.wings[0]).toEqual(original.wings[0]); expect(edited.pool).toEqual(original.pool);
    expect(original.wings).toHaveLength(1); expect(added.wings[1].storeys).toBe(1);
    const terra=resolveVillaResult({mode:'edit',prompt:'Raise the guest wing',current:added},{changes:{wings:[{type:'adjust',id:'guest',changes:{storeyHeight:4.3}}]},summary:'Raised guest.',unsupported:[]});
    expect(terra.config).toEqual(executeCompositionPatch(added,{wings:[{type:'adjust',id:'guest',changes:{storeyHeight:4.3}}]}));
  });
  it('regenerates gallery dimensions after edits and removes dependent links',()=>{
    const c=copy(1), before=buildComposition(c).wings.find(w=>w.id==='breeze-link')!;
    const after=executeCompositionPatch(c,{wings:[{type:'adjust',id:'salon',changes:{x:11}}]});
    expect(buildComposition(after).wings.find(w=>w.id==='breeze-link')!.width).toBe(before.width+2);
    const removed=executeCompositionPatch(after,{wings:[{type:'remove',id:'salon'}]});
    expect(removed.connections).toEqual([]); expect(removed.wings).toHaveLength(1);
  });
  it('enlarges an open court and moves both wings in one atomic transaction',()=>{
    const c=copy(2), court=c.terraces[0];
    const next=executeCompositionPatch(c,{wings:[{type:'adjust',id:'west',changes:{x:-11}},{type:'adjust',id:'east',changes:{x:12}}],terraces:[{type:'put',terrace:{...court,width:12}}]});
    expect(next.terraces[0].width).toBe(12); expect(next.pool).toEqual(c.pool);
    expect(buildComposition(next).wings.filter(w=>w.connects)).toHaveLength(2);
    expect(c.terraces[0].width).toBe(10);
  });
  it('validates final state only, so temporarily overlapping coordinated moves succeed',()=>{
    const c=copy(1);
    const next=executeCompositionPatch(c,{wings:[{type:'adjust',id:'main',changes:{x:9}},{type:'adjust',id:'salon',changes:{x:-5,orientation:0}}],terraces:[{type:'remove',id:'garden-room'}],pool:null});
    expect(next.wings.map(w=>w.x)).toEqual([9,-5]);
  });
  const invalid: [string,(c:VillaComposition)=>void,string][]=[
    ['orientation',c=>{(c.wings[0] as {orientation:number}).orientation=45;},'orientation'],
    ['nonfinite',c=>{c.wings[0].x=NaN;},'x'],
    ['stairs',c=>{c.wings[0].width=7;},'width'],
    ['one-storey balcony',c=>{c.wings[0].storeys=1;},'balcony'],
    ['roof',c=>{c.appearance.roof='hip';},'appearance.roof'],
    ['dimensions',c=>{c.wings[0].depth=40;},'depth'],
    ['parent',c=>{c.wings.push({...c.wings[0],id:'child',role:'guest',parentId:'missing',detached:true,x:20});},'parentId'],
    ['overlap',c=>{c.wings.push({...c.wings[0],id:'child',role:'guest',parentId:'main',detached:true});},'wings'],
    ['pool clearance',c=>{c.pool!.z=-5;c.terraces=[];},'pool'],
    ['paving covers water',c=>{c.terraces[0].z=c.pool!.z;},'terraces'],
    ['courtyard occupied',c=>{c.terraces[0]={...c.terraces[0],kind:'courtyard',z:-5};},'terraces'],
    ['site boundary',c=>{c.garden.width=15;},'wings'],
    ['false connection',c=>{c.wings.push({...c.wings[0],id:'child',role:'guest',parentId:'main',detached:false,x:20,width:8});},'parentId'],
    ['invalid gallery',c=>{c.connections=[{id:'bad-link',from:'main',to:'absent',width:2}];},'connections'],
    ['duplicate IDs',c=>{c.terraces[0].id='main';},'ids'],
  ];
  it.each(invalid)('rejects %s with a precise diagnostic',(_name,mutate,path)=>{
    const c=copy();mutate(c);
    try {validateComposition(c);throw new Error('expected rejection');}
    catch(e) {expect(compositionFindings(e).some(f=>f.path.includes(path))).toBe(true);}
  });
  it('rejects cycles, wrong roots, mismatched detached flags, overlapping eaves and roof junctions',()=>{
    const cycle=copy(2);cycle.wings[1].parentId='east';cycle.wings[2].parentId='west';
    expect(()=>validateComposition(cycle)).toThrow('cycles');
    const noRoot=copy();noRoot.wings[0].role='guest';expect(()=>validateComposition(noRoot)).toThrow('Exactly one');
    const detached=copy(1);detached.wings[1].detached=true;expect(()=>validateComposition(detached)).toThrow('Detached');
    const close=copy(1);close.wings[1].x=6.8;close.connections=[];close.wings[1].detached=true;
    expect(()=>validateComposition(close)).toThrow('envelopes');
    const roof=copy(1);roof.wings[1].x=6;roof.connections=[];
    expect(()=>validateComposition(roof)).toThrow('Pitched');
  });
  it('rejects galleries whose roofs would collide with low host eaves',()=>{
    const c=copy(1);c.wings[1].storeyHeight=3;
    expect(()=>validateComposition(c)).toThrow('rise at least 0.3 m');
  });
  it('rolls back the entire edit on failure and preserves IDs/unrelated components',()=>{
    const c=copy(1), saved=structuredClone(c);
    expect(()=>executeCompositionPatch(c,{appearance:{exterior:'limestone'},wings:[{type:'adjust',id:'salon',changes:{x:-5,z:-7}}]})).toThrow();
    expect(c).toEqual(saved);
    expect(()=>executeCompositionPatch(c,{wings:[{type:'adjust',id:'absent',changes:{x:1}}]})).toThrow('Unknown');
    expect(()=>executeCompositionPatch(c,{wings:[{type:'remove',id:'main'}]})).toThrow();
    expect(()=>executeCompositionPatch(c,{appearance:{style:'modern'}})).toThrow('roof');
  });
  it('deep merges pool edits, disables pool rendering, and requires full fields on re-add',()=>{
    const c=copy(), changed=executeCompositionPatch(c,{pool:{width:10}});
    expect(changed.pool).toEqual({...c.pool,width:10});
    const off=executeCompositionPatch(c,{pool:null});expect(buildComposition(off).pool.enabled).toBe(false);
    expect(()=>executeCompositionPatch(off,{pool:{width:10}})).toThrow();
    expect(executeCompositionPatch(off,{pool:c.pool}).pool).toEqual(c.pool);
  });
  it('generation accepts an authored composition but rejects preset-only output and replacements in edit mode',()=>{
    const c=copy();
    expect(resolveVillaResult({mode:'generate',prompt:'one quiet house'},{changes:c,summary:'One house.',unsupported:[]}).config).toEqual(validateComposition({...c,siteMode:'derived'}));
    expect(()=>resolveVillaResult({mode:'generate',prompt:'house'},{changes:{style:'modern'},summary:'House.',unsupported:[]})).toThrow();
    expect(()=>resolveVillaResult({mode:'edit',current:c,prompt:'house'},{changes:c,summary:'House.',unsupported:[]})).toThrow();
    const system=villaSystemPrompt('generate',true); expect(system).toContain('single main wing');expect(system).toContain('presets are examples');
  });
});
