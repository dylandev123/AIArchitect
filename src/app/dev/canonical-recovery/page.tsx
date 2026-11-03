import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {compileArchitecturalPlan} from '@/lib/villa/canonical/plan';
import {RecoveryViewer} from './viewer';

/** Developer-only: compiles the labelled diagnostic working copy with the real compiler and renders it unchanged. Not an accepted Terra generation. */
export default async function Page() {
 if(process.env.NODE_ENV!=='development')notFound();
 const file=JSON.parse(await readFile('docs/architecture/canonical-recovery-2026-11-03/diagnostic-plan.json','utf8'));
 return <RecoveryViewer scene={compileArchitecturalPlan(file.plan).scene} label={file.label}/>;
}
