import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { modelOutput, VILLA_BRIEF } from "@/lib/library/__tests__/villaFixture";
import { stageOf, v2StageResponder } from "@/lib/architecture/__tests__/v2StageResponder";
import type { ArchitecturalDesignDocument } from "@/lib/architecture/document";
import type { SceneEditPlan } from "@/lib/architecture/sceneOperations";

/**
 * Broad, multi-goal Architect edits through the real route with every model call mocked (no live AI, no network).
 * Reproduces the live failure shape: a whole-property request answered by one portico delete must not be reported
 * as a finished edit.
 */
const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: async (_meta: unknown, run: () => Promise<unknown>) => run() }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: (work: () => unknown) => void Promise.resolve(work()) }));
vi.mock("@/lib/assets/serverStore", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/assets/serverStore")>()), assetBackend: () => ({ list: async () => ({ assets: [], glbIds: [] }) }) }));
const network = vi.fn(() => { throw new Error("unexpected network call"); });

type Project = Record<string, unknown> & { architecturalDesignDocument: ArchitecturalDesignDocument };
type Body = Record<string, unknown> & { json?: string; summary?: string; code?: string; completion?: string; goalSummary?: Record<string, unknown>; circulation?: { limitations: string[] }; repairRequests?: string[]; attempts?: number };

beforeEach(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "route-goal-coverage-"));
  vi.stubEnv("AI_LIBRARY_PATH", path.join(dir, "library.json"));
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("POSTGRES_URL", "");
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubGlobal("fetch", network);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  generateText.mockReset();
  network.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function post(body: Record<string, unknown>) {
  const { POST } = await import("../route");
  const res = await POST(new NextRequest("http://localhost/api/ai/house", { method: "POST", body: JSON.stringify(body) }));
  return { res, body: (await res.json()) as Body };
}
const edit = (prompt: string, currentHouseJson: string) => post({ mode: "edit", projectId: "proj-goals", prompt, currentHouseJson });
const architectCalls = () => generateText.mock.calls.map((call) => call[0] as { system: string; messages: { content: string }[] }).filter((call) => stageOf(call.system) === "architect");
const answerPlans = (...plans: SceneEditPlan[]) => {
  let turn = 0;
  generateText.mockImplementation(() => Promise.resolve({ output: plans[Math.min(turn++, plans.length - 1)], totalUsage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 } }));
};

/** A saved two-storey villa with an existing entry portico assembly and an upper door onto the south facade. */
let saved: string | undefined;
async function villa(): Promise<string> {
  if (saved) return saved;
  generateText.mockImplementation(v2StageResponder(() => modelOutput({ ops: [{ op: "addPool", value: { wall: "north", offset: 4, distance: 3, width: 10, depth: 5, waterDepth: 1.5 } }] })));
  const generated = await post({ mode: "generate", projectId: "proj-goals", prompt: VILLA_BRIEF, currentHouseJson: BLANK_HOUSE_JSON });
  expect(generated.res.status).toBe(200);
  generateText.mockReset();
  const project = JSON.parse(generated.body.json!) as Project;
  const main = project.architecturalDesignDocument.massing.masses[0];
  main.floors = 2;
  main.height = 6.8;
  main.openings = [...(main.openings ?? []), { id: "mass-0:upper-south-door", type: "door", facade: "south", start: .3, end: .4, floors: "upper" }];
  main.assemblies = [...(main.assemblies ?? []), { id: "main-entry-portico-addition", intent: "entry portico", parts: [{ id: "post-a", type: "post", facade: "north", at: .45, depth: 1.4, height: 2.8, host: { kind: "floor", level: 0 } }] }];
  saved = JSON.stringify(project);

  return saved;
}

const VILLA_REQUEST = `Revise the whole villa as one coordinated architectural revision:
- complete the missing balconies and terraces on the upper floor
- make the rooftop usable as outdoor living space
- improve the patio and pool outdoor living
- improve the facade depth and landscaping
- create believable circulation between floors with stairs
- add internal doors so every room is reachable
Return Capability Needs for any geometry the engine cannot build.`;

