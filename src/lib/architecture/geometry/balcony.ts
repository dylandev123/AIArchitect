import type { BalconyOperation, MassVolume } from "../document";

/** A rectangular, exterior-only platform in a mass's local X/Z coordinates. */
export interface BalconyPlatformRect { x0: number; x1: number; z0: number; z1: number }

const applicableOnLevel = (operation: BalconyOperation, level: number) => operation.floors === "upper" && level > 0;

/**
 * Balcony platforms intentionally do not participate in the enclosing floor footprint. They are thin slabs
 * attached to the existing exterior wall, rather than another storey's volume, wall loop, or roof.
 */
export function balconyPlatformRect(mass: Pick<MassVolume, "width" | "depth">, operation: BalconyOperation): BalconyPlatformRect {
  const start = Math.max(0, Math.min(1, Math.min(operation.start, operation.end)));
  const end = Math.max(0, Math.min(1, Math.max(operation.start, operation.end)));
  const halfW = mass.width / 2, halfD = mass.depth / 2;
  switch (operation.facade) {
    case "north": return { x0: -halfW + start * mass.width, x1: -halfW + end * mass.width, z0: -halfD - operation.depth, z1: -halfD };
    case "south": return { x0: -halfW + start * mass.width, x1: -halfW + end * mass.width, z0: halfD, z1: halfD + operation.depth };
    case "east": return { x0: halfW, x1: halfW + operation.depth, z0: -halfD + start * mass.depth, z1: -halfD + end * mass.depth };
    case "west": return { x0: -halfW - operation.depth, x1: -halfW, z0: -halfD + start * mass.depth, z1: -halfD + end * mass.depth };
  }
}

export function balconiesOnLevel(mass: Pick<MassVolume, "operations">, level: number): BalconyOperation[] {
  return (mass.operations ?? []).filter((operation): operation is BalconyOperation => operation.type === "balcony" && applicableOnLevel(operation, level));
}
