import { notFound } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import { validateScene } from '@/lib/villa/scene/model';
import { GenerationQualityViewer } from '../generation-quality/viewer';
const sources = {
 estate:'docs/architecture/terra-controlled-estate-2026-10-29/draft.REJECTED.json',
 massive:'docs/architecture/architectural-bottleneck/latest.RETAINED.json',
 family:'docs/architecture/generation-quality/final-family/scene.json',
 narrow:'docs/architecture/generation-quality/improved-narrow/scene.json',
};
export default async function Page({searchParams}:{searchParams:Promise<{case?:string}>}) {
 if(process.env.NODE_ENV!=='development')notFound();
 const selected=(await searchParams).case;
 if(!selected || !(selected in sources))notFound();
 const scene=validateScene(JSON.parse(await readFile(sources[selected as keyof typeof sources],'utf8')));
 return <GenerationQualityViewer scene={scene} accepted={selected!=='estate'} provenance="Retained Terra evidence · offline replay · no new generation"/>;
}
