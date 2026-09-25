import { describe, expect, it } from "vitest";
import { applyPatch } from "../applyPatch";
import { generateHouseFromJson } from "../generateHouse";
import type { HousePrimitive } from "../types";
import { assembleGeneratedProject, buildGenerationSystemPrompt } from "@/lib/ai/generation";
import { classifyPromptTarget } from "@/lib/ai/targeting";
import { inferStyleFromBrief } from "../architecture/profiles";
import type { AiGenerationResponse } from "@/lib/ai/siteSchema";

/**
 * Every brief below gets the *same* raw model output — same footprint, same generic materials, same colonial
 * style, same openings. Any difference in the result therefore comes from the style rules alone, which is exactly
 * what "a cabin is not the same house in brown" means.
 */
const MODEL_OUTPUT: AiGenerationResponse = {
  summary: "A house.",
  house: { width: 12, depth: 9, floors: 1, roof: "flat" },
  site: { environment: "suburban", viewDirection: "south", terrainSlope: "flat", approachSide: "north" },
  operations: [
    { op: "setExteriorOptions", fields: { style: "colonial" } },
    { op: "setMaterials", fields: { exterior: { material: "stucco", color: "#f5f2ec" }, roof: { material: "tile", color: "#5a7a9c" } } },
    { op: "addDoor", value: { wall: "north", level: 0, offset: 5.5, width: 1.1, height: 2.1 } },
    { op: "addWindow", value: { wall: "north", level: 0, offset: 1.5, width: 1.4, height: 1.3, sill: 0.9 } },
    { op: "addWindow", value: { wall: "south", level: 0, offset: 2, width: 2, height: 1.6, sill: 0.6 } },
    { op: "addWindow", value: { wall: "east", level: 0, offset: 3, width: 1.2, height: 1.2, sill: 0.9 } },
  ],
};

const BRIEFS = {
  cabin: "A cozy cabin in the woods",
  modern: "A modern luxury house",
  caribbean: "A Caribbean villa by the sea",
} as const;

function design(brief: string, output: AiGenerationResponse = MODEL_OUTPUT) {
  const result = assembleGeneratedProject(structuredClone(output), [], brief);
  if (!result.ok) throw new Error(`generation failed: ${result.errors.join("; ")}`);
  const generated = generateHouseFromJson(result.json);
  expect(generated.errors).toEqual([]);
  return { json: result.json, primitives: generated.model!.primitives, site: generated.site! };
}

const ids = (primitives: readonly HousePrimitive[], prefix: string) => primitives.filter((p) => p.id.startsWith(prefix)).map((p) => p.id);

// ── Silhouette ────────────────────────────────────────────────────────────────────────────────────

const BINS = 48;
const RANGE = 24; // metres either side of the house centre

/** Highest point of the building in each horizontal slice, seen from the front (axis "x") or the side ("z"). */
function skyline(primitives: readonly HousePrimitive[], axis: "x" | "z"): number[] {
  const top = new Array<number>(BINS).fill(0);
  const bin = (v: number) => Math.min(BINS - 1, Math.max(0, Math.floor(((v + RANGE) / (RANGE * 2)) * BINS)));
  const mark = (h: number, y: number, len: number) => {
    const from = bin(h - len / 2);
    const to = bin(h + len / 2);
    for (let b = from; b <= to; b++) top[b] = Math.max(top[b], y);
  };
  const i = axis === "x" ? 0 : 2;
  for (const p of primitives) {
    if (p.category === "landscape" || p.category === "road" || p.category === "parking") continue;
    if (p.kind === "box") {
      mark(p.position[i], p.position[1] + p.size[1] / 2, p.size[i]);
    } else {
      for (let v = 0; v < p.vertices.length; v += 9) {
        for (let s = 0; s <= 24; s++) {
          for (let t = 0; t <= 24 - s; t++) {
            const w = 24 - s - t;
            const at = (k: number) => (p.vertices[v + k] * s + p.vertices[v + 3 + k] * t + p.vertices[v + 6 + k] * w) / 24;
            top[bin(at(i))] = Math.max(top[bin(at(i))], at(1));
          }
        }
      }
    }
  }
  return top;
}

