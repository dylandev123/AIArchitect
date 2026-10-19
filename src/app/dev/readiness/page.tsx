import { notFound } from 'next/navigation';
import { READINESS_FIXTURES, type ReadinessFixture } from '@/lib/v3/parity/readiness';
import { ReadinessViewer } from './viewer';
export default async function Page({searchParams}:{searchParams:Promise<{fixture?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {fixture}=await searchParams;
 return <ReadinessViewer fixture={READINESS_FIXTURES.includes(fixture as ReadinessFixture)?fixture as ReadinessFixture:'monumental-modern'}/>;
}
