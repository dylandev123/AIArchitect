import { describe, expect, it } from "vitest";
import { Output } from "ai";
import { compileV3Scene, validateV3CompiledGeometry } from "../scene";
import { v3SceneOutputSchema } from "../schema";
import { normalizeV3GenerationOutput, repairV3GeneratedScene, summarizeV3Generation } from "../generation";
import { validateV3Scene } from "../validation";
import { resolveSupportSurface } from "../supportGraph";

const material = { id: "stone", color: "#817a70", surface: "stone" };
const none = { kind: "none", levelId: "", hostId: "", relationship: "none", grounding: "grounded" };
const level = (levelId: string) => ({ kind: "pad", levelId, hostId: "", relationship: "none", grounding: "grounded" });
const item = (id: string, type: string, position: number[], dimensions: number[], support: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id, type, semanticRole: id, label: id, transform: { position, rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions, material, collision: "solid", support, ...extra,
});

/** A mansion-shaped model response that is structurally valid but physically imperfect in five ways. */
const imperfectMansion = () => ({
  version: 3,
  site: { width: 120, depth: 100, baseElevation: 0 },
  siteHierarchy: {
    levels: [
      { id: "ground", elevation: 0, region: { x: 0, z: 0, width: 80, depth: 60 }, supportType: "pad", access: "arrival" },
      { id: "gate", elevation: 3, region: { x: 0, z: 40, width: 20, depth: 10 }, supportType: "pad", access: "entry" },
    ],
    // 20% grade, no explicit maxGrade: past the preferred 15% driveway grade.
    connections: [{ id: "drive", fromLevelId: "gate", toLevelId: "ground", type: "driveway", width: 4, route: [[0, 3, 40], [0, 0, 25]] }],
    transitions: [],
  },
  objects: [
    item("hillside", "terrain-region", [0, 0, 0], [120, 1, 100], none, { terrainOperation: "slopeRegion", terrainRise: 0, terrainDirection: "z", collision: "walkable" }),
    item("wing", "volume", [0, 3, 0], [16, 6, 12], level("ground")),
    // (1) Missing support host: names an object that does not exist.
    item("spa", "proxy-asset", [20, .5, 0], [3, 1, 3], { kind: "object", levelId: "", hostId: "ghost-deck", relationship: "rests-on", grounding: "grounded" }),
    // (2) Balcony without any explicit support or host.
    item("balcony", "slab", [0, 6.25, 4], [8, .5, 4], none, { collision: "walkable" }),
    // (3) Railing without a host.
    item("balcony-rail", "railing", [0, 7, 5.9], [8, 1, .2], none),
    // (4) Stair with an unresolved endpoint.
    item("entry-stair", "stair", [0, 1.5, 20], [2, 3, 6], none, { collision: "walkable", fromSupportId: "ground", toSupportId: "missing-landing" }),
  ],
  relationships: [{ from: "balcony", to: "ghost-wing", kind: "hosts" }],
});

