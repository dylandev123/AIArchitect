/** Offline: compiles the developer-authored whole-house strategy fixtures with the real compiler, measures concept fidelity and
 * writes the scenes the browser capture is verified against. No model call, network, database or credentials. */
import {writeFileSync} from 'node:fs';
import {compileArchitecturalPlan} from '../src/lib/villa/canonical/plan';
import {strategyFixture,type StrategyFixture} from '../src/lib/villa/canonical/strategies.fixture';
import {conceptFidelity} from '../src/lib/villa/canonical/fidelity';
const dir='docs/architecture/knowledge-to-construction-2026-11-03',summary:Record<string,unknown>={};
for(const name of ['waterfront-pavilion','tropical-pavilion-court','courtyard-residence','stepped-multilevel','compact-two-volume'] as StrategyFixture[]){
 const plan=structuredClone(strategyFixture(name)),r=compileArchitecturalPlan(plan),f=conceptFidelity(plan,r);
 writeFileSync(`${dir}/${name}.scene.json`,JSON.stringify(r.scene,null,1));
 summary[name]={elements:r.scene.elements.length,roofs:r.scene.elements.filter(e=>e.kind==='roof').length,interiorRooms:plan.spaces.filter(s=>!s.outdoor).length,fidelity:f};
}
writeFileSync(`${dir}/fidelity-summary.json`,JSON.stringify({label:'DEVELOPER-AUTHORED FIXTURES — NOT TERRA OUTPUT',providerCalls:0,summary},null,1));
console.log(Object.entries(summary).map(([k,v])=>`${k}: ${(v as {elements:number}).elements} elements, ${(v as {roofs:number}).roofs} roofs`).join('\n'));
