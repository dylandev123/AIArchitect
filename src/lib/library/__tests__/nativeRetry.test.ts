import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { LanguageModelUsage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildAsset } from "@/lib/assets/native/build";
import { SAMPLES, lantern } from "@/lib/assets/native/__tests__/fixtures";
import { withUsageLogging } from "@/lib/ai/usage/track";
import { readUsageRecords } from "@/lib/ai/usage/store";
import { summarizeUsage } from "@/lib/ai/usage/summary";
import type { AssetSpec } from "@/lib/assets/native/spec";
import { buildRepairPrompt, DEFAULT_UPGRADE_INSTRUCTION, generateNativeSpec, generateSpecWithRepair, generateUpgradeSpec, nativeRequestType, type NativeGenerateInput } from "../nativeAi";
import { savePlan } from "../service";
import { readLibrary } from "../store";
import type { PlanInput } from "../plans";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "native-retry-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("AI_USAGE_LOG_PATH", path.join(dir, "usage.jsonl"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

const good = SAMPLES.barStool;
const withPart = (spec: AssetSpec, i: number, over: Record<string, unknown>) => ({ ...spec, parts: spec.parts.map((p, k) => (k === i ? { ...p, ...over } : p)) });

/** A model that answers with each response in turn, recording what it was asked. */
const model = (...responses: unknown[]) => {
  const calls: NativeGenerateInput[] = [];
  const generate = vi.fn(async (input: NativeGenerateInput) => {
    calls.push(input);
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  });
  return { generate, calls };
};

/** Common ways a model gets a spec wrong, each with what it should have written. All are repairable: the error names the fix. */
const heavy = {
  ...SAMPLES.deckChair,
  family: "lamp",
  dimensions: { width: 0.5, depth: 0.5, height: 0.6 },
  parts: Array.from({ length: 6 }, (_, i) => ({ primitive: "lattice", role: `shade-${i}`, material: "teak", form: "tapered", radiusBottom: 0.24, radiusTop: 0.24, height: 0.5, ribs: 48, bands: 24, strand: 0.006, weave: true, position: [0, 0.3, 0] })),
};
const COMMON: [string, unknown, RegExp][] = [
  ["a part naming a material that is not a slot", withPart(good, 0, { material: "gold" }), /uses unknown material "gold"/],
  ["a size outside the family's realistic range", { ...good, dimensions: { ...good.dimensions, height: 2.5 } }, /outside the realistic/],
  ["a primitive that does not exist", { ...good, parts: [...good.parts, { primitive: "wedge", role: "x", material: "steel", position: [0, 0.3, 0] }] }, /unknown primitive "wedge"/],
  ["parts that build far from the declared size", { ...SAMPLES.diningTable, dimensions: { width: 3, depth: 0.9, height: 0.75 } }, /too far from the declared/],
  ["a spec too heavy even at the lowest reduction", heavy, /Too heavy/],
  ["more parts than allowed", { ...good, parts: Array.from({ length: 49 }, (_, i) => ({ ...good.parts[1], role: `p${i}` })) }, /Too many parts \(49; limit 48\)/],
  ["a dimension that is not a positive size", { ...good, dimensions: { width: 0.44, depth: 0.44, height: 0 } }, /dimensions\.height: must be a positive number/],
  ["an unreadable colour", { ...good, materials: [{ key: "leather", material: "stucco", color: "between brown and grey" }, good.materials[1]] }, /6-digit hex colour/],
  ["duplicate material keys", { ...good, materials: [...good.materials, good.materials[0]] }, /Duplicate material keys/],
  ["a sphere with no size", { ...good, parts: [...good.parts, { primitive: "sphere", role: "knob", material: "steel", position: [0, 0.3, 0] }] }, /radius must be a positive number/],
];

