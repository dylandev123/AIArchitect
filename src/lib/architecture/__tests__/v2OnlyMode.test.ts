import { describe, expect, it } from "vitest";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { compileArchitecture } from "../compiler";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import { applyV2OnlyMode, SITE_FEATURE_CATEGORIES } from "../v2OnlyMode";
import { primitiveSignature } from "../renderAudit";

/**
 * Diagnostic coverage for the DEV-only "V2 Architecture Only" mode (see AGENTS.md task): with a valid
 * `architecturalDesignDocument`, legacy house/building geometry must never affect the visible building,
 * while genuine legacy site features (pools, driveways, landscaping, terrain-adjacent walls) must keep
 * rendering. No AI calls involved — everything here is pure function compilation of fixtures/JSON.
 */

const FIXTURE_KEYS = ["luxuryTropicalCourtyardVillaV2", "architectureCompilerStressFixture"] as const;

function houseJson(overrides: Record<string, unknown>) {
  return JSON.stringify({
    house: { width: 10, depth: 8, floors: 1, roof: "flat" },
    windows: [{ wall: "south", offset: 1, width: 1.2, height: 1.4, sillHeight: 0.9, level: 0 }],
    doors: [{ wall: "south", offset: 3, width: 1, height: 2.1, level: 0 }],
    garages: [{ wall: "west", offset: 0, width: 3, depth: 5 }],
    chimneys: [{ wall: "north", offset: 1 }],
    pools: [{ width: 4, depth: 3, offset: 1 }],
    driveways: [{ width: 3, length: 6, offset: 1, wall: "west" }],
    landscaping: [{ shape: "rectangle", x: 3, z: 3, width: 2, depth: 2 }],
    ...overrides,
  });
}

function resolveV2Only(json: string, v2OnlyMode = true) {
  const raw = JSON.parse(json);
  const legacy = generateHouseFromJson(json);
  const v2Model = compileArchitecture(raw.architecturalDesignDocument, { materials: legacy.site?.materials ?? DEFAULT_MATERIALS_CONFIG }).model;
  return { v2Model, ...applyV2OnlyMode({ legacy, v2Model, v2OnlyMode, cutawayActive: false }) };
}

describe("V2 Architecture Only mode", () => {
  for (const fixtureKey of FIXTURE_KEYS) {
    describe(fixtureKey, () => {
      it("keeps genuine site features (pools, driveways, landscaping) while excluding every legacy building primitive", () => {
        const json = houseJson({ architecturalDesignDocument: ARCHITECTURE_FIXTURES[fixtureKey] });
        const { model, v2Model } = resolveV2Only(json);
        const v2Ids = new Set(v2Model.primitives.map((p) => p.id));

        const pools = model.primitives.filter((p) => p.category === "pool");
        const driveways = model.primitives.filter((p) => p.category === "driveway");
        const landscape = model.primitives.filter((p) => p.category === "landscape");
        expect(pools.length, "pool must still render").toBeGreaterThan(0);
        expect(driveways.length, "driveway must still render").toBeGreaterThan(0);
        expect(landscape.length, "landscaping must still render").toBeGreaterThan(0);

        // Every primitive is either a genuine site feature or came verbatim from the V2 compiler
        // (including capability-plugin geometry like corner glazing / entry canopies) — never a
        // legacy building-shell primitive (wall/roof/floor/window/door/garage/chimney/...).
        const leaked = model.primitives.filter((p) => !SITE_FEATURE_CATEGORIES.has(p.category) && !v2Ids.has(p.id));
        expect(leaked, JSON.stringify(leaked.map((p) => ({ id: p.id, category: p.category })))).toEqual([]);
      });

      it("MOST IMPORTANT: changing/removing the legacy house does not change the V2 building output", () => {
        const withLegacyExtras = houseJson({ architecturalDesignDocument: ARCHITECTURE_FIXTURES[fixtureKey] });
        // A totally different legacy house shell (dimensions, floors, roof) and every legacy
        // building-shell feature array stripped out entirely — only the site features kept.
        const strippedLegacyHouse = JSON.stringify({
          house: { width: 37, depth: 22, floors: 3, roof: "hip" },
          pools: [{ width: 4, depth: 3, offset: 1 }],
          driveways: [{ width: 3, length: 6, offset: 1, wall: "west" }],
          landscaping: [{ shape: "rectangle", x: 3, z: 3, width: 2, depth: 2 }],
          architecturalDesignDocument: ARCHITECTURE_FIXTURES[fixtureKey],
        });

        const a = resolveV2Only(withLegacyExtras);
        const b = resolveV2Only(strippedLegacyHouse);

        const buildingSignaturesOf = (v2Model: typeof a.v2Model) => v2Model.primitives.map(primitiveSignature).sort();

        expect(buildingSignaturesOf(b.v2Model)).toEqual(buildingSignaturesOf(a.v2Model));
      });

      it("MOST IMPORTANT: changing architecturalDesignDocument DOES change the V2 building output", () => {
        const otherKey = fixtureKey === "luxuryTropicalCourtyardVillaV2" ? "architectureCompilerStressFixture" : "luxuryTropicalCourtyardVillaV2";
        const jsonA = houseJson({ architecturalDesignDocument: ARCHITECTURE_FIXTURES[fixtureKey] });
        const jsonB = houseJson({ architecturalDesignDocument: ARCHITECTURE_FIXTURES[otherKey] });

        const a = resolveV2Only(jsonA);
        const b = resolveV2Only(jsonB);

        const buildingSignaturesOf = (v2Model: typeof a.v2Model) => v2Model.primitives.map(primitiveSignature).sort();

        expect(buildingSignaturesOf(a.v2Model)).not.toEqual(buildingSignaturesOf(b.v2Model));
      });

      it("reports known remaining legacy dependencies as violations without breaking the invariant above", () => {
        const json = houseJson({ architecturalDesignDocument: ARCHITECTURE_FIXTURES[fixtureKey] });
        const { violations } = resolveV2Only(json);
        expect(violations.length).toBeGreaterThan(0);
        expect(violations.every((v) => ["rendering", "generation", "placement", "compatibility-data"].includes(v.effect))).toBe(true);
      });
    });
  }

  it("renders the authored site even when the former dev-only toggle is disabled", () => {
    const json = houseJson({ architecturalDesignDocument: ARCHITECTURE_FIXTURES.luxuryTropicalCourtyardVillaV2 });
    const { model, violations } = resolveV2Only(json, false);
    expect(model.primitives.some((p) => p.category === "pool")).toBe(true);
    expect(model.primitives.some((p) => p.category === "driveway")).toBe(true);
    expect(violations.length).toBeGreaterThan(0);
  });
});
