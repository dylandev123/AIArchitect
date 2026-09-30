import { describe, expect, it } from "vitest";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import type { ArchitecturalIntent } from "../../designEngine";
import type { ArchitecturalDesignDocument, MassVolume, RoofRecipe } from "../../document";
import { withVolumePlan } from "../../volumePlan";
import { compileArchitecture } from "../../compiler";
import { normalizeRoofOrientation, roofForMass } from "../roofStage";
import { appliedRoofRecipe, parameterizeRoofsFromLibrary, roofRecipeCompatibility } from "../../roofRecipeLibrary";
import type { DesignRecipe } from "@/types/library";

const intent = (shelter: boolean): ArchitecturalIntent => ({
  mood: ["calm"], spatialGoals: ["views"], environmentalGoals: shelter ? ["shelter"] : ["daylight"], hierarchyGoals: ["living dominates"],
  compositionBias: "asymmetrical", source: { environment: "suburban", scale: undefined, viewDirection: "south", arrivalDirection: "north", style: "contemporary" },
});
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

  it("keeps a floating roof's overhang proportioned to its volume, even with a shelter goal", () => {
    // Previously max(base, 1.1) + 0.5 → a 1.6m cantilevered lid on a 9m-deep pavilion.
    const big = roofForMass(mass({ roofEdge: "floating", hierarchy: "dominant" }), "flat", intent(true));
    expect(big.kind).toBe("floating-flat");
    expect(big.overhang!).toBeLessThanOrEqual(0.12 * 9 + 1e-9);
    expect(big.overhang!).toBeGreaterThanOrEqual(0.45);
    const small = roofForMass(mass({ roofEdge: "floating" }, [6, 5]), "flat", intent(false));
    expect(small.overhang!).toBeLessThanOrEqual(0.6);
    // A floating edge never reaches deep-eave depth.
    const deep = roofForMass(mass({ roofEdge: "deep-eave", hierarchy: "dominant" }), "flat", intent(true));
    expect(big.overhang!).toBeLessThan(deep.overhang!);
  });

  it("builds a thin-eave shed with a thin eave and a deep-eave shed with a deep one", () => {
    const thinMass = mass({ roofEdge: "thin-eave", hierarchy: "supporting" }, [10, 8]);
    const deepMass = mass({ roofEdge: "deep-eave", hierarchy: "dominant" }, [10, 8]);
    const thin = roofForMass(thinMass, "shed", intent(false));
    const deep = roofForMass(deepMass, "shed", intent(false));
    expect(thin).toMatchObject({ kind: "shed" });
    expect(thin.overhang!).toBeLessThanOrEqual(0.4);
    expect(deep.overhang!).toBeGreaterThanOrEqual(1.2);
    // The compiled shed actually uses the planned overhang (it used to ignore it for a fixed 0.6m).
    expect(compiledRoofExtent(thinMass, thin).maxX).toBeCloseTo(5 + thin.overhang!);
    expect(compiledRoofExtent(thinMass, thin).maxZ).toBeCloseTo(4 + thin.overhang!);
    expect(compiledRoofExtent(deepMass, deep).maxX).toBeCloseTo(5 + deep.overhang!);
  });

  it("gives a chamfered prow volume a roof family that can follow its angled corner", () => {
    const prow = mass({ roofEdge: "deep-eave" }, [14, 9], { operations: [{ type: "chamfer", corner: "se", size: 3 }] });
    expect(roofForMass(prow, "gable", intent(false)).kind).toBe("shed");
    expect(roofForMass(prow, "hip", intent(false)).kind).toBe("shed");
    expect(roofForMass(prow, "floating-flat", intent(false)).kind).toBe("floating-flat");
    // A plain bar keeps whatever family was chosen.
    expect(roofForMass(mass({ roofEdge: "deep-eave" }), "gable", intent(false)).kind).toBe("gable");
  });
});

const libraryRoof = (parameters: DesignRecipe["parameters"]): DesignRecipe => ({
  id: "roof-seam", name: "Tropical Seam Roof", category: "roof", styleTags: ["tropical"], compatibleScales: [], environmentTags: [], parameters,
  relationships: [], guidance: ["Procedural V2 planes only."], usageCount: 0, successCount: 0, failureCount: 0, approval: "approved", version: 1,
  created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z",
});

describe("approved Roof Recipe integration", () => {
  it("parameterizes procedural V2 roofs, persists the selected system, and never introduces a GLB", () => {
    const recipe = libraryRoof([{ key: "roof-system", value: "standing-seam" }, { key: "pitch", value: 18 }, { key: "overhang", value: 1.1 }]);
    const roofs = parameterizeRoofsFromLibrary(recipe, [{ id: "m-roof", massId: "m", kind: "shed", pitch: 12, overhang: .5 }]);
    expect(roofs).toEqual([{ id: "m-roof", massId: "m", kind: "shed", pitch: 18, overhang: 1.1 }]);
    expect(appliedRoofRecipe(recipe)).toMatchObject({ system: { primary: "standing-seam" }, libraryRecipe: { id: "roof-seam", status: "applied" } });
  });

  it("rejects a hip/gable library recipe for an L-shaped mass until valley geometry exists", () => {
    const recipe = libraryRoof([{ key: "system", value: "tile-shingle" }, { key: "kind", value: "hip" }]);
    expect(roofRecipeCompatibility(recipe, [mass({ form: "l-shape", roofEdge: "deep-eave" })])).toMatch(/valley geometry/);
    expect(roofRecipeCompatibility(recipe, [mass({ form: "bar", roofEdge: "deep-eave" })])).toBeUndefined();
  });
});