describe("one automatic repair retry", () => {
  it.each(COMMON)("fixes %s", async (_label, bad, message) => {
    const direct = buildAsset(bad);
    expect(direct.ok).toBe(false);
    expect(!direct.ok && direct.error).toMatch(message);
    expect(!direct.ok && direct.repairable).toBe(true);
    const error = !direct.ok ? direct.error : "";

    const { generate, calls } = model(bad, good);
    const out = await generateSpecWithRepair(generate, "PROMPT");
    expect(out.ok && out.kind).toBe("built");
    expect(out.ok && out.kind === "built" && out.retry).toEqual({ firstError: error });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(calls.map((c) => c.attempt)).toEqual(["initial", "repair"]);
    // The model gets the validator's own words, and the spec that caused them.
    expect(calls[1].prompt).toContain("PROMPT");
    expect(calls[1].prompt).toContain(`ERROR: ${error}`);
    expect(calls[1].prompt).toContain(JSON.stringify(bad).slice(0, 200));
    expect(calls[1].system).toBe(calls[0].system);
  });

  it("does not retry a spec that builds, and repairs cosmetic slips locally without asking the model again", async () => {
    const { generate } = model(good);
    expect((await generateSpecWithRepair(generate, "P")).ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
    const cosmetic = model({ ...good, style: "a very long sentence describing the style of this stool in far too many words", light: { type: "point", color: "#ffffff", intensity: 5, range: 5 } });
    const out = await generateSpecWithRepair(cosmetic.generate, "P");
    expect(out.ok && out.kind === "built" && out.retry).toBeUndefined();
    expect(cosmetic.generate).toHaveBeenCalledTimes(1);
  });

  it("retries once and never twice: a second failure ends it", async () => {
    const bad = withPart(good, 0, { material: "gold" });
    const worse = withPart(good, 0, { material: "platinum" });
    const { generate } = model(bad, worse, good);
    const out = await generateSpecWithRepair(generate, "P");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(out).toMatchObject({ ok: false, status: 502 });
    expect(!out.ok && out.error).toContain('unknown material "platinum"');
    expect(!out.ok && out.error).toContain('An automatic repair retry ran after: Part "seat" uses unknown material "gold"');
  });

  describe("hard failures fail immediately, without a retry", () => {
    it.each([
      ["a response that is not in the output format", { nonsense: true }],
      ["a family the generator does not build", { ...good, family: "spaceship" }],
    ])("%s", async (_label, bad) => {
      const { generate } = model(bad, good);
      const out = await generateSpecWithRepair(generate, "P");
      expect(out.ok).toBe(false);
      expect(generate).toHaveBeenCalledTimes(1);
    });

    it("garbage values and non-object specs are flagged not repairable by the validator itself", () => {
      const nan = buildAsset({ ...good, dimensions: { width: NaN, depth: 0.4, height: 0.7 } });
      expect(nan.ok || nan.repairable).toBe(false);
      const notObject = buildAsset("spec");
      expect(notObject.ok || notObject.repairable).toBe(false);
      const family = buildAsset({ ...good, family: "spaceship" });
      expect(family.ok || family.repairable).toBe(false);
    });

    it("an 'unsupported' verdict is a routing answer, not a failure: no retry", async () => {
      const { generate } = model({ ...good, unsupported: { reason: "figurative carving" } }, good);
      expect(await generateSpecWithRepair(generate, "P")).toMatchObject({ ok: true, kind: "external", reason: "figurative carving" });
      expect(generate).toHaveBeenCalledTimes(1);
    });

    it("a provider failure on the first attempt propagates untouched, and is not retried", async () => {
      const { generate } = model(new Error("provider down"), good);
      await expect(generateSpecWithRepair(generate, "P")).rejects.toThrow("provider down");
      expect(generate).toHaveBeenCalledTimes(1);
    });
  });

  it("a retry that cannot run reports the original error rather than throwing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { generate } = model(withPart(good, 0, { material: "gold" }), new Error("provider down"));
    const out = await generateSpecWithRepair(generate, "P");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(out).toMatchObject({ ok: false, status: 502 });
    expect(!out.ok && out.error).toMatch(/uses unknown material "gold".*could not run/);
  });

  it("a retry may conclude the object cannot be built natively", async () => {
    const { generate } = model(withPart(good, 0, { material: "gold" }), { ...good, unsupported: { reason: "needs carving" } });
    expect(await generateSpecWithRepair(generate, "P")).toMatchObject({ ok: true, kind: "external", reason: "needs carving", retry: { firstError: expect.stringContaining("gold") } });
  });

  it("builds a bounded repair prompt", () => {
    const prompt = buildRepairPrompt("ORIGINAL", { big: "x".repeat(30_000) }, "the exact error");
    expect(prompt.startsWith("ORIGINAL")).toBe(true);
    expect(prompt).toContain("ERROR: the exact error");
    expect(prompt).toContain("(cut)");
    expect(prompt.length).toBeLessThan(15_500);
  });
});

