import type { HousePrimitive } from "@/lib/house/types";
import type { CapabilityImplementation } from "../../types";

type Target = { id: string; width: number; depth: number; floors: number; elevation: number; position: { x: number; z: number }; rotation: number };
const targetIsMass = (value: unknown): value is Target => typeof value === "object" && value !== null && "width" in value && "depth" in value && "position" in value;

/** Geometry only. Validation, fallbacks, telemetry and priority are owned by the generic engine. */
export const implementation: CapabilityImplementation = {
  apply({ target }, parameters) {
    if (!targetIsMass(target) || target.id !== parameters.massId) throw new Error("Corner glazing requires its target mass.");
    const width = typeof parameters.width === "number" ? parameters.width : Math.min(target.width, target.depth) * .42;
    const height = typeof parameters.height === "number" ? parameters.height : 2.5;
    const sill = typeof parameters.sill === "number" ? parameters.sill : .55;
    const y = target.elevation + sill + height / 2;
    const x = target.position.x + target.width / 2 + .018;
    const z = target.position.z + target.depth / 2 + .018;
    const glass = { color: "#9dd9e8", roughness: .04, metalness: .12, transparent: true, opacity: .42 };
    const frame = { color: "#20272a", roughness: .36, metalness: .72 };
    const id = `capability-corner-glazing-${target.id}`;
    const primitives: HousePrimitive[] = [
      { kind: "box", id: `${id}-east-glass`, category: "window", label: "Corner Glazing · East", position: [x, y, z - width / 2], rotation: [0, target.rotation, 0], size: [.035, height, width], ...glass },
      { kind: "box", id: `${id}-south-glass`, category: "window", label: "Corner Glazing · South", position: [x - width / 2, y, z], rotation: [0, target.rotation, 0], size: [width, height, .035], ...glass },
      { kind: "box", id: `${id}-mullion`, category: "window", label: "Corner Glazing · Mullion", position: [x, y, z], rotation: [0, target.rotation, 0], size: [.07, height + .12, .07], ...frame },
    ];
    return { primitives, note: "Applied continuous east/south corner glazing." };
  },
};
