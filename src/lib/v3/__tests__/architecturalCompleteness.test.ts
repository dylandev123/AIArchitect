import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import type { HousePrimitive } from "@/lib/house/types";
import { compileV3Scene, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from "../scene";
import { validateV3Scene } from "../validation";
import { materializeV3ArchitecturalObject } from "../architecture";
import { auditV3Completeness } from "../completeness";
import { auditV3CirculationIntent, resolveV3Circulation } from "../circulation";
import { reviewV3Architecture, reviewV3ArchitecturalComposition, v3DesignRepairInstructions } from "../designReview";
import { deriveV3MassJunctions } from "../junctions";
import { assessV3Revision } from "../safeRevision";
import { normalizeV3GenerationOutput } from "../generation";
import { v3SceneOutputSchema, V3_SCENE_ARCHITECT_PROMPT, v3SceneArchitectPrompt } from "../schema";
import { localPlan } from "../reviewGeometry";
import { functionalMansion, savedMansion, SAVED_MANSIONS, type SavedMansion } from "../parity/functionalMansions";
import type { V3Circulation } from "../interior";

const codes = (scene: V3Scene, severity?: "significant" | "advisory") => auditV3Completeness(scene).findings.filter((f) => !severity || f.severity === severity).map((f) => `${f.code}:${f.targetIds[0]}`).sort();
const object = (scene: V3Scene, id: string) => scene.objects.find((o) => o.id === id)!;
const materialized = (scene: V3Scene): V3Scene => ({ ...scene, objects: scene.objects.map(materializeV3ArchitecturalObject) });
const withCirculation = (scene: V3Scene, entries: V3Circulation[]): V3Scene => ({ ...scene, interior: { ...(scene.interior ?? { storeys: [], rooms: [] }), circulation: entries } });
/** Plan corners of a compiled box, in a host's local frame. */
const localCorners = (host: V3SceneObject, p: HousePrimitive) => {
  if (p.kind !== "box") return [];
  const yaw = p.rotation[1], [w, , d] = p.size;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => localPlan(host, [p.position[0] + sx * w / 2 * Math.cos(yaw) + sz * d / 2 * Math.sin(yaw), p.position[2] - sx * w / 2 * Math.sin(yaw) + sz * d / 2 * Math.cos(yaw)]));
};
/** Whether any horizontal triangle of a primitive covers a world plan point. */
const covers = (p: HousePrimitive, x: number, z: number) => {
  const v = p.kind === "triMesh" ? p.vertices : [];
  for (let i = 0; i < v.length; i += 9) {
    if (Math.abs(v[i + 1] - v[i + 4]) + Math.abs(v[i + 1] - v[i + 7]) > 1e-6) continue;
    const [ax, az, bx, bz, cx, cz] = [v[i], v[i + 2], v[i + 3], v[i + 5], v[i + 6], v[i + 8]];
    const d1 = (x - bx) * (az - bz) - (ax - bx) * (z - bz), d2 = (x - cx) * (bz - cz) - (bx - cx) * (z - cz), d3 = (x - ax) * (cz - az) - (cx - ax) * (z - az);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
  }
  return false;
};

