import { describe, expect, it } from "vitest";
import "../plugins";
import { requestCapability } from "../engine";

const mass = { id: "living", width: 12, depth: 9, floors: 1, elevation: 0, position: { x: 0, z: 0 }, rotation: 0 };

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
});
