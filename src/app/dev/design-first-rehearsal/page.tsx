import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {validateScene} from '@/lib/villa/scene/model';
import {GenerationQualityViewer} from '../generation-quality/viewer';
export default async function Page() {
 if(process.env.NODE_ENV!=='development')notFound();
 const scene=validateScene(JSON.parse(await readFile('docs/architecture/design-first/rehearsal-2026-10-30/pass-final-network/scene.json','utf8')));
 return <GenerationQualityViewer scene={scene} accepted provenance="OFFLINE HARNESS REHEARSAL · retained developer fixture · no new AI design"/>;
}
