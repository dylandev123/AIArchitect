import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {CaptureReview} from '../reference-review-capture/preview';
export default async function Page({searchParams}:{searchParams:Promise<{after?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {after}=await searchParams;
 const root='docs/villa-playground/completed-review';
 const config=JSON.parse(await readFile(`${root}/${after?'revised':'original'}.config.json`,'utf8'));
 const poses=JSON.parse(await readFile('docs/villa-playground/reference-review/before-captures.json','utf8'));
 return <CaptureReview config={config} poses={poses}/>;
}
