import type { RockClusterConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { ROCK_LIMITS, SITE_POSITION_LIMIT } from "../constants";
import { hash01, shade } from "../architecture/parts";
import { triMeshOf } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

export function validateRockCluster(raw: unknown): FeatureValidation<RockClusterConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x", "z", "radius"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const x = clampNumber(values.x, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "x", warnings);
  const z = clampNumber(values.z, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, "z", warnings);
  const radius = clampNumber(values.radius, ROCK_LIMITS.radius.min, ROCK_LIMITS.radius.max, "radius", warnings);
  const count = Math.round(readNumber(o, "count", 6, ROCK_LIMITS.count.min, ROCK_LIMITS.count.max, warnings));
  const size = readNumber(o, "size", 1.4, ROCK_LIMITS.size.min, ROCK_LIMITS.size.max, warnings);
  return { value: { x, z, radius, count, size }, errors: [], warnings };
}

// Icosahedron: 12 vertices, 20 faces. Each vertex is pushed in or out by a hashed amount to make a boulder.
const T = (1 + Math.sqrt(5)) / 2;
const ICO_VERTS: [number, number, number][] = [
  [-1, T, 0], [1, T, 0], [-1, -T, 0], [1, -T, 0],
  [0, -1, T], [0, 1, T], [0, -1, -T], [0, 1, -T],
  [T, 0, -1], [T, 0, 1], [-T, 0, -1], [-T, 0, 1],
];
const ICO_FACES: [number, number, number][] = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

/** A single irregular boulder of about `radius`, resting with its base at `y`. Deterministic for a given seed. */
export function boulderMesh(cx: number, y: number, cz: number, radius: number, seed: number): number[] {
  const verts = ICO_VERTS.map(([vx, vy, vz], i) => {
    const len = Math.hypot(vx, vy, vz);
    const r = radius * (0.72 + hash01(seed * 13.7 + i * 3.3) * 0.5);
    return [(vx / len) * r * 1.15, (vy / len) * r * 0.7, (vz / len) * r] as [number, number, number];
  });
  const lift = radius * 0.45;
  const out: number[] = [];
  for (const [a, b, c] of ICO_FACES) {
    for (const k of [a, b, c]) out.push(cx + verts[k][0], y + lift + verts[k][1], cz + verts[k][2]);
  }
  return out;
}

const ROCK_TONES = ["#8a867c", "#7a766d", "#9a958a", "#6f6b63"];

/** A scatter of boulders around a centre: one large anchor stone, the rest smaller and spread by `radius`. */
export function buildRockCluster(config: RockClusterConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const id = `rockCluster-${index}`;
  const label = `Rocks ${index + 1}`;
  const out: HousePrimitive[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < config.count; k++) {
    // Sunflower spread keeps rocks apart without needing collision tests.
    const r = k === 0 ? 0 : config.radius * Math.sqrt((k + 0.5) / config.count);
    const a = k * golden + hash01(index * 3.9 + k) * 0.5;
    const x = config.x + Math.cos(a) * r;
    const z = config.z + Math.sin(a) * r;
    const size = (config.size / 2) * (k === 0 ? 1 : 0.35 + hash01(k * 2.1 + index) * 0.55);
    const tone = ROCK_TONES[k % ROCK_TONES.length];
    out.push(triMeshOf(`${id}-rock-${k}`, "rock", label, boulderMesh(x, ctx.groundAt(x, z) - 0.1, z, size, k + index * 31), { color: shade(tone, 0.9 + hash01(k + index) * 0.2), roughness: 0.93, metalness: 0.02 }));
  }
  return out;
}
