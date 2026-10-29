import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { GET } from './route';
import { replayRetainedVillaResponse } from '@/lib/villa/responseArtifact';
import { buildComposition, executeCompositionPatch } from '@/lib/villa/composition';

const id = '322247c40a2c1eb0b3e667280d7f9551759779cb4b753e6c925c386e99664036';
const original = await readFile(path.join(process.cwd(), 'src/lib/villa/__tests__/fixtures/cascade-skyline.response.json'), 'utf8');
let directory: string;
beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'development');
  directory = await mkdtemp(path.join(os.tmpdir(), 'mansion-recovery-'));
  vi.spyOn(process, 'cwd').mockReturnValue(directory);
  await mkdir(path.join(directory, '.data/villa-responses'), { recursive: true });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network prohibited'); }));
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); await rm(directory, { recursive: true, force: true }); });
const file = (hash: string) => path.join(directory, '.data/villa-responses', `${hash}.response.json`);
const get = () => GET(new Request('http://localhost/api/recovery/second-live'));
it('opens the retained four-level Villa without the unrelated missing V3 recovery or any provider request', async () => {
  await writeFile(file(id), original);
  const response = await get();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ url: `/dev/villa-playground?response=${id}` });
  const result = await replayRetainedVillaResponse(id);
  if (!result || !('version' in result.config)) throw new Error('Expected Villa composition');
  expect(result.config.forms?.[0].stack).toHaveLength(3);
  expect(buildComposition(result!.config).forms).toHaveLength(1);
  const edited = executeCompositionPatch(result!.config, { appearance: { exterior: 'sand' } });
  expect(edited.appearance.exterior).toBe('sand');
  expect(edited.forms).toEqual(result!.config.forms);
  expect(await readFile(file(id), 'utf8')).toBe(original);
  expect(fetch).not.toHaveBeenCalled();
});
it('reports a missing original precisely', async () => { expect((await get()).status).toBe(404); });
it('rejects a hash mismatch before parsing or normalizing', async () => {
  await writeFile(file(id), original + ' ');
  const response = await get();
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain('hash mismatch');
});
it('rejects an intact incompatible version with its schema path', async () => {
  const output = JSON.parse(original); output.changes.version = 99;
  const raw = JSON.stringify(output), hash = createHash('sha256').update(raw).digest('hex');
  await writeFile(file(hash), raw);
  await expect(replayRetainedVillaResponse(hash)).rejects.toMatchObject({ issues: expect.arrayContaining([expect.objectContaining({ path: ['changes', 'version'] })]) });
});
it('rejects invalid identifiers without accessing arbitrary files', async () => { expect(await replayRetainedVillaResponse('../original')).toBeUndefined(); });
