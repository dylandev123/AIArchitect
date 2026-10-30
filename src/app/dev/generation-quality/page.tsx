import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {validateScene} from '@/lib/villa/scene/model';
import {GenerationQualityViewer} from './viewer';

export default async function Page({searchParams}:{searchParams:Promise<{case?:string}>}) {
 if(process.env.NODE_ENV!=='development')notFound();
 const selected=(await searchParams).case;
 if(!selected||!['improved-narrow','improved-tropical-network','improved-romantic','improved-hillside','improved-family','final-family'].includes(selected))notFound();
 const dir=`docs/architecture/generation-quality/${selected}`;
 const scene=validateScene(JSON.parse(await readFile(`${dir}/scene.json`,'utf8')));
 const summary=JSON.parse(await readFile(`${dir}/summary.json`,'utf8'));
 return <GenerationQualityViewer scene={scene} accepted={summary.accepted}/>;
}
