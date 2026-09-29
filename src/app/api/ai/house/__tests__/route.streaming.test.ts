import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { validateArchitecturalDesignDocument } from "@/lib/architecture/document";
import { compileArchitecture } from "@/lib/architecture/compiler";
import { modelOutput, VILLA_BRIEF } from "@/lib/library/__tests__/villaFixture";

/** Same real-handler-with-stubbed-model-call pattern as route.test.ts, exercising the streaming delivery mode instead. */

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (work: () => unknown) => void Promise.resolve(work()) }));

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "route-stream-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  generateText.mockReset();
  generateText
    // foundation: intent + site strategy + primary mass in one call
    .mockResolvedValueOnce({ output: {
      intent: { mood: ["drama"], spatialGoals: ["views"], environmentalGoals: ["shelter"], hierarchyGoals: ["dominant living pavilion"], compositionBias: "asymmetrical", style: "modern tropical" },
      siteStrategy: { environment: "beach", viewDirection: "south", arrivalDirection: "north", terrain: "level", terrainResponse: "Keep the composition level and open to the beach." },
      primaryMass: { name: "Main Living Pavilion", width: 18, depth: 10, floors: 1, reasoning: "Anchors the composition toward the beach view." },
    }, totalUsage: {} })
    // mass expansion: done immediately, one mass total
    .mockResolvedValueOnce({ output: { decision: "done", reasoning: "One dominant pavilion fully serves this brief." }, totalUsage: {} })
    // architectural geometry pass: one batched call for the one mass
    .mockResolvedValueOnce({ output: { results: [{ massId: "mass-0", operations: [] }] }, totalUsage: {} })
    // roof composition: one call for the one mass
    .mockResolvedValueOnce({ output: { roofs: [{ massId: "mass-0", kind: "floating-flat", overhang: 1.2, reasoning: "A floating plane suits the dominant beachfront volume." }] }, totalUsage: {} })
    // the legacy single-call generation
    .mockResolvedValue({ output: modelOutput({ ops: [{ op: "addPool", value: { wall: "north", offset: 4, distance: 3, width: 10, depth: 5, waterDepth: 1.5 } }] }), totalUsage: {} });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function readSseFrames(res: Response): Promise<{ event: string; data: unknown }[]> {
  const text = await res.text();
  const frames: { event: string; data: unknown }[] = [];
  for (const block of text.split("\n\n").filter(Boolean)) {
    const eventLine = block.split("\n").find((l) => l.startsWith("event: "));
    const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
    if (!eventLine || !dataLine) continue;
    frames.push({ event: eventLine.slice("event: ".length), data: JSON.parse(dataLine.slice("data: ".length)) });
  }
  return frames;
}

describe("POST /api/ai/house (generate, streaming)", () => {
  it("emits one stage frame per architecture stage and a final done frame matching the non-streaming response shape", async () => {
    const { POST } = await import("../route");
    const res = await POST(new NextRequest("http://localhost/api/ai/house", {
      method: "POST",
      headers: { Accept: "text/event-stream" },
      body: JSON.stringify({ mode: "generate", projectId: "proj-stream-1", prompt: VILLA_BRIEF, currentHouseJson: BLANK_HOUSE_JSON, libraryAssets: [] }),
    }));

    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const frames = await readSseFrames(res);
    const stageFrames = frames.filter((f) => f.event === "stage");
    const doneFrames = frames.filter((f) => f.event === "done");

    // Every stage in order, each carrying a document that is valid and independently compilable — not a diff.
    const eventTypes = stageFrames.map((f) => (f.data as { type: string }).type);
    expect(eventTypes).toEqual(["stage", "stage", "stage", "stage", "stage", "roof-added", "stage"]);
    for (const frame of stageFrames) {
      const document = (frame.data as { document: unknown }).document as Parameters<typeof validateArchitecturalDesignDocument>[0];
      expect(validateArchitecturalDesignDocument(document)).toEqual([]);
      expect(() => compileArchitecture(document, { materials: { exterior: { material: "stucco", color: "#fff" }, roof: { material: "concrete", color: "#333" }, trim: { material: "metal", color: "#111" }, decking: { material: "wood", color: "#654" } } })).not.toThrow();
    }

    expect(doneFrames).toHaveLength(1);
    const done = doneFrames[0].data as { json: string; summary: string; intelligence: unknown };
    expect(typeof done.json).toBe("string");
    expect(typeof done.summary).toBe("string");
    expect(done.intelligence).toBeDefined();
  });
});
