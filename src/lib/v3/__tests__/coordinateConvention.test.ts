import { describe, expect, it } from "vitest";
import { resolveV3EffectiveSupport } from "../derivedSupport";
import { ingestV3GenerationOutput } from "../ingestion";
import { normalizeV3GenerationOutput } from "../generation";
import { executeV3SceneOperations } from "../operations";
import { getV3PresentationBounds } from "../presentation";
import { compileV3Scene, type V3Scene } from "../scene";
import { validateV3Scene } from "../validation";
import { V3_SCENE_ARCHITECT_PROMPT, v3SceneOutputSchema } from "../schema";

const stone = { id: "limewash", color: "#c9c0b2", roughness: .72, surface: "stucco" } as const;
const paving = { id: "paving", color: "#b5aa98", roughness: .76, surface: "paving" } as const;
const glass = { id: "glass", color: "#8fbdc9", roughness: .1, opacity: .42, surface: "glass" } as const;
const water = { id: "water", color: "#2c88a8", roughness: .16, opacity: .86, surface: "water" } as const;

const architecture = (x: number, z: number, baseElevation: number, width: number, depth: number, height: number) => ({ x, z, baseElevation, width, depth, height });
const named = (id: string, type: string, geometry: ReturnType<typeof architecture>, extra: Record<string, unknown> = {}) => ({
  id, type, semanticRole: id.replaceAll("-", " "), label: id.replaceAll("-", " "), geometryKind: type === "pool" ? "water" : type === "terrace" ? "slab" : "box",
  architecture: geometry, material: stone, collision: type === "terrace" ? "walkable" : type === "pool" ? "water" : "solid", ...extra,
});

