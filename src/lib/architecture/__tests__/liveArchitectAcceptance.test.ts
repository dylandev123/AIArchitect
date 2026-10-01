import { beforeEach, describe, expect, it, vi } from "vitest";
import { asSchema } from "ai";
import { createTimings } from "@/lib/ai/timing";
import { SIDE_VECTOR } from "@/lib/house/siteSettings";
import type { HousePrimitive } from "@/lib/house/types";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { ArchitecturalDesignDocument, MassFacade, MassOpening, MassVolume } from "../document";
import { ARCHITECT_SYSTEM_PROMPT, architectOutputSchema } from "../stages/architectStage";
import { compileArchitecture } from "../compiler";
import { runDesignQualityGate } from "../stages/qualityGate";
import rejected from "./fixtures/liveArchitectRepairRejected.json";

/**
 * Acceptance semantics against the persisted live single-Architect document that was rejected after its one
 * same-Architect repair (ai_usage candidate of the repair attempt, no live AI call here — every model answer is
 * mocked). That document authors every facade position (`start`/`end`) in meters, while the compiler reads them as
 * fractions 0..1 of the facade: all 14 of its spans were clamped or dropped — 13 of them without any diagnostic —
 * including its only door.
 */

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText: (...args: unknown[]) => generateText(...args) }));
vi.mock("@/lib/ai/usage/track", () => ({ withUsageLogging: (_meta: unknown, run: () => Promise<unknown>) => run() }));
beforeEach(() => { generateText.mockReset(); vi.stubEnv("OPENAI_API_KEY", "test-key"); });

const usage = { projectId: null, requestType: "generation" as const, scope: "world" as const, model: "test" };
const live = () => structuredClone(rejected) as unknown as ArchitecturalDesignDocument;
const compile = (d: ArchitecturalDesignDocument) => compileArchitecture(d, { materials: DEFAULT_MATERIALS_CONFIG });
const gate = (d: ArchitecturalDesignDocument) => runDesignQualityGate(d, compile(d).diagnostics!);
const doorPanels = (ps: readonly HousePrimitive[]) => ps.filter((p) => p.label.endsWith("Glazed Door Panel"));
const withMasses = (d: ArchitecturalDesignDocument, edit: (m: MassVolume) => MassVolume): ArchitecturalDesignDocument => ({ ...d, massing: { ...d.massing, masses: d.massing.masses.map(edit) } });

/** The live document with its meter spans expressed as facade fractions — nothing else changed. */
const inFractions = (d: ArchitecturalDesignDocument) => withMasses(d, (m) => {
  const len = (facade: string) => (facade === "north" || facade === "south" ? m.width : m.depth);
  const fix = <T extends object>(item: T): T => ("start" in item && "end" in item && "facade" in item ? { ...item, start: (item.start as number) / len(item.facade as string), end: (item.end as number) / len(item.facade as string) } : item);
  return { ...m, operations: m.operations?.map(fix), openings: m.openings?.map(fix) };
});

