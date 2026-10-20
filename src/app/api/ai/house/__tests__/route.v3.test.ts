import { explicitlyCorrectedCloister, recoveredCloister } from '@/lib/v3/parity/unifiedSpatial';
import * as failureArtifacts from "@/lib/ai/v3FailureArtifact";
import { NextRequest } from "next/server";
import { APICallError, JSONParseError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BLANK_V3_SCENE, type V3Scene } from "@/lib/v3/scene";
import { v3SceneOutputSchema } from "@/lib/v3/schema";
import { toGenerationOutput } from "@/lib/v3/__tests__/generationFixture";
import { blueprintProviderFixtures } from '@/lib/v3/__tests__/blueprintProviderFixtures';
import { preGenerationFixtures } from '@/lib/v3/__tests__/preGenerationFixtures';
import { fullPropertyBlueprint } from '@/lib/v3/parity/fullPropertyBlueprint';
import { checkoutV3ArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprint';
import { executeV3SceneOperations } from '@/lib/v3/operations';
import * as sceneCompiler from '@/lib/v3/scene';
import cloisterInitial from '@/lib/v3/__tests__/fixtures/blueprint-cloister-attempt-0.json';
import cloisterRepair from '@/lib/v3/__tests__/fixtures/blueprint-cloister-attempt-1.json';
import { V3_INITIAL_MAX_OUTPUT_TOKENS, V3_STRUCTURED_OUTPUT_RAW_PREVIEW_MAX_CHARS } from "../route";

const generateText = vi.fn();
const usageAssessments: Array<{ meta: unknown; assessment: unknown }> = [];
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({
  withUsageLogging: async (meta: unknown, run: () => Promise<unknown>, assess?: (outcome: { error: unknown }) => unknown) => {
    try { return await run(); } catch (error) { usageAssessments.push({ meta, assessment: await assess?.({ error }) }); throw error; }
  },
}));

