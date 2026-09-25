import type { WallSide } from "@/types/house";

const WALL_SIDES: WallSide[] = ["north", "south", "east", "west"];

export interface FeatureValidation<T> {
  value: T | null;
  errors: string[];
  warnings: string[];
}

export function readWall(o: Record<string, unknown>, fallback: WallSide): { value: WallSide; warning?: string } {
  const raw = o.wall;
  if (typeof raw === "string" && WALL_SIDES.includes(raw as WallSide)) {
    return { value: raw as WallSide };
  }
  return { value: fallback, warning: `Unknown "wall" value ${JSON.stringify(raw)} — defaulting to "${fallback}".` };
}

export function clampNumber(value: number, min: number, max: number, field: string, warnings: string[]): number {
  const clamped = Math.min(max, Math.max(min, value));
  if (clamped !== value) warnings.push(`"${field}" clamped to ${clamped}.`);
  return clamped;
}

export function requireNumbers(
  o: Record<string, unknown>,
  fields: string[]
): { values: Record<string, number>; errors: string[] } {
  const values: Record<string, number> = {};
  const errors: string[] = [];
  for (const field of fields) {
    const v = o[field];
    if (typeof v === "number" && Number.isFinite(v)) {
      values[field] = v;
    } else {
      errors.push(`"${field}" must be a number.`);
    }
  }
  return { values, errors };
}

export function readOptionalNumber(o: Record<string, unknown>, field: string, fallback: number): number {
  const v = o[field];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Reads an optional enum-valued field, falling back (with a warning only when a value was given but unknown). */
export function readEnum<T extends string>(o: Record<string, unknown>, field: string, list: readonly T[], fallback: T, warnings: string[]): T {
  const raw = o[field];
  if (typeof raw === "string" && (list as readonly string[]).includes(raw)) return raw as T;
  if (raw !== undefined) warnings.push(`Unknown "${field}" value ${JSON.stringify(raw)} — defaulting to "${fallback}".`);
  return fallback;
}

/** Reads an optional numeric field, clamped into range; a missing value silently takes the fallback. */
export function readNumber(o: Record<string, unknown>, field: string, fallback: number, min: number, max: number, warnings: string[]): number {
  const raw = o[field];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return clampNumber(raw, min, max, field, warnings);
}
