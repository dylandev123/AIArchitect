import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {validateScene} from '@/lib/villa/scene/model';
import {SemanticViewer} from './viewer';
export default async function Page({searchParams}:{searchParams:Promise<{case?:string;revised?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const q=await searchParams,selected=q.case??'estate';if(!['estate','compact'].includes(selected))notFound();
 const result=JSON.parse(await readFile(`docs/architecture/semantic-building-proof/${selected}${q.revised?'.revised':''}.json`,'utf8'));
 return <SemanticViewer scene={validateScene(result.scene)} thesis={result.intent.thesis}/>;
}
