import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLES } from "@/lib/assets/native/__tests__/fixtures";
import type { AssetGenerationProvider } from "@/lib/assetGeneration/types";
import { buildPlannedAssetRequest } from "@/lib/assetGeneration/providers";
import type { CuratedAsset } from "@/types/assets";
import type { AssetPlan, Need } from "@/types/library";
import { generateNativeSpec, buildNativePrompt } from "../nativeAi";
import { planAssets, validatePlan, planContext } from "../planner";
import { finalizeGenerationPrompt, planInputSchema, planStats, plansFor, type PlanInput } from "../plans";
import { completePlannedAsset, deletePlan, discardNativeSpec, generateExternal, savePlan } from "../service";
import { mutateLibrary, readLibrary } from "../store";

beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "plans-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const need: Need = {
  id: "need-kitchen", title: "Tropical Outdoor Kitchen", category: "outdoor-kitchen", styleTags: ["tropical"], contextTags: ["terrace"], requestedCount: 3,
  firstRequested: "2026-09-01T00:00:00.000Z", lastRequested: "2026-09-02T00:00:00.000Z", projectRefs: [], phrasings: ["outdoor kitchen"], status: "needed",
};
const seedNeed = () => mutateLibrary(() => ({ put: [{ kind: "need" as const, data: need }], result: undefined }));

const raw = (name: string, over: Record<string, unknown> = {}) => ({
  name, category: "furniture", description: `A ${name}.`, style: ["tropical"], material: "teak", dimensions: { width: 0.5, depth: 0.5, height: 0.8 },
  tags: ["outdoor"], priority: "recommended", estimatedReuse: 80, contexts: ["terrace", "spaceship"], generationPrompt: `A ${name} in warm teak with rounded edges, slender legs and a clean silhouette`, ...over,
});
const pack = () => ({
  assets: [
    raw("Kitchen Island", { category: "outdoor-kitchen", priority: "required", estimatedReuse: 92 }),
    raw("BBQ Grill", { category: "outdoor-kitchen", priority: "required", estimatedReuse: 90 }),
    raw("Outdoor Sink", { category: "outdoor-kitchen", priority: "required", estimatedReuse: 85 }),
    raw("Bar Stool", { estimatedReuse: 97 }),
    raw("Pendant Light", { category: "light", estimatedReuse: 88 }),
    raw("Herb Garden", { category: "vegetation", priority: "optional", estimatedReuse: 40 }),
    raw("Special Sculpture", { category: "decorative", priority: "optional", estimatedReuse: 21 }),
  ],
});

