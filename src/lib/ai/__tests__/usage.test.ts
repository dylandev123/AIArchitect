import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { APICallError, NoObjectGeneratedError, type LanguageModelUsage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeCostUsd, DEFAULT_PRICING, getPricingTable, parsePricingOverride } from "../pricing";
import { readUsageRecords } from "../usage/store";
import { summarizeUsage } from "../usage/summary";
import { buildUsageRecord, withUsageLogging, type UsageMeta } from "../usage/track";
import type { AiUsageRecord } from "../usage/types";

const usage = (input: number, cached: number, output: number, total?: number): LanguageModelUsage => ({
  inputTokens: input,
  inputTokenDetails: { noCacheTokens: input - cached, cacheReadTokens: cached, cacheWriteTokens: undefined },
  outputTokens: output,
  outputTokenDetails: { textTokens: output, reasoningTokens: undefined },
  totalTokens: total ?? input + output,
});

describe("computeCostUsd", () => {
  it("prices terra: uncached input, cached input, and output separately", () => {
    // 600k uncached * $2 + 400k cached * $0.20 + 100k out * $12 = 1.2 + 0.08 + 1.2
    const cost = computeCostUsd("gpt-5.6-terra", { inputTokens: 1_000_000, cachedInputTokens: 400_000, outputTokens: 100_000 });
    expect(cost).toBeCloseTo(2.48, 10);
  });

  it("prices luna", () => {
    // 1M in (none cached) * 0.20 + 1M out * 1.20
    expect(computeCostUsd("gpt-5.6-luna", { inputTokens: 1_000_000, cachedInputTokens: 0, outputTokens: 1_000_000 })).toBeCloseTo(1.4, 10);
    // all-cached input: 1M * 0.02
    expect(computeCostUsd("gpt-5.6-luna", { inputTokens: 1_000_000, cachedInputTokens: 1_000_000, outputTokens: 0 })).toBeCloseTo(0.02, 10);
  });

  it("handles a small realistic request", () => {
    // 12,345 in (2,048 cached), 1,500 out on terra
    const cost = computeCostUsd("gpt-5.6-terra", { inputTokens: 12_345, cachedInputTokens: 2_048, outputTokens: 1_500 });
    expect(cost).toBeCloseTo((10_297 * 2 + 2_048 * 0.2 + 1_500 * 12) / 1e6, 12);
  });

  it("returns 0 for zero usage and null for an unpriced model", () => {
    expect(computeCostUsd("gpt-5.6-terra", { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 })).toBe(0);
    expect(computeCostUsd("mystery-model", { inputTokens: 10, cachedInputTokens: 0, outputTokens: 10 })).toBeNull();
  });

  it("never lets cached tokens exceed input tokens", () => {
    const cost = computeCostUsd("gpt-5.6-terra", { inputTokens: 100, cachedInputTokens: 500, outputTokens: 0 });
    expect(cost).toBeCloseTo((100 * 0.2) / 1e6, 15);
  });
});

describe("pricing configuration", () => {
  it("exposes the initial rates", () => {
    expect(DEFAULT_PRICING["gpt-5.6-terra"]).toEqual({ input: 2, cachedInput: 0.2, output: 12 });
    expect(DEFAULT_PRICING["gpt-5.6-luna"]).toEqual({ input: 0.2, cachedInput: 0.02, output: 1.2 });
  });

  it("merges a valid AI_PRICING_JSON override over the defaults", () => {
    const table = getPricingTable('{"gpt-5.6-luna":{"input":1,"cachedInput":0.1,"output":5},"new-model":{"input":3,"cachedInput":0.3,"output":9}}');
    expect(table["gpt-5.6-luna"].input).toBe(1);
    expect(table["new-model"].output).toBe(9);
    expect(table["gpt-5.6-terra"]).toEqual(DEFAULT_PRICING["gpt-5.6-terra"]);
  });

  it("ignores malformed overrides", () => {
    expect(parsePricingOverride("not json")).toEqual({});
    expect(parsePricingOverride('[1,2]')).toEqual({});
    expect(parsePricingOverride('{"bad":{"input":-1,"cachedInput":0,"output":0},"worse":{"input":"1"}}')).toEqual({});
  });
});

const meta: UsageMeta = { projectId: "proj-1", requestType: "scoped_edit", scope: "zone", model: "gpt-5.6-terra" };

describe("buildUsageRecord", () => {
  it("uses provider-reported counts as-is", () => {
    const r = buildUsageRecord(meta, usage(1000, 200, 300, 1300), { startedAt: 0, latencyMs: 812.4, errorKind: null });
    expect(r).toMatchObject({
      projectId: "proj-1", requestType: "scoped_edit", scope: "zone", model: "gpt-5.6-terra",
      inputTokens: 1000, cachedInputTokens: 200, outputTokens: 300, totalTokens: 1300, latencyMs: 812, success: true, errorKind: null,
    });
    expect(r.costUsd).toBeCloseTo((800 * 2 + 200 * 0.2 + 300 * 12) / 1e6, 12);
  });

  it("records zeros (not estimates) when the provider returned no usage", () => {
    const r = buildUsageRecord(meta, undefined, { startedAt: 0, latencyMs: 5, errorKind: "error" });
    expect(r).toMatchObject({ inputTokens: 0, outputTokens: 0, totalTokens: 0, success: false, costUsd: 0 });
  });
});

