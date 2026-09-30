import { describe, expect, it, vi } from "vitest";
import { ARCHITECTURE_CRITERIA, type ArchitectureCriterion } from "@/types/library";
import { designArchitecture } from "../designEngine";
import { scoreArchitecture, WEAK_REVIEW_SCORE, type ArchitectureCriticResult } from "../critic";
import { ARCHITECTURE_FIXTURES } from "../fixtures";
import type { ArchitecturalDesignDocument, MassVolume } from "../document";
import { collectV2Evidence } from "../v2Evidence";

// The critic must stay deterministic and offline: any model call from the review path is a regression.
const generateText = vi.fn(() => { throw new Error("Architecture Review must not call a model"); });
vi.mock("ai", async (importOriginal) => ({ ...(await importOriginal<typeof import("ai")>()), generateText }));

/**
 * Regression cover for the V2 Architecture Review: every score reads the accepted V2 document's COMPILED
 * geometry (see v2Evidence.ts), never legacy scene fields and never intent the compiler did not realize.
 */

const pending = { status: "pending" as const };
const site = { environment: "suburban" as const, viewDirection: "south" as const, approachSide: "north" as const };
const design = designArchitecture("A quiet modern retreat", site);

function doc(masses: MassVolume[], extra: Partial<ArchitecturalDesignDocument> = {}): ArchitecturalDesignDocument {
  return {
    version: 1, brief: "test", siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" },
    massing: { composition: "rectangular-pavilion", masses }, roofs: { recipes: masses.map((m) => ({ id: `${m.id}-roof`, massId: m.id, kind: "flat" as const })) },
    facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" },
    ...extra,
  };
}
const mass = (id: string, over: Partial<MassVolume> = {}): MassVolume => ({ id, name: id, role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 8, floors: 1, elevation: 0, rotation: 0, ...over });
const review = (d: ArchitecturalDesignDocument, legacy: Record<string, unknown> = {}) => scoreArchitecture(design, JSON.stringify({ ...legacy, architecturalDesignDocument: d }), "test");
const criterion = (r: ArchitectureCriticResult, c: ArchitectureCriterion) => r.criteria.find((x) => x.criterion === c)!;

const southGlass = { type: "glazing-zone" as const, facade: "south" as const, start: 0.1, end: 0.9, heightRatio: 0.88 };
const openTerrace = { type: "projection" as const, facade: "south" as const, start: 0.1, end: 0.6, depth: 3, open: true, postSpacing: 2.4 };

describe("Architecture Review scores the accepted V2 document, not legacy fields", () => {
  it("ignores legacy windows/patios/porches/bays once a V2 document is present", () => {
    const d = doc([mass("living", { openings: [southGlass] })]);
    const legacy = { windows: Array.from({ length: 12 }, () => ({ wall: "south" })), patios: [{ wall: "south" }], porches: [{}], bays: [{}, {}, {}], arches: [{}, {}] };
    const plain = review(d);
    const decorated = review(d, legacy);
    expect(decorated.criteria).toEqual(plain.criteria);
  });

  it("falls back to legacy scoring when the embedded document is not a valid V2 document", () => {
    const invalid = doc([mass("living"), mass("living")]); // duplicate id → rejected, exactly as finalAssembly would reject it
    const result = review(invalid);
    expect(criterion(result, "views").reason).toMatch(/openings\/terraces face/);
  });

  it("does not credit canned concept strings: a V2 design with no terrace scores weak indoor-outdoor even if the concept lists outdoor strategies", () => {
    const withStrategies = { ...design, outdoorStrategy: ["a", "b", "c"], components: [{ name: "6m Sliding Glass Door", required: true }] };
    const d = doc([mass("living")]);
    const result = scoreArchitecture(withStrategies, JSON.stringify({ architecturalDesignDocument: d }), "test");
    expect(criterion(result, "indoor-outdoor").score).toBeLessThan(WEAK_REVIEW_SCORE);
    expect(result.recommendations.find((r) => r.criterion === "indoor-outdoor")).toMatchObject({ missingCapability: "carve-terrace" });
  });

  it("is deterministic and never calls a model", () => {
    const json = JSON.stringify({ architecturalDesignDocument: ARCHITECTURE_FIXTURES.luxuryTropicalCourtyardVillaV2 });
    expect(scoreArchitecture(design, json, "x")).toEqual(scoreArchitecture(design, json, "x"));
    expect(generateText).not.toHaveBeenCalled();
  });

  it("scores every criterion in range for every V2 fixture", () => {
    for (const [key, fixture] of Object.entries(ARCHITECTURE_FIXTURES)) {
      const result = review(fixture);
      expect(result.criteria.map((c) => c.criterion), key).toEqual([...ARCHITECTURE_CRITERIA]);
      for (const c of result.criteria) expect(c.score, `${key}:${c.criterion}`).toBeGreaterThanOrEqual(0);
      for (const c of result.criteria) expect(c.score, `${key}:${c.criterion}`).toBeLessThanOrEqual(1);
    }
  });
});

