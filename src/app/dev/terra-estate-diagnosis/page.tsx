import { notFound } from 'next/navigation';
import { readFile } from 'node:fs/promises';
import { validateScene } from '@/lib/villa/scene/model';
import { EstateDiagnosisViewer } from './viewer';
export default async function Page({searchParams}:{searchParams:Promise<{example?:string}>}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const {example}=await searchParams;
  const selected=['railing','pool-link','suite-eaves'].includes(example??'')?example:undefined;
  const file=selected?`docs/architecture/terra-estate-diagnosis/${selected}.DEVELOPER.json`:'docs/architecture/terra-controlled-estate-2026-10-29/draft.REJECTED.json';
  const scene = validateScene(JSON.parse(await readFile(file, 'utf8')));
  return <EstateDiagnosisViewer scene={scene} developerExample={selected}/>;
}
