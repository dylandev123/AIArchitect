import { APICallError } from 'ai';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { splitV3ArchitecturalBlueprint } from '@/lib/v3/architecturalPlanFirst';
import liveBlueprint from '@/lib/v3/__tests__/fixtures/architectural-blueprint-live-2026-10-20.json';
import { MockLanguageModelV3 } from 'ai/test';
import type { LanguageModelV3GenerateResult } from '@ai-sdk/provider';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BLANK_V3_SCENE } from '@/lib/v3/scene';
import * as compiler from '@/lib/v3/scene';
import { fullPropertyBlueprint } from '@/lib/v3/parity/fullPropertyBlueprint';
import { distinctArchitecturalBlueprints } from '@/lib/v3/parity/architecturalBlueprint';
import type { V3ArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprint';
import { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprint';
import { auditArchitecturalConstructionFidelity } from '@/lib/v3/architecturalConstructionFidelity';

const mocks = vi.hoisted(() => ({ getModel: vi.fn(), usage: vi.fn(), artifact: vi.fn() }));
vi.mock('@/lib/ai/model', () => ({
  isAiConfigured: () => true, getAiModel: () => mocks.getModel(), getAiModelId: () => 'offline-blueprint-model', AI_PROVIDER_OPTIONS: {},
}));
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (meta: unknown, run: () => Promise<unknown>) => { mocks.usage(meta); return run(); } }));
vi.mock('@/lib/ai/v3FailureArtifact', () => ({ retainV3FailureArtifact: (...args: unknown[]) => mocks.artifact(...args) }));

const wireOutput=(output:unknown)=>output&&typeof output==='object'&&(output as {format?:unknown}).format==='v3-architectural-blueprint-1'?splitV3ArchitecturalBlueprint(output as V3ArchitecturalBlueprint):output;
const wireText=(output:unknown,raw:boolean)=>{if(!raw)return JSON.stringify(wireOutput(output));try{return JSON.stringify(wireOutput(JSON.parse(String(output))));}catch{return String(output);}};
const response = (output: unknown, finish: LanguageModelV3GenerateResult['finishReason']['unified'] = 'stop', raw = false): LanguageModelV3GenerateResult => ({
  content: [{ type: 'text', text: wireText(output,raw) }], finishReason: { unified: finish, raw: finish }, warnings: [],
  usage: { inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 50, text: 50, reasoning: 0 } },
});
const useModel = (...outputs: LanguageModelV3GenerateResult[]) => {
  const model = new MockLanguageModelV3({ doGenerate: outputs }); mocks.getModel.mockReturnValue(model); return model;
};
const post = async (prompt = 'An independent residence', extra = {}) => {
  const { POST } = await import('../route');
  return POST(new NextRequest('http://localhost/api/ai/house', { method: 'POST', body: JSON.stringify({ mode: 'generate', generationMode: 'v3-scene', prompt, currentHouseJson: JSON.stringify(BLANK_V3_SCENE), ...extra }) }));
};
const noScene = (body: Record<string, unknown>) => {
  for (const key of ['json', 'scene', 'model', 'v3FailedPreview', 'rawResponse']) expect(body).not.toHaveProperty(key);
};

