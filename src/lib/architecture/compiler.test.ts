import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { capabilityRegistry } from "@/lib/capabilities/registry";
import { compileArchitecture, projectArchitectureToLegacy } from "./compiler";
import { ARCHITECTURE_FIXTURES } from "./fixtures";
import type { ArchitecturalDesignDocument } from "./document";

const pending = { status: "pending" as const };
const baseDoc = (overrides: Partial<ArchitecturalDesignDocument> = {}): ArchitecturalDesignDocument => ({
  version: 1, brief: "test", siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" },
  massing: { composition: "rectangular-pavilion", masses: [] }, roofs: { recipes: [] },
  facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
  metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
  ...overrides,
});

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

  it("offsets upper-floor primitives of a cantilevered mass, leaving the ground floor in place", () => {
    const doc = baseDoc({ massing: { composition: "rectangular-pavilion", masses: [
      { id: "tower", name: "Tower", role: "main-living", position: { x: 0, z: 0 }, width: 8, depth: 8, floors: 2, elevation: 0, rotation: 0, cantilever: { direction: "east", distance: 2 } },
    ] } });
    const { model } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" });
    const boxes = model.primitives.filter((p): p is Extract<typeof p, { kind: "box" }> => p.kind === "box" && !p.id.endsWith("-debug-footprint"));
    const groundX = boxes.filter((p) => p.position[1] < 3).map((p) => p.position[0]);
    const upperX = boxes.filter((p) => p.position[1] >= 3).map((p) => p.position[0]);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(upperX.length).toBeGreaterThan(0);
    expect(groundX.length).toBeGreaterThan(0);
    expect(mean(upperX) - mean(groundX)).toBeCloseTo(2, 5);
  });

  it("strips primitive ids a capability requests removed before adding its own geometry", () => {
    capabilityRegistry.register({
      metadata: { id: "test-compiler-remove-stub", name: "Test Remove Stub", category: "massing", version: 1, status: "supported", description: "test", parameters: [{ key: "massId", required: true }], constraints: [], visualImpact: 1, implementationDifficulty: 1, performanceCost: 1, architecturalImportance: 1, fallback: "none", implementationNotes: "test" },
      implementation: { apply: ({ primitives }) => ({ primitives: [], remove: [primitives[0]?.id].filter((id): id is string => Boolean(id)) }) },
    });
    const doc = baseDoc({
      massing: { composition: "rectangular-pavilion", masses: [{ id: "living", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 10, depth: 8, floors: 1, elevation: 0, rotation: 0 }] },
      capabilities: [{ id: "test-compiler-remove-stub", stage: "test", parameters: { massId: "living" } }],
    });
    const before = compileArchitecture({ ...doc, capabilities: [] }, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" });
    const after = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG, mode: "massing-only" });
    expect(after.model.primitives.length).toBe(before.model.primitives.length - 1);
    expect(after.model.primitives.some((p) => p.id === before.model.primitives[0].id)).toBe(false);
  });

  it("resolves a second mass through allMasses so bridge-masses can span two masses", () => {
    const doc = baseDoc({
      massing: { composition: "rectangular-pavilion", masses: [
        { id: "living", name: "Living", role: "main-living", position: { x: 0, z: 0 }, width: 10, depth: 8, floors: 1, elevation: 0, rotation: 0 },
        { id: "guest", name: "Guest", role: "guest-pavilion", position: { x: 20, z: 0 }, width: 6, depth: 6, floors: 1, elevation: 0, rotation: 0 },
      ] },
      capabilities: [{ id: "bridge-masses", stage: "mass-expansion", parameters: { massId: "living", secondaryMassId: "guest" } }],
    });
    const { model, diagnostics } = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG });
    expect(diagnostics?.capabilities.find((c) => c.id === "bridge-masses")?.status).toBe("applied");
    expect(model.primitives.some((p) => p.id.includes("bridge-masses-living-guest"))).toBe(true);
  });
});