describe("the retry is logged apart from the first attempt", () => {
  const usage = (input: number, output: number): LanguageModelUsage => ({
    inputTokens: input,
    inputTokenDetails: { noCacheTokens: input, cacheReadTokens: 0, cacheWriteTokens: undefined },
    outputTokens: output,
    outputTokenDetails: { textTokens: output, reasoningTokens: undefined },
    totalTokens: input + output,
  });

  it("uses a different request type for each attempt", () => {
    expect(nativeRequestType("initial")).toBe("native_asset");
    expect(nativeRequestType("repair")).toBe("native_asset_retry");
  });

  it("records two lines with their own tokens and cost, which add up to the whole", async () => {
    const answers = [
      { output: withPart(good, 0, { material: "gold" }), totalUsage: usage(4_000, 900) },
      { output: good, totalUsage: usage(4_600, 950) },
    ];
    const generate = async ({ attempt }: NativeGenerateInput) => {
      const r = await withUsageLogging({ projectId: null, requestType: nativeRequestType(attempt), scope: "component", model: "gpt-5.6-luna" }, async () => answers.shift()!);
      return r.output;
    };
    const out = await generateSpecWithRepair(generate, "P");
    expect(out.ok).toBe(true);

    const records = await readUsageRecords();
    expect(records.map((r) => r.requestType)).toEqual(["native_asset", "native_asset_retry"]);
    expect(records.map((r) => r.inputTokens)).toEqual([4_000, 4_600]);
    expect(records.every((r) => r.success && r.costUsd! > 0)).toBe(true);

    const summary = summarizeUsage(records);
    const byType = Object.fromEntries(summary.byRequestType.map((b) => [b.key, b]));
    expect(byType.native_asset.requests).toBe(1);
    expect(byType.native_asset_retry.requests).toBe(1);
    expect(byType.native_asset_retry.costUsd).toBeCloseTo(records[1].costUsd!, 12);
    expect(byType.native_asset.costUsd + byType.native_asset_retry.costUsd).toBeCloseTo(records[0].costUsd! + records[1].costUsd!, 12);
  });
});

