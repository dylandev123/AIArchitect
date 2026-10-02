import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../../fixtures";
import type { ArchitecturalDesignDocument, MassVolume } from "../../document";
import { architectEditPreservationErrors } from "../architectStage";
import { architecturalEditDiff, architecturalEditScope, describeArchitecturalEditDiff } from "../architectEditDiff";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const current = () => clone(ARCHITECTURE_FIXTURES.tropicalCourtyardVilla);
const entranceRequest = "Give the main-living entrance a deeper recessed porch and a more substantial front door.";
const bedroom = (document: ArchitecturalDesignDocument) => document.massing.masses.find((mass) => mass.role === "bedroom-wing")!;

describe("Architect edit ownership preservation", () => {
  it("allows a localized entrance operation and door while retaining field-level diagnostics", () => {
    const before = current();
    const after = clone(before);
    const living = after.massing.masses.find((mass) => mass.role === "main-living")!;
    living.operations = [...(living.operations ?? []), { id: "living:grand-entry", type: "projection", facade: "north", start: .35, end: .65, depth: 2.2, open: true }];
    living.openings = (living.openings ?? []).map((opening) => opening.type === "door" ? { ...opening, frame: true, reveal: .25 } : opening);

    expect(architectEditPreservationErrors(before, after, entranceRequest)).toEqual([]);
    expect(describeArchitecturalEditDiff(architecturalEditDiff(before, after, architecturalEditScope(before, entranceRequest, after)))).toEqual(expect.arrayContaining([
      "main-living.operations: changed",
      "main-living.facade.north.doors: changed",
    ]));
  });

  it("rejects a rewritten unrelated bedroom wing and marks the exact changed field", () => {
    const before = current();
    const after = clone(before);
    bedroom(after).position.x += 3;

    expect(architectEditPreservationErrors(before, after, entranceRequest).join("\n")).toContain("bedroom-wing.position: changed [UNRELATED]");
  });

  it("rejects an unrelated bedroom roof rewrite", () => {
    const before = current();
    const after = clone(before);
    const roof = after.roofs.recipes.find((recipe) => recipe.massId === bedroom(after).id)!;
    roof.kind = "hip";

    expect(architectEditPreservationErrors(before, after, entranceRequest).join("\n")).toContain("bedroom-wing.roof: changed [UNRELATED]");
  });

  it("permits a roof request to change the targeted roof", () => {
    const before = current();
    const after = clone(before);
    after.roofs.recipes.find((recipe) => recipe.massId === "living")!.kind = "hip";

    expect(architectEditPreservationErrors(before, after, "Make the main roof a hipped roof with deeper eaves.")).toEqual([]);
  });

  it("permits a newly introduced entry mass and roof that are explicitly owned by the targeted living mass", () => {
    const before = current();
    const after = clone(before);
    const entry: MassVolume = {
      id: "living-entry", name: "Covered Entry", role: "entry", parentId: "living", position: { x: 0, z: -6 }, width: 4, depth: 2, floors: 1, elevation: 0, rotation: 0,
      operations: [{ type: "projection", facade: "north", start: .1, end: .9, depth: .6, open: true }], openings: [],
    };
    after.massing = { ...after.massing, masses: [...after.massing.masses, entry] };
    after.roofs = { ...after.roofs, recipes: [...after.roofs.recipes, { id: "living-entry-roof", massId: entry.id, kind: "flat", overhang: .3 }] };

    expect(architectEditPreservationErrors(before, after, entranceRequest)).toEqual([]);
  });
});
