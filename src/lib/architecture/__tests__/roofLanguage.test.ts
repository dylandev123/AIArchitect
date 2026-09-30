import { describe, expect, it } from "vitest";
import type { MassVolume, RoofRecipeKind } from "../document";
import { withVolumePlan } from "../volumePlan";
import { assessRoofLanguage, COMPATIBLE_SUBORDINATE_KINDS, ROOF_FAMILY_GROUP, type AuthoredRoof, type RoofLanguage } from "../roofLanguage";

const mass = (id: string, role: MassVolume["role"], width: number, depth: number, extra: Partial<MassVolume> = {}): MassVolume =>
  ({ id, name: id, role, position: { x: 0, z: 0 }, width, depth, floors: 1, elevation: 0, rotation: 0, ...extra });
const roof = (massId: string, kind: RoofRecipeKind, extra: Partial<AuthoredRoof> = {}): AuthoredRoof =>
  ({ id: `${massId}-roof`, massId, kind, overhang: 0.6, pitch: 22, ...extra });

const living = mass("living", "main-living", 16, 9);
const bedrooms = mass("bedrooms", "bedroom-wing", 10, 7);
const link = mass("link", "connector", 4, 3);
const garage = mass("garage", "garage", 7, 6, { elevation: 0.4 });
const house = [living, bedrooms, link, garage];
const gableLanguage: RoofLanguage = { dominantMassId: "living", family: "gable", concept: "One gable family with a lean-to garage and a flat glass link." };