const PORTICO_DELETE: SceneEditPlan = { intent: "Simplify the entry.", operations: [{ op: "delete", target: "assembly:mass-0:main-entry-portico-addition" }] };
const upperDeck = (railing: boolean): SceneEditPlan["operations"][number] => ({
  op: "create", object: { kind: "assembly", massId: "mass-0", assembly: { id: "upper-south-terrace", intent: "upper terrace off the south door", parts: [
    { id: "deck", type: "slab", facade: "south", start: .2, end: .5, depth: 1.6, host: { kind: "facade", facade: "south", level: 1 } },
    ...(railing ? [{ id: "rail", type: "railing" as const, slabId: "deck", edges: ["outer", "start", "end"] as const, height: 1.05 }] : []),
  ] } },
});
const NEEDS = [
  { id: "roof-access", capability: "roof access stair", reason: "No primitive builds a stair or hatch to the roof." },
  { id: "stairs", capability: "interior stair with floor opening", reason: "No primitive cuts a floor or builds a stair between levels." },
  { id: "interior-doors", capability: "interior wall openings", reason: "Interior partitions and their doors are not represented." },
];
const FULL_PLAN = (railing = true): SceneEditPlan => ({
  intent: "Coordinated villa completion.",
  operations: [upperDeck(railing), { op: "changeMaterial", target: "mass:mass-0", material: { color: "#d8cfc0", roughness: .8 } }],
  capabilityNeeds: NEEDS,
  goals: [
    { id: "balconies", intent: "Upper south terrace off the existing upper door", request: "complete the missing balconies and terraces on the upper floor", status: "planned", operationIds: ["operation:0"] },
    { id: "rooftop", intent: "Usable rooftop living", request: "make the rooftop usable as outdoor living space", status: "capability-needed", capabilityNeedIds: ["roof-access"] },
    { id: "patio", intent: "Patio and pool outdoor living", request: "improve the patio and pool outdoor living", status: "already-satisfied", evidence: "The saved pool and terrace already form the outdoor living court.", evidenceTargetIds: ["site:pool", "site:terrace"] },
    { id: "facade", intent: "Facade depth through material layering", request: "improve the facade depth and landscaping", status: "planned", operationIds: ["operation:1"] },
    { id: "stairs", intent: "Circulation between floors", request: "create believable circulation between floors with stairs", status: "capability-needed", capabilityNeedIds: ["stairs"] },
    { id: "doors", intent: "Every room reachable through internal doors", request: "add internal doors so every room is reachable", status: "capability-needed", capabilityNeedIds: ["interior-doors"] },
  ],
});

