import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import type { SitePlan } from "../sitePlanStage";

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

beforeEach(() => { generateText.mockReset(); vi.stubEnv("OPENAI_API_KEY", "test-key"); });

describe("site plan stage", () => {
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

  it("rejects a disconnected graph rather than allowing deterministic site rules to invent the missing links", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    const disconnected = { ...plan, paths: plan.paths.map((path) => ({ ...path, from: "arrival" as const, to: "parking" as const })) };
    generateText.mockResolvedValue({ output: disconnected, totalUsage: {} });
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/connect arrival/);
  });

  it("rejects semantic links whose endpoints do not physically reach the required site objects", async () => {
    const { runSitePlanStage } = await import("../sitePlanStage");
    const floating = { ...plan, paths: plan.paths.map((path, i) => i === 1 ? { ...path, x2: 80, z2: 80 } : path) };
    generateText.mockResolvedValue({ output: floating, totalUsage: {} });
    const result = await runSitePlanStage(context, createTimings(), 60_000, usage);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/endpoints/);
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
