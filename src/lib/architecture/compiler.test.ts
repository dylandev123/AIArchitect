import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { compileArchitecture, projectArchitectureToLegacy } from "./compiler";
import { ARCHITECTURE_FIXTURES } from "./fixtures";

describe("procedural architecture compiler", () => {
  it("compiles each deterministic fixture into multiple intentional masses and roofs", () => {
    for (const doc of Object.values(ARCHITECTURE_FIXTURES)) {
      const result = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
      expect(result.errors).toEqual([]);
      expect(new Set(result.model.primitives.map((p) => p.id.split("-").slice(0, 3).join("-"))).size).toBeGreaterThan(1);
      expect(result.model.primitives.filter((p) => p.category === "roof").length).toBeGreaterThan(0);
    }
  });

  it("keeps mass-only and roofs-only diagnostics isolated", () => {
    const doc = ARCHITECTURE_FIXTURES.modernTropicalCourtyardVilla;
    expect(compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" }).model.primitives.some((p) => p.category === "roof")).toBe(false);
    expect(compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG, mode: "roofs-only" }).model.primitives.every((p) => p.category === "roof")).toBe(true);
  });

  it("projects a safe primary-mass legacy shell without flattening the document", () => {
    const legacy = projectArchitectureToLegacy(ARCHITECTURE_FIXTURES.contemporaryHillsideHouse);
    expect((legacy.house as { roof: string }).roof).toBe("flat");
    expect(legacy.architectureDocument).toBe(ARCHITECTURE_FIXTURES.contemporaryHillsideHouse);
  });
});
