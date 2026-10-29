import { NoObjectGeneratedError } from 'ai';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { COMPOSITION_EXAMPLES } from '@/lib/villa/composition-examples';
import { validateComposition } from '@/lib/villa/composition';
import { VILLA_LIMITS } from '@/lib/villa/limits';
import { defaultVilla } from '@/lib/villa/design';
const generate = vi.hoisted(() => vi.fn());
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: generate }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_meta: unknown, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/villa/responseArtifact', () => ({ retainVillaGeneration: vi.fn(async () => ({ retained:true })), retainVillaResponse: vi.fn(async () => ({ retained: true })) }));
vi.mock('@/lib/villa/requestArtifact', () => ({ beginVillaRequest: vi.fn(async () => true), finishVillaRequest: vi.fn(async () => {}), readVillaRequest: vi.fn() }));
import { POST } from './route';
const usage = { inputTokens: 100, outputTokens: 80 };
const call = (body: unknown) => POST(new Request('http://localhost/api/ai/villa', { method: 'POST', body: JSON.stringify(body) }));
beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('OPENAI_API_KEY', 'offline-placeholder-not-sent'); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
describe('villa Terra boundary', () => {
  it('generates a validated config in exactly one call with zero retries and no geometry tools', async () => {
    generate.mockResolvedValue({ output: { changes: COMPOSITION_EXAMPLES[2], summary: 'An asymmetric court.', unsupported: [] }, finishReason: 'stop', totalUsage: usage });
    const response = await call({ prompt: 'An $8 million Spanish courtyard villa', mode: 'generate' });
    expect(response.status).toBe(200); const body = await response.json();
    expect(body.config).toEqual(validateComposition({...COMPOSITION_EXAMPLES[2],siteMode:'derived'})); expect(body.providerCalls).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
    const args = generate.mock.calls[0][0]; expect(args.maxRetries).toBe(0); expect(args.tools).toBeUndefined();
    expect(args.system).toContain('Never return meshes'); expect(args.maxOutputTokens).toBe(VILLA_LIMITS.outputTokens);
  });
  it('honours an authoritative fixed lot even when the provider requests a derived garden', async()=>{
    const candidate={...COMPOSITION_EXAMPLES[0],siteMode:'derived'};
    generate.mockResolvedValue({output:{changes:candidate,summary:'House.',unsupported:[]},finishReason:'stop',totalUsage:usage});
    const site={x:0,z:0,width:12,depth:12};
    const response=await call({prompt:'Fit this lot',mode:'generate',site});
    expect(response.status).toBe(422);const body=await response.json();
    expect(body.config).toBeUndefined();expect(body.findings[0].message).toContain('outside the garden');
    expect(generate.mock.calls[0][0].prompt).toContain(JSON.stringify(site));
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('edits composed wings atomically and returns actionable diagnostics without repair calls', async () => {
    const current = structuredClone(COMPOSITION_EXAMPLES[1]);
    generate.mockResolvedValue({output:{changes:{wings:[{type:'adjust',id:'salon',changes:{storeyHeight:4.2}}]},summary:'Raised salon.',unsupported:[]},finishReason:'stop',totalUsage:usage});
    const success=await call({prompt:'Raise the salon to 4.2m',mode:'edit',current});
    expect(success.status).toBe(200);const body=await success.json();
    expect(body.config.wings[0]).toEqual(current.wings[0]);expect(body.config.wings[1].storeyHeight).toBe(4.2);
    expect(body.config.terraces).toEqual(current.terraces);
    generate.mockResolvedValue({output:{changes:{wings:[{type:'adjust',id:'salon',changes:{x:-5,z:-7}}]},summary:'Moved salon.',unsupported:[]},finishReason:'stop',totalUsage:usage});
    const rejected=await call({prompt:'Move salon',mode:'edit',current});expect(rejected.status).toBe(422);
    const invalid=await rejected.json();expect(invalid.config).toBeUndefined();expect(invalid.findings[0].message).toContain('Overlapping');
    expect(generate).toHaveBeenCalledTimes(2);expect(current.wings[1].x).toBe(9);
  });
  it('reports the exact field for unsupported orientations',async()=>{
    const config=structuredClone(COMPOSITION_EXAMPLES[0]);
    (config.wings[0] as {orientation:number}).orientation=45;
    generate.mockResolvedValue({output:{changes:config,summary:'Unsupported rotation.',unsupported:[]},finishReason:'stop',totalUsage:usage});
    const response=await call({prompt:'Diagonal villa',mode:'generate'});
    expect(response.status).toBe(422);
    const body=await response.json();expect(body.findings.some((f:{path:string})=>f.path==='wings.main.orientation')).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('recovers local field diagnostics when the SDK rejects the structured output first',async()=>{
    const config=structuredClone(COMPOSITION_EXAMPLES[0]);
    (config.wings[0] as {orientation:number}).orientation=45;
    generate.mockRejectedValue(new NoObjectGeneratedError({
      text:JSON.stringify({changes:config,summary:'Unsupported.',unsupported:[]}),
      response:{id:'offline',timestamp:new Date(),modelId:'offline'},finishReason:'stop',
      usage:{inputTokens:100,outputTokens:80,totalTokens:180,inputTokenDetails:{noCacheTokens:100,cacheReadTokens:0,cacheWriteTokens:0},outputTokenDetails:{textTokens:80,reasoningTokens:0}},
    }));
    const response=await call({prompt:'Diagonal villa',mode:'generate'}),body=await response.json();
    expect(response.status).toBe(422);expect(body.findings.some((f:{path:string})=>f.path==='wings.main.orientation')).toBe(true);
    expect(body.changes).toBeUndefined();expect(generate).toHaveBeenCalledTimes(1);
  });
  it('rejects an invalid current composition before any provider call',async()=>{
    const current=structuredClone(COMPOSITION_EXAMPLES[0]);current.pool!.z=-5;
    const response=await call({prompt:'Improve it',mode:'edit',current});
    expect(response.status).toBe(400);expect((await response.json()).providerCalls).toBe(0);expect(generate).not.toHaveBeenCalled();
  });
  it('edits only the requested pool field and preserves every unrelated choice', async () => {
    const current = { ...defaultVilla('tuscan'), scale: .91, verandaDepth: 2.6 };
    generate.mockResolvedValue({ output: { changes: { pool: { width: 12 } }, summary: 'A shorter pool.', unsupported: [] }, finishReason: 'stop', totalUsage: usage });
    const response = await call({ prompt: 'Make the pool 12 metres long only', mode: 'edit', current });
    const body = await response.json(); expect(response.status).toBe(200);
    expect(body.config).toEqual({ ...current, pool: { ...current.pool, width: 12 } });
    expect(body.changes).toEqual({ pool: { width: 12 } }); expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0].prompt).toContain(JSON.stringify(current));
  });
  it.each([
    { changes: { style: 'spanish' }, summary: 'Incomplete', unsupported: [] },
    { changes: { ...defaultVilla('modern'), roof: 'dome' }, summary: 'Unsupported', unsupported: [] },
    { changes: { ...defaultVilla('modern'), roof: 'hip' }, summary: 'Incompatible', unsupported: [] },
    { changes: { ...defaultVilla('spanish'), vertices: [1, 2, 3] }, summary: 'Raw geometry', unsupported: [] },
  ])('rejects invalid model output without repairs or fallback generation', async output => {
    generate.mockResolvedValue({ output, finishReason: 'stop', totalUsage: usage });
    const response = await call({ prompt: 'Design a villa', mode: 'generate' });
    expect(response.status).toBe(422); expect((await response.json()).config).toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('reports unsupported features without claiming nonexistent components', async () => {
    generate.mockResolvedValue({ output: { changes: {}, summary: 'Domes are not supported.', unsupported: ['Domed roofs'] }, finishReason: 'stop', totalUsage: usage });
    const current = defaultVilla('spanish');
    const response = await call({ prompt: 'Add a dome', mode: 'edit', current });
    const body = await response.json(); expect(body.config).toEqual(current); expect(body.unsupported).toEqual(['Domed roofs']);
  });
  it('rejects truncated output and does not retry', async () => {
    generate.mockResolvedValue({ finishReason: 'length', totalUsage: usage });
    const response = await call({ prompt: 'A villa', mode: 'generate' });
    expect(response.status).toBe(502); expect(generate).toHaveBeenCalledTimes(1);
  });
  it('does not expose raw provider errors or secrets', async () => {
    generate.mockRejectedValue(new Error('sensitive transport diagnostic'));
    const response = await call({ prompt: 'A villa', mode: 'generate' });
    expect(response.status).toBe(502); expect(JSON.stringify(await response.json())).not.toContain('sensitive');
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it.each([{ mode: 'edit', prompt: 'A villa' }, { mode: 'generate', prompt: '' }, { mode: 'generate', prompt: 'x', current: { style: 'bad' } }])('rejects bad requests before a provider call', async body => {
    expect((await call(body)).status).toBe(400); expect(generate).not.toHaveBeenCalled();
  });
  it('returns 503 without a key and 404 outside development, without calls', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect((await call({ prompt: 'A villa', mode: 'generate' })).status).toBe(503);
    vi.stubEnv('NODE_ENV', 'production');
    expect((await call({ prompt: 'A villa', mode: 'generate' })).status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });
});