/** Exact cottage proportions from the bad real run, now authored in named plan/elevation fields. */
const cottageOutput = () => ({
  version: 3,
  site: { width: 60, depth: 50, baseElevation: 0, groundColor: "#557149" },
  siteHierarchy: {
    levels: [{ id: "ground", elevation: 0, region: { x: 0, z: 0, width: 60, depth: 50 }, supportType: "terrain", access: "entry" }],
    connections: [], transitions: [],
  },
  relationships: [],
  objects: [
    // Deliberately retain the real run's wrong-order arrays alongside named
    // geometry: the normalization boundary must ignore those arrays.
    named("main-pavilion", "building-mass", architecture(2.5, 2.1, 0, 10, 5.8, 3.16), {
      transform: { position: [2.5, 2.1, 1.82], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [10, 5.8, 3.16],
      levels: 1, facadePreset: "glass-heavy", roofForm: "flat",
      support: { kind: "object", hostId: "timber-accent-wall", relationship: "rests-on", grounding: "grounded" },
    }),
    named("bedroom-wing", "building-mass", architecture(-5.1, 2.9, 0, 4.9, 7.4, 2.96), {
      transform: { position: [-5.1, 2.9, 1.72], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [4.9, 7.4, 2.96],
      levels: 1, facadePreset: "privacy", facadeSouth: "glass-heavy", roofForm: "flat",
    }),
    named("veranda", "terrace", architecture(2.5, 6, 0, 10, 2, .24), { material: paving }),
    named("veranda-canopy", "canopy", architecture(2.5, 6, 0, 9.6, 1.8, 2.8), { material: { ...stone, id: "canopy", color: "#3f4648", surface: "metal" } }),
    named("pavilion-roof", "roof-form", architecture(2.5, 2.1, 3.16, 10, 5.8, .24), { roofForm: "flat", overhang: .6 }),
    named("view-glazing", "glass-wall", architecture(2.5, 5.01, .24, 7.2, .12, 2.5), { material: glass, collision: "passable", support: { kind: "object", hostId: "main-pavilion", relationship: "attached-to", grounding: "grounded" } }),
    named("plunge-pool", "pool", architecture(2.5, 9.2, 0, 4.2, 2.8, 1.35), { material: water }),
    {
      id: "timber-accent-wall", type: "wall", semanticRole: "timber accent wall", label: "timber accent wall", geometryKind: "box",
      transform: { position: [8.2, -.5, 2.1], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [.2, 1, 2],
      material: { ...stone, id: "timber", color: "#76543a", surface: "wood" }, collision: "solid",
    },
    {
      id: "garden-sculpture", type: "kinetic-artwork", semanticRole: "kinetic garden artwork", label: "kinetic garden artwork", geometryKind: "proxy",
      transform: { position: [-9, 1.2, 8], rotation: [0, .2, 0], scale: [1, 1, 1] }, dimensions: [1.2, 2.4, 1.2],
      material: { ...stone, id: "bronze", color: "#735a42", surface: "metal" }, collision: "solid",
    },
  ],
});

describe("V3 canonical coordinate and dimension authority", () => {
  it("states the array convention explicitly while accepting named high-level provider geometry without arrays", () => {
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("X is left/right");
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("Y is vertical elevation");
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("Z is forward/back");
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("transform.position is [x,y,z]");
    expect(V3_SCENE_ARCHITECT_PROMPT).toContain("dimensions are [width,height,depth]");
    const raw = cottageOutput();
    raw.objects = raw.objects.filter((object) => object.id === "veranda");
    expect(v3SceneOutputSchema.safeParse(raw).success).toBe(true);
  });

  it("compiles the named cottage with horizontal footprints, vertical heights, inferred support, and realistic bounds", () => {
    const prepared = ingestV3GenerationOutput(cottageOutput());
    expect(prepared.ok, [...prepared.validation.errors, ...(prepared.geometryAudit?.errors ?? [])].join("\n")).toBe(true);
    const scene = prepared.scene;
    const main = scene.objects.find((object) => object.id === "main-pavilion")!;
    const wing = scene.objects.find((object) => object.id === "bedroom-wing")!;
    expect(main.transform.position).toEqual([2.5, 1.58, 2.1]);
    expect(main.dimensions).toEqual([10, 3.16, 5.8]);
    expect(wing.transform.position).toEqual([-5.1, 1.48, 2.9]);
    expect(wing.dimensions).toEqual([4.9, 2.96, 7.4]);
    // The incompatible hint is dropped; ordinary support is derived at compile time and never persisted.
    expect(main.support).toBeUndefined();
    const derived = resolveV3EffectiveSupport(scene).derived;
    expect(derived.get("main-pavilion")?.support).toMatchObject({ kind: "terrain", levelId: "ground" });
    expect(derived.get("main-pavilion")?.support.hostId).toBeUndefined();
    expect(derived.get("pavilion-roof")?.support).toMatchObject({ hostId: "main-pavilion", relationship: "rests-on" });
    expect(derived.get("veranda-canopy")?.support).toMatchObject({ hostId: "veranda", relationship: "rests-on" });
    expect(prepared.notes).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SUPPORT_HINT_REPLACED", targetId: "main-pavilion" })]));

    const model = compileV3Scene(scene);
    const mainFloor = model.primitives.find((primitive) => primitive.id === "main-pavilion-slab-1");
    const mainRoof = model.primitives.find((primitive) => primitive.id === "main-pavilion-roof-plate");
    const explicitRoof = model.primitives.find((primitive) => primitive.id === "pavilion-roof-roof-plate");
    const glazing = model.primitives.find((primitive) => primitive.sourceObjectId === "view-glazing" && primitive.componentRole === "facade glazing");
    const poolWater = model.primitives.find((primitive) => primitive.id === "plunge-pool-water");
    expect(mainFloor).toMatchObject({ kind: "box", position: [2.5, .13, 2.1], size: [10, .26, 5.8] });
    expect(mainRoof).toBeUndefined(); // Explicit hosted roof owns this coverage.
    expect(explicitRoof).toMatchObject({ kind: "box", size: [10.5, .24, 6.3] }); // authored plate thickness
    expect(explicitRoof?.kind === "box" ? explicitRoof.position[1] : -1).toBeCloseTo(3.28, 8);
    expect(glazing?.kind).toBe("box");
    if (glazing?.kind === "box") { expect(glazing.size[2]).toBeCloseTo(7.1); expect(glazing.size[1]).toBeCloseTo(2.15); expect(glazing.size[0]).toBeCloseTo(.03); }
    expect(poolWater?.kind).toBe("triMesh");
    if (poolWater?.kind === "triMesh") expect(new Set(poolWater.vertices.filter((_, index) => index % 3 === 1))).toEqual(new Set([1.31]));
    expect(model.primitives.find((primitive) => primitive.id === "garden-sculpture")).toMatchObject({ kind: "box", size: [1.2, 2.4, 1.2], componentRole: "render proxy" });

    const bounds = getV3PresentationBounds(scene, model);
    expect(bounds.size[0]).toBeGreaterThan(bounds.size[1]);
    expect(bounds.size[2]).toBeGreaterThan(bounds.size[1]);
    expect(bounds.size[1]).toBeGreaterThan(3);
    expect(bounds.size[1]).toBeLessThan(6);
  });

  it("keeps legacy canonical arrays byte-for-byte equivalent at compile time", () => {
    const legacy: V3Scene = {
      version: 3, site: { width: 40, depth: 40, baseElevation: 0 }, relationships: [], metadata: {},
      objects: [{
        id: "legacy-mass", type: "building-mass", semanticRole: "legacy mass", label: "legacy mass",
        transform: { position: [4, 2, -3], rotation: [0, .15, 0], scale: [1, 1, 1] }, dimensions: [8, 4, 6],
        material: stone, collision: "solid", levels: 1, facadePreset: "punched", roofForm: "flat",
      }],
    };
    const normalized = normalizeV3GenerationOutput(structuredClone(legacy)).scene;
    expect(normalized.objects[0].architecture).toBeUndefined();
    expect(normalized.objects[0].transform).toEqual(legacy.objects[0].transform);
    expect(normalized.objects[0].dimensions).toEqual(legacy.objects[0].dimensions);
    expect(compileV3Scene(normalized).primitives).toEqual(compileV3Scene(legacy).primitives);
  });

  it("edits named dimensions and elevations, then rederives runtime arrays and compiler children", () => {
    const scene = ingestV3GenerationOutput(cottageOutput()).scene;
    const edited = executeV3SceneOperations(scene, { intent: "Widen the bedroom wing and raise the roof", operations: [
      { op: "editArchitecture", target: "bedroom-wing", architecture: { width: 6.9 } },
      { op: "editArchitecture", target: "pavilion-roof", architecture: { baseElevation: 3.46 } },
    ] });
    expect(edited.ok, edited.errors.join("\n")).toBe(true);
    const wing = edited.scene.objects.find((object) => object.id === "bedroom-wing")!;
    const roof = edited.scene.objects.find((object) => object.id === "pavilion-roof")!;
    expect(wing.architecture?.width).toBe(6.9);
    expect(wing.dimensions).toEqual([6.9, 2.96, 7.4]);
    expect(roof.architecture?.baseElevation).toBe(3.46);
    expect(roof.transform.position[1]).toBe(3.58);
    expect(compileV3Scene(edited.scene).primitives.find((primitive) => primitive.id === "bedroom-wing-slab-1")).toMatchObject({ kind: "box", size: [6.9, .26, 7.4] });
  });

  it("rejects any persisted width/depth-to-height drift when named geometry is authoritative", () => {
    const scene = ingestV3GenerationOutput(cottageOutput()).scene;
    const main = scene.objects.find((object) => object.id === "main-pavilion")!;
    main.dimensions = [10, 5.8, 3.16];
    expect(validateV3Scene(scene).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "ARCHITECTURE_RUNTIME_DRIFT", targetId: "main-pavilion" })]));
  });
});
