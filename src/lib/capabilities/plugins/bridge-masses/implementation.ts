import type { HousePrimitive } from "@/lib/house/types";
import type { CapabilityImplementation } from "../../types";

type Target = { id: string; width: number; depth: number; position: { x: number; z: number }; elevation: number };
const isMass = (value: unknown): value is Target => typeof value === "object" && value !== null && "width" in value && "depth" in value && "position" in value;

/** Geometry only. Approximates each mass's footprint as a circle of radius max(width,depth)/2 to find its near edge. */
export const implementation: CapabilityImplementation = {
  apply({ target, allMasses }, parameters) {
    if (!isMass(target) || target.id !== parameters.massId) throw new Error("Bridge Masses requires its target mass.");
    const secondary = allMasses?.find((m) => m.id === parameters.secondaryMassId);
    if (!secondary) throw new Error("Bridge Masses requires a resolved secondary mass.");
    const dx = secondary.position.x - target.position.x;
    const dz = secondary.position.z - target.position.z;
    const centerDistance = Math.hypot(dx, dz);
    if (centerDistance < 0.5) throw new Error("Bridge Masses requires separated masses.");
    const ux = dx / centerDistance, uz = dz / centerDistance;
    const radiusA = Math.max(target.width, target.depth) / 2;
    const radiusB = Math.max(secondary.width, secondary.depth) / 2;
    const span = centerDistance - radiusA - radiusB;
    if (span <= 0.3) throw new Error("Bridge Masses requires a real gap between the two masses.");
    const width = typeof parameters.width === "number" ? parameters.width : 2.2;
    const height = typeof parameters.height === "number" ? parameters.height : 2.6;
    const midX = target.position.x + ux * (radiusA + span / 2);
    const midZ = target.position.z + uz * (radiusA + span / 2);
    const elevation = (target.elevation + secondary.elevation) / 2;
    const rotationY = Math.atan2(ux, uz);
    const frame = { color: "#c9c2b4", roughness: .62, metalness: .05 };
    const id = `capability-bridge-masses-${target.id}-${secondary.id}`;
    const primitives: HousePrimitive[] = [
      { kind: "box", id: `${id}-deck`, category: "floor", label: "Bridge Connector · Deck", position: [midX, elevation + .1, midZ], rotation: [0, rotationY, 0], size: [width, .2, span], ...frame },
      { kind: "box", id: `${id}-roof`, category: "roof", label: "Bridge Connector · Roof", position: [midX, elevation + height, midZ], rotation: [0, rotationY, 0], size: [width + .2, .18, span], ...frame },
    ];
    return { primitives, note: `Connected ${target.id} and ${secondary.id} with a ${span.toFixed(1)}m corridor.` };
  },
};
