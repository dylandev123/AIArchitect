import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { retainPlanResponse } from '../planResponseArtifact';

let directory:string;
beforeEach(async()=>{
  directory=await mkdtemp(path.join(os.tmpdir(),'plan-capture-'));
  vi.spyOn(process,'cwd').mockReturnValue(directory);
  vi.stubEnv('NODE_ENV','production');
});
afterEach(async()=>{vi.restoreAllMocks();vi.unstubAllEnvs();await rm(directory,{recursive:true,force:true});});

it('retains exact UTF-8 text in production with private, independent, immutable files',async()=>{
  const raw=' \r\n{ "name": "Cour élégante", "buildings": [] }\n';
  const evidence=await retainPlanResponse(raw),base=path.join(directory,'.v3-debug/plan-evaluations');
  expect(evidence).toMatchObject({rawResponse:raw,sha256:createHash('sha256').update(raw).digest('hex'),bytes:Buffer.byteLength(raw),redacted:false});
  const file=path.join(base,`${evidence.sha256}.response.json`);
  expect(await readFile(file,'utf8')).toBe(raw);
  expect((await stat(base)).mode&0o777).toBe(0o700);
  expect((await stat(file)).mode&0o777).toBe(0o600);
  expect(JSON.parse(await readFile(path.join(base,`${evidence.sha256}.capture.json`),'utf8'))).toEqual(evidence);
  await writeFile(file,'existing evidence');
  await retainPlanResponse(raw);
  await retainPlanResponse('{"name":"another plan"}');
  expect(await readFile(file,'utf8')).toBe('existing evidence');
  expect(await readdir(base)).toHaveLength(4);
});

it('returns the safe capture when the host cannot persist files',async()=>{
  vi.mocked(process.cwd).mockReturnValue('/invalid\0');
  await expect(retainPlanResponse('{"token":"private"}')).resolves.toMatchObject({rawResponse:'{"token":"[REDACTED]"}',redacted:true});
});
