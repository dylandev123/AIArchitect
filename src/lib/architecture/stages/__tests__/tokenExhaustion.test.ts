import { beforeEach, describe, expect, it, vi } from "vitest";
import { JSONParseError, NoObjectGeneratedError, NoOutputGeneratedError, TypeValidationError } from "ai";
import { z } from "zod";
import { createTimings } from "@/lib/ai/timing";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const usageMeta = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };
const schema = z.object({ name: z.string(), rooms: z.array(z.string()) });
const valid = { name: "Villa", rooms: ["living", "kitchen"] };
const sdkUsage = (outputTokens: number) => ({ inputTokens: 900, inputTokenDetails: {}, outputTokens, outputTokenDetails: { reasoningTokens: outputTokens }, totalTokens: 900 + outputTokens }) as ConstructorParameters<typeof NoObjectGeneratedError>[0]["usage"];

/**
 * What `generateText` really returns when a reasoning model spends the whole allowance before emitting any text:
 * it resolves (finishReason "length", no text) and only `.output` throws `NoOutputGeneratedError`.
 */
function exhaustedResponse(maxOutputTokens: number) {
  return {
    finishReason: "length", text: "", totalUsage: sdkUsage(maxOutputTokens),
    get output(): never { throw new NoOutputGeneratedError(); },
  };
}

/** What `generateText` throws for text cut off mid-object at the token limit. */
function cutOff(text: string, maxOutputTokens: number) {
  return new NoObjectGeneratedError({
    message: "No object generated: could not parse the response.", text,
    cause: new JSONParseError({ text, cause: new SyntaxError("Unexpected end of JSON input") }),
    response: { id: "x", timestamp: new Date(), modelId: "test" }, usage: sdkUsage(maxOutputTokens), finishReason: "length",
  });
}

function schemaRejection(raw: unknown) {
  const parsed = schema.safeParse(raw);
  if (parsed.success) throw new Error("fixture must fail the schema");
  return new NoObjectGeneratedError({
    message: "No object generated: response did not match schema.", text: JSON.stringify(raw),
    cause: new TypeValidationError({ value: raw, cause: parsed.error }),
    response: { id: "x", timestamp: new Date(), modelId: "test" }, usage: sdkUsage(120), finishReason: "stop",
  });
}

const cap = (call: number) => (generateText.mock.calls[call][0] as { maxOutputTokens: number }).maxOutputTokens;
const prompt = (call: number) => (generateText.mock.calls[call][0] as { messages: { content: string }[] }).messages[0].content;

async function run(maxOutputTokens = 1000, maxAttempts?: number) {
  const { runStage } = await import("../runStage");
  return runStage({
    stageName: "test-stage", system: "SYSTEM", schema, timings: createTimings(), remainingBudgetMs: 60_000, usageMeta, maxOutputTokens, maxAttempts,
    buildMessage: (errors) => ["BRIEF", errors.length ? `Correct: ${errors.join("; ")}` : ""].filter(Boolean).join("\n\n"),
  });
}

beforeEach(() => { generateText.mockReset(); vi.stubEnv("OPENAI_API_KEY", "test-key"); });

