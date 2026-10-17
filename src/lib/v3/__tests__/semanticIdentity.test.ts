import { describe, expect, it } from "vitest";
import { ingestV3GenerationOutput } from "../ingestion";
import { compileV3Scene, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from "../scene";
import { executeV3SceneOperations } from "../operations";
import { resolveV3EffectiveSupport } from "../derivedSupport";
import { isKnownV3CompilerType, registerV3Capability, v3CategoryFor, v3ObjectDependencies } from "../capabilities";
import { resolveV3Renderable } from "../renderability";
import { validateV3Scene } from "../validation";
import type { V3Composition } from "../composition";
import { buildMassOpenings } from "@/lib/architecture/geometry/openings";
import type { HousePrimitive } from "@/lib/house/types";

const stone = { id: "stone", color: "#c7bca9" };
const mass = (id: string, x: number, composition?: V3Composition, extra: Record<string, unknown> = {}) => ({
  id, type: "building-mass", semanticRole: "wing", label: id, material: stone, levels: 2,
  architecture: { x, z: 0, baseElevation: 0, width: 12, depth: 8, height: 6 }, ...(composition ? { composition } : {}), ...extra,
});
const glazing = (id: string, start: number, end: number, facade: "north" | "south" | "east" | "west" = "south") => ({ id, type: "glazing-zone" as const, facade, start, end, heightRatio: .7 });
const ingest = (objects: unknown[], extra: Record<string, unknown> = {}) => {
  const prepared = ingestV3GenerationOutput({ version: 3, site: { width: 120, depth: 120 }, relationships: [], objects, ...extra });
  expect(prepared.ok, JSON.stringify([prepared.validation.errors, prepared.geometryAudit?.errors])).toBe(true);
  return prepared.scene;
};
const partsOf = (scene: V3Scene, objectId: string) => compileV3Scene(scene).primitives.filter((primitive) => primitive.sourceObjectId === objectId);
const idsFor = (primitives: readonly HousePrimitive[], openingId: string) => primitives.map((primitive) => primitive.id).filter((id) => id.includes(`:${openingId}:`)).sort();
const byId = (scene: V3Scene, id: string) => scene.objects.find((object) => object.id === id)!;

describe("V3 semantic identity: derived support never becomes authored authority", () => {
  const supportScene = () => ingest([
    { id: "deck", type: "terrace", semanticRole: "pool deck", label: "Deck", material: stone, architecture: { x: 0, z: 0, baseElevation: 0, width: 20, depth: 14, height: .4 } },
    { id: "spa", type: "pool", semanticRole: "spa", label: "Spa", material: { id: "water", color: "#2b7c95" }, architecture: { x: 0, z: 0, baseElevation: -.8, width: 4, depth: 3, height: 1.2 } },
    { id: "sculpture", type: "proxy-asset", semanticRole: "sculpture", label: "Sculpture", material: stone, transform: { position: [5, 1.4, 4], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [1, 2, 1] },
  ]);

  it("does not persist inferred support as authored intent, while compile/audit still resolve it", () => {
    const scene = supportScene();
    for (const object of scene.objects) expect(object.support, object.id).toBeUndefined();
    const { derived } = resolveV3EffectiveSupport(scene);
    expect(derived.get("sculpture")?.support).toMatchObject({ hostId: "deck", relationship: "rests-on" });
    expect(JSON.stringify(scene)).not.toContain("rests-on");
    expect(validateV3Scene(scene, { lenient: true }).ok).toBe(true);
  });

  it("keeps explicit authored suspended, cantilevered and embedded support", () => {
    const scene = ingest([
      mass("wing", 0),
      { id: "balcony", type: "balcony", semanticRole: "balcony", label: "Balcony", material: stone, architecture: { x: 0, z: 5, baseElevation: 3, width: 4, depth: 2, height: .3 }, support: { kind: "object", hostId: "wing", relationship: "cantilevered-from", grounding: "cantilevered", levelId: "" } },
      { id: "lantern", type: "proxy-asset", semanticRole: "hanging lantern", label: "Lantern", material: stone, transform: { position: [2, 5.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [.5, 1, .5], support: { kind: "object", hostId: "wing", relationship: "suspended-from", grounding: "suspended", levelId: "" } },
      { id: "cellar", type: "volume", semanticRole: "cellar", label: "Cellar", material: stone, transform: { position: [-3, -1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [4, 3, 4], support: { kind: "object", hostId: "wing", relationship: "embedded-in", grounding: "embedded", levelId: "" } },
    ]);
    const reloaded = JSON.parse(JSON.stringify(scene)) as V3Scene;
    for (const target of [scene, reloaded]) {
      expect(byId(target, "balcony").support).toMatchObject({ hostId: "wing", relationship: "cantilevered-from", grounding: "cantilevered" });
      expect(byId(target, "lantern").support).toMatchObject({ hostId: "wing", relationship: "suspended-from", grounding: "suspended" });
      expect(byId(target, "cellar").support).toMatchObject({ hostId: "wing", relationship: "embedded-in", grounding: "embedded" });
      expect(resolveV3EffectiveSupport(target).derived.has("balcony")).toBe(false);
    }
  });

  it("save/reload preserves the authored/derived distinction and derivation", () => {
    const scene = supportScene();
    const reloaded = JSON.parse(JSON.stringify(scene)) as V3Scene;
    expect(reloaded).toEqual(scene);
    expect(reloaded.objects.every((object) => object.support === undefined)).toBe(true);
    expect([...resolveV3EffectiveSupport(reloaded).derived]).toEqual([...resolveV3EffectiveSupport(scene).derived]);
    expect(compileV3Scene(reloaded)).toEqual(compileV3Scene(scene));
  });

  it("changing nearby geometry re-derives support instead of keeping a stale persisted guess", () => {
    const scene = supportScene();
    expect(resolveV3EffectiveSupport(scene).derived.get("sculpture")?.support.hostId).toBe("deck");
    const moved = executeV3SceneOperations(scene, { intent: "move the deck away", operations: [{ op: "move", target: "deck", position: [-40, .2, -40] }] });
    expect(moved.ok, moved.errors.join("\n")).toBe(true);
    expect(byId(moved.scene, "sculpture").support).toBeUndefined();
    expect(resolveV3EffectiveSupport(moved.scene).derived.get("sculpture")?.support.hostId).not.toBe("deck");
  });

  it("does not re-evaluate authored hints on objects an edit did not touch", () => {
    const scene = supportScene();
    // A stale-but-authored hint on an unrelated object must survive an unrelated local edit untouched.
    byId(scene, "sculpture").support = { kind: "object", hostId: "spa", relationship: "rests-on" };
    const before = JSON.stringify(byId(scene, "sculpture"));
    const edited = executeV3SceneOperations(scene, { intent: "recolour spa", operations: [{ op: "changeMaterial", target: "spa", material: { id: "teal", color: "#1b8a8a" } }] });
    expect(edited.ok, edited.errors.join("\n")).toBe(true);
    expect(JSON.stringify(byId(edited.scene, "sculpture"))).toBe(before);
  });
});

describe("V3 semantic identity: composition child ids are anchored to authored openings", () => {
  const withOpenings = (openings: ReturnType<typeof glazing>[]) => ingest([mass("main-wing", 0, { openings })]);
  const A = glazing("view-a", .05, .2), B = glazing("view-b", .4, .55), C = glazing("view-c", .75, .9), X = glazing("view-x", .25, .35);

  it("uses massId:openingId:level:componentRole ids", () => {
    const ids = partsOf(withOpenings([A]), "main-wing").map((primitive) => primitive.id);
    expect(ids).toEqual(expect.arrayContaining(["main-wing:view-a:level-0:glass", "main-wing:view-a:level-0:frame-left", "main-wing:view-a:level-0:frame-right", "main-wing:view-a:level-1:glass", "main-wing:south:level-0:wall", "main-wing:south:level-0:wall-after-view-a"]));
    expect(ids.some((id) => /window-\d/.test(id))).toBe(false);
    const door = partsOf(ingest([mass("main-wing", 0, { openings: [{ id: "entry-door", type: "door", facade: "north", start: .4, end: .55 }] })]), "main-wing").map((primitive) => primitive.id);
    expect(door).toEqual(expect.arrayContaining(["main-wing:entry-door:level-0:door-frame", "main-wing:entry-door:level-0:door-panel"]));
  });

  it("inserting an opening before B leaves every derived id of A, B and C identical", () => {
    const before = partsOf(withOpenings([A, B, C]), "main-wing"), after = partsOf(withOpenings([A, X, B, C]), "main-wing");
    for (const id of [A.id, B.id, C.id]) {
      expect(idsFor(before, id).length, id).toBeGreaterThan(0);
      expect(idsFor(after, id), id).toEqual(idsFor(before, id));
      // Their geometry is also untouched: only the solid wall span next to X changes shape.
      for (const primitive of before.filter((candidate) => candidate.id.includes(`:${id}:`))) expect(after.find((candidate) => candidate.id === primitive.id)).toEqual(primitive);
    }
    const created = after.map((primitive) => primitive.id).filter((id) => !before.some((primitive) => primitive.id === id));
    expect(created.length).toBeGreaterThan(0);
    expect(created.every((id) => id.includes(":view-x:") || id.endsWith(":wall-after-view-x"))).toBe(true);
  });

  it("removing, moving or resizing B does not rename A or C", () => {
    const base = partsOf(withOpenings([A, B, C]), "main-wing");
    for (const variant of [[A, C], [A, { ...B, start: .45, end: .6 }, C], [A, { ...B, end: .65, heightRatio: .5 }, C]]) {
      const next = partsOf(withOpenings(variant), "main-wing");
      for (const id of [A.id, C.id]) expect(idsFor(next, id), id).toEqual(idsFor(base, id));
    }
  });

  it("save/reload and material changes preserve every derived id", () => {
    const scene = withOpenings([A, B, C]);
    const ids = partsOf(scene, "main-wing").map((primitive) => primitive.id);
    expect(partsOf(JSON.parse(JSON.stringify(scene)), "main-wing").map((primitive) => primitive.id)).toEqual(ids);
    const recoloured = executeV3SceneOperations(scene, { intent: "darker stone", operations: [{ op: "changeMaterial", target: "main-wing", material: { id: "basalt", color: "#3a3a3a" } }] });
    expect(recoloured.ok, recoloured.errors.join("\n")).toBe(true);
    expect(partsOf(recoloured.scene, "main-wing").map((primitive) => primitive.id)).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps sourceObjectId and componentRole on semantic children", () => {
    for (const primitive of partsOf(withOpenings([A]), "main-wing").filter((candidate) => candidate.id.includes(":view-a:"))) {
      expect(primitive.sourceObjectId).toBe("main-wing");
      expect(["facade glazing", "glazing frame", "facade wall"]).toContain(primitive.componentRole);
    }
  });

  it("leaves V2 positional ids byte-identical", () => {
    const paint = { color: "#cccccc", roughness: .7, metalness: 0 };
    const ids = buildMassOpenings([{ facade: "south", a: [-6, 4], b: [6, 4] }], 12, 8, [{ type: "glazing-zone", facade: "south", start: .1, end: .3, heightRatio: .7 }, { type: "door", facade: "south", start: .5, end: .6 }], 0, 0, 3, "wall-0", { exterior: paint, trim: paint, glass: paint }).primitives.map((primitive) => primitive.id);
    expect(ids).toEqual(["wall-0-south-0", "wall-0-south-1-sill-wall", "wall-0-south-1-head-wall", "wall-0-south-window-0-frame-jamb-0", "wall-0-south-window-0-frame-jamb-1", "wall-0-south-window-0-frame-head", "wall-0-south-window-0-frame-sill", "wall-0-south-window-0-glass", "wall-0-south-2", "wall-0-south-3-head-wall", "wall-0-south-door-1-frame", "wall-0-south-door-1-panel", "wall-0-south-door-1-surround-0", "wall-0-south-door-1-surround-1", "wall-0-south-4"]);
  });
});

describe("V3 capability registry", () => {
  it("adding a capability is one registration: dispatch, category, renderability and known-type all follow", () => {
    const object: V3SceneObject = { id: "kiosk", type: "test-kiosk", semanticRole: "kiosk", label: "Kiosk", transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [2, 2, 2], material: stone };
    const scene: V3Scene = { version: 3, site: { width: 40, depth: 40 }, objects: [object], relationships: [], metadata: {} };
    expect(isKnownV3CompilerType("test-kiosk")).toBe(false);
    expect(resolveV3Renderable(object).strategy).not.toBe("specialized");
    const undo = registerV3Capability("test-kiosk", {
      category: "roof", renderability: "specialized",
      compile: (o) => [{ kind: "box", id: `${o.id}:kiosk-roof`, category: v3CategoryFor(o.type), label: o.label, position: o.transform.position, rotation: o.transform.rotation, size: o.dimensions, color: o.material.color, sourceObjectId: o.id, componentRole: "kiosk roof" }],
      dependsOn: () => ["neighbour"],
    });
    try {
      expect(isKnownV3CompilerType("test-kiosk")).toBe(true);
      expect(resolveV3Renderable(object)).toMatchObject({ strategy: "specialized", specializedType: "test-kiosk" });
      expect(v3CategoryFor("test-kiosk")).toBe("roof");
      expect(compileV3Scene(scene).primitives.find((primitive) => primitive.sourceObjectId === "kiosk")).toMatchObject({ id: "kiosk:kiosk-roof", category: "roof" });
      expect(v3ObjectDependencies(object, scene)).toEqual(["neighbour"]);
      expect(validateV3Scene(scene, { lenient: true }).warnings.some((warning) => warning.includes("FALLBACK_RENDER_USED"))).toBe(false);
    } finally { undo(); }
    expect(isKnownV3CompilerType("test-kiosk")).toBe(false);
  });

  it("unknown semantic objects still render through generic/proxy fallback", () => {
    const scene = ingest([
      { id: "hammock", type: "hammock", semanticRole: "hammock between palms", label: "Hammock", material: stone, transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [3, .4, 1.2] },
      { id: "obelisk", semanticRole: "obelisk", label: "Obelisk", geometryKind: "proxy", material: stone, transform: { position: [8, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [1, 4, 1] },
    ]);
    const model = compileV3Scene(scene);
    for (const id of ["hammock", "obelisk"]) {
      expect(isKnownV3CompilerType(byId(scene, id).type) && byId(scene, id).type !== "proxy-asset").toBe(false);
      expect(model.primitives.some((primitive) => primitive.sourceObjectId === id), id).toBe(true);
    }
    expect(resolveV3Renderable(byId(scene, "hammock")).strategy).toBe("generic");
    expect(validateV3CompiledGeometry(scene, model, { lenient: true }).ok).toBe(true);
  });

  it("declares cross-object dependencies for pool cutouts, roof clearance and shared roof material", () => {
    const scene = ingest([
      mass("main-wing", 0), mass("guest-wing", 14),
      { id: "main-roof", type: "roof-form", semanticRole: "roof", label: "Roof", material: stone, hostId: "main-wing", roofForm: "flat", architecture: { x: 0, z: 0, baseElevation: 6, width: 12, depth: 8, height: .4 } },
      { id: "deck", type: "terrace", semanticRole: "deck", label: "Deck", material: stone, architecture: { x: 0, z: 20, baseElevation: 0, width: 16, depth: 10, height: .4 } },
      { id: "pool", type: "pool", semanticRole: "pool", label: "Pool", material: { id: "water", color: "#2b7c95" }, architecture: { x: 0, z: 20, baseElevation: -1.2, width: 8, depth: 4, height: 1.6 } },
    ]);
    expect(v3ObjectDependencies(byId(scene, "deck"), scene)).toEqual(["pool"]);
    expect(v3ObjectDependencies(byId(scene, "main-wing"), scene).sort()).toEqual(["guest-wing", "main-roof"]);
    expect(v3ObjectDependencies(byId(scene, "main-roof"), scene).sort()).toEqual(["guest-wing", "main-wing"]);
    expect(v3ObjectDependencies(byId(scene, "pool"), scene)).toEqual([]);
  });
});

describe("V3 scoped edits remain atomic and local", () => {
  const twoWings = () => ingest([mass("main-wing", 0, { openings: [glazing("view-a", .1, .4)] }), mass("guest-wing", 30, { openings: [glazing("view-g", .2, .6)] })]);

  it("a scoped semantic edit leaves unrelated authored and compiled objects byte-identical", () => {
    const scene = twoWings();
    const edited = executeV3SceneOperations(scene, { intent: "add a view window", operations: [{ op: "setComposition", target: "main-wing", composition: { openings: [glazing("view-a", .1, .4), glazing("view-b", .6, .8)] } }] });
    expect(edited.ok, edited.errors.join("\n")).toBe(true);
    expect(JSON.stringify(byId(edited.scene, "guest-wing"))).toBe(JSON.stringify(byId(scene, "guest-wing")));
    expect(JSON.stringify(partsOf(edited.scene, "guest-wing"))).toBe(JSON.stringify(partsOf(scene, "guest-wing")));
    expect(idsFor(partsOf(edited.scene, "main-wing"), "view-a")).toEqual(idsFor(partsOf(scene, "main-wing"), "view-a"));
    expect(edited.scene.objects.every((object) => object.support === undefined)).toBe(true);
  });

  it("a failing operation rolls the whole plan back", () => {
    const scene = twoWings(), snapshot = JSON.stringify(scene);
    const result = executeV3SceneOperations(scene, { intent: "partial", operations: [{ op: "changeMaterial", target: "main-wing", material: { id: "basalt", color: "#3a3a3a" } }, { op: "delete", target: "missing" }] });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result.scene)).toBe(snapshot);
    expect(JSON.stringify(scene)).toBe(snapshot);
  });
});
