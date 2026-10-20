import { notFound } from 'next/navigation';
import { BlueprintConstructionViewer } from './viewer';
export default function Page() {
  if(process.env.NODE_ENV!=='development')notFound();
  return <BlueprintConstructionViewer/>;
}
