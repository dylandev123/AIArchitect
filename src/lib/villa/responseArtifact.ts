import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CompositionError } from './composition';
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
    if (createHash('sha256').update(raw, 'utf8').digest('hex') !== responseId) {
      throw new Error('Saved Villa response hash mismatch. Original files were preserved.');
    }
    const output=JSON.parse(raw);
    if(output.componentRequests?.some((r:{type:string})=>r.type==='create'||r.type==='reuse')) throw new CompositionError([{path:'componentRequests',message:'This raw provider response needs local component assembly. Recover using the assembledDiagnostics response ID to preserve all pinned geometry.'}]);
    return resolveVillaResult({ mode: 'generate', prompt: 'Offline retained villa recovery' }, output);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error; // A retained architecture error must never become a substitute villa.
  }
}

/** Private stage and usage trace; raw responses are retained separately before validation. */
export async function retainVillaGeneration(metadata: unknown) {
  if(process.env.NODE_ENV!=='development') return undefined;
  try {
    const generationId=randomUUID();
    const directory=path.join(process.cwd(),'.data','villa-generations');
    await mkdir(directory,{recursive:true,mode:0o700});
    await writeFile(path.join(directory,`${generationId}.json`),JSON.stringify({generationId,createdAt:new Date().toISOString(),metadata}),{flag:'wx',mode:0o600});
    return {generationId,retained:true};
  } catch {return {retained:false};}
}
