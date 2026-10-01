import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimings } from "@/lib/ai/timing";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { MASS_ROLE_VALUES, type ArchitecturalDesignDocument, type MassGeometryOperation, type MassVolume } from "../document";
import { compileArchitecture } from "../compiler";
import { buildFloorFootprint } from "../geometry/footprint";
import { ARCHITECT_SYSTEM_PROMPT, architectOutputSchema } from "../stages/architectStage";
import { runDesignQualityGate } from "../stages/qualityGate";
import { facadeObstructions, SHARED_WALL_REPAIR } from "../stages/integrityChecks";
import { SHARED_WALL_GAP_M, sharedFacades } from "../volumePlan";
import first from "./fixtures/liveArchitectSharedFacadeFirst.json";
import repaired from "./fixtures/liveArchitectSharedFacadeRepair.json";

/**
 * The persisted live single-Architect run rejected with facade-realization-main-living / -rear-terrace after its one
 * same-Architect repair: `first` is the ai_usage candidate of attempt 1, `repaired` that of the repair (both byte-
 * identical to their recorded output fingerprints). No live AI call here — every model answer is mocked.
 *
 * Layout (rotation 0, elevation 0 throughout): main-living 12×10 at x -8..4, z -5..5, two floors, 6.8m; bedroom-wing
 * 6×7 at x 4..10, z -5..2 against its east facade; rear-terrace 10×3, 3.1m, at x -6..4 south of it; entry-forecourt
 * 4.6×1.2, 3.15m, at x -4.3..0.3 north of it. Attempt 1 had the forecourt 0.5m inside the north facade and the terrace
 * flush with the south one; the repair moved both 0.1m off — still well inside the 0.6m that makes a shared wall.
 */

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));
beforeEach(() => { generateText.mockReset(); vi.stubEnv("OPENAI_API_KEY", "test-key"); });

const usage = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test" };
const doc = (raw: unknown) => structuredClone(raw) as unknown as ArchitecturalDesignDocument;
const compile = (d: ArchitecturalDesignDocument) => compileArchitecture(d, { materials: DEFAULT_MATERIALS_CONFIG });
const gate = (d: ArchitecturalDesignDocument) => runDesignQualityGate(d, compile(d).diagnostics!);
const detailOf = (d: ArchitecturalDesignDocument, id: string) => gate(d).checks.find((c) => c.id === id)!;
const withMass = (d: ArchitecturalDesignDocument, id: string, edit: (m: MassVolume) => MassVolume): ArchitecturalDesignDocument => ({ ...d, massing: { ...d.massing, masses: d.massing.masses.map((m) => (m.id === id ? edit(m) : m)) } });
const mass = (d: ArchitecturalDesignDocument, id: string) => d.massing.masses.find((m) => m.id === id)!;
const primitivesOf = (d: ArchitecturalDesignDocument, id: string) => compile(d).model.primitives.filter((p) => p.id.startsWith(`architecture-${id}-`));

describe("the persisted live shared-facade rejection, compiled locally", () => {
  it("reproduces it: only the two facade-realization checks block, on the first attempt and after the repair", () => {
    for (const d of [doc(first), doc(repaired)]) expect(gate(d).blocking.map((c) => c.id)).toEqual(["facade-realization-main-living", "facade-realization-rear-terrace"]);
  });

  it("finds each shared facade from the actual geometry: forecourt north, terrace south, bedroom wing east of main-living", () => {
    const d = doc(repaired);
    const obstructions = facadeObstructions(mass(d, "main-living"), d.massing.masses, d.siteStrategy);
    const summary = obstructions.map((o) => ({ facade: o.facade, neighbor: o.neighborId, gap: +o.gap.toFixed(2), start: +o.start.toFixed(3), end: +o.end.toFixed(3), top: +o.top.toFixed(2) }));
    expect(summary).toEqual(expect.arrayContaining([
      { facade: "north", neighbor: "entry-forecourt", gap: 0.1, start: 0.308, end: 0.692, top: 3.15 },
      { facade: "south", neighbor: "rear-terrace", gap: 0.1, start: 0.167, end: 1, top: 3.1 },
      { facade: "east", neighbor: "bedroom-wing", gap: 0, start: 0, end: 0.7, top: 3.4 },
      { facade: "east", neighbor: "bedroom-wing", gap: 0, start: 0, end: 0.7, top: 6.8 },
    ]));
    expect(new Set(obstructions.map((o) => o.neighborId))).toEqual(new Set(["entry-forecourt", "rear-terrace", "bedroom-wing"]));
    // The bedroom wing is flush with main-living's north facade line but beside it, not in front of it.
    expect(obstructions.filter((o) => o.facade === "north").map((o) => o.neighborId)).toEqual(["entry-forecourt"]);
  });

  it("the terrace and the forecourt are built as walled volumes, not open structures", () => {
    const d = doc(repaired);
    // Terrace: its wall facing main-living is a full-height solid wall with a window in it; its "open" recesses
    // leave most of its 10×3m footprint unfloored and unroofed, posts standing at the back of that void.
    const terrace = primitivesOf(d, "rear-terrace");
    expect(terrace.some((p) => /-wall-0-north-\d+$/.test(p.id))).toBe(true);
    const slabArea = terrace.filter((p) => p.kind === "box" && /-floor-0/.test(p.id)).reduce((sum, p) => sum + (p.kind === "box" ? p.size[0] * p.size[2] : 0), 0);
    expect(slabArea).toBeLessThan(0.25 * 10 * 3);
    expect(terrace.filter((p) => /-open-\d+-post-/.test(p.id)).length).toBeGreaterThan(0);
    // Forecourt: its side facing main-living's door is one solid wall; its only open edge faces away, north.
    const forecourt = primitivesOf(d, "entry-forecourt");
    expect(forecourt.map((p) => p.id)).toContain("architecture-entry-forecourt-wall-0-south");
  });
});