describe("the persisted live Architect repair, compiled locally", () => {
  it("reproduces the rejection, and every remaining blocker is geometry the compiler did not build as authored", () => {
    const d = live();
    const { model, diagnostics } = compile(d);
    const result = runDesignQualityGate(d, diagnostics!);

    expect(result.blocking.map((c) => c.id)).toEqual(["requested-geometry-survived-compilation"]);
    const survived = result.blocking[0].detail;
    // The door exists in the document; it lies outside the recess (and the facade) in fractional terms, and is never built.
    expect(survived).toContain('entry-recess on the north facade (0.38..0.63) has no door inside it — the authored door "main-entry-door" at 4.8..7.2 lies outside the recess');
    expect(survived).toContain('door "main-entry-door" on the north facade spans 4.8..7.2, outside the facade — start/end are fractions 0..1 of its 12m length; none of it lies on the facade, so it was not built. If meters were meant, that span is 0.40..0.60.');
    expect(survived).toContain('glazing-zone "garden-glass-wall" on the south facade spans 1..11.4');
    expect(survived).toContain('recess "south-terrace-recess" on the south facade spans 0.8..10.8, outside the facade — start/end are fractions 0..1 of its 12m length; only 0.80..1.00 (2.40m) was built.');
    expect(survived.match(/outside the facade/g)).toHaveLength(14);
    expect(doorPanels(model.primitives)).toEqual([]);
  });

  it("reports the Architect's own plan metadata mismatches as warnings, not blockers", () => {
    const result = gate(live());
    const byId = new Map(result.checks.map((c) => [c.id, c] as const));
    expect(byId.get("plan-realized-main-living")).toMatchObject({ passed: false, severity: "warning", detail: expect.stringContaining("opening-rhythm on the north facade") });
    expect(byId.get("plan-realized-rear-terrace")).toMatchObject({ passed: false, severity: "warning", detail: expect.stringContaining("screen on the east facade, screen on the west facade") });
  });

  it("accepts the same house once its spans are on the facade: the recess door is recognized and built, plan metadata stays a warning", () => {
    const d = inFractions(live());
    const { model, diagnostics } = compile(d);
    const result = runDesignQualityGate(d, diagnostics!);

    expect(result.blocking).toEqual([]);
    expect(diagnostics!.geometry.flatMap((g) => g.warnings)).toEqual([]);
    expect(doorPanels(model.primitives).map((p) => p.id)).toEqual(["architecture-main-living-wall-0-entry-1-door-panel"]);
    expect(result.warnings.map((c) => c.id)).toEqual(expect.arrayContaining(["plan-realized-main-living", "plan-realized-rear-terrace"]));
  });

  it("keeps a plan authored by an upstream stage binding: the same mismatch blocks a staged-pipeline document", () => {
    const d = inFractions(live());
    const staged = { ...d, metadata: { ...d.metadata, source: "stage-pipeline" as const } };
    expect(gate(staged).blocking.map((c) => c.id)).toEqual(expect.arrayContaining(["plan-realized-main-living", "plan-realized-rear-terrace"]));
  });

  it("sends the unit failure — not a phantom missing door — to the one same-Architect repair, and accepts the repaired house", async () => {
    const { runArchitectStage } = await import("../stages/architectStage");
    generateText
      .mockResolvedValueOnce({ output: { document: live() }, totalUsage: {} })
      .mockResolvedValueOnce({ output: { document: inFractions(live()) }, totalUsage: {} });

    const result = await runArchitectStage("Test residence", createTimings(), 60_000, usage);

    expect(result.ok).toBe(true);
    expect(generateText).toHaveBeenCalledTimes(2);
    const repair = (generateText.mock.calls[1][0] as { messages: { content: string }[] }).messages[0].content;
    expect(repair).toContain("If meters were meant, that span is 0.40..0.60.");
    expect(repair).not.toContain("plan-realized");
  });
});

describe("what still blocks a live single-Architect document", () => {
  const valid = () => inFractions(live());

  it("explicit geometry the compiler cannot build as authored", () => {
    const clipped = withMasses(valid(), (m) => (m.id === "bedroom-wing" ? { ...m, openings: [...(m.openings ?? []), { id: "stray", type: "glazing-zone", facade: "west", start: 0.5, end: 1.6, heightRatio: 0.6 }] } : m));
    expect(gate(clipped).blocking.map((c) => c.detail).join(" ")).toMatch(/glazing-zone "stray" on the west facade spans 0.5..1.6, outside the facade .* only 0.50..1.00 \(4.00m\) was built/);
  });

  it("an entry recess with no door at all", () => {
    const doorless = withMasses(valid(), (m) => ({ ...m, openings: m.openings?.filter((o) => o.type !== "door") }));
    expect(gate(doorless).blocking.map((c) => c.detail).join(" ")).toContain("entry-recess on the north facade has no authored door");
  });

  it("a house with no entrance at all", () => {
    const sealed = withMasses(valid(), (m) => ({ ...m, operations: m.operations?.filter((o) => o.type !== "entry-recess"), openings: m.openings?.filter((o) => o.type !== "door") }));
    expect(gate(sealed).blocking.map((c) => c.id)).toContain("identifiable-entrance");
  });

  // The terrace pulled up flush against the living pavilion's north facade, where the entry recess and its door are.
  const abutting = (open: boolean) => withMasses(valid(), (m) => (m.id === "rear-terrace" ? { ...m, position: { ...m.position, z: -6 }, operations: m.operations?.map((op) => (op.id === "terrace-open-south-edge" && op.type === "recess" ? { ...op, open } : op)) } : m));

  it("explicit geometry behind another volume's solid wall", () => {
    const detail = gate(abutting(false)).blocking.find((c) => c.id === "facade-realization-main-living")?.detail;
    expect(detail).toContain('Its local north facade (facing world north) is blocked by "rear-terrace": that volume\'s solid wall stands 0.35m off that facade across world x -6.65..2.65');
    expect(detail).toMatch(/in front of entry-recess "main-entry-recess" \(span 0\.38\.\.0\.63, ground floor\), door "main-entry-door" \(span 0\.40\.\.0\.60, ground floor\)/);
  });

  it("but not the same terrace's open post edge: the entry stays reachable between its posts", () => {
    expect(gate(abutting(true)).blocking.map((c) => c.id)).not.toContain("facade-realization-main-living");
  });

  it("volumes that occupy the same space", () => {
    const collided = withMasses(valid(), (m) => (m.id === "bedroom-wing" ? { ...m, position: { x: 2, z: 0 } } : m));
    expect(gate(collided).blocking.map((c) => c.id)).toContain("no-unintentional-overlap");
  });
});

