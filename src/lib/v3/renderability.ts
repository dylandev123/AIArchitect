import type { V3GeometryKind, V3SceneObject } from "./scene";
import { isKnownV3CompilerType, v3Capability } from "./capabilities";

/**
 * The one authority for deciding how authored V3 intent reaches the renderer.
 * `type` is retained as a legacy/specialist hint; semanticRole is never an
 * enum and is intentionally the durable authoring vocabulary.
 */
export type V3RenderStrategy = "specialized" | "generic" | "proxy";
export interface V3RenderResolution {
  strategy: V3RenderStrategy;
  geometryKind: V3GeometryKind;
  specializedType?: string;
  warning?: "FALLBACK_RENDER_USED" | "ASSET_NOT_FOUND";
}

/** Known types come from the capability registry; anything else is still renderable via fallback. */
export { isKnownV3CompilerType } from "./capabilities";
const specializedTypeOf = (object: V3SceneObject): string | undefined => {
  const capability = v3Capability(object.type);
  return capability?.renderability === "specialized" && (capability.specializedWhen?.(object) ?? true) ? object.type : undefined;
};
export const V3_GEOMETRY_KINDS = new Set<V3GeometryKind>(["box", "slab", "plane", "cylinder", "path", "extrusion", "water", "proxy"]);

type RenderableHint = Partial<Pick<V3SceneObject, "type" | "semanticRole" | "label" | "geometryKind" | "dimensions" | "transform" | "material" | "collision" | "source">> & Record<string, unknown>;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const validDimensions = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((item) => finite(item) && item > 0);
const validTransform = (value: unknown) => !!value && typeof value === "object" && ["position", "rotation", "scale"].every((key) => {
  const vector = (value as Record<string, unknown>)[key];
  return Array.isArray(vector) && vector.length === 3 && vector.every(finite) && (key !== "scale" || vector.every((item) => item > 0));
});
const hasPolyline = (object: RenderableHint) => [object.path, object.route, object.points, object.polyline].some((value) => Array.isArray(value) && value.length >= 2);

/**
 * Conservative structural inference shared by ingestion, preview recovery and
 * renderer dispatch. Semantic words are merely hints; dimensions are enough
 * to make an unfamiliar object visible.
 */
export function inferV3GeometryKind(object: RenderableHint): V3GeometryKind {
  if (typeof object.geometryKind === "string" && V3_GEOMETRY_KINDS.has(object.geometryKind as V3GeometryKind)) return object.geometryKind as V3GeometryKind;
  const words = [object.type, object.semanticRole, object.label].filter((value): value is string => typeof value === "string").join(" ").toLowerCase();
  const surface = object.material && typeof object.material === "object" ? (object.material as { surface?: unknown }).surface : undefined;
  const hinted = v3Capability(object.type)?.geometryHint;
  if (hinted) return hinted;
  if (hasPolyline(object) || /(?:^|[-\s])(path|route|walkway|driveway|trail)(?:$|[-\s])/.test(words)) return "path";
  if (/(?:^|[-\s])(terrace|slab|pad|platform|deck|patio|court)(?:$|[-\s])/.test(words)) return "slab";
  if (/(?:^|[-\s])(wall|retaining|barrier|screen)(?:$|[-\s])/.test(words)) return "box";
  if (/(?:^|[-\s])(tree|palm|vegetation|plant|shrub|foliage|furniture|sculpture)(?:$|[-\s])/.test(words)) return "proxy";
  if (surface === "water" || object.collision === "water" || /(?:^|[-\s])(water|pool|pond|basin|spa)(?:$|[-\s])/.test(words)) return "water";
  if (/(?:^|[-\s])(column|post|pole|trunk|cylinder)(?:$|[-\s])/.test(words)) return "cylinder";
  if (!validDimensions(object.dimensions)) return "proxy";
  const [width, height, depth] = object.dimensions;
  const horizontal = Math.max(width, depth), horizontalThickness = Math.min(width, depth);
  // A broad, thin horizontal form is safely represented by a slab. Thin
  // vertical forms remain boxes, which is the generic wall fallback.
  if (height <= Math.max(.35, horizontalThickness * .25) && horizontal >= height * 2) return "slab";
  return "box";
}

/**
 * Stable capability order: specialized compiler, explicit generic geometry,
 * inferred generic geometry, available asset intent, visible proxy.
 *
 * V3 does not yet mount GLB/native objects directly, so an asset reference is
 * represented by the final proxy tier and reported as ASSET_NOT_FOUND. It is
 * still never omitted.
 */
export function resolveV3Renderable(object: V3SceneObject): V3RenderResolution {
  const specializedType = specializedTypeOf(object);
  const explicitGeometry = typeof object.geometryKind === "string" && V3_GEOMETRY_KINDS.has(object.geometryKind as V3GeometryKind) ? object.geometryKind as V3GeometryKind : undefined;
  const inferredGeometry = inferV3GeometryKind(object as unknown as RenderableHint);
  if (specializedType) return { strategy: "specialized", specializedType, geometryKind: explicitGeometry ?? inferredGeometry };
  if (explicitGeometry === "proxy") return { strategy: "proxy", geometryKind: "proxy", warning: object.source?.assetId ? "ASSET_NOT_FOUND" : "FALLBACK_RENDER_USED" };
  if (explicitGeometry) return { strategy: "generic", geometryKind: explicitGeometry, ...(!isKnownV3CompilerType(object.type) ? { warning: "FALLBACK_RENDER_USED" as const } : {}) };
  if (inferredGeometry !== "proxy" && validTransform(object.transform) && validDimensions(object.dimensions)) return { strategy: "generic", geometryKind: inferredGeometry, warning: "FALLBACK_RENDER_USED" };
  // No V3 runtime asset loader exists yet. Preserve the reference but render a
  // selectable proxy until the asset can be resolved.
  if (object.source?.assetId) return { strategy: "proxy", geometryKind: "proxy", warning: "ASSET_NOT_FOUND" };
  return { strategy: "proxy", geometryKind: "proxy", warning: "FALLBACK_RENDER_USED" };
}

export function v3RenderWarnings(objects: readonly V3SceneObject[]) {
  return objects.flatMap((object) => {
    const resolution = resolveV3Renderable(object);
    return resolution.warning ? [{ code: resolution.warning, targetId: object.id, message: `${object.label} renders as ${resolution.strategy} ${resolution.geometryKind} geometry.` }] : [];
  });
}
