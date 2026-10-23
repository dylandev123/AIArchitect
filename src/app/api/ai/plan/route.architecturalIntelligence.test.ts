import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BLANK_V3_SCENE } from '@/lib/v3/scene';
import * as compiler from '@/lib/v3/scene';
import { revisionOf } from '@/lib/house/revision';
import { ARCHITECTURAL_DESIGN_PROCESS } from '@/lib/v3/architecturalDesignGuidance';
import { planEvaluationPrompt, planExteriorPrompt, checkoutPlanEvaluation } from '@/lib/v3/architecturalPlanEvaluation';
import { v3ArchitecturalBlueprintPrompt } from '@/lib/v3/architecturalBlueprintGeneration';
import { splitV3ArchitecturalBlueprint, sameArchitecturalPlan } from '@/lib/v3/architecturalPlanFirst';
import { distinctArchitecturalBlueprints } from '@/lib/v3/parity/architecturalBlueprint';
import { architecturalIntelligenceExamples, compactAuthoringInput, intelligenceExampleExterior } from '@/lib/v3/parity/architecturalIntelligence';
import { v3PlanAuthoringSchema } from '@/lib/v3/architecturalPlanAuthoring';
import { POST } from './route';

// Keep the production model factory, provider adapter and SDK. Only the transport
// is replaced: every request terminates here, without opening a network socket.
vi.mock('@/lib/ai/usage/track', () => ({ withUsageLogging: async (_meta: unknown, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/ai/planResponseArtifact', () => ({
  planResponseEvidence: (raw: string) => ({ sha256: createHash('sha256').update(raw).digest('hex') }),
  retainPlanResponse: async (raw: string) => ({ rawResponse: raw, sha256: createHash('sha256').update(raw).digest('hex') }),
}));
vi.mock('@/lib/ai/v3FailureArtifact', () => ({ retainV3FailureArtifact: async () => undefined }));

type Wire = { model: string; input: { role: string; content: unknown }[]; max_output_tokens: number; text: { format: { type: string; schema?: unknown } }; reasoning?: unknown; temperature?: number };
let wires: Wire[], output: unknown;
beforeEach(() => {
  wires = [];
  vi.stubEnv('OPENAI_API_KEY', 'offline-placeholder-never-sent');
  vi.stubEnv('AI_HOUSE_MODEL', 'gpt-5.6-terra');
  vi.stubEnv('AI_V3_PLAN_EVALUATION', '1');
  vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT', '1');
  vi.stubGlobal('fetch', vi.fn(async (_input: unknown, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as Wire;
    wires.push(request);
    return Response.json({ id: 'offline-response', model: request.model, created_at: 1, status: 'completed',
      output: [{ type: 'message', id: 'offline-message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(output), annotations: [] }] }],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    });
  }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const post = (action: string, currentHouseJson: string, prompt: string) => POST(new NextRequest('http://localhost/api/ai/plan', {
  method: 'POST', body: JSON.stringify({ action, currentHouseJson, prompt, baseRevision: revisionOf(currentHouseJson) }),
}));
const checkWire = (system: string) => {
  expect(wires).toHaveLength(1);
  const wire = wires[0];
  expect(wire.model).toBe('gpt-5.6-terra');
  expect(wire.input).toHaveLength(2);
  expect(wire.input[0]).toEqual({ role: 'developer', content: system });
  expect(wire.input[1].role).toBe('user');
  expect(wire.max_output_tokens).toBe(10_000);
  expect(wire.text.format).toEqual({ type: 'json_object' });
  expect(wire).not.toHaveProperty('temperature');
  expect(wire).not.toHaveProperty('reasoning');
};

describe('architectural instructions on the serialized production provider request, entirely offline', () => {
  it('transmits the shared design process with the minimal 2D input contract and no exterior construction', async () => {
    output = JSON.parse(readFileSync(new URL('../../../../lib/v3/__tests__/fixtures/plan-authoring-estate.plan.json', import.meta.url), 'utf8'));
    const compile = vi.spyOn(compiler, 'compileV3Scene');
    const response = await post('design', JSON.stringify(BLANK_V3_SCENE), 'A tropical ocean-view home; choose the design freely.');
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    checkWire(planEvaluationPrompt());
    expect(compile).not.toHaveBeenCalled();
    const prompt = planEvaluationPrompt();
    expect(prompt).toContain(ARCHITECTURAL_DESIGN_PROCESS);
    const schema = JSON.parse(prompt.split('Schema:\n')[1]);
    expect(schema.required).toEqual(['format', 'concept', 'site', 'buildings']);
    for (const field of ['exterior', 'materials', 'entrances', 'program', 'partitions', 'doors', 'objects', 'character']) expect(schema.properties).not.toHaveProperty(field);
    const item = schema.properties.buildings.items;
    const building = item.$ref ? schema.$defs[item.$ref.split('/').pop()] : item;
    expect(building.required).toEqual(['id', 'label', 'location', 'plan', 'storeys', 'accessOpenings']);
    for (const field of ['roofId', 'spaceHeight', 'roof', 'facade']) expect(building.properties).not.toHaveProperty(field);
    expect(checkoutPlanEvaluation(JSON.parse(body.json).v3Scene).ok).toBe(true);
  });

  it.each(['2026-10-20', '2026-10-21'])('replays the recovered %s architecture as a plan without rewriting or compiling it', async date => {
    const raw = readFileSync(new URL(`../../../../lib/v3/__tests__/fixtures/architectural-blueprint-live-${date}.json`, import.meta.url), 'utf8');
    const original = JSON.parse(raw);
    // This is an explicit offline compatibility split, not new Terra authorship.
    const plan = splitV3ArchitecturalBlueprint(original).plan;
    const before = JSON.stringify(plan);
    output = plan;
    const compile = vi.spyOn(compiler, 'compileV3Scene');
    const response = await post('design', JSON.stringify(BLANK_V3_SCENE), 'Replay the recovered architecture unchanged.');
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    checkWire(planEvaluationPrompt());
    expect(compile).not.toHaveBeenCalled();
    expect(JSON.stringify(plan)).toBe(before);
    const scene = JSON.parse(body.json).v3Scene;
    const checked = checkoutPlanEvaluation(scene);
    expect(checked.ok, JSON.stringify(checked.findings)).toBe(true);
    expect(sameArchitecturalPlan(scene, checked.scene!)).toBe(true);
    expect(checked.plan!.buildings.map(b => b.plan)).toEqual(plan.buildings.map(b => b.plan));
    expect(checked.plan!.buildings.flatMap(b => b.storeys.flatMap(s => s.spaces.map(r => r.footprint))))
      .toEqual(plan.buildings.flatMap(b => b.storeys.flatMap(s => s.spaces.map(r => r.footprint))));
  });

  it('preserves the original brief, current saved plan and exterior request on later development', async () => {
    const design = splitV3ArchitecturalBlueprint(distinctArchitecturalBlueprints().find(d => d.name === 'classical-villa')!.blueprint);
    const brief = 'A quiet Saint Lucia retreat: shaded outdoor living and private guest accommodation.';
    output = design.plan;
    const saved = await (await post('design', JSON.stringify(BLANK_V3_SCENE), brief)).json();
    const scene = JSON.parse(saved.json).v3Scene;
    wires = []; output = design.exterior;
    const response = await post('elaborate', saved.json, 'Choose all deferred exterior character to suit the original brief.');
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    checkWire(planExteriorPrompt());
    const user = JSON.stringify(wires[0].input[1].content);
    expect(user).toContain(brief);
    expect(user).toContain('Approved plan (immutable)');
    expect(user).toContain('Choose all deferred exterior character');
    expect(sameArchitecturalPlan(scene, JSON.parse(body.json).v3Scene)).toBe(true);
  });

  it('uses the same composition process in the full-property route without injecting fallback or V2 prompts', async () => {
    output = splitV3ArchitecturalBlueprint(distinctArchitecturalBlueprints().find(d => d.name === 'classical-villa')!.blueprint);
    const { POST: house } = await import('../house/route');
    const response = await house(new NextRequest('http://localhost/api/ai/house', { method: 'POST', body: JSON.stringify({ mode: 'generate', generationMode: 'v3-scene', prompt: 'A garden residence', currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await response.json();
    expect(response.status, JSON.stringify(body)).toBe(200);
    checkWire(v3ArchitecturalBlueprintPrompt());
    expect(v3ArchitecturalBlueprintPrompt()).toContain(ARCHITECTURAL_DESIGN_PROCESS);
    for (const system of [planEvaluationPrompt(), v3ArchitecturalBlueprintPrompt()]) {
      for (const obsolete of ['single V3 Scene Architect', 'addWindow', 'renderer then adds the connected wings', 'Up to eight rooms', 'US$5–10 million']) expect(system).not.toContain(obsolete);
      expect(system).toContain('no fixed template, required amenity list or complexity quota');
    }
  });
});


it.each(architecturalIntelligenceExamples())('round-trips $name through the production SDK, saved blueprint and V3 with offline transport',async({name,brief,make})=>{
  const plan=make(),author=compactAuthoringInput(plan);
  expect(v3PlanAuthoringSchema.safeParse(author).success).toBe(true);
  output=author;
  const designed=await post('design',JSON.stringify(BLANK_V3_SCENE),brief);
  const saved=await designed.json();expect(designed.status,JSON.stringify(saved)).toBe(200);checkWire(planEvaluationPrompt());
  const source=JSON.parse(saved.json).v3Scene,checked=checkoutPlanEvaluation(JSON.parse(JSON.stringify(source)));
  expect(source.metadata.planQualityReview.architecturalJudgment.status).toBe('requires-design-review');
  expect(source.metadata.brief).toBe(brief);
  expect(saved.recovery.rawResponse).toBe(JSON.stringify(author));
  expect(checked.ok).toBe(true);expect(checked.plan!.features.map(f=>f.footprint)).toEqual(plan.features.map(f=>f.footprint));
  expect(checked.plan!.connections.map(c=>c.path)).toEqual(plan.connections.map(c=>c.path));
  expect(checked.plan!.roomAdjacencies).toEqual(plan.roomAdjacencies);
  wires=[];output=intelligenceExampleExterior(checked.plan!,name);
  const developed=await post('elaborate',saved.json,'');
  const built=await developed.json();expect(developed.status,JSON.stringify(built)).toBe(200);checkWire(planExteriorPrompt());
  expect(sameArchitecturalPlan(source,JSON.parse(built.json).v3Scene)).toBe(true);
},20000);
