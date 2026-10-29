import * as automatic from '@/lib/villa/creation/automatic';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import { APICallError } from 'ai';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import fixture from '@/lib/villa/__tests__/fixtures/long-character.response.json';
import { VILLA_PROVIDER_TIMEOUT_MS } from '@/lib/villa/requestLifecycle';
import { POST, GET } from './route';

const mocks = vi.hoisted(() => ({ model: vi.fn() }));
vi.mock('@/lib/ai/model', () => ({ getAiModel: () => mocks.model(), getAiModelId: () => 'offline-terra', isAiConfigured: () => true, AI_PROVIDER_OPTIONS: {} }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_meta: unknown, run: () => Promise<unknown>) => run() }));
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'villa-lifecycle-'));
  vi.spyOn(process, 'cwd').mockReturnValue(directory);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('Live network forbidden'); }));
});
afterEach(async () => {
  expect(fetch).not.toHaveBeenCalled();
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});
const id = '11111111-1111-4111-8111-111111111111';
const request = (signal?: AbortSignal) => new Request('http://localhost/api/ai/villa', { method: 'POST', headers: { 'X-Villa-Request-ID': id }, body: JSON.stringify({mode:'generate',prompt:'Four-storey mansion with rooftop terrace'}), signal });
const recover = () => GET(new Request(`http://localhost/api/ai/villa?requestId=${id}`));
const providerResult = () => ({ content: [{ type: 'text' as const, text: JSON.stringify(fixture) }], finishReason: { unified: 'stop' as const, raw: 'stop' }, warnings: [], response: { headers: { 'x-request-id': 'req-offline' } }, usage: { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 80, text: 80, reasoning: 0 } } });
function delayedProvider() {
  let finish!: (value: ReturnType<typeof providerResult>) => void;
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const provider = new MockLanguageModelV3({ doGenerate: options => new Promise((resolve, reject) => {
    finish = resolve; started();
    options.abortSignal?.addEventListener('abort', () => reject(options.abortSignal?.reason), {once:true});
  }) });
  mocks.model.mockReturnValue(provider);
  return {provider,ready,finish:()=>finish(providerResult())};
}
describe('Villa request lifecycle through real SDK, no network', () => {
  it('completes normally, persists the response before delivery, and deduplicates repeated POSTs', async () => {
    const mock=delayedProvider();const pending=POST(request());await mock.ready;
    expect((await recover()).status).toBe(202);
    expect((await POST(request())).status).toBe(202);
    mock.finish();const response=await pending;expect(response.status).toBe(200);
    const body=await response.json();expect(body.requestId).toBe(id);expect(body.recoveryRetained).toBe(true);
    const recovered=await (await recover()).json();expect(recovered.config).toEqual(body.config);
    expect((await POST(request())).status).toBe(200);
    expect(mock.provider.doGenerateCalls).toHaveLength(1);
  });
  it('allows slow generation within the bounded provider deadline', async () => {
    vi.useFakeTimers();const mock=delayedProvider();const pending=POST(request());await mock.ready;
    await vi.advanceTimersByTimeAsync(150_000);
    expect(mock.provider.doGenerateCalls[0].abortSignal?.aborted).toBe(false);
    mock.finish();expect((await pending).status).toBe(200);
    expect(mock.provider.doGenerateCalls).toHaveLength(1);
  });
  it('retains and recovers the completed response after client cancellation, without another call', async () => {
    const client=new AbortController();const mock=delayedProvider();const pending=POST(request(client.signal));await mock.ready;
    client.abort();expect(mock.provider.doGenerateCalls[0].abortSignal?.aborted).toBe(false);
    mock.finish();await pending;
    const response=await recover();expect(response.status).toBe(200);
    const body=await response.json();expect(body.config.wings).toEqual(fixture.changes.wings);
    const evidence=JSON.parse(await readFile(path.join(directory,'.data','villa-requests',`${id}.completed.json`),'utf8')).evidence;
    expect(evidence).toMatchObject({clientDisconnected:true,providerCompleted:true,providerRequestId:'req-offline',usageKnown:true});
    expect(mock.provider.doGenerateCalls).toHaveLength(1);
  });
  it('times out a stalled provider with unknown usage, no validation findings, and no retry', async () => {
    vi.useFakeTimers();const mock=delayedProvider();const pending=POST(request());await mock.ready;
    await vi.advanceTimersByTimeAsync(VILLA_PROVIDER_TIMEOUT_MS);
    const response=await pending;expect(response.status).toBe(504);
    const body=await response.json();expect(body.code).toBe('provider_timeout');expect(body.findings).toBeUndefined();expect(body.config).toBeUndefined();
    expect((await recover()).status).toBe(504);expect(mock.provider.doGenerateCalls).toHaveLength(1);
    const evidence=JSON.parse(await readFile(path.join(directory,'.data','villa-requests',`${id}.completed.json`),'utf8')).evidence;
    expect(evidence).toMatchObject({usageKnown:false,providerCompleted:false});
  });
  it('reports actual provider HTTP failure without geometry diagnostics or exposing raw errors', async () => {
    const provider=new MockLanguageModelV3({doGenerate:async()=>{throw new APICallError({message:'secret upstream detail',url:'https://offline.invalid',requestBodyValues:{},statusCode:503,responseBody:'{"error":{"code":"server_error"}}',isRetryable:true});}});mocks.model.mockReturnValue(provider);
    const response=await POST(request());expect(response.status).toBe(502);
    const body=await response.json();expect(body.code).toBe('server_error');expect(body.findings).toBeUndefined();expect(JSON.stringify(body)).not.toContain('secret');expect(provider.doGenerateCalls).toHaveLength(1);
  });
  it('reports a local server failure separately and retains the completed provider response', async () => {
    vi.spyOn(automatic,'assembleAutomaticComponents').mockRejectedValueOnce(new Error('private processing failure'));
    const mock=delayedProvider();const pending=POST(request());await mock.ready;mock.finish();
    const response=await pending;expect(response.status).toBe(500);const body=await response.json();
    expect(body.code).toBe('server_processing_error');expect(body.diagnostics.retained).toBe(true);expect(body.config).toBeUndefined();
    expect(body.findings).toBeUndefined();expect(mock.provider.doGenerateCalls).toHaveLength(1);
    expect((await recover()).status).toBe(500);
  });
  it('does not dispatch requests cancelled before provider invocation', async () => {
    const client=new AbortController();client.abort();const mock=delayedProvider();
    const response=await POST(request(client.signal));expect(response.status).toBe(499);expect(mock.provider.doGenerateCalls).toHaveLength(0);
  });
  it('does not buy a generation when request recovery storage is unavailable', async () => {
    await writeFile(path.join(directory,'.data'),'blocked');const mock=delayedProvider();
    expect((await POST(request())).status).toBe(503);expect(mock.provider.doGenerateCalls).toHaveLength(0);
  });
  it('preserves an interrupted-server record as pending instead of repeating the provider request', async () => {
    const mock=delayedProvider();const pending=POST(request());await mock.ready;
    const started=await readdir(path.join(directory,'.data','villa-requests'));expect(started).toEqual([`${id}.started.json`]);
    const record=await (await recover()).json();expect(record.state).toBe('pending');expect(record.error).toContain('server may have stopped');
    mock.finish();await pending;
  });
});
