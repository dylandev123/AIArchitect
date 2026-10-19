import { notFound } from 'next/navigation';
import { FOOTPRINT_FIXTURES, type FootprintFixture } from '@/lib/v3/parity/nonrectangular';
import { FootprintViewer } from './viewer';
export default async function Page({searchParams}:{searchParams:Promise<{fixture?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {fixture}=await searchParams;
 return <FootprintViewer fixture={FOOTPRINT_FIXTURES.includes(fixture as FootprintFixture)?fixture as FootprintFixture:'l-residence'}/>;
}
