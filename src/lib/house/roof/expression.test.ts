import { describe, expect, it } from "vitest";
import { buildRoofExpression } from "./expression";
import { resolveMaterial } from "../materials";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";

const material = resolveMaterial(DEFAULT_MATERIALS_CONFIG.roof);
const exterior = resolveMaterial(DEFAULT_MATERIALS_CONFIG.exterior);

describe("Roof Expression", () => {
  it("turns an overhang and floating clerestory intent into visible assembly geometry", () => {
    const roofs = buildRoofExpression({ id: "test", width: 10, depth: 8, wallPlateY: 3.2, roofMaterial: material, exteriorMaterial: exterior, parameters: { overhang: 1.8, verticalGap: .7, thickness: .3, fasciaDepth: .18, supportStyle: "clerestory", secondary: { width: 4, depth: 8, elevation: -.5 } } });
    const plane = roofs.find((p) => p.id === "test-plane");
    expect(plane?.kind === "box" && plane.size).toEqual([13.6, .3, 11.6]);
    expect(roofs.map((p) => p.id)).toEqual(expect.arrayContaining(["test-soffit", "test-fascia-north", "test-clerestory-band", "test-secondary-plane"]));
  });
});
