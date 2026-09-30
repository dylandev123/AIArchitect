import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { NoOutputGeneratedError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { modelOutput, VILLA_BRIEF } from "@/lib/library/__tests__/villaFixture";
import { stageOf, v2StageResponder } from "@/lib/architecture/__tests__/v2StageResponder";
import type { AiUsageRecord } from "@/lib/ai/usage/types";

/**
 * The real generation route with every model call stubbed (no live AI) and the REAL usage logger writing to a
 * temp log: Site Plan token exhaustion is recovered with a bigger budget or fails the generation as
 * OUTPUT_TRUNCATED, and every V2 model call is persisted with its owning stage and attempt.
 */

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (work: () => unknown) => void Promise.resolve(work()) }));

const finalAssembly = () => modelOutput({ ops: [{ op: "addPool", value: { wall: "north", offset: 4, distance: 3, width: 10, depth: 5, waterDepth: 1.5 } }] });

/** A reasoning model that spent the whole allowance before emitting text: resolves, but `.output` throws. */
const exhausted = (maxOutputTokens: number) => ({
  finishReason: "length", text: "",
  totalUsage: { inputTokens: 3000, inputTokenDetails: {}, outputTokens: maxOutputTokens, outputTokenDetails: { reasoningTokens: maxOutputTokens }, totalTokens: 3000 + maxOutputTokens },
  get output(): never { throw new NoOutputGeneratedError(); },
});

/** The authored responder, except Site Plan exhausts its budget on the first `exhaustedCalls` attempts. */
function responder(exhaustedCalls: number) {
  const authored = v2StageResponder(finalAssembly);
  let sitePlanCalls = 0;
  return async (options: { system: string; maxOutputTokens: number }) => {
    if (stageOf(options.system) === "sitePlan" && sitePlanCalls++ < exhaustedCalls) return exhausted(options.maxOutputTokens);
    return authored(options);
  };
}

beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "route-token-exhaustion-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("AI_USAGE_LOG_PATH", path.join(dir, "usage.jsonl"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  generateText.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function generate() {
  const { POST } = await import("../route");
  const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", projectId: "proj-tokens", prompt: VILLA_BRIEF, currentHouseJson: BLANK_HOUSE_JSON }) }));
  return { res, body: (await res.json()) as Record<string, unknown> & { json?: string; code?: string; stage?: string; conflicts?: string[] } };
}
const usageRecords = async (): Promise<AiUsageRecord[]> => (await import("@/lib/ai/usage/store")).readUsageRecords();
const sitePlanCaps = () => generateText.mock.calls.filter((call) => stageOf((call[0] as { system: string }).system) === "sitePlan").map((call) => (call[0] as { maxOutputTokens: number }).maxOutputTokens);
const persistedGenerations = async () => (await (await import("@/lib/library/store")).readLibrary()).generations.length;

describe("V2 generation — Site Plan token exhaustion and usage diagnostics", () => {
  it("F: recovers an exhausted Site Plan with a bigger budget and persists every V2 call with its owning stage and attempt", async () => {
    generateText.mockImplementation(responder(1));
    const { res, body } = await generate();

    expect(res.status).toBe(200);
    expect(body.json).toBeDefined();
    expect(sitePlanCaps()).toEqual([4000, 6400]);

    const calls = (await usageRecords()).filter((r) => r.requestType === "generation");
    expect(calls).toHaveLength(generateText.mock.calls.length);
    for (const record of calls) {
      expect(record.stage, JSON.stringify(record)).toMatch(/^(foundation|mass-expansion|architectural-geometry|roof-composition|site-plan|final-assembly)$/);
      expect(record.retryNumber).toEqual(expect.any(Number));
      expect(record.maxOutputTokens).toEqual(expect.any(Number));
      expect(record.promptFingerprint).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(new Set(calls.map((r) => r.stage))).toEqual(new Set(["foundation", "mass-expansion", "architectural-geometry", "roof-composition", "site-plan", "final-assembly"]));
    // Per-turn mass expansion calls keep their owning stage, with the turn as `stageCall`.
    expect(calls.filter((r) => r.stage === "mass-expansion").every((r) => /^mass-expansion-\d+$/.test(r.stageCall ?? ""))).toBe(true);

    const sitePlan = calls.filter((r) => r.stage === "site-plan");
    expect(sitePlan).toMatchObject([
      { retryNumber: 0, retryReason: null, maxOutputTokens: 4000, success: false, errorKind: "output_truncated", finishReason: "length", outputTokens: 4000 },
      { retryNumber: 1, retryReason: "output_truncated", maxOutputTokens: 6400, success: true, errorKind: null },
    ]);
    expect(sitePlan[1].outputFingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it("D: exhaustion on the final Site Plan attempt fails the generation as OUTPUT_TRUNCATED; nothing finalizes and the reason is persisted", async () => {
    generateText.mockImplementation(responder(Infinity));
    const { res, body } = await generate();

    expect(res.status).toBe(502);
    expect(body).toMatchObject({ code: "v2-generation-failed", stage: "site-plan", outcome: "failed" });
    expect(body.json).toBeUndefined();
    expect(body.conflicts?.join(" ")).toMatch(/^OUTPUT_TRUNCATED: site-plan exhausted its output budget \(2 attempt\(s\), last allowance 6400 tokens\)/);
    expect(sitePlanCaps()).toEqual([4000, 6400]);
    expect(generateText.mock.calls.map((call) => stageOf((call[0] as { system: string }).system))).not.toContain("finalAssembly");
    expect(await persistedGenerations()).toBe(0);

    const records = await usageRecords();
    expect(records.filter((r) => r.stage === "site-plan" && r.requestType === "generation")).toMatchObject([
      { retryNumber: 0, errorKind: "output_truncated", maxOutputTokens: 4000 },
      { retryNumber: 1, errorKind: "output_truncated", maxOutputTokens: 6400, retryReason: "output_truncated" },
    ]);
    const failure = records.find((r) => r.requestType === "generation_failure");
    expect(failure).toMatchObject({ stage: "site-plan", errorKind: "v2-generation-failed", success: false, totalTokens: 0, projectId: "proj-tokens" });
    expect(failure?.diagnostic).toMatch(/^OUTPUT_TRUNCATED/);
  });
});
