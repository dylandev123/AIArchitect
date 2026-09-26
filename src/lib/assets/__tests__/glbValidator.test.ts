import { describe, expect, it } from "vitest";
import { GLB_LIMITS, validateGlb } from "../glbValidator";
import { buildGlb } from "./glbFixture";

const errorsOf = (buf: ArrayBuffer) => validateGlb(buf).errors.join(" | ");

describe("GLB validator: usable models", () => {
  it("measures and passes a clean, grounded gazebo", () => {
    const r = validateGlb(buildGlb(), { family: "gazebo" });
    expect(r.passed).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.dimensions).toEqual({ width: 4, depth: 4, height: 3 });
    expect(r.triangleCount).toBe(12);
    expect(r.meshCount).toBe(1);
    expect(r.materialCount).toBe(1);
    expect(r.footprint).toMatchObject({ width: 4, depth: 4 });
    expect(r.groundAligned).toBe(true);
    expect(r.fileSizeBytes).toBeGreaterThan(0);
    expect(r.bounds).toEqual({ min: [-2, 0, -2], max: [2, 3, 2] });
  });

  it("applies node transforms to the measured size", () => {
    const r = validateGlb(buildGlb({ node: { scale: [2, 2, 2] } }));
    expect(r.dimensions).toEqual({ width: 8, depth: 8, height: 6 });
    // A 90° turn about X (a Z-up export) swaps height and depth.
    const s = Math.SQRT1_2;
    const rotated = validateGlb(buildGlb({ min: [-2, 0, -1], max: [2, 6, 1], node: { rotation: [s, 0, 0, s] } }));
    expect(rotated.dimensions?.height).toBeCloseTo(2);
    expect(rotated.dimensions?.depth).toBeCloseTo(6);
  });

  it("reports an off-origin pivot and floating base as warnings, not failures", () => {
    const r = validateGlb(buildGlb({ min: [3, 1.5, 3], max: [7, 4.5, 7] }));
    expect(r.passed).toBe(true);
    expect(r.groundAligned).toBe(false);
    expect(r.origin).toEqual({ groundOffset: 1.5, pivotX: 5, pivotZ: 5 });
    expect(r.warnings.join(" ")).toMatch(/ground/i);
    expect(r.warnings.join(" ")).toMatch(/pivot/i);
    expect(r.footprint).toMatchObject({ offsetX: 5, offsetZ: 5 });
  });

  it("reads bounds from the vertex data when the accessor omits min/max", () => {
    const r = validateGlb(buildGlb({ omitPositionBounds: true }));
    expect(r.passed).toBe(true);
    expect(r.dimensions).toEqual({ width: 4, depth: 4, height: 3 });
  });

  it("reports heavy models clearly without rejecting them", () => {
    const r = validateGlb(buildGlb({ indexCount: 3 * 100_000, materials: 14, images: [[4096, 4096], [1024, 1024]] }));
    expect(r.passed).toBe(true);
    const warnings = r.warnings.join(" | ");
    expect(warnings).toMatch(/High triangle count \(1,400,000\)/);
    expect(warnings).toMatch(/Many materials \(14\)/);
    expect(warnings).toMatch(/Huge texture.*4096×4096/);
    expect(r.maxTextureSize).toBe(4096);
    expect(r.textureCount).toBe(2);
    expect(validateGlb(buildGlb({ indexCount: 3 * 700_000, materials: 3 })).errors[0]).toMatch(/2,000,000/);
    expect(r.textureMemoryBytes).toBeGreaterThan(4096 * 4096 * 4);
  });

  it("flags a probable unit mismatch against the expected size", () => {
    const cm = validateGlb(buildGlb({ min: [-20, 0, -20], max: [20, 30, 20] }), { expectedDimensions: { width: 4, depth: 4, height: 3 } });
    expect(cm.passed).toBe(true);
    expect(cm.warnings.join(" ")).toMatch(/unit/);
  });

  it("suspects a lying-down upright structure only for upright families", () => {
    const flat = buildGlb({ min: [-2, 0, -2], max: [2, 0.5, 2] });
    expect(validateGlb(flat, { family: "gazebo" }).orientationSuspect).toBe(true);
    expect(validateGlb(flat, { family: "gazebo" }).warnings.join(" ")).toMatch(/Orientation/);
    expect(validateGlb(flat, { family: "fire-pit" }).orientationSuspect).toBe(false);
  });

  it("warns about oversized files but only refuses past the hard limit", () => {
    const big = new Uint8Array(GLB_LIMITS.fileSizeMaxBytes + 1).buffer;
    expect(validateGlb(big).errors[0]).toMatch(/over the/);
    const glb = buildGlb();
    expect(validateGlb(glb).warnings).toEqual([]);
  });
});

describe("GLB validator: hard failures", () => {
  it("fails a corrupted file", () => {
    expect(errorsOf(new TextEncoder().encode("this is not a glb at all, sorry").buffer as ArrayBuffer)).toMatch(/Not a GLB/);
    expect(errorsOf(new ArrayBuffer(4))).toMatch(/too small/);
    const glb = buildGlb();
    expect(errorsOf(glb.slice(0, glb.byteLength - 40))).toMatch(/truncated/);
    const badJson = glb.slice(0);
    new Uint8Array(badJson)[20] = 0x7d; // the JSON's opening brace becomes a closing one
    expect(errorsOf(badJson)).toMatch(/JSON/);
    expect(validateGlb(badJson).passed).toBe(false);
  });

  it("fails when there is no renderable mesh", () => {
    expect(errorsOf(buildGlb({ noMeshes: true }))).toMatch(/No renderable mesh/);
    expect(errorsOf(buildGlb({ indexCount: 0 }))).toMatch(/No renderable mesh/);
  });

  it("fails when required geometry is missing", () => {
    expect(errorsOf(buildGlb({ omitPosition: true }))).toMatch(/no POSITION/);
    expect(errorsOf(buildGlb({ externalBuffer: true }))).toMatch(/external file/);
  });

  it("fails invalid dimensions", () => {
    expect(errorsOf(buildGlb({ min: [-2, 0, -2], max: [2, 0, 2] }))).toMatch(/Invalid dimensions/);
    expect(errorsOf(buildGlb({ min: [-300, 0, -1], max: [300, 2, 1] }))).toMatch(/Invalid dimensions/);
    expect(errorsOf(buildGlb({ min: [0, 0, 0], max: [0.01, 0.01, 0.01] }))).toMatch(/Invalid dimensions/);
  });

  it("fails models the viewer cannot decode, and unsupported versions", () => {
    expect(errorsOf(buildGlb({ extensionsRequired: ["KHR_draco_mesh_compression"] }))).toMatch(/cannot decode/);
    expect(errorsOf(buildGlb({ version: "1.0" }))).toMatch(/Unsupported glTF version/);
  });

  it("never throws", () => {
    for (const bytes of [new ArrayBuffer(0), new ArrayBuffer(64), buildGlb().slice(0, 30)]) {
      expect(() => validateGlb(bytes)).not.toThrow();
      expect(validateGlb(bytes).passed).toBe(false);
    }
  });
});
