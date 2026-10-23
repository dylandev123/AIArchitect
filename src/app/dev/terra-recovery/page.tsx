import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { notFound } from 'next/navigation';
import { TerraRecovery } from './viewer';

export default async function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const sha256 = '3b599d4ffe1a888a97610eb1622b620cc055cadfa69f84050767fd471d4c9787';
  const raw = await readFile(`${process.cwd()}/.v3-debug/plan-evaluations/${sha256}.response.json`, 'utf8');
  if (createHash('sha256').update(raw).digest('hex') !== sha256) throw Error('Retained response integrity failure');
  return <TerraRecovery rawResponse={raw} sha256={sha256} />;
}
