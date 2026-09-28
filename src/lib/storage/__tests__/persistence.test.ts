import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiUsageRecord } from "@/lib/ai/usage/types";
import type { KnowledgeNeed } from "@/types/library";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "persistence-test-"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("AI_USAGE_LOG_PATH", path.join(dir, "usage.jsonl"));
  vi.resetModules();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const usageRecord = (id: string): AiUsageRecord => ({
  id, timestamp: new Date().toISOString(), projectId: null, requestType: "learn", scope: "world", model: "m",
  inputTokens: 1, cachedInputTokens: 0, outputTokens: 1, totalTokens: 2, latencyMs: 1, success: true, errorKind: null, costUsd: 0.01,
});

const knowledge = (id: string): KnowledgeNeed => ({
  id, title: id, areas: [], requestCount: 1, firstSeen: "2026-01-01T00:00:00Z", lastSeen: "2026-01-01T00:00:00Z", recentRequests: [], projectExamples: [],
  styles: [], scales: [], environments: [], weaknessTotal: 0, assetIds: [], recipeIds: [], status: "open", version: 1,
});

/** A server restart is a fresh module graph reading the same files. */
const restart = () => vi.resetModules();

describe("storage selection", () => {
  it("uses local files without a database URL, and Postgres with either variable", async () => {
    const { usageStorageInfo } = await import("@/lib/ai/usage/store");
    const { libraryStorageInfo } = await import("@/lib/library/store");
    expect(usageStorageInfo()).toMatchObject({ kind: "local-json", location: path.join(dir, "usage.jsonl"), ephemeral: false });
    expect(libraryStorageInfo()).toMatchObject({ kind: "local-json", location: path.join(dir, "library.json") });

    vi.stubEnv("POSTGRES_URL", "postgres://user:secret@db.example.com:5432/app");
    expect(usageStorageInfo()).toEqual({ kind: "postgres", location: "db.example.com:5432", ephemeral: false });
    expect(libraryStorageInfo().kind).toBe("postgres");
    expect(JSON.stringify([usageStorageInfo(), libraryStorageInfo()])).not.toContain("secret");
  });

  it("does not use a temp-dir fallback on production/serverless hosts", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("AI_LIBRARY_PATH", "");
    vi.stubEnv("AI_USAGE_LOG_PATH", "");
    const { usageStorageInfo } = await import("@/lib/ai/usage/store");
    const { readUsageRecords } = await import("@/lib/ai/usage/store");
    const { libraryStorageInfo, readLibrary } = await import("@/lib/library/store");
    expect(usageStorageInfo().kind).toBe("unavailable");
    expect(libraryStorageInfo().kind).toBe("unavailable");
    await expect(readUsageRecords()).rejects.toThrow("Production shared persistence is not configured.");
    await expect(readLibrary()).rejects.toThrow("Production shared persistence is not configured.");
  });
});