const meanAbsDiff = (a: number[], b: number[]) => a.reduce((sum, v, k) => sum + Math.abs(v - b[k]), 0) / a.length;

// ── Tests ─────────────────────────────────────────────────────────────────────────────────────────

describe("style-driven architecture", () => {
  const cabin = design(BRIEFS.cabin);
  const modern = design(BRIEFS.modern);
  const caribbean = design(BRIEFS.caribbean);
  const all = { cabin, modern, caribbean };

  it("gives each brief its own style and a roof form that style can build", () => {
    const style = (d: typeof cabin) => (JSON.parse(d.json).exteriorOptions as { style: string }).style;
    const roof = (d: typeof cabin) => (JSON.parse(d.json).house as { roof: string }).roof;
    expect([style(cabin), style(modern), style(caribbean)]).toEqual(["cabin", "modern-luxury", "caribbean-villa"]);
    expect([roof(cabin), roof(modern), roof(caribbean)]).toEqual(["gable", "flat", "hip"]);
  });

  it("produces clearly different silhouettes from identical input", () => {
    const names = Object.keys(all) as (keyof typeof all)[];
    for (let a = 0; a < names.length; a++) {
      for (let b = a + 1; b < names.length; b++) {
        for (const axis of ["x", "z"] as const) {
          const diff = meanAbsDiff(skyline(all[names[a]].primitives, axis), skyline(all[names[b]].primitives, axis));
          expect(diff, `${names[a]} vs ${names[b]} (${axis})`).toBeGreaterThan(0.35);
        }
      }
    }
    // Headline proportions: a steep cabin roof towers over a low modern plate.
    const peak = (d: typeof cabin) => Math.max(...skyline(d.primitives, "x"));
    expect(peak(cabin)).toBeGreaterThan(peak(modern) + 2);
  });

  it("builds notched log walls, a fieldstone base, timber trusses, a stone chimney and a log porch for the cabin", () => {
    const p = cabin.primitives;
    expect(ids(p, "wall-0-north-log-").length).toBeGreaterThanOrEqual(8);
    expect(ids(p, "foundation-").length).toBeGreaterThan(8);
    expect(ids(p, "roof-truss-").length).toBeGreaterThan(6);
    expect(ids(p, "roof-tail-").length).toBeGreaterThan(6);
    expect(ids(p, "chimney-0-course-").length).toBeGreaterThan(8);
    expect(ids(p, "porch-0-post-").length).toBeGreaterThanOrEqual(2);
    expect(ids(p, "porch-0-brace-").length).toBeGreaterThan(0);
    expect(ids(p, "building-0-wall-north-log-").length).toBeGreaterThan(4); // the shed is log too
    expect(ids(p, "window-0-header").length).toBe(1);
    expect(ids(p, "plate-")).toEqual([]);
    expect(ids(p, "roof-cupola")).toEqual([]);
  });

  it("builds plates, a blade wall, roof columns, a pavilion and a detached garage for the modern house", () => {
    const p = modern.primitives;
    expect(ids(p, "plate-0")).not.toEqual([]);
    expect(ids(p, "blade-wall")).toEqual(["blade-wall"]);
    expect(ids(p, "column-").length).toBeGreaterThanOrEqual(2);
    expect(ids(p, "roof-pavilion").length).toBeGreaterThanOrEqual(3);
    expect(ids(p, "porch-0-roof")).toEqual(["porch-0-roof"]);
    expect(ids(p, "building-0-door")).toContain("building-0-door");
    expect(ids(p, "wall-0-north-log-")).toEqual([]);
    expect(ids(p, "chimney-")).toEqual([]);
    expect(ids(p, "window-0-shutter")).toEqual([]);
  });

  it("builds a plinth, quoins, a cupola, wraparound verandas, shutters and a gazebo for the Caribbean villa", () => {
    const p = caribbean.primitives;
    expect(ids(p, "plinth-").length).toBeGreaterThan(4);
    expect(ids(p, "quoin-0-").length).toBe(4);
    expect(ids(p, "roof-cupola").length).toBeGreaterThan(4);
    expect(ids(p, "porch-0-").length).toBeGreaterThan(10);
    expect(ids(p, "porch-1-").length).toBeGreaterThan(10);
    expect(ids(p, "window-0-shutter-a").length).toBeGreaterThan(1);
    expect(ids(p, "building-0-post-").length).toBe(4); // gazebo
    expect(ids(p, "chimney-")).toEqual([]);
  });

  it("keeps the chimney above the roof ridge", () => {
    const chimneyTop = Math.max(...cabin.primitives.filter((p) => p.id.startsWith("chimney-0-")).map((p) => (p.kind === "box" ? p.position[1] + p.size[1] / 2 : 0)));
    const ridge = Math.max(...cabin.primitives.filter((p) => p.id.startsWith("roof-slope")).flatMap((p) => (p.kind === "triMesh" ? p.vertices.filter((_, i) => i % 3 === 1) : [])));
    expect(chimneyTop).toBeGreaterThan(ridge + 0.5);
  });

  it("gives every generated part a unique primitive id", () => {
    for (const [name, d] of Object.entries(all)) {
      const seen = new Set<string>();
      for (const p of d.primitives) {
        expect(seen.has(p.id), `${name}: duplicate id ${p.id}`).toBe(false);
        seen.add(p.id);
      }
    }
  });

  it("adds signature parts as ordinary features, each with a stable id", () => {
    const root = JSON.parse(cabin.json) as Record<string, { id?: string }[]>;
    for (const key of ["porches", "chimneys", "buildings"]) {
      expect(root[key].length).toBeGreaterThan(0);
      for (const item of root[key]) expect(typeof item.id).toBe("string");
    }
    expect((root.buildings[0] as unknown as { kind: string }).kind).toBe("shed");
  });

  it("does not duplicate parts the model already designed", () => {
    const withPorch: AiGenerationResponse = {
      ...MODEL_OUTPUT,
      operations: [
        ...MODEL_OUTPUT.operations,
        { op: "addPorch", value: { wall: "north", offset: 4, width: 4, depth: 2, } },
        { op: "addChimney", value: { wall: "west", offset: 3, width: 1.4, depth: 1 } },
        { op: "addBuilding", value: { kind: "shed", x: 14, z: 0, width: 4, depth: 3.5, floors: 1, roof: "gable" } },
      ],
    };
    const root = JSON.parse(design(BRIEFS.cabin, withPorch).json) as Record<string, unknown[]>;
    expect(root.porches).toHaveLength(1);
    expect(root.chimneys).toHaveLength(1);
    expect(root.buildings).toHaveLength(1);
  });

  describe("scoped edits", () => {
    const untouched = (before: readonly HousePrimitive[], after: readonly HousePrimitive[], prefix: string) => {
      const keep = (list: readonly HousePrimitive[]) => list.filter((p) => !p.id.startsWith(prefix));
      expect(keep(after)).toEqual(keep(before));
    };
    const idOf = (json: string, key: string, index = 0) => (JSON.parse(json)[key][index] as { id: string }).id;

    it("moving a porch changes only that porch's parts", () => {
      const id = idOf(cabin.json, "porches");
      const { json, errors } = applyPatch(cabin.json, [{ op: "updatePorch", id, fields: { width: 3, offset: 2 } }]);
      expect(errors).toEqual([]);
      const after = generateHouseFromJson(json).model!.primitives;
      untouched(cabin.primitives, after, "porch-0-");
      expect(after.filter((p) => p.id.startsWith("porch-0-"))).not.toEqual(cabin.primitives.filter((p) => p.id.startsWith("porch-0-")));
    });

    it("removing the chimney removes only the chimney", () => {
      const id = idOf(cabin.json, "chimneys");
      const { json } = applyPatch(cabin.json, [{ op: "removeChimney", id }]);
      const after = generateHouseFromJson(json).model!.primitives;
      expect(ids(after, "chimney-")).toEqual([]);
      untouched(cabin.primitives, after, "chimney-");
    });

    it("resizing the shed changes only the shed", () => {
      const id = idOf(cabin.json, "buildings");
      const { json } = applyPatch(cabin.json, [{ op: "updateBuilding", id, fields: { width: 6, depth: 5 } }]);
      const after = generateHouseFromJson(json).model!.primitives;
      untouched(cabin.primitives, after, "building-0-");
    });

    it("editing a window moves its surround with it and touches nothing else", () => {
      const id = idOf(caribbean.json, "windows");
      const { json } = applyPatch(caribbean.json, [{ op: "updateWindow", id, fields: { offset: 3 } }]);
      const after = generateHouseFromJson(json).model!.primitives;
      untouched(caribbean.primitives, after, "window-0-");
      expect(ids(after, "window-0-shutter-a").length).toBeGreaterThan(1);
    });
  });

  describe("other styles", () => {
    it("keep the generic shell untouched", () => {
      const generic = design("A colonial family home", { ...MODEL_OUTPUT, house: { ...MODEL_OUTPUT.house, roof: "gable" } });
      const p = generic.primitives;
      expect(ids(p, "wall-0-north")).toEqual(["wall-0-north"]);
      expect(ids(p, "cornice-").length).toBe(4);
      expect(ids(p, "pillar-0-").length).toBe(4);
      for (const prefix of ["plate-", "blade-", "column-", "foundation-", "plinth-", "quoin-", "porch-", "chimney-", "window-0-shutter", "window-0-header"]) {
        expect(ids(p, prefix), prefix).toEqual([]);
      }
      expect(JSON.parse(generic.json).porches ?? []).toEqual([]);
    });
  });

  describe("AI flow", () => {
    it("reads the style a brief names, and only that", () => {
      expect(inferStyleFromBrief("cabin in the woods")).toBe("cabin");
      expect(inferStyleFromBrief("a log home beside the forest")).toBe("cabin");
      expect(inferStyleFromBrief("Modern luxury villa with infinity pool")).toBe("modern-luxury");
      expect(inferStyleFromBrief("A Caribbean villa")).toBe("caribbean-villa");
      expect(inferStyleFromBrief("A colonial family home")).toBeUndefined();
      expect(inferStyleFromBrief("a modern minimalist studio")).toBeUndefined();
    });

    it("tells the model about the styles and offers porch / chimney / outbuilding ops", () => {
      const prompt = buildGenerationSystemPrompt([]);
      expect(prompt).toContain("ARCHITECTURAL STYLES");
      for (const style of ["cabin", "modern-luxury", "caribbean-villa"]) expect(prompt).toContain(`style "${style}"`);
      expect(prompt).toMatch(/- addPorch: .*wall/);
      expect(prompt).toMatch(/- addChimney: .*wall/);
      expect(prompt).toContain("detached_garage");
    });

    it("scopes porch, chimney and outbuilding edits to just that feature", () => {
      expect(classifyPromptTarget("make the porch wider").featureTypes).toEqual(["porch"]);
      expect(classifyPromptTarget("remove the chimney").featureTypes).toEqual(["chimney"]);
      const shed = classifyPromptTarget("move the shed further east");
      expect(shed.featureTypes).toEqual(["building"]);
      expect(shed.filter?.buildingKinds).toEqual(["shed"]);
      const garage = classifyPromptTarget("make the detached garage bigger");
      expect(garage.featureTypes).toEqual(["building"]);
      expect(classifyPromptTarget("make the roof a shed roof").featureTypes).not.toContain("building");
    });

    it("keeps the brief's stated environment and otherwise puts a cabin in the woods", () => {
      const environment = (brief: string) => (JSON.parse(design(brief).json).site as { environment: string }).environment;
      expect(environment("A cabin")).toBe("forest");
      expect(environment("A cabin on a hillside")).toBe("hillside");
    });
  });
});
