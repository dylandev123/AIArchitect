import type { WaterwayConfig, WaterwayKind } from "@/types/house";
import type { HousePrimitive } from "../types";
import { SITE_POSITION_LIMIT, WATERWAY_LIMITS } from "../constants";
import { hash01, shade } from "../architecture/parts";
import { bowedCurve, extrudeBand, meander, offsetPolyline, polylineLength, pointAlong, ribbon, samplesFor, stripBetween, triMeshOf, type P2 } from "../geometry/mesh";
import { boulderMesh } from "./rocks";
import type { BuildContext } from "./context";
import { clampNumber, readEnum, readNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

const KINDS: WaterwayKind[] = ["river", "stream"];

export function validateWaterway(raw: unknown): FeatureValidation<WaterwayConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x1", "z1", "x2", "z2", "width"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const kind = readEnum(o, "kind", KINDS, "stream", warnings);
  const pos = (v: number, field: string) => clampNumber(v, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, field, warnings);
  const x1 = pos(values.x1, "x1");
  const z1 = pos(values.z1, "z1");
  let x2 = pos(values.x2, "x2");
  const z2 = pos(values.z2, "z2");
  if (Math.hypot(x2 - x1, z2 - z1) < WATERWAY_LIMITS.length.min) {
    warnings.push('"x2"/"z2" were too close to "x1"/"z1" — extended the end point.');
    x2 = x1 + WATERWAY_LIMITS.length.min;
  }
  const width = clampNumber(values.width, WATERWAY_LIMITS.width.min, WATERWAY_LIMITS.width.max, "width", warnings);
  const bend = readNumber(o, "bend", 0, WATERWAY_LIMITS.bend.min, WATERWAY_LIMITS.bend.max, warnings);
  const meanderAmount = readNumber(o, "meander", kind === "river" ? 0.5 : 0.7, WATERWAY_LIMITS.meander.min, WATERWAY_LIMITS.meander.max, warnings);
  return { value: { kind, x1, z1, x2, z2, width, bend, meander: meanderAmount }, errors: [], warnings };
}

/** The waterway's centre line — a bowed curve with a wander added — shared with the footprint code. */
export function waterwayCurve(config: WaterwayConfig, index = 0): P2[] {
  const a: P2 = [config.x1, config.z1];
  const b: P2 = [config.x2, config.z2];
  const base = bowedCurve(a, b, config.bend, samplesFor(Math.hypot(b[0] - a[0], b[1] - a[1]), 2.5, 8, 160));
  const wavelength = Math.max(16, config.width * 6);
  return meander(base, config.width * 0.7 * config.meander, wavelength, hash01(index * 5.3 + config.x1 * 0.01) * Math.PI * 2);
}

const WATER: Record<WaterwayKind, string> = { river: "#2b86a6", stream: "#4aa6c2" };
const MUD = "#6a5a3f";
const BANK = "#7c6c50";
const BANK_WIDTH = 0.7;

/**
 * A river or stream: a sunken bed and water surface between raised banks, with mud shoulders and scattered bank
 * stones. It follows the terrain and its own bends; the water sits below the bank lips so it reads as a channel.
 */
export function buildWaterway(config: WaterwayConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const centre = waterwayCurve(config, index);
  const half = config.width / 2;
  const id = `waterway-${index}`;
  const label = `${config.kind === "river" ? "River" : "Stream"} ${index + 1}`;
  const g = ctx.groundAt;
  const at = (dy: number) => (x: number, z: number) => g(x, z) + dy;
  const rough = (color: string, roughness = 0.95) => ({ color, roughness, metalness: 0 });

  const out: HousePrimitive[] = [
    triMeshOf(`${id}-shoulder`, "waterway", `${label} Bank`, stripBetween(offsetPolyline(centre, half + BANK_WIDTH + 1.1), offsetPolyline(centre, -half - BANK_WIDTH - 1.1), at(0.025)), rough(MUD)),
    triMeshOf(`${id}-lips`, "waterway", `${label} Bank`, [
      ...extrudeBand(offsetPolyline(centre, half + BANK_WIDTH), offsetPolyline(centre, half), at(0), at(0.16)),
      ...extrudeBand(offsetPolyline(centre, -half), offsetPolyline(centre, -half - BANK_WIDTH), at(0), at(0.16)),
    ], rough(BANK)),
    triMeshOf(`${id}-bed`, "waterway", `${label} Bed`, ribbon(centre, config.width, at(0.03)), rough(shade(MUD, 0.55))),
    // The renderer draws any "…-water" mesh on a waterway with the animated water shader.
    triMeshOf(`${id}-water`, "waterway", `${label} Water`, ribbon(centre, config.width, at(0.075)), {
      color: WATER[config.kind],
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.86,
    }),
  ];

  // Bank stones, merged into one mesh so a long river stays a handful of primitives.
  const length = polylineLength(centre);
  const spacing = config.kind === "river" ? 5 : 2.6;
  const count = Math.min(60, Math.floor(length / spacing));
  const stones: number[] = [];
  for (let i = 0; i < count; i++) {
    const { p, tangent } = pointAlong(centre, (i + 0.5) / count);
    const side = hash01(i * 2.3 + index) > 0.5 ? 1 : -1;
    const off = side * (half + BANK_WIDTH * (0.4 + hash01(i * 4.1) * 1.2));
    const x = p[0] - tangent[1] * off;
    const z = p[1] + tangent[0] * off;
    stones.push(...boulderMesh(x, g(x, z) + 0.06, z, 0.22 + hash01(i * 6.7 + index) * (config.kind === "river" ? 0.5 : 0.3), i * 3 + index));
  }
  if (stones.length > 0) out.push(triMeshOf(`${id}-stones`, "waterway", `${label} Stones`, stones, rough("#8b877d", 0.9)));
  return out;
}
