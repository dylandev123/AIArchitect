import { describe, expect, it } from "vitest";
import { ingestV3GenerationOutput } from "../ingestion";
import { compileV3Scene } from "../scene";
import { executeV3SceneOperations } from "../operations";
import { v3CompositionSchema, type V3Composition } from "../composition";
import { validateV3Scene } from "../validation";

const composition: V3Composition = {
  openings: [
    { id: "entry", type: "door", facade: "north", start: .4, end: .6, floors: "ground", height: 2.4 },
    { id: "view", type: "glazing-zone", facade: "south", start: .1, end: .9, heightRatio: .8, reveal: .12 },
    { id: "bedrooms", type: "opening-rhythm", facade: "east", count: 3, width: 1.2, height: 1.5, sill: .9 },
  ],
  assemblies: [{ id: "balcony", intent: "shaded upper balcony", parts: [
    { id: "deck", type: "slab", facade: "south", start: .1, end: .9, depth: 2, level: 1, thickness: .2 },
    { id: "rail", type: "railing", slabId: "deck", edges: ["outer", "start", "end"], height: 1.1 },
    { id: "post", type: "post", facade: "south", at: .1, depth: 2, height: 3, level: 0 },
    { id: "shade", type: "beam", facade: "south", start: .1, end: .9, depth: 2, height: .2, level: 2 },
  ] }],
};
const raw = () => ({ version: 3, site: { width: 80, depth: 80 }, relationships: [], objects: [{
  id: "main-house", type: "building-mass", semanticRole: "living pavilion", label: "Main House",
  architecture: { x: 4, z: 7, baseElevation: 0, width: 12, depth: 9, height: 6, rotationY: .4 },
  material: { id: "stone", color: "#c7bca9" }, levels: 2, composition,
}] });
const scene = () => ingestV3GenerationOutput(raw()).scene;

describe("shared construction inside V3", () => {
  it("ingests and persists semantic composition without a V2 document or baked children", () => {
    const prepared = ingestV3GenerationOutput(raw());
    expect(prepared.validation.ok).toBe(true);
    expect(prepared.scene.objects[0].composition).toEqual(composition);
    const loaded = JSON.parse(JSON.stringify(prepared.scene));
    expect(loaded.objects).toHaveLength(1);
    expect(compileV3Scene(loaded)).toEqual(compileV3Scene(prepared.scene));
    expect(JSON.stringify(loaded)).not.toContain("sourceObjectId");
  });
  it("compiles openings, opaque walls, balcony rails and shading with source selection", () => {
    const model = compileV3Scene(scene());
    const parts = model.primitives.filter(p => p.id.includes("-composition-") || p.id.startsWith("main-house:"));
    expect(parts.length).toBeGreaterThan(30);
    expect(parts.every(p => p.sourceObjectId === "main-house")).toBe(true);
    expect(parts.some(p => p.componentRole === "assembly railing")).toBe(true);
    expect(parts.some(p => p.componentRole === "assembly beam")).toBe(true);
    expect(parts.some(p => p.id.includes("door"))).toBe(true);
    expect(parts.some(p => p.id.includes("west") && p.componentRole === "facade wall")).toBe(true);
    expect(parts.every(p => p.kind === "box" && p.size.every(v => v > 0 && Number.isFinite(v)))).toBe(true);
  });
  it("recompiles from edited geometry and material without changing authored opening identity", () => {
    const before = scene();
    const changed = executeV3SceneOperations(before, { intent: "Move and widen pavilion", operations: [
      { op: "editArchitecture", target: "main-house", architecture: { x: 14, width: 18, rotationY: .8 } },
      { op: "changeMaterial", target: "main-house", material: { id: "brick", color: "#a15641" } },
    ] });
    expect(changed.ok, changed.errors.join("\n")).toBe(true);
    expect(changed.scene.objects[0].composition).toEqual(composition);
    expect(compileV3Scene(changed.scene)).not.toEqual(compileV3Scene(before));
    expect(compileV3Scene(changed.scene).primitives.some(p => p.componentRole === "facade wall" && p.color === "#a15641")).toBe(true);
    expect(before.objects[0].architecture?.width).toBe(12);
  });
  it("edits and clears composition atomically; duplicate keeps locally scoped assembly ids", () => {
    const before = scene();
    const changed = executeV3SceneOperations(before, { intent: "Change facade", operations: [{ op: "setComposition", target: "main-house", composition: { openings: [] } }] });
    expect(changed.ok).toBe(true);
    expect(compileV3Scene(changed.scene).primitives.some(p => p.componentRole === "facade glazing")).toBe(false);
    const cleared = executeV3SceneOperations(before, { intent: "Restore presets", operations: [{ op: "setComposition", target: "main-house", composition: {} }] });
    expect(cleared.ok).toBe(true);
    expect(compileV3Scene(cleared.scene).primitives.some(p => p.componentRole === "facade glazing")).toBe(true);
    const duplicate = executeV3SceneOperations(before, { intent: "Copy wing", operations: [{ op: "duplicate", target: "main-house", id: "guest-house", position: [25,3,7] }] });
    expect(duplicate.ok).toBe(true);
    const ids = compileV3Scene(duplicate.scene).primitives.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const bad = executeV3SceneOperations(before, { intent: "Invalid change", operations: [{ op: "setComposition", target: "main-house", composition: { assemblies: [{ id: "bad", intent: "bad rail", parts: [{ id: "rail", type: "railing", slabId: "missing", edges: ["outer"], height: 1 }] }] } }] });
    expect(bad.ok).toBe(false);
    expect(bad.scene).toEqual(before);
  });
  it("falls back on malformed generation while rejecting malformed persisted composition", () => {
    const input = raw();
    (input.objects[0] as unknown as { composition: unknown }).composition = { openings: [{ type: "bogus" }] };
    const result = ingestV3GenerationOutput(input);
    expect(result.validation.ok).toBe(true);
    expect(result.notes.some(n => n.code === "COMPOSITION_FALLBACK")).toBe(true);
    expect(compileV3Scene(result.scene).primitives.some(p => p.componentRole === "facade glazing")).toBe(true);
    const persisted = scene();
    (persisted.objects[0] as unknown as { composition: unknown }).composition = { openings: "bad" };
    expect(validateV3Scene(persisted, { lenient: true }).ok).toBe(false);
    expect(v3CompositionSchema.safeParse({ openings: [composition.openings![0], composition.openings![0]] }).success).toBe(false);
  });
});
