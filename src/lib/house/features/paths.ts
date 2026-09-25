import type { PathConfig, PathSurface } from "@/types/house";
import type { HousePrimitive } from "../types";
import { PATH_LIMITS, SITE_POSITION_LIMIT } from "../constants";
import { hash01, shade } from "../architecture/parts";
import { bowedCurve, extrudeBand, flatPolygon, offsetPolyline, orientedBox, pointAlong, polylineLength, ribbon, samplesFor, triMeshOf, type P2 } from "../geometry/mesh";
import type { BuildContext } from "./context";
import { clampNumber, readEnum, readNumber, requireNumbers, type FeatureValidation } from "./validateHelpers";

const SURFACES: PathSurface[] = ["gravel", "flagstone", "dirt", "boardwalk"];

export function validatePath(raw: unknown): FeatureValidation<PathConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["x1", "z1", "x2", "z2", "width"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const pos = (v: number, field: string) => clampNumber(v, SITE_POSITION_LIMIT.min, SITE_POSITION_LIMIT.max, field, warnings);
  const x1 = pos(values.x1, "x1");
  const z1 = pos(values.z1, "z1");
  let x2 = pos(values.x2, "x2");
  const z2 = pos(values.z2, "z2");
  if (Math.hypot(x2 - x1, z2 - z1) < PATH_LIMITS.length.min) {
    warnings.push('"x2"/"z2" were nearly identical to "x1"/"z1" — extended the end point.');
    x2 = x1 + PATH_LIMITS.length.min;
  }
  const width = clampNumber(values.width, PATH_LIMITS.width.min, PATH_LIMITS.width.max, "width", warnings);
  const bend = readNumber(o, "bend", 0, PATH_LIMITS.bend.min, PATH_LIMITS.bend.max, warnings);
  const surface = readEnum(o, "surface", SURFACES, "gravel", warnings);
  return { value: { x1, z1, x2, z2, width, bend, surface }, errors: [], warnings };
}

/** The path's centre line — shared with the footprint code so trees keep clear of it. */
export function pathCurve(config: PathConfig): P2[] {
  const a: P2 = [config.x1, config.z1];
  const b: P2 = [config.x2, config.z2];
  return bowedCurve(a, b, config.bend, samplesFor(Math.hypot(b[0] - a[0], b[1] - a[1]), 1.5, 4, 100));
}

const COLORS: Record<PathSurface, [string, string]> = {
  gravel: ["#c4b690", "#a89a76"],
  dirt: ["#8d6f49", "#75593a"],
  flagstone: ["#9c978a", "#857f72"],
  boardwalk: ["#8d6c46", "#78593a"],
};

const LIFT = 0.07;

/**
 * A garden or woodland path. Gravel and dirt are a ribbon with a stone edging; flagstone is a run of separate
 * irregular slabs; a boardwalk is cross planks on stringers. All follow the ground and any bend in the line.
 */
export function buildPath(config: PathConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const centre = pathCurve(config);
  const id = `path-${index}`;
  const label = `Path ${index + 1}`;
  const g = ctx.groundAt;
  const y = (x: number, z: number) => g(x, z) + LIFT;
  const [main, alt] = COLORS[config.surface];
  const paint = (color: string, roughness = 0.95) => ({ color, roughness, metalness: 0 });
  const length = polylineLength(centre);

  if (config.surface === "flagstone") {
    const a: number[] = [];
    const b: number[] = [];
    const count = Math.max(2, Math.floor(length / (config.width * 0.85)));
    for (let i = 0; i < count; i++) {
      const { p, tangent } = pointAlong(centre, (i + 0.5) / count);
      const jitter = (hash01(i * 3.1 + index) - 0.5) * config.width * 0.25;
      const cx = p[0] - tangent[1] * jitter;
      const cz = p[1] + tangent[0] * jitter;
      const rx = config.width * (0.4 + hash01(i * 1.7) * 0.1);
      const rz = (length / count) * 0.44;
      const slab: P2[] = Array.from({ length: 8 }, (_, k) => {
        const ang = (k / 8) * Math.PI * 2 + hash01(i + k) * 0.3;
        const r = 0.85 + hash01(i * 8 + k) * 0.25;
        const lx = Math.cos(ang) * rx * r;
        const lz = Math.sin(ang) * rz * r;
        // Rotate into the path's direction.
        return [cx + lx * -tangent[1] + lz * tangent[0], cz + lx * tangent[0] + lz * tangent[1]] as P2;
      });
      (i % 2 === 0 ? a : b).push(...flatPolygon(slab, (x, z) => g(x, z) + LIFT + 0.02));
    }
    return [
      triMeshOf(`${id}-slabs-a`, "path", `${label} Flagstones`, a, paint(main)),
      ...(b.length > 0 ? [triMeshOf(`${id}-slabs-b`, "path", `${label} Flagstones`, b, paint(alt))] : []),
    ];
  }

  if (config.surface === "boardwalk") {
    const planksA: number[] = [];
    const planksB: number[] = [];
    const count = Math.max(2, Math.floor(length / 0.24));
    for (let i = 0; i < count; i++) {
      const { p, tangent } = pointAlong(centre, (i + 0.5) / count);
      const rot = Math.atan2(tangent[1], tangent[0]);
      const gy = g(p[0], p[1]);
      (i % 2 === 0 ? planksA : planksB).push(...orientedBox(p[0], gy + 0.16, p[1], 0.2, 0.04, config.width, -rot));
    }
    return [
      triMeshOf(`${id}-stringers`, "path", `${label} Stringers`, ribbon(centre, config.width - 0.2, (x, z) => g(x, z) + 0.12), paint(shade(alt, 0.6))),
      triMeshOf(`${id}-planks-a`, "path", `${label} Boards`, planksA, paint(main, 0.8)),
      triMeshOf(`${id}-planks-b`, "path", `${label} Boards`, planksB, paint(alt, 0.8)),
    ];
  }

  const half = config.width / 2;
  return [
    triMeshOf(`${id}-surface`, "path", label, ribbon(centre, config.width, y), paint(main)),
    triMeshOf(`${id}-edging`, "path", `${label} Edging`, [
      ...extrudeBand(offsetPolyline(centre, half + 0.1), offsetPolyline(centre, half), (x, z) => g(x, z), (x, z) => g(x, z) + LIFT + 0.05),
      ...extrudeBand(offsetPolyline(centre, -half), offsetPolyline(centre, -half - 0.1), (x, z) => g(x, z), (x, z) => g(x, z) + LIFT + 0.05),
    ], paint(alt, 0.9)),
  ];
}
