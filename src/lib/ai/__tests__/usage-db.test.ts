import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readUsageRecords } from "../usage/store";
import { withUsageLogging, type UsageMeta } from "../usage/track";
import { summarizeUsage } from "../usage/summary";
import type { AiUsageRecord } from "../usage/types";

const meta: UsageMeta = { projectId: "proj-db", requestType: "generation", scope: "world", model: "gpt-5.6-terra" };
const usage = { inputTokens: 100, outputTokens: 20, totalTokens: 120, inputTokenDetails: { cacheReadTokens: 10 } };
const run = () => withUsageLogging(meta, async () => ({ totalUsage: usage as never }));

describe("database usage store (unreachable DB)", () => {
  beforeEach(() => vi.stubEnv("DATABASE_URL", "postgres://u:p@127.0.0.1:1/none"));
  afterEach(() => vi.unstubAllEnvs());

  it("never breaks the AI request when the database is down", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(run()).resolves.toBeDefined();
    spy.mockRestore();
  });
});

// Runs only against a real Postgres: TEST_DATABASE_URL=postgres://... npm test
describe.skipIf(!process.env.TEST_DATABASE_URL)("database usage store (live Postgres)", () => {
  beforeEach(() => vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!));
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    const { Pool } = await import("pg");
    const p = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    await p.query("DELETE FROM ai_usage WHERE project_id = 'proj-db'").catch(() => {});
    await p.end();
  });

  it("round-trips a record through ai_usage and feeds the summary", async () => {
    await run();
    const recs = (await readUsageRecords()).filter((r: AiUsageRecord) => r.projectId === "proj-db");
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.at(-1)).toMatchObject({ requestType: "generation", scope: "world", model: "gpt-5.6-terra", inputTokens: 100, cachedInputTokens: 10, outputTokens: 20, totalTokens: 120, success: true, errorKind: null });
    expect(recs.at(-1)!.costUsd).toBeGreaterThan(0);
    expect(summarizeUsage(recs).totalRequests).toBe(recs.length);
  });
});
