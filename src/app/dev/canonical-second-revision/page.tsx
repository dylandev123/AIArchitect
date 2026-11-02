import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {validateScene} from '@/lib/villa/scene/model';
import {SemanticViewer} from '../semantic-building/viewer';
/** Developer-only: renders, unchanged, the scene compiled from the second canonical revision once it is accepted. 404 until then. */
export default async function Page(){
 if(process.env.NODE_ENV!=='development')notFound();
 const raw=await readFile('docs/architecture/canonical-redesign-revision-2026-11-02/scene.accepted-for-review.json','utf8').catch(()=>null);
 if(!raw)notFound();
 const scene=validateScene(JSON.parse(raw));
 return <SemanticViewer scene={scene} thesis={scene.architecturalPlan?String((scene.architecturalPlan as {thesis?:string}).thesis??''):''} source="Terra second canonical revision, compiled unchanged"/>;
}
