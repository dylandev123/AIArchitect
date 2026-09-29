import { describe, expect, it } from "vitest";
import { buildFloorFootprint } from "../footprint";
import { buildMassOpenings } from "../openings";

const materials = {
  exterior: { color: "#ffffff", roughness: 0.7, metalness: 0 },
  trim: { color: "#333333", roughness: 0.4, metalness: 0.1 },
  glass: { color: "#9dd9e8", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.4 },
};

describe("buildMassOpenings", () => {
  it("builds one plain solid wall box per facade when there are no openings", () => {
    const { edges } = buildFloorFootprint(10, 8, [], 0);
    const tagged = edges.filter((e) => e.facade);
    expect(tagged.length).toBe(4);
    const { primitives, warnings } = buildMassOpenings(tagged, 10, 8, [], 0, 0, 3, "wall-0", materials);
    expect(warnings).toEqual([]);
    expect(primitives.length).toBe(4);
    expect(primitives.every((p) => p.category === "wall")).toBe(true);
    // Backward compatibility with the legacy 4-wall ring: unmodified facades keep exactly these ids.
    expect(primitives.map((p) => p.id).sort()).toEqual(["wall-0-east", "wall-0-north", "wall-0-south", "wall-0-west"]);
  });

  it("carves a glazing zone into frame + glass with solid wall above/below", () => {
    const { edges } = buildFloorFootprint(10, 8, [], 0);
    const tagged = edges.filter((e) => e.facade === "south");
    const { primitives, warnings } = buildMassOpenings(tagged, 10, 8, [
      { type: "glazing-zone", facade: "south", start: 0.2, end: 0.8, heightRatio: 0.8 },
    ], 0, 0, 3, "wall-0", materials);
    expect(warnings).toEqual([]);
    expect(primitives.some((p) => p.category === "window" && p.id.endsWith("-glass"))).toBe(true);
    expect(primitives.some((p) => p.category === "window" && p.id.endsWith("-frame"))).toBe(true);
    // Side solid spans (outside 0.2..0.8) plus a below-sill and above-head solid strip.
    expect(primitives.filter((p) => p.category === "wall").length).toBeGreaterThan(2);
  });

  it("places an evenly-spaced window rhythm without overlapping", () => {
    const { edges } = buildFloorFootprint(12, 8, [], 0);
    const tagged = edges.filter((e) => e.facade === "north");
    const { primitives, warnings } = buildMassOpenings(tagged, 12, 8, [
      { type: "opening-rhythm", facade: "north", count: 3, width: 1.2, height: 1.5, sill: 0.9 },
    ], 0, 0, 3, "wall-0", materials);
    expect(warnings).toEqual([]);
    const glassPanes = primitives.filter((p) => p.category === "window" && p.id.endsWith("-glass"));
    expect(glassPanes.length).toBe(3);
  });

  it("degrades gracefully (skips + warns) when a zone falls in a recessed, untagged run", () => {
    const { edges } = buildFloorFootprint(10, 8, [{ type: "recess", facade: "south", start: 0.2, end: 0.8, depth: 1.5 }], 0);
    const tagged = edges.filter((e) => e.facade === "south");
    // Only the un-recessed side slivers (u < 0.2 and u > 0.8) remain tagged "south" — a zone requested deep
    // inside the recessed span (0.4..0.6) doesn't overlap either sliver and should be dropped, not crash.
    const { primitives } = buildMassOpenings(tagged, 10, 8, [
      { type: "glazing-zone", facade: "south", start: 0.4, end: 0.6, heightRatio: 0.8 },
    ], 0, 0, 3, "wall-0", materials);
    expect(primitives.every((p) => p.category === "wall")).toBe(true);
  });
});
