import { describe, expect, it } from "vitest";
import { clampNearBound, recoverRotationOffset } from "../numericNormalization";

describe("recoverRotationOffset", () => {
  it("leaves a normal valid rotation (already within [-π, π]) unchanged", () => {
    expect(recoverRotationOffset(0)).toBe(0);
    expect(recoverRotationOffset(1.2)).toBe(1.2);
    expect(recoverRotationOffset(-Math.PI)).toBe(-Math.PI);
    expect(recoverRotationOffset(Math.PI)).toBe(Math.PI);
  });

  it("converts a degree-like value (the live failure: e.g. 90°/180° instead of radians) into canonical radians", () => {
    expect(recoverRotationOffset(90)).toBeCloseTo(Math.PI / 2, 10);
    expect(recoverRotationOffset(-90)).toBeCloseTo(-Math.PI / 2, 10);
    expect(recoverRotationOffset(180)).toBeCloseTo(Math.PI, 10);
    expect(recoverRotationOffset(45)).toBeCloseTo(Math.PI / 4, 10);
  });

  it("wraps a >π radians-like overshoot (the live failure's own shape: exceeds the schema's <=3.14159 bound) safely into range instead of rejecting it", () => {
    // ~π + 0.5, within one full turn past π — reinterpreted as a radians overshoot, not degrees (a
    // literal 3.64° rotation would be architecturally meaningless), and wrapped directly.
    const wrapped = recoverRotationOffset(Math.PI + 0.5);
    expect(wrapped).toBeCloseTo(Math.PI + 0.5 - Math.PI * 2, 10);
    expect(wrapped!).toBeGreaterThanOrEqual(-Math.PI);
    expect(wrapped!).toBeLessThanOrEqual(Math.PI);

    // A full degrees value (270°) converts first, then still needs the same >π wrap after conversion.
    const fromDegrees = recoverRotationOffset(270);
    expect(fromDegrees).toBeCloseTo((270 * Math.PI) / 180 - Math.PI * 2, 10);
    expect(fromDegrees!).toBeGreaterThanOrEqual(-Math.PI);
    expect(fromDegrees!).toBeLessThanOrEqual(Math.PI);
  });

  it("rejects (returns undefined for) a non-finite value instead of guessing", () => {
    expect(recoverRotationOffset(NaN)).toBeUndefined();
    expect(recoverRotationOffset(Infinity)).toBeUndefined();
    expect(recoverRotationOffset(-Infinity)).toBeUndefined();
    expect(recoverRotationOffset("90")).toBeUndefined();
    expect(recoverRotationOffset(undefined)).toBeUndefined();
  });

  it("rejects a wildly out-of-range value rather than silently repairing genuinely nonsensical geometry", () => {
    expect(recoverRotationOffset(999999)).toBeUndefined();
    expect(recoverRotationOffset(-99999)).toBeUndefined();
  });
});

describe("clampNearBound", () => {
  it("leaves an in-range value unchanged", () => {
    expect(clampNearBound(5, 0, 15)).toBe(5);
  });

  it("clamps a small overshoot to the nearest bound", () => {
    expect(clampNearBound(16, 0, 15)).toBe(15);
    expect(clampNearBound(-0.5, 0, 15)).toBe(0);
  });

  it("rejects a value too far outside the range to be a rounding error", () => {
    expect(clampNearBound(500, 0, 15)).toBeUndefined();
  });

  it("rejects a non-finite value", () => {
    expect(clampNearBound(NaN, 0, 15)).toBeUndefined();
    expect(clampNearBound(undefined, 0, 15)).toBeUndefined();
  });
});
