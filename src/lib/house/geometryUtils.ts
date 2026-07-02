export type Vec3 = [number, number, number];

/** Two coplanar triangles, vertices given in order around the quad perimeter. */
export function quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number[] {
  return [...tri(a, b, c), ...tri(a, c, d)];
}

export function tri(a: Vec3, b: Vec3, c: Vec3): number[] {
  return [...a, ...b, ...c];
}
