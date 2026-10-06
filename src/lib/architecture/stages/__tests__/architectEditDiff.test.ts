import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../../fixtures";
import type { ArchitecturalAssembly, AssemblyHost, ArchitecturalDesignDocument, MassVolume } from "../../document";
import { architectDocument, responderOutputs } from "../../__tests__/v2StageResponder";
import { sitePlanContextForDocument } from "../../sitePlanContext";
import { architectEditPreservationErrors, architectEditSpatialErrors } from "../architectStage";
import { architecturalEditDiff, describeArchitecturalEditDiff, type ArchitecturalEditScope, type ArchitecturalEditTarget } from "../architectEditDiff";
import { normalizeSitePlan, sitePlanSchema, type SitePlan } from "../sitePlanStage";
import type { SpatialReflow } from "../spatialReflow";

/**
 * Mocked Architect outputs (no AI, no network). Every candidate carries the scope the Architect declares; the
 * deterministic layer must accept it only when the diff stays inside that declaration. The example requests are
 * fixtures for the generic contract — nothing under test knows what a balcony, fence, or portico is.
 */
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const villa = () => clone(ARCHITECTURE_FIXTURES.tropicalCourtyardVilla);
const scopeOf = (intent: string, ...targets: ArchitecturalEditTarget[]): ArchitecturalEditScope => ({ intent, targets });
const mass = (document: ArchitecturalDesignDocument, id: string) => document.massing.masses.find((candidate) => candidate.id === id)!;

/** A two-storey, two-mass north elevation: both masses carry upper front openings; the rear glass does not face front. */
const twoStorey = (): ArchitecturalDesignDocument => {
  const document = villa();
  const living = mass(document, "living"), wing = mass(document, "west-wing");
  Object.assign(living, {
    position: { x: -3, z: 0 }, width: 10, depth: 8, floors: 2, height: 6.8, operations: [],
    openings: [
      { id: "front-door", type: "door", facade: "north", start: .44, end: .56, height: 2.5, floors: "ground", frame: true },
      { id: "living-front-upper", type: "glazing-zone", facade: "north", start: .12, end: .38, heightRatio: .55, floors: "upper", frame: true },
      { id: "living-front-ground", type: "opening-rhythm", facade: "north", count: 2, width: .8, height: 1.3, sill: .9, floors: "ground" },
      { id: "living-rear-upper", type: "glazing-zone", facade: "south", start: .1, end: .9, heightRatio: .7, floors: "upper", frame: true },
    ],
  });
  Object.assign(wing, {
    position: { x: 5, z: 0 }, width: 6, depth: 8, floors: 2, height: 6.8, relationships: [],
    openings: [{ id: "wing-front-upper", type: "opening-rhythm", facade: "north", count: 2, width: .9, height: 1.45, sill: .95, floors: "upper" }],
  });
  document.massing = { ...document.massing, masses: [living, wing] };
  document.roofs = { recipes: document.roofs.recipes.filter((recipe) => recipe.massId === "living" || recipe.massId === "west-wing") };
  return document;
};
const withAssembly = (document: ArchitecturalDesignDocument, id: string, assembly: ArchitecturalAssembly) => {
  const next = clone(document);
  mass(next, id).assemblies = [...(mass(next, id).assemblies ?? []), assembly];
  return next;
};
/** Generic posts + beam/slab compositions the Architect might choose; their names are the Architect's, not the validator's. */
const groundLine = (id: string, facade: "north" | "south" | "east" | "west", depth: number, height: number, host?: AssemblyHost): ArchitecturalAssembly => ({
  id, intent: `Architect-composed ${id}`, parts: [
    { id: "post-a", type: "post", facade, at: .2, depth, level: 0, height, ...(host ? { host } : {}) },
    { id: "post-b", type: "post", facade, at: .8, depth, level: 0, height, ...(host ? { host } : {}) },
    { id: "rail", type: "beam", facade, start: .2, end: .8, depth, level: 0, height, ...(host ? { host } : {}) },
  ],
});
const accepted = (before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument, scope: ArchitecturalEditScope | undefined, reflow?: SpatialReflow) =>
  architectEditPreservationErrors(before, after, scope, reflow);