describe("views: compiled glazing orientation", () => {
  it("credits glazing that faces the view, not the same glazing on the arrival side", () => {
    const toView = review(doc([mass("living", { openings: [southGlass] })]));
    const toArrival = review(doc([mass("living", { openings: [{ ...southGlass, facade: "north" }] })]));
    expect(criterion(toView, "views").score).toBeGreaterThanOrEqual(WEAK_REVIEW_SCORE);
    expect(criterion(toArrival, "views").score).toBeLessThan(WEAK_REVIEW_SCORE);
    expect(criterion(toArrival, "views").score).toBeLessThan(criterion(toView, "views").score);
  });

  it("resolves world orientation from the compiled mass rotation", () => {
    // Rotated 180°: the local north facade faces the south view.
    const rotated = review(doc([mass("living", { rotation: Math.PI, openings: [{ ...southGlass, facade: "north" }] })]));
    const unrotated = review(doc([mass("living", { openings: [{ ...southGlass, facade: "north" }] })]));
    expect(criterion(rotated, "views").score).toBeGreaterThan(criterion(unrotated, "views").score);
    expect(criterion(rotated, "views").reason).toMatch(/faces the south view/);
  });

  it("discounts view glazing blocked by another volume standing in front of it", () => {
    const open = doc([mass("living", { openings: [southGlass] })]);
    const blocked = doc([mass("living", { openings: [southGlass] }), mass("garage", { role: "garage", position: { x: 0, z: 10 }, width: 14, depth: 6 })]);
    expect(criterion(review(blocked), "views").score).toBeLessThan(criterion(review(open), "views").score);
    expect(criterion(review(blocked), "views").reason).toMatch(/blocked by garage/);
  });

  it("counts compiled capability glazing (corner-glazing) only when the capability applied", () => {
    const base = doc([mass("living", { operations: [{ type: "entry-recess", facade: "north", width: 2, depth: 1 }] })]);
    const withCorner = doc(base.massing.masses as MassVolume[], { capabilities: [{ id: "corner-glazing", stage: "test", parameters: { massId: "living" } }] });
    const failed = doc(base.massing.masses as MassVolume[], { capabilities: [{ id: "corner-glazing", stage: "test", parameters: {} }] });
    const area = (d: ArchitecturalDesignDocument) => collectV2Evidence(d)!.glass.reduce((s, g) => s + g.area, 0);
    expect(area(withCorner)).toBeGreaterThan(area(base));
    expect(area(failed)).toBe(area(base));
  });
});

describe("terraces, open projections and indoor-outdoor transitions", () => {
  it("credits a compiled open projection as a covered outdoor room on its world side", () => {
    const e = collectV2Evidence(doc([mass("living", { operations: [openTerrace] })]))!;
    expect(e.outdoorRooms).toHaveLength(1);
    expect(e.outdoorRooms[0]).toMatchObject({ massId: "living", side: "south", depth: 3, atGrade: true, posts: true });
    expect(e.outdoorRooms[0].area).toBeCloseTo(0.5 * 14 * 3, 5);
  });

  it("gives a closed projection no outdoor-room credit", () => {
    const e = collectV2Evidence(doc([mass("living", { operations: [{ ...openTerrace, open: false }] })]))!;
    expect(e.outdoorRooms).toHaveLength(0);
  });

  it("does not count an open terrace the compiler dropped as overlapping", () => {
    const blocker = { type: "recess" as const, facade: "south" as const, start: 0.05, end: 0.7, depth: 1 };
    const dropped = review(doc([mass("living", { operations: [blocker, openTerrace] })]));
    const none = review(doc([mass("living", { operations: [blocker] })]));
    expect(collectV2Evidence(doc([mass("living", { operations: [blocker, openTerrace] })]))!.outdoorRooms).toHaveLength(0);
    expect(criterion(dropped, "indoor-outdoor").score).toBe(criterion(none, "indoor-outdoor").score);
    // ...and the dropped operation is reported, not silently forgiven.
    expect(criterion(dropped, "structural-realism").reason).toMatch(/overlapping operations/);
  });

  it("scores a view-facing terrace with walk-out glazing strong, and bare glass without a terrace weak", () => {
    const terrace = review(doc([mass("living", { operations: [openTerrace], openings: [{ ...southGlass, start: 0.65, end: 0.95 }] })]));
    const glassOnly = review(doc([mass("living", { openings: [southGlass] })]));
    expect(criterion(terrace, "indoor-outdoor").score).toBeGreaterThanOrEqual(0.75);
    expect(criterion(glassOnly, "indoor-outdoor").score).toBeLessThan(WEAK_REVIEW_SCORE);
  });

  it("does not treat a raised (upper-floor) open edge or a high-sill window as an at-grade transition", () => {
    const e = collectV2Evidence(doc([mass("living", { floors: 2, operations: [{ ...openTerrace, floors: "upper" }], openings: [{ type: "opening-rhythm", facade: "south", count: 4, width: 1.2, height: 1.4, sill: 0.9, floors: "ground" }] })]))!;
    expect(e.outdoorRooms.map((r) => r.atGrade)).toEqual([false]);
    expect(e.glass.some((g) => g.atGrade)).toBe(false);
  });
});