describe("existing diagnostics", () => {
  it("accepts a reflection-named resort pool as the requested swimming pool, but not a pure reflecting pool", () => {
    const s = savedMansion("9646933e"), brief = String(s.metadata.brief);
    expect(object(s, "resort-pool").label).toMatch(/Reflection/);
    expect(reviewV3ArchitecturalComposition(s, { brief }).diagnostics.some((d) => d.code === "MISSING_REQUESTED_FEATURE" && /swimming pool/.test(d.message))).toBe(false);
    Object.assign(object(s, "resort-pool"), { id: "arrival-reflecting-pool", label: "Reflecting Pool", semanticRole: "water feature" });
    expect(reviewV3ArchitecturalComposition(s, { brief }).diagnostics.some((d) => d.code === "MISSING_REQUESTED_FEATURE" && /swimming pool/.test(d.message))).toBe(true);
  });

  it("no longer reports supported butterfly roofs as unsupported; genuinely unsupported names still are", () => {
    const s = savedMansion("91d583fe");
    expect(reviewV3ArchitecturalComposition(s).diagnostics.some((d) => d.code === "UNSUPPORTED_ARCHITECTURAL_INTENT")).toBe(false);
    object(s, "primary-roof").label = "High mansard roof";
    expect(reviewV3ArchitecturalComposition(s).diagnostics.find((d) => d.code === "UNSUPPORTED_ARCHITECTURAL_INTENT")?.targetIds).toEqual(["primary-roof"]);
  });

  it("reports glazing removed at a shared-wall junction instead of dropping it silently, without changing construction", () => {
    const s = savedMansion("f2149916"), removed = deriveV3MassJunctions(s).diagnostics.filter((d) => d.code === "JUNCTION_OPENING_REMOVED");
    expect(removed.map((d) => `${d.massId}:${d.openingId}:${d.removal}`)).toEqual(expect.arrayContaining(["main-living-pavilion:west-courtyard-glass:removed", "main-living-pavilion:east-courtyard-glass:removed"]));
    expect(validateV3Scene(s, { lenient: true }).warnings.some((w) => w.startsWith("JUNCTION_OPENING_REMOVED") && w.includes("west-courtyard-glass"))).toBe(true);
    expect(codes(s, "advisory")).toEqual(expect.arrayContaining(["AUTHORED_OPENING_REMOVED:main-living-pavilion"]));
  });

  it("treats a glazed door on a shared face as an intentional partition, like a solid door", () => {
    const s = savedMansion("f2149916"), pavilion = object(s, "main-living-pavilion");
    pavilion.composition!.openings!.push({ id: "west-link-door", type: "glazed-door", facade: "west", floors: "ground", start: .45, end: .55 });
    expect(deriveV3MassJunctions(s).junctions.flatMap((j) => j.sharedWalls).some((r) => r.massId === pavilion.id && r.facade === "west" && r.kind === "intentional-partition")).toBe(true);
  });
});

describe("saved mansions", () => {
  // Recorded before this milestone; the saved scenes must compile byte-for-byte as they did.
  const BASELINE: Record<SavedMansion, string> = {
    "91d583fe": "73e5904681a03b8337f59a93f7b7b112916ca697a46a5f570553f0eaa40b500b",
    "9646933e": "3324f9ff17989a3296db891fe2c6bb00f0fd47a58e835b4dbc56ca01e36910d7",
    "f2149916": "b31c3e51f831908a0403960cb4a406b78918a15de5784c4007a95e2961a1086f",
  };
  it.each(SAVED_MANSIONS)("%s compiles unchanged and is never modified by the audit", (id) => {
    const s = savedMansion(id), before = structuredClone(s);
    expect(createHash("sha256").update(JSON.stringify(compileV3Scene(s))).digest("hex")).toBe(BASELINE[id]);
    auditV3Completeness(s);
    reviewV3Architecture(s, { brief: String(s.metadata.brief) });
    expect(s).toEqual(before);
  });

  it("diagnoses the missing access in all three mansions", () => {
    expect(codes(savedMansion("91d583fe"), "significant")).toEqual(["INACCESSIBLE_BALCONY:primary-pavilion", "NO_OUTDOOR_LIVING_ACCESS:primary-pavilion", "UNREACHABLE_STOREY:primary-pavilion"]);
    expect(codes(savedMansion("9646933e"), "significant")).toEqual(["INACCESSIBLE_BALCONY:upper-bedroom-gallery", "INACCESSIBLE_ROOF_TERRACE:guest-sky-terrace", "NO_OUTDOOR_LIVING_ACCESS:main-residence-ground", "UNREACHABLE_STOREY:upper-bedroom-gallery"]);
    expect(codes(savedMansion("f2149916"), "significant")).toEqual(["INACCESSIBLE_BALCONY:east-bedroom-wing", "INACCESSIBLE_BALCONY:west-bedroom-wing", "NO_OUTDOOR_LIVING_ACCESS:main-living-pavilion",
      "UNREACHABLE_STOREY:east-bedroom-wing", "UNREACHABLE_STOREY:main-living-pavilion", "UNREACHABLE_STOREY:west-bedroom-wing"]);
    // The 0.9 m void and the derived guard both stand between the gallery and the sky terrace.
    expect(auditV3Completeness(savedMansion("9646933e")).findings.find((f) => f.code === "INACCESSIBLE_ROOF_TERRACE")!.message).toMatch(/gap separates it from upper-bedroom-gallery; its guard runs across/);
  });

  it("feeds significant findings into the single bounded repair without invalidating the scene", () => {
    for (const id of SAVED_MANSIONS) {
      const s = savedMansion(id), review = reviewV3Architecture(s, { brief: String(s.metadata.brief) });
      expect(review.repairRecommended).toBe(true);
      expect(v3DesignRepairInstructions(review).some((line) => line.startsWith("UNREACHABLE_STOREY"))).toBe(true);
      expect(v3DesignRepairInstructions(review).length).toBeLessThanOrEqual(12);
      expect(validateV3Scene(s, { lenient: true, requireObjects: true }).ok).toBe(true);
    }
  });
});

