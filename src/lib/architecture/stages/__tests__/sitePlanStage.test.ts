import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoObjectGeneratedError, TypeValidationError } from "ai";
import { createTimings } from "@/lib/ai/timing";
import type { SitePlan } from "../sitePlanStage";
import { assembleGeneratedProject } from "@/lib/ai/generation";
import { z } from "zod";
import liveFirstAttempt from "../../__tests__/fixtures/liveSitePlanFirstAttempt.json";

const generateText = vi.fn();
vi.mock("ai", async (original) => ({ ...(await original<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));

const context = { brief: "A tropical luxury house", house: { width: 18, depth: 12, floors: 2 }, viewDirection: "south" as const, arrivalDirection: "north" as const };
const usage = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test-model" };
const plan = {
  entrance: { wall: "north", offset: 8 }, driveway: { wall: "north", offset: 5, width: 4, length: 22 }, parking: [{ x: 0, z: -17, width: 8, depth: 10 }],
  pool: { wall: "south", offset: 3, distance: 7, width: 12, depth: 5, waterDepth: 1.5, shape: "rounded" }, terrace: { wall: "south", offset: 2, width: 14, depth: 4 }, poolDeck: { x: 0, z: 14, width: 12, depth: 4 },
  paths: [
    { from: "arrival", to: "parking", x1: 0, z1: -30, x2: 0, z2: -17, width: 1.5, bend: 0, surface: "flagstone" },
    { from: "parking", to: "entrance", x1: 0, z1: -17, x2: 0, z2: -7, width: 1.5, bend: 0, surface: "flagstone" },
    { from: "entrance", to: "outdoor-living", x1: 0, z1: -7, x2: 0, z2: 7, width: 1.5, bend: 1, surface: "flagstone" },
    { from: "outdoor-living", to: "pool", x1: 0, z1: 7, x2: 0, z2: 13, width: 1.5, bend: 0, surface: "flagstone" },
  ],
  landscape: [{ purpose: "entrance-planting", kind: "garden", x: -8, z: -10, width: 5, depth: 4 }, { purpose: "view-framing", kind: "garden", x: 10, z: 15, width: 6, depth: 5 }],
};

/** What `generateText` + `Output.object` actually throws for a schema-invalid response: the raw value rides on the cause. */
async function sdkSchemaRejection(raw: unknown) {
  const { sitePlanSchema } = await import("../sitePlanStage");
  const parsed = sitePlanSchema.safeParse(raw);
  if (parsed.success) throw new Error("fixture must fail the strict schema");
  return new NoObjectGeneratedError({
    message: "No object generated: response did not match schema.", cause: new TypeValidationError({ value: raw, cause: parsed.error }), text: JSON.stringify(raw),
    response: { id: "x", timestamp: new Date(), modelId: "test" },
    usage: { inputTokens: 0, inputTokenDetails: {}, outputTokens: 0, outputTokenDetails: {}, totalTokens: 0 } as ConstructorParameters<typeof NoObjectGeneratedError>[0]["usage"],
    finishReason: "stop",
  });
}

beforeEach(() => { generateText.mockReset(); vi.stubEnv("OPENAI_API_KEY", "test-key"); });

describe("site plan stage", () => {
  it("requires a proportional pool, deck, terrace and planting composition only for luxury indoor-outdoor briefs", async () => {
    const { luxuryOutdoorCompositionErrors } = await import("../sitePlanStage");
    const luxuryContext = { ...context, brief: "A luxury tropical villa with strong indoor-outdoor living and ocean-facing terraces" };
    const substantial: SitePlan = { ...(plan as SitePlan), landscape: [...(plan as SitePlan).landscape, { purpose: "pool-planting", kind: "garden", x: -9, z: 15, width: 5, depth: 4 }] };
    expect(luxuryOutdoorCompositionErrors(substantial, luxuryContext)).toEqual([]);
    const undersized: SitePlan = { ...substantial, pool: { ...substantial.pool, width: 4, depth: 3 }, poolDeck: { ...substantial.poolDeck, width: 3, depth: 2 } };
    expect(luxuryOutdoorCompositionErrors(undersized, luxuryContext).join(" ")).toMatch(/substantial pool|Pool deck/);
    // A non-luxury brief preserves the same authored geometry; this rule never redesigns it.
    expect(luxuryOutdoorCompositionErrors(undersized, context)).toEqual([]);
  });

  it("accepts an AI-authored connected site graph and emits its exact site operations", async () => {
    const { runSitePlanStage, sitePlanOperations } = await import("../sitePlanStage");
    generateText.mockResolvedValueOnce({ output: plan, totalUsage: {} });
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ops = sitePlanOperations(result.value);
    expect(ops.find((op) => op.op === "addPool")?.value).toMatchObject(plan.pool);
    expect(ops.filter((op) => op.op === "addPath")).toHaveLength(4);
    expect(ops.filter((op) => op.op === "addParking")).toHaveLength(1);
  });

  it("salvages the live schema-only bounds failures without relaxing graph validation", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    const overlongLandscape = Array.from({ length: 10 }, (_, index) => ({ purpose: index === 9 ? "view-framing" : index === 8 ? "privacy" : index % 2 ? "pool-planting" : "entrance-planting", kind: "garden", x: index, z: 20 + index, width: 3, depth: 3 }));
    const recoverable = { ...plan, entrance: { ...plan.entrance, offset: 0 }, paths: plan.paths.map((path, index) => index === 0 ? { ...path, width: 5.5 } : index === 1 ? { ...path, x2: -9, z2: -6 } : index === 2 ? { ...path, x1: -9, z1: -6 } : path), landscape: overlongLandscape };
    generateText.mockResolvedValueOnce({ output: recoverable, totalUsage: {} });
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entrance.offset).toBe(0);
    expect(result.value.paths[0].width).toBe(4);
    expect(result.value.landscape).toHaveLength(8);
    expect(result.value.landscape.some((zone) => zone.purpose === "entrance-planting")).toBe(true);
    expect(result.value.landscape.some((zone) => zone.purpose === "pool-planting")).toBe(true);
  });

  it("sends negative entrance.offset AND driveway.offset to the Site Planner repair, then keeps its repaired offsets exactly", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    // Live pattern: both offsets slightly negative. They are the model's intent gone wrong, not rounding: no local rule
    // picks a replacement position, the repair is told exactly what is out of range and authors the fix itself.
    const live = { ...plan, entrance: { ...plan.entrance, offset: -1.5 }, driveway: { ...plan.driveway, offset: -2 } };
    generateText.mockRejectedValueOnce(await sdkSchemaRejection(live)).mockResolvedValueOnce({ output: plan, totalUsage: {} }).mockRejectedValue(new Error("only one repair is allowed"));
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok, result.ok ? "" : result.errors.join("\n")).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2);
    const repair = generateText.mock.calls[1][0].messages[0].content as string;
    expect(repair).toMatch(/Correct: entrance\.offset = -1\.5: Too small: expected number to be >=0\. /);
    expect(repair).toMatch(/driveway\.offset = -2: Too small: expected number to be >=0\. /);
    if (!result.ok) return;
    expect(result.value.entrance.offset).toBe(plan.entrance.offset);
    expect(result.value.driveway.offset).toBe(plan.driveway.offset);
  });

  it("leaves every negative wall offset invalid after normalization, with no replacement position chosen", async () => {
    const { normalizeSitePlan, sitePlanSchema } = await import("../sitePlanStage");
    const raw = { ...plan, entrance: { ...plan.entrance, offset: -3 }, driveway: { ...plan.driveway, offset: -4, bend: 25 }, pool: { ...plan.pool, offset: -0.5 }, terrace: { ...plan.terrace, offset: -1 } };
    const normalized = normalizeSitePlan(raw) as typeof raw;
    expect([normalized.entrance.offset, normalized.driveway.offset, normalized.pool.offset, normalized.terrace.offset]).toEqual([-3, -4, -0.5, -1]);
    expect(normalized.driveway.bend).toBe(20); // the rest of normalization is unchanged
    const parsed = sitePlanSchema.safeParse(normalized);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.map((issue) => issue.path.join("."))).toEqual(["entrance.offset", "driveway.offset", "pool.offset", "terrace.offset"]);
    // Valid offsets, including the 0 and 80 bounds, pass through untouched.
    const valid = { ...plan, entrance: { ...plan.entrance, offset: 0 }, driveway: { ...plan.driveway, offset: 80 }, pool: { ...plan.pool, offset: 3.25 } };
    const kept = normalizeSitePlan(valid) as typeof valid;
    expect([kept.entrance.offset, kept.driveway.offset, kept.pool.offset, kept.terrace.offset]).toEqual([0, 80, 3.25, plan.terrace.offset]);
  });

  it("keeps structural errors strict: a disconnected plan with negative offsets is neither moved nor accepted", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    const broken = { ...plan, entrance: { ...plan.entrance, offset: -1 }, driveway: { ...plan.driveway, offset: -1 }, paths: plan.paths.map((path) => ({ ...path, from: "arrival" as const, to: "parking" as const })) };
    const rejection = await sdkSchemaRejection(broken);
    generateText.mockRejectedValue(rejection);
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(false);
    expect(generateText).toHaveBeenCalledTimes(2);
    const retryPrompt = generateText.mock.calls[1][0].messages[0].content as string;
    expect(retryPrompt).toMatch(/Correct: entrance\.offset = -1: .*driveway\.offset = -1: /);
  });

  it("integrates an accepted Site Plan into Final Assembly input without a second model call", async () => {
    const { runSitePlanStage, sitePlanOperations } = await import("../sitePlanStage");
    generateText.mockResolvedValueOnce({ output: plan, totalUsage: {} });
    const staged = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    const assembled = assembleGeneratedProject({ summary: "V2 site integration", house: { width: 18, depth: 12, floors: 2, roof: "flat" }, site: { environment: "suburban", viewDirection: "south", terrainSlope: "flat", approachSide: "north" }, operations: [] } as never, [], "", true, createTimings(), sitePlanOperations(staged.value));
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;
    const persisted = JSON.parse(assembled.json);
    expect(persisted.pools).toHaveLength(1);
    expect(persisted.paths).toHaveLength(4);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("rejects a disconnected graph rather than allowing deterministic site rules to invent the missing links", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    const disconnected = { ...plan, paths: plan.paths.map((path) => ({ ...path, from: "arrival" as const, to: "parking" as const })) };
    generateText.mockResolvedValue({ output: disconnected, totalUsage: {} });
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/connect arrival/);
  });

  it("snaps semantically valid links to their authored site geometry without a retry", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    const floating = { ...plan, paths: plan.paths.map((path, i) => i === 1 ? { ...path, x2: 80, z2: 80 } : path) };
    generateText.mockResolvedValueOnce({ output: floating, totalUsage: {} }).mockRejectedValue(new Error("a retry must not happen"));
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(1);
    if (!result.ok) return;
    expect(result.value.paths[1]).toMatchObject({ x1: 0, z1: -17, x2: -1, z2: -6 });
  });

  it("uses a supplied V2 door, rather than legacy wall metadata, as the physical entrance endpoint", async () => {
    const { geometricGraphErrors } = await import("../sitePlanStage");
    const atDoor = structuredClone(plan) as SitePlan;
    atDoor.paths[1].x2 = 4;
    atDoor.paths[1].z2 = -6;
    atDoor.paths[2].x1 = 4;
    atDoor.paths[2].z1 = -6;
    expect(geometricGraphErrors(atDoor, { ...context, entrancePoints: [{ x: 4, z: -6 }] })).toEqual([]);
  });
});