/** One volume of the live document on its own (12m wide along X, 9m deep along Z, centered at x=-2, z=0), with only `openings`. */
const solo = (openings: MassOpening[], rotation = 0): ArchitecturalDesignDocument => {
  const d = inFractions(live());
  const mass = { ...d.massing.masses.find((m) => m.id === "main-living")!, relationships: undefined, operations: [], openings, rotation };
  return { ...d, massing: { ...d.massing, masses: [mass] }, roofs: { recipes: d.roofs.recipes.filter((r) => r.massId === mass.id) } };
};
const door = (facade: MassFacade, start = 0.4, end = 0.6): MassOpening => ({ id: `door-${facade}`, type: "door", facade, start, end, floors: "ground" });
/** Center and size of the ground-floor door frame the compiler built on `facade`. */
const frame = (d: ArchitecturalDesignDocument, facade: MassFacade) => {
  const { model, errors } = compile(d);
  expect(errors).toEqual([]);
  const p = model.primitives.find((q) => q.id === `architecture-main-living-wall-0-${facade}-door-0-frame`);
  if (p?.kind !== "box") throw new Error(`no ${facade} door frame was built`);
  return { x: p.position[0], z: p.position[2], size: p.size };
};
const withSpan = (d: ArchitecturalDesignDocument, start: number, end: number) =>
  withMasses(d, (m) => (m.id === "main-living" ? { ...m, openings: m.openings!.map((o) => (o.id === "main-entry-door" && o.type === "door" ? { ...o, start, end } : o)) } : m));

describe("the Architect's facade span contract: start/end are fractions 0..1 of the owning facade", () => {
  it("the output schema rejects a span outside 0..1 on every spanned element, and accepts the bounds", () => {
    const valid = inFractions(live());
    expect(architectOutputSchema.safeParse({ document: valid }).success).toBe(true);
    expect(architectOutputSchema.safeParse({ document: withSpan(valid, 0, 1) }).success).toBe(true);
    for (const [start, end] of [[-0.1, 0.5], [0.4, 1.2], [4.8, 7.2]]) {
      const parsed = architectOutputSchema.safeParse({ document: withSpan(valid, start, end) });
      expect(parsed.success).toBe(false);
      expect(parsed.error!.issues.map((i) => i.message).join(" ")).toContain("normalized fraction 0..1 along the owning facade, NOT meters");
    }
    // Recess/projection/glazing-zone/door alike: the persisted meter document fails only on its spans.
    const meters = architectOutputSchema.safeParse({ document: live() });
    expect(meters.success).toBe(false);
    expect(new Set(meters.error!.issues.map((i) => i.path.at(-1)))).toEqual(new Set(["start", "end"]));
    expect(new Set(meters.error!.issues.map((i) => i.path.at(-3)))).toEqual(new Set(["operations", "openings"]));
  });

  it("the structured-output JSON schema bounds and describes every start/end as a fraction, not meters", async () => {
    const spans: Record<string, unknown>[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      const props = (node as { properties?: Record<string, Record<string, unknown>> }).properties;
      if (props?.start && props.end) spans.push(props.start, props.end);
      Object.values(node).forEach(walk);
    };
    walk(await asSchema(architectOutputSchema).jsonSchema);
    expect(spans).toHaveLength(8); // recess, projection, glazing-zone, door × start/end
    for (const span of spans) {
      expect(span).toMatchObject({ type: "number", minimum: 0, maximum: 1 });
      expect(span.description).toMatch(/normalized fraction 0\.\.1 along the owning facade, NOT meters/);
      expect(span.description).toContain("start 0.4, end 0.6");
    }
  });

  it("the prompt states spans are fractions, with the centered-middle-20% example, and no longer says every value is meters", () => {
    expect(ARCHITECT_SYSTEM_PROMPT).toContain("FACADE SPANS ARE NOT METERS");
    expect(ARCHITECT_SYSTEM_PROMPT).toContain("normalized fractions from 0 to 1 along the owning facade — 0 = the beginning of that facade");
    expect(ARCHITECT_SYSTEM_PROMPT).toContain("1 = the end of that facade");
    expect(ARCHITECT_SYSTEM_PROMPT).toContain("a centered element covering the middle 20% of a facade is start 0.4, end 0.6");
    expect(ARCHITECT_SYSTEM_PROMPT).not.toContain("Use meters (pitch is degrees) and radians");
  });

  it("start 0.4, end 0.6 compiles to a centered span covering the middle 20% of the facade", () => {
    const north = frame(solo([door("north")]), "north");
    expect(north.x).toBeCloseTo(-2); // the mass center
    expect(north.size[0]).toBeCloseTo(0.2 * 12);
    const east = frame(solo([door("east")]), "east");
    expect(east.z).toBeCloseTo(0);
    expect(Math.max(east.size[0], east.size[2])).toBeCloseTo(0.2 * 9);
  });

  it("0 is the facade's beginning as the prompt states it: the west end of a north/south facade, the north end of an east/west one", () => {
    expect(frame(solo([door("north", 0, 0.2)]), "north").x).toBeCloseTo(-2 - 6 + 1.2);
    expect(frame(solo([door("south", 0, 0.2)]), "south").x).toBeCloseTo(-2 - 6 + 1.2);
    expect(frame(solo([door("east", 0, 0.2)]), "east").z).toBeCloseTo(-4.5 + 0.9);
    expect(frame(solo([door("west", 0, 0.2)]), "west").z).toBeCloseTo(-4.5 + 0.9);
  });

  it("the persisted live document, re-authored in fractions, passes the schema and the Architect stage on its first attempt", async () => {
    const { runArchitectStage } = await import("../stages/architectStage");
    generateText.mockResolvedValueOnce({ output: { document: inFractions(live()) }, totalUsage: {} });
    const result = await runArchitectStage("Test residence", createTimings(), 60_000, usage);
    expect(result).toMatchObject({ ok: true, attempts: 1 });
    expect(generateText).toHaveBeenCalledTimes(1);
    expect((generateText.mock.calls[0][0] as { system: string }).system).toBe(ARCHITECT_SYSTEM_PROMPT);
  });
});

