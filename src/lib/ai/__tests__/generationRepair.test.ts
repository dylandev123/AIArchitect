import { describe, expect, it } from "vitest";
import { assembleGeneratedProject, clampOffsetsInJson } from "../generation";
import { createTimings } from "../timing";
import { normalizeOversizedWindowOps, type AiGenerationResponse } from "../siteSchema";

/** A small house whose model output is broken in ways the server can repair without another model call. */
function output(operations: unknown[], house = { width: 12, depth: 9, floors: 1, roof: "gable" }): AiGenerationResponse {
  return {
    summary: "A house.",
    house,
    site: { environment: "countryside", viewDirection: "south", terrainSlope: "flat", approachSide: "north" },
    operations: [
      { op: "addDoor", value: { wall: "north", level: 0, offset: 5, width: 1.1, height: 2.1 } },
      ...operations,
    ],
  } as AiGenerationResponse;
}

const bedroom = (x: number) => ({ op: "addRoom", value: { type: "bedroom", level: 0, x, z: 0.3, width: 9, depth: 7 } });
const badMaterial = { op: "setMaterials", fields: { decking: { material: "not-a-material", color: "#ffffff" } } };

describe("assembleGeneratedProject: local repair", () => {
  it("fails an attempt with an invalid payload when strict, so the model can fix it", () => {
    expect(assembleGeneratedProject(output([badMaterial]), [], "A small house").ok).toBe(false);
  });

  it("drops an invalid payload and reports it instead of failing", () => {
    const result = assembleGeneratedProject(output([badMaterial]), [], "A small house", true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.skipped.join(" ")).toContain("setMaterials");
  });

  // 12 x 9 m: a 11.2 x 8.2 m interior cannot hold three 9 x 7 m rooms.
  const crowded = [bedroom(0.3), bedroom(0.3), bedroom(0.3)];

  it("fails an unpackable floor when strict", () => {
    const result = assembleGeneratedProject(output(crowded), [], "A small house");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/cannot be laid out/);
  });

  it("drops rooms that cannot be packed and keeps the design", () => {
    const result = assembleGeneratedProject(output(crowded), [], "A small house", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped.some((s) => /did not fit the floor plan/.test(s))).toBe(true);
    const rooms = (JSON.parse(result.json) as { rooms?: unknown[] }).rooms ?? [];
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.length).toBeLessThan(crowded.length);
  });

  it("applies the renderer's offset clamps to the JSON and nothing else", () => {
    const json = JSON.stringify({ house: { width: 12 }, windows: [{ offset: 1 }, { offset: 20, width: 2 }], balconies: [{ offset: -3 }] });
    const fixed = clampOffsetsInJson(json, ['Window 2: "offset" clamped to 10.', 'Balcony 1: "offset" clamped to 0.', 'Window 1: "width" clamped to 2.', "The renderer produced no geometry."]);
    expect(JSON.parse(fixed as string)).toEqual({ house: { width: 12 }, windows: [{ offset: 1 }, { offset: 10, width: 2 }], balconies: [{ offset: 0 }] });
  });

  it("reports nothing to repair when no message is an offset clamp", () => {
    expect(clampOffsetsInJson("{}", ['Window 1: "width" clamped to 2.'])).toBeNull();
  });

  describe("normalizeOversizedWindowOps", () => {
    it("splits an oversized addWindow into same-size panels that fit the width cap, preserving total width and other fields", () => {
      const ribbon = { op: "addWindow", value: { wall: "south", level: 0, offset: 1, width: 7.2, height: 1.6, sill: 0.8 } };
      const { operations, notes } = normalizeOversizedWindowOps([ribbon]);
      expect(notes).toEqual(["Converted 7.2m glazing request into 2 panels"]);
      expect(operations).toHaveLength(2);
      const panels = operations.map((op) => op.value as { wall: string; level: number; offset: number; width: number; height: number; sill: number });
      for (const p of panels) {
        expect(p.width).toBeLessThanOrEqual(4);
        expect(p.wall).toBe("south");
        expect(p.height).toBe(1.6);
        expect(p.sill).toBe(0.8);
      }
      const sorted = [...panels].sort((a, b) => a.offset - b.offset);
      expect(sorted[0].offset).toBe(1);
      const totalWidth = sorted[sorted.length - 1].offset + sorted[sorted.length - 1].width - sorted[0].offset;
      expect(totalWidth).toBeCloseTo(7.2, 5);
    });

    it("leaves a window at or under the width cap untouched", () => {
      const normal = { op: "addWindow", value: { wall: "south", level: 0, offset: 1, width: 2, height: 1.4, sill: 0.9 } };
      const { operations, notes } = normalizeOversizedWindowOps([normal]);
      expect(operations).toEqual([normal]);
      expect(notes).toEqual([]);
    });

    it("leaves other op types untouched even with a large width field", () => {
      const wideDeck = { op: "addDeck", value: { siteX: 0, siteZ: 5, width: 20, depth: 5 } };
      const { operations, notes } = normalizeOversizedWindowOps([wideDeck]);
      expect(operations).toEqual([wideDeck]);
      expect(notes).toEqual([]);
    });
  });

  it("assembles a valid design from an oversized window request instead of dropping it", () => {
    const ribbon = { op: "addWindow", value: { wall: "south", level: 0, offset: 1, width: 7.2, height: 1.6, sill: 0.8 } };
    const result = assembleGeneratedProject(output([ribbon]), [], "A small house", true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped.some((s) => s.includes("addWindow"))).toBe(false);
    expect(result.notes.some((n) => /Converted 7\.2m glazing request into \d+ panels/.test(n))).toBe(true);
    const windows = (JSON.parse(result.json) as { windows?: { wall: string; width: number }[] }).windows ?? [];
    const southWindows = windows.filter((w) => w.wall === "south");
    expect(southWindows.length).toBeGreaterThanOrEqual(2);
    for (const w of southWindows) expect(w.width).toBeLessThanOrEqual(4);
  });

  it("records per-stage timings", () => {
    const timings = createTimings();
    assembleGeneratedProject(output([]), [], "A small house", true, timings);
    const stages = Object.keys(timings.snapshot());
    for (const stage of ["validateOps", "roomNormalization", "collisionResolution", "applyPatch", "validateProject", "collisionGate"]) {
      expect(stages).toContain(stage);
    }
  });

});
