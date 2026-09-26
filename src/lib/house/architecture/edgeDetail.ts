import type { BoxPrimitive, HousePrimitive, PrimitiveCategory } from "../types";

/**
 * Rounded exposed edges. Builders describe sharp boxes; this pass gives the ones that read as trim, masonry and
 * framing a small radius, so light catches their edges. Big flat surfaces (wall faces, floors, paving) stay sharp,
 * and so does glass. The radius is capped by each box's thinnest dimension so slender parts are never swallowed.
 */
const BEVELLED_CATEGORIES = new Set<PrimitiveCategory>(["porch", "balcony", "chimney", "foundation", "stairs", "arch", "deck", "garage", "window", "door"]);
const BEVELLED_LABEL = /trim|cornice|pillar|quoin|belt|plinth|fieldstone|column|fascia|beam|frame|sill|lintel|coping|cap\b|post|pier|buttress|threshold|drip|crown|soffit|roof slab|parapet|shutter/i;
const MIN_THICKNESS = 0.04;
const MAX_FRACTION = 0.3;

/** Radius the viewport gives every trim-like box even when a design's tier asks for none (crisp, not razor-sharp). */
export const RENDER_BASE_BEVEL = 0.022;

export function applyEdgeDetail(primitives: HousePrimitive[], bevel: number): HousePrimitive[] {
  if (bevel <= 0) return primitives;
  return primitives.map((p) => {
    if (p.kind !== "box" || p.bevel !== undefined || p.transparent || p.id.endsWith("-water")) return p;
    if (!BEVELLED_CATEGORIES.has(p.category) && !BEVELLED_LABEL.test(p.label)) return p;
    const thinnest = Math.min(...p.size);
    if (thinnest < MIN_THICKNESS) return p;
    const radius = Math.min(bevel, thinnest * MAX_FRACTION);
    return { ...(p as BoxPrimitive), bevel: Math.round(radius * 1000) / 1000 };
  });
}
