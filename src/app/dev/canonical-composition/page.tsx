import {notFound} from 'next/navigation';
import {compileArchitecturalPlan} from '@/lib/villa/canonical/plan';
import {compositionFirstFixture,type CompositionFixture} from '@/lib/villa/canonical/compositionFirst.fixture';
import {CompositionViewer} from './viewer';

const fixtures:CompositionFixture[]=['hillcrest','pavilion-court'];
/** Developer-only: compiles a developer-authored composition fixture with the real compiler and renders it unchanged.
 * `variant=roomwise` strips the composition and gives every room its own flat roof: the room-by-room baseline. Never Terra output. */
export default async function Page({searchParams}:{searchParams:Promise<{[key:string]:string|string[]|undefined}>}) {
 if(process.env.NODE_ENV!=='development')notFound();
 const query=await searchParams,name=fixtures.find(f=>f===query.fixture)??'hillcrest',roomwise=query.variant==='roomwise';
 const plan=structuredClone(compositionFirstFixture(name));
 if(roomwise){
  for(const span of plan.composition!.roofSpans)for(const space of span.spaces)plan.roofs.push({space,form:'flat',rise:.2});
  delete plan.composition;
 }
 const result=compileArchitecturalPlan(plan);
 const label=`DEVELOPER-AUTHORED FIXTURE — NOT TERRA OUTPUT — ${name}${roomwise?' · ROOM-BY-ROOM BASELINE (no composition)':' · composition-first'}`;
 return <CompositionViewer scene={result.scene} label={label} summary={roomwise?'every room carries its own flat roof; no volumes, façade rhythm or entrance declared':`${plan.composition!.volumes.map(v=>`${v.id} (${v.tier})`).join(' · ')} · ${plan.composition!.roofSpans.length} roof spans · ${plan.composition!.facades.reduce((a,f)=>a+f.bays,0)} composed bays`}/>;
}
