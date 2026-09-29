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

/**
 * Evenly spaced vertical sun-shading fins standing proud of one facade — the "brise soleil" seed the library
 * previously listed as missing ("requires a reusable shading asset or a future louver operation"). Geometry
 * only, same approximations Entry Canopy makes: ignores the target mass's own rotation.
 */
export const implementation: CapabilityImplementation = {
  apply({ target }, parameters) {
    if (!isMass(target) || target.id !== parameters.massId) throw new Error("Brise Soleil requires its target mass.");
    const facade = typeof parameters.facade === "string" && SIDES.has(parameters.facade) ? parameters.facade : undefined;
    if (!facade) throw new Error("Brise Soleil requires a valid facade.");
    const span = facade === "north" || facade === "south" ? target.width : target.depth;
    const depth = typeof parameters.depth === "number" ? parameters.depth : 0.45;
    const height = typeof parameters.height === "number" ? parameters.height : 2.6;
    const thickness = typeof parameters.thickness === "number" ? parameters.thickness : 0.06;
    const sill = typeof parameters.sill === "number" ? parameters.sill : 0;
    const count = typeof parameters.count === "number" ? Math.max(2, Math.round(parameters.count)) : Math.max(4, Math.round(span / 1.1));
    const { normal, tangent } = FACADE_VECTORS[facade];
    const baseX = target.position.x + (facade === "east" ? target.width / 2 : facade === "west" ? -target.width / 2 : 0);
    const baseZ = target.position.z + (facade === "north" ? -target.depth / 2 : facade === "south" ? target.depth / 2 : 0);
    const margin = span * 0.06;
    const usable = span - margin * 2;
    const finPaint = { color: "#3c3a34", roughness: 0.7, metalness: 0.1 };
    const id = `capability-brise-soleil-${target.id}-${facade}`;
    const primitives: HousePrimitive[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const offset = -usable / 2 + t * usable;
      const px = baseX + tangent[0] * offset + normal[0] * (depth / 2);
      const pz = baseZ + tangent[1] * offset + normal[1] * (depth / 2);
      const py = target.elevation + sill + height / 2;
      primitives.push({
        kind: "box", id: `${id}-fin-${i}`, category: "wall", label: "Brise Soleil · Fin",
        position: [px, py, pz], rotation: [0, 0, 0],
        size: facade === "north" || facade === "south" ? [thickness, height, depth] : [depth, height, thickness],
        ...finPaint,
      });
    }
    return { primitives, note: `Added ${count} sun-shading fins on ${target.id}'s ${facade} facade.` };
  },
};
