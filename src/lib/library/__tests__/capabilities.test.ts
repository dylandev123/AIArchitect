import { describe, expect, it } from "vitest";
import { designArchitecture } from "@/lib/architecture/designEngine";
import { analyzeGeneration } from "../generationLoop";
import { emptySnapshot } from "../store";
import { normalizeCapability } from "../capabilities";

describe("architectural capabilities", () => {
  it("normalizes equivalent floating-roof language into one family", () => {
    expect(normalizeCapability("floating roof")).toBe("floating-roof");
    expect(normalizeCapability("raised floating roof plane")).toBe("floating-roof");
    expect(normalizeCapability("roof with shadow gap")).toBe("floating-roof");
  });

  it("records a supported capability as a successful request without creating an artificial gap", () => {
    const snapshot = emptySnapshot();
    const result = analyzeGeneration({ json: JSON.stringify({ house: { width: 12, depth: 10, floors: 1, roof: "flat" }, site: {} }), brief: "modern villa", projectId: "p-1", library: [], retrieved: [], attached: [], capabilityRequests: [{ operation: "corner glazing", stage: "facade" }] }, snapshot, new Date("2026-02-01"), () => "report-1");
    expect(result.report.capabilityGaps).toEqual([]);
    expect(result.report.capabilitiesUsed).toMatchObject([{ id: "corner-glazing", status: "supported", stage: "facade" }]);
    expect(result.put.find((x) => x.kind === "capabilityNeed")).toBeUndefined();
  });

  it("preserves unsupported Architect intent as a structured missing capability instead of selecting a substitute", () => {
    const snapshot = emptySnapshot();
    const result = analyzeGeneration({ json: JSON.stringify({ house: { width: 12, depth: 10, floors: 1, roof: "flat" }, site: {} }), brief: "modern villa", projectId: "p-1", library: [], retrieved: [], attached: [], capabilityRequests: [{ operation: "suspended stone tower", stage: "architectural-geometry", desiredBehaviour: "A slender suspended tower over the courtyard." }] }, snapshot, new Date("2026-02-01"), () => "report-1");
    expect(result.report.capabilityGaps).toMatchObject([{ id: "unsupported-suspended-stone-tower", status: "missing", stage: "architectural-geometry" }]);
    const need = result.put.find((x) => x.kind === "capabilityNeed" && x.data.capabilityId === "unsupported-suspended-stone-tower");
    expect(need && need.kind === "capabilityNeed" ? need.data : undefined).toMatchObject({
      desiredBehaviour: "A slender suspended tower over the courtyard.",
      fallback: "Preserve the requested intent as a capability need; do not substitute unrelated geometry.",
      phrasings: ["suspended stone tower"],
    });
  });
});

describe("architectural critic", () => {
  const design = designArchitecture("A quiet modern retreat", { environment: "suburban", viewDirection: "south", approachSide: "north" });

  it("reviews a supplied architectural design and records the review on the report", () => {
    const snapshot = emptySnapshot();
    const result = analyzeGeneration({ json: JSON.stringify({ house: { width: 12, depth: 10, floors: 1, roof: "flat" }, site: {} }), brief: "A quiet modern retreat", projectId: "p-1", library: [], retrieved: [], attached: [], architecturalDesign: design }, snapshot, new Date("2026-02-01"), () => "report-1");
    expect(result.report.steps.find((s) => s.name === "architecture-review")?.ok).toBe(true);
    expect(result.report.review).toBeDefined();
    expect(result.report.review!.weaknesses).toContain("privacy");
  });

  it("raises the priority of the capability a weak review recommends, through the normal capability-need path", () => {
    const snapshot = emptySnapshot();
    const result = analyzeGeneration({ json: JSON.stringify({ house: { width: 12, depth: 10, floors: 1, roof: "flat" }, site: {} }), brief: "A quiet modern retreat", projectId: "p-1", library: [], retrieved: [], attached: [], architecturalDesign: design }, snapshot, new Date("2026-02-01"), () => "report-1");
    const gap = result.report.capabilityGaps.find((g) => g.id === "courtyard-composition");
    expect(gap?.stage).toBe("architecture-review");
    const need = result.put.find((x) => x.kind === "capabilityNeed" && x.data.id === "capability-courtyard-composition");
    expect(need).toBeDefined();
    expect(need && need.kind === "capabilityNeed" ? need.data.stages : []).toContain("architecture-review");
  });

  it("skips the review step when no architectural design is supplied, and the report still succeeds", () => {
    const snapshot = emptySnapshot();
    const result = analyzeGeneration({ json: JSON.stringify({ house: { width: 12, depth: 10, floors: 1, roof: "flat" }, site: {} }), brief: "A quiet modern retreat", projectId: "p-1", library: [], retrieved: [], attached: [] }, snapshot, new Date("2026-02-01"), () => "report-1");
    expect(result.report.review).toBeUndefined();
    expect(result.report.steps.find((s) => s.name === "architecture-review")?.ok).toBe(true);
  });
});
