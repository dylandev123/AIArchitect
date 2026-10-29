import { mockProposal, defaultPlacement } from '@/lib/villa/creation/model';
import { listCandidates } from '@/lib/villa/creation/store';
import { COMPOSITION_EXAMPLES } from '@/lib/villa/composition-examples';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import { Output } from 'ai';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import latest from '@/lib/villa/__tests__/fixtures/long-summary.response.json';
import { defaultVilla } from '@/lib/villa/design';
import fixture from '@/lib/villa/__tests__/fixtures/long-character.response.json';
import { buildComposition, compositionSchema } from '@/lib/villa/composition';
import { truncateCharacter, VILLA_TEXT_LIMITS } from '@/lib/villa/responseMetadata';
import { retainVillaResponse, replayRetainedVillaResponse } from '@/lib/villa/responseArtifact';
import { creativeExamples } from '@/lib/villa/creative-examples';
import { POST } from './route';

const mocks = vi.hoisted(() => ({ model: vi.fn() }));
vi.mock('ai', async original => {
  const sdk = await original<typeof import('ai')>();
  // Keep generateText and SDK parsing real; expose a spyable output factory.
  return { ...sdk, Output: { ...sdk.Output, object: sdk.Output.object } };
});
vi.mock('@/lib/ai/model', () => ({ getAiModel: () => mocks.model(), getAiModelId: () => 'offline-terra', isAiConfigured: () => true, AI_PROVIDER_OPTIONS: {} }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_meta: unknown, run: () => Promise<unknown>) => run() }));

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'villa-metadata-'));
  vi.spyOn(process, 'cwd').mockReturnValue(directory);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('Network forbidden in offline replay'); }));
  mocks.model.mockReset();
});
afterEach(async () => {
  expect(fetch).not.toHaveBeenCalled();
  vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});
function model(text: string, finish: 'stop' | 'length' = 'stop') {
  const provider = new MockLanguageModelV3({ doGenerate: {
    content: [{ type: 'text', text }], finishReason: { unified: finish, raw: finish }, warnings: [],
    usage: { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 80, text: 80, reasoning: 0 } },
  } });
  mocks.model.mockReturnValue(provider);
  return provider;
}
const call = () => POST(new Request('http://localhost/api/ai/villa', { method: 'POST', body: JSON.stringify({ mode: 'generate', prompt: 'Offline fixture replay' }) }));
const artifactPath = (id: string) => path.join(directory, '.data', 'villa-responses', `${id}.response.json`);

