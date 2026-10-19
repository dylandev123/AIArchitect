import { notFound } from 'next/navigation';
import { MansionFailureViewer } from './viewer';
export default async function Page({searchParams}:{searchParams:Promise<{attempt?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {attempt}=await searchParams;
 return <MansionFailureViewer attempt={attempt==='0'?0:1}/>;
}
