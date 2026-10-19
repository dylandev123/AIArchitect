import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import attempt0 from "./fixtures/cliffside-mansion-attempt-0.json";
import attempt1 from "./fixtures/cliffside-mansion-attempt-1.json";
import { ingestV3GenerationOutput } from "../ingestion";
import { compileV3Scene } from "../scene";
import { executeV3SceneOperations } from "../operations";
import { recoverV3FailedPreview } from "../failedPreview";
import { materialFromDescription } from "../intentCanonicalization";
import { v3NaturalGroundHeight } from "../grading";
import { BLANK_V3_SCENE } from "../scene";

/**
 * The two rejected live cliffside mansion responses (.v3-debug, 2026-10-15), replayed verbatim.
 * Attempt 0 was Terra's original plan; attempt 1 was its repair of the lossy normalized scene.
 */
const mansion = () => structuredClone(attempt0) as Record<string, unknown> & { objects: Record<string, unknown>[]; siteHierarchy: { levels: Record<string, unknown>[]; connections: Record<string, unknown>[] } };
const codes = (notes: { code: string; targetId: string }[]) => notes.map((note) => `${note.code}:${note.targetId}`);

describe("captured cliffside mansion replay", () => {
  it("accepts Terra's original plan without losing authored intent", () => {
    const result = ingestV3GenerationOutput(mansion());
    expect(result.validation.errors).toEqual([]);
    expect(result.ok).toBe(true);
    // Every authored object survives: nothing important is silently discarded.
    expect(result.scene.objects.map((object) => object.id)).toEqual(attempt0.objects.map((object) => object.id));
    expect(result.notes.filter((note) => note.code.endsWith("_OMITTED") || note.code === "COMPOSITION_FALLBACK")).toEqual([]);
    const byId = Object.fromEntries(result.scene.objects.map((object) => [object.id, object]));
    expect(byId["main-pavilion"]).toMatchObject({ levels: 2, roofForm: "flat", overhang: 2.4, composition: { massHierarchy: "primary", facadeRoles: { south: "view" } } });
    expect(byId["main-pavilion"].composition?.assemblies?.map((assembly) => assembly.id)).toEqual(["pavilion-view-balcony", "pavilion-terrace-colonnade"]);
    expect(byId["arrival-wing"].composition?.mainEntry).toEqual({ openingId: "arrival-entry-door", canopyDepth: 3.2 });
    expect(byId["arrival-wing"].composition?.openings?.find((opening) => opening.id === "arrival-entry-door")).toMatchObject({ type: "door", floors: "ground", frame: true });
    expect(byId["arrival-driveway"].material).toMatchObject({ surface: "concrete" });
    expect(byId["main-pavilion"].material).toMatchObject({ surface: "stone", color: "#d6ccb8" });
    expect(result.scene.site).toMatchObject({ width: 84, depth: 152, naturalGround: { fall: "z", grade: .38, cliff: { at: 57, drop: 25 } }, sea: { level: 0 } });
  });

  it("anchors the natural slope to the authored absolute levels instead of a zero datum", () => {
    const { scene, notes } = ingestV3GenerationOutput(mansion());
    expect(codes(notes)).toContain("NATURAL_GROUND_DATUM_DERIVED:site");
    // Authored level elevations are never moved; only the natural surface is anchored to them.
    expect(scene.siteHierarchy!.levels.map((level) => level.elevation)).toEqual([60, 50.1, 50.1, 46.5, 40, 35.5]);
    for (const level of scene.siteHierarchy!.levels) expect(Math.abs(v3NaturalGroundHeight(scene.site, level.region.x, level.region.z) - level.elevation)).toBeLessThan(12);
    expect(v3NaturalGroundHeight(scene.site, 0, 70)).toBeLessThan(5); // the cliff still drops to the sea
  });

  it("derives level regions only from authored geometry and routes, and keeps connections typed", () => {
    const { scene, notes } = ingestV3GenerationOutput(mansion());
    expect(notes.filter((note) => note.code === "SITE_LEVEL_REGION_DERIVED")).toHaveLength(6);
    const level = (id: string) => scene.siteHierarchy!.levels.find((candidate) => candidate.id === id)!;
    expect(level("pool-deck-level").region).toEqual({ x: -2.5, z: 31, width: 25, depth: 12 });
    expect(level("upper-road").region).toMatchObject({ x: -2, z: -56 });
    expect(scene.siteHierarchy!.connections.map((connection) => [connection.id, connection.type])).toEqual([["upper-road-drive", "driveway"], ["arrival-walk", "path"]]);
  });

  it("also accepts the degraded repair attempt that failed live with INVALID_SITE_LEVEL", () => {
    const result = ingestV3GenerationOutput(structuredClone(attempt1));
    expect(result.validation.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.scene.objects).toHaveLength(18);
  });

  it("is deterministic, idempotent, persistable and locally editable", () => {
    const first = ingestV3GenerationOutput(mansion()), second = ingestV3GenerationOutput(mansion());
    expect(second.scene).toEqual(first.scene);
    const reingested = ingestV3GenerationOutput(JSON.parse(JSON.stringify(first.scene)));
    expect(reingested.ok).toBe(true);
    expect(reingested.scene).toEqual(first.scene);
    const compiled = compileV3Scene(first.scene);
    expect(compileV3Scene(JSON.parse(JSON.stringify(first.scene)))).toEqual(compiled);
    expect(compiled.primitives.length).toBeGreaterThan(100);
    const edit = executeV3SceneOperations(first.scene, { intent: "Raise the pavilion", operations: [{ op: "editArchitecture", target: "main-pavilion", architecture: { height: 7.6 } }] });
    expect(edit.errors).toEqual([]);
    expect(edit.scene.objects.find((object) => object.id === "main-pavilion")!.architecture!.height).toBe(7.6);
    expect(edit.scene.objects.filter((object) => object.id !== "main-pavilion")).toEqual(first.scene.objects.filter((object) => object.id !== "main-pavilion"));
  });

  it("previews the same objects that persistence accepts", () => {
    const accepted = ingestV3GenerationOutput(mansion());
    const preview = recoverV3FailedPreview(mansion());
    expect(preview).toBeDefined();
    expect(preview!.scene.objects.map((object) => object.id)).toEqual(accepted.scene.objects.map((object) => object.id));
    expect(preview!.diagnostics.skippedObjectIds).toEqual([]);
  });
});