/**
 * The live Site Plan first attempt (ai_usage output_fingerprint 7e79d55078e15604, byte-exact fixture). Its house is
 * not persisted; 18×11 centred at (−1.5, 0) is the frame its own paths imply (north face z = −5.5, terrace edge
 * z = 9.5, entrance at x = −1.5), used only to make the corrected plan's geometry concrete.
 */
const liveContext = {
  brief: "A luxury tropical villa with strong indoor-outdoor living, a pool deck and an outdoor bar",
  house: { width: 18, depth: 11, floors: 2, center: { x: -1.5, z: 0 } }, viewDirection: "south" as const, arrivalDirection: "north" as const,
};

/** The live design expressed in the contract: offsets from the west corner (x = −10.5), ≥ 2 m planting, a 4 × 3 m bar footprint. */
function liveAuthoredToContract() {
  const authored = structuredClone(liveFirstAttempt) as typeof liveFirstAttempt;
  authored.driveway.offset = 2.5; // centre x = −10.5 + 2.5 + 4/2 = −6, where the live arrival path starts
  authored.pool.offset = 3; // centre x = −10.5 + 3 + 11/2 = −2, under the live pool deck and pool path
  authored.terrace.offset = 2.5; // centre x = −2
  authored.entrance.offset = 9; // x = −1.5, where the live entrance path ends
  for (const zone of authored.landscape) { zone.width = Math.max(zone.width, 2); zone.depth = Math.max(zone.depth, 2); }
  authored.features[0] = { ...authored.features[0], width: 4, depth: 3 };
  return authored;
}