describe("survives a restart", () => {
  it("usage", async () => {
    const first = await import("@/lib/ai/usage/store");
    await first.appendUsageRecord(usageRecord("a"));
    await first.appendUsageRecord(usageRecord("b"));
    restart();
    const second = await import("@/lib/ai/usage/store");
    expect((await second.readUsageRecords()).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("knowledge, needs, recipes and plans", async () => {
    const first = await import("@/lib/library/store");
    await first.mutateLibrary(() => ({
      put: [
        { kind: "knowledge", data: knowledge("k1") },
        { kind: "need", data: { id: "n1" } as never },
        { kind: "recipe", data: { id: "r1" } as never },
        { kind: "plan", data: { id: "p1" } as never },
      ],
      result: undefined,
    }));
    restart();
    const second = await import("@/lib/library/store");
    const lib = await second.readLibrary();
    expect([lib.knowledge.length, lib.needs.length, lib.recipes.length, lib.plans.length]).toEqual([1, 1, 1, 1]);
  });

  it("makes a generated Asset Need immediately available through the Asset Plan lookup after a module reload", async () => {
    const writer = await import("@/lib/library/store");
    await writer.mutateLibrary(() => ({
      put: [{ kind: "need", data: { id: "need-from-generation", title: "Outdoor Dining Furniture", category: "furniture", styleTags: [], contextTags: [], phrasings: [] } as never }],
      result: undefined,
    }));

    // Simulates Next dev replacing the route module that owns the planner.
    restart();
    const { planAssets } = await import("@/lib/library/planner");
    const generate = vi.fn(async () => ({}));
    const result = await planAssets({ needId: "need-from-generation" }, generate);

    // The invalid offline response proves the lookup succeeded without an AI call;
    // a stale store would return 404 before invoking `generate`.
    expect(generate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it("serializes writers created by separate module graphs for the same library path", async () => {
    const first = await import("@/lib/library/store");
    const one = first.createFileBackend(path.join(dir, "library.json"));
    restart();
    const second = await import("@/lib/library/store");
    const two = second.createFileBackend(path.join(dir, "library.json"));

    await Promise.all([
      one.mutate(() => ({ put: [{ kind: "need", data: { id: "writer-one" } as never }], result: undefined })),
      two.mutate(() => ({ put: [{ kind: "need", data: { id: "writer-two" } as never }], result: undefined })),
    ]);

    expect((await second.readLibrary()).needs.map((need) => need.id).sort()).toEqual(["writer-one", "writer-two"]);
  });

  it("a file written before Knowledge Needs and Asset Plans existed still loads", async () => {
    await writeFile(path.join(dir, "library.json"), JSON.stringify({ needs: [{ id: "old" }], recipes: [{ id: "old" }] }));
    const { readLibrary } = await import("@/lib/library/store");
    const lib = await readLibrary();
    expect([lib.needs.length, lib.recipes.length, lib.knowledge.length, lib.plans.length]).toEqual([1, 1, 0, 0]);
  });
});

describe("a storage error is never an empty store", () => {
  it("a store that has never been written is empty", async () => {
    const usage = await import("@/lib/ai/usage/store");
    const library = await import("@/lib/library/store");
    expect(await usage.readUsageRecords()).toEqual([]);
    expect((await library.readLibrary()).needs).toEqual([]);
  });

  it("a corrupt library file fails reads and writes and is left exactly as it was", async () => {
    const file = path.join(dir, "library.json");
    const corrupt = '{"needs":[{"id":"precious"}],"recipes":[';
    await writeFile(file, corrupt);
    const { readLibrary, mutateLibrary } = await import("@/lib/library/store");
    await expect(readLibrary()).rejects.toThrow();
    await expect(mutateLibrary(() => ({ put: [{ kind: "knowledge", data: knowledge("k") }], result: undefined }))).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe(corrupt);
    expect((await readdir(dir)).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("an unreadable usage log throws instead of reading as zero requests, and is recorded for the diagnostics", async () => {
    await mkdir(path.join(dir, "usage.jsonl")); // a directory where the log should be: EISDIR
    const { readUsageRecords } = await import("@/lib/ai/usage/store");
    const { recentStorageErrors } = await import("@/lib/storage/diagnostics");
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(readUsageRecords()).rejects.toThrow();
    expect(recentStorageErrors()[0]).toMatchObject({ domain: "usage", op: "read" });
  });

  it("a failed library write is recorded for the diagnostics", async () => {
    const blocker = path.join(dir, "file");
    await writeFile(blocker, "x");
    vi.stubEnv("AI_LIBRARY_PATH", path.join(blocker, "sub", "library.json"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { mutateLibrary } = await import("@/lib/library/store");
    const { recentStorageErrors } = await import("@/lib/storage/diagnostics");
    await expect(mutateLibrary(() => ({ result: undefined }))).rejects.toThrow();
    expect(recentStorageErrors()[0]).toMatchObject({ domain: "library", op: "write" });
  });
});

describe("browser-local asset state stays separate from server knowledge", () => {
  it("nothing that persists the library or usage reads the browser asset store", async () => {
    const root = path.join(process.cwd(), "src");
    const files = ["lib/library/store.ts", "lib/library/service.ts", "lib/ai/usage/store.ts", "app/api/admin/library/route.ts", "app/api/admin/usage/route.ts", "app/api/admin/diagnostics/route.ts"];
    for (const f of files) {
      const text = await readFile(path.join(root, f), "utf8");
      expect(text, f).not.toMatch(/from\s+["'][^"']*(useAssetStore|glbStorage)["']|\b(localStorage|indexedDB)\./);
    }
  });
});
