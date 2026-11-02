import {notFound} from 'next/navigation';
import {compositionFixture} from '@/lib/villa/canonical/compositions.fixture';
import {compileArchitecturalPlan} from '@/lib/villa/canonical/plan';
import {CanonicalCheckpoint} from './viewer';
export default async function Page({searchParams}:{searchParams:Promise<{case?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {case:name='compact'}=await searchParams;if(name!=='compact'&&name!=='waterfront'&&name!=='courtyard')notFound();
 return <CanonicalCheckpoint initial={compileArchitecturalPlan(compositionFixture(name)).scene}/>;
}