const scene = (): V3Scene => ({ version: 3, site: { width: 180, depth: 160 }, relationships: [], metadata: {}, objects: [
  { id: "hillside", type: "terrain-region", semanticRole: "sloped site", label: "Hillside", transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [180, 1, 160], material: { id: "grass", color: "#426d38", surface: "grass" }, collision: "walkable", terrain: { operation: "slopeRegion", rise: 22, direction: "z" } },
  { id: "main-volume", type: "volume", semanticRole: "main pavilion", label: "Main Pavilion", transform: { position: [0, 18, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [46, 12, 28], material: { id: "concrete", color: "#78736c", surface: "concrete" }, collision: "solid" },
] });

/** Schema-valid offline stand-in for the captured hillside-mansion response. */
const generationScene = (): V3Scene => {
  const generated = scene();
  generated.siteHierarchy = {
    levels: [
      { id: "main-level", elevation: 0, region: { x: 0, z: 0, width: 80, depth: 60 }, supportType: "pad" },
      { id: "arrival-level", elevation: 2, region: { x: 0, z: 30, width: 20, depth: 10 }, supportType: "pad" },
    ],
    connections: [{ id: "arrival-route", fromLevelId: "main-level", toLevelId: "arrival-level", type: "ramp", width: 3, maxGrade: .5, route: [[0, 0, 25], [0, 1, 27.5], [0, 2, 30]] }],
  };
  const main = generated.objects.find((item) => item.id === "main-volume")!;
  main.transform.position[1] = 6;
  main.support = { kind: "pad", levelId: "main-level" };
  return generated;
};

const sdkUsage = { inputTokens: 100, inputTokenDetails: {}, outputTokens: 50, outputTokenDetails: {}, totalTokens: 150 } as ConstructorParameters<typeof NoObjectGeneratedError>[0]["usage"];
const sdkResponse = { id: "provider-request-id", timestamp: new Date(), modelId: "terra-test" };

function schemaFailure(raw: unknown, text = JSON.stringify(raw), finishReason: "stop" | "length" = "stop") {
  const parsed = z.object({ siteHierarchy: z.object({ levels: z.array(z.object({ id: z.string() })) }) }).safeParse(raw);
  if (parsed.success) throw new Error("fixture must not match schema");
  return new NoObjectGeneratedError({
    message: "No object generated: response did not match schema.", text,
    cause: new TypeValidationError({ value: raw, cause: parsed.error }), response: sdkResponse, usage: sdkUsage, finishReason,
  });
}

function malformedJsonFailure(text: string, finishReason: "stop" | "length" = "stop") {
  return new NoObjectGeneratedError({
    message: "No object generated: could not parse the response.", text,
    cause: new JSONParseError({ text, cause: new SyntaxError("Unexpected end of JSON input") }), response: sdkResponse, usage: sdkUsage, finishReason,
  });
}

beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "test-key"); vi.stubEnv('AI_V3_BLUEPRINT_FIRST','0'); vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT','0'); generateText.mockReset(); usageAssessments.length = 0; });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("POST /api/ai/house V3 scene mode", () => {
  const generateOffline = async (prompt='Design a distinctive residence', terrainMode='flat') => {
    const {POST}=await import('../route');
    return POST(new NextRequest('http://localhost/api/ai/house',{method:'POST',body:JSON.stringify({mode:'generate',generationMode:'v3-scene',v3TerrainMode:terrainMode,prompt,currentHouseJson:JSON.stringify(BLANK_V3_SCENE)})}));
  };

  it('constructs the new blueprint-only provider response with one mocked call and editable save/reload semantics',async()=>{
    vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT','1');vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    const bp=fullPropertyBlueprint();generateText.mockResolvedValueOnce({output:bp,totalUsage:sdkUsage});
    const res=await generateOffline('A curved residence with balcony, pool and covered outdoor living');
    expect(res.status).toBe(200);expect(generateText).toHaveBeenCalledTimes(1);
    const request=generateText.mock.calls[0][0];expect(request.maxOutputTokens).toBe(V3_INITIAL_MAX_OUTPUT_TOKENS);
    expect(request.system).toContain('ONE complete independent architectural blueprint');expect(request.system).toContain('"$schema"');
    expect(request.system).not.toContain('BLUEPRINT-FIRST AUTHORING');expect(request.system).not.toContain('Current plan:');
    const body=await res.json(),root=JSON.parse(body.json);expect(body.baseRevision).toBeTruthy();
    expect(root.v3Scene.metadata.blueprintContract).toBe('v3-architectural-blueprint-1');expect(root.v3Scene.metadata.usage.attempts).toBe(1);
    expect(root.v3Scene.objects[0].composition.footprint.segments).toEqual(bp.buildings[0].plan.kind==='outline'?bp.buildings[0].plan.segments:[]);
    expect(JSON.stringify(root.v3Scene)).not.toContain('"buildings":'+JSON.stringify(bp.buildings));
    const edited=executeV3SceneOperations(root.v3Scene,{intent:'Edit constructed property',operations:[{op:'changeMaterial',target:'orchard-atelier',material:{id:'local-ochre',color:'#c9a86b',surface:'stucco'}}]});
    expect(edited.ok).toBe(true);expect(checkoutV3ArchitecturalBlueprint(JSON.parse(JSON.stringify(edited.scene))).ok).toBe(true);
  });

  it.each(['decision','capability','double-output'] as const)('rejects %s before full compilation with no scene fallback or repair',async kind=>{
    vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT','1');
    const bp=fullPropertyBlueprint();
    if(kind==='decision')bp.entrances=[];
    if(kind==='capability')bp.buildings[0].roof.form='dome';
    const output=kind==='double-output'?{...bp,objects:[]}:bp;
    const compile=vi.spyOn(sceneCompiler,'compileV3Scene');generateText.mockResolvedValue({output,totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(422);expect(generateText).toHaveBeenCalledTimes(1);expect(compile).not.toHaveBeenCalled();
    const body=await res.json();expect(body.json).toBeUndefined();expect(body.v3FailedPreview).toBeUndefined();expect(body.phase).toBe('planning');
  });

  it.each([false,true])('uses only the existing bounded objective repair and blocks redesign (redesign=%s)',async redesign=>{
    vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT','1');
    const bad=fullPropertyBlueprint(),fixed=fullPropertyBlueprint();bad.verticalCirculation[0].footprint.depth=.5;
    if(redesign)fixed.buildings[0].location.x+=2;
    generateText.mockResolvedValueOnce({output:bad,totalUsage:sdkUsage}).mockResolvedValueOnce({output:fixed,totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(redesign?422:200);expect(generateText).toHaveBeenCalledTimes(2);
    const body=await res.json();
    expect(generateText.mock.calls[1][0].messages[0].content).toContain('Only diagnosed');
    if(redesign){expect(body.code).toBe('ARCHITECTURAL_REPAIR_SCOPE');expect(body.json).toBeUndefined();}
    else expect(JSON.parse(body.json).v3Scene.metadata.usage).toMatchObject({attempts:2,repair:true,inputTokens:200,outputTokens:100});
  });

  it('returns detailed construction failure without a partial save or an extra creative call',async()=>{
    vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT','1');
    const compile=sceneCompiler.compileV3Scene;
    vi.spyOn(sceneCompiler,'compileV3Scene').mockImplementation(s=>{const model=compile(s);return {...model,primitives:model.primitives.filter(p=>p.sourceObjectId!=='atelier-roof')};});
    generateText.mockResolvedValue({output:fullPropertyBlueprint(),totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(422);expect(generateText).toHaveBeenCalledTimes(1);
    const body=await res.json();expect(body.phase).toBe('construction');expect(body.json).toBeUndefined();expect(body.findings.some((f:{code:string})=>f.code==='ARCHITECTURAL_COMPONENT_UNBUILT')).toBe(true);
  });

  it('rejects truncated and malformed blueprint JSON without retrying or using the scene preview path',async()=>{
    vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT','1');
    generateText.mockResolvedValue({output:fullPropertyBlueprint(),finishReason:'length',totalUsage:sdkUsage});
    let res=await generateOffline();expect(res.status).toBe(502);expect((await res.json()).code).toBe('V3_OUTPUT_TRUNCATED');expect(generateText).toHaveBeenCalledTimes(1);
    generateText.mockReset().mockRejectedValue(malformedJsonFailure('{"format":'));
    res=await generateOffline();expect(res.status).toBe(502);const body=await res.json();expect(body.json).toBeUndefined();expect(body.v3FailedPreview).toBeUndefined();expect(generateText).toHaveBeenCalledTimes(1);
  });

  it('keeps advanced-site generation on the existing scene route when the new flag is set',async()=>{
    vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT','1');generateText.mockResolvedValue({output:toGenerationOutput(generationScene()),totalUsage:sdkUsage});
    await generateOffline('A hillside home','advanced');expect(generateText.mock.calls[0][0].system).not.toContain('ONE complete independent architectural blueprint');
  });

  it('reports an omitted explicitly requested feature instead of asking for a second creative scene',async()=>{
    vi.stubEnv('AI_V3_ARCHITECTURAL_BLUEPRINT','1');generateText.mockResolvedValue({output:fullPropertyBlueprint(),totalUsage:sdkUsage});
    const res=await generateOffline('A house with a rooftop terrace');expect(res.status).toBe(422);expect(generateText).toHaveBeenCalledTimes(1);
    const body=await res.json();expect(body.phase).toBe('brief');expect(body.json).toBeUndefined();
  });

  it('sends independent blueprint, roof and exterior-detail failures to its one mocked repair', async () => {
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST', '1');
    const output = preGenerationFixtures().find(f => f.name.startsWith('allocation rejection'))!.output;
    generateText.mockResolvedValue({ output, totalUsage: sdkUsage });
    const response = await generateOffline('Design an original sculptural mansion');
    expect(response.status).toBe(422);
    expect(generateText).toHaveBeenCalledTimes(2);
    const repair = generateText.mock.calls[1][0].messages[0].content;
    for (const code of ['ESTATE_ALLOCATION_CONFLICT', 'ROOF_FOOTPRINT_UNSUPPORTED', 'FOOTPRINT_ASSEMBLY_UNRESOLVED']) expect(repair).toContain(code);
    expect(repair).toContain('sunshade/canopy');
    expect(repair).toContain('width and use');
    expect((await response.json()).json).toBeUndefined();
  });

  it('rejects an unusable stair after the single bounded repair fails', async () => {
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST', '1');
    const output = preGenerationFixtures()[0].output;
    output.circulation![0].width = .4; output.circulation![0].depth = .5;
    generateText.mockResolvedValue({ output, totalUsage: sdkUsage });
    const response = await generateOffline('Design an original two-storey sculptural residence');
    expect(response.status).toBe(422);
    expect(generateText).toHaveBeenCalledTimes(2);
    const body = await response.json();
    expect(body.json).toBeUndefined();
    expect(generateText.mock.calls[1][0].messages[0].content).toContain('CIRCULATION_NOT_USABLE');
  });

  it('accepts a separately authored stair correction in the one objective follow-up', async () => {
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST', '1');
    const good=preGenerationFixtures()[0].output,bad=structuredClone(good);
    bad.circulation![0].width=.4;bad.circulation![0].depth=.5;
    generateText.mockResolvedValueOnce({output:bad,totalUsage:sdkUsage}).mockResolvedValueOnce({output:good,totalUsage:sdkUsage});
    const response=await generateOffline('Design an original two-storey sculptural residence');
    expect(response.status).toBe(200);expect(generateText).toHaveBeenCalledTimes(2);
    const body=await response.json();expect(body.json).toBeDefined();
  });

  it('replays the live blueprint-first mansion with two mocked responses and a complete failed preview',async()=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    generateText.mockResolvedValueOnce({output:cloisterInitial,totalUsage:sdkUsage}).mockResolvedValueOnce({output:cloisterRepair,totalUsage:sdkUsage});
    const response=await generateOffline('Design a $15 million Saint Lucia luxury estate');
    expect(response.status).toBe(422);
    expect(generateText).toHaveBeenCalledTimes(2);
    const body=await response.json();
    expect(body.json).toBeUndefined();
    expect(body.v3FailedPreview.scene.objects.map((o:{id:string})=>o.id)).toEqual(cloisterRepair.objects.map(o=>o.id));
    expect(body.v3FailedPreview.diagnostics.skippedObjectIds).toEqual([]);
    expect(generateText.mock.calls[0][0].system).toContain('BLUEPRINT-FIRST AUTHORING v1');
    expect(generateText.mock.calls[1][0].messages[0].content).toContain('ESTATE_ROUTE_BLOCKED');
    expect(generateText.mock.calls[1][0].messages[0].content).toContain('BLUEPRINT PRESERVATION');
  });

  it('constructs a canonical mansion plan with identity-only route owners through the actual API offline',async()=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    const output=JSON.parse(JSON.stringify(explicitlyCorrectedCloister()));
    for(const o of output.objects.filter((o:{type:string})=>['path','driveway'].includes(o.type))){delete o.architecture;delete o.dimensions;delete o.transform;}
    generateText.mockResolvedValue({output,totalUsage:sdkUsage});
    const response=await generateOffline('Design a distinctive luxury estate');
    expect(response.status).toBe(200);
    const saved=JSON.parse((await response.json()).json).v3Scene;
    expect(saved.estatePlan.siteAccess).toEqual(output.estatePlan.siteAccess);
    expect(saved.objects).toHaveLength(23);
    expect(generateText.mock.calls.length).toBeLessThanOrEqual(2);
  });

  it('accepts a locally corrected recovered plan in the single objective follow-up offline',async()=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    generateText.mockResolvedValueOnce({output:recoveredCloister(1),totalUsage:sdkUsage}).mockResolvedValueOnce({output:explicitlyCorrectedCloister(),totalUsage:sdkUsage});
    const response=await generateOffline('Design a distinctive luxury estate');
    const body=await response.json();
    expect(response.status,JSON.stringify(body)).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(JSON.parse(body.json).v3Scene.objects).toHaveLength(23);
  });

  it.each(blueprintProviderFixtures())('evaluates flagged provider-shaped $name through the actual route offline',async({output})=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    generateText.mockResolvedValue({output,totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(200);
    const saved=JSON.parse((await res.json()).json).v3Scene;
    expect(saved.metadata.blueprintContract).toBe('blueprint-first-v1');
    expect(saved.estatePlan.blueprint).toEqual((output.estatePlan as {blueprint:unknown}).blueprint);
    expect(generateText.mock.calls.length).toBeLessThanOrEqual(2);
    for(const [call] of generateText.mock.calls){
      expect(call.system).toContain('BLUEPRINT-FIRST AUTHORING v1');
      expect(call.maxOutputTokens).toBe(V3_INITIAL_MAX_OUTPUT_TOKENS);
    }
  });

  it('keeps legacy output and prompting unchanged while the flag is off',async()=>{
    const output=blueprintProviderFixtures()[4].output as {estatePlan:{blueprint?:unknown}};delete output.estatePlan.blueprint;
    generateText.mockResolvedValue({output,totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(200);
    const saved=JSON.parse((await res.json()).json).v3Scene;
    expect(saved.estatePlan.blueprint).toBeUndefined();expect(saved.metadata.blueprintContract).toBeUndefined();
    expect(generateText.mock.calls[0][0].system).not.toContain('BLUEPRINT-FIRST AUTHORING');
  });

  it('adds a missing index in the one existing objective attempt without changing the scene',async()=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    const fixed=blueprintProviderFixtures()[4].output, missing=structuredClone(fixed) as {estatePlan:{blueprint?:unknown}};
    delete missing.estatePlan.blueprint;
    generateText.mockResolvedValueOnce({output:missing,totalUsage:sdkUsage}).mockResolvedValueOnce({output:fixed,totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(200);expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1][0].messages[0].content).toContain('BLUEPRINT_MISSING');
    expect(generateText.mock.calls[1][0].messages[0].content).toContain('BLUEPRINT PRESERVATION');
    expect(JSON.parse((await res.json()).json).v3Scene.metadata.usage.attempts).toBe(2);
  });

  it('rejects two missing blueprints and stops at two mocked calls',async()=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    const missing=blueprintProviderFixtures()[4].output as {estatePlan:{blueprint?:unknown}};delete missing.estatePlan.blueprint;
    generateText.mockResolvedValue({output:missing,totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(422);expect(generateText).toHaveBeenCalledTimes(2);
    const body=await res.json();expect(body.error).toContain('BLUEPRINT_MISSING');expect(body.json).toBeUndefined();
  });

  it('keeps a contradictory blueprint within the existing roof-only repair budget',async()=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    const fixed=blueprintProviderFixtures()[2].output, bad=structuredClone(fixed) as {objects:{roofForm:string}[]};bad.objects[0].roofForm='gable';
    generateText.mockResolvedValueOnce({output:bad,totalUsage:sdkUsage}).mockResolvedValueOnce({output:fixed,totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(200);expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1][0].messages[0].content).toContain('ROOF_FOOTPRINT_UNSUPPORTED');
    expect(JSON.parse((await res.json()).json).v3Scene.objects[0].composition.footprint.kind).toBe('outline');
  });

  it.each([false,true])('preserves a preliminary approval during construction repair (redesign=%s)',async redesign=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');
    const initial=blueprintProviderFixtures()[2].output as {objects:{architecture:{x:number};composition:{assemblies:unknown[]}}[];estatePlan:{character:string}};
    const part={id:'entry-shade',type:'slab',facade:'north',segmentId:'rotunda',start:.7,end:.8,depth:-1};
    initial.objects[0].composition.assemblies=[{id:'detail',intent:'Entry shade',parts:[part]}];
    const redesigned=structuredClone(initial);
    redesigned.objects[0].composition.assemblies=[{id:'detail',intent:'Entry shade',parts:[{...part,depth:.5}]}];
    if(redesign){redesigned.objects[0].architecture.x+=2;redesigned.estatePlan.character='Replacement design';}
    generateText.mockResolvedValueOnce({output:initial,totalUsage:sdkUsage}).mockResolvedValueOnce({output:redesigned,totalUsage:sdkUsage});
    const res=await generateOffline();expect(res.status).toBe(redesign?422:200);expect(generateText).toHaveBeenCalledTimes(2);
    const body=await res.json();
    if(redesign){expect(body.json).toBeUndefined();expect(body.error).toContain('BLUEPRINT_DECISION_DRIFT');}
    else expect(JSON.parse(body.json).v3Scene.objects[0].composition.assemblies[0].parts[0].depth).toBe(.5);
  });

  it('leaves advanced generation outside the flat-site rollout',async()=>{
    vi.stubEnv('AI_V3_BLUEPRINT_FIRST','1');generateText.mockResolvedValue({output:generationScene(),totalUsage:sdkUsage});
    expect((await generateOffline('A hillside residence','advanced')).status).toBe(200);
    expect(generateText.mock.calls[0][0].system).not.toContain('BLUEPRINT-FIRST AUTHORING');
  });

  it.each([
    'Design an ambitious mansion',
    'Design a mansion with a US$750,000 budget, maximum 250 m², on a 25 by 30 metre lot',
    'Design a small 80 m² two-bedroom house without a pool',
    'Design an ultra-luxury estate; choose any coherent massing and amenities',
  ])('passes scale guidance and the unchanged brief to Terra offline: %s', async prompt => {
    const { flatMansion } = await import('@/lib/v3/__tests__/flatMansionFixture');
    generateText.mockResolvedValue({ output: flatMansion(), totalUsage: sdkUsage });
    const { POST } = await import('../route');
    const response = await POST(new NextRequest('http://localhost/api/ai/house', {method:'POST',body:JSON.stringify({mode:'generate',generationMode:'v3-scene',prompt,currentHouseJson:JSON.stringify(BLANK_V3_SCENE)})}));
    expect(response.status).toBe(200);
    const call=generateText.mock.calls[0][0];
    expect(call.messages[0].content).toBe(prompt);
    expect(call.system).toContain('US$5–10 million');
    expect(call.system).toContain('Explicit user budgets, dimensions, site limits and program always take precedence');
    expect(call.system).toContain('Small-house, cottage and modest-home requests must stay appropriately scaled');
    expect(call.system).toContain('Terra independently selects');
    expect(call.system).toContain('NOT required features or a checklist');
  });

  it("defaults to flat land, preserves upper architecture and records the generation setting", async () => {
    const { flatMansion } = await import("@/lib/v3/__tests__/flatMansionFixture");
    generateText.mockResolvedValue({ output: flatMansion(), totalUsage: sdkUsage });
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "Sophisticated mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    expect(response.status).toBe(200);
    // The saved fixture has no stairs: one bounded completeness revision is requested, and the unchanged reply is declined.
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1][0].messages[0].content).toContain("UNREACHABLE_STOREY");
    expect(generateText.mock.calls[0][0].system).toContain("FLAT LAND CONTRACT");
    expect(generateText.mock.calls[1][0].system).toContain("FLAT LAND CONTRACT");
    const scene = JSON.parse((await response.json()).json).v3Scene;
    expect(scene.metadata.terrainMode).toBe("flat");
    expect(scene.site.baseElevation).toBe(0);
    expect(scene.objects.find((o: { id: string }) => o.id === "upper-wing").architecture.baseElevation).toBe(9);
    expect(scene.metadata.designReview.revised).toBe(false);
  });

  it("uses the same flat contract on repair and never commits terrain that violates it", async () => {
    generateText.mockResolvedValue({ output: generationScene(), totalUsage: sdkUsage });
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "flat", prompt: "Mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    expect(response.status).toBe(422);
    expect(generateText).toHaveBeenCalledTimes(2);
    for (const [options] of generateText.mock.calls) expect(options.system).toContain("FLAT LAND CONTRACT");
    const body = await response.json();
    expect(body.json).toBeUndefined();
    expect(body.v3FailedPreview).toBeUndefined();
  });

  it("ignores terrain preferences during edits of an elevated scene", async () => {
    const { POST } = await import("../route");
    const existing = generationScene();
    generateText.mockResolvedValue({ output: { intent: "Change material", operations: [{ op: "changeMaterial", target: "main-volume", material: { id: "stone", color: "#888888" } }] }, totalUsage: sdkUsage });
    const response = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "edit", generationMode: "v3-scene", v3TerrainMode: "flat", prompt: "Change finish", currentHouseJson: JSON.stringify({ ...BLANK_V3_SCENE, v3Scene: existing }) }) }));
    expect(response.status).toBe(200);
    const edited = JSON.parse((await response.json()).json).v3Scene;
    expect(edited.site).toEqual(existing.site);
    expect(edited.siteHierarchy).toEqual(existing.siteHierarchy);
    expect(edited.objects.map((o: { transform: unknown }) => o.transform)).toEqual(existing.objects.map(o => o.transform));
    expect(generateText.mock.calls[0][0].system).not.toContain("FLAT LAND CONTRACT");
  });

  it("retains both rejected raw attempts locally without returning a saveable project", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const retain = vi.spyOn(failureArtifacts, "retainV3FailureArtifact").mockResolvedValue(undefined);
    generateText.mockResolvedValueOnce({ text: '{ "objects": [] }', output: { objects: [] }, totalUsage: sdkUsage })
      .mockResolvedValueOnce({ text: '{ "objects": [], "metadata": {} }', output: { objects: [], metadata: {} }, totalUsage: sdkUsage });
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "Offline test", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    expect(response.status).toBe(422);
    expect(retain.mock.calls).toEqual([
      ['{ "objects": [] }', 0, "ingestion", expect.objectContaining({ decision: "repair-requested", errors: expect.arrayContaining([expect.any(String)]) })],
      ['{ "objects": [], "metadata": {} }', 1, "ingestion", expect.objectContaining({ decision: "rejected", normalizedScene: expect.anything() })],
    ]);
    // The repair call receives Terra's own authored plan, never the normalized runtime scene.
    expect(generateText.mock.calls[1][0].messages[0].content).toContain('Current plan: {"objects":[]}');
    const body = await response.json();
    expect(body.json).toBeUndefined();
    expect(body.rawResponse).toBeUndefined();
  });

  it("accepts malformed cliffside drive metadata without an objective repair request", async () => {
    const { malformedCliffsideDrive } = await import("@/lib/v3/__tests__/cliffsideIngestionFixture");
    generateText.mockResolvedValue({ output: malformedCliffsideDrive(), totalUsage: sdkUsage });
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "Offline cliffside mansion regression", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    expect(response.status).toBe(200);
    // No objective repair: the only follow-up is the bounded design/completeness revision, which keeps the drive.
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1][0].messages[0].content).toContain("Revise this same valid scene plan");
    expect(JSON.parse((await response.json()).json).v3Scene.objects.some((o: { id: string }) => o.id === "upper-road-drive")).toBe(true);
  });

  it("normalizes raw semantic edits and keeps malformed operations atomic", async () => {
    const { POST } = await import("../route");
    const currentHouseJson = JSON.stringify({ ...BLANK_V3_SCENE, v3Scene: scene() });
    generateText.mockResolvedValue({ output: { intent: "Add unknown semantic object", operations: [{ op: "create", object: { id: "new-semantic", semanticRole: "future detail", architecture: { x: 20, z: 0, baseElevation: 0, width: 2, depth: 2, height: 3 } } }] } });
    const request = () => new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "edit", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "Add a detail", currentHouseJson }) });
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(JSON.parse((await res.json()).json).v3Scene.objects.at(-1).id).toBe("new-semantic");
    expect(await generateText.mock.calls[0][0].output.responseFormat).toMatchObject({ type: "json", name: "v3_semantic_edit" });
    generateText.mockResolvedValue({ output: { intent: "Malformed", operations: [{ op: "move", target: "main-volume" }] } });
    expect((await POST(request())).status).toBe(422);
  });

  it("does not route malformed V3 authority into V2 when the client omits mode", async () => {
    const { POST } = await import("../route");
    const response = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", prompt: "House", currentHouseJson: JSON.stringify({ generationMode: "v3-scene", v3Scene: { version: 2 } }) }) }));
    expect(response.status).toBe(409);
    expect(generateText).not.toHaveBeenCalled();
  });

  it("records bounded field-level diagnostics for an SDK structured-output schema rejection", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateText.mockRejectedValue(schemaFailure({ siteHierarchy: { levels: [{ id: 7 }] } }));
    const { POST } = await import("../route");

    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", projectId: "diagnostic-v3", prompt: "private brief must not be logged", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: "V3_MODEL_OUTPUT_INVALID", error: expect.stringContaining("didn't match") });
    expect(usageAssessments).toHaveLength(1);
    expect(usageAssessments[0].meta).toMatchObject({ projectId: "diagnostic-v3", model: expect.any(String), generationMode: "v3-scene", stage: "v3-scene-architect" });
    const assessment = usageAssessments[0].assessment as { errorKind: string; finishReason: string; diagnostic: string; candidate: string };
    expect(assessment).toMatchObject({ errorKind: "v3_model_output_invalid", finishReason: "stop" });
    expect(assessment.diagnostic).toContain("siteHierarchy.levels.0.id");
    const candidate = JSON.parse(assessment.candidate);
    expect(candidate.issues[0]).toMatchObject({ path: "siteHierarchy.levels.0.id", expected: "string" });
    expect(warning).toHaveBeenCalledWith("[v3-contract] structured output failed", expect.objectContaining({ rawPreview: expect.any(String), issues: expect.any(Array) }));
  });

  it("logs the sanitized provider rejection details when V3 is rejected before generation starts", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateText.mockRejectedValue(new APICallError({
      message: "The response format is invalid.", url: "https://provider.invalid/v1/responses", requestBodyValues: {}, statusCode: 400,
      data: { error: { message: "Invalid schema for response_format 'response': unsupported anyOf.", type: "invalid_request_error", code: "invalid_json_schema", param: "text.format.schema" } },
    }));
    const { POST } = await import("../route");

    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

    expect(res.status).toBe(502);
    expect(warning).toHaveBeenCalledWith("[v3-provider] request rejected", {
      name: "AI_APICallError", status: 400, type: "invalid_request_error", code: "invalid_json_schema", parameter: "text.format.schema",
      message: "Invalid schema for response_format 'response': unsupported anyOf.",
    });
  });

  it("normalizes missing support.hostId through normal generation instead of failed-preview recovery", async () => {
    const failed = generationScene();
    failed.objects.find((item) => item.id === "main-volume")!.support = { kind: "slab", relationship: "rests-on" };
    const parsed = v3SceneOutputSchema.safeParse(failed);
    expect(parsed.success).toBe(false);
    generateText.mockResolvedValue({ output: failed, totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } });
    const { POST } = await import("../route");

    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "recoverable mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json() as { json?: string; v3FailedPreview?: unknown; warnings?: string[] };

    expect(res.status).toBe(200);
    expect(body.json).toBeDefined();
    expect(body.v3FailedPreview).toBeUndefined();
    expect(JSON.parse(body.json!).v3Scene.objects.find((item: { id: string }) => item.id === "main-volume")).toBeDefined();
    expect(body.warnings?.join("\n")).toContain("UNRESOLVED_SUPPORT [main-volume]");
  });

  it("uses the same forgiving boundary in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const failed = generationScene();
    failed.objects.find((item) => item.id === "main-volume")!.support = { kind: "slab", relationship: "rests-on" };
    const parsed = v3SceneOutputSchema.safeParse(failed);
    if (parsed.success) throw new Error("fixture must fail strict V3 schema");
    generateText.mockResolvedValue({ output: failed, totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } });
    const { POST } = await import("../route");

    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "strict production", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.json).toEqual(expect.any(String));
    expect(body.v3FailedPreview).toBeUndefined();
  });

  it("classifies malformed structured text as invalid JSON and length finishes as truncation", async () => {
    const { POST } = await import("../route");
    generateText.mockRejectedValueOnce(malformedJsonFailure('{"siteHierarchy":'))
      .mockRejectedValueOnce(malformedJsonFailure('{"siteHierarchy":', "length"));

    const malformed = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "json", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const truncated = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "truncated", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

    expect(await malformed.json()).toMatchObject({ code: "V3_MODEL_JSON_INVALID" });
    expect(await truncated.json()).toMatchObject({ code: "V3_OUTPUT_TRUNCATED" });
    const malformedCandidate = JSON.parse((usageAssessments[0].assessment as { candidate: string }).candidate);
    const truncatedCandidate = JSON.parse((usageAssessments[1].assessment as { candidate: string }).candidate);
    expect(malformedCandidate.jsonParsingFailed).toBe(true);
    expect(truncatedCandidate.jsonParsingFailed).toBe(true);
    expect(truncatedCandidate.finishReason).toBe("length");
  });

  it("bounds and redacts retained raw V3 output without capturing unrelated request data", async () => {
    const secret = "sk-proj-SUPERSECRETKEY123456";
    const raw = `{\"authorization\":\"Bearer ${secret}\",\"headers\":{\"x-private\":\"do-not-log\"},\"payload\":\"${"x".repeat(4_000)}\"}`;
    generateText.mockRejectedValue(malformedJsonFailure(raw));
    const { POST } = await import("../route");

    await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", projectId: "safe-v3", prompt: "UNRELATED PRIVATE REQUEST TEXT", currentHouseJson: JSON.stringify(BLANK_V3_SCENE), history: [{ role: "user", content: "DO NOT LOG THIS" }] }) }));

    const serialized = JSON.stringify(usageAssessments[0]);
    const candidate = JSON.parse((usageAssessments[0].assessment as { candidate: string }).candidate);
    expect(candidate.rawPreview.length).toBeLessThanOrEqual(V3_STRUCTURED_OUTPUT_RAW_PREVIEW_MAX_CHARS);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("do-not-log");
    expect(serialized).not.toContain("UNRELATED PRIVATE REQUEST TEXT");
    expect(serialized).not.toContain("DO NOT LOG THIS");
  });

  it("uses one V3 Architect call, persists direct scene authority, and never enters the V2 pipeline", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const captured = generationScene();
    const modelFacing = toGenerationOutput(captured);
    expect(v3SceneOutputSchema.safeParse(modelFacing).success).toBe(true);
    generateText.mockResolvedValue({ output: modelFacing, totalUsage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 } });
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", projectId: "v3-test", prompt: "dramatic hillside mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json() as { json: string; generationMode: string };
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect((generateText.mock.calls[0][0] as { system: string }).system).toContain("single V3 Scene Architect");
    const output = (generateText.mock.calls[0][0] as { output: { name: string; responseFormat: PromiseLike<unknown> } }).output;
    expect(output.name).toBe("json");
    expect(await output.responseFormat).toEqual({ type: "json", name: "v3_scene" });
    const root = JSON.parse(body.json);
    expect(body.generationMode).toBe("v3-scene");
    expect(root).toMatchObject({ version: 3, generationMode: "v3-scene" });
    expect(root.architecturalDesignDocument).toBeUndefined();
    expect(root.v3Scene.objects.map((o: { id: string }) => o.id)).toEqual(["hillside", "main-volume"]);
    expect(root.v3Scene.siteHierarchy.connections[0].route).toEqual([[0, 0, 25], [0, 1, 27.5], [0, 2, 30]]);
    expect(info).toHaveBeenCalledWith("[generation] generationMode: v3-scene");
    expect(res.headers.get("x-ai-architect-resolved-mode")).toBe("v3-scene");
  });

  it("unwraps a cosmetic scene envelope locally so the single repair call is not spent", async () => {
    const modelFacing = toGenerationOutput(generationScene());
    generateText.mockResolvedValue({ output: { version: 3, generationMode: "v3-scene", v3Scene: modelFacing }, totalUsage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 } });
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", projectId: "v3-test", prompt: "dramatic hillside mansion", currentHouseJson: JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: { version: 3, site: { width: 1, depth: 1, baseElevation: 0 }, objects: [], relationships: [], metadata: {} } }) }) }));
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("allows one bounded repair and keeps JSON-object instructions on both provider calls", async () => {
    const invalid = scene(); invalid.objects.push({ ...invalid.objects[1], id: "main-volume" });
    generateText
      .mockResolvedValueOnce({ output: invalid, totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } })
      .mockResolvedValueOnce({ output: scene(), totalUsage: { inputTokens: 110, outputTokens: 60, totalTokens: 170 } });
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "repairable hillside", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json() as { json: string };
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect((generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content).toContain("Repair this same scene plan only");
    for (const [rawOptions] of generateText.mock.calls) {
      const options = rawOptions as { system: string; messages: { content: string }[]; output: { responseFormat: PromiseLike<unknown> } };
      expect(await options.output.responseFormat).toMatchObject({ type: "json" });
      expect(options.system).toMatch(/\bjson\b/i);
      expect(options.system).toContain("no Markdown fences");
      expect(options.system).toContain("no commentary before or after");
    }
    expect((generateText.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content).not.toMatch(/\bjson\b/i);
    expect(JSON.parse(body.json).v3Scene.metadata.usage).toMatchObject({ attempts: 2, repair: true });
  });

  it("fails closed on a V3/V2 routing mismatch rather than entering V2", async () => {
    const { POST } = await import("../route");
    const v3AsV2 = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v2-architectural", prompt: "mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const v2AsV3 = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "mansion", currentHouseJson: "{}" }) }));

    expect(v3AsV2.status).toBe(409);
    expect(await v3AsV2.json()).toMatchObject({ code: "GENERATION_MODE_ROUTING_ERROR", error: expect.stringContaining("cannot invoke V2") });
    expect(v2AsV3.status).toBe(409);
    expect(await v2AsV3.json()).toMatchObject({ code: "GENERATION_MODE_ROUTING_ERROR", error: expect.stringContaining("V3 routing/configuration error") });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("rejects a V2 document-shaped response under the V3 contract without a V2 fallback", async () => {
    const v2Document = { version: 1, architecturalDesignDocument: { brief: "not a V3 scene" } };
    generateText.mockResolvedValue({ output: v2Document, totalUsage: { inputTokens: 100, outputTokens: 60, totalTokens: 160 } });
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("V3 scene could not pass objective validation") });
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls.every(([options]) => (options as { system: string }).system.includes("single V3 Scene Architect"))).toBe(true);
  });

  it("keeps a large mansion scene within the bounded V3 output budget", async () => {
    const large = scene();
    for (let index = 0; index < 58; index++) {
      large.objects.push({
        id: `scene-item-${index}`,
        type: index % 3 === 0 ? "slab" : index % 3 === 1 ? "wall" : "proxy-asset",
        semanticRole: "mansion detail",
        label: "Detail",
        transform: { position: [index * 2 - 55, 2, index % 8], rotation: [0, 0, 0], scale: [1, 1, 1] },
        dimensions: [1, 1, 1], material: { id: "stone", color: "#817a70", surface: "stone" }, collision: "solid",
      });
    }
    generateText.mockResolvedValue({ output: large, totalUsage: { inputTokens: 800, outputTokens: 6_200, totalTokens: 7_000 } });
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", v3TerrainMode: "advanced", prompt: "large compact hillside mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

    expect(res.status).toBe(200);
    expect(large.objects).toHaveLength(60);
    // Three bytes/token is deliberately conservative for compact JSON with many numbers.
    expect(JSON.stringify(large).length).toBeLessThan(V3_INITIAL_MAX_OUTPUT_TOKENS * 3);
    expect((generateText.mock.calls[0][0] as { maxOutputTokens: number }).maxOutputTokens).toBe(V3_INITIAL_MAX_OUTPUT_TOKENS);
  });
});

