import type { HousePrimitive } from "@/lib/house/types";
import type { CapabilityImplementation } from "../../types";

type Target = { id: string; width: number; depth: number; position: { x: number; z: number }; elevation: number };
const isMass = (value: unknown): value is Target => typeof value === "object" && value !== null && "width" in value && "depth" in value && "position" in value;

/**
 * Exposed structural columns lifting an already-elevated mass clear of grade — the "floating box on stilts"
 * reading a bare `elevation` offset (e.g. via `stepped-above`) doesn't get on its own, since nothing else in
 * the compiler fills that gap with geometry. Geometry only: this never changes the mass's own elevation,
 * only adds columns underneath it, and ignores the target mass's own rotation (same approximation Entry
 * Canopy/Brise Soleil make).
 */
export const implementation: CapabilityImplementation = {
  apply({ target, allMasses }, parameters) {
    if (!isMass(target) || target.id !== parameters.massId) throw new Error("Pilotis requires its target mass.");
    const groundY = typeof parameters.groundY === "number" ? parameters.groundY : 0;
    const columnHeight = target.elevation - groundY;
    if (columnHeight < 0.3) throw new Error("Pilotis requires a real gap between grade and the mass's underside.");
    const columnSize = typeof parameters.columnSize === "number" ? parameters.columnSize : 0.32;
    const inset = typeof parameters.inset === "number" ? parameters.inset : 0.7;
    const halfW = target.width / 2 - inset;
    const halfD = target.depth / 2 - inset;
    if (halfW <= 0 || halfD <= 0) throw new Error("Pilotis requires a mass large enough for its column inset.");
    const points: [number, number][] = [[-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD]];
    // A long span reads as visibly unsupported with corner columns alone — add mid-span columns along the
    // long axis's two edges once that axis exceeds 8m.
    if (target.width >= target.depth && target.width > 8) points.push([0, -halfD], [0, halfD]);
    else if (target.depth > target.width && target.depth > 8) points.push([-halfW, 0], [halfW, 0]);
    // A mass partly resting on a lower one (e.g. an upper box cantilevering off a ground pavilion) only needs
    // columns where it's actually unsupported — skip any column that would stand inside a lower mass.
    const lowerMasses = (allMasses ?? []).filter((m) => m.id !== target.id && m.elevation < target.elevation);
    const insideLowerMass = (x: number, z: number) => lowerMasses.some((m) => Math.abs(x - m.position.x) < m.width / 2 && Math.abs(z - m.position.z) < m.depth / 2);
    const freestanding = points.map(([lx, lz]) => [target.position.x + lx, target.position.z + lz] as const).filter(([x, z]) => !insideLowerMass(x, z));
    if (freestanding.length === 0) throw new Error("Pilotis found no unsupported span under the target mass.");
    const paint = { color: "#2c2c2c", roughness: 0.55, metalness: 0.25 };
    const id = `capability-pilotis-${target.id}`;
    const primitives: HousePrimitive[] = freestanding.map(([x, z], i) => ({
      kind: "box", id: `${id}-column-${i}`, category: "wall", label: "Pilotis Column",
      position: [x, groundY + columnHeight / 2, z],
      rotation: [0, 0, 0], size: [columnSize, columnHeight, columnSize], ...paint,
    }));
    return { primitives, note: `Lifted ${target.id} on ${primitives.length} exposed columns.` };
  },
};
