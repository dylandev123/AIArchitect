import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ingestV3GenerationOutput } from '../ingestion';
import { reviewV3ArchitecturalComposition as review, v3DesignRepairInstructions } from '../designReview';
import { assessV3Revision } from '../safeRevision';
import { compileV3Scene, type V3Scene } from '../scene';
import { footprintOverlap } from '../reviewGeometry';
import { object } from './flatMansionFixture';
import { V3_COMPOSITION_PROMPT } from '../composition';
import { v3SceneArchitectPrompt } from '../schema';

const scene=(objects:unknown[])=>ingestV3GenerationOutput({version:3,site:{width:160,depth:160},objects},'flat').scene;
const mass=(id='main',x=0,z=0,extra={})=>object(id,'building-mass',x,z,0,10,10,6,{levels:2,roofForm:'gable',pitch:22,...extra});
const conflict=()=>scene([mass(),mass('other',30,0),object('pool','pool',0,0,-1.3,4,4,1.5)]);
const movePool=(s:V3Scene)=>{const next=structuredClone(s), p=next.objects.find(o=>o.id==='pool')!;p.architecture!.z=20;p.transform.position[2]=20;return next;};
const assess=(a:V3Scene,b:V3Scene,brief?:string)=>assessV3Revision(a,b,review(a,{brief}),review(b,{brief}));

