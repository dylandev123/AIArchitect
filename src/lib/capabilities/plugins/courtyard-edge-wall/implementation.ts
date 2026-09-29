import type { HousePrimitive } from "@/lib/house/types";
import type { CapabilityImplementation } from "../../types";

type Target = { id: string; width: number; depth: number; position: { x: number; z: number }; elevation: number };
const isMass = (value: unknown): value is Target => typeof value === "object" && value !== null && "width" in value && "depth" in value && "position" in value;
const SIDES = new Set(["north", "south", "east", "west"]);

/** Geometry only. World-space side, matching the convention `resolveMasses` already uses for relationship placement. */
export const implementation: CapabilityImplementation = {
  apply({ target }, parameters) {
    if (!isMass(target) || target.id !== parameters.massId) throw new Error("Courtyard Edge Wall requires its target mass.");
    const side = typeof parameters.side === "string" && SIDES.has(parameters.side) ? parameters.side : undefined;
    if (!side) throw new Error("Courtyard Edge Wall requires a valid side.");
    const height = typeof parameters.height === "number" ? parameters.height : 1.1;
    const thickness = typeof parameters.thickness === "number" ? parameters.thickness : 0.2;
    const y = target.elevation + height / 2;
    const along = side === "north" || side === "south" ? target.width : target.depth;
    const size: [number, number, number] = side === "north" || side === "south" ? [along, height, thickness] : [thickness, height, along];
    const position: [number, number, number] =
      side === "north" ? [target.position.x, y, target.position.z - target.depth / 2 - thickness / 2]
      : side === "south" ? [target.position.x, y, target.position.z + target.depth / 2 + thickness / 2]
      : side === "east" ? [target.position.x + target.width / 2 + thickness / 2, y, target.position.z]
      : [target.position.x - target.width / 2 - thickness / 2, y, target.position.z];
    const wall = { color: "#b7ad9a", roughness: .7, metalness: .02 };
    const primitives: HousePrimitive[] = [
      { kind: "box", id: `capability-courtyard-edge-wall-${target.id}-${side}`, category: "landscape", label: "Courtyard Edge Wall", position, rotation: [0, 0, 0], size, ...wall },
    ];
    return { primitives, note: `Added a courtyard edge wall on ${target.id}'s ${side} side.` };
  },
};
