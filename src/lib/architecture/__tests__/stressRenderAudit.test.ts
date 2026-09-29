import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { buildFloorFootprint } from "../geometry/footprint";
import { compileArchitecture } from "../compiler";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { primitiveBounds, primitiveSignature } from "../renderAudit";

describe("Geometry Stress Test deterministic render audit", () => {
  it("proves the articulated main mass survives document → footprint → compiler", () => {
    const doc = ARCHITECTURE_FIXTURES.architectureCompilerStressFixture;
    const main = doc.massing.masses.find((mass) => mass.id === "main")!;
    const ground = buildFloorFootprint(main.width, main.depth, main.operations ?? [], 0);
    const upper = buildFloorFootprint(main.width, main.depth, main.operations ?? [], 1);
    const { model, errors } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
    const primitives = model.primitives.filter((p) => p.id.startsWith("architecture-main-"));
    const categories = Object.fromEntries([...new Set(primitives.map((p) => p.category))].map((category) => [category, primitives.filter((p) => p.category === category).length]));
    const ratios = (main.operations ?? []).map((op) => {
      if (op.type === "notch") return { type: op.type, widthPct: op.width / main.width * 100, depthPct: op.depth / main.depth * 100, floors: op.floors ?? "all" };
      if (op.type === "chamfer") return { type: op.type, widthPct: op.size / main.width * 100, depthPct: op.size / main.depth * 100, floors: op.floors ?? "all" };
      const facadeWidth = op.facade === "north" || op.facade === "south" ? main.width : main.depth;
      const width = op.type === "entry-recess" ? op.width : (op.end - op.start) * facadeWidth;
      return { type: op.type, widthPct: width / facadeWidth * 100, depthPct: op.depth / main.depth * 100, floors: op.floors ?? "all" };
    });
    console.info("[STRESS RENDER AUDIT]", JSON.stringify({
      document: { width: main.width, depth: main.depth, floors: main.floors, operations: main.operations },
      footprint: { ground: { polygon: ground.polygon, rects: ground.rects }, upper: { polygon: upper.polygon, rects: upper.rects } },
      compiler: { count: primitives.length, categories, bounds: primitiveBounds(primitives), signatures: primitives.map(primitiveSignature) },
      scale: ratios,
    }));
    expect(errors).toEqual([]);
    expect(ground.polygon).not.toEqual(upper.polygon);
    expect(ground.rects).not.toEqual(upper.rects);
    expect(primitives.some((p) => p.id.includes("floor-0"))).toBe(true);
    expect(primitives.some((p) => p.id.includes("floor-1"))).toBe(true);
    expect(primitives.some((p) => p.category === "roof")).toBe(true);
    expect(primitives.some((p) => p.category === "window")).toBe(true);
  });
});
