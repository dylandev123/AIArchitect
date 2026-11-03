import {notFound} from 'next/navigation';
import {compileArchitecturalPlan} from '@/lib/villa/canonical/plan';
import {strategyFixture,type StrategyFixture} from '@/lib/villa/canonical/strategies.fixture';
import {CompositionViewer} from '../canonical-composition/viewer';

const fixtures:StrategyFixture[]=['waterfront-pavilion','tropical-pavilion-court','courtyard-residence','stepped-multilevel','compact-two-volume'];
/** Developer-only: compiles a developer-authored whole-house strategy fixture with the real compiler and renders it unchanged. Never Terra output. */
export default async function Page({searchParams}:{searchParams:Promise<{[key:string]:string|string[]|undefined}>}) {
 if(process.env.NODE_ENV!=='development')notFound();
 const query=await searchParams,name=fixtures.find(f=>f===query.fixture)??fixtures[0];
 const plan=structuredClone(strategyFixture(name)),result=compileArchitecturalPlan(plan);
 return <CompositionViewer scene={result.scene} label={`DEVELOPER-AUTHORED FIXTURE — NOT TERRA OUTPUT — strategy ${name}`} summary={`${plan.composition!.volumes.map(v=>`${v.id} (${v.tier})`).join(' · ')} · ${plan.composition!.roofSpans.length} roof spans · ${plan.composition!.facades.reduce((a,f)=>a+f.bays,0)} composed bays`}/>;
}