describe("AI asset planner", () => {
  it("drafts a pack of individual assets ordered required-first, then by reuse, and saves nothing", async () => {
    await seedNeed();
    const generate = vi.fn().mockResolvedValue(pack());
    const res = await planAssets({ needId: need.id }, generate);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(generate.mock.calls[0][0].prompt).toContain("Need: Tropical Outdoor Kitchen");
    expect(generate.mock.calls[0][0].system).toMatch(/Do NOT design one scene/);
    expect(res.draft.needId).toBe(need.id);
    expect(res.draft.assets.map((a) => a.name)).toEqual(["Kitchen Island", "BBQ Grill", "Outdoor Sink", "Bar Stool", "Pendant Light", "Herb Garden", "Special Sculpture"]);
    expect(res.draft.assets.every((a) => !a.approved && !a.generated && a.generationPrompt.includes("Single freestanding object"))).toBe(true);
    expect(res.draft.assets[0].contexts).toEqual(["terrace"]);
    expect((await readLibrary()).plans).toEqual([]);
  });

  it("routes organic and figurative assets to external generation", async () => {
    await seedNeed();
    const res = await planAssets({ needId: need.id }, async () => pack());
    if (!res.ok) throw new Error("expected ok");
    const route = Object.fromEntries(res.draft.assets.map((a) => [a.name, a.route]));
    expect(route["Bar Stool"]).toBe("native");
    expect(route["Kitchen Island"]).toBe("native");
    expect(route["Herb Garden"]).toBe("external-generation-recommended");
    expect(route["Special Sculpture"]).toBe("external-generation-recommended");
  });

  it("rejects whole-scene assets, duplicates and invalid entries one by one, and unusable packs as a whole", () => {
    const ctx = planContext(need, undefined, [], ["Bar Stool"])!;
    const ok = validatePlan({ assets: [...pack().assets, raw("Complete Outdoor Kitchen Scene", { priority: "required" }), raw("Bar Stool"), raw("Giant Thing", { dimensions: { width: 40 } }), raw("Bad Category", { category: "spaceship" })] }, ctx);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.assets.map((a) => a.name)).not.toContain("Complete Outdoor Kitchen Scene");
    expect(ok.assets.map((a) => a.name)).not.toContain("Bar Stool");
    expect(ok.adjustments.join(" ")).toMatch(/whole scene/);
    expect(validatePlan({ assets: pack().assets.slice(0, 3) }, ctx)).toMatchObject({ ok: false });
    expect(validatePlan({ assets: pack().assets.map((a) => ({ ...a, priority: "optional" })) }, ctx)).toMatchObject({ ok: false, error: expect.stringMatching(/required/) });
    expect(validatePlan("nonsense", ctx)).toMatchObject({ ok: false });
  });

  it("plans for a Knowledge Need and keeps earlier plans' assets out of the next pack", async () => {
    const first = await planAssets({ knowledgeId: "outdoor-dining" }, async () => pack());
    if (!first.ok) throw new Error("expected ok");
    expect(first.draft.knowledgeId).toBe("outdoor-dining");
    await savePlan({ title: first.draft.title, knowledgeId: "outdoor-dining", status: "approved", assets: first.draft.assets as PlanInput["assets"] });
    const gen = vi.fn().mockResolvedValue(pack());
    const second = await planAssets({ knowledgeId: "outdoor-dining" }, gen);
    expect(gen.mock.calls[0][0].prompt).toContain("Already exists");
    expect(second).toMatchObject({ ok: false });
    expect(await planAssets({ needId: "nope" }, async () => pack())).toMatchObject({ ok: false, status: 404 });
  });

  it("builds provider-independent requests carrying the exact prompt per asset", () => {
    const asset = { ...raw("Bar Stool"), id: "a1" } as never;
    const req = buildPlannedAssetRequest({ id: "p1", needId: "n1" }, { ...(asset as object), style: [], contexts: [], tags: [], approved: true, generated: false, priority: "required", generationPrompt: "Exact prompt. Single freestanding object.", category: "furniture", estimatedReuse: 90, description: "d", material: "", name: "Bar Stool", id: "a1" });
    expect(req).toMatchObject({ planId: "p1", plannedAssetId: "a1", prompt: "Exact prompt. Single freestanding object.", category: "furniture" });
    expect(finalizeGenerationPrompt("A stool", { dimensions: { height: 0.75 } })).toMatch(/Real-world size about – × – × 0.75 m/);
  });
});

async function savedPlan(): Promise<AssetPlan> {
  await seedNeed();
  const res = await planAssets({ needId: need.id }, async () => pack());
  if (!res.ok) throw new Error("plan");
  const saved = await savePlan({ title: res.draft.title, needId: need.id, knowledgeId: res.draft.knowledgeId, status: "draft", assets: res.draft.assets as PlanInput["assets"] });
  if (!saved.ok) throw new Error(saved.error);
  return saved.value;
}