describe('creative freedom and safe targeted revision',()=>{
  it.each(['flat','gable','hip'] as const)('accepts equal-mass symmetry, aligned facades and coordinated varied palettes with %s roofs',(roofForm)=>{
    const s=scene(Array.from({length:5},(_,i)=>mass(`mass-${i}`,i*10-20,0,{roofForm, material:{id:`finish-${i}`,color:'#aaa999'},composition:{massHierarchy:i===2?'primary':'secondary'}})));
    const r=review(s);
    expect(r.significant).toBe(0);expect(r.repairRecommended).toBe(false);expect(v3DesignRepairInstructions(r)).toEqual([]);
  });
  it('accepts compact and recessed entries and overlapping architectural joints',()=>{
    const s=scene([mass('main',0,0,{composition:{openings:[{id:'door',type:'door',floors:'ground',facade:'south',start:.4,end:.6}],mainEntry:{openingId:'door',canopyDepth:1}}}),mass('left',-8,4),mass('right',8,4),object('arrival','driveway',0,22,0,4,12,.1),object('cover','canopy',0,5,5,8,4,.2)]);
    expect(review(s).repairRecommended).toBe(false);
    expect(review(scene([mass()])).repairRecommended).toBe(false);
  });
  it('uses rotated footprints, allows covered and hosted architecture, and checks rotated pool containment',()=>{
    const s=scene([mass('main',0,0,{architecture:{x:0,z:0,baseElevation:0,width:16,depth:2,height:6,rotationY:Math.PI/4}}),object('pool','pool',5,5,-1.3,3,3,1.5),object('canopy','canopy',0,0,4,8,8,.2)]);
    expect(footprintOverlap(s.objects[0],s.objects[1])).toBe(0);expect(review(s).repairRecommended).toBe(false);
    const contained=scene([mass('house',-30,0),object('deck','terrace',20,20,0,12,8,.2,{architecture:{x:20,z:20,baseElevation:0,width:12,depth:8,height:.2,rotationY:Math.PI/4}}),object('pool','pool',20,20,-1.3,8,4,1.5,{hostId:'deck',architecture:{x:20,z:20,baseElevation:-1.3,width:8,depth:4,height:1.5,rotationY:Math.PI/4}})]);
    expect(review(contained).repairRecommended).toBe(false);
    contained.objects.find(o=>o.id==='pool')!.architecture!.x+=7;
    expect(review(contained).repairRecommended).toBe(true);
  });
  it('accepts a real collision fix while preserving all unrelated architecture',()=>{
    const a=conflict(), b=movePool(a), saved=JSON.stringify(a);
    expect(review(a).repairRecommended).toBe(true);expect(review(b).repairRecommended).toBe(false);
    expect(assess(a,b).accepted).toBe(true);expect(JSON.stringify(a)).toBe(saved);
  });
  it.each(['identity','mass','roof','material','facade','assembly','site','addition'])('rejects unrelated %s changes despite fewer conflicts',(kind)=>{
    const a=conflict(), b=movePool(a), m=b.objects[0];
    if(kind==='identity')m.id='replacement';
    if(kind==='mass')m.architecture!.height+=1;
    if(kind==='roof')m.roofForm='flat';
    if(kind==='material')m.material.color='#ff0000';
    if(kind==='facade')m.composition={openings:[]};
    if(kind==='assembly')m.composition={assemblies:[]};
    if(kind==='site')b.site!.width+=10;
    if(kind==='addition')b.objects.push({...structuredClone(b.objects[1]),id:'extra'});
    expect(review(b).significant).toBeLessThan(review(a).significant);
    expect(assess(a,b).accepted).toBe(false);
  });
  it('rejects deletion of the conflicting amenity and accepts only explicitly requested additions',()=>{
    const a=conflict(), b=structuredClone(a);b.objects=b.objects.filter(o=>o.id!=='pool');expect(assess(a,b).accepted).toBe(false);
    const original=scene([mass()]), added=scene([mass(),object('pool','pool',0,20,-1.3,4,4,1.5)]);
    expect(assess(original,added,'house with a pool').accepted).toBe(true);
    expect(assess(original,added).accepted).toBe(false);
  });
  it('accepts a targeted entry repair but protects sibling openings',()=>{
    const a=scene([mass('main',0,0,{composition:{openings:[{id:'door',type:'door',facade:'south',floors:'ground',start:.4,end:.6},{id:'window',type:'glazing-zone',facade:'east',start:.2,end:.8,heightRatio:.7}],mainEntry:{openingId:'door',canopyDepth:1}}}),object('drive','driveway',0,-20,0,4,12,.1)]);
    const b=structuredClone(a);b.objects[0].composition!.openings![0].facade='north';
    expect(review(a).repairRecommended).toBe(true);expect(assess(a,b).accepted).toBe(true);
    b.objects[0].composition!.openings![1].facade='west';expect(assess(a,b).accepted).toBe(false);
  });
  it('checks the actual balcony span and accepts only its targeted facade repair',()=>{
    const a=scene([mass('main',0,0,{composition:{assemblies:[{id:'balcony',intent:'Balcony',parts:[{id:'slab',type:'slab',facade:'east',start:.6,end:.95,depth:2,level:1},{id:'rail',type:'railing',slabId:'slab',edges:['outer'],height:1}]}]}}),mass('neighbor',10,0)]);
    expect(review(a).diagnostics.some(d=>d.code==='BALCONY_ON_SHARED_WALL')).toBe(true);
    const b=structuredClone(a), slab=b.objects[0].composition!.assemblies![0].parts[0];
    if('facade' in slab)slab.facade='west';
    expect(assess(a,b).accepted).toBe(true);
    const partial=structuredClone(a);partial.objects[1].architecture!.z=-8;
    expect(review(partial).diagnostics.some(d=>d.code==='BALCONY_ON_SHARED_WALL')).toBe(false);
  });
  it('accepts explicit double-height semantics without changing mass geometry',()=>{
    const a=scene([mass('main',0,0,{label:'Double-height living room'})]),b=structuredClone(a);
    b.objects[0].composition={spaceHeight:'double-height'};
    expect(assess(a,b,'double-height living room').accepted).toBe(true);
  });
  it('keeps subjective findings out of revision instructions and preserves prompt freedom',()=>{
    expect(V3_COMPOSITION_PROMPT).toContain('Everything unspecified is a creative design opportunity');
    expect(v3SceneArchitectPrompt('flat')).not.toContain('a dominant primary pavilion with lower secondary wings');
    expect(v3DesignRepairInstructions(review(conflict())).every(line=>line.startsWith('OUTDOOR_PLACEMENT_CONFLICT'))).toBe(true);
  });
  it.each(['floating butterfly','mansard','custom folded origami'])('preserves unsupported explicit roof intent %s with a diagnostic',(roofForm)=>{
    const result=ingestV3GenerationOutput({version:3,site:{width:60,depth:60},objects:[mass('main',0,0,{roofForm})]},'flat');
    expect(result.ok).toBe(true);expect(result.scene.objects[0].unsupportedIntent?.roofForm).toBe(roofForm);
    expect(result.scene.objects[0].roofForm).toBeUndefined();expect(result.notes.some(n=>n.code==='UNSUPPORTED_ARCHITECTURAL_INTENT')).toBe(true);
    expect(ingestV3GenerationOutput(JSON.parse(JSON.stringify(result.scene)),'flat').scene.objects[0].unsupportedIntent).toEqual({roofForm});
  });
  it('renders legacy named butterfly intent without persisting a rewrite',()=>{
    const result=ingestV3GenerationOutput({version:3,site:{width:60,depth:60},objects:[object('roof','roof-form',0,0,6,10,10,1,{label:'High floating butterfly roof'})]},'flat');
    expect(result.scene.objects[0].roofForm).toBeUndefined();
    expect(result.scene.objects[0].unsupportedIntent).toBeUndefined();
    expect(compileV3Scene(result.scene).primitives.some(p=>p.componentRole==='butterfly roof plane')).toBe(true);
  });
  it.each(['docs/architecture/parity/flat-mansion/scene-f2149916.json','src/lib/v3/__tests__/fixtures/butterfly-mansion.json'])('replays %s unchanged, review is observational',(file)=>{
    const raw=readFileSync(file,'utf8'), s=JSON.parse(raw).v3Scene as V3Scene, before=JSON.stringify(s);
    const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
    const compiled=hash(compileV3Scene(s));review(s,{brief:s.metadata.brief as string});
    expect(hash(compileV3Scene(s))).toBe(compiled);expect(JSON.stringify(s)).toBe(before);expect(readFileSync(file,'utf8')).toBe(raw);
  });
});