describe("generateNativeSpec with the retry", () => {
  const savedPlan = async () => {
    const asset = { name: "Bar Stool", category: "furniture", description: "A stool.", style: ["tropical"], material: "teak", dimensions: { width: 0.44, depth: 0.44, height: 0.76 }, tags: [], priority: "recommended", estimatedReuse: 80, contexts: [], generationPrompt: "A bar stool in warm teak with rounded edges, slender legs and a clean silhouette" };
    const saved = await savePlan({ title: "Kitchen", status: "draft", assets: [asset] } as unknown as PlanInput);
    if (!saved.ok) throw new Error(saved.error);
    return { plan: saved.value, stool: saved.value.assets[0] };
  };

  it("stores the corrected spec, reports what was fixed, and asks the model with the same asset context", async () => {
    const { plan, stool } = await savedPlan();
    const { generate, calls } = model(withPart(good, 0, { material: "gold" }), good);
    const res = await generateNativeSpec(plan.id, stool.id, generate);
    expect(res).toMatchObject({ ok: true, kind: "spec", stats: { retry: { firstError: expect.stringContaining("gold") } } });
    expect(calls[1].prompt).toContain("Asset: Bar Stool");
    expect((await readLibrary()).plans[0].assets[0].spec?.family).toBe("bar-stool");
  });

  it("keeps the previous draft when the retry does not fix it", async () => {
    const { plan, stool } = await savedPlan();
    await generateNativeSpec(plan.id, stool.id, model(good).generate);
    const bad = withPart(good, 0, { material: "gold" });
    const { generate } = model(bad, bad);
    expect(await generateNativeSpec(plan.id, stool.id, generate)).toMatchObject({ ok: false, status: 502 });
    expect(generate).toHaveBeenCalledTimes(2);
    expect((await readLibrary()).plans[0].assets[0].spec?.materials.map((m) => m.key)).toEqual(["leather", "steel"]);
  });

  it("refinement gets the same single retry", async () => {
    const { plan, stool } = await savedPlan();
    await generateNativeSpec(plan.id, stool.id, model(good).generate);
    const { generate, calls } = model(withPart(good, 0, { material: "gold" }), good);
    expect((await generateNativeSpec(plan.id, stool.id, generate, { instruction: "thicker legs" })).ok).toBe(true);
    expect(calls[0].prompt).toContain("thicker legs");
    expect(calls[1].prompt).toContain("thicker legs");
    expect(calls[1].prompt).toContain("ERROR:");
  });
});

describe("upgrade generation", () => {
  const source = { name: "Iron Garden Lantern", category: "light" as const, style: ["rustic"], dimensions: { width: 0.32, depth: 0.32, height: 0.56 }, generationPrompt: "A lantern", current: lantern };
  const better = { ...lantern, parts: lantern.parts.map((p) => (p.role === "bulb" ? { ...p, radius: 0.075 } : p)) };

  it("asks for an improved version of the current spec, and saves nothing", async () => {
    const { generate, calls } = model(better);
    const res = await generateUpgradeSpec(source, generate);
    expect(res).toMatchObject({ ok: true, kind: "spec" });
    expect(res.ok && res.kind === "spec" && res.spec.parts.find((p) => p.role === "bulb")).toMatchObject({ radius: 0.075 });
    expect(calls[0].attempt).toBe("initial");
    expect(calls[0].prompt).toContain("UPGRADE the current approved spec");
    expect(calls[0].prompt).toContain(DEFAULT_UPGRADE_INSTRUCTION);
    expect(calls[0].prompt).toContain('"role":"handle"');
    expect((await readLibrary()).plans).toEqual([]);
  });

  it("passes the admin's notes instead of the default, and keeps the light unless told otherwise", async () => {
    const { generate, calls } = model(better);
    await generateUpgradeSpec(source, generate, "a slimmer, more graceful frame");
    expect(calls[0].prompt).toContain("Instruction: a slimmer, more graceful frame");
    expect(calls[0].prompt).not.toContain(DEFAULT_UPGRADE_INSTRUCTION);
    expect(calls[0].prompt).toContain("keep any glow or scene light");
  });

  it("gets the same one retry", async () => {
    const { generate, calls } = model(withPart(better as unknown as AssetSpec, 0, { material: "gold" }), better);
    const res = await generateUpgradeSpec(source, generate);
    expect(res).toMatchObject({ ok: true, kind: "spec", stats: { retry: { firstError: expect.stringContaining("gold") } } });
    expect(calls.map((c) => c.attempt)).toEqual(["initial", "repair"]);
  });

  it("refuses to start from a current spec that is no longer valid", async () => {
    const { generate } = model(better);
    expect(await generateUpgradeSpec({ ...source, current: { nonsense: true } }, generate)).toMatchObject({ ok: false, status: 400 });
    expect(generate).not.toHaveBeenCalled();
  });
});