describe("functional fixtures", () => {
  it.each(SAVED_MANSIONS)("%s with authored stairs and doors passes the audit and every check", (id) => {
    const s = functionalMansion(id), model = compileV3Scene(s);
    expect(auditV3Completeness(s).significant).toBe(0);
    expect(auditV3CirculationIntent(s)).toEqual([]);
    expect(validateV3Scene(s, { lenient: true, requireObjects: true }).ok).toBe(true);
    expect(validateV3CompiledGeometry(s, model).errors).toEqual([]);
    expect(new Set(model.primitives.map((p) => p.id)).size).toBe(model.primitives.length);
    expect(reviewV3Architecture(s, { brief: String(s.metadata.brief) }).diagnostics.filter((d) => d.severity === "significant" && /UNREACHABLE|INACCESSIBLE|OUTDOOR_LIVING|CIRCULATION/.test(d.code))).toEqual([]);
  });

  it("leaves every untouched mass and object byte-identical", () => {
    const saved = compileV3Scene(savedMansion("f2149916")).primitives, functional = compileV3Scene(functionalMansion("f2149916")).primitives;
    for (const id of ["east-service-gallery", "west-wellness-suite", "main-roof", "resort-pool", "pool-terrace", "arrival-court"]) expect(functional.filter((p) => p.sourceObjectId === id)).toEqual(saved.filter((p) => p.sourceObjectId === id));
  });

  it("builds a usable stair inside its footprint that actually connects the two storeys", () => {
    const s = functionalMansion("f2149916"), [stair] = resolveV3Circulation(s).filter((r) => r.entry.id === "pavilion-stair");
    const host = object(materialized(s), "main-living-pavilion"), f = stair.entry.footprint;
    const treads = compileV3Scene(s).primitives.filter((p) => p.id.startsWith("pavilion-stair:") && p.category === "stairs").map((p) => p.kind === "box" ? p : undefined).filter((p) => !!p);
    const tops = treads.map((p) => p.position[1] + p.size[1] / 2).sort((a, b) => a - b), risers = tops.map((t, i) => t - (i ? tops[i - 1] : stair.fromY));
    expect(stair.usable).toBe(true);
    expect(treads.some((p) => p.componentRole === "stair landing")).toBe(true);
    expect(Math.max(...risers)).toBeLessThanOrEqual(.2);
    expect(Math.abs(stair.toY - tops.at(-1)! - risers[0])).toBeLessThan(1e-6);
    for (const p of treads) for (const [x, z] of localCorners(host, p)) {
      expect(Math.abs(x - f.x)).toBeLessThanOrEqual(f.width / 2 + 1e-6);
      expect(Math.abs(z - f.z)).toBeLessThanOrEqual(f.depth / 2 + 1e-6);
    }
    expect(auditV3Completeness(s).edges).toEqual(expect.arrayContaining([{ from: "main-living-pavilion#0", to: "main-living-pavilion#1", kind: "stair", via: "pavilion-stair" }]));
  });

  it("cuts the upper floor opening exactly over the circulation footprint and guards it", () => {
    const s = functionalMansion("f2149916"), model = compileV3Scene(s), host = object(materialized(s), "main-living-pavilion");
    const slab = model.primitives.find((p) => p.id === "main-living-pavilion-slab-2")!, f = resolveV3Circulation(s)[0].entry.footprint;
    const world = (lx: number, lz: number) => [host.transform.position[0] + lx, host.transform.position[2] + lz] as const;
    expect(slab.kind).toBe("triMesh");
    for (const [u, v] of [[0, 0], [.4, .4], [-.4, -.4], [.4, -.4]]) expect(covers(slab, ...world(f.x + u * f.width, f.z + v * f.depth))).toBe(false);
    for (const [u, v] of [[.5, 0], [-.5, 0], [0, .5], [0, -.5]]) expect(covers(slab, ...world(f.x + u * (f.width + .6), f.z + v * (f.depth + .6)))).toBe(true);
    // Ground slab is intact beneath the stair; the arrival edge of the opening is left unguarded.
    expect(model.primitives.find((p) => p.id === "main-living-pavilion-slab-1")!.kind).toBe("box");
    const guards = model.primitives.filter((p) => p.id.startsWith("pavilion-stair:guard-") && !p.id.includes("rail"));
    expect(guards.length).toBeGreaterThanOrEqual(3);
    expect(guards.every((p) => p.kind === "box" && p.position[1] > resolveV3Circulation(s)[0].toY)).toBe(true);
  });

  it("rises into a stacked mass and onto a rooftop terrace, cutting only what it passes through", () => {
    const s = functionalMansion("9646933e"), model = compileV3Scene(s), audit = auditV3Completeness(s);
    const [gallery, sky] = ["gallery-stair", "sky-terrace-stair"].map((id) => resolveV3Circulation(s).find((r) => r.entry.id === id)!);
    expect([gallery.exit, gallery.stackedMassId, sky.exit]).toEqual(["stacked", "upper-bedroom-gallery", "roof"]);
    expect(model.primitives.find((p) => p.id === "upper-bedroom-gallery-slab-1")!.kind).toBe("triMesh");
    expect(audit.edges).toEqual(expect.arrayContaining([
      { from: "main-residence-ground#0", to: "upper-bedroom-gallery#0", kind: "stair", via: "gallery-stair" },
      { from: "east-guest-wing#0", to: "guest-sky-terrace", kind: "stair", via: "sky-terrace-stair" },
    ]));
    expect(audit.nodes.find((n) => n.id === "guest-sky-terrace")!.reachable).toBe(true);
    // The stair head enclosure sits on the terrace, with one open side and a roof, clear of the pergola.
    const bulkhead = model.primitives.filter((p) => p.id.startsWith("sky-terrace-stair:bulkhead-"));
    expect(bulkhead.filter((p) => p.componentRole === "stair bulkhead wall").length).toBeGreaterThanOrEqual(3);
    expect(bulkhead.some((p) => p.componentRole === "stair bulkhead roof")).toBe(true);
    expect(Math.min(...bulkhead.map((p) => p.kind === "box" ? p.position[1] - p.size[1] / 2 : Infinity))).toBeCloseTo(sky.toY, 5);
  });

  it("represents a lift as a shaft with a landing door at every served storey", () => {
    const s = functionalMansion("f2149916"), parts = compileV3Scene(s).primitives.filter((p) => p.id.startsWith("east-wing-lift:"));
    expect(parts.filter((p) => p.componentRole === "lift landing door")).toHaveLength(2);
    expect(parts.filter((p) => p.componentRole === "lift shaft wall").length).toBeGreaterThanOrEqual(4);
    expect(parts.some((p) => /machine|motor|counterweight/i.test(p.label))).toBe(false);
    expect(auditV3Completeness(s).edges.some((e) => e.kind === "lift" && e.to === "east-bedroom-wing#1")).toBe(true);
  });

  it("builds glazed doors from the floor with a frame, threshold and sliding-leaf mullions; balconies become reachable", () => {
    const s = functionalMansion("91d583fe"), model = compileV3Scene(s), audit = auditV3Completeness(s);
    const parts = model.primitives.filter((p) => p.id.startsWith("primary-pavilion:south-suite-glass:level-1:"));
    // Level 1 of the two-storey pavilion: the threshold starts at that level's datum, like every V3 door.
    const host = object(materialized(s), "primary-pavilion"), floor = host.transform.position[1] - host.dimensions[1] / 2 + host.dimensions[1] / 2;
    expect(parts.map((p) => p.id.split(":").at(-1))).toEqual(expect.arrayContaining(["frame-left", "frame-right", "frame-head", "frame-sill", "door-panel", "mullion-0"]));
    expect(parts.some((p) => p.label === "Door Frame")).toBe(false);
    const sill = parts.find((p) => p.id.endsWith(":frame-sill"))!;
    expect(sill.kind === "box" && sill.position[1] - sill.size[1] / 2).toBeCloseTo(floor, 5);
    expect(audit.nodes.find((n) => n.id === "primary-pavilion/south-loggia-balcony/south-loggia-slab")!.reachable).toBe(true);
    // Ordinary windows and doors are untouched.
    expect(model.primitives.filter((p) => p.id.startsWith("primary-pavilion:primary-entry-door:"))).toEqual(compileV3Scene(savedMansion("91d583fe")).primitives.filter((p) => p.id.startsWith("primary-pavilion:primary-entry-door:")));
  });
});