// Offline estate authoring fixture only; never imported by a generation path.
const luxuryEstate = () => {
  const bp = fullPropertyBlueprint();
  bp.concept = 'A substantial two-storey luxury estate with a curved residence, detached atelier, private balcony, portico, water garden, pool belvedere and arrival court.';
  const upper = bp.buildings[0].storeys[1];
  const suite = upper.spaces.find(s => s.id === 'arc-suite')!;
  upper.spaces = upper.spaces.filter(s => s !== suite);
  for (let i = 0; i < 4; i++) upper.spaces.push({ ...suite, id: i === 0 ? suite.id : `garden-suite-${i}`, label: `Garden suite ${i + 1}`, footprint: { x: -2 + i * 4, z: 4, width: 4, depth: 8 } });
  return bp;
};
const blockSecondaryStair = (bp: V3ArchitecturalBlueprint, alternative = true) => {
  const spaces = bp.buildings[0].storeys[0].spaces;
  spaces[0].footprint = { x: -14, z: -7.6, width: 6, depth: .8 };
  spaces.push({ id: 'library-south', label: 'South library', role: 'Quiet reading', program: 'study', footprint: { x: -14, z: -2.6, width: 6, depth: 9.2 } });
  bp.roomAdjacencies.push({ from: 'west-study', to: 'library-south' });
  bp.partitions.push({ id: 'blocked-stair-wall', storeyId: 'house-ground', roomAId: 'west-study', roomBId: 'library-south', boundaryId: 'boundary:library-south|west-study', partitionType: 'wall', semanticRole: 'Wall across secondary stair' });
  if (alternative) bp.verticalCirculation.push({ ...bp.verticalCirculation[0], id: 'gallery-stair', footprint: { x: -4, z: -3, width: 1.6, depth: 8 } });
};
const minorWalkwayDefect = (bp: V3ArchitecturalBlueprint) => {
  bp.connections.find(c => c.id === 'atelier-approach')!.waypoints = [[64.2, 0, -27], [64.2, 0, -20], [-36, 0, -20]];
};
beforeEach(() => {
  vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT', '1'); vi.stubEnv('AI_V3_BLUEPRINT_FIRST', '1');
  mocks.getModel.mockReset(); mocks.usage.mockReset(); mocks.artifact.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in offline acceptance'); }));
  vi.spyOn(console, 'info').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {}); vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('actual production route with real SDK parsing and an offline model', () => {
  it('adapts the unchanged second live estate into plan-first format as an editable Draft without paid repair', async () => {
    const {readFileSync}=await import('node:fs');
    const raw=readFileSync(new URL('../../../../../lib/v3/__tests__/fixtures/architectural-blueprint-live-2026-10-21.json',import.meta.url),'utf8');
    expect(createHash('sha256').update(raw).digest('hex')).toBe('b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb');
    const model=useModel(response(raw,'stop',true)),res=await post('A luxury Saint Lucia estate'),body=await res.json();
    expect(res.status,JSON.stringify(body)).toBe(200);expect(body.outcome).toBe('draft');
    expect(model.doGenerateCalls).toHaveLength(1);expect(mocks.usage).toHaveBeenCalledTimes(1);
    const scene=JSON.parse(body.json).v3Scene;
    expect(scene.objects).toHaveLength(11);expect(scene.interior.rooms).toHaveLength(20);
    expect(scene.metadata.usage).toMatchObject({attempts:1,repair:false});
    expect([...scene.objects.find((o:{id:string})=>o.id==='main-villa').composition.openings].sort((a,b)=>a.id.localeCompare(b.id))).toEqual([...JSON.parse(raw).buildings[0].facade.openings].sort((a,b)=>a.id.localeCompare(b.id)));
    expect(scene.metadata.architecturalValidation.diagnostics.some((f:{code:string;classification:string})=>f.code==='ARCHITECTURAL_OPENING_OVERLAP'&&f.classification==='draft-tolerable')).toBe(true);
  });
  it('recovers route-owner aliases locally through the SDK and retains the original and rename evidence', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const bp = fullPropertyBlueprint(), feature = bp.features.find(f => f.type === 'terrace')!;
    bp.connections.forEach(c => { c.surfaceId = feature.id; });
    const before = JSON.stringify(bp), model = useModel(response(bp)), res = await post(), body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200); expect(model.doGenerateCalls).toHaveLength(1);
    const scene = JSON.parse(body.json).v3Scene;
    expect(scene.objects.find((o: {id:string}) => o.id === feature.id).type).toBe('terrace');
    expect(scene.metadata.usage).toMatchObject({ attempts: 1, repair: false });
    expect(mocks.artifact).toHaveBeenCalledTimes(1);
    const [raw, attempt, phase, diagnostic] = mocks.artifact.mock.calls[0];
    expect(JSON.parse(raw)).toEqual(wireOutput(bp)); expect(attempt).toBe(0); expect(phase).toBe('ingestion');
    expect(diagnostic).toMatchObject({ decision: 'accepted', generationId: expect.any(String) });
    expect(diagnostic.identityChanges).toHaveLength(bp.connections.length);
    expect(diagnostic.normalizedBlueprint.connections.map((c: {surfaceId:string}) => c.surfaceId)).toEqual(bp.connections.map(c => `route-${c.id}`));
    expect(JSON.stringify(bp)).toBe(before);
  });
  it('adapts the unchanged failed live JSON without identity rejection or another authoring call', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    // The architectural flag alone must select this pipeline.
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST', '0');
    expect(createHash('sha256').update(JSON.stringify(liveBlueprint)).digest('hex')).toBe('9733be300b2fbb316ea248201c4af87df86665fb63fb9c6d63012aa49f1af9ed');
    const model = useModel(response(liveBlueprint)), res = await post(), body = await res.json();
    expect(res.status,JSON.stringify(body)).toBe(200);
    expect(res.headers.get('x-ai-architect-pipeline')).toBe('v3-architectural-blueprint-1');
    expect(body.outcome).toBe('draft'); expect(body.summary).toContain('Draft — Needs Refinement');
    const scene=JSON.parse(body.json).v3Scene;expect(scene.objects).toHaveLength(13);expect(scene.metadata.architecturalValidation.status).toBe('draft');
    const expected = constructV3ArchitecturalBlueprint(planV3ArchitecturalBlueprint(liveBlueprint, { buildFirst: true }).approval!);
    expect([...compiler.compileV3Scene(scene).primitives].sort((a,b)=>a.id.localeCompare(b.id))).toEqual([...expected.model!.primitives].sort((a,b)=>a.id.localeCompare(b.id)));
    expect(auditArchitecturalConstructionFidelity(scene, compiler.compileV3Scene(scene))).toEqual([]);
    expect(body.findings.some((f: { code: string }) => f.code === 'FALLBACK_RENDER_USED')).toBe(false);
    expect(scene.interior.rooms.map((r: { footprint: unknown }) => r.footprint)).toEqual(liveBlueprint.buildings.flatMap(b => b.storeys.flatMap(s => s.spaces.map(r => r.footprint))));
    expect(scene.interior.partitions).toEqual(liveBlueprint.partitions);
    expect(scene.interior.doors).toEqual(liveBlueprint.doors);
    expect(scene.estatePlan.zones).toEqual(liveBlueprint.zones);
    expect(scene.metadata.architecturalValidation.diagnostics.every((d: { classification: string; targetIds: string[] }) => d.classification !== 'core-blocking' && d.targetIds.length > 0)).toBe(true);
    if(process.env.MANSION_ROUTE_ARTIFACT)writeFileSync(process.env.MANSION_ROUTE_ARTIFACT,body.json);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(body.findings.some((f: {code:string}) => f.code === 'ARCHITECTURAL_DUPLICATE_ID')).toBe(false);
    expect(scene.interior.storeys.map((s:{height:number})=>s.height)).toEqual([4.2,3.5,3.6]);
    expect(mocks.artifact.mock.calls[0][3].identityChanges).toHaveLength(4);
    expect(JSON.parse(mocks.artifact.mock.calls[0][0])).toEqual(wireOutput(liveBlueprint));
  },20000);
  it('combines unequal heights, glazed entries, owner collisions and a local defect on an unrelated estate', async () => {
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST', '0');
    const bp = fullPropertyBlueprint();
    bp.buildings[0].storeys[1].height = 3.5;
    for (const b of bp.buildings) {
      const entry = b.facade.openings!.find(o => o.id === bp.entrances.find(e => e.objectId === b.id)!.openingId)!;
      Object.assign(entry, { type: 'glazed-door', operation: 'hinged' });
      delete (entry as { frame?: boolean }).frame;
    }
    bp.connections.forEach(c => { c.surfaceId = bp.features[0].id; });
    bp.doors[0].offset = .1;
    const before = JSON.stringify(bp), model = useModel(response(bp)), res = await post(), body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200); expect(body.outcome).toBe('draft');
    expect(model.doGenerateCalls).toHaveLength(1);
    const scene = JSON.parse(body.json).v3Scene, built = compiler.compileV3Scene(scene);
    expect(scene.objects.filter((o: { type: string }) => o.type === 'building-mass')).toHaveLength(2);
    expect(scene.interior.storeys.slice(0, 2).map((s: { height: number }) => s.height)).toEqual([4, 3.5]);
    expect(new Set(scene.objects.map((o: { id: string }) => o.id)).size).toBe(scene.objects.length);
    for (const entrance of bp.entrances) expect(built.primitives.some(p => p.id.startsWith(`${entrance.objectId}:${entrance.openingId}:level-0:`))).toBe(true);
    expect(auditArchitecturalConstructionFidelity(scene, built)).toEqual([]);
    expect(body.findings.some((f: { code: string }) => f.code === 'FALLBACK_RENDER_USED')).toBe(false);
    expect(body.findings.some((f: { code: string }) => f.code === 'ARCHITECTURAL_DOOR_CLIPPED')).toBe(true);
    expect(JSON.stringify(bp)).toBe(before);
    if (process.env.BLUEPRINT_INTEGRATION_DRAFT_INPUT) writeFileSync(process.env.BLUEPRINT_INTEGRATION_DRAFT_INPUT, before);
  }, 20000);
  it('retains both correlated attempt inputs even when a bounded repair redesigns the estate', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const first = fullPropertyBlueprint(), second = fullPropertyBlueprint();
    first.verticalCirculation[0].footprint.depth = .5; second.buildings[0].location.x += 2;
    const model = useModel(response(first), response(second)), res = await post();
    expect(res.status).toBe(422); expect(model.doGenerateCalls).toHaveLength(2);
    expect(mocks.artifact).toHaveBeenCalledTimes(2);
    const [a, b] = mocks.artifact.mock.calls;
    expect(a[1]).toBe(0); expect(b[1]).toBe(1);
    expect(a[3].generationId).toBe(b[3].generationId);
    expect(a[3].decision).toBe('repair-requested'); expect(b[3].decision).toBe('rejected');
    expect(JSON.parse(a[0])).toEqual(wireOutput(first)); expect(JSON.parse(b[0])).toEqual(wireOutput(second));
    expect(b[3].errors.join(' ')).toContain('ARCHITECTURAL_REPAIR_SCOPE');
  });
  it.each([
    'complete', 'door', 'walkway', 'secondary-stair', 'combined', 'decorative-finish',
    'missing-main', 'unsupported-roof', 'sole-stair', 'geometry-substitution', 'transient-mesh-loss',
  ] as const)('production luxury-estate preflight: %s', async kind => {
    const bp = luxuryEstate();
    if (kind === 'door' || kind === 'combined') bp.doors[0].offset = .1;
    if (kind === 'walkway' || kind === 'combined') minorWalkwayDefect(bp);
    if (kind === 'secondary-stair' || kind === 'combined' || kind === 'sole-stair') blockSecondaryStair(bp, kind !== 'sole-stair');
    if (kind === 'missing-main') bp.buildings.shift();
    if (kind === 'unsupported-roof') bp.buildings[0].roof.form = 'dome';
    if (['decorative-finish', 'geometry-substitution', 'transient-mesh-loss'].includes(kind)) {
      const compile = compiler.compileV3Scene;
      let calls = 0;
      vi.spyOn(compiler, 'compileV3Scene').mockImplementation(scene => {
        const model = compile(scene); calls++;
        return { ...model, primitives: model.primitives
          .filter(p => !(kind === 'transient-mesh-loss' && calls === 1 && p.id === 'long-pool-water'))
          .map(p => p.id === 'orchard-atelier-composition-assembly-atelier-portico-lintel'
            ? kind === 'decorative-finish' ? { ...p, color: '#ff0000' }
              : kind === 'geometry-substitution' ? { ...p, position: [0, 100, 0] as [number, number, number] } : p
            : p) };
      });
    }
    const before = JSON.stringify(bp), model = useModel(response(bp), response(bp));
    const res = await post('A luxury estate with a curved main residence, detached atelier, roofs, pool, balcony, portico, covered outdoor living, arrival court and landscape zone.'), body = await res.json();
    const blocked = ['missing-main', 'unsupported-roof', 'sole-stair', 'geometry-substitution'].includes(kind);
    expect(res.status, JSON.stringify(body)).toBe(blocked ? 422 : 200);
    expect(model.doGenerateCalls).toHaveLength(kind === 'sole-stair' ? 2 : 1);
    expect(model.doGenerateCalls[0].maxOutputTokens).toBe(10_000);
    expect(res.headers.get('x-ai-architect-pipeline')).toBe('v3-architectural-blueprint-1');
    expect(JSON.stringify(bp)).toBe(before);
    if (blocked) { noScene(body); return; }
    expect(body.outcome).toBe(kind === 'complete' || kind === 'transient-mesh-loss' ? 'complete' : 'draft');
    const root = JSON.parse(body.json), scene = root.v3Scene, built = compiler.compileV3Scene(scene);
    expect(scene.objects.map((o: { id: string }) => o.id)).toEqual(bp.buildings.flatMap(b => [b.id, b.roof.id]).concat(bp.features.map(f => f.id), bp.connections.map(c => c.surfaceId)));
    expect(scene.metadata.architecturalValidation.status).toBe(body.outcome);
    expect(built.primitives.length).toBeGreaterThan(150);
    for (const id of ['long-pool-water', 'poolside-shade-slat-0', 'crescent-house-assembly-arc-balcony-guard-outer']) expect(built.primitives.some(p => p.id === id)).toBe(true);
    expect(body).not.toHaveProperty('v3FailedPreview');
    if (kind === 'combined') {
      const codes = body.findings.map((f: { code: string }) => f.code);
      for (const code of ['ARCHITECTURAL_DOOR_CLIPPED', 'ESTATE_ACCESS_DISCONNECTED', 'STAIR_ACCESS_BLOCKED']) expect(codes).toContain(code);
      if (process.env.ARCHITECTURAL_PREFLIGHT_SCENE) {
        writeFileSync(process.env.ARCHITECTURAL_PREFLIGHT_SCENE, body.json + '\n');
        writeFileSync(process.env.ARCHITECTURAL_PREFLIGHT_SCENE + '.proof.json', JSON.stringify({
          fixture: bp, blueprintBytes: Buffer.byteLength(before), prettyBlueprintBytes: Buffer.byteLength(JSON.stringify(bp, null, 2)),
          maxOutputTokens: model.doGenerateCalls[0].maxOutputTokens, providerCalls: model.doGenerateCalls.length,
          status: res.status, outcome: body.outcome, objects: scene.objects.length, rooms: scene.interior.rooms.length,
          primitives: built.primitives.length, diagnostics: scene.metadata.architecturalValidation.diagnostics,
          tokenUsageIsMocked: true,
        }, null, 2) + '\n');
      }
    }
  });
  it.each(distinctArchitecturalBlueprints())('constructs $name from JSON text with only the blueprint schema on the provider wire', async ({ blueprint }) => {
    const model = useModel(response(blueprint)), res = await post(), body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200); expect(model.doGenerateCalls).toHaveLength(1);
    expect(res.headers.get('x-ai-architect-pipeline')).toBe('v3-architectural-blueprint-1');
    const call = model.doGenerateCalls[0]; expect(call.responseFormat).toMatchObject({ type: 'json' });
    expect(call.maxOutputTokens).toBe(10_000);
    const system = call.prompt.find(p => p.role === 'system'); expect(system?.content).toContain('ONE plan-first design');
    const schema = JSON.parse(String(system?.content).slice(String(system?.content).indexOf('{')));
    expect(schema.properties.format.const).toBe('v3-plan-first-1');
    expect(schema.properties.objects).toBeUndefined(); expect(schema.properties.v3Scene).toBeUndefined(); expect(schema.additionalProperties).toBe(false);
    expect(JSON.parse(body.json).v3Scene.metadata.usage).toMatchObject({ inputTokens: 100, outputTokens: 50, attempts: 1 });
  });
  it('uses the revised input schema for omitted empty ledgers and deferred interior details',async()=>{
    const raw=JSON.parse(JSON.stringify(splitV3ArchitecturalBlueprint(distinctArchitecturalBlueprints().find(d=>d.name==='classical-villa')!.blueprint)));
    for(const key of ['forms','zones','relationships','considerations','roomAdjacencies'])delete raw.plan[key];
    delete raw.exterior.partitions;delete raw.exterior.doors;
    const model=useModel(response(raw)),res=await post('A garden house'),body=await res.json();
    expect(res.status,JSON.stringify(body)).toBe(200);expect(model.doGenerateCalls).toHaveLength(1);
    const call=model.doGenerateCalls[0],system=String(call.prompt.find(p=>p.role==='system')?.content);
    expect(system).toContain('COMPOSE THE SITE');expect(call.maxOutputTokens).toBe(10_000);
    const schema=JSON.parse(system.slice(system.indexOf('{')));
    expect(schema.properties.plan.required).not.toContain('zones');expect(schema.properties.exterior.required).not.toContain('partitions');
    const scene=JSON.parse(body.json).v3Scene;
    expect(scene.metadata.designPipeline).toMatchObject({format:'v3-plan-first-1',authority:'v3-semantic-plan',sequence:['plan','massing','exterior']});
    expect(scene.interior.partitions).toEqual([]);expect(scene.interior.doors).toEqual([]);
  });
  it('returns one editable explicitly labelled draft through the actual SDK and route',async()=>{
    const bp=fullPropertyBlueprint();bp.doors[0].offset=.1;
    const model=useModel(response(bp)),res=await post(),body=await res.json();
    expect(res.status,JSON.stringify(body)).toBe(200);expect(model.doGenerateCalls).toHaveLength(1);
    expect(body.outcome).toBe('draft');expect(body.summary).toContain('Draft — Needs Refinement');
    expect(JSON.parse(body.json).v3Scene.metadata.architecturalValidation).toMatchObject({status:'draft',version:1});
    expect(body.findings.some((f:{code:string})=>f.code==='ARCHITECTURAL_DOOR_CLIPPED')).toBe(true);
    expect(body).not.toHaveProperty('v3FailedPreview');
  });
  it('repairs only diagnosed stair intent and attributes exactly two SDK calls', async () => {
    const bad = fullPropertyBlueprint(); bad.verticalCirculation[0].footprint.depth = .5;
    const model = useModel(response(bad), response(fullPropertyBlueprint())), res = await post(), body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200); expect(model.doGenerateCalls).toHaveLength(2);
    expect(mocks.usage.mock.calls.map(([meta]) => [meta.stage, meta.retryNumber])).toEqual([['v3-architectural-blueprint', 0], ['v3-architectural-blueprint-repair', 1]]);
    expect(JSON.parse(body.json).v3Scene.metadata.usage).toMatchObject({ attempts: 2, inputTokens: 200, outputTokens: 100, repair: true });
  });
  it.each(['failed-repair', 'redesign', 'wrong-contract', 'extra-scene', 'preflight', 'construction'] as const)('returns no saveable output for %s', async kind => {
    const bad = fullPropertyBlueprint(), next = fullPropertyBlueprint();
    if (kind === 'failed-repair' || kind === 'redesign') bad.verticalCirculation[0].footprint.depth = .5;
    if (kind === 'redesign') next.buildings[0].location.x += 2;
    if (kind === 'preflight') bad.buildings[0].facade.openings![1].segmentId = 'missing';
    if (kind === 'construction') {
      const compile = compiler.compileV3Scene;
      vi.spyOn(compiler, 'compileV3Scene').mockImplementation(s => { const m = compile(s); return { ...m, primitives: m.primitives.filter(p => p.id !== 'poolside-shade-slat-0') }; });
    }
    const output = kind === 'wrong-contract' ? { version: 3, objects: [] } : kind === 'extra-scene' ? { ...bad, objects: [] } : bad;
    const model = useModel(response(output), response(kind === 'failed-repair' ? bad : next)), res = await post(), body = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(422); noScene(body);
    expect(model.doGenerateCalls).toHaveLength(kind === 'failed-repair' || kind === 'redesign' ? 2 : 1);
    expect(res.headers.get('x-ai-architect-pipeline')).toBe('v3-architectural-blueprint-1');
    if (kind === 'construction') expect(body.findings.map((f: { code: string }) => f.code)).toContain('ARCHITECTURAL_PART_UNBUILT');
  });
  it.each(['length', 'content-filter', 'error', 'tool-calls', 'other'] as const)('refuses an otherwise complete JSON candidate after provider finish=%s', async finish => {
    const model = useModel(response(fullPropertyBlueprint(), finish)), compile = vi.spyOn(compiler, 'compileV3Scene');
    const res = await post(), body = await res.json(); expect(res.status).toBe(502); noScene(body);
    expect(model.doGenerateCalls).toHaveLength(1); expect(compile).not.toHaveBeenCalled();
  });
  it.each(['{"format":', '', 'null', '[]'] as const)('rejects malformed/non-object output %j without retry or preview', async text => {
    const model = useModel(response(text, 'stop', true)), compile = vi.spyOn(compiler, 'compileV3Scene');
    const res = await post(), body = await res.json(); expect(res.status).toBeGreaterThanOrEqual(400); noScene(body);
    expect(model.doGenerateCalls).toHaveLength(1); expect(compile).not.toHaveBeenCalled();
  });
  it('does not hide retries inside the SDK after a retryable provider failure', async () => {
    const failed = vi.fn().mockRejectedValue(new APICallError({ message: 'offline rate limit', url: 'https://offline.invalid', requestBodyValues: {}, statusCode: 429, isRetryable: true }));
    mocks.getModel.mockReturnValue(new MockLanguageModelV3({ doGenerate: failed }));
    const res = await post(); expect(res.status).toBeGreaterThanOrEqual(400); noScene(await res.json()); expect(failed).toHaveBeenCalledTimes(1);
  });
  it('reports flag state without any authoring request or sensitive configuration', async () => {
    const { GET } = await import('../route');
    for (const [flag, enabled] of [['1', true], ['0', false], ['', false], ['true', false]] as const) {
      vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT', flag);
      const res = await GET(), body = await res.json();
      expect(body).toEqual({ architecturalBlueprint: { enabledForNewFlatGenerations: enabled, contract: 'v3-plan-first-1', maxAuthoringAttempts: 2, maxOutputTokens: 10_000 } });
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
    expect(mocks.getModel).not.toHaveBeenCalled(); expect(mocks.usage).not.toHaveBeenCalled();
  });
  it('rejects unsupported brief intent without spending a provider call', async () => {
    const res = await post('A residence with a dome roof'); expect(res.status).toBe(422); noScene(await res.json());
    expect(mocks.getModel).not.toHaveBeenCalled(); expect(res.headers.get('x-ai-architect-pipeline')).toBe('v3-architectural-blueprint-1');
  });
});