describe("the repair diagnostic names the neighbor, where its wall stands, and what it blocks", () => {
  const living = () => detailOf(doc(repaired), "facade-realization-main-living").detail;
  const terrace = () => detailOf(doc(repaired), "facade-realization-rear-terrace").detail;

  it("north: the forecourt's solid wall in front of the entry — a genuine block", () => {
    expect(living()).toContain('Its local north facade (facing world north) is blocked by "entry-forecourt": that volume\'s solid wall stands 0.10m off that facade across world x -4.30..0.30 (4.60m of the 12.00m facade, span 0.31..0.69), 0.00..3.15m high — in front of entry-recess "living-entry-recess" (span 0.37..0.63, ground floor), door "living-entry-door" (span 0.39..0.61, ground floor).');
  });

  it("south: the terrace's solid wall in front of the garden glazing, and the projection that runs into it", () => {
    expect(living()).toContain('Its local south facade (facing world south) is blocked by "rear-terrace": that volume\'s solid wall stands 0.10m off that facade across world x -6.00..4.00 (10.00m of the 12.00m facade, span 0.17..1.00), 0.00..3.10m high — in front of projection "living-south-canopy" (span 0.12..0.88, ground floor, 0.80m deep — past that 0.10m gap, into "rear-terrace"), glazing-zone "living-garden-glazing" (span 0.08..0.92, ground floor).');
  });

  it("the terrace's own north glazing, behind main-living's wall", () => {
    expect(terrace()).toContain('Its local north facade (facing world north) is blocked by "main-living": that volume\'s solid wall stands 0.10m off that facade across world x 2.56..4.00');
    expect(terrace()).toContain('in front of glazing-zone "terrace-north-garden-glazing" (span 0.10..0.90, ground floor)');
  });

  it("does not block upper-floor elements the single-storey neighbors never reach", () => {
    expect(living()).not.toContain("living-north-window-rhythm");
    expect(living()).not.toContain("living-garden-upper-glazing");
  });

  it("states the shared-wall distance and the Architect's own options, without choosing one", () => {
    for (const detail of [living(), terrace()]) expect(detail).toContain(SHARED_WALL_REPAIR);
    expect(SHARED_WALL_REPAIR).toContain("more than 0.6m clear");
  });

  it("the first attempt's forecourt ran into the facade; the diagnostic says so", () => {
    expect(detailOf(doc(first), "facade-realization-main-living").detail).toContain('blocked by "entry-forecourt": that volume\'s solid wall runs 0.50m into that facade across world x -4.30..0.30');
  });
});