describe("the Architect's world axes match the compiler's", () => {
  const stated = () => Object.fromEntries([...ARCHITECT_SYSTEM_PROMPT.matchAll(/\b(north|south|east|west) = ([+-])([XZ])\b/g)].map(([, side, sign, axis]) => [side, { sign: sign === "+" ? 1 : -1, axis }]));

  it("states north = -Z, south = +Z, east = +X, west = -X — the application's SIDE_VECTOR", () => {
    expect(ARCHITECT_SYSTEM_PROMPT).toContain("World axes: north = -Z, east = +X, south = +Z, west = -X");
    for (const [side, [x, z]] of Object.entries(SIDE_VECTOR)) expect(stated()[side]).toEqual(x ? { sign: Math.sign(x), axis: "X" } : { sign: Math.sign(z), axis: "Z" });
  });

  it("every stated axis is where the compiler builds that facade at rotation 0", () => {
    for (const [side, { sign, axis }] of Object.entries(stated()) as [MassFacade, { sign: number; axis: string }][]) {
      const { x, z } = frame(solo([door(side)]), side);
      const [dx, dz] = [x - -2, z - 0];
      if (axis === "X") { expect(Math.sign(dx)).toBe(sign); expect(dz).toBeCloseTo(0); }
      else { expect(Math.sign(dz)).toBe(sign); expect(dx).toBeCloseTo(0); }
    }
  });

  it("rotation turns the named facades as stated: 1.5708 turns the south facade to face east and the north facade west", () => {
    expect(ARCHITECT_SYSTEM_PROMPT).toContain("rotation 1.5708 turns the south facade to face east (+X) and the north facade to face west (-X)");
    const south = frame(solo([door("south")], 1.5708), "south");
    const north = frame(solo([door("north")], 1.5708), "north");
    expect(south.x).toBeGreaterThan(-2 + 4);
    expect(south.z).toBeCloseTo(0, 2);
    expect(north.x).toBeLessThan(-2 - 4);
  });

  it("makes arrival/rear coherent in those axes — and the persisted live terrace sat on the arrival side the prompt now rules out", () => {
    expect(ARCHITECT_SYSTEM_PROMPT).toContain("arrivalDirection=north, viewDirection=south → the entry door is on the north (-Z) facade, and a rear/garden terrace is at a LARGER z than the house");
    const d = live();
    expect(d.siteStrategy).toMatchObject({ arrivalDirection: "north", viewDirection: "south" });
    const house = d.massing.masses.find((m) => m.id === "main-living")!, terrace = d.massing.masses.find((m) => m.id === "rear-terrace")!;
    const towardArrival = (terrace.position.z - house.position.z) * SIDE_VECTOR.north[1];
    expect(towardArrival).toBeGreaterThan(0);
  });
});
