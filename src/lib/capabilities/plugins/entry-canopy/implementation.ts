import type { HousePrimitive } from "@/lib/house/types";
import type { CapabilityImplementation } from "../../types";

type Target = { id: string; width: number; depth: number; position: { x: number; z: number }; elevation: number };
const isMass = (value: unknown): value is Target => typeof value === "object" && value !== null && "width" in value && "depth" in value && "position" in value;
const SIDES = new Set(["north", "south", "east", "west"]);
/** Outward normal and facade-tangent direction for each side, world-space — same convention `resolveMasses`/footprint.ts use. */
const FACADE_VECTORS: Record<string, { normal: [number, number]; tangent: [number, number] }> = {
  north: { normal: [0, -1], tangent: [1, 0] },
  south: { normal: [0, 1], tangent: [1, 0] },
  east: { normal: [1, 0], tangent: [0, 1] },
  west: { normal: [-1, 0], tangent: [0, 1] },
};

/** Geometry only. Ignores the target mass's own rotation (same approximation Courtyard Edge Wall makes). */
export const implementation: CapabilityImplementation = {
  apply({ target }, parameters) {
    if (!isMass(target) || target.id !== parameters.massId) throw new Error("Entry Canopy requires its target mass.");
    const facade = typeof parameters.facade === "string" && SIDES.has(parameters.facade) ? parameters.facade : undefined;
    if (!facade) throw new Error("Entry Canopy requires a valid facade.");
    const width = typeof parameters.width === "number" ? parameters.width : 3;
    const depth = typeof parameters.depth === "number" ? parameters.depth : 1.5;
    const height = typeof parameters.height === "number" ? parameters.height : 2.6;
    const { normal, tangent } = FACADE_VECTORS[facade];
    const baseX = target.position.x + (facade === "east" ? target.width / 2 : facade === "west" ? -target.width / 2 : 0);
    const baseZ = target.position.z + (facade === "north" ? -target.depth / 2 : facade === "south" ? target.depth / 2 : 0);
    const outerX = baseX + normal[0] * depth;
    const outerZ = baseZ + normal[1] * depth;
    const roofY = target.elevation + height;
    const postSize = 0.16;
    const frame = { color: "#c9c2b4", roughness: .62, metalness: .05 };
    const id = `capability-entry-canopy-${target.id}-${facade}`;
    const primitives: HousePrimitive[] = [
      { kind: "box", id: `${id}-roof`, category: "roof", label: "Entry Canopy · Roof", position: [(baseX + outerX) / 2, roofY, (baseZ + outerZ) / 2], rotation: [0, 0, 0], size: facade === "north" || facade === "south" ? [width, .16, depth] : [depth, .16, width], ...frame },
    ];
    for (const side of [-1, 1] as const) {
      const px = outerX + tangent[0] * (width / 2 - postSize / 2) * side;
      const pz = outerZ + tangent[1] * (width / 2 - postSize / 2) * side;
      primitives.push({ kind: "box", id: `${id}-post-${side === -1 ? 0 : 1}`, category: "wall", label: "Entry Canopy · Post", position: [px, target.elevation + height / 2, pz], rotation: [0, 0, 0], size: [postSize, height, postSize], ...frame });
    }
    return { primitives, note: `Added an entry canopy on ${target.id}'s ${facade} facade.` };
  },
};