describe("conservative access semantics", () => {
  it("never mistakes glazing for a doorway, however large", () => {
    const s = functionalMansion("91d583fe"), pavilion = object(s, "primary-pavilion");
    pavilion.composition!.openings = pavilion.composition!.openings!.map((op) => op.id === "south-suite-glass" ? { id: op.id, type: "glazing-zone", facade: "south", floors: "upper", start: .12, end: .88, heightRatio: 1 } : op);
    expect(codes(s, "significant")).toEqual(["INACCESSIBLE_BALCONY:primary-pavilion"]);
  });

  it("never infers access from proximity: a door across a gap to a terrace is not access", () => {
    const s = functionalMansion("9646933e"), gallery = object(s, "upper-bedroom-gallery");
    s.interior!.circulation = s.interior!.circulation!.filter((c) => c.id !== "sky-terrace-stair");
    gallery.composition!.openings = gallery.composition!.openings!.map((op) => op.id === "upper-east-glass" ? { id: op.id, type: "glazed-door", facade: "east", floors: "upper", start: .2, end: .74, serves: "guest-sky-terrace" } : op);
    object(s, "guest-sky-terrace").terraceOpenEdges = ["west"];
    expect(codes(s, "significant")).toEqual(["INACCESSIBLE_ROOF_TERRACE:guest-sky-terrace"]);
  });

  it("diagnoses missing location intent instead of placing a stair, and keeps the scene valid", () => {
    const s = withCirculation(savedMansion("f2149916"), [{ id: "main-stair", type: "stair", hostMassId: "main-living-pavilion", fromLevel: 0, toLevel: 1 } as V3Circulation]);
    expect(codes(s, "significant")).toEqual(expect.arrayContaining(["CIRCULATION_INTENT_INCOMPLETE:main-stair", "UNREACHABLE_STOREY:main-living-pavilion"]));
    expect(auditV3CirculationIntent(s)[0].code).toBe("CIRCULATION_LOCATION_MISSING");
    expect(compileV3Scene(s)).toEqual(compileV3Scene(savedMansion("f2149916")));
    expect(validateV3Scene(s, { lenient: true }).ok).toBe(true);
  });

  it("refuses to build an unusable stair or an unsupported roof exit, and says why", () => {
    const short = withCirculation(savedMansion("f2149916"), [{ id: "steep", type: "stair", hostMassId: "main-living-pavilion", fromLevel: 0, toLevel: 1, footprint: { x: -5, z: 0, width: 1.2, depth: 2 } }]);
    expect(auditV3CirculationIntent(short).map((i) => i.code)).toEqual(["CIRCULATION_NOT_USABLE"]);
    expect(compileV3Scene(short).primitives.some((p) => p.id.startsWith("steep:"))).toBe(false);
    expect(codes(short, "significant")).toContain("UNREACHABLE_STOREY:main-living-pavilion");
    const pitched = withCirculation(savedMansion("f2149916"), [{ id: "attic", type: "stair", hostMassId: "main-living-pavilion", fromLevel: 1, toLevel: 2, stairType: "u-shaped", footprint: { x: -5, z: 0, width: 2.6, depth: 4.6 } }]);
    expect(auditV3CirculationIntent(pitched).map((i) => i.code)).toEqual(["ROOF_EXIT_UNSUPPORTED"]);
  });

  it("never relocates authored circulation", () => {
    const s = functionalMansion("f2149916"), before = structuredClone(s.interior!.circulation);
    compileV3Scene(s); auditV3Completeness(s); validateV3Scene(s, { lenient: true });
    expect(s.interior!.circulation).toEqual(before);
  });
});