describe("V3 render-first generation contract", () => {
  it("parses a structurally valid but physically imperfect mansion, renders it, and reports each issue", () => {
    const parsed = v3SceneOutputSchema.safeParse(imperfectMansion());
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);

    const normalized = normalizeV3GenerationOutput(parsed.data);
    const repaired = repairV3GeneratedScene(normalized.scene, normalized.notes);
    const validation = validateV3Scene(repaired.scene, { lenient: true });
    expect(validation.errors).toEqual([]);
    expect(validation.ok).toBe(true);

    // Strict mode (used by edits) still treats the same scene as invalid: the distinction is real.
    expect(validateV3Scene(structuredClone(repaired.scene)).ok).toBe(false);

    const model = compileV3Scene(repaired.scene);
    expect(validateV3CompiledGeometry(repaired.scene, model, { lenient: true }).ok).toBe(true);
    for (const id of ["wing", "spa", "balcony", "balcony-rail", "entry-stair"]) expect(model.primitives.some((primitive) => primitive.id === id)).toBe(true);
    expect(model.primitives.some((primitive) => primitive.id === "v3-connection-drive")).toBe(true);

    const audit = summarizeV3Generation(repaired.notes, validation.issues);
    expect(audit.status).toBe("rendered-with-warnings");
    expect(audit.summary).toMatch(/^V3 scene rendered with warnings: /);
    expect(audit.counts).toMatchObject({ UNRESOLVED_CONNECTOR: 1, CONNECTION_GRADE_EXCEEDS_PREFERRED: 1 });
    expect(audit.counts.MISSING_RELATIONSHIP_OBJECT).toBe(1);
    expect(repaired.notes.map((note) => note.targetId)).toContain("spa");
  });

  it("infers obvious support through the support graph and records it instead of failing", () => {
    const { scene } = repairV3GeneratedScene(normalizeV3GenerationOutput(imperfectMansion()).scene);
    const byId = (id: string) => scene.objects.find((object) => object.id === id)!;
    // Dangling host is dropped and the spa is re-grounded by geometry.
    expect(byId("spa").support?.hostId).not.toBe("ghost-deck");
    expect(byId("spa").support).toBeDefined();
    // Directly: the graph resolves the balcony onto the wing from geometry alone.
    const levels = scene.siteHierarchy!.levels;
    expect(resolveSupportSurface({ ...byId("balcony"), support: undefined }, scene, levels).support).toMatchObject({ objectId: "wing" });
    expect(byId("balcony").support).toMatchObject({ hostId: "wing", relationship: "rests-on" });
    expect(byId("balcony-rail").support).toMatchObject({ hostId: "balcony", relationship: "edge-hosted" });
  });

  it("still hard-fails truly malformed ids, transforms, and duplicates", () => {
    const badId = imperfectMansion(); badId.objects[1].id = "Bad_ID";
    expect(v3SceneOutputSchema.safeParse(badId).success).toBe(false);

    const badTransform = imperfectMansion(); badTransform.objects[1].transform.position = [0, Infinity, 0];
    expect(v3SceneOutputSchema.safeParse(badTransform).success).toBe(false);

    const missingId = imperfectMansion() as unknown as { objects: Array<Record<string, unknown>> }; delete missingId.objects[1].id;
    expect(v3SceneOutputSchema.safeParse(missingId).success).toBe(false);

    const duplicate = imperfectMansion(); duplicate.objects.push({ ...duplicate.objects[1] });
    const parsed = v3SceneOutputSchema.safeParse(duplicate);
    expect(parsed.success).toBe(true);
    const validation = validateV3Scene(repairV3GeneratedScene(normalizeV3GenerationOutput(parsed.data).scene).scene, { lenient: true });
    expect(validation.ok).toBe(false);
    expect(validation.errors.join(" ")).toMatch(/Duplicate object id: wing/);

    const zeroDimension = imperfectMansion(); zeroDimension.objects[1].dimensions = [0, 6, 12];
    const zeroParsed = v3SceneOutputSchema.safeParse(zeroDimension);
    expect(zeroParsed.success && validateV3Scene(repairV3GeneratedScene(normalizeV3GenerationOutput(zeroParsed.data).scene).scene, { lenient: true }).ok).toBe(false);
  });

  it("does not hide unresolved connectors: they render and are marked UNRESOLVED_CONNECTOR", () => {
    const { scene } = repairV3GeneratedScene(normalizeV3GenerationOutput(imperfectMansion()).scene);
    const validation = validateV3Scene(scene, { lenient: true });
    expect(validation.issues.filter((issue) => issue.code === "UNRESOLVED_CONNECTOR").map((issue) => issue.targetId)).toEqual(["entry-stair"]);
    expect(validation.warnings.join("\n")).toContain("UNRESOLVED_CONNECTOR [entry-stair]");
  });
});

type JsonNode = Record<string, unknown>;
const walk = (node: unknown, visit: (node: JsonNode, path: string) => void, path = "$") => {
  if (Array.isArray(node)) return node.forEach((child, index) => walk(child, visit, `${path}[${index}]`));
  if (!node || typeof node !== "object") return;
  visit(node as JsonNode, path);
  for (const [key, child] of Object.entries(node)) walk(child, visit, `${path}.${key}`);
};

describe("V3 provider-facing JSON Schema", () => {
  it("converts locally and contains no union, tuple, or free-form-map constructs", async () => {
    const format = await Output.object({ schema: v3SceneOutputSchema }).responseFormat;
    if (!format || format.type !== "json" || !format.schema) throw new Error("no JSON response format");
    const risky: string[] = [];
    walk(format.schema, (node, path) => {
      for (const key of ["anyOf", "oneOf", "allOf", "not", "if", "then", "else", "prefixItems", "patternProperties", "$ref"]) if (key in node) risky.push(`${path}.${key}`);
      if (node.additionalProperties && typeof node.additionalProperties === "object") risky.push(`${path}.additionalProperties(map)`);
      if (Array.isArray(node.type)) risky.push(`${path}.type(array)`);
    });
    expect(risky).toEqual([]);
  });

  it("emits support as one flat, fully-required, closed object with neutral values", async () => {
    const format = await Output.object({ schema: v3SceneOutputSchema }).responseFormat;
    const schema = (format as unknown as { schema: { properties: { objects: { items: { required: string[]; properties: { support: { type: string; required: string[]; additionalProperties: boolean; properties: Record<string, { enum?: string[]; type?: string }> } } } } } } }).schema;
    const item = schema.properties.objects.items;
    expect(item.required).toContain("support");
    const support = item.properties.support;
    expect(support).toMatchObject({ type: "object", additionalProperties: false });
    expect(support.required.slice().sort()).toEqual(["grounding", "hostId", "kind", "levelId", "relationship"]);
    expect(Object.keys(support.properties).sort()).toEqual(["grounding", "hostId", "kind", "levelId", "relationship"]);
    expect(support.properties.relationship.enum).toContain("none");
    expect(support.properties.kind.enum).toContain("none");
    expect(support.properties.levelId.type).toBe("string");
    expect(support.properties.hostId.type).toBe("string");
    // No nested optional objects remain on an object: only primitives are optional.
    expect(Object.keys(item.properties)).not.toEqual(expect.arrayContaining(["metadata", "terrain", "source"]));
  });
});
