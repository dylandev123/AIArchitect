import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_HOUSE_JSON } from "@/types/house";
import type { GenerationReport } from "@/types/library";
import { modelOutput, VILLA_BRIEF } from "@/lib/library/__tests__/villaFixture";
import { recipeInputSchema } from "@/lib/library/recipes";

/**
 * The real POST /api/ai/house handler, with only the model call stubbed: the same prompt building, spaces planning, recipe retrieval,
 * assembly, site planning, collision passes, library attach and learning loop that a live generation runs — at no cost.
 */

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (work: () => unknown) => void Promise.resolve(work()) }));

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "route-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  generateText.mockReset();
  generateText.mockResolvedValue({ output: modelOutput({ ops: [{ op: "addPool", value: { wall: "north", offset: 4, distance: 3, width: 10, depth: 5, waterDepth: 1.5 } }] }), totalUsage: {} });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const asset = (id: string, name: string, family: string, tags: string[]) => ({ id, name, family, tags, styleTags: ["tropical"], contextTags: [], dimensions: {} });

async function generate(libraryAssets: unknown[] = []) {
  const { POST } = await import("../route");
  const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify({ mode: "generate", projectId: "proj-1", prompt: VILLA_BRIEF, currentHouseJson: BLANK_HOUSE_JSON, libraryAssets }) }));
  return { res, body: (await res.json()) as { json: string; intelligence: GenerationReport; adjusted: string[] } };
}

describe("POST /api/ai/house (generate)", () => {
  it("runs the whole loop for one generation and returns the intelligence report", async () => {
    const { res, body } = await generate();
    expect(res.status).toBe(200);
    const report = body.intelligence;

    // Exterior: the pool the model hung on the arrival wall was set on the private side.
    expect(report.placement).toMatchObject({ arrivalSide: "north", viewSide: "south", issues: [] });
    expect(report.placement.pools.every((p) => p.side !== "arrival")).toBe(true);
    expect(report.placement.garages.every((g) => g.side === "arrival")).toBe(true);
    expect(body.adjusted.join(" ")).toMatch(/arrival side/);

    // Loop: spaces, knowledge, needs, plans — and the write.
    expect(report.steps.every((s) => s.ok)).toBe(true);
    expect(report.persistence).toMatchObject({ ok: true, backend: "local-json" });
    expect(report.spaces.filter((s) => s.realized).length).toBeGreaterThanOrEqual(7);
    expect(report.knowledgeGaps.length).toBeGreaterThan(5);
    expect(report.assetNeeds.length).toBeGreaterThan(3);
    expect(report.plansCreated.length).toBeGreaterThan(0);

    const { readLibrary } = await import("@/lib/library/store");
    const lib = await readLibrary();
    expect(lib.generations[0].id).toBe(report.id);
    expect(lib.needs.length).toBe(report.assetNeeds.length);
    expect(lib.plans.length).toBe(report.plansCreated.length);
  });

  it("puts the outdoor spaces and the approved recipes in the prompt, and reports them as retrieved and applied", async () => {
    const { saveRecipe } = await import("@/lib/library/service");
    const saved = await saveRecipe(
      recipeInputSchema.parse({ name: "Caribbean Dining Pavilion 01", category: "outdoor-living", styleTags: ["tropical", "modern"], compatibleScales: ["luxury"], relationships: [{ kind: "requires", target: "patio" }], guidance: ["Shade the table."], knowledgeIds: ["outdoor-dining"] }),
      undefined,
      { approve: true }
    );
    if (!saved.ok) throw new Error(saved.error);

    const { body } = await generate();
    const system = (generateText.mock.calls[0][0] as { system: string }).system;
    expect(system).toContain("OUTDOOR SPACES");
    expect(system).toMatch(/Outdoor Dining \(~/);
    expect(system).toContain("PROVEN DESIGN PATTERNS");
    expect(system).toMatch(/Caribbean Dining Pavilion 01 .*— for Outdoor Dining/);

    expect(body.intelligence.recipes).toEqual([expect.objectContaining({ name: "Caribbean Dining Pavilion 01", spaces: ["Outdoor Dining"], applied: true })]);
    expect(body.intelligence.spaces.find((s) => s.name === "Outdoor Dining")).toBeDefined();
  });

  it("retrieves the approved assets sent with the request and stops asking for what they supply", async () => {
    const first = await generate();
    const library = [asset("t1", "Tropical Teak Dining Table", "furniture", ["dining", "table"]), asset("g1", "Teak Pergola", "pergola", ["pergola"])];
    const second = await generate(library);
    expect(second.body.intelligence.assets.map((a) => a.name)).toEqual(expect.arrayContaining(["Tropical Teak Dining Table", "Teak Pergola"]));
    const dining = second.body.intelligence.spaces.find((s) => s.name === "Outdoor Dining")!;
    expect(dining.supplied).toEqual(expect.arrayContaining(["dining-table", "pergola"]));
    expect(second.body.intelligence.assetNeeds.some((n) => n.name.endsWith("Pergola"))).toBe(false);
    expect(first.body.intelligence.assetNeeds.some((n) => n.name.endsWith("Pergola"))).toBe(true);
    // A second generation adds demand to the same records; it does not duplicate the plans.
    expect(second.body.intelligence.plansCreated).toEqual([]);
  });

  it("survives a restart: the next process reads back what the last one wrote", async () => {
    const { body } = await generate();
    vi.resetModules();
    const restarted = await import("@/lib/library/store");
    const lib = await restarted.readLibrary();
    expect(lib.generations.map((g) => g.id)).toEqual([body.intelligence.id]);
    expect(lib.knowledge.length).toBe(body.intelligence.knowledgeGaps.length);
    expect(lib.plans.length).toBe(body.intelligence.plansCreated.length);
  });

  it("still returns the design, with the failure in the report, when the library cannot be written", async () => {
    const { writeFile } = await import("node:fs/promises");
    const blocker = path.join(dir, "file");
    await writeFile(blocker, "x");
    vi.stubEnv("AI_LIBRARY_PATH", path.join(blocker, "sub", "library.json"));
    const { res, body } = await generate();
    expect(res.status).toBe(200);
    expect(body.json).toBeTruthy();
    expect(body.intelligence.persistence.ok).toBe(false);
    expect(body.intelligence.persistence.error).toBeTruthy();
  });
});
