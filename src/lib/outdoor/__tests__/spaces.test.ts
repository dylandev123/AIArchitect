import { describe, expect, it } from "vitest";
import { assembleVilla, VILLA_BRIEF } from "@/lib/library/__tests__/villaFixture";
import { plannedAssetSchema } from "@/lib/library/plans";
import { COMPONENTS, plannedAssetFor } from "../components";
import { describeSpacesForPrompt, OUTDOOR_SPACE_KINDS, planOutdoorSpaces, realizeSpaces, type OutdoorSpaceKind } from "../spaces";

const kinds = (brief: string, extra: Partial<Parameters<typeof planOutdoorSpaces>[0]> = {}) => planOutdoorSpaces({ brief, ...extra }).map((s) => s.kind);

describe("planning outdoor spaces from a brief", () => {
  const spaces = planOutdoorSpaces({ brief: VILLA_BRIEF });
  const byKind = Object.fromEntries(spaces.map((s) => [s.kind, s]));

  it("finds each distinct space the villa brief names, and says it was named", () => {
    for (const kind of ["arrival-court", "main-outdoor-living", "outdoor-dining", "outdoor-kitchen", "pool-lounge", "fire-pit-lounge", "garden"] as OutdoorSpaceKind[]) {
      expect(byKind[kind], kind).toBeDefined();
      expect(byKind[kind].requested, kind).toBe(true);
      expect(byKind[kind].reasons[0]).toBe("named in the brief");
    }
    // Not asked for, and a luxury villa has no call for them.
    expect(byKind["pool-bar"]).toBeUndefined();
    expect(byKind["quiet-retreat"]).toBeUndefined();
    expect(byKind["guest-outdoor"]).toBeUndefined();
  });

  it("gives every space a purpose, size, relations, orientation, recipe categories and asset requirements", () => {
    for (const s of spaces) {
      expect(s.purpose.length, s.kind).toBeGreaterThan(20);
      expect(s.footprint.width).toBeGreaterThan(0);
      expect(s.footprint.depth).toBeGreaterThan(0);
      expect(s.relationToHouse.length).toBeGreaterThan(10);
      expect(s.orientation.viewPriority).toBeGreaterThanOrEqual(0);
      expect(s.orientation.viewPriority).toBeLessThanOrEqual(1);
      if (s.kind !== "service") {
        expect(s.recipeCategories.length, s.kind).toBeGreaterThan(0);
        expect(s.components.required.length, s.kind).toBeGreaterThan(0);
        expect(s.assetCategories.required.length, s.kind).toBeGreaterThan(0);
      }
    }
  });

  it("puts outdoor dining next to the kitchen, near the pool and away from the arrival, with table, chairs and shade", () => {
    const dining = byKind["outdoor-dining"];
    expect(dining.near).toEqual(expect.arrayContaining(["outdoor-kitchen", "pool-lounge"]));
    expect(dining.apart).toContain("arrival-court");
    expect(dining.side).toBe("view");
    expect(dining.components.required).toEqual(expect.arrayContaining(["dining-table", "dining-chair", "pergola"]));
    expect(dining.components.preferred).toContain("pendant-light");
    expect(dining.recipeCategories).toContain("outdoor-living");
  });

  it("keeps the arrival court on the arrival side and the pool and outdoor living on the view side", () => {
    expect(byKind["arrival-court"].side).toBe("arrival");
    expect(byKind["arrival-court"].apart).toEqual(expect.arrayContaining(["pool-lounge", "outdoor-dining"]));
    expect(byKind["pool-lounge"].side).toBe("view");
    expect(byKind["pool-lounge"].orientation).toMatchObject({ faces: "view" });
    expect(byKind["main-outdoor-living"].orientation.viewPriority).toBe(1);
  });

  it("is a pure function of its input", () => {
    expect(planOutdoorSpaces({ brief: VILLA_BRIEF })).toEqual(planOutdoorSpaces({ brief: VILLA_BRIEF }));
  });
});

