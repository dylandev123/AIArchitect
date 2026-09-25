import type { FoundationConfig, WallSide } from "@/types/house";
import type { HousePrimitive } from "../types";
import { FOUNDATION_LIMITS } from "../constants";
import { resolveMaterial } from "../materials";
import { box, paintOf, shade } from "../architecture/parts";
import type { BuildContext } from "./context";
import { clampNumber, readNumber, type FeatureValidation } from "./validateHelpers";

/** The tallest a stepped foundation may stand, so it never swallows window sills. */
const MAX_TOTAL_HEIGHT = 1.0;

export function validateFoundation(raw: unknown): FeatureValidation<FoundationConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const warnings: string[] = [];
  const steps = clampNumber(Math.round(readNumber(o, "steps", 2, FOUNDATION_LIMITS.steps.min, FOUNDATION_LIMITS.steps.max, warnings)), FOUNDATION_LIMITS.steps.min, FOUNDATION_LIMITS.steps.max, "steps", warnings);
  const projection = readNumber(o, "projection", 0.18, FOUNDATION_LIMITS.projection.min, FOUNDATION_LIMITS.projection.max, warnings);
  let riser = readNumber(o, "riser", 0.15, FOUNDATION_LIMITS.riser.min, FOUNDATION_LIMITS.riser.max, warnings);
  if (steps * riser > MAX_TOTAL_HEIGHT) {
    riser = MAX_TOTAL_HEIGHT / steps;
    warnings.push(`"riser" reduced to ${riser.toFixed(2)} so the foundation stays under ${MAX_TOTAL_HEIGHT} m.`);
  }
  return { value: { steps, riser, projection }, errors: [], warnings };
}

const DOOR_MARGIN = 0.25;
const SIDES: WallSide[] = ["north", "south", "east", "west"];

/** The stretches of a side (in metres along it, from `from` to `to`) left after cutting out the ground-floor doors. */
function runsAround(ctx: BuildContext, side: WallSide, from: number, to: number): [number, number][] {
  const cuts = ctx.doors.filter((d) => d.wall === side).sort((a, b) => a.from - b.from);
  const runs: [number, number][] = [];
  let cursor = from;
  for (const d of cuts) {
    if (d.from - DOOR_MARGIN > cursor) runs.push([cursor, d.from - DOOR_MARGIN]);
    cursor = Math.max(cursor, d.to + DOOR_MARGIN);
  }
  if (cursor < to) runs.push([cursor, to]);
  return runs.filter(([a, b]) => b - a > 0.2);
}

/**
 * A stepped masonry foundation ringing the house: tier 0 is the lowest and widest, each tier inward is taller and
 * projects less, so the base climbs to the wall in steps. Tiers break at ground-floor doors.
 */
export function buildFoundation(config: FoundationConfig, ctx: BuildContext, index: number): HousePrimitive[] {
  const { width, depth } = ctx.house;
  const exterior = resolveMaterial(ctx.materials.exterior);
  const out: HousePrimitive[] = [];
  const id = `foundation-${index}`;

  for (let tier = 0; tier < config.steps; tier++) {
    const reach = (config.steps - tier) * config.projection;
    const top = (tier + 1) * config.riser;
    const bottom = -0.25;
    const h = top - bottom;
    const paint = paintOf(exterior, shade(exterior.color, 0.72 + tier * 0.05));

    for (const side of SIDES) {
      const alongX = side === "north" || side === "south";
      const length = alongX ? width : depth;
      // North and south tiers run past the corners so the ring closes without gaps.
      const ext = alongX ? reach : 0;
      runsAround(ctx, side, -ext, length + ext).forEach(([from, to], r) => {
        const mid = (from + to) / 2;
        const outward = reach / 2;
        const along = to - from;
        const px = side === "east" ? width / 2 + outward : side === "west" ? -width / 2 - outward : -width / 2 + mid;
        const pz = side === "north" ? -depth / 2 - outward : side === "south" ? depth / 2 + outward : -depth / 2 + mid;
        out.push(
          box(
            `${id}-tier-${tier}-${side}-${r}`,
            "foundation",
            `Foundation Step ${tier + 1} (${side})`,
            [px, bottom + h / 2, pz],
            alongX ? [along, h, reach] : [reach, h, along],
            paint
          )
        );
      });
    }
  }
  return out;
}
