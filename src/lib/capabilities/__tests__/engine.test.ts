import { describe, expect, it } from "vitest";
import "../plugins";
import { capabilityRegistry } from "../registry";
import { requestCapability } from "../engine";

const mass = { id: "living", name: "Living", role: "main-living" as const, width: 12, depth: 9, floors: 1, elevation: 0, position: { x: 0, z: 0 }, rotation: 0 };
const guest = { id: "guest", name: "Guest", role: "guest-pavilion" as const, width: 7, depth: 7, floors: 1, elevation: 0, position: { x: 20, z: 0 }, rotation: 0 };

describe("capability engine", () => {
  it("discovers the corner-glazing plugin and applies its geometry through the generic lifecycle", () => {
    const result = requestCapability({ id: "corner-glazing", stage: "facade", parameters: { massId: "living" } }, { primitives: [], target: mass });
    expect(result.status).toBe("applied");
    expect(result.primitives.map((p) => p.id)).toEqual(expect.arrayContaining(["capability-corner-glazing-living-east-glass", "capability-corner-glazing-living-south-glass"]));
  });

  it("never fails generation when a capability cannot be applied", () => {
    const result = requestCapability({ id: "corner-glazing", stage: "facade", parameters: {} }, { primitives: [] });
    expect(result.status).toBe("fallback");
    expect(result.primitives).toEqual([]);
    expect(result.fallback).toMatch(/adjacent windows/i);
  });

  it("registers roof-expression capabilities and preserves safe fallback on an unsupported target", () => {
    const applied = requestCapability({ id: "clerestory-roof", stage: "roof-composition", parameters: { massId: "living", overhang: 1.8 } }, { primitives: [], target: mass });
    expect(applied.status).toBe("applied");
    expect(applied.primitives.map((p) => p.id)).toEqual(expect.arrayContaining(["capability-clerestory-roof-living-plane", "capability-clerestory-roof-living-clerestory-band"]));
    const fallback = requestCapability({ id: "floating-roof", stage: "roof-composition", parameters: {} }, { primitives: [] });
    expect(fallback.status).toBe("fallback");
  });

  it("bridges two resolved masses through the bridge-masses plugin", () => {
    const result = requestCapability(
      { id: "bridge-masses", stage: "mass-expansion", parameters: { massId: "living", secondaryMassId: "guest" } },
      { primitives: [], target: mass, allMasses: [mass, guest] }
    );
    expect(result.status).toBe("applied");
    expect(result.primitives.map((p) => p.id)).toEqual(expect.arrayContaining(["capability-bridge-masses-living-guest-deck", "capability-bridge-masses-living-guest-roof"]));
  });

  it("falls back safely when bridge-masses is missing its secondary mass id", () => {
    const result = requestCapability({ id: "bridge-masses", stage: "mass-expansion", parameters: { massId: "living" } }, { primitives: [], target: mass, allMasses: [mass] });
    expect(result.status).toBe("fallback");
    expect(result.primitives).toEqual([]);
  });

  it("propagates a plugin's requested primitive removals onto the outcome", () => {
    capabilityRegistry.register({
      metadata: { id: "test-remove-stub", name: "Test Remove Stub", category: "massing", version: 1, status: "supported", description: "test", parameters: [], constraints: [], visualImpact: 1, implementationDifficulty: 1, performanceCost: 1, architecturalImportance: 1, fallback: "none", implementationNotes: "test" },
      implementation: { apply: () => ({ primitives: [], remove: ["some-old-primitive"] }) },
    });
    const result = requestCapability({ id: "test-remove-stub", stage: "test", parameters: {} }, { primitives: [] });
    expect(result.status).toBe("applied");
    expect(result.remove).toEqual(["some-old-primitive"]);
  });
});