describe("generic declared-scope authorization: architecture domain", () => {
  it("enlarge upper front windows: one openings scope per contributing mass, verified by facade/level/type", () => {
    const before = twoStorey(), after = clone(before);
    mass(after, "living").openings = mass(after, "living").openings!.map((o) => o.id === "living-front-upper" && o.type === "glazing-zone" ? { ...o, heightRatio: .78 } : o);
    mass(after, "west-wing").openings = mass(after, "west-wing").openings!.map((o) => o.type === "opening-rhythm" ? { ...o, width: 1.25, height: 2.05, sill: .55 } : o);
    const scope = scopeOf("Enlarge the upper-floor front windows.",
      { element: "mass:living", action: "modify", fields: ["openings"], facade: "north", level: "upper", openingTypes: ["glazing-zone", "opening-rhythm"] },
      { element: "mass:west-wing", action: "modify", fields: ["openings"], facade: "north", level: "upper" });
    expect(accepted(before, after, scope)).toEqual([]);
    expect(describeArchitecturalEditDiff(architecturalEditDiff(before, after, scope))).toEqual([
      "main-living.facade.north.glazing-zones.upper: changed",
      "bedroom-wing.facade.north.opening-rhythms.upper: changed",
    ]);
  });

  it("modify entrance: operations + door on the declared facade", () => {
    const before = villa(), after = clone(before);
    const living = mass(after, "living");
    living.operations = [...living.operations!, { id: "living:grand-entry", type: "projection", facade: "north", start: .35, end: .65, depth: 2.2, open: true }];
    living.openings = living.openings!.map((o) => o.type === "door" ? { ...o, reveal: .25 } : o);
    const scope = scopeOf("Deeper covered entry and a framed front door.", { element: "mass:living", action: "modify", fields: ["operations", "openings"], facade: "north", openingTypes: ["door"] });
    expect(accepted(before, after, scope)).toEqual([]);
  });

  it.each([
    ["add balcony", { id: "balcony", intent: "balcony", parts: [
      { id: "platform", type: "slab", facade: "north", start: .58, end: .86, depth: 1.65, level: 1 },
      { id: "guard", type: "railing", slabId: "platform", edges: ["outer", "start", "end"], height: 1.1 },
    ] } as ArchitecturalAssembly, { facade: "north", level: "upper" }],
    ["add portico", { id: "portico", intent: "portico", parts: [
      { id: "deck", type: "slab", facade: "north", start: .35, end: .65, depth: 2.4, level: 0, host: { kind: "entrance", facade: "north" } },
      { id: "col-a", type: "post", facade: "north", at: .37, depth: 2.3, height: 3, host: { kind: "entrance", facade: "north" } },
      { id: "col-b", type: "post", facade: "north", at: .63, depth: 2.3, height: 3, host: { kind: "entrance", facade: "north" } },
    ] } as ArchitecturalAssembly, { facade: "north", level: "ground" }],
    ["add fence", groundLine("fence", "north", 4, 1.2), { facade: "north", level: "ground" }],
    ["add gate", groundLine("gate", "north", 6, 2.1, { kind: "entrance", facade: "north" }), { facade: "north", level: "ground" }],
    ["add garden wall", groundLine("garden-wall", "south", 5, 1.8), { facade: "south", level: "ground" }],
  ] as const)("%s: an assembly on the declared mass/facade/level", (_label, assembly, envelope) => {
    const before = twoStorey(), after = withAssembly(before, "living", assembly);
    const scope = scopeOf(_label, { element: "mass:living", action: "modify", fields: ["assemblies"], ...envelope });
    expect(accepted(before, after, scope)).toEqual([]);
    expect(describeArchitecturalEditDiff(architecturalEditDiff(before, after, scope))).toEqual(["main-living.assemblies: changed"]);
  });

  it("add covered walkway: a new mass anchored to existing architecture, with its own roof", () => {
    const before = villa(), after = clone(before);
    const walkway: MassVolume = { id: "walkway", name: "Covered Walkway", role: "connector", parentId: "living", position: { x: -9.5, z: -1 }, width: 3, depth: 2, floors: 1, elevation: 0, rotation: 0, openings: [] };
    after.massing = { ...after.massing, masses: [...after.massing.masses, walkway] };
    after.roofs = { recipes: [...after.roofs.recipes, { id: "walkway-roof", massId: "walkway", kind: "flat", overhang: .3 }] };
    expect(accepted(before, after, scopeOf("Covered link between living and the west wing.", { element: "mass:walkway", action: "add" }))).toEqual([]);
  });

  it("change roof: only the declared mass's recipe", () => {
    const before = villa(), after = clone(before);
    after.roofs.recipes.find((recipe) => recipe.massId === "living")!.kind = "hip";
    expect(accepted(before, after, scopeOf("Hipped main roof.", { element: "mass:living", action: "modify", fields: ["roof"] }))).toEqual([]);
  });

  it("an unfamiliar but representable request: an upper bay projection and its glazing on the wing's west side", () => {
    const before = twoStorey(), after = clone(before);
    const wing = mass(after, "west-wing");
    wing.operations = [{ id: "west-wing:reading-bay", type: "projection", facade: "west", start: .3, end: .7, depth: .9, floors: "upper" }];
    wing.openings = [...wing.openings!, { id: "west-wing:bay-glass", type: "glazing-zone", facade: "west", start: .3, end: .7, heightRatio: .6, floors: "upper" }];
    expect(accepted(before, after, scopeOf("A cantilevered reading nook overlooking the garden.", { element: "mass:west-wing", action: "modify", fields: ["operations", "openings"], facade: "west", level: "upper" }))).toEqual([]);
  });

  it("legacy saved projects: replacing a saved projection with a corrected operation stays inside a facade/level scope", () => {
    const before = twoStorey();
    mass(before, "living").operations = [{ id: "living:upper-front-balcony", type: "projection", facade: "north", start: .58, end: .86, depth: 1.65, floors: "upper" }];
    const after = clone(before);
    mass(after, "living").operations = [{ id: "living:upper-front-balcony", type: "balcony", facade: "north", start: .58, end: .86, depth: 1.65, floors: "upper" }];
    expect(accepted(before, after, scopeOf("Repair the saved balcony.", { element: "mass:living", action: "modify", fields: ["operations"], facade: "north", level: "upper" }))).toEqual([]);
  });
});

