import { describe, expect, it } from "vitest";
import { planOutdoorSpaces } from "@/lib/outdoor/spaces";
import type { DesignRecipe } from "@/types/library";
import { evaluateRecipes, retrieveRecipes } from "../spaceRecipes";
import { assembleVilla, VILLA_BRIEF } from "./villaFixture";

const recipe = (over: Partial<DesignRecipe> & { name: string; category: DesignRecipe["category"] }): DesignRecipe => ({
  id: over.name,
  styleTags: ["tropical"],
  compatibleScales: ["luxury"],
  environmentTags: [],
  parameters: [],
  relationships: [],
  guidance: [],
  usageCount: 0,
  successCount: 0,
  failureCount: 0,
  approval: "approved",
  version: 1,
  created_at: "",
  updated_at: "",
  ...over,
});

const spaces = planOutdoorSpaces({ brief: VILLA_BRIEF, scale: "luxury" });
const ctx = { brief: VILLA_BRIEF, styles: ["modern", "tropical"], scale: "luxury" as const };
const forSpaces = (r: DesignRecipe[]) => Object.fromEntries(retrieveRecipes(r, spaces, ctx).map((x) => [x.recipe.name, x.spaces]));

describe("which spaces a recipe serves", () => {
  it("sends a recipe to the space its own words are about, not to every space of its category", () => {
    const out = forSpaces([recipe({ name: "Luxury Outdoor Dining Terrace 01", category: "outdoor-living", guidance: ["Keep the table under shade"] }), recipe({ name: "Fire Circle 01", category: "outdoor-living" }), recipe({ name: "Outdoor Kitchen Island 01", category: "outdoor-living" })]);
    expect(out["Luxury Outdoor Dining Terrace 01"]).toEqual(["outdoor-dining"]);
    expect(out["Fire Circle 01"]).toEqual(["fire-pit-lounge"]);
    expect(out["Outdoor Kitchen Island 01"]).toEqual(["outdoor-kitchen"]);
  });

  it("puts a generic recipe on one space only, so it never lands everywhere at once", () => {
    const out = forSpaces([recipe({ name: "Resort Layout 01", category: "outdoor-living" })]);
    expect(out["Resort Layout 01"]).toHaveLength(1);
  });

  it("serves only the home of the Knowledge Need a recipe is filed under", () => {
    const out = forSpaces([recipe({ name: "Terrace Recipe", category: "outdoor-living", knowledgeIds: ["outdoor-kitchen"] })]);
    expect(out["Terrace Recipe"]).toEqual(["outdoor-kitchen"]);
  });

  it("gives a space at most two recipes, best first, and never a recipe for another scale or an unapproved one", () => {
    const many = ["A", "B", "C"].map((n) => recipe({ name: `Pool Garden ${n}`, category: "pool", successCount: n === "C" ? 5 : 0 }));
    const out = retrieveRecipes([...many, recipe({ name: "Mansion Pool", category: "pool", compatibleScales: ["mansion"] }), recipe({ name: "Draft Pool", category: "pool", approval: "proposed" })], spaces, ctx);
    const names = out.map((x) => x.recipe.name);
    expect(names).toHaveLength(2);
    expect(names).toContain("Pool Garden C");
    expect(names).not.toContain("Mansion Pool");
    expect(names).not.toContain("Draft Pool");
  });

  it("says why each was retrieved", () => {
    const [first] = retrieveRecipes([recipe({ name: "Dining Terrace", category: "outdoor-living" })], spaces, ctx);
    expect(first.reason).toMatch(/^Outdoor Dining: category outdoor-living, its name and rules are about outdoor dining/);
  });
});

describe("was it applied", () => {
  const { json } = assembleVilla();
  const retrieved = retrieveRecipes(
    [recipe({ name: "Pool Garden 01", category: "pool", relationships: [{ kind: "requires", target: "pool" }] }), recipe({ name: "Bar Pool 02", category: "pool", relationships: [{ kind: "requires", target: "pool-bar" }] }), recipe({ name: "Roof 01", category: "roof" })],
    spaces,
    ctx
  );
  const realized = spaces.map((s) => ({ ...s, realized: true, realizedBy: ["x"] }));

  it("counts a recipe as applied when its space is in the design and what it requires exists", () => {
    const by = Object.fromEntries(evaluateRecipes(retrieved, realized, json).map((r) => [r.name, r]));
    expect(by["Pool Garden 01"].applied).toBe(true);
    expect(by["Roof 01"].applied).toBe(true);
    expect(by["Roof 01"].spaces).toEqual([]);
  });

  it("does not, when a required part is missing or the space is not in the design", () => {
    const by = Object.fromEntries(evaluateRecipes(retrieved, realized, json).map((r) => [r.name, r]));
    // The villa has no pool bar.
    expect(by["Bar Pool 02"]).toMatchObject({ applied: false });
    expect(by["Bar Pool 02"].note).toMatch(/requires pool-bar/);
    const absent = evaluateRecipes(retrieved, spaces.map((s) => ({ ...s, realized: false })), json).find((r) => r.name === "Pool Garden 01")!;
    expect(absent.applied).toBe(false);
    expect(absent.note).toMatch(/not in the design/);
  });
});
