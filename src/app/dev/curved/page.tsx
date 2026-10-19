import { notFound } from 'next/navigation';
import { CURVED_FIXTURES, type CurvedFixture } from '@/lib/v3/parity/curved';
import { CurvedViewer } from './viewer';
export default async function Page({searchParams}:{searchParams:Promise<{fixture?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {fixture}=await searchParams;
 return <CurvedViewer fixture={CURVED_FIXTURES.includes(fixture as CurvedFixture)?fixture as CurvedFixture:'circular-pavilion'}/>;
}
