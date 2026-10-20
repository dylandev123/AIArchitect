import { notFound } from 'next/navigation';
import { GeometryAuthorityViewer } from './viewer';
export default function Page() {
  if(process.env.NODE_ENV!=='development')notFound();
  return <GeometryAuthorityViewer/>;
}
