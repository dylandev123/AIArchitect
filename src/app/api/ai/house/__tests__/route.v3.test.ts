import { NextRequest } from "next/server";
import { APICallError, JSONParseError, NoObjectGeneratedError, TypeValidationError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BLANK_V3_SCENE, type V3Scene } from "@/lib/v3/scene";
import { v3SceneOutputSchema } from "@/lib/v3/schema";
import { toGenerationOutput } from "@/lib/v3/__tests__/generationFixture";
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

beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "test-key"); generateText.mockReset(); usageAssessments.length = 0; });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("POST /api/ai/house V3 scene mode", () => {
  it("records bounded field-level diagnostics for an SDK structured-output schema rejection", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    generateText.mockRejectedValue(schemaFailure({ siteHierarchy: { levels: [{ id: 7 }] } }));
    const { POST } = await import("../route");

    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", projectId: "diagnostic-v3", prompt: "private brief must not be logged", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

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

    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

    expect(res.status).toBe(502);
    expect(warning).toHaveBeenCalledWith("[v3-provider] request rejected", {
      name: "AI_APICallError", status: 400, type: "invalid_request_error", code: "invalid_json_schema", parameter: "text.format.schema",
      message: "Invalid schema for response_format 'response': unsupported anyOf.",
    });
  });

  it("returns a recoverable dev-only preview for valid JSON without turning it into a persisted result", async () => {
    const failed = generationScene();
    failed.objects.find((item) => item.id === "main-volume")!.support = { kind: "slab", relationship: "rests-on" };
    const parsed = v3SceneOutputSchema.safeParse(failed);
    expect(parsed.success).toBe(false);
    generateText.mockRejectedValue(new NoObjectGeneratedError({
      message: "No object generated: response did not match schema.", text: JSON.stringify(failed),
      cause: new TypeValidationError({ value: failed, cause: parsed.error }), response: sdkResponse, usage: sdkUsage, finishReason: "stop",
    }));
    const { POST } = await import("../route");

    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "recoverable mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json() as { json?: string; v3FailedPreview?: { scene: V3Scene; diagnostics: { unsupportedObjectIds: string[] } } };

    expect(res.status).toBe(502);
    expect(body.json).toBeUndefined();
    expect(body.v3FailedPreview?.scene.objects.map((item) => item.id)).toContain("main-volume");
    expect(body.v3FailedPreview?.diagnostics.unsupportedObjectIds).toContain("main-volume");
  });

  it("keeps the same structured-output failure closed in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const failed = generationScene();
    failed.objects.find((item) => item.id === "main-volume")!.support = { kind: "slab", relationship: "rests-on" };
    const parsed = v3SceneOutputSchema.safeParse(failed);
    if (parsed.success) throw new Error("fixture must fail strict V3 schema");
    generateText.mockRejectedValue(new NoObjectGeneratedError({
      message: "No object generated: response did not match schema.", text: JSON.stringify(failed),
      cause: new TypeValidationError({ value: failed, cause: parsed.error }), response: sdkResponse, usage: sdkUsage, finishReason: "stop",
    }));
    const { POST } = await import("../route");

    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "strict production", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(502);
    expect(body.json).toBeUndefined();
    expect(body.v3FailedPreview).toBeUndefined();
  });

  it("classifies malformed structured text as invalid JSON and length finishes as truncation", async () => {
    const { POST } = await import("../route");
    generateText.mockRejectedValueOnce(malformedJsonFailure('{"siteHierarchy":'))
      .mockRejectedValueOnce(schemaFailure({ siteHierarchy: { levels: [{ id: 7 }] } }, '{"siteHierarchy":', "length"));

    const malformed = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "json", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const truncated = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "truncated", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

    expect(await malformed.json()).toMatchObject({ code: "V3_MODEL_JSON_INVALID" });
    expect(await truncated.json()).toMatchObject({ code: "V3_OUTPUT_TRUNCATED" });
    const malformedCandidate = JSON.parse((usageAssessments[0].assessment as { candidate: string }).candidate);
    const truncatedCandidate = JSON.parse((usageAssessments[1].assessment as { candidate: string }).candidate);
    expect(malformedCandidate.jsonParsingFailed).toBe(true);
    expect(truncatedCandidate.jsonParsingFailed).toBe(false);
    expect(truncatedCandidate.finishReason).toBe("length");
  });

  it("bounds and redacts retained raw V3 output without capturing unrelated request data", async () => {
    const secret = "sk-proj-SUPERSECRETKEY123456";
    const raw = `{\"authorization\":\"Bearer ${secret}\",\"headers\":{\"x-private\":\"do-not-log\"},\"payload\":\"${"x".repeat(4_000)}\"}`;
    generateText.mockRejectedValue(malformedJsonFailure(raw));
    const { POST } = await import("../route");

    await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", projectId: "safe-v3", prompt: "UNRELATED PRIVATE REQUEST TEXT", currentHouseJson: JSON.stringify(BLANK_V3_SCENE), history: [{ role: "user", content: "DO NOT LOG THIS" }] }) }));

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
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", projectId: "v3-test", prompt: "dramatic hillside mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json() as { json: string; generationMode: string };
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect((generateText.mock.calls[0][0] as { system: string }).system).toContain("single V3 Scene Architect");
    const root = JSON.parse(body.json);
    expect(body.generationMode).toBe("v3-scene");
    expect(root).toMatchObject({ version: 3, generationMode: "v3-scene" });
    expect(root.architecturalDesignDocument).toBeUndefined();
    expect(root.v3Scene.objects.map((o: { id: string }) => o.id)).toEqual(["hillside", "main-volume"]);
    expect(root.v3Scene.siteHierarchy.connections[0].route).toEqual([[0, 0, 25], [0, 1, 27.5], [0, 2, 30]]);
    expect(info).toHaveBeenCalledWith("[generation] generationMode: v3-scene");
    expect(res.headers.get("x-ai-architect-resolved-mode")).toBe("v3-scene");
  });

  it("allows exactly one bounded repair for an objectively invalid mocked plan", async () => {
    const invalid = scene(); invalid.objects.push({ ...invalid.objects[1], id: "main-volume" });
    generateText
      .mockResolvedValueOnce({ output: invalid, totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } })
      .mockResolvedValueOnce({ output: scene(), totalUsage: { inputTokens: 110, outputTokens: 60, totalTokens: 170 } });
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "repairable hillside", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const body = await res.json() as { json: string };
    expect(res.status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);
    expect((generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content).toContain("Repair this same scene plan only");
    expect(JSON.parse(body.json).v3Scene.metadata.usage).toMatchObject({ attempts: 2, repair: true });
  });

  it("fails closed on a V3/V2 routing mismatch rather than entering V2", async () => {
    const { POST } = await import("../route");
    const v3AsV2 = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v2-architectural", prompt: "mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));
    const v2AsV3 = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "mansion", currentHouseJson: "{}" }) }));

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
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

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
    const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", generationMode: "v3-scene", prompt: "large compact hillside mansion", currentHouseJson: JSON.stringify(BLANK_V3_SCENE) }) }));

    expect(res.status).toBe(200);
    expect(large.objects).toHaveLength(60);
    // Three bytes/token is deliberately conservative for compact JSON with many numbers.
    expect(JSON.stringify(large).length).toBeLessThan(V3_INITIAL_MAX_OUTPUT_TOKENS * 3);
    expect((generateText.mock.calls[0][0] as { maxOutputTokens: number }).maxOutputTokens).toBe(V3_INITIAL_MAX_OUTPUT_TOKENS);
  });
});