describe("what still blocks, and what no longer does", () => {
  it("a solid volume in front of the entrance blocks; the same volume more than 0.6m clear does not", () => {
    const clear = withMass(doc(repaired), "entry-forecourt", (m) => ({ ...m, position: { ...m.position, z: -6.3 } }));
    expect(sharedFacades(mass(clear, "main-living"), clear.massing.masses, clear.siteStrategy).has("north")).toBe(false);
    expect(detailOf(clear, "facade-realization-main-living").detail).not.toContain("entry-forecourt");
  });

  it("glazing against a solid party wall blocks — the bedroom wing's wall, on main-living's east facade", () => {
    const glazedEast = withMass(doc(repaired), "main-living", (m) => ({ ...m, openings: [...(m.openings ?? []), { id: "east-glass", type: "glazing-zone", facade: "east", start: 0.1, end: 0.5, heightRatio: 0.7, floors: "upper" }] }));
    expect(detailOf(glazedEast, "facade-realization-main-living").detail).toContain('Its local east facade (facing world east) is blocked by "bedroom-wing": that volume\'s solid wall stands flush against that facade across world z -5.00..2.00 (7.00m of the 10.00m facade, span 0.00..0.70), 3.40..6.80m high — in front of glazing-zone "east-glass" (span 0.10..0.50, upper floors)');
  });

  it("glazing on a shared facade but beyond the neighbor's end is not blocked", () => {
    const beyond = withMass(doc(repaired), "main-living", (m) => ({ ...m, openings: [...(m.openings ?? []), { id: "east-glass", type: "glazing-zone", facade: "east", start: 0.75, end: 0.95, heightRatio: 0.7, floors: "upper" }] }));
    expect(detailOf(beyond, "facade-realization-main-living").detail).not.toContain("east-glass");
  });

  describe("a covered terrace whose side facing the living room is an open post edge", () => {
    /** The terrace authored with an open recess on its north (the side facing main-living) and no glazing there; main-living without its solid bump-out. */
    const openTerrace = (livingGlass: [number, number]) => {
      const d = withMass(doc(repaired), "rear-terrace", (m) => ({ ...m, openings: [], operations: [...(m.operations ?? []), { id: "terrace-open-to-living", type: "recess", facade: "north", start: 0.1, end: 0.9, depth: 0.4, floors: "all", open: true, postSpacing: 2.5 }] }));
      return withMass(d, "main-living", (m) => ({ ...m, operations: m.operations?.filter((op) => op.id !== "living-south-canopy"), openings: m.openings?.map((o) => (o.id === "living-garden-glazing" && o.type === "glazing-zone" ? { ...o, start: livingGlass[0], end: livingGlass[1] } : o)) }));
    };

    it("compiles to posts, not a wall, along that edge", () => {
      const terrace = primitivesOf(openTerrace([0.25, 0.75]), "rear-terrace");
      expect(terrace.filter((p) => /-open-\d+-post-/.test(p.id)).length).toBeGreaterThan(0);
    });

    it("living glazing behind the open edge is not blocked, and neither is the terrace's own open edge", () => {
      const d = openTerrace([0.25, 0.75]);
      const result = gate(d);
      expect(result.blocking.map((c) => c.id)).not.toContain("facade-realization-rear-terrace");
      expect(detailOf(d, "facade-realization-main-living").detail).not.toContain("rear-terrace");
    });

    it("living glazing that runs behind the terrace's remaining solid end wall still blocks, naming that stretch", () => {
      expect(detailOf(openTerrace([0.08, 0.75]), "facade-realization-main-living").detail).toContain('blocked by "rear-terrace": that volume\'s solid wall stands 0.10m off that facade across world x -6.00..-5.00 (1.00m of the 12.00m facade, span 0.17..0.25), 0.00..3.10m high — in front of glazing-zone "living-garden-glazing"');
    });
  });
});