describe("POST /api/ai/house V3 architectural design revision", () => {
  it("repairs a missing estate program object in the existing single bounded follow-up", async () => {
    const { estateFixtures } = await import("@/lib/v3/__tests__/estatePlanFixtures");
    const artifact = vi.spyOn(failureArtifacts, "retainV3RevisionArtifact").mockResolvedValue(undefined);
    const fixed = estateFixtures()[1], missing = structuredClone(fixed);
    missing.objects = missing.objects.filter(o => o.id !== "atelier");
    generateText.mockResolvedValueOnce({ output: missing, totalUsage: sdkUsage }).mockResolvedValueOnce({ output: fixed, totalUsage: sdkUsage });
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "An orchard estate", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(artifact.mock.calls[0]?.[0], JSON.stringify(artifact.mock.calls[0]?.[0].reasons)).toMatchObject({ accepted: true });
    const saved = JSON.parse(body.json).v3Scene;
    expect(saved.estatePlan).toEqual(fixed.estatePlan);
    expect(saved.objects.map((o: { id: string }) => o.id)).toContain("atelier");
    expect(generateText.mock.calls[1][0].messages[0].content).toContain("ESTATE_MISSING_OBJECT");
  });

  const raw = async (weak: boolean) => {
    const { object } = await import("@/lib/v3/__tests__/flatMansionFixture");
    // Functionally complete: an entrance, doors into both wings at each floor and one stair, so only composition is reviewed.
    const door = (id: string, facade: string, floors = "all") => ({ id, type: "door", facade, floors, start: .42, end: .58 });
    const primary = { levels: 2, composition: { massHierarchy: "primary", openings: [door("entry", "north", "ground"), door("to-west", "west"), door("to-east", "east")] } };
    const circulation = [{ id: "main-stair", type: "stair", hostId: "main", fromLevel: 0, toLevel: 1, x: -3, z: 0, width: 2.6, depth: 4.6, stairType: "u-shaped", direction: "north" }];
    return { version: 3, site: { width: 120, depth: 120, baseElevation: 0 }, relationships: [], circulation, objects: weak ? [
      object("main", "building-mass", 0, 0, 0, 12, 10, 7, primary),
      object("west", "building-mass", -10, 0, 0, 8, 10, 7, { levels: 2 }),
      object("east", "building-mass", 10, 0, 0, 8, 10, 7, { levels: 2 }),
      object("pool", "pool", 0, 0, -1.3, 4, 4, 1.5),
    ] : [
      object("main", "building-mass", 0, 0, 0, 12, 10, 7, primary),
      object("west", "building-mass", -10, 0, 0, 8, 10, 7, { levels: 2 }),
      object("east", "building-mass", 10, 0, 0, 8, 10, 7, { levels: 2 }),
      object("pool", "pool", 0, 20, -1.3, 4, 4, 1.5),
    ] };
  };
  const post = async () => {
    const { POST } = await import("../route");
    return POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "Sophisticated villa", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
  };
  const masses = (body: { json: string }) => JSON.parse(body.json).v3Scene.objects.map((o: { id: string; dimensions: number[] }) => `${o.id}:${o.dimensions.join(",")}`);

  it("spends the single follow-up on one specific architectural revision and keeps it when it improves", async () => {
    generateText.mockResolvedValueOnce({ output: await raw(true), totalUsage: sdkUsage }).mockResolvedValueOnce({ output: await raw(false), totalUsage: sdkUsage });
    const res = await post(), body = await res.json();
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);
    const message = generateText.mock.calls[1][0].messages[0].content as string;
    expect(message).toContain("Revise this same valid scene plan");
    expect(message).toContain("OUTDOOR_PLACEMENT_CONFLICT");
    expect(message).not.toContain("WEAK_MASS_HIERARCHY [");
    expect(message).toContain("Current plan:");
    expect(body.summary).toContain("one architectural revision");
    const meta = JSON.parse(body.json).v3Scene.metadata.designReview;
    expect(meta.revised).toBe(true);
    expect(meta.final).not.toContain("OUTDOOR_PLACEMENT_CONFLICT");
    expect(meta.initial).toEqual(expect.arrayContaining(["WEAK_MASS_HIERARCHY", "FLUSH_MASS_COMPOSITION", "LIMITED_MASSING_DEPTH"]));
    expect(masses(body)).toContain("main:12,7,10");
  });

  it("keeps the first valid scene when the revision is not better, invalid, or fails", async () => {
    for (const second of [{ output: await raw(true) }, { output: { objects: [] } }, new Error("provider down")]) {
      generateText.mockReset();
      generateText.mockResolvedValueOnce({ output: await raw(true), totalUsage: sdkUsage });
      if (second instanceof Error) generateText.mockRejectedValueOnce(second); else generateText.mockResolvedValueOnce({ ...second, totalUsage: sdkUsage });
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(failureArtifacts, "retainV3FailureArtifact").mockResolvedValue(undefined);
      const res = await post(), body = await res.json();
      expect(res.status).toBe(200);
      expect(generateText).toHaveBeenCalledTimes(2);
      expect(masses(body)).toContain("main:12,7,10");
      expect(JSON.parse(body.json).v3Scene.metadata.designReview.revised).toBe(false);
      expect(body.warnings.some((w: string) => w.startsWith("DESIGN_WEAK_MASS_HIERARCHY"))).toBe(false);
      expect(body.v3DesignReview.diagnostics.some((d: { code: string; severity: string }) => d.code === "WEAK_MASS_HIERARCHY" && d.severity === "advisory")).toBe(true);
    }
  });

  it("rejects a redesign even when it fixes the collision and has fewer warnings", async () => {
    const changed = await raw(false);
    changed.objects[0].architecture.height += 2;
    generateText.mockResolvedValueOnce({ output: await raw(true), totalUsage: sdkUsage }).mockResolvedValueOnce({ output: changed, totalUsage: sdkUsage });
    const res = await post(), body = await res.json();
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(masses(body)).toContain("main:12,7,10");
    expect(JSON.parse(body.json).v3Scene.metadata.designReview.revised).toBe(false);
    expect(body).not.toHaveProperty("rawResponse");
    expect(body).not.toHaveProperty("revisedScene");
  });

  it("spends the single revision on missing vertical circulation and keeps a reply that only adds the stair", async () => {
    const incomplete = await raw(false) as Record<string, unknown>, complete = await raw(false);
    delete incomplete.circulation;
    generateText.mockResolvedValueOnce({ output: incomplete, totalUsage: sdkUsage }).mockResolvedValueOnce({ output: complete, totalUsage: sdkUsage });
    const res = await post(), body = await res.json();
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect(generateText.mock.calls[1][0].messages[0].content).toContain("UNREACHABLE_STOREY [main]");
    const saved = JSON.parse(body.json).v3Scene;
    expect(saved.metadata.designReview).toMatchObject({ revised: true, initial: expect.arrayContaining(["UNREACHABLE_STOREY"]) });
    expect(saved.metadata.designReview.final).not.toContain("UNREACHABLE_STOREY");
    expect(saved.interior.circulation.map((c: { id: string }) => c.id)).toEqual(["main-stair"]);
    expect(masses(body)).toContain("main:12,7,10");
  });

  it("does not call revision for a symmetrical equal-height design with aligned facades", async () => {
    const coherent = await raw(true);
    coherent.objects = coherent.objects.filter(o => o.id !== "pool");
    generateText.mockResolvedValueOnce({ output: coherent, totalUsage: sdkUsage });
    const res = await post(), body = await res.json();
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(body.v3DesignReview.significant).toBe(0);
  });

  it("never adds a design revision after an objective repair, and never for a well-composed scene", async () => {
    generateText.mockResolvedValueOnce({ output: { objects: [] }, totalUsage: sdkUsage }).mockResolvedValueOnce({ output: await raw(true), totalUsage: sdkUsage });
    vi.spyOn(failureArtifacts, "retainV3FailureArtifact").mockResolvedValue(undefined);
    expect((await post()).status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);
    generateText.mockReset();
    generateText.mockResolvedValue({ output: await raw(false), totalUsage: sdkUsage });
    expect((await post()).status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});

describe('V3 offline architecture acceptance safety',()=>{
 const invoke=async()=>{const {POST}=await import('../route');return POST(new NextRequest('http://localhost/api/ai/house',{method:'POST',body:JSON.stringify({mode:'generate',generationMode:'v3-scene',prompt:'A circular luxury residence with a compatible roof',currentHouseJson:JSON.stringify(BLANK_V3_SCENE)})}));};
 it('uses one roof-only repair, preserves the curve and accounts for both calls',async()=>{
  const {curvedFixture}=await import('@/lib/v3/parity/curved');const valid=curvedFixture('circular-pavilion'),bad=structuredClone(valid);bad.objects[0].roofForm='hip';
  generateText.mockResolvedValueOnce({output:bad,totalUsage:{inputTokens:100,outputTokens:200,totalTokens:300}}).mockResolvedValueOnce({output:valid,totalUsage:{inputTokens:120,outputTokens:210,totalTokens:330}});
  const response=await invoke(),body=await response.json();expect(response.status,JSON.stringify(body)).toBe(200);
  expect(generateText).toHaveBeenCalledTimes(2);const stored=JSON.parse(body.json).v3Scene;
  expect(stored.objects[0].composition.footprint).toEqual(valid.objects[0].composition!.footprint);
  expect(stored.metadata.usage).toMatchObject({attempts:2,inputTokens:220,outputTokens:410,totalTokens:630});
  expect(generateText.mock.calls[1][0].messages[0].content).toContain('ROOF_FOOTPRINT_UNSUPPORTED');
 });
 it('never persists a roofless result or a repair that redesigns the mansion',async()=>{
  const {curvedFixture}=await import('@/lib/v3/parity/curved');
  for(const redesign of [false,true]){
   generateText.mockReset();const bad=curvedFixture('circular-pavilion');bad.objects[0].roofForm='gable';const repair=structuredClone(bad);
   if(redesign){repair.objects[0].roofForm='flat';delete repair.objects[0].composition!.footprint;}
   generateText.mockResolvedValueOnce({output:bad,totalUsage:sdkUsage}).mockResolvedValueOnce({output:repair,totalUsage:sdkUsage});
   const response=await invoke(),body=await response.json();expect(response.status).toBe(422);expect(body.json).toBeUndefined();expect(generateText).toHaveBeenCalledTimes(2);
  }
 });
 it('rejects remaining mansion relationships before acceptance and sends all actionable findings in one offline repair',async()=>{
  const {default:raw}=await import('@/lib/v3/__tests__/fixtures/canopy-meridian-attempt-1.json');
  const candidate=structuredClone(raw);
  // Remove the historical sole fatal blocker, leaving the new geometric acceptance checks to decide.
  Object.assign(candidate.objects.find(o=>o.id==='sunsetLawn')!.architecture,{z:46.75,depth:20.5});
  vi.spyOn(failureArtifacts,'retainV3FailureArtifact').mockResolvedValue(undefined);
  generateText.mockResolvedValue({output:candidate,totalUsage:sdkUsage});
  const response=await invoke(),body=await response.json();
  expect(response.status).toBe(422);expect(body.json).toBeUndefined();
  expect(generateText).toHaveBeenCalledTimes(2);
  const feedback=generateText.mock.calls[1][0].messages[0].content;
  for(const code of ['AUTHORED_SITE_OVERRUN','AUTHORED_ACCESS_DISCONNECTED','ESTATE_ALLOCATION_CONFLICT','AUTHORED_ACCESS_THRESHOLD','NO_OUTDOOR_LIVING_ACCESS'])expect(feedback).toContain(code);
  expect(feedback).toContain('3.50m');expect(feedback).toContain('zone-wellness');
 });
 it('rejects a valid JSON prefix when the provider reports output truncation',async()=>{
  const {curvedFixture}=await import('@/lib/v3/parity/curved');generateText.mockResolvedValue({output:curvedFixture('circular-pavilion'),finishReason:'length',totalUsage:sdkUsage});
  const response=await invoke(),body=await response.json();expect(response.status).toBe(502);expect(body.code).toBe('V3_OUTPUT_TRUNCATED');expect(body.json).toBeUndefined();expect(generateText).toHaveBeenCalledTimes(1);
 });
});
