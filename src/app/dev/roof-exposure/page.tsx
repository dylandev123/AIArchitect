import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {compileArchitecturalPlan} from '@/lib/villa/canonical/plan';
import {validateScene} from '@/lib/villa/scene/model';
import {exposureFixture,exposureFixtures} from '@/lib/villa/canonical/roofExposure.fixture';
import {CompositionViewer} from '../canonical-composition/viewer';

/** Developer-only: compiles a developer-authored fixture with the real compiler (eaves resolved per edge) and renders it unchanged.
 * `saved=1` renders the scene as saved to disk and reloaded through validateScene instead of the fresh compile. Never Terra output. */
export default async function Page({searchParams}:{searchParams:Promise<{[key:string]:string|string[]|undefined}>}) {
 if(process.env.NODE_ENV!=='development')notFound();
 const query=await searchParams,name=exposureFixtures.find(f=>f===query.fixture)??'compact',saved=query.saved==='1';
 const result=compileArchitecturalPlan(exposureFixture(name));
 const scene=saved?validateScene(JSON.parse(await readFile(`docs/architecture/roof-facade-exposure-2026-11-03/${name}.scene.json`,'utf8'))):result.scene;
 const flush=result.roofEaves.trims.map(t=>`${t.roof} ${t.side}`).join(', ')||'none';
 return <CompositionViewer scene={scene} label={`DEVELOPER-AUTHORED FIXTURE — NOT TERRA OUTPUT — ${name} · eaves resolved per edge${saved?' · SAVED AND RELOADED':''}`} summary={`flush eaves: ${flush}`}/>;
}