describe("the same-Architect repair receives these diagnostics", () => {
  it("attempt 2 is told which volume blocks which facade, where, and by how much — then fails with the same, now concrete, reasons", async () => {
    const { runArchitectStage } = await import("../stages/architectStage");
    generateText
      .mockResolvedValueOnce({ output: { document: doc(first) }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { document: doc(repaired) }, totalUsage: {} });

    const result = await runArchitectStage("Test residence", createTimings(), 60_000, usage);

    expect(generateText).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(false);
    const repair = (generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content;
    expect(repair).toContain('- facade-realization-main-living: Impossible authored facade intent on "main-living"');
    expect(repair).toContain('blocked by "entry-forecourt": that volume\'s solid wall runs 0.50m into that facade across world x -4.30..0.30');
    expect(repair).toContain('blocked by "rear-terrace": that volume\'s solid wall stands flush against that facade across world x -6.00..4.00');
    expect(repair).toContain('door "living-entry-door"');
    expect(repair).toContain(SHARED_WALL_REPAIR);
    expect(result.errors?.join(" ")).toContain("stands 0.10m off that facade across world x -4.30..0.30");
  });
});

describe("the Architect is told both spatial rules before its first attempt", () => {
  /** The prompt's open-space section, up to the paragraph that follows it. */
  const openSection = () => ARCHITECT_SYSTEM_PROMPT.slice(ARCHITECT_SYSTEM_PROMPT.indexOf("SOLID MASSES VS OPEN OUTDOOR SPACE"), ARCHITECT_SYSTEM_PROMPT.indexOf("The deterministic compiler"));
  /** The forecourt standing `gap` meters north of main-living's north facade (z = -5); it is 1.2m deep. */
  const forecourtAt = (gap: number) => withMass(doc(repaired), "entry-forecourt", (m) => ({ ...m, position: { ...m.position, z: -5 - gap - m.depth / 2 } }));
  const blocksEntry = (d: ArchitecturalDesignDocument) => detailOf(d, "facade-realization-main-living").detail.includes('blocked by "entry-forecourt"');
  /** A plain volume carrying only `operations`, as the compiler builds it. */
  const bare = (id: string, operations: MassGeometryOperation[] = [], edit: (m: MassVolume) => MassVolume = (m) => m) => withMass(doc(repaired), id, (m) => edit({ ...m, operations, openings: [] }));

  describe("shared-facade clearance", () => {
    it("states the shared-wall rule with the gate's own distance, and that exposure needs MORE than it", () => {
      expect(SHARED_WALL_GAP_M).toBe(0.6);
      expect(ARCHITECT_SYSTEM_PROMPT).toContain("SHARED FACADES — 0.6m CLEARANCE. A neighboring volume whose solid wall stands within 0.6m of a facade (a gap of 0.6m or less");
      expect(ARCHITECT_SYSTEM_PROMPT).toContain("Do not place an opaque neighboring volume within 0.6m of a facade stretch that carries an entrance, door, window, glazing zone, opening rhythm, projection, a recess that must be reached, or any other exposed facade feature.");
      expect(ARCHITECT_SYSTEM_PROMPT).toContain("To keep a facade independently exposed, leave MORE than 0.6m of clear space between it and the neighbor's solid wall — unless the neighbor's facing edge is explicitly open");
      expect(ARCHITECT_SYSTEM_PROMPT).toContain("If two volumes are intentionally attached or shared, author no exterior openings or entrance features on the blocked portion of their shared solid wall, on either volume.");
    });

    it("says a 0.1m gap is not separation — the live repair's exact move", () => {
      expect(ARCHITECT_SYSTEM_PROMPT).toContain("A tiny gap is not separation. 0.1m, 0.3m or exactly 0.6m still makes a shared wall.");
      expect(blocksEntry(forecourtAt(0.1))).toBe(true);
    });

    it("the stated threshold is the gate's: just inside it blocks, just beyond it does not", () => {
      expect(blocksEntry(forecourtAt(SHARED_WALL_GAP_M - 0.01))).toBe(true);
      expect(blocksEntry(forecourtAt(SHARED_WALL_GAP_M + 0.01))).toBe(false);
    });

    it("leaves the design decision to the Architect instead of prescribing one", () => {
      expect(ARCHITECT_SYSTEM_PROMPT).toContain("How the composition satisfies this is your architectural decision: moving or separating a volume, changing the composition, or changing which facade carries the exposed features are all yours to choose.");
    });

    it("derives every stated distance from SHARED_WALL_GAP_M, not a literal", async () => {
      vi.resetModules();
      vi.doMock("../volumePlan", async (importOriginal) => ({ ...(await importOriginal<typeof import("../volumePlan")>()), SHARED_WALL_GAP_M: 0.85 }));
      try {
        const { ARCHITECT_SYSTEM_PROMPT: moved } = await import("../stages/architectStage");
        expect(moved).toContain("SHARED FACADES — 0.85m CLEARANCE");
        expect(moved).toContain("leave MORE than 0.85m of clear space");
        expect(moved).toContain("0.1m, 0.3m or exactly 0.85m still makes a shared wall");
        expect(moved).not.toMatch(/\b0\.6m\b/);
      } finally {
        vi.doUnmock("../volumePlan");
        vi.resetModules();
      }
    });
  });

  describe("solid masses vs open outdoor space", () => {
    it("states that an ordinary mass is solid whatever its role or name", () => {
      expect(openSection()).toContain("Every mass is built as an enclosed, solid volume by default: a floor slab, a full-height solid wall along every edge of its footprint, and its roof.");
      expect(openSection()).toContain("role (terrace, veranda, entry, connector, …), name and notes are descriptive only");
      expect(openSection()).toContain("naming something open never removes a wall. Geometry alone decides what is open.");
      expect(openSection()).toContain("Do not author an ordinary mass for a covered open terrace, veranda, porch, canopy, colonnade or forecourt unless enclosing walls are actually intended.");
    });

    it("which the compiler bears out: every role and an 'open' name build the same four solid walls and no posts", () => {
      const walls = (d: ArchitecturalDesignDocument) => primitivesOf(d, "rear-terrace").filter((p) => /-wall-/.test(p.id)).map((p) => (p.kind === "box" ? [p.id, p.position, p.size] : p.id));
      const baseline = walls(bare("rear-terrace"));
      expect(baseline.map((w) => (w as unknown[])[0])).toEqual(["north", "east", "south", "west"].map((f) => `architecture-rear-terrace-wall-0-${f}`));
      for (const role of MASS_ROLE_VALUES) expect(walls(bare("rear-terrace", [], (m) => ({ ...m, role, name: "Open colonnade terrace" })))).toEqual(baseline);
    });

    it("names only open geometry the strict Architect schema can author, and nothing it cannot", () => {
      expect(openSection()).toContain("(a) recess or projection with open:true.");
      expect(openSection()).toContain("header beam with posts every postSpacing meters");
      expect(openSection()).toContain('(b) Covered space beneath an upper volume: on a volume of 2+ floors, a recess with floors:"ground"');
      expect(openSection()).toContain("A covered terrace that stands against a glazed living facade must be genuinely open on the side facing that glazing");
      expect(openSection()).not.toMatch(/pilotis|capabilit|cantilever|brise/);
      const ops: MassGeometryOperation[] = [
        { type: "recess", facade: "north", start: 0.05, end: 0.95, depth: 0.4, open: true, postSpacing: 2.5 },
        { type: "projection", facade: "south", start: 0.2, end: 0.8, depth: 2, open: true },
        { type: "recess", facade: "east", start: 0.1, end: 0.9, depth: 1.5, floors: "ground", open: true, postSpacing: 3 },
      ];
      expect(architectOutputSchema.safeParse({ document: bare("rear-terrace", ops) }).success).toBe(true);
    });

    it("an open projection is open on its outer face only — its side returns are solid walls, as stated", () => {
      expect(openSection()).toContain("it is open only on that outer face: its two side returns (each as long as its depth) are solid walls.");
      const built = primitivesOf(bare("rear-terrace", [{ type: "projection", facade: "south", start: 0.2, end: 0.8, depth: 2, open: true, postSpacing: 2 }]), "rear-terrace");
      expect(built.filter((p) => /-open-0-post-/.test(p.id)).length).toBeGreaterThan(1);
      const returns = built.filter((p) => /-wall-0-cut-\d+$/.test(p.id));
      expect(returns).toHaveLength(2);
      for (const r of returns) expect(r.kind === "box" && Math.max(r.size[0], r.size[2])).toBeCloseTo(2);
    });

    it("a ground-floor open recess leaves posts under a full upper floor, as stated", () => {
      const built = primitivesOf(bare("bedroom-wing", [{ type: "recess", facade: "east", start: 0.1, end: 0.9, depth: 1.5, floors: "ground", open: true, postSpacing: 3 }]), "bedroom-wing");
      expect(built.filter((p) => /-wall-0-open-0-post-/.test(p.id)).length).toBeGreaterThan(1);
      expect(built.filter((p) => /-wall-1-open-/.test(p.id))).toEqual([]);
      expect(built.map((p) => p.id)).toContain("architecture-bedroom-wing-wall-1-east");
    });

    it("several open sides work when adjacent spans stop short of their shared corner, as stated", () => {
      expect(openSection()).toContain("stop adjacent spans short of their shared corner (e.g. start 0.05, end 0.95) — short solid corner piers remain.");
      const sides = (["south", "east", "west"] as const).map((facade): MassGeometryOperation => ({ type: "recess", facade, start: 0.05, end: 0.95, depth: 0.3, open: true }));
      const footprint = buildFloorFootprint(10, 3, sides, 0);
      expect(footprint.warnings).toEqual([]);
      expect(footprint.edges.filter((e) => e.open)).toHaveLength(3);
    });

    it("the live run's terrace, opened on the side facing the living glazing, no longer blocks it", () => {
      const opened = withMass(doc(repaired), "rear-terrace", (m) => ({ ...m, openings: [], operations: [...(m.operations ?? []), { type: "recess", facade: "north", start: 0.05, end: 0.95, depth: 0.4, open: true, postSpacing: 2.5 }] }));
      const living = withMass(opened, "main-living", (m) => ({ ...m, operations: m.operations?.filter((op) => op.id !== "living-south-canopy"), openings: m.openings?.map((o) => (o.id === "living-garden-glazing" && o.type === "glazing-zone" ? { ...o, start: 0.3, end: 0.8 } : o)) }));
      expect(gate(living).blocking.map((c) => c.id)).not.toContain("facade-realization-rear-terrace");
      expect(detailOf(living, "facade-realization-main-living").detail).not.toContain("rear-terrace");
    });
  });
});