describe("plans in the library", () => {
  it("saves as a new plan, updates in place, preserves server-owned progress, and never duplicates", async () => {
    const plan = await savedPlan();
    const stool = plan.assets.find((a) => a.name === "Bar Stool")!;
    await completePlannedAsset(plan.id, stool.id, "asset-1");
    const edited = plan.assets.map((a) => ({ ...a, estimatedReuse: 50, approved: true, generated: false, assetId: undefined, spec: undefined }));
    const again = await savePlan({ id: plan.id, title: "Renamed pack", needId: need.id, status: "approved", assets: edited as PlanInput["assets"] });
    expect(again.ok && again.value.status).toBe("approved");
    const lib = await readLibrary();
    expect(lib.plans).toHaveLength(1);
    const kept = lib.plans[0].assets.find((a) => a.id === stool.id)!;
    expect(kept).toMatchObject({ estimatedReuse: 50, approved: true, generated: true, assetId: "asset-1" });
    expect(await savePlan({ id: "missing", title: "x y z", status: "draft", assets: edited as PlanInput["assets"] })).toMatchObject({ ok: false, status: 404 });
    expect(await savePlan({ title: "x y z", needId: "missing", status: "draft", assets: edited as PlanInput["assets"] })).toMatchObject({ ok: false, status: 404 });
    expect((await deletePlan(plan.id)).ok).toBe(true);
    expect((await readLibrary()).plans).toEqual([]);
  });

  it("ignores a client-sent spec or progress on create", async () => {
    const res = await planAssets({ needId: need.id }, async () => pack());
    if (!res.ok) return;
    await seedNeed();
    const forged = res.draft.assets.map((a) => ({ ...a, spec: SAMPLES.barStool, generated: true, assetId: "x" }));
    const saved = await savePlan({ title: "Pack title", needId: need.id, status: "draft", assets: forged as PlanInput["assets"] });
    expect(saved.ok && saved.value.assets.every((a) => !a.spec && !a.generated && !a.assetId)).toBe(true);
  });

  it("validates plan input", () => {
    expect(planInputSchema.safeParse({ title: "ab", status: "draft", assets: [] }).success).toBe(false);
  });

  it("counts planned, generated, approved and completion against the real library", async () => {
    const plan = await savedPlan();
    const [a, b] = plan.assets;
    await completePlannedAsset(plan.id, a.id, "lib-1");
    await completePlannedAsset(plan.id, b.id, "lib-2");
    const { plans } = await readLibrary();
    const approved = { id: "lib-1", status: "approved", scope: "global", type: "glb-model", validation: { passed: true } } as CuratedAsset;
    const failed = { id: "lib-2", status: "approved", scope: "global", type: "glb-model", validation: { passed: false } } as CuratedAsset;
    const stats = planStats(plans, [approved, failed]);
    expect(stats).toMatchObject({ planned: 7, generated: 2, approved: 1, missing: 6 });
    expect(stats.completion).toBeCloseTo(1 / 7);
    expect(planStats([], []).completion).toBe(0);
    expect(plansFor(plans, { needId: need.id })).toHaveLength(1);
    expect(plansFor(plans, { needId: "other" })).toHaveLength(0);
  });
});

