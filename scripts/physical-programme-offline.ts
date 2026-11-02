/** Read-only replay/measurement. Never calls a provider or edits retained evidence. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { validateScene } from '../src/lib/villa/scene/model';
import { sceneSpatialGeometry } from '../src/lib/villa/scene/spatial';
import { reviewSceneArchitecture } from '../src/lib/villa/scene/planning';
import { resolveSceneResult, SceneConstructionError } from '../src/lib/villa/scene/terra';
globalThis.fetch=async()=>{throw Error('Offline: all network prohibited');};
const dir='docs/architecture/physical-programme';mkdirSync(dir,{recursive:true});
const cases=[
 {name:'earlier-redacted-brief',path:'docs/villa-playground/terra-basic-diagnosis/failed.scene.json',floors:['main-slab','west-wing-slab','east-wing-slab','upper-suite-deck'],source:'.data/scene-responses/0bd8551e-ebcf-4685-8ee0-5aed50e7bea6.json'},
 {name:'25m-rejected-estate',path:'docs/architecture/terra-controlled-estate-2026-10-29/draft.REJECTED.json',floors:['main-salon','suite-one','suite-two','suite-three','suite-four','suite-five','suite-six'],source:'docs/architecture/terra-controlled-estate-2026-10-29/normalized-output.json'},
 {name:'massive-waterfront',path:'docs/architecture/architectural-bottleneck/latest.RETAINED.json',floors:['great-hall','west-wing','east-wing'],source:'.data/scene-responses/c8d01439-962e-4575-8fd5-f1d47c5ffca1.json'},
 {name:'four-bedroom-family',path:'docs/architecture/generation-quality/final-family/scene.json',floors:['main-floor','west-wing-floor','east-wing-floor']},
 {name:'constrained-narrow',path:'docs/architecture/generation-quality/improved-narrow/scene.json',floors:['ground-floor','upper-floor']},
];
const results=cases.map(c=>{
 const bytes=readFileSync(c.path),scene=validateScene(JSON.parse(bytes.toString())),g=sceneSpatialGeometry(scene);
 const floorIds=c.floors.length?c.floors:[...new Set((scene.architecturalPlan as {programme:{zone:string;floorIds:string[]}[]}).programme.filter(p=>!['outdoor','circulation'].includes(p.zone)).flatMap(p=>p.floorIds))];
 const floors=floorIds.map(id=>{const e=g.map.get(id)!;assert(e?.kind==='plate');return {id,size:e.size,world:g.world(e),top:g.top(e),grossRectangleM2:e.geometry?null:e.size[0]*e.size[2],profile:!!e.geometry};});
 const points=floorIds.flatMap(id=>{const e=g.map.get(id)!,p=g.world(e);return [-1,1].flatMap(x=>[-1,1].map(z=>[p[0]+Math.cos(p[3])*x*e.size[0]/2+Math.sin(p[3])*z*e.size[2]/2,p[2]-Math.sin(p[3])*x*e.size[0]/2+Math.cos(p[3])*z*e.size[2]/2]));});
 let replay:unknown='not replayed';
 if(c.source){
  const raw=JSON.parse(readFileSync(c.source,'utf8')),output=raw.output??raw;
  const prompt=raw.input?.prompt??JSON.parse(readFileSync('docs/architecture/terra-controlled-estate-2026-10-29/request.json','utf8')).prompt;
  function execute(candidate:unknown){
   try {return {scene:resolveSceneResult({mode:'generate',prompt},candidate).scene,currentSafetyRejected:false,error:undefined as string|undefined};}
   catch(error){if(!(error instanceof SceneConstructionError))throw error;return {scene:error.recoverableDraft,currentSafetyRejected:true,error:error.message};}
  }
  const current=execute(output),elements=JSON.parse(JSON.stringify(current.scene.elements));
  const exact=isDeepStrictEqual(elements,scene.elements);
  const changedParts=elements.filter((e:typeof scene.elements[number])=>!isDeepStrictEqual(e,scene.elements.find(old=>old.id===e.id))).map((e:typeof scene.elements[number])=>({id:e.id,current:e,retained:scene.elements.find(old=>old.id===e.id)}));
  // Historical assembly defaults can evolve. Replay the retained expanded parts
  // separately, never replace historical geometry with today's expansion.
  const expanded=execute({...output,operations:scene.elements.map(element=>({op:'add',element}))});
  assert.deepEqual(JSON.parse(JSON.stringify(expanded.scene.elements)),scene.elements);
  replay={authoredExpansionExact:exact,changedParts,currentSafetyRejected:current.currentSafetyRejected,error:current.error,retainedExpandedReplayExact:true,retainedExpandedSafetyRejected:expanded.currentSafetyRejected,brief:prompt,operations:output.operations.length};
 }
 const audit=reviewSceneArchitecture(scene);
 return {name:c.name,path:c.path,sha256:createHash('sha256').update(bytes).digest('hex'),brief:scene.generationBrief??null,replay,floors,principalFloorBoundsMetres:{width:Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0])),depth:Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]))},grossRectangleSumM2:floors.some(f=>f.profile)?null:floors.reduce((s,f)=>s+f.grossRectangleM2!,0),occupiedFloorDatums:[...new Set(floors.map(f=>f.top))],water:scene.elements.filter(e=>e.kind==='water').map(e=>({id:e.id,size:e.size,world:g.world(e)})),audit};
});
writeFileSync(`${dir}/measurements.json`,JSON.stringify({providerCalls:0,notes:['Principal floor selections are explicit evidence classifications, not metadata proof of rooms. Rectangle sums are gross upper bounds; not certified enclosed/net area. Narrow profiles withhold area. Historical input files remain untouched.'],results},null,2));
console.log(JSON.stringify(results.map(({name,grossRectangleSumM2,principalFloorBoundsMetres,occupiedFloorDatums,replay})=>({name,grossRectangleSumM2,principalFloorBoundsMetres,occupiedFloorDatums,replay})),null,2));
