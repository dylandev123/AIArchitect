import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { buildArchitectEditContext, buildArchitectRepairContext, classifyArchitectEditContext, createArchitectEditUsage, recordArchitectEditUsage } from "../architectEditContext";
import type { SitePlan } from "../sitePlanContract";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";

const sitePlan: SitePlan = {
  entrance: { wall: "north", offset: 4 }, driveway: { wall: "north", offset: 1, width: 4, length: 12 }, parking: [{ x: 0, z: -16, width: 6, depth: 6 }],
  pool: { wall: "south", offset: 2, distance: 8, width: 8, depth: 4, waterDepth: 1.4 }, terrace: { wall: "south", offset: 2, width: 10, depth: 5 }, poolDeck: { x: 0, z: 15, width: 12, depth: 7 }, paths: [], landscape: [],
};
const assets: OutdoorAssetPlacement[] = [
  { id: "table-a", assetId: "table", parentSpaceId: "terrace", category: "furniture", role: "table", position: [0, 0, 9], rotation: [0, 0, 0], scale: 1, dimensions: { width: 2, height: 1, depth: 1 }, group: { id: "dining", anchor: [0, 0, 9], rotation: [0, 0, 0], localPosition: [0, 0, 0], localRotation: [0, 0, 0], localScale: 1, role: "dining group" } },
  { id: "chair-a", assetId: "chair", parentSpaceId: "terrace", category: "furniture", role: "chair", position: [2, 0, 9], rotation: [0, 0, 0], scale: 1, dimensions: { width: 1, height: 1, depth: 1 }, group: { id: "dining", anchor: [0, 0, 9], rotation: [0, 0, 0], localPosition: [2, 0, 0], localRotation: [0, 0, 0], localScale: 1, role: "dining group" } },
  { id: "distant", assetId: "bench", parentSpaceId: "garden", category: "furniture", role: "bench", position: [120, 0, 120], rotation: [0, 0, 0], scale: 1, dimensions: { width: 2, height: 1, depth: 1 } },
];

const context = (request: string, selectedTargetIds?: string[]) => buildArchitectEditContext({ document: structuredClone(ARCHITECTURE_FIXTURES.cantileverHouse), sitePlan: structuredClone(sitePlan), outdoorAssetPlacements: structuredClone(assets), request, selectedTargetIds });

describe("Architect edit context retrieval", () => {
  it("uses local-object context for a selected asset delete and never includes a document", () => {
    const result = context("delete this", ["asset:table-a"]);
    expect(result.contextTier).toBe("local-object");
    expect(result.targets.map((target) => target.id)).toContain("asset:table-a");
    expect(result.dependencies.map((target) => target.id)).toContain("asset-group:dining");
    expect(result.diagnostics.fullDocumentIncluded).toBe(false);
    expect(JSON.stringify(result)).not.toContain('"brief":"Cantilever House"');
  });

  it("keeps group members and local neighbours but excludes distant unrelated assets", () => {
    const result = context("remove the table", ["asset-group:dining"]);
    const ids = JSON.stringify(result);
    expect(ids).toContain("asset:chair-a");
    expect(ids).not.toContain("asset:distant");
  });

  it("uses local architectural context by default and reserves full context for global change intent", () => {
    expect(classifyArchitectEditContext("redesign the rear elevation")).toBe("local-architecture");
    expect(classifyArchitectEditContext("rethink the entire house")).toBe("global-architecture");
    expect(context("redesign the rear elevation").diagnostics.fullDocumentIncluded).toBe(false);
    expect(context("rethink the entire house").diagnostics.fullDocumentIncluded).toBe(true);
  });

  it("trims neighbours to budget, preserves direct targets, and makes repair context smaller", () => {
    const result = context("move the table two metres", ["asset:table-a"]);
    expect(result.diagnostics.contextChars).toBeLessThanOrEqual(9_000);
    expect(result.targets.map((target) => target.id)).toContain("asset:table-a");
    const repair = buildArchitectRepairContext(result, ["asset:table-a"], { errors: [{ code: "COLLISION" }] }, { intent: "move", operations: [] });
    expect(repair.diagnostics.contextChars).toBeLessThan(result.diagnostics.contextChars);
    expect(repair.diagnostics.fullDocumentIncluded).toBe(false);
  });

  it("aggregates one to three mocked provider attempts without provider usage", () => {
    const usage = createArchitectEditUsage("local-object");
    recordArchitectEditUsage(usage, 1, { inputTokens: 100, outputTokens: 20, totalTokens: 120 });
    recordArchitectEditUsage(usage, 2, { inputTokens: 50, outputTokens: 10, totalTokens: 60 });
    recordArchitectEditUsage(usage, 3, { inputTokens: 25, outputTokens: 5, totalTokens: 30 });
    expect(usage).toMatchObject({ architectAttempts: 3, inputTokensTotal: 175, outputTokensTotal: 35, totalTokens: 210, repaired: true });
  });
});