describe("whole-house roof language coherence", () => {
  it("accepts one coherent gable language: shared family and pitch, a shallower lean-to, a flat recessive link", () => {
    const roofs = [
      roof("living", "gable"), roof("bedrooms", "cross-gable", { pitch: 23 }),
      roof("link", "flat", { pitch: 2, overhang: 0.3 }), roof("garage", "shed", { pitch: 14, overhang: 0.5 }),
    ];
    expect(assessRoofLanguage(gableLanguage, roofs, house)).toEqual([]);
  });

  it("rejects unrelated gable/hip/flat/floating forms competing on one house", () => {
    const roofs = [
      roof("living", "gable"), roof("bedrooms", "hip", { pitch: 24 }),
      roof("link", "floating-flat", { pitch: 2 }), roof("garage", "flat", { pitch: 2 }),
    ];
    const errors = assessRoofLanguage(gableLanguage, roofs, house);
    expect(errors.some((e) => e.includes(`"bedrooms" hip roof competes with the gable language`))).toBe(true);
    expect(errors.some((e) => e.includes(`"link" floating-flat roof competes`))).toBe(true);
    // A flat roof on a non-recessive garage reads as a separate building under a pitched language.
    expect(errors.some((e) => e.includes(`"garage" is not a recessive link`))).toBe(true);
  });

  it("only repeats a floating plane under a floating-flat language, never beside a plain flat or pitched dominant", () => {
    expect(COMPATIBLE_SUBORDINATE_KINDS["floating-flat"]).toContain("floating-flat");
    for (const [dominant, subs] of Object.entries(COMPATIBLE_SUBORDINATE_KINDS)) {
      if (dominant !== "floating-flat") expect(subs).not.toContain("floating-flat");
      // Every language repeats its own family and never offers "mixed" as a coordinated subordinate.
      expect(subs).toContain(dominant);
      expect(subs).not.toContain("mixed");
      // No language mixes gable-family and hip-family ridges.
      const groups = new Set(subs.map((k) => ROOF_FAMILY_GROUP[k]));
      expect(groups.has("gabled") && groups.has("hipped")).toBe(false);
    }
  });

  it("requires a declared language for a multi-mass house, but not for a single volume", () => {
    const roofs = [roof("living", "gable"), roof("bedrooms", "gable")];
    expect(assessRoofLanguage(undefined, roofs, [living, bedrooms])[0]).toMatch(/Declare the whole-house roof language/);
    expect(assessRoofLanguage(undefined, [roof("living", "hip")], [living])).toEqual([]);
    expect(assessRoofLanguage({ dominantMassId: "living", family: "mixed" }, roofs, [living, bedrooms])[0]).toMatch(/"mixed" is not a roof language/);
    expect(assessRoofLanguage({ dominantMassId: "nope", family: "gable" }, roofs, [living, bedrooms])[0]).toMatch(/unknown dominant mass "nope"/);
  });

  it("puts the language on the planned dominant volume, and the dominant roof carries the declared family", () => {
    const planned = [withVolumePlan(living, { hierarchy: "dominant", roofEdge: "deep-eave" }), withVolumePlan(bedrooms, { hierarchy: "supporting", roofEdge: "deep-eave" })];
    const roofs = [roof("living", "hip", { pitch: 24 }), roof("bedrooms", "hip", { pitch: 24 })];
    const errors = assessRoofLanguage({ dominantMassId: "bedrooms", family: "hip" }, roofs, planned);
    expect(errors.some((e) => e.includes("must be the planned dominant volume (living)"))).toBe(true);
    expect(assessRoofLanguage({ dominantMassId: "living", family: "gable" }, roofs, planned).some((e) => e.includes(`must carry the language's own gable roof, not hip`))).toBe(true);
    expect(assessRoofLanguage({ dominantMassId: "living", family: "hip" }, roofs, planned)).toEqual([]);
  });

  it("coordinates pitch: same family shares the dominant pitch, a lean-to stays at or below it, low-slope languages stay low", () => {
    const pair = [living, bedrooms];
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable"), roof("bedrooms", "gable", { pitch: 35 })], pair)[0]).toMatch(/pitch 35° should share the dominant 22° pitch/);
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable"), roof("bedrooms", "shed", { pitch: 30 })], pair)[0]).toMatch(/lean-to pitch 30° is steeper than the dominant 22°/);
    const flatLanguage: RoofLanguage = { dominantMassId: "living", family: "flat" };
    expect(assessRoofLanguage(flatLanguage, [roof("living", "flat", { pitch: 2 }), roof("bedrooms", "mono-pitch", { pitch: 25 })], pair)[0]).toMatch(/breaks the low-slope flat language/);
    expect(assessRoofLanguage(flatLanguage, [roof("living", "flat", { pitch: 2 }), roof("bedrooms", "mono-pitch", { pitch: 10 })], pair)).toEqual([]);
  });

  it("coordinates orientation: sloped subordinates share the dominant grid unless massing turned the volume off it", () => {
    const pair = [living, bedrooms];
    const skewed = assessRoofLanguage(gableLanguage, [roof("living", "gable"), roof("bedrooms", "gable", { orientation: Math.PI / 4 })], pair);
    expect(skewed.some((e) => e.includes("off the dominant roof's grid"))).toBe(true);
    expect(skewed.some((e) => e.includes("turns it off its own 10.0x7.0m walls"))).toBe(true);
    // A deliberately rotated wing keeps a roof that follows its own walls.
    const rotatedWing = mass("bedrooms", "bedroom-wing", 10, 7, { rotation: Math.PI / 6 });
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable"), roof("bedrooms", "gable")], [living, rotatedWing])).toEqual([]);
    // A quarter turn only fits a square volume; a half turn fits any rectangle.
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable"), roof("bedrooms", "gable", { orientation: Math.PI / 2 })], pair).some((e) => e.includes("use 0° or 180°"))).toBe(true);
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable"), roof("bedrooms", "gable", { orientation: Math.PI })], pair)).toEqual([]);
  });

  it("shares datums between volumes on one wall-plate height: parapet tops, floating reveals, eave lines", () => {
    const pair = [living, bedrooms];
    const flat: RoofLanguage = { dominantMassId: "living", family: "flat" };
    expect(assessRoofLanguage(flat, [roof("living", "flat", { parapet: { height: 0.55 } }), roof("bedrooms", "flat", { parapet: { height: 0.9 } })], pair)[0]).toMatch(/parapets should share one top line/);
    const floating: RoofLanguage = { dominantMassId: "living", family: "floating-flat" };
    expect(assessRoofLanguage(floating, [
      roof("living", "floating-flat", { expression: { verticalGap: 0.3 } }), roof("bedrooms", "floating-flat", { expression: { verticalGap: 0.18 } }),
    ], pair)[0]).toMatch(/share one reveal gap and plate thickness/);
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable", { overhang: 1.4 }), roof("bedrooms", "gable", { overhang: 0.4 })], pair)[0]).toMatch(/should share one eave line/);
    // A volume on a different wall plate is a different datum — no shared line is required.
    const raised = mass("bedrooms", "bedroom-wing", 10, 7, { elevation: 1.2 });
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable", { overhang: 1.4 }), roof("bedrooms", "gable", { overhang: 0.4 })], [living, raised])).toEqual([]);
  });

  it("allows one justified counterpoint family, never on the dominant roof", () => {
    const why = "A hipped pavilion roof marks the detached guest house as a garden folly.";
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable"), roof("bedrooms", "hip", { counterpoint: why })], [living, bedrooms])).toEqual([]);
    const two = assessRoofLanguage(gableLanguage, [
      roof("living", "gable"), roof("bedrooms", "hip", { counterpoint: why }), roof("link", "floating-flat", { counterpoint: "A floating glass canopy for the link." }),
    ], [living, bedrooms, link]);
    expect(two.some((e) => e.includes("At most one counterpoint roof family"))).toBe(true);
    expect(assessRoofLanguage(gableLanguage, [roof("living", "gable", { counterpoint: why }), roof("bedrooms", "gable")], [living, bedrooms]).some((e) => e.includes("can't be a counterpoint"))).toBe(true);
  });
});
