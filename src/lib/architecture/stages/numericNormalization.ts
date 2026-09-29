/**
 * Wraps any finite radians value into the schema's [-π, π] range. A value already inside the range
 * passes through unchanged.
 */
function wrapRadiansToRange(radians: number): number {
  if (radians >= -Math.PI && radians <= Math.PI) return radians;
  const twoPi = Math.PI * 2;
  const wrapped = ((radians % twoPi) + twoPi) % twoPi; // now in [0, twoPi)
  return wrapped > Math.PI ? wrapped - twoPi : wrapped;
}

/**
 * Recovers a rotation-style field the model expressed in a unit other than the canonical radians the
 * compiler expects (`resolveMasses` in compiler.ts adds a mass-expansion `rotationOffset` straight onto
 * a target's own rotation). The schema bounds it to [-π, π] (schemas.ts); an out-of-range value is
 * reinterpreted by how far out it is:
 *  - Within one full turn past the bound (π, 2π]: almost certainly a radians value that overshot from
 *    compounding, not a degrees instruction — a real degree instruction this close to zero would be
 *    architecturally meaningless — so it's wrapped directly, unit unchanged.
 *  - Beyond that, up to 360: a plausible degrees value (the live failure case — e.g. 90 or 180 instead
 *    of ~1.57/~3.14 radians), so it's converted then wrapped.
 *  - Beyond 360: left untouched. Guessing a unit for a wildly out-of-range number would risk turning
 *    genuinely nonsensical geometry into something that silently validates, which this must never do —
 *    an unrecovered value falls through to the normal repair retry instead.
 */
export function recoverRotationOffset(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value >= -Math.PI && value <= Math.PI) return value;
  const magnitude = Math.abs(value);
  if (magnitude <= Math.PI * 2) return wrapRadiansToRange(value);
  if (magnitude <= 360) return wrapRadiansToRange((value * Math.PI) / 180);
  return undefined;
}

/**
 * Recovers a bounded numeric field that overshot its range by a small margin — model rounding, not a
 * unit mistake (e.g. 15.4m for a field capped at 15m, or -0.2 for a field floored at 0). Anything
 * further out than `marginRatio` of the field's own span is left untouched, so a genuinely nonsensical
 * value still fails schema validation and gets a normal repair retry instead of being forced into range.
 */
export function clampNearBound(value: unknown, min: number, max: number, marginRatio = 0.2): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value >= min && value <= max) return value;
  const margin = (max - min) * marginRatio;
  if (value < min && value >= min - margin) return min;
  if (value > max && value <= max + margin) return max;
  return undefined;
}
