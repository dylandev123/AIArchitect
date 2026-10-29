import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {CaptureReview} from './preview';
export default async function Page({searchParams}:{searchParams:Promise<{after?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {after}=await searchParams;
 const config=after?JSON.parse(await readFile('docs/villa-playground/reference-review/revised.config.json','utf8')):JSON.parse(await readFile('docs/villa-playground/image-fidelity/audited-replay.json','utf8')).config;
 const poses=after?JSON.parse(await readFile('docs/villa-playground/reference-review/before-captures.json','utf8')):undefined;
 return <CaptureReview config={config} poses={poses}/>;
}