describe("withUsageLogging", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "ai-usage-test-"));
    process.env.AI_USAGE_LOG_PATH = path.join(dir, "log.jsonl");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("POSTGRES_URL", "");
  });
  afterEach(async () => {
    delete process.env.AI_USAGE_LOG_PATH;
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("logs a successful call and returns its result untouched", async () => {
    const result = { output: "x", totalUsage: usage(500, 100, 50) };
    await expect(withUsageLogging(meta, async () => result)).resolves.toBe(result);
    const [rec, ...rest] = await readUsageRecords();
    expect(rest).toHaveLength(0);
    expect(rec).toMatchObject({ success: true, errorKind: null, inputTokens: 500, cachedInputTokens: 100, outputTokens: 50, projectId: "proj-1" });
  });

  it("logs a failed call, keeps billed tokens from NoObjectGeneratedError, and rethrows", async () => {
    const err = new NoObjectGeneratedError({
      message: "bad", response: { id: "r", timestamp: new Date(), modelId: "m" }, usage: usage(700, 0, 80), finishReason: "stop",
    });
    await expect(withUsageLogging(meta, async () => { throw err; })).rejects.toBe(err);
    const [rec] = await readUsageRecords();
    expect(rec).toMatchObject({ success: false, errorKind: "schema_mismatch", inputTokens: 700, outputTokens: 80 });
    expect(rec.costUsd).toBeGreaterThan(0);
  });

  it("logs provider errors without persisting the error message (which can echo API keys)", async () => {
    const secret = "sk-proj-SUPERSECRETKEY123";
    const err = new APICallError({
      message: `Incorrect API key provided: ${secret}`, url: "https://api.openai.com", requestBodyValues: { prompt: "PRIVATE PROMPT" }, statusCode: 401,
    });
    await expect(withUsageLogging(meta, async () => { throw err; })).rejects.toBe(err);
    const raw = await readFile(process.env.AI_USAGE_LOG_PATH!, "utf8");
    expect(raw).not.toContain(secret);
    expect(raw).not.toContain("PRIVATE PROMPT");
    expect(JSON.parse(raw)).toMatchObject({ success: false, errorKind: "provider_401", totalTokens: 0 });
  });

  it("does not fail the request when the log can't be written", async () => {
    process.env.AI_USAGE_LOG_PATH = "/dev/null/cannot/write.jsonl";
    await expect(withUsageLogging(meta, async () => ({ totalUsage: usage(1, 0, 1) }))).resolves.toBeDefined();
  });

  it("stores only the documented fields", async () => {
    await withUsageLogging(meta, async () => ({ totalUsage: usage(1, 0, 1) }));
    const [rec] = await readUsageRecords();
    expect(Object.keys(rec).sort()).toEqual(
      ["cachedInputTokens", "costUsd", "errorKind", "id", "inputTokens", "latencyMs", "model", "outputTokens", "projectId", "requestType", "scope", "success", "timestamp", "totalTokens"]
    );
  });
});

describe("summarizeUsage", () => {
  const rec = (over: Partial<AiUsageRecord>): AiUsageRecord => ({
    id: Math.random().toString(), timestamp: "2026-09-26T10:00:00.000Z", projectId: "a", requestType: "scoped_edit", scope: "zone",
    model: "gpt-5.6-terra", inputTokens: 100, cachedInputTokens: 0, outputTokens: 50, totalTokens: 150, latencyMs: 1000,
    success: true, errorKind: null, costUsd: 1, ...over,
  });
  const now = new Date("2026-09-26T15:00:00.000Z");

  it("computes headline metrics", () => {
    const s = summarizeUsage(
      [
        rec({ costUsd: 1 }),
        rec({ costUsd: 3, timestamp: "2026-09-02T10:00:00.000Z", projectId: "b", model: "gpt-5.6-luna", requestType: "generation" }),
        rec({ costUsd: 2, timestamp: "2026-08-30T10:00:00.000Z", success: false, projectId: null, totalTokens: 450 }),
      ],
      now
    );
    expect(s.spendToday).toBe(1);
    expect(s.spendMonth).toBe(4);
    expect(s.totalRequests).toBe(3);
    expect(s.successRate).toBeCloseTo(2 / 3);
    expect(s.avgCostPerRequest).toBe(2);
    expect(s.avgTokensPerRequest).toBe(250);
    expect(s.byModel.map((b) => b.key).sort()).toEqual(["gpt-5.6-luna", "gpt-5.6-terra"]);
    expect(s.byModel.find((b) => b.key === "gpt-5.6-terra")).toMatchObject({ requests: 2, costUsd: 3 });
    expect(s.byRequestType.find((b) => b.key === "generation")).toMatchObject({ requests: 1, costUsd: 3 });
    expect(s.byProject.map((b) => b.key).sort()).toEqual(["(no project)", "a", "b"]);
  });

  it("respects the viewer's timezone for today/month boundaries", () => {
    const r = rec({ timestamp: "2026-09-27T02:00:00.000Z" }); // Sep 26 evening in UTC-5 (offset +300)
    const at = new Date("2026-09-26T23:00:00.000Z");
    expect(summarizeUsage([r], at, 0).spendToday).toBe(0);
    expect(summarizeUsage([r], at, 300).spendToday).toBe(1);
  });

  it("excludes unpriced requests from spend and cost average, and flags them", () => {
    const s = summarizeUsage([rec({ costUsd: 2 }), rec({ costUsd: null, model: "x" })], now);
    expect(s.spendToday).toBe(2);
    expect(s.avgCostPerRequest).toBe(2);
    expect(s.unpricedRequests).toBe(1);
    expect(s.totalRequests).toBe(2);
  });

  it("is safe on an empty log", () => {
    const s = summarizeUsage([], now);
    expect(s).toMatchObject({ totalRequests: 0, successRate: null, avgCostPerRequest: null, avgTokensPerRequest: null, spendToday: 0 });
  });
});