describe("privacy, courtyard and multi-wing composition", () => {
  const living = mass("living", { width: 16, depth: 9 });
  const wing = (id: string, side: "east" | "west") => mass(id, { role: "bedroom-wing", width: 6, depth: 12, position: { x: side === "east" ? 14 : -14, z: -4 }, relationships: [{ kind: "surrounds-courtyard", target: "living", side, distance: 3 }] });

  it("credits a compiled courtyard enclosed by three volumes", () => {
    const court = review(doc([living, wing("west", "west"), wing("east", "east")]));
    expect(criterion(court, "privacy").score).toBeGreaterThanOrEqual(0.75);
    expect(criterion(court, "composition").reason).toMatch(/compiled .*courtyard enclosed by 3 volumes/);
  });

  it("does not credit a courtyard with only one enclosing wing, whatever strategy the concept named", () => {
    const courtyardConcept = designArchitecture("A private courtyard compound", site);
    expect(courtyardConcept.strategies.some((s) => s.name === "Courtyard Composition")).toBe(true);
    const json = JSON.stringify({ architecturalDesignDocument: doc([living, wing("west", "west")]) });
    const result = scoreArchitecture(courtyardConcept, json, "A private courtyard compound");
    expect(criterion(result, "privacy").reason).toMatch(/no compiled courtyard/);
    expect(criterion(result, "composition").score).toBeLessThan(criterion(review(doc([living, wing("west", "west"), wing("east", "east")])), "composition").score);
  });

  it("penalizes private wings pressed against the public mass and glazed toward the arrival", () => {
    const apart = review(doc([living, mass("bed", { role: "bedroom-wing", width: 8, depth: 6, position: { x: -16, z: 0 } })]));
    const exposed = review(doc([living, mass("bed", { role: "bedroom-wing", width: 8, depth: 6, position: { x: -12, z: 0 }, openings: [{ ...southGlass, facade: "north" }] })]));
    expect(criterion(exposed, "privacy").score).toBeLessThan(criterion(apart, "privacy").score);
    expect(criterion(exposed, "privacy").reason).toMatch(/0\/1 private volumes held apart/);
  });

  it("gives a single plain volume no composition credit", () => {
    expect(criterion(review(doc([mass("living")])), "composition").score).toBe(0);
  });
});

describe("compiler-realized capabilities", () => {
  const fins = { id: "brise-soleil", stage: "test", parameters: { massId: "living", facade: "south", count: 10, depth: 0.5, height: 2.6 } };

  it("credits a screen layer only when brise-soleil fins actually compiled", () => {
    const withFins = review(doc([mass("living", { openings: [southGlass] })], { capabilities: [fins] }));
    const fellBack = review(doc([mass("living", { openings: [southGlass] })], { capabilities: [{ ...fins, parameters: { massId: "living" } }] }));
    expect(criterion(withFins, "facade-rhythm").reason).toMatch(/a compiled screen on 1 facade \(10 fins\/battens\)/);
    expect(criterion(fellBack, "facade-rhythm").reason).toMatch(/no screen layer/);
    expect(criterion(fellBack, "facade-rhythm").score).toBeLessThan(criterion(withFins, "facade-rhythm").score);
    expect(criterion(fellBack, "structural-realism").reason).toMatch(/fell back \(brise-soleil\)/);
  });

  it("builds a door authored inside an entry recess in the recess's back wall, not as slivers beside it", () => {
    const recessed = review(doc([mass("living", { operations: [{ type: "entry-recess", facade: "north", width: 3.2, depth: 1.3 }], openings: [{ type: "door", facade: "north", start: 0.37, end: 0.63, height: 2.4 }] })]));
    const flush = review(doc([mass("living", { openings: [{ type: "door", facade: "north", start: 0.43, end: 0.57, height: 2.4 }] })]));
    expect(criterion(recessed, "entry-sequence").reason).toMatch(/main door faces the north arrival; a compiled entry recess/);
    expect(criterion(recessed, "entry-sequence").score).toBeGreaterThan(criterion(flush, "entry-sequence").score);
  });

  it("does not count a garage or guest-pavilion door as the main entry", () => {
    const garageOnly = review(doc([mass("living"), mass("garage", { role: "garage", position: { x: 14, z: 0 }, width: 7, depth: 6, openings: [{ type: "door", facade: "north", start: 0.1, end: 0.9, height: 2.4 }] })]));
    expect(criterion(garageOnly, "entry-sequence").reason).toMatch(/no compiled main entry door/);
  });
});
