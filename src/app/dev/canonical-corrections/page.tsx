import {notFound} from 'next/navigation';
import {compileArchitecturalPlan} from '@/lib/villa/canonical/plan';
import {terracedPavilion,partialWallHouse} from '@/lib/villa/canonical/consolidated.fixture';
import {CompositionViewer} from '../canonical-composition/viewer';

const fixtures={'terraced-attached':()=>terracedPavilion(true),'partial-wall':partialWallHouse} as const;
/** Developer-only: compiles a developer-authored fixture for the consolidated corrections with the real compiler and renders it unchanged.
 * `terraced-attached` is the wing arrangement that needs the `attached` declaration; `partial-wall` has an explicit-side door fitted into the wall it shares. Never Terra output. */
export default async function Page({searchParams}:{searchParams:Promise<{[key:string]:string|string[]|undefined}>}) {
 if(process.env.NODE_ENV!=='development')notFound();
 const query=await searchParams,name=(Object.keys(fixtures) as (keyof typeof fixtures)[]).find(f=>f===query.fixture)??'terraced-attached';
 const plan=structuredClone(fixtures[name]());
 const result=compileArchitecturalPlan(plan);
 return <CompositionViewer scene={result.scene} label={`DEVELOPER-AUTHORED FIXTURE — NOT TERRA OUTPUT — ${name}`} summary={`${plan.masses.map(m=>m.id).join(' · ')}`}/>;
}
