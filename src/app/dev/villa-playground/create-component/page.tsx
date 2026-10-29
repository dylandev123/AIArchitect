import { notFound } from 'next/navigation';
import { CreationWorkshop } from './workshop';
export default function Page() {
  if(process.env.NODE_ENV!=='development') notFound();
  return <CreationWorkshop />;
}