describe("over-broad or mismatched candidates still fail", () => {
  const windowScope = scopeOf("Enlarge upper front windows.", { element: "mass:living", action: "modify", fields: ["openings"], facade: "north", level: "upper" });
  const enlarged = (before: ArchitecturalDesignDocument) => {
    const after = clone(before);
    mass(after, "living").openings = mass(after, "living").openings!.map((o) => o.id === "living-front-upper" && o.type === "glazing-zone" ? { ...o, heightRatio: .78 } : o);
    return after;
  };

  it("rejects a missing declaration", () => {
    const before = twoStorey();
    expect(accepted(before, enlarged(before), undefined).join("\n")).toMatch(/Declare the edit scope/);
  });

  it("rejects unrelated masses, roofs, windows, operations and document fields under a narrow declaration", () => {
    const before = twoStorey(), after = enlarged(before);
    const living = mass(after, "living");
    living.openings = living.openings!.map((o) => {
      if (o.id === "living-rear-upper" && o.type === "glazing-zone") return { ...o, heightRatio: .92 }; // other facade
      if (o.id === "living-front-ground" && o.type === "opening-rhythm") return { ...o, width: 1.4 }; // other level
      if (o.id === "front-door" && o.type === "door") return { ...o, reveal: .33 }; // other level + type
      return o;
    });
    living.operations = [{ id: "living:notch", type: "notch", corner: "se", width: 2, depth: 2 }];
    living.floors = 3;
    mass(after, "west-wing").position.x += 1;
    after.roofs.recipes.find((recipe) => recipe.massId === "living")!.kind = "hip";
    after.components = { status: "pending", notes: ["rewrite"] };
    const errors = accepted(before, after, windowScope).join("\n");
    for (const path of [
      "main-living.facade.south.glazing-zones.upper", "main-living.facade.north.opening-rhythms.ground", "main-living.facade.north.doors.ground",
      "main-living.operations", "main-living.floors", "bedroom-wing.position", "main-living.roof", "document.components",
    ]) expect(errors).toContain(`${path}: changed [UNRELATED]`);
    expect(errors).not.toContain("main-living.facade.north.glazing-zones.upper: changed [UNRELATED]");
  });

  it("rejects an opening type the declaration narrows away", () => {
    const before = twoStorey(), after = enlarged(before);
    const scope = scopeOf("Upper rhythm only.", { element: "mass:living", action: "modify", fields: ["openings"], facade: "north", level: "upper", openingTypes: ["opening-rhythm"] });
    expect(accepted(before, after, scope).join("\n")).toContain("main-living.facade.north.glazing-zones.upper: changed [UNRELATED]");
  });

  it("rejects an assembly placed off the declared facade or level, or on another mass", () => {
    const before = twoStorey();
    const scope = scopeOf("Front balcony.", { element: "mass:living", action: "modify", fields: ["assemblies"], facade: "north", level: "upper" });
    for (const after of [
      withAssembly(before, "living", groundLine("off-facade", "south", 1, 1)),
      withAssembly(before, "living", groundLine("off-level", "north", 1, 1)),
    ]) expect(accepted(before, after, scope).join("\n")).toContain("main-living.assemblies: changed [UNRELATED]");
    const other = withAssembly(withAssembly(before, "living", { id: "ok", intent: "x", parts: [{ id: "p", type: "slab", facade: "north", start: .2, end: .5, depth: 1, level: 1 }] }), "west-wing", { id: "rogue", intent: "x", parts: [{ id: "p", type: "slab", facade: "north", start: .2, end: .5, depth: 1, level: 1 }] });
    expect(accepted(before, other, scope).join("\n")).toContain("bedroom-wing.assemblies: changed [UNRELATED]");
  });

  it("rejects over-declaration: a declared target or field that did not change", () => {
    const before = twoStorey(), after = enlarged(before);
    const errors = accepted(before, after, scopeOf("Windows... and everything else", windowScope.targets[0],
      { element: "mass:living", action: "modify", fields: ["roof", "geometry", "form"] },
      { element: "mass:west-wing", action: "modify", fields: ["openings", "operations", "assemblies", "roof"] })).join("\n");
    expect(errors).toMatch(/mass:living\) declares "roof" but the edit changed nothing there/);
    expect(errors).toMatch(/mass:west-wing\) declares "openings"/);
  });

  it("rejects a declared geometry change without a reflow entry, a removed mass, an unattached new mass, and a ghost target", () => {
    const before = twoStorey();
    const moved = clone(before);
    mass(moved, "living").position.x += 1;
    expect(accepted(before, moved, scopeOf("Shift.", { element: "mass:living", action: "modify", fields: ["geometry"] })).join("\n")).toContain("main-living.position: changed [UNRELATED]");

    const removed = clone(before);
    removed.massing.masses = removed.massing.masses.filter((m) => m.id !== "west-wing");
    removed.roofs.recipes = removed.roofs.recipes.filter((r) => r.massId !== "west-wing");
    expect(accepted(before, removed, windowScope).join("\n")).toContain("bedroom-wing.mass: removed [UNRELATED]");

    const floating = clone(before);
    floating.massing = { ...floating.massing, masses: [...floating.massing.masses, { id: "folly", name: "Folly", role: "connector", position: { x: 30, z: 30 }, width: 3, depth: 3, floors: 1, elevation: 0, rotation: 0, openings: [] }] };
    floating.roofs = { recipes: [...floating.roofs.recipes, { id: "folly-roof", massId: "folly", kind: "flat", overhang: .3 }] };
    expect(accepted(before, floating, scopeOf("Folly.", { element: "mass:folly", action: "add" })).join("\n")).toMatch(/must be attached/);

    expect(accepted(before, enlarged(before), scopeOf("Windows and a ghost roof.", windowScope.targets[0], { element: "mass:ghost", action: "modify", fields: ["roof"] })).join("\n")).toMatch(/no such existing mass/);
  });
});