describe("what the scale, style and site add", () => {
  it("adds only what a small brief needs, and more as the scale grows", () => {
    const cottage = kinds("A small cottage", { scale: "cottage" });
    expect(cottage).toEqual(["main-outdoor-living", "arrival-court"]);
    expect(cottage).not.toContain("pool-lounge");
    expect(cottage).not.toContain("outdoor-dining");
    const mansion = kinds("A resort-style tropical mansion", { scale: "mansion" });
    for (const k of ["outdoor-dining", "outdoor-kitchen", "pool-lounge", "pool-bar", "fire-pit-lounge", "quiet-retreat", "guest-outdoor", "service", "garden"] as OutdoorSpaceKind[]) expect(mansion, k).toContain(k);
    expect(mansion.length).toBeGreaterThan(cottage.length);
  });

  it("gives a hillside or ocean site a view terrace, and says why", () => {
    const hill = planOutdoorSpaces({ brief: "A modern house on a steep hillside", scale: "luxury", environment: "hillside" }).find((s) => s.kind === "view-terrace");
    expect(hill?.reasons.join(" ")).toMatch(/hillside/);
    expect(kinds("A modern house in a suburb", { scale: "luxury", environment: "suburban" })).not.toContain("view-terrace");
  });

  it("leaves a cramped urban lot to the basics unless the brief asks for more", () => {
    const urban = kinds("A townhouse", { scale: "luxury", environment: "urban" });
    expect(urban).not.toContain("service");
    expect(urban).not.toContain("guest-outdoor");
    expect(kinds("A townhouse with a fire pit", { scale: "luxury", environment: "urban" })).toContain("fire-pit-lounge");
  });

  it("does not read interior words as outdoor spaces", () => {
    expect(kinds("A house with a dining room and a large kitchen", { scale: "family" })).not.toContain("outdoor-dining");
    expect(kinds("A house with a dining room and a large kitchen", { scale: "family" })).not.toContain("outdoor-kitchen");
  });
});

describe("reading a generated project", () => {
  const villa = assembleVilla();
  const realized = realizeSpaces(planOutdoorSpaces({ brief: VILLA_BRIEF, scale: "luxury" }), villa.json);
  const by = Object.fromEntries(realized.map((s) => [s.kind, s]));

  it("says which spaces the design actually contains, and what stands for each", () => {
    expect(by["arrival-court"].realizedBy.join()).toMatch(/driveway/);
    expect(by["arrival-court"].realizedBy.join()).toMatch(/garage/);
    expect(by["pool-lounge"].realizedBy).toEqual(["1 pool"]);
    expect(by["main-outdoor-living"].realized).toBe(true);
    expect(by.garden.realized).toBe(true);
  });

  it("does not claim a space the design lacks", () => {
    const bare = realizeSpaces(planOutdoorSpaces({ brief: VILLA_BRIEF, scale: "luxury" }), JSON.stringify({ house: { width: 10, depth: 8, floors: 1, roof: "gable" } }));
    expect(bare.every((s) => !s.realized)).toBe(true);
  });
});

describe("the prompt", () => {
  it("states the placement principle and lists each space with its relations", () => {
    const text = describeSpacesForPrompt(planOutdoorSpaces({ brief: VILLA_BRIEF }));
    expect(text).toContain("OUTDOOR SPACES");
    expect(text).toMatch(/Outdoor Dining/);
    expect(text).toMatch(/arrival side/);
    expect(text).toMatch(/never in the arrival court/);
    expect(describeSpacesForPrompt([])).toBe("");
  });
});

describe("components", () => {
  it("are defined for every object any space asks for", () => {
    for (const s of planOutdoorSpaces({ brief: "a mansion", scale: "mansion" })) {
      for (const key of [...s.components.required, ...s.components.preferred]) expect(COMPONENTS[key], `${s.kind}: ${key}`).toBeDefined();
    }
    expect(OUTDOOR_SPACE_KINDS).toHaveLength(12);
  });

  it("each make a valid planned asset the native generator can be pointed at, without any AI call", () => {
    for (const key of Object.keys(COMPONENTS)) {
      const asset = plannedAssetFor(key, { styles: ["tropical"], space: "outdoor-dining", need: "required" });
      expect(asset, key).toBeDefined();
      const parsed = plannedAssetSchema.safeParse(asset);
      expect(parsed.success, `${key}: ${parsed.success ? "" : parsed.error.issues[0]?.message}`).toBe(true);
      expect(asset!.tags).toEqual(expect.arrayContaining([`component:${key}`, "space:outdoor-dining"]));
    }
    // Furniture, kitchen, bar, light, pergola and planters are buildable natively; a fire pit or palm is sent out.
    expect(plannedAssetFor("dining-table", { styles: [], need: "required" })!.route).toBe("native");
    expect(plannedAssetFor("pergola", { styles: [], need: "required" })!.route).toBe("native");
    expect(plannedAssetFor("fire-pit", { styles: [], need: "required" })!.route).toBe("external-generation-recommended");
  });

  it("do not let a side table satisfy the dining table", () => {
    expect(COMPONENTS["dining-table"].match.test("Teak Side Table")).toBe(false);
    expect(COMPONENTS["dining-table"].match.test("Outdoor Dining Table")).toBe(true);
    expect(COMPONENTS["side-table"].match.test("Teak Side Table")).toBe(true);
  });
});