describe("runStage — output-token exhaustion", () => {
  it("A: recovers from an empty exhaustion (No output generated) with a larger budget and a concise instruction", async () => {
    const { OUTPUT_TRUNCATED_RETRY_INSTRUCTION } = await import("../runStage");
    generateText
      .mockImplementationOnce(async (opts: { maxOutputTokens: number }) => exhaustedResponse(opts.maxOutputTokens))
      .mockResolvedValueOnce({ output: valid, finishReason: "stop", totalUsage: {} });

    const result = await run(1000);

    expect(result).toMatchObject({ ok: true, value: valid, attempts: 2 });
    expect(cap(0)).toBe(1000);
    expect(cap(1)).toBe(1600);
    expect(prompt(1)).toContain(OUTPUT_TRUNCATED_RETRY_INSTRUCTION);
    // The retry is never wasted on the SDK's bare "No output generated" text.
    expect(prompt(1)).not.toMatch(/No output generated/);
    expect(result.repairRequests).toEqual([OUTPUT_TRUNCATED_RETRY_INSTRUCTION]);
  });

  it("B: recovers from partial-JSON truncation with a larger budget", async () => {
    const { OUTPUT_TRUNCATED_RETRY_INSTRUCTION } = await import("../runStage");
    const partial = JSON.stringify(valid).slice(0, -12);
    generateText.mockRejectedValueOnce(cutOff(partial, 1000)).mockResolvedValueOnce({ output: valid, finishReason: "stop", totalUsage: {} });

    const result = await run(1000);

    expect(result).toMatchObject({ ok: true, value: valid, attempts: 2 });
    expect(cap(1)).toBe(1600);
    expect(prompt(1)).toContain(OUTPUT_TRUNCATED_RETRY_INSTRUCTION);
    expect(prompt(1)).not.toMatch(/could not parse/);
  });

  it("C: a genuine schema error is a validation failure, not token exhaustion — same budget, field-level repair", async () => {
    const { OUTPUT_TRUNCATED_RETRY_INSTRUCTION } = await import("../runStage");
    generateText.mockRejectedValueOnce(schemaRejection({ name: "Villa", rooms: "living" })).mockRejectedValueOnce(schemaRejection({ name: 7, rooms: [] }));

    const result = await run(1000);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("VALIDATION_FAILED");
    expect(cap(1)).toBe(1000);
    expect(prompt(1)).toMatch(/rooms/);
    expect(prompt(1)).not.toContain(OUTPUT_TRUNCATED_RETRY_INSTRUCTION);
    expect(result.errors.join(" ")).not.toMatch(/OUTPUT_TRUNCATED/);
  });

  it("C: 'No output generated' with a non-length finish reason (e.g. content filter) is not token exhaustion", async () => {
    generateText.mockResolvedValue({ finishReason: "content-filter", text: "", totalUsage: {}, get output(): never { throw new NoOutputGeneratedError(); } });

    const result = await run(1000);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("GENERATION_ERROR");
    expect(cap(1)).toBe(1000);
  });

  it("D: exhaustion on the final attempt fails cleanly with OUTPUT_TRUNCATED", async () => {
    generateText.mockImplementation(async (opts: { maxOutputTokens: number }) => exhaustedResponse(opts.maxOutputTokens));

    const result = await run(1000);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("OUTPUT_TRUNCATED");
    expect(result.attempts).toBe(2);
    expect(result.errors).toEqual(["OUTPUT_TRUNCATED: test-stage exhausted its output budget (2 attempt(s), last allowance 1600 tokens)."]);
  });

  it("keeps growth bounded at 2× the initial allowance however many attempts a stage is given", async () => {
    generateText.mockImplementation(async (opts: { maxOutputTokens: number }) => exhaustedResponse(opts.maxOutputTokens));

    const result = await run(1000, 5);

    expect(result.ok).toBe(false);
    expect(generateText.mock.calls.map((_, i) => cap(i))).toEqual([1000, 1600, 2000, 2000, 2000]);
  });
});

describe("Site Plan — output budget", () => {
  const context = { brief: "A tropical luxury house", house: { width: 18, depth: 12, floors: 2 }, viewDirection: "south" as const, arrivalDirection: "north" as const };

  it("E: starts at 4000 tokens and grows once, bounded, after exhaustion", async () => {
    const { runSitePlanStage, SITE_PLAN_MAX_OUTPUT_TOKENS } = await import("../sitePlanStage");
    expect(SITE_PLAN_MAX_OUTPUT_TOKENS).toBe(4000);
    generateText.mockImplementation(async (opts: { maxOutputTokens: number }) => exhaustedResponse(opts.maxOutputTokens));

    const result = await runSitePlanStage(context, createTimings(), 60_000, usageMeta);

    expect(generateText.mock.calls.map((_, i) => cap(i))).toEqual([4000, 6400]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("OUTPUT_TRUNCATED");
    // The Site Plan prompt never carries the bare SDK message as a correction.
    expect(prompt(1)).not.toMatch(/Correct: No output generated/);
  });
});
