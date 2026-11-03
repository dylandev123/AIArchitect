/** Offline: compiles the developer-authored composition fixtures (and their room-by-room baselines) with the real compiler
 * and writes the scenes the browser capture is verified against. No model call, network, database or credentials. */
import {writeFileSync} from 'node:fs';
import {compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {compositionFirstFixture,type CompositionFixture} from '../src/lib/villa/canonical/compositionFirst.fixture';
const dir='docs/architecture/canonical-composition-2026-11-03',summary:Record<string,unknown>={};
for(const name of ['hillcrest','pavilion-court'] as CompositionFixture[])for(const variant of ['composed','roomwise']){
 const plan=structuredClone(compositionFirstFixture(name));
 if(variant==='roomwise'){for(const span of plan.composition!.roofSpans)for(const space of span.spaces)plan.roofs.push({space,form:'flat',rise:.2});delete plan.composition;}
 const r=compileArchitecturalPlan(plan);
 writeFileSync(`${dir}/${name}.${variant}.scene.json`,JSON.stringify(r.scene,null,1));
 summary[`${name}.${variant}`]={elements:r.scene.elements.length,roofs:r.scene.elements.filter(e=>e.kind==='roof').length,walls:r.scene.elements.filter(e=>e.kind==='wall').length,openingsInWalls:r.scene.elements.filter(e=>e.kind==='wall'&&e.opening).length,composition:r.composition??null};
}
writeFileSync(`${dir}/build-summary.json`,JSON.stringify(summary,null,1));
console.log(Object.entries(summary).map(([k,v])=>`${k}: ${(v as {elements:number}).elements} elements, ${(v as {roofs:number}).roofs} roofs, ${(v as {openingsInWalls:number}).openingsInWalls} walls with openings`).join('\n'));