describe("native generation for one planned asset", () => {
  const loose = (spec: typeof SAMPLES.barStool) => JSON.parse(JSON.stringify(spec));

  it("stores a validated spec on that asset only, and reports build stats", async () => {
    const plan = await savedPlan();
    const stool = plan.assets.find((a) => a.name === "Bar Stool")!;
    const gen = vi.fn().mockResolvedValue(loose(SAMPLES.barStool));
    const res = await generateNativeSpec(plan.id, stool.id, gen);
    expect(res).toMatchObject({ ok: true, kind: "spec", stats: { detail: "medium" } });
    expect(gen.mock.calls[0][0].prompt).toContain("Asset: Bar Stool");
    expect(gen.mock.calls[0][0].prompt).toContain(stool.generationPrompt);
    const after = (await readLibrary()).plans[0];
    expect(after.assets.find((a) => a.id === stool.id)!.spec?.family).toBe("bar-stool");
    expect(after.assets.filter((a) => a.spec)).toHaveLength(1);
  });

  it("refines using the current spec and changes only that asset", async () => {
    const plan = await savedPlan();
    const stool = plan.assets.find((a) => a.name === "Bar Stool")!;
    expect(await generateNativeSpec(plan.id, stool.id, async () => loose(SAMPLES.barStool), { instruction: "thicker legs" })).toMatchObject({ ok: false, status: 409 });
    await generateNativeSpec(plan.id, stool.id, async () => loose(SAMPLES.barStool));
    const thicker = loose(SAMPLES.barStool);
    thicker.parts[2].radius = 0.025;
    const gen = vi.fn().mockResolvedValue(thicker);
    const res = await generateNativeSpec(plan.id, stool.id, gen, { instruction: "make the legs thicker" });
    expect(res.ok).toBe(true);
    expect(gen.mock.calls[0][0].prompt).toContain("make the legs thicker");
    expect(gen.mock.calls[0][0].prompt).toContain('"radius":0.016');
    const stored = (await readLibrary()).plans[0].assets.find((a) => a.id === stool.id)!;
    expect(stored.spec?.parts[2]).toMatchObject({ radius: 0.025 });
    expect(buildNativePrompt(stored, "t")).toContain("Target size");
  });

  it("rejects invalid or unbuildable specs and keeps the previous draft", async () => {
    const plan = await savedPlan();
    const stool = plan.assets.find((a) => a.name === "Bar Stool")!;
    await generateNativeSpec(plan.id, stool.id, async () => loose(SAMPLES.barStool));
    const tooBig = { ...loose(SAMPLES.barStool), dimensions: { width: 0.44, depth: 0.44, height: 2.5 } };
    expect(await generateNativeSpec(plan.id, stool.id, async () => tooBig)).toMatchObject({ ok: false, status: 502 });
    expect(await generateNativeSpec(plan.id, stool.id, async () => ({ nonsense: true }))).toMatchObject({ ok: false, status: 502 });
    expect((await readLibrary()).plans[0].assets.find((a) => a.id === stool.id)!.spec?.family).toBe("bar-stool");
  });

  it("marks assets the model cannot build as external-generation-recommended without faking one", async () => {
    const plan = await savedPlan();
    const sculpture = plan.assets.find((a) => a.name === "Special Sculpture")!;
    const res = await generateNativeSpec(plan.id, sculpture.id, async () => ({ ...loose(SAMPLES.barStool), unsupported: { reason: "figurative carving" } }));
    expect(res).toMatchObject({ ok: true, kind: "external", reason: "figurative carving" });
    const stored = (await readLibrary()).plans[0].assets.find((a) => a.id === sculpture.id)!;
    expect(stored).toMatchObject({ route: "external-generation-recommended" });
    expect(stored.spec).toBeUndefined();
  });

  it("attempts a native draft for an externally recommended planned asset and keeps a valid approximation reviewable", async () => {
    const plan = await savedPlan();
    const sculpture = plan.assets.find((a) => a.name === "Special Sculpture")!;
    expect(sculpture.route).toBe("external-generation-recommended");
    const res = await generateNativeSpec(plan.id, sculpture.id, async () => loose(SAMPLES.barStool));
    expect(res).toMatchObject({ ok: true, kind: "spec" });
    const stored = (await readLibrary()).plans[0].assets.find((a) => a.id === sculpture.id)!;
    expect(stored).toMatchObject({ route: "native", spec: expect.objectContaining({ family: "bar-stool" }) });
  });

  it("does not regenerate an asset already in the library, and reject discards only the draft", async () => {
    const plan = await savedPlan();
    const stool = plan.assets.find((a) => a.name === "Bar Stool")!;
    await generateNativeSpec(plan.id, stool.id, async () => loose(SAMPLES.barStool));
    await discardNativeSpec(plan.id, stool.id);
    const kept = (await readLibrary()).plans[0].assets.find((a) => a.id === stool.id)!;
    expect(kept.spec).toBeUndefined();
    expect(kept.name).toBe("Bar Stool");
    await completePlannedAsset(plan.id, stool.id, "lib-9");
    expect(await generateNativeSpec(plan.id, stool.id, async () => loose(SAMPLES.barStool))).toMatchObject({ ok: false, status: 409 });
  });
});

describe("external provider fallback", () => {
  const fake = (submit: AssetGenerationProvider["submit"]): AssetGenerationProvider => ({ id: "fake", label: "Fake", isConfigured: () => true, configurationHint: "", submit, poll: async () => ({ state: "queued" }) });

  it("says so when no provider is configured", async () => {
    const plan = await savedPlan();
    expect(await generateExternal(plan.id, undefined, [])).toMatchObject({ ok: false, status: 409 });
  });

  it("submits only approved external-route assets, highest reuse first, with the exact prompt", async () => {
    const plan = await savedPlan();
    const approvedAll = plan.assets.map((a) => ({ ...a, approved: true }));
    await savePlan({ id: plan.id, title: plan.title, needId: need.id, status: "approved", assets: approvedAll as PlanInput["assets"] });
    const submit = vi.fn(async (r: Parameters<AssetGenerationProvider["submit"]>[0]) => ({ providerId: "fake", jobId: `job-${r.plannedAssetId}` }));
    const res = await generateExternal(plan.id, undefined, [fake(submit)]);
    expect(res.ok && res.value.submitted).toHaveLength(2);
    expect(submit.mock.calls.map((c) => c[0].description)).toEqual(["A Herb Garden.", "A Special Sculpture."]);
    expect(submit.mock.calls[0][0].prompt).toContain("Herb Garden");
    expect((await readLibrary()).plans[0].assets.filter((a) => a.job)).toHaveLength(2);
    // Already submitted: a second run sends nothing.
    const again = await generateExternal(plan.id, undefined, [fake(submit)]);
    expect(again.ok && again.value.submitted).toEqual([]);
  });
});
