import { describe, expect, it } from "vitest";
import { designArchitecture } from "./designEngine";
import { buildArchitecturalDesignDocument } from "./bridge";
import { validateArchitecturalDesignDocument } from "./document";

const massRole = (doc: ReturnType<typeof buildArchitecturalDesignDocument>, role: string) =>
  doc.massing.masses.find((m) => m.role === role);
const roofKindFor = (doc: ReturnType<typeof buildArchitecturalDesignDocument>, massId: string) =>
  doc.roofs.recipes.find((r) => r.massId === massId)?.kind;

describe("ArchitecturalDesign -> ArchitecturalDesignDocument bridge", () => {
  it("builds a stepped-hillside composition with real elevation deltas", () => {
    const brief = "A dramatic hillside residence stepping down the slope with framed sunset views.";
    const design = designArchitecture(brief, { environment: "hillside", viewDirection: "south", approachSide: "north" });
    expect(design.strategies.some((s) => s.name === "Stepped Hillside")).toBe(true);

    const doc = buildArchitecturalDesignDocument(design, brief);
    expect(validateArchitecturalDesignDocument(doc)).toEqual([]);
    expect(doc.massing.composition).toBe("stepped-terraces");
    expect(doc.siteStrategy.terrain).toBe("stepped");
    const bedroomWing = massRole(doc, "bedroom-wing");
    expect(bedroomWing?.elevation).toBeGreaterThan(0);
    expect(bedroomWing?.relationships?.some((r) => r.kind === "stepped-above")).toBe(true);
  });

  it("builds a linear view-bar composition with a level site", () => {
    const brief = "A contemporary view-facing residence overlooking the ocean sunset, with open entertaining for family gatherings.";
    const design = designArchitecture(brief, { environment: "beach", viewDirection: "south", approachSide: "north" });
    expect(design.strategies.some((s) => s.name === "Linear View Bar")).toBe(true);

    const doc = buildArchitecturalDesignDocument(design, brief);
    expect(validateArchitecturalDesignDocument(doc)).toEqual([]);
    expect(doc.massing.composition).toBe("rectangular-pavilion");
    expect(doc.siteStrategy.terrain).toBe("level");
  });

  it("builds a default pavilion/offset composition for a plain brief", () => {
    const brief = "A modern residence with a simple contemporary layout.";
    const design = designArchitecture(brief, { environment: "suburban", viewDirection: "south", approachSide: "north" });
    const doc = buildArchitecturalDesignDocument(design, brief);
    expect(validateArchitecturalDesignDocument(doc)).toEqual([]);
    expect(["pavilion-cluster", "rotated-wings"]).toContain(doc.massing.composition);
  });

  it("varies roof recipes by mass role and never double-applies deep-overhang", () => {
    const brief = "A resort-style tropical retreat with sheltered outdoor living.";
    const design = designArchitecture(brief, { environment: "beach", viewDirection: "south", approachSide: "north" });
    const doc = buildArchitecturalDesignDocument(design, brief);

    expect(roofKindFor(doc, "living-pavilion")).toBe("floating-flat");
    expect(roofKindFor(doc, "private-wing")).toBe("mono-pitch");
    expect(roofKindFor(doc, "service-spine")).toBe("flat");
    expect(new Set(doc.roofs.recipes.map((r) => r.kind)).size).toBeGreaterThan(1);

    expect(doc.capabilities?.some((c) => c.id === "deep-overhang")).toBe(false);
    expect(doc.capabilities?.some((c) => c.id === "corner-glazing")).toBe(true);
    expect(doc.metadata.source).toBe("live-generation");
  });
});
