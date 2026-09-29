import type { ArchitecturalDesignDocument } from "./document";
import type { HousePrimitive } from "@/lib/house/types";

/** DEV-only, deterministic summaries shared by the compiler audit and the live R3F boundary. */
export function auditHash(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
}

const n = (value: number) => Number(value.toFixed(3));
export function primitiveSignature(p: HousePrimitive): string {
  if (p.kind === "box") return `${p.kind}|${p.id}|${p.position.map(n).join(",")}|${p.size.map(n).join(",")}`;
  const xs = p.vertices.filter((_, i) => i % 3 === 0), ys = p.vertices.filter((_, i) => i % 3 === 1), zs = p.vertices.filter((_, i) => i % 3 === 2);
  return `${p.kind}|${p.id}|${n(Math.min(...xs))},${n(Math.min(...ys))},${n(Math.min(...zs))}|${n(Math.max(...xs) - Math.min(...xs))},${n(Math.max(...ys) - Math.min(...ys))},${n(Math.max(...zs) - Math.min(...zs))}`;
}

export function primitiveBounds(primitives: readonly HousePrimitive[]) {
  const values = primitives.flatMap((p) => {
    if (p.kind === "box") {
      const [x, y, z] = p.position, [w, h, d] = p.size;
      return [[x - w / 2, y - h / 2, z - d / 2], [x + w / 2, y + h / 2, z + d / 2]];
    }
    const points: number[][] = [];
    for (let i = 0; i < p.vertices.length; i += 3) points.push([p.vertices[i], p.vertices[i + 1], p.vertices[i + 2]]);
    return points;
  });
  const min = [0, 1, 2].map((i) => n(Math.min(...values.map((v) => v[i]))));
  const max = [0, 1, 2].map((i) => n(Math.max(...values.map((v) => v[i]))));
  return { min, max, size: max.map((v, i) => n(v - min[i])) };
}

export function massIdOf(p: HousePrimitive): string | undefined {
  return /^architecture-([^-]+(?:-[^-]+)*)-(?:floor|wall|roof|window|door|post|beam|debug)/.exec(p.id)?.[1];
}

export function documentAudit(document: ArchitecturalDesignDocument) {
  return {
    hash: auditHash(document),
    massCount: document.massing.masses.length,
    operationCount: document.massing.masses.reduce((sum, mass) => sum + (mass.operations?.length ?? 0), 0),
  };
}
