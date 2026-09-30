/** Pure footprint geometry for V2 building masses — no compiler dependency, safe for scenery code. */

/**
 * The ground a V2 building mass stands on, in world metres. `rotation` is the mass's yaw in radians, with the
 * compiler's convention: a local point (lx, lz) sits at (cx + lx·cos + lz·sin, cz − lx·sin + lz·cos).
 */
export interface MassFootprint { id: string; cx: number; cz: number; width: number; depth: number; rotation: number }

/** A world point in the mass's own frame (x along its width, z along its depth). */
export function toMassLocal(mass: MassFootprint, x: number, z: number): [number, number] {
  const dx = x - mass.cx, dz = z - mass.cz, cos = Math.cos(mass.rotation), sin = Math.sin(mass.rotation);
  return [dx * cos - dz * sin, dx * sin + dz * cos];
}

export function fromMassLocal(mass: MassFootprint, lx: number, lz: number): [number, number] {
  const cos = Math.cos(mass.rotation), sin = Math.sin(mass.rotation);
  return [mass.cx + lx * cos + lz * sin, mass.cz - lx * sin + lz * cos];
}

/** Whether (x, z) lies inside the mass grown by `margin` metres on every side (a negative margin shrinks it). */
export function insideMass(mass: MassFootprint, x: number, z: number, margin = 0): boolean {
  const [lx, lz] = toMassLocal(mass, x, z);
  return Math.abs(lx) < mass.width / 2 + margin && Math.abs(lz) < mass.depth / 2 + margin;
}

/** Axis-aligned half-extents of a (possibly turned) mass. */
export function massHalfExtents(mass: MassFootprint): { halfW: number; halfD: number } {
  const c = Math.abs(Math.cos(mass.rotation)), s = Math.abs(Math.sin(mass.rotation));
  return { halfW: (mass.width * c + mass.depth * s) / 2, halfD: (mass.width * s + mass.depth * c) / 2 };
}
