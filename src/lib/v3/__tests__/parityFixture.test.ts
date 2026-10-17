import { describe,it,expect } from 'vitest';
import { mkdirSync,writeFileSync,readFileSync,existsSync } from 'node:fs';
import { expressiveCottage,compileCottageV2 } from '../parity/cottage';
import { parityMetrics } from '../parity/metrics';
import { compileV3Scene } from '../scene';
describe('matched cottage parity',()=>{
  it('compiles both offline paths and optionally records review artifacts',()=>{
    const scene=expressiveCottage(),v2=compileCottageV2(scene),v3=compileV3Scene(scene);
    expect(v2.errors).toEqual([]);
    expect(v2.model.primitives.length).toBeGreaterThan(50);
    if(process.env.PARITY_CAPTURE){
      const dir='docs/architecture/parity';mkdirSync(dir,{recursive:true});
      if(process.env.PARITY_CAPTURE==='after'&&existsSync(`${dir}/before.json`)) {
        const before=JSON.parse(readFileSync(`${dir}/before.json`,'utf8'));
        // Keep captured pre-pass V3 geometry; the independent V2 reference stays matched to the fixture.
        before.v2=v2.model;before.metrics={v2:parityMetrics(scene,v2.model),v3:parityMetrics(scene,before.v3)};
        writeFileSync(`${dir}/before.json`,JSON.stringify(before));
      }
      writeFileSync(`${dir}/${process.env.PARITY_CAPTURE}.json`,JSON.stringify({v2:v2.model,v3,metrics:{v2:parityMetrics(scene,v2.model),v3:parityMetrics(scene,v3)}}));
    }
  });
});

import { cottageObject } from '../parity/cottage';
import { executeV3SceneOperations } from '../operations';
import { resolveV3Renderable } from '../renderability';
import { validateV3CompiledGeometry } from '../scene';

it('routes architectural types to real assemblies, with stable authored ownership',()=>{
 for(const type of ['building-mass','glass-wall','window-band','veranda','roof-form','balcony','pool']){
  const object=cottageObject('subject',type,0,0,8,type==='window-band'||type==='glass-wall'?.15:5,type==='roof-form'?.3:3,0,{roofForm:'gable'});
  const scene={...expressiveCottage(),objects:[object]};
  expect(resolveV3Renderable(object).strategy).toBe('specialized');
  const parts=compileV3Scene(scene).primitives.filter(p=>p.sourceObjectId==='subject');
  expect(parts.length,type).toBeGreaterThan(1);
  expect(parts.every(p=>p.semanticRole==='subject'&&p.componentRole&&!p.componentRole.startsWith('generic')&&p.componentRole!=='render proxy')).toBe(true);
  expect(validateV3CompiledGeometry(scene).errors).toEqual([]);
 }
});

it('keeps six requested edits authored, persistent and deterministic',()=>{
 let scene=expressiveCottage();const original=JSON.stringify(scene);
 const changes=[
  {op:'editArchitecture',target:'bedroom',architecture:{width:9}},
  {op:'setComposition',target:'living',composition:{openings:[{id:'large',type:'glazing-zone',facade:'south',start:0,end:1,heightRatio:.98}]}},
  {op:'changeMaterial',target:'living-roof',material:{id:'copper',color:'#946348',surface:'metal',roughness:.5}},
  {op:'editArchitecture',target:'veranda',architecture:{depth:4.5}},
  {op:'editArchitecture',target:'plunge-pool',architecture:{width:8}},
  {op:'create',object:cottageObject('gazebo','garden-gazebo',19,-10,4,4,3,0,{geometryKind:'proxy',source:{kind:'proxy',replaceable:true}})},
 ];
 for(const operation of changes){
  const before=compileV3Scene(scene);
  const result=executeV3SceneOperations(scene,{intent:'Offline semantic parity edit',operations:[operation]});
  expect(result.errors).toEqual([]);expect(result.ok).toBe(true);scene=result.scene;
  const target=operation.op==='create'?'gazebo':operation.target;
  const children=compileV3Scene(scene).primitives.filter(p=>p.sourceObjectId===target);
  expect(children).not.toEqual(before.primitives.filter(p=>p.sourceObjectId===target));
  expect(children.every(p=>p.semanticRole&&p.componentRole)).toBe(true);
  const reloaded=JSON.parse(JSON.stringify(scene));
  expect(compileV3Scene(reloaded)).toEqual(compileV3Scene(scene));
 }
 expect(JSON.stringify(expressiveCottage())).toBe(original);
 expect(scene.objects.find(o=>o.id==='bedroom')?.architecture?.width).toBe(9);
 expect(scene.objects.find(o=>o.id==='veranda')?.architecture?.depth).toBe(4.5);
 expect(scene.objects.find(o=>o.id==='plunge-pool')?.architecture?.width).toBe(8);
 expect(parityMetrics(scene,compileV3Scene(scene)).proxyCount).toBe(1);
 expect(scene.objects.some(o=>o.id.includes('composition-wall'))).toBe(false);
});

it('removes swallowed cottage glazing at junctions and retains the unchanged V2 reference',()=>{
 const scene=expressiveCottage(),v2=compileCottageV2(scene).model,v3=compileV3Scene(scene);
 expect(parityMetrics(scene,v2).glazingPrimitives).toBe(15);
 expect(parityMetrics(scene,v3).glazingPrimitives).toBe(13); // Two internal panes are swallowed by connected envelopes.
 expect(parityMetrics(scene,v3).verandaComponents).toBe(8);
 expect(parityMetrics(scene,v3).fallbackRenderCount).toBe(0);
 const roof=v3.primitives.filter(p=>p.sourceObjectId==='living-roof');
 expect(roof.some(p=>p.componentRole==='roof flashing')).toBe(true);
 expect(roof.some(p=>p.componentRole==='roof wall infill'&&p.color===scene.objects[0].material.color)).toBe(true);
});
