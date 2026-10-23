import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveVillaResult } from './terra';
import { redactV3FailureText } from '@/lib/ai/v3FailureArtifact';

/** Server-only, development-only evidence. Never send original provider text to the client. */
export async function retainVillaResponse(rawResponse: string) {
  if (process.env.NODE_ENV !== 'development') return undefined;
  try {
    const safeResponse = redactV3FailureText(rawResponse);
    const responseId = createHash('sha256').update(safeResponse, 'utf8').digest('hex');
    const redacted = safeResponse !== rawResponse;
    const directory = path.join(process.cwd(), '.data', 'villa-responses');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(path.join(directory, `${responseId}.response.json`), safeResponse, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    return { responseId, retained: true, redacted };
  } catch {
    // Diagnostic storage failure must not replace an accepted villa or mask validation findings.
    return { retained: false };
  }
}

/** Offline generation recovery, addressed only by a retained content hash. */
export async function replayRetainedVillaResponse(responseId: string) {
  if (process.env.NODE_ENV !== 'development' || !/^[a-f0-9]{64}$/.test(responseId)) return undefined;
  try {
    const raw = await readFile(path.join(process.cwd(), '.data', 'villa-responses', `${responseId}.response.json`), 'utf8');
    return resolveVillaResult({ mode: 'generate', prompt: 'Offline retained villa recovery' }, JSON.parse(raw));
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error; // A retained architecture error must never become a substitute villa.
  }
}
