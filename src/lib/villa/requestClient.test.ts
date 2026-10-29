import { afterEach, expect, it, vi } from 'vitest';
import { fetchVillaRequest, recoverVillaRequest } from './requestClient';
import { VILLA_CLIENT_TIMEOUT_MS, VILLA_PROVIDER_TIMEOUT_MS } from './requestLifecycle';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it('makes one POST with a correlated ID and aligned bounded deadline', async () => {
  const timeout=vi.spyOn(AbortSignal,'timeout');
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>Response.json({config:{id:'accepted'}}));vi.stubGlobal('fetch',fetch);
  expect(await fetchVillaRequest({prompt:'mansion'},'request-id')).toEqual({config:{id:'accepted'}});
  expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0]).toMatchObject(['/api/ai/villa',{method:'POST',headers:{'X-Villa-Request-ID':'request-id'}}]);
  expect(timeout).toHaveBeenCalledWith(VILLA_CLIENT_TIMEOUT_MS);expect(VILLA_CLIENT_TIMEOUT_MS).toBeGreaterThan(VILLA_PROVIDER_TIMEOUT_MS);
});
it.each(['AbortError','TimeoutError','TypeError'])('reports browser %s and never automatically retries or mutates the current villa',async name=>{
  const current={name:'Existing villa'};const fetch=vi.fn<typeof globalThis.fetch>(async()=>{throw new DOMException('Fetch is aborted',name);});vi.stubGlobal('fetch',fetch);
  await expect(fetchVillaRequest({mode:'edit',current},'id')).rejects.toThrow('Check the retained request');
  expect(fetch).toHaveBeenCalledTimes(1);expect(current).toEqual({name:'Existing villa'});
});
it('reports a server failure without treating it as architectural validation',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response('<h1>Server failure</h1>',{status:500}));vi.stubGlobal('fetch',fetch);
  await expect(fetchVillaRequest({},'id')).rejects.toThrow('unreadable server response (500)');expect(fetch).toHaveBeenCalledTimes(1);
});
it('recovers only through GET and does not resubmit pending or failed requests',async()=>{
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>Response.json({error:'Request still pending; no automatic retry.'},{status:202}));vi.stubGlobal('fetch',fetch);
  await expect(recoverVillaRequest('id')).rejects.toThrow('pending');expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0]).toMatchObject(['/api/ai/villa?requestId=id',{cache:'no-store'}]);
  expect(fetch.mock.calls[0][1]).not.toHaveProperty('body');
});

it('reports an abort while consuming the response body as a lifecycle failure', async () => {
  const response=Response.json({});vi.spyOn(response,'json').mockRejectedValue(new DOMException('Fetch is aborted','AbortError'));
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>response);vi.stubGlobal('fetch',fetch);
  await expect(fetchVillaRequest({},'id')).rejects.toThrow('browser request was cancelled');expect(fetch).toHaveBeenCalledTimes(1);
});