describe("generic declared-scope authorization: site domain", () => {
  const document = () => architectDocument();
  const planFor = (doc: ArchitecturalDesignDocument): SitePlan => sitePlanSchema.parse(normalizeSitePlan(responderOutputs.sitePlan(), sitePlanContextForDocument(doc.brief, doc)!));
  const site = (doc: ArchitecturalDesignDocument, before: SitePlan, after: SitePlan, scope: ArchitecturalEditScope, reflow?: SpatialReflow) =>
    [...accepted(doc, doc, scope, reflow).filter((error) => !/Declare|declares/.test(error)), ...architectEditSpatialErrors(doc, doc, before, after, scope, reflow)];

  it("move pool: the pool is the declared edit; the deck follows as a bounded reflow", () => {
    const doc = document(), before = planFor(doc), after = clone(before);
    after.pool.distance += 2;
    after.poolDeck.z += 2;
    expect(site(doc, before, after, scopeOf("Move the pool farther back.", { element: "site:pool", action: "modify" }),
      { elements: [{ id: "site:poolDeck", action: "move", dependsOn: "site:pool", reason: "The deck follows the relocated pool edge." }] })).toEqual([]);
  });

  it("extend driveway with necessary local reflow", () => {
    const doc = document(), before = planFor(doc), after = clone(before);
    after.driveway.length += 4;
    after.parking[0].z -= 4;
    expect(site(doc, before, after, scopeOf("Extend the driveway.", { element: "site:driveway", action: "modify" }),
      { elements: [{ id: "site:parking:0", action: "move", dependsOn: "site:driveway", reason: "The parking pad stays at the end of the longer drive." }] })).toEqual([]);
  });

  it("an unfamiliar site request: a new planting zone declared as an added site element", () => {
    const doc = document(), before = planFor(doc), after = clone(before);
    after.landscape.push({ purpose: "privacy", kind: "garden", x: -22, z: 8, width: 4, depth: 6 });
    const id = `site:landscape:privacy:${after.landscape.length - 1}`;
    expect(site(doc, before, after, scopeOf("A secluded meditation grove.", { element: id, action: "add" }))).toEqual([]);
  });

  it("rejects undeclared site changes, unrelated reflow, deletions, and a declared-but-unchanged site target", () => {
    const doc = document(), before = planFor(doc);
    const scope = scopeOf("Move the pool.", { element: "site:pool", action: "modify" });

    const sneaky = clone(before);
    sneaky.pool.distance += 2;
    sneaky.driveway.offset += 3;
    expect(site(doc, before, sneaky, scope).join("\n")).toMatch(/Spatial changes require an explicit reflow proposal/);

    const far = clone(before);
    far.pool.distance += 2;
    far.landscape[0].x += 20;
    const id = `site:landscape:${far.landscape[0].purpose}:0`;
    expect(site(doc, before, far, scope, { elements: [{ id, action: "move", dependsOn: "site:pool", reason: "Claimed dependency on the pool move." }] }).join("\n")).toMatch(/Capability Need/);

    const deleted = clone(before);
    deleted.pool.distance += 2;
    deleted.paths.pop();
    expect(site(doc, before, deleted, scope).join("\n")).toMatch(/added, removed, or had its semantic identity changed/);

    expect(site(doc, before, clone(before), scope).join("\n")).toMatch(/Declared site target site:pool did not change/);
  });

  it("a site-only declaration grants no architecture", () => {
    const doc = document(), before = planFor(doc), after = clone(before), edited = clone(doc);
    after.pool.distance += 2;
    edited.roofs.recipes[0].kind = "hip";
    edited.massing.masses[0].openings = edited.massing.masses[0].openings!.map((o) => o.type === "door" ? { ...o, height: 3 } : o);
    const errors = architectEditPreservationErrors(doc, edited, scopeOf("Move the pool.", { element: "site:pool", action: "modify" })).join("\n");
    expect(errors).toContain("main-living.roof: changed [UNRELATED]");
    expect(errors).toContain("main-living.facade.north.doors: changed [UNRELATED]");
  });
});