describe("broad Architect requests account for every goal", { timeout: 60_000 }, () => {
  it("rejects the live shape (one portico delete), repairs into a coordinated plan, and reports partial completion honestly", async () => {
    const beforeJson = await villa();
    answerPlans(PORTICO_DELETE, FULL_PLAN());

    const { res, body } = await edit(VILLA_REQUEST, beforeJson);

    expect(res.status).toBe(200);
    expect(architectCalls()).toHaveLength(2);
    expect(architectCalls()[0].messages[0].content).toContain('"contextTier":"global-architecture"');
    const repair = architectCalls()[1].messages[0].content;
    expect(repair).toContain("INCOMPLETE_PLAN");
    expect(repair).toContain('"code":"INCOMPLETE_PLAN"');
    expect(repair).toContain('"unmappedOperationIds":["operation:0"]');
    // Re-planning keeps the whole authoritative world it was planned from.
    expect(repair).toContain('"world"');
    expect(repair).toContain('"document"');
    expect(body.summary).not.toMatch(/^Architectural edit applied \(delete/);
    expect(body.summary).toBe("Architectural revision partially applied: 2 goals completed, 2 operations applied, 1 already satisfied, 3 require new geometry capabilities. Not yet possible: Usable rooftop living (needs roof access stair); Circulation between floors (needs interior stair with floor opening); Every room reachable through internal doors (needs interior wall openings).");
    expect(body).toMatchObject({ completion: "partial", goalSummary: { completed: 2, alreadySatisfied: 1, capabilityNeeded: 3, complete: false } });
    expect(body.capabilityNeedId).toEqual(expect.any(String));
    expect(body.circulation!.limitations.join(" ")).toMatch(/Stairs and floor openings are not represented/);
    // The achievable work executed; the portico the owner did not ask to remove survived.
    const after = (JSON.parse(body.json!) as Project).architecturalDesignDocument.massing.masses[0];
    expect(after.assemblies!.map((assembly) => assembly.id)).toEqual(["main-entry-portico-addition", "upper-south-terrace"]);
    expect(network).not.toHaveBeenCalled();
  });

  it("never reports success while goals stay unaccounted, and never falls back to a document replacement", async () => {
    const beforeJson = await villa();
    const trivial = (n: number): SceneEditPlan => ({ intent: `attempt ${n}`, operations: [{ op: "changeMaterial", target: "mass:mass-0", material: { color: `#00000${n}` } }], goals: [{ id: "facade", intent: "facade", request: "improve the facade depth and landscaping", status: "planned", operationIds: ["operation:0"] }] });
    answerPlans(trivial(1), trivial(2), trivial(3));

    const { res, body } = await edit(VILLA_REQUEST, beforeJson);

    expect(res.status).toBe(422);
    expect(body.json).toBeUndefined();
    expect(body.code).toBe("ARCHITECTURAL_EDIT_FAILED");
    expect(architectCalls()).toHaveLength(3);
    for (const call of architectCalls()) {
      expect(call.system).not.toContain("Return only { document }");
      expect(call.messages[0].content).not.toContain("legacy envelope");
    }
    expect((body.repairRequests ?? []).join("\n")).toMatch(/listed item "make the rooftop usable as outdoor living space" is not claimed/);
  });

  it("feeds an introduced circulation failure back as structured feedback and accepts the repaired plan", async () => {
    const beforeJson = await villa();
    answerPlans(FULL_PLAN(false), FULL_PLAN(true));

    const { res, body } = await edit(VILLA_REQUEST, beforeJson);

    expect(res.status).toBe(200);
    const repair = architectCalls()[1].messages[0].content;
    expect(repair).toContain('"code":"CIRCULATION_INVALID"');
    expect(repair).toContain("part:mass-0:upper-south-terrace:deck is an elevated slab with no railing on its outer edge");
    expect(body.completion).toBe("partial");
  });

  it("reports a complete coordinated plan as complete", async () => {
    const beforeJson = await villa();
    const plan = FULL_PLAN();
    answerPlans({ ...plan, capabilityNeeds: [], goals: plan.goals!.filter((goal) => goal.status !== "capability-needed") });

    const { res, body } = await edit("Revise the whole villa:\n- complete the missing balconies and terraces on the upper floor\n- improve the patio and pool outdoor living\n- improve the facade depth and landscaping", beforeJson);

    expect(res.status).toBe(200);
    expect(body.summary).toBe("Architectural revision applied: 2 goals completed, 2 operations applied, 1 already satisfied.");
    expect(body.completion).toBe("complete");
  });

  it("keeps a local one-operation edit lightweight, with the simple message", async () => {
    const beforeJson = await villa();
    answerPlans(PORTICO_DELETE);

    const { res, body } = await edit("delete the entry portico", beforeJson);

    expect(res.status).toBe(200);
    expect(architectCalls()).toHaveLength(1);
    expect(body.summary).toBe("Architectural edit applied (delete assembly:mass-0:main-entry-portico-addition).");
    expect(body.goalSummary).toBeUndefined();
  });
});
