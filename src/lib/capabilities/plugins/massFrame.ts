import { LEVEL_HEIGHT } from "@/lib/house/constants";

/** The fields a mass-bound plugin reads from its (deliberately untyped) capability target. */
export interface MassTarget { id: string; width: number; depth: number; floors: number; height?: number; elevation: number; position: { x: number; z: number }; rotation: number }
export type LocalFacade = "north" | "south" | "east" | "west";

export const isMassTarget = (value: unknown): value is MassTarget =>
  typeof value === "object" && value !== null && "width" in value && "depth" in value && "position" in value && "floors" in value;

const LOCAL_NORMAL: Record<LocalFacade, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const WORLD: Record<LocalFacade, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

/** Local (unrotated, mass-centred) x/z → world x/z, same yaw convention as `rotatePrimitiveY`. */
export function toWorld(mass: MassTarget, lx: number, lz: number): [number, number] {
  const c = Math.cos(mass.rotation), s = Math.sin(mass.rotation);
  return [mass.position.x + lx * c + lz * s, mass.position.z - lx * s + lz * c];
}

/** Grade-to-roofline height, mirroring `massTotalHeight` (compiler.ts imports the plugins, so it can't be imported here). */
export const massHeight = (mass: MassTarget) => mass.height ?? mass.floors * LEVEL_HEIGHT;

/** The local facade whose outward normal is closest to a world side — a world-side parameter resolved against the mass's own rotation. */
export function localFacadeFacing(mass: MassTarget, worldSide: LocalFacade): LocalFacade {
  const [wx, wz] = WORLD[worldSide];
  const c = Math.cos(mass.rotation), s = Math.sin(mass.rotation);
  const score = (f: LocalFacade) => { const [x, z] = LOCAL_NORMAL[f]; return (x * c + z * s) * wx + (-x * s + z * c) * wz; };
  return (["north", "east", "south", "west"] as const).reduce((best, f) => (score(f) > score(best) ? f : best));
}

/** Facade geometry in local space: a point at compass u (0 = west/north end), its outward normal, its along-facade direction and length. */
export function facadeFrame(mass: MassTarget, facade: LocalFacade): { at: (u: number, out: number) => [number, number]; tangent: [number, number]; length: number } {
  const hw = mass.width / 2, hd = mass.depth / 2;
  const [nx, nz] = LOCAL_NORMAL[facade];
  const ns = facade === "north" || facade === "south";
  const length = ns ? mass.width : mass.depth;
  return {
    length, tangent: ns ? [1, 0] : [0, 1],
    at: (u, out) => (ns ? [-hw + u * mass.width + nx * out, nz * hd + nz * out] : [nx * hw + nx * out, -hd + u * mass.depth + nz * out]),
  };
}
