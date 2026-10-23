import { notFound } from 'next/navigation';
import { EstateExpressivenessViewer } from './viewer';
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <EstateExpressivenessViewer/>;}
