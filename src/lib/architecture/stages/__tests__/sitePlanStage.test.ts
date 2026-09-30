import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoObjectGeneratedError, TypeValidationError } from "ai";
import { createTimings } from "@/lib/ai/timing";
import type { SitePlan } from "../sitePlanStage";
import { assembleGeneratedProject } from "@/lib/ai/generation";

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
    const recoverable = { ...plan, entrance: { ...plan.entrance, offset: -2 }, paths: plan.paths.map((path, index) => index === 0 ? { ...path, width: 5.5 } : index === 1 ? { ...path, x2: -9, z2: -6 } : index === 2 ? { ...path, x1: -9, z1: -6 } : path), landscape: overlongLandscape };
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

  it("rescues the live failure (negative entrance.offset AND driveway.offset) in ONE model call via the SDK rejection path", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    // Live pattern: both offsets slightly negative. Clamping only the entrance left driveway.offset invalid, so the
    // whole normalized plan failed the strict schema, the fix was discarded, and the stage burned a second call.
    // Its paths meet the geometry it authored: arrival at x = -9 + (-2) + 4/2 = -9, entrance at x = -9 - 1.5 = -10.5 on the
    // north face (z = -6). Clamping moves those nodes ≤ 2m, inside the construction tolerance, so the graph stays connected.
    const live = {
      ...plan, entrance: { ...plan.entrance, offset: -1.5 }, driveway: { ...plan.driveway, offset: -2 },
      paths: plan.paths.map((path, i) => i === 0 ? { ...path, x1: -9, z1: -28 } : i === 1 ? { ...path, x2: -10.5, z2: -6 } : i === 2 ? { ...path, x1: -10.5, z1: -6 } : path),
    };
    generateText.mockRejectedValueOnce(await sdkSchemaRejection(live)).mockRejectedValue(new Error("a second model call must not happen"));
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(result.attempts).toBe(1);
    if (!result.ok) return;
    expect(result.value.entrance.offset).toBe(0);
    expect(result.value.driveway.offset).toBe(0);
  });

  it("clamps every negative wall/linear offset to 0 before strict validation", async () => {
    const { normalizeSitePlan, sitePlanSchema } = await import("../sitePlanStage");
    const raw = { ...plan, entrance: { ...plan.entrance, offset: -3 }, driveway: { ...plan.driveway, offset: -4, bend: 25 }, pool: { ...plan.pool, offset: -0.5 }, terrace: { ...plan.terrace, offset: -1 } };
    const parsed = sitePlanSchema.safeParse(normalizeSitePlan(raw));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect([parsed.data.entrance.offset, parsed.data.driveway.offset, parsed.data.pool.offset, parsed.data.terrace.offset]).toEqual([0, 0, 0, 0]);
    expect(parsed.data.driveway.bend).toBe(20);
    expect(parsed.data.pool.wall).toBe("south"); // walls untouched
  });

  it("keeps structural errors strict: a disconnected plan with negative offsets retries with the graph error, not the fixed range error", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    const broken = { ...plan, entrance: { ...plan.entrance, offset: -1 }, driveway: { ...plan.driveway, offset: -1 }, paths: plan.paths.map((path) => ({ ...path, from: "arrival" as const, to: "parking" as const })) };
    const rejection = await sdkSchemaRejection(broken);
    generateText.mockRejectedValue(rejection);
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(false);
    expect(generateText).toHaveBeenCalledTimes(2);
    const retryPrompt = generateText.mock.calls[1][0].messages[0].content as string;
    expect(retryPrompt).toMatch(/connect arrival/);
    expect(retryPrompt).not.toMatch(/offset/);
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
