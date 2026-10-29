import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { defaultVilla } from '@/lib/villa/design';
const generate = vi.hoisted(() => vi.fn());
vi.mock('ai', async original => ({ ...await original<typeof import('ai')>(), generateText: generate }));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_meta: unknown, run: () => Promise<unknown>) => run() }));
import { POST } from './route';
const image = () => {
  const header = Buffer.alloc(36); Buffer.from('\x89PNG\r\n\x1a\n', 'binary').copy(header);
  header.write('IHDR', 12); header.writeUInt32BE(640, 16); header.writeUInt32BE(360, 20);
  return `data:image/png;base64,${header.toString('base64')}`;
};
const body = () => ({ brief: 'Original Caribbean villa brief', current: defaultVilla('modern'), unresolved: ['No interiors'], images: [image(), image(), image()] });
const call = (input = body()) => POST(new Request('http://localhost/api/ai/villa/visual-review', { method: 'POST', body: JSON.stringify(input) }));
beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('OPENAI_API_KEY', 'offline-placeholder-never-used'); generate.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
describe('development vision review boundary (provider mocked)', () => {
  it('sends the original brief, validated config, unresolved features and three labeled images once', async () => {
    generate.mockResolvedValue({ output: { weaknesses: ['one', 'two', 'three'], improvement: 'Sand finish', scope: ['exterior'] }, totalUsage: { inputTokens: 100, outputTokens: 30 } });
    const response = await call(); expect(response.status).toBe(200);
    const args = generate.mock.calls[0][0];
    expect(args.maxRetries).toBe(0); expect(args.tools).toBeUndefined();
    expect(args.messages[0].content).toHaveLength(4);
    expect(JSON.parse(args.messages[0].content[0].text)).toMatchObject({ brief: body().brief, current: body().current, unresolved: body().unresolved });
    expect(args.system).toContain('aerial, arrival, poolside'); expect(args.system).toContain('Supported customization contract');
    const result = await response.json(); expect(result.providerCalls).toBe(1); expect(result.usage.inputTokens).toBe(100); expect(result).toHaveProperty('costUsd');
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('blocks malformed captures before any call', async () => {
    expect((await call({ ...body(), images: ['overlay', 'overlay', 'overlay'] })).status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it('blocks missing configuration and production without calls', async () => {
    vi.stubEnv('OPENAI_API_KEY', ''); expect((await call()).status).toBe(503);
    vi.stubEnv('NODE_ENV', 'production'); expect((await call()).status).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });
  it('reports one failed call with no retry and no raw provider error', async () => {
    generate.mockRejectedValue(new Error('private provider details'));
    const response = await call(), result = await response.json();
    expect(result.providerCalls).toBe(1); expect(result.error).not.toContain('private provider'); expect(generate).toHaveBeenCalledTimes(1);
  });
});
it('includes the approved concept as a separate fourth image without extra calls',async()=>{
 generate.mockResolvedValue({output:{weaknesses:['one','two','three'],improvement:'Sand finish',scope:['exterior']},totalUsage:{inputTokens:100,outputTokens:30}});
 const request={...body(),reference:{source:'retained-concept',image:image()}};
 const response=await POST(new Request('http://localhost/api/ai/villa/visual-review',{method:'POST',body:JSON.stringify(request)}));
 expect(response.status).toBe(200);const args=generate.mock.calls[0][0];expect(args.messages[0].content).toHaveLength(6);expect(args.messages[0].content[4].text).toContain('Approved concept');expect(args.system).toContain('approved concept');expect(generate).toHaveBeenCalledTimes(1);
});
it('transports actual retained direct-scene PNGs with constructed IDs and separate design intent (provider mocked)',async()=>{
 const {readFileSync}=await import('node:fs');
 const {validateScene}=await import('@/lib/villa/scene/model');
 const scene=validateScene(JSON.parse(readFileSync('docs/villa-playground/redesign-strict-live/after.UNAPPROVED.json','utf8')));
 const images=['aerial','arrival','poolside','facade'].map(view=>'data:image/png;base64,'+readFileSync(`docs/architecture/visual-learning/25m-${view}-before.png`).toString('base64'));
 generate.mockResolvedValue({output:{weaknesses:['SIMULATED observation for transport test only'],improvement:null,scope:[]},totalUsage:{inputTokens:2000,outputTokens:60}});
 const response=await POST(new Request('http://localhost/api/ai/villa/visual-review',{method:'POST',body:JSON.stringify({brief:'Offline diagnostic: $25m waterfront contemporary estate',current:scene,unresolved:[],images})}));
 expect(response.status).toBe(200);expect(generate).toHaveBeenCalledTimes(1);
 const args=generate.mock.calls[0][0],message=JSON.parse(args.messages[0].content[0].text);
 expect(message.evidence.intended).toEqual(scene.architecturalPlan);
 expect(message.evidence.constructed.map((e:{id:string})=>e.id)).toEqual(scene.elements.map(e=>e.id));
 expect(message.evidence.geometryWarnings).toBeDefined();expect(message.imageOrder).toEqual(['Aerial','Arrival','Poolside','Facade']);
 expect(args.messages[0].content.filter((c:{type:string})=>c.type==='image').map((c:{image:string})=>c.image)).toEqual(images);
 expect(args.system).toContain('DIRECT SCENE OVERRIDE');expect(args.system).toContain('RETRIEVED ARCHITECTURAL KNOWLEDGE');
});
