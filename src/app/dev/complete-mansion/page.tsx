import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {validateScene} from '@/lib/villa/scene/model';
import {GenerationQualityViewer} from '../generation-quality/viewer';
export default async function Page({searchParams}:{searchParams:Promise<{fixture?:string}>}) {
 if(process.env.NODE_ENV!=='development')notFound();
 const fixture=(await searchParams).fixture==='1';
 const root='docs/architecture/complete-mansion-2026-10-30';
 const result=fixture?null:JSON.parse(await readFile(`${root}/route-response.json`,'utf8'));
 const scene=validateScene(fixture?JSON.parse(await readFile('docs/architecture/generation-quality/final-family/scene.json','utf8')):result.scene??result.recoverableDraft);
 return <GenerationQualityViewer scene={scene} accepted={fixture?true:!!result.scene} provenance={fixture?'PREPARATION FIXTURE · historical family house · not mansion experiment evidence':'Single-call Terra mansion experiment'}/>;
}
