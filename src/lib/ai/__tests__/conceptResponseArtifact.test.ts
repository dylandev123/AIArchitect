import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { retainConceptResponse, retainConceptValidation } from '../conceptResponseArtifact';

let directory: string | undefined;
afterEach(async () => { vi.restoreAllMocks(); if (directory) await rm(directory, { recursive: true, force: true }); });

it('retains exact original response bytes before parsing and never overwrites evidence', async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'concept-evidence-'));
  vi.spyOn(process, 'cwd').mockReturnValue(directory);
  const raw = ' { "buildings": [ { "footprint": "malformed" } ] }\n';
  const evidence = await retainConceptResponse(raw, { prompt: 'original brief' });
  const base = path.join(directory, '.v3-debug', 'concept-evaluations', evidence.sha256);
  expect(await readFile(`${base}.response.json`, 'utf8')).toBe(raw);
  expect(evidence.redacted).toBe(false);
  await retainConceptValidation(evidence.sha256, { findings: ['original failure'] });
  await retainConceptResponse(raw, { prompt: 'later brief' });
  await retainConceptValidation(evidence.sha256, { findings: [] });
  expect(JSON.parse(await readFile(`${base}.capture.json`, 'utf8')).context.prompt).toBe('original brief');
  expect(JSON.parse(await readFile(`${base}.validation.json`, 'utf8'))).toEqual({ findings: ['original failure'] });
});

it('returns safe response evidence when the host cannot write files', async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'concept-readonly-'));
  const file = path.join(directory, 'ordinary-file');
  const { writeFile } = await import('node:fs/promises'); await writeFile(file, 'not a directory');
  vi.spyOn(process, 'cwd').mockReturnValue(file);
  const evidence = await retainConceptResponse('{"invalid":true}', {});
  expect(evidence.rawResponse).toBe('{"invalid":true}');
  await expect(retainConceptValidation(evidence.sha256, {})).resolves.toBeUndefined();
});
