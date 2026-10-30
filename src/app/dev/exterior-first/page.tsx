import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {validateScene} from '@/lib/villa/scene/model';
import {ExteriorStudyViewer} from './viewer';
export default async function Page({searchParams}:{searchParams:Promise<{study?:string}>}) {
 if(process.env.NODE_ENV!=='development')notFound();
 const {study}=await searchParams;
 const name=['angular','flowing','estate'].includes(study??'')?study!:study==='ambitious'?'ambitious':study==='latest'?'latest':study==='compact'?'compact':'layered';
 const dir=['angular','flowing','estate'].includes(name)?'profile-freedom':['ambitious','latest'].includes(name)?'architectural-bottleneck':'exterior-first';
 const scene=validateScene(JSON.parse(await readFile(`docs/architecture/${dir}/${name}.${name==='latest'?'RETAINED':'DEVELOPER'}.json`,'utf8')));
 return <ExteriorStudyViewer scene={scene}/>;
}
