import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { ArchitecturalDesignDocument, MassVolume, RoofRecipe } from "../../document";
import { withVolumePlan } from "../../volumePlan";
import { compileArchitecture } from "../../compiler";
import * as roofStage from "../roofStage";
import { normalizeRoofOrientation } from "../roofStage";
import * as roofLibrary from "../../roofRecipeLibrary";
import { appliedRoofRecipe, roofRecipeCompatibility } from "../../roofRecipeLibrary";
import { roofConflicts } from "../integrityChecks";
import { authoredRoof } from "../../__tests__/authoredFixtures";
import type { DesignRecipe } from "@/types/library";

const mass = (plan: Record<string, unknown>, size: [number, number] = [14, 9], extra: Partial<MassVolume> = {}): MassVolume =>
  withVolumePlan({ id: "m", name: "M", role: "main-living", position: { x: 0, z: 0 }, width: size[0], depth: size[1], floors: 1, elevation: 0, rotation: 0, ...extra }, plan);

const pending = { status: "pending" as const };
function compiledRoofExtent(m: MassVolume, recipe: RoofRecipe): { maxX: number; maxZ: number } {
  const doc: ArchitecturalDesignDocument = {
    version: 1, brief: "t", siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" },
    massing: { composition: "rectangular-pavilion", masses: [m] }, roofs: { recipes: [recipe] },
    facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
  };
  const roof = compileArchitecture(doc, { materials: DEFAULT_MATERIALS_CONFIG }).model.primitives.filter((p) => p.category === "roof");
  const xs = roof.flatMap((p) => (p.kind === "triMesh" ? p.vertices.filter((_, i) => i % 3 === 0) : [p.position[0] + p.size[0] / 2]));
  const zs = roof.flatMap((p) => (p.kind === "triMesh" ? p.vertices.filter((_, i) => i % 3 === 2) : [p.position[2] + p.size[2] / 2]));
  return { maxX: Math.max(...xs), maxZ: Math.max(...zs) };
}

describe("roof edge intent → roof recipe", () => {
  it("normalizes a complete authored roof rotation instead of rejecting its periodic equivalent", () => {
    expect(normalizeRoofOrientation(2 * Math.PI + Math.PI / 3)).toBeCloseTo(Math.PI / 3);
    expect(normalizeRoofOrientation(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });

  it("has no deterministic roof author: no role/edge-derived recipe and no fallback roofs exist", () => {
    expect(roofStage).not.toHaveProperty("roofForMass");
    expect(roofStage).not.toHaveProperty("fallbackRoofs");
    expect(roofLibrary).not.toHaveProperty("parameterizeRoofsFromLibrary");
  });

  it("compiles a shed with exactly the overhang its recipe authors", () => {
    const shed = mass({ roofEdge: "thin-eave" }, [10, 8]);
    for (const overhang of [0.35, 1.3]) {
      const recipe = authoredRoof("m", { kind: "shed", overhang, pitch: 12 });
      expect(compiledRoofExtent(shed, recipe).maxX).toBeCloseTo(5 + overhang);
      expect(compiledRoofExtent(shed, recipe).maxZ).toBeCloseTo(4 + overhang);
    }
  });

  it("reports a ridged roof on a chamfered prow as repair-required instead of silently swapping its family", () => {
    const prow = mass({ roofEdge: "deep-eave" }, [14, 9], { operations: [{ type: "chamfer", corner: "se", size: 3 }] });
    for (const kind of ["gable", "hip"] as const) {
      expect(roofConflicts([prow], [authoredRoof("m", { kind, pitch: 22 })])).toEqual([expect.objectContaining({ stage: "roof-composition", code: "roof-unbuildable", massId: "m" })]);
    }
    expect(roofConflicts([prow], [authoredRoof("m", { kind: "floating-flat" })])).toEqual([]);
    expect(roofConflicts([mass({ roofEdge: "deep-eave" })], [authoredRoof("m", { kind: "gable", pitch: 22 })])).toEqual([]);
  });
});

const libraryRoof = (parameters: DesignRecipe["parameters"]): DesignRecipe => ({
  id: "roof-seam", name: "Tropical Seam Roof", category: "roof", styleTags: ["tropical"], compatibleScales: [], environmentTags: [], parameters,
  relationships: [], guidance: ["Procedural V2 planes only."], usageCount: 0, successCount: 0, failureCount: 0, approval: "approved", version: 1,
  created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
});

describe("approved Roof Recipe integration", () => {
  it("records the cited recipe's roof system (and its parameters as provenance) without touching any roof", () => {
    const recipe = libraryRoof([{ key: "roof-system", value: "standing-seam" }, { key: "pitch", value: 18 }, { key: "overhang", value: 1.1 }]);
    const applied = appliedRoofRecipe(recipe)!;
    expect(applied).toMatchObject({ system: { primary: "standing-seam" }, libraryRecipe: { id: "roof-seam", status: "applied", parameters: { pitch: 18, overhang: 1.1 } } });
    expect(Object.keys(applied)).toEqual(["system", "libraryRecipe"]);
  });

  it("rejects a hip/gable library recipe for an L-shaped mass until valley geometry exists", () => {
    const recipe = libraryRoof([{ key: "system", value: "tile-shingle" }, { key: "kind", value: "hip" }]);
    expect(roofRecipeCompatibility(recipe, [mass({ form: "l-shape", roofEdge: "deep-eave" })])).toMatch(/valley geometry/);
    expect(roofRecipeCompatibility(recipe, [mass({ form: "bar", roofEdge: "deep-eave" })])).toBeUndefined();
  });
});