describe("V3 provider-shape canonicalization", () => {
  it("rejects a level whose region cannot be derived and that something depends on", () => {
    const input = mansion();
    input.siteHierarchy.levels.push({ id: "orphan", elevation: 12, region: {} });
    input.siteHierarchy.connections.push({ id: "orphan-path", type: "path", fromLevelId: "orphan", toLevelId: "orphan", width: 2, route: [] });
    const result = ingestV3GenerationOutput(input);
    expect(result.ok).toBe(false);
    expect(result.validation.errors.join("\n")).toContain("INVALID_SITE_LEVEL [orphan]");
  });

  it("omits, with a reason, an unreferenced level that has no derivable region", () => {
    const input = mansion();
    input.siteHierarchy.levels.push({ id: "unused-lookout", elevation: 70 });
    const result = ingestV3GenerationOutput(input);
    expect(result.ok).toBe(true);
    expect(codes(result.notes)).toContain("SITE_LEVEL_OMITTED:unused-lookout");
  });

  it("keeps a malformed authored site extent fatal but derives an absent one", () => {
    const malformed = mansion();
    (malformed.site as Record<string, unknown>).width = "wide";
    expect(ingestV3GenerationOutput(malformed).validation.errors.join()).toContain("Site needs finite positive width and depth");
    const absent = mansion();
    delete (absent.site as Record<string, unknown>).boundary;
    const result = ingestV3GenerationOutput(absent);
    expect(result.ok).toBe(true);
    expect(codes(result.notes)).toContain("SITE_EXTENT_DERIVED:site");
    expect(result.scene.site.depth).toBeGreaterThanOrEqual(2 * 56);
  });

  it("omits an optional malformed site object but never a primary building mass", () => {
    const optional = mansion();
    (optional.objects.find((object) => object.id === "lower-garden")!.architecture as Record<string, unknown>).width = 0;
    const kept = ingestV3GenerationOutput(optional);
    expect(kept.ok).toBe(true);
    expect(codes(kept.notes)).toContain("SITE_OBJECT_OMITTED:lower-garden");
    expect(kept.scene.objects).toHaveLength(17);

    const building = mansion();
    (building.objects.find((object) => object.id === "main-pavilion")!.architecture as Record<string, unknown>).depth = -13;
    const rejected = ingestV3GenerationOutput(building);
    expect(rejected.ok).toBe(false);
    expect(rejected.validation.errors.join()).toContain("main-pavilion");
  });

  it("drives connection surfaces from an untyped connection without inventing route geometry", () => {
    const input = mansion();
    const result = ingestV3GenerationOutput(input);
    const drive = result.scene.objects.find((object) => object.id === "arrival-driveway")!;
    expect(drive.type).toBe("driveway");
    expect(result.scene.siteHierarchy!.connections[0].route).toEqual(attempt0.siteHierarchy.connections[0].route);
  });

  it("retains malformed entries for rejection without discarding valid composition", () => {
    const input = mansion();
    const architecture = input.objects.find((object) => object.id === "primary-suite-wing")!.architecture as { composition: { openings: Record<string, unknown>[] } };
    architecture.composition.openings.push({ id: "broken", type: "glazing-zone", facade: "up", start: 2 });
    const { scene, notes, ok } = ingestV3GenerationOutput(input);
    expect(ok).toBe(false);
    expect(codes(notes)).toContain("INVALID_COMPOSITION_ENTRY:primary-suite-wing");
    expect(scene.objects.find((object) => object.id === "primary-suite-wing")!.composition!.openings!.map((opening) => opening.id)).toEqual(["suite-south-glazing", "suite-east-rhythm", "suite-west-door", "broken"]);
  });

  it("reads finish descriptions by their primary clause", () => {
    expect(materialFromDescription("pale limestone, dark bronze glazing, and teak")).toMatchObject({ surface: "stone", color: "#d6ccb8" });
    expect(materialFromDescription("honed charcoal basalt")).toMatchObject({ surface: "stone", color: "#4a4744" });
    expect(materialFromDescription("deep cobalt mosaic and clear water")).toMatchObject({ surface: "water" });
  });
});

describe("captured mansion persistence", () => {
  const data = new Map<string, string>();
  beforeEach(() => {
    data.clear();
    const localStorage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), removeItem: (key: string) => void data.delete(key) };
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("commits atomically and reloads identically", async () => {
    vi.resetModules();
    const projects = (await import("@/store/useProjectStore")).useProjectStore;
    const project = projects.getState().createProject("Cliffside mansion", "house", "v3-scene");
    const { scene } = ingestV3GenerationOutput(mansion());
    const json = JSON.stringify({ ...structuredClone(BLANK_V3_SCENE), v3Scene: scene });
    projects.getState().appendVersion(project.id, "Captured mansion", json);
    vi.resetModules();
    const reloaded = (await import("@/store/useProjectStore")).useProjectStore;
    const restored = JSON.parse(reloaded.getState().getProject(project.id)!.houseConfigJson);
    expect(restored.v3Scene).toEqual(scene);
    expect(compileV3Scene(restored.v3Scene)).toEqual(compileV3Scene(scene));
  });
});
