import {notFound} from 'next/navigation';
import {compactFamilyHome,asymmetricMultilevel,courtyardHouse,luxuryEstate} from '@/lib/villa/canonical/spatial.fixture';
import {compileArchitecturalPlan} from '@/lib/villa/canonical/plan';
import {CanonicalCheckpoint} from '../canonical-expressiveness/viewer';
const fixtures={compact:compactFamilyHome,multilevel:asymmetricMultilevel,courtyard:courtyardHouse,estate:luxuryEstate};
/** Developer-only: the four whole-building fixtures in the real renderer. Developer-authored, not AI output. */
export default async function Page({searchParams}:{searchParams:Promise<{case?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const {case:name='compact'}=await searchParams;
 if(!(name in fixtures))notFound();
 return <CanonicalCheckpoint initial={compileArchitecturalPlan(fixtures[name as keyof typeof fixtures]()).scene}/>;
}
