import { describe, expect, it } from "vitest";
import { architecturalAssetRequests, createSpacePlan, deriveArchitecturalIntent, designArchitecture, selectDesignStrategies } from "../designEngine";

describe("architectural design engine", () => {
  it("creates a structured tropical concept before geometry and requests reusable components", () => {
    const design = designArchitecture("A luxury Caribbean waterfront home with a pool", {
      environment: "beach", viewDirection: "south", approachSide: "north", scale: "luxury",
    });
    expect(design.concept.name).toBe("Minimal Caribbean Villa");
    expect(design.pipeline).toContain("roof-composition");
    expect(design.masses.map((m) => m.role)).toEqual(expect.arrayContaining(["main-living", "private-wing", "pavilion"]));
    expect(design.roofComposition.primary).toBe("hip");
    expect(architecturalAssetRequests(design, "project-1")).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "architectural-component", text: "6m Sliding Glass Door" }),
    ]));
  });

  it("changes the massing and roof strategy for a hillside brief", () => {
    const design = designArchitecture("A contemporary hillside residence with sunset views", {
      environment: "hillside", viewDirection: "west", approachSide: "east", scale: "estate",
    });
    expect(design.concept.name).toBe("Contemporary Hillside Residence");
    expect(design.roofComposition.primary).toBe("shed");
    expect(design.siteAnalysis.terrainResponse).toMatch(/Step masses/);
  });

  it("plans intent, strategies and relationships before massing with controlled alternatives", () => {
    const site = { environment: "beach" as const, viewDirection: "south" as const, approachSide: "north" as const, scale: "estate" as const };
    const intent = deriveArchitecturalIntent("A private tropical ocean villa for entertaining", site);
    const first = selectDesignStrategies(intent, [], [], "project-a");
    const second = selectDesignStrategies(intent, [], [], "project-b");
    const plan = createSpacePlan(intent, first);
    expect(intent.spatialGoals).toEqual(expect.arrayContaining(["privacy", "views", "grand-entertaining"]));
    expect(plan.relationships).toEqual(expect.arrayContaining([expect.objectContaining({ from: "garage", to: "pool", relationship: "separated" })]));
    expect(first.map((strategy) => strategy.name)).not.toEqual([]);
    expect(second.map((strategy) => strategy.name)).not.toEqual([]);
    expect(plan.massAssignments.find((mass) => mass.role === "private-wing")?.zones).toContain("master-suite");
  });
});
