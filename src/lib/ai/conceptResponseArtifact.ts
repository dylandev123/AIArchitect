/** Development-only, immutable evidence captured before concept parsing/validation. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { planResponseEvidence, type PlanResponseEvidence } from './planResponseArtifact';

export async function retainConceptResponse(raw: string, context: unknown): Promise<PlanResponseEvidence> {
  const evidence = planResponseEvidence(raw);
  try {
    const directory = path.join(process.cwd(), '.v3-debug', 'concept-evaluations');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await Promise.allSettled([
      writeFile(path.join(directory, `${evidence.sha256}.response.json`), evidence.rawResponse, { flag: 'wx', mode: 0o600 }),
      writeFile(path.join(directory, `${evidence.sha256}.capture.json`), JSON.stringify({ ...evidence, context }, null, 2), { flag: 'wx', mode: 0o600 }),
    ]);
  } catch { /* Return evidence even on read-only hosts; never overwrite an earlier response. */ }
  return evidence;
}

export async function retainConceptValidation(sha256: string, validation: unknown): Promise<void> {
  try {
    await writeFile(path.join(process.cwd(), '.v3-debug', 'concept-evaluations', `${sha256}.validation.json`), JSON.stringify(validation, null, 2), { flag: 'wx', mode: 0o600 });
  } catch { /* Evidence is also returned to the development client. */ }
}