describe("site plan executable contract", () => {
  it("reproduces exactly the live first-attempt schema failures from the persisted output", async () => {
    const { sitePlanSchema } = await import("../sitePlanStage");
    const parsed = sitePlanSchema.safeParse(liveFirstAttempt);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)).toEqual([
      "driveway.offset: Too small: expected number to be >=0",
      "pool.offset: Too small: expected number to be >=0",
      "terrace.offset: Too small: expected number to be >=0",
      "landscape.1.width: Too small: expected number to be >=2",
      "landscape.2.depth: Too small: expected number to be >=2",
      "landscape.3.width: Too small: expected number to be >=2",
      "landscape.4.width: Too small: expected number to be >=2",
      "features.0.depth: Too small: expected number to be >=2",
    ]);
  });

  it("rejects each exact failed value with the field, the value received, its rule and what it measures", async () => {
    const { sitePlanSchemaErrors } = await import("@/lib/architecture/sitePlanContract");
    const errors = sitePlanSchemaErrors(liveFirstAttempt);
    expect(errors).toHaveLength(8);
    const at = (field: string) => errors.find((error) => error.startsWith(`${field} = `)) ?? "";
    expect(at("driveway.offset")).toMatch(/^driveway\.offset = -4\.5: Too small: expected number to be >=0\. .*ALONG the wall from its start corner.*never from the wall's centre.*Never negative.*Allowed 0 to 80\.$/);
    expect(at("pool.offset")).toMatch(/^pool\.offset = -0\.5: .*\(L − w\) \/ 2.*Allowed 0 to 80\.$/);
    expect(at("terrace.offset")).toMatch(/^terrace\.offset = -0\.5: .*start corner/);
    expect(at("landscape.1.width")).toMatch(/^landscape\.1\.width = 1\.8: .*at least 2 m.*Allowed 2 to 40\.$/);
    expect(at("landscape.2.depth")).toMatch(/^landscape\.2\.depth = 1\.3: .*Allowed 2 to 40\.$/);
    expect(at("landscape.3.width")).toMatch(/= 1\.5: /);
    expect(at("landscape.4.width")).toMatch(/= 1\.5: /);
    expect(at("features.0.depth")).toMatch(/^features\.0\.depth = 0\.85: .*counter alone.*too shallow.*Allowed 2 to 8\.$/);
  });

  it("sends the persisted live driveway.offset = -4.5 to Site Planner repair instead of moving it to 0, and keeps the repaired offset exactly", async () => {
    const { runSitePlanStage, normalizeSitePlan } = await import("../sitePlanStage");
    const { sitePlanSchemaErrors } = await import("@/lib/architecture/sitePlanContract");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no live AI calls"));

    // 1. Normalization leaves the authored -4.5 (and the -0.5 pool/terrace offsets) exactly as the model wrote them.
    const normalized = normalizeSitePlan(liveFirstAttempt, liveContext) as typeof liveFirstAttempt;
    expect(normalized.driveway.offset).toBe(-4.5);
    expect([normalized.pool.offset, normalized.terrace.offset]).toEqual([-0.5, -0.5]);

    // 2. It is diagnosed with the actionable offset message; near-bound landscape sizes are still settled locally.
    const diagnostics = sitePlanSchemaErrors(normalizeSitePlan(liveFirstAttempt));
    expect(diagnostics.map((error) => error.slice(0, error.indexOf(" = ")))).toEqual(["driveway.offset", "pool.offset", "terrace.offset", "features.0.depth"]);
    expect(diagnostics[0]).toMatch(/^driveway\.offset = -4\.5: Too small: expected number to be >=0\. .*ALONG the wall from its start corner.*Never negative.*Allowed 0 to 80\.$/);

    // 3. The live rejection triggers the bounded repair carrying that diagnostic.
    const repaired = liveAuthoredToContract();
    generateText.mockRejectedValueOnce(await sdkSchemaRejection(liveFirstAttempt)).mockResolvedValueOnce({ output: repaired, totalUsage: {} }).mockRejectedValue(new Error("only one repair is allowed"));
    const result = await runSitePlanStage(liveContext, createTimings(), 60_000, usage);
    expect(generateText).toHaveBeenCalledTimes(2);
    const repair = generateText.mock.calls[1][0].messages[0].content as string;
    expect(repair).toContain(`Correct: ${diagnostics.join("; ")}`);
    expect(repair).not.toMatch(/landscape\.\d/);

    // 4. The model's repaired offset is the one used — exactly, not the 0 a clamp would have chosen.
    expect(result.ok, result.ok ? "" : result.errors.join("\n")).toBe(true);
    if (!result.ok) return;
    expect(result.value.driveway.offset).toBe(2.5);
    expect([result.value.pool.offset, result.value.terrace.offset, result.value.entrance.offset]).toEqual([3, 2.5, 9]);

    // 5. Both model calls were the mock; nothing reached the network.
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("accepts a representative plan authored to the contract on its FIRST attempt, unchanged by normalization", async () => {
    const { runSitePlanStage, sitePlanSchema, normalizeSitePlan } = await import("../sitePlanStage");
    const authored = liveAuthoredToContract();
    expect(sitePlanSchema.safeParse(authored).success).toBe(true);
    expect(normalizeSitePlan(authored)).toEqual(authored); // no numeric field needed normalizing

    generateText.mockResolvedValueOnce({ output: authored, totalUsage: {} }).mockRejectedValue(new Error("a retry must not happen"));
    const result = await runSitePlanStage(liveContext, createTimings(), 60_000, usage);
    expect(result.ok, result.ok ? "" : result.errors.join("\n")).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(1);
    if (!result.ok) return;
    expect(result.value.driveway.offset).toBe(2.5);
    expect(result.value.features?.[0]).toMatchObject({ width: 4, depth: 3 });
  });

  it("tells the model the offset frame, this house's wall frame and every enforced numeric range", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    generateText.mockResolvedValueOnce({ output: plan, totalUsage: {} }).mockRejectedValue(new Error("only the first prompt is inspected"));
    await runSitePlanStage(liveContext, createTimings(), 60_000, usage);
    const { system, messages } = generateText.mock.calls[0][0] as { system: string; messages: { content: string }[] };
    expect(system).toMatch(/offset` is measured ALONG the named wall from its start corner/);
    expect(system).toMatch(/NOT measured from the wall's centre\. offset 0 = flush with the start corner; it is never negative/);
    expect(system).toContain("  - driveway: offset 0 to 80, width 2.5 to 8, length 6 to 60, bend -20 to 20");
    expect(system).toContain("  - pool: offset 0 to 80, distance 1 to 40, width 3 to 30, depth 2 to 20, waterDepth 0.8 to 3");
    expect(system).toContain("  - terrace: offset 0 to 80, width 3 to 40, depth 2 to 20");
    expect(system).toContain("  - parking (1 to 3 items): x -100 to 100, z -100 to 100, width 2.5 to 40, depth 4.5 to 40");
    expect(system).toContain("  - landscape (2 to 8 items): x -100 to 100, z -100 to 100, width 2 to 40, depth 2 to 40");
    expect(system).toContain("  - features (0 to 30 items): x -100 to 100, z -100 to 100, width 2 to 12, depth 2 to 8, rotation -360 to 360");
    expect(system).toMatch(/at least 10% of the house footprint.*at least 70% of the pool area/);
    expect(messages[0].content).toContain("Wall frame: north/south walls are 18m long, offset 0 at x = -10.50 (west corner), increasing east; east/west walls are 11m long, offset 0 at z = -5.50 (north corner), increasing south.");
  });

  it("explains every enforced numeric bound in the structured-output schema the model receives", async () => {
    const { sitePlanSchema } = await import("../sitePlanStage");
    type Node = { type?: string; properties?: Record<string, Node>; items?: Node; minimum?: number; maximum?: number; description?: string };
    const unexplained: string[] = [];
    const walk = (node: Node, at: string) => {
      if (node.type === "number" && !node.description?.includes(`Allowed ${node.minimum} to ${node.maximum}.`)) unexplained.push(at);
      for (const [key, child] of Object.entries(node.properties ?? {})) walk(child, `${at}.${key}`);
      if (node.items) walk(node.items, `${at}[]`);
    };
    walk(z.toJSONSchema(sitePlanSchema, { io: "input" }) as Node, "plan");
    expect(unexplained).toEqual([]);
  });
});