describe("generation contract and bounded repair", () => {
  it("teaches functional principles and accepts compact circulation in the provider schema", () => {
    for (const prompt of [V3_SCENE_ARCHITECT_PROMPT, v3SceneArchitectPrompt("flat")]) {
      expect(prompt).toContain("FUNCTIONAL COMPLETENESS");
      expect(prompt).toMatch(/Every storey above ground needs vertical circulation/);
      expect(prompt).toMatch(/A glazing-zone is a window, never access/);
      expect(prompt).toMatch(/not a layout or style/);
    }
    expect(v3SceneOutputSchema.safeParse({ version: 3, site: { width: 40, depth: 40 }, relationships: [], objects: [{ id: "house", semanticRole: "house", label: "House", material: { id: "m", color: "#ffffff" }, architecture: { x: 0, z: 0, baseElevation: 0, width: 10, depth: 8, height: 7 } }],
      circulation: [{ id: "stair", type: "stair", hostId: "house", fromLevel: 0, toLevel: 1, x: 2, z: 0, width: 1.2, depth: 5, stairType: "straight", direction: "north" }] }).success).toBe(true);
  });

  it("normalizes provider circulation into host-local interior intent and omits malformed entries without failing", () => {
    const { scene, notes } = normalizeV3GenerationOutput({ version: 3, site: { width: 60, depth: 60 }, relationships: [], objects: [
      { id: "house", type: "building-mass", semanticRole: "house", label: "House", levels: 2, material: { id: "m", color: "#eeeeee" }, architecture: { x: 10, z: -4, baseElevation: 0, width: 12, depth: 10, height: 7 },
        composition: { openings: [{ id: "entry", type: "door", facade: "north", floors: "ground", start: .45, end: .55 }, { id: "view", type: "sliding-door", facade: "south", floors: "ground", start: .1, end: .9 }] } }],
      circulation: [{ id: "stair", type: "stair", hostId: "house", fromLevel: 0, toLevel: 1, x: 13, z: -4, width: 1.2, depth: 5.6, direction: "south" }, { id: "house", type: "stair", hostId: "house" }, { id: "ramp-x", type: "escalator", hostId: "house" }] }, "flat");
    expect(scene.interior!.circulation).toEqual([{ id: "stair", type: "stair", hostMassId: "house", fromLevel: 0, toLevel: 1, footprint: { x: 3, z: 0, width: 1.2, depth: 5.6 }, direction: "south" }]);
    expect(notes.filter((n) => n.code === "CIRCULATION_OMITTED").map((n) => n.targetId)).toEqual(["house", "ramp-x"]);
    expect(object(scene, "house").composition!.openings![1]).toEqual({ id: "view", type: "glazed-door", facade: "south", floors: "ground", start: .1, end: .9, operation: "sliding" });
    expect(validateV3Scene(scene, { lenient: true, requireObjects: true }).ok).toBe(true);
    expect(auditV3Completeness(scene).findings.filter((f) => f.code === "UNREACHABLE_STOREY")).toEqual([]);
  });

  it("accepts a repair that only adds access, and rejects one that also changes unrelated architecture", () => {
    const original = materialized(savedMansion("91d583fe")), revised = functionalMansion("91d583fe"), brief = String(original.metadata.brief);
    const before = reviewV3Architecture(original, { brief }), after = reviewV3Architecture(revised, { brief });
    expect(assessV3Revision(original, revised, before, after)).toMatchObject({ accepted: true });
    const moved = structuredClone(revised);
    Object.assign(object(moved, "primary-pavilion"), materializeV3ArchitecturalObject({ ...object(moved, "primary-pavilion"), architecture: { ...object(moved, "primary-pavilion").architecture!, x: 1 } }));
    expect(assessV3Revision(original, moved, before, reviewV3Architecture(moved, { brief })).reasons).toEqual(expect.arrayContaining([expect.stringMatching(/Unrelated change: primary-pavilion\.architecture\.x/)]));
    const restyled = structuredClone(revised);
    object(restyled, "primary-roof").material = { ...object(restyled, "primary-roof").material, color: "#111111" };
    expect(assessV3Revision(original, restyled, before, reviewV3Architecture(restyled, { brief })).accepted).toBe(false);
    const elsewhere = withCirculation(revised, [...revised.interior!.circulation!, { id: "wing-lift", type: "lift", hostMassId: "west-guest-wing", fromLevel: 0, toLevel: 1, footprint: { x: 0, z: 0, width: 1.8, depth: 1.8 } }]);
    expect(assessV3Revision(original, elsewhere, before, reviewV3Architecture(elsewhere, { brief })).accepted).toBe(false);
  });
});
