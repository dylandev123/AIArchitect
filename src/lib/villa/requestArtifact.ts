import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const valid = (id: string) => /^[a-f0-9-]{36}$/.test(id);
const directory = () => path.join(process.cwd(), '.data', 'villa-requests');
/** A durable exclusive claim prevents a repeated POST from buying another generation. */
export async function beginVillaRequest(id: string, metadata: unknown) {
  if (!valid(id)) throw new Error('Invalid request ID');
  await mkdir(directory(), { recursive: true, mode: 0o700 });
  try {
    await writeFile(path.join(directory(), `${id}.started.json`), JSON.stringify({ requestId: id, startedAt: new Date().toISOString(), metadata }), { flag: 'wx', mode: 0o600 });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}
export async function finishVillaRequest(id: string, status: number, body: unknown, evidence: unknown) {
  // Write the complete validated response before attempting browser delivery. Never raw provider text.
  const temporary = path.join(directory(), `${id}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, JSON.stringify({ status, body, completedAt: new Date().toISOString(), evidence }), { flag: 'wx', mode: 0o600 });
    await rename(temporary, path.join(directory(), `${id}.completed.json`));
  } finally { await rm(temporary, { force: true }); }
}
export async function readVillaRequest(id: string) {
  if (!valid(id)) return undefined;
  try {
    const started = JSON.parse(await readFile(path.join(directory(), `${id}.started.json`), 'utf8'));
    try {
      const complete = JSON.parse(await readFile(path.join(directory(), `${id}.completed.json`), 'utf8'));
      return { state: 'completed' as const, ...complete };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return { state: 'pending' as const, startedAt: started.startedAt };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}