describe('Villa metadata replay through the real AI SDK, using only an offline provider', () => {
  it('accepts long display copy, retains exact original text, and builds the unchanged design', async () => {
    const raw = readFileSync(new URL('../../../../lib/villa/__tests__/fixtures/long-character.response.json', import.meta.url), 'utf8');
    const provider = model(raw);
    const response = await call(), body = await response.json();
    expect(response.status).toBe(200);
    expect(body.config).toEqual({ ...fixture.changes, character: truncateCharacter(fixture.changes.character) });
    expect(body.changes).toEqual(body.config);
    expect(body.diagnostics).toMatchObject({ retained: true, redacted: false });
    expect(await readFile(artifactPath(body.diagnostics.responseId), 'utf8')).toBe(raw);
    expect((await stat(artifactPath(body.diagnostics.responseId))).mode & 0o777).toBe(0o600);
    expect((await stat(path.dirname(artifactPath(body.diagnostics.responseId)))).mode & 0o777).toBe(0o700);
    expect(JSON.stringify(body)).not.toContain(fixture.changes.character);
    const built = buildComposition(compositionSchema.parse(body.config));
    expect(built.wings.map(w => w.id)).toEqual(['main', 'salon', 'breeze-link']);
    expect(built.terraces).toEqual(fixture.changes.terraces);
    expect(built.pool).toEqual(fixture.changes.pool);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it('replays the latest paid response through the real SDK, with strict wire limits and exact raw retention', async () => {
    const raw = readFileSync(new URL('../../../../lib/villa/__tests__/fixtures/long-summary.response.json', import.meta.url), 'utf8');
    const provider = model(raw), response = await call(), body = await response.json();
    expect(response.status).toBe(200);
    expect(body.summary.length).toBeLessThanOrEqual(600);
    for (const key of ['id', 'wings', 'connections', 'terraces', 'pool', 'appearance', 'components', 'landscapeMargin', 'siteMode']) expect(body.config[key]).toEqual(latest.changes[key as keyof typeof latest.changes]);
    expect(buildComposition(body.config).wings).toHaveLength(9);
    expect(await readFile(artifactPath(body.diagnostics.responseId), 'utf8')).toBe(raw);
    expect(await replayRetainedVillaResponse(body.diagnostics.responseId)).toMatchObject({ config: body.config });
    const format = provider.doGenerateCalls[0].responseFormat;
    if (format?.type !== 'json') throw Error('Expected structured response schema');
    const wire = format.schema as { properties: Record<string, { maxLength?: number; maxItems?: number; items?: { maxLength: number }; properties?: Record<string, { maxLength: number }> }> };
    expect(wire.properties.summary.maxLength).toBe(VILLA_TEXT_LIMITS.summary);
    expect(wire.properties.unsupported.maxItems).toBe(8);
    expect(wire.properties.unsupported.items?.maxLength).toBe(VILLA_TEXT_LIMITS.unsupported);
    expect(wire.properties.changes.properties?.name.maxLength).toBe(VILLA_TEXT_LIMITS.name);
    expect(wire.properties.changes.properties?.character.maxLength).toBe(VILLA_TEXT_LIMITS.character);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it.each(['composable', 'legacy'])('normalizes edit display metadata before SDK validation (%s)', async kind => {
    const current = kind === 'composable' ? compositionSchema.parse({ ...fixture.changes, character: 'Short' }) : defaultVilla('tuscan');
    const changes = { pool: { width: 12 } };
    const raw = JSON.stringify({ changes, summary: 's'.repeat(601), unsupported: Array.from({ length: 10 }, () => 'u'.repeat(201)) });
    const provider = model(raw);
    const response = await POST(new Request('http://localhost/api/ai/villa', { method: 'POST', body: JSON.stringify({ mode: 'edit', prompt: 'Pool only', current }) }));
    const body = await response.json();
    expect(response.status).toBe(200); expect(body.changes).toEqual(changes);
    expect(body.summary).toHaveLength(600); expect(body.unsupported).toHaveLength(10);
    expect(body.unsupported.every((s: string) => s.length === 200)).toBe(true);
    expect(body.config).toEqual({ ...current, pool: { ...current.pool, width: 12 } });
    expect(await readFile(artifactPath(body.diagnostics.responseId), 'utf8')).toBe(raw);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it('accepts absent or malformed display fields through SDK validation while retaining the originals', async () => {
    for (const copy of [{}, { name: null, character: [], summary: {}, unsupported: [null] }]) {
      const raw = JSON.stringify({ changes: { ...fixture.changes, name: copy.name, character: copy.character }, summary: copy.summary, unsupported: copy.unsupported });
      const provider = model(raw), response = await call(), body = await response.json();
      expect(response.status).toBe(200); expect(body.config.wings).toEqual(fixture.changes.wings);
      expect(await readFile(artifactPath(body.diagnostics.responseId), 'utf8')).toBe(raw);
      expect(provider.doGenerateCalls).toHaveLength(1);
    }
  });

  it('limits offline recovery to development-only retained hashes and rejects missing files', async () => {
    expect(await replayRetainedVillaResponse('../arbitrary')).toBeUndefined();
    expect(await replayRetainedVillaResponse('a'.repeat(64))).toBeUndefined();
    vi.stubEnv('NODE_ENV', 'production');
    expect(await replayRetainedVillaResponse('b'.repeat(64))).toBeUndefined();
  });

  it('captures before the SDK rejects construction fields and reports the exact remaining error', async () => {
    // Assert at the SDK validation entry point, so catch-time capture cannot pass this test.
    const objectOutput = Output.object;
    let checkedBeforeValidation = false;
    vi.spyOn(Output, 'object').mockImplementation(options => {
      const output = objectOutput(options);
      const parse = output.parseCompleteOutput;
      return { ...output, parseCompleteOutput: async (...args) => {
        const files = await readdir(path.join(directory, '.data', 'villa-responses'));
        expect(files).toHaveLength(1);
        expect(await readFile(path.join(directory, '.data', 'villa-responses', files[0]), 'utf8')).toBe(args[0].text);
        checkedBeforeValidation = true;
        return parse(...args);
      } };
    });
    const invalid = structuredClone(fixture);
    invalid.changes.wings[0].orientation = 45;
    const raw = JSON.stringify(invalid), provider = model(raw);
    const response = await call(), body = await response.json();
    expect(response.status).toBe(422); expect(body.config).toBeUndefined();
    expect(body.findings).toContainEqual(expect.objectContaining({ path: 'wings.main.orientation' }));
    expect(body.findings.some((f: { path: string }) => f.path === 'changes.character')).toBe(false);
    expect(await readFile(artifactPath(body.diagnostics.responseId), 'utf8')).toBe(raw);
    expect(provider.doGenerateCalls).toHaveLength(1);
    expect(checkedBeforeValidation).toBe(true);
  });

  it('retains locally rejected geometry without changing it', async () => {
    const invalid = structuredClone(fixture);
    invalid.changes.wings[1].x = -5; invalid.changes.wings[1].z = -7;
    const raw = JSON.stringify(invalid), provider = model(raw);
    const response = await call(), body = await response.json();
    expect(response.status).toBe(422);
    expect(body.findings).toContainEqual({ path: 'wings', message: expect.stringContaining('Overlapping') });
    expect(await readFile(artifactPath(body.diagnostics.responseId), 'utf8')).toBe(raw);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it.each(['stop', 'length'] as const)('retains malformed/truncated text (%s), redacting secrets before writing', async finish => {
    vi.stubEnv('VILLA_CAPTURE_TEST_SECRET', 'private-offline-secret-value');
    const raw = '{"changes":{"character":"Original long text","apiKey":"sk-offline-secret-key","note":"private-offline-secret-value"},"authorization":"Bearer credential-value",';
    const provider = model(raw, finish);
    const response = await call(), body = await response.json();
    expect(response.ok).toBe(false);
    expect(body.diagnostics).toMatchObject({ retained: true, redacted: true });
    const retained = await readFile(artifactPath(body.diagnostics.responseId), 'utf8');
    expect(retained).toContain('Original long text');
    for (const secret of ['sk-offline-secret-key', 'private-offline-secret-value', 'credential-value']) {
      expect(retained).not.toContain(secret); expect(JSON.stringify(body)).not.toContain(secret);
    }
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it.each([0,1,2])('constructs estate-scale example %s through the real SDK with no network', async index => {
    const c=creativeExamples()[index],raw=JSON.stringify({changes:c,summary:'Offline creative example.',unsupported:[]});
    const provider=model(raw),response=await call(),body=await response.json();
    expect(response.status).toBe(200);expect(body.config).toEqual(c);
    expect(buildComposition(body.config).wings).toHaveLength(c.wings.length+c.connections.length);
    expect(await readFile(artifactPath(body.diagnostics.responseId),'utf8')).toBe(raw);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it('captures an unknown component version with a clear missing-capability diagnostic',async()=>{
    const c=creativeExamples()[1];
    const raw=JSON.stringify({changes:{...c,components:[{...c.components![0],builder:'curved-pavilion@999'}]},summary:'Unavailable version',unsupported:[]});
    const provider=model(raw),response=await call(),body=await response.json();
    expect(response.status).toBe(422);expect(body.config).toBeUndefined();
    expect(body.findings).toContainEqual({path:'changes.components.0.builder',message:expect.stringContaining('Missing capability:')});
    expect(await readFile(artifactPath(body.diagnostics.responseId),'utf8')).toBe(raw);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it('automatically creates and saves a component through the real SDK and normal endpoint with no network',async()=>{
    const raw=JSON.stringify({changes:{...COMPOSITION_EXAMPLES[0],siteMode:'derived'},summary:'A house with a new experimental wave canopy.',unsupported:[],componentRequests:[{type:'create',id:'wave-shelter',missingCapability:'Original banked canopy absent from the approved catalogue.',proposal:mockProposal(),placement:defaultPlacement}]});
    const provider=model(raw), response=await call(), body=await response.json();
    expect(response.status).toBe(200);expect(body.providerCalls).toBe(1);
    expect(body.config.createdComponents[0]).toMatchObject({id:'wave-shelter',status:'experimental',candidateVersion:1,proposal:{geometry:{builder:'swept-ribbon@1'}}});
    expect(body.changes).toEqual(body.config);
    expect((await listCandidates())[0]).toMatchObject({status:'experimental',evidence:[],version:1});
    expect(await readFile(artifactPath(body.diagnostics.responseId),'utf8')).toBe(raw);
    expect((await replayRetainedVillaResponse(body.assembledDiagnostics.responseId))?.config).toEqual(body.config);
    await expect(replayRetainedVillaResponse(body.diagnostics.responseId)).rejects.toThrow(/assembledDiagnostics/);
    const trace=JSON.parse(await readFile(path.join(directory,'.data','villa-generations',body.generation.generationId+'.json'),'utf8'));
    expect(trace.metadata.stages).toContainEqual(expect.objectContaining({stage:'experimental-candidate-saved'}));
    expect(trace.metadata.usage.inputTokens).toBe(100);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it('retains rejected component responses before local validation without saving or retrying',async()=>{
    const proposal=mockProposal();proposal.geometry.height=3;proposal.geometry.width=5;proposal.geometry.stations=proposal.geometry.stations.map(s=>({...s,width:1.5,bank:18}));
    const raw=JSON.stringify({changes:{...COMPOSITION_EXAMPLES[0],siteMode:'derived'},summary:'Experimental canopy.',unsupported:[],componentRequests:[{type:'create',id:'wave',missingCapability:'Canopy',proposal,placement:defaultPlacement}]});
    const provider=model(raw),response=await call(),body=await response.json();
    expect(response.status).toBe(422);expect(body.config).toBeUndefined();
    expect(body.findings[0].message).toContain('soffit');
    expect(await listCandidates()).toEqual([]);
    expect(await readFile(artifactPath(body.diagnostics.responseId),'utf8')).toBe(raw);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });

  it('keeps capture development-only', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const provider = model(JSON.stringify(fixture));
    expect((await call()).status).toBe(404);
    expect(provider.doGenerateCalls).toHaveLength(0);
    expect(await retainVillaResponse(JSON.stringify(fixture))).toBeUndefined();
    expect(await readdir(directory)).toEqual([]);
  });

  it('keeps an accepted design usable when diagnostic storage is unavailable', async () => {
    await mkdir(path.join(directory, '.data'));
    await writeFile(path.join(directory, '.data', 'villa-responses'), 'Raw diagnostic directory unavailable in this fixture');
    const provider = model(JSON.stringify(fixture));
    const response = await call(), body = await response.json();
    expect(response.status).toBe(200);
    expect(body.diagnostics).toEqual({ retained: false });
    expect(body.config.wings).toEqual(fixture.changes.wings);
    expect(provider.doGenerateCalls).toHaveLength(1);
  });
});
