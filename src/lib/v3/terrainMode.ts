import type { V3Scene } from "./scene";
import type { V3GenerationNote } from "./generation";
import { getObjectBaseY, getObjectTopY } from "./elevation";
import { resolveV3EffectiveSupport } from "./derivedSupport";

export type V3TerrainMode = "flat" | "advanced";

/** Generation-only policy. Never called by scene loading, editing, persistence or compilation. */
export function normalizeV3FlatSite(scene: V3Scene, notes: V3GenerationNote[]): void {
  if (!scene?.site) return;
  const { width, depth, groundMaterial } = scene.site;
  const site = { width, depth, ...(groundMaterial ? { groundMaterial } : {}), baseElevation: 0, naturalGround: { elevation: 0, grade: 0 } };
  if (JSON.stringify(scene.site) !== JSON.stringify(site)) notes.push({ code: "FLAT_SITE_NORMALIZED", targetId: "site", message: "New flat-land generation uses natural ground at elevation 0, without slope, cliff or sea." });
  scene.site = site;
}

/** Reject incompatible terrain intent for the existing bounded repair, never flatten architecture. */
export function v3FlatSiteErrors(scene: V3Scene): string[] {
  const errors: string[] = [];
  const fail = (id: string, reason: string) => errors.push(`Flat land: ${id} ${reason}`);
  for (const level of scene.siteHierarchy?.levels ?? []) {
    if (Math.abs(level.elevation) > 1e-6) fail(level.id, "must not define elevated site levels; express upper floors with architectural objects and hosts instead.");
  }
  for (const connection of scene.siteHierarchy?.connections ?? []) {
    if (connection.route.some(point => point.length === 3 && Math.abs(point[1]) > 1e-6)) fail(connection.id, "must use ground-level routes at Y=0; architectural stairs belong to building objects.");
  }
  for (const transition of scene.siteHierarchy?.transitions ?? []) {
    if (["natural-slope", "graded-slope", "retaining-edge"].includes(transition.type)) fail(transition.id, "requires advanced terrain.");
  }
  const effective = resolveV3EffectiveSupport(scene).scene;
  for (const object of scene.objects) {
    if (object.terrain || object.type === "terrain-region" || object.type === "retaining-wall") fail(object.id, "requires advanced terrain; omit terrain modifiers and retaining systems.");
    // Upper masses and explicit cantilever/suspension retain their elevations. Only unsupported
    // ground-level building foundations are rejected, not moved or silently discarded.
    const support = effective.objects.find(candidate => candidate.id === object.id)?.support;
    const hosted = object.hostId || support?.hostId || support?.objectId;
    const intentional = support?.grounding && ["floating", "suspended", "cantilevered"].includes(support.grounding);
    if (hosted || intentional) continue;
    if (["building-mass", "volume"].includes(object.type) && Math.abs(getObjectBaseY(object)) > .5) fail(object.id, "needs a ground-level foundation within 0.5 m of Y=0 or an architectural host/explicit elevated support; preserve storeys and upper terraces.");
    if (["pool", "pool-deck", "terrace", "courtyard", "landscape-zone", "driveway", "path"].includes(object.type)) {
      const datum = object.type === "pool" ? getObjectTopY(object) : getObjectBaseY(object);
      if (Math.abs(datum) > .5) fail(object.id, "needs a ground-level site datum within 0.5 m of Y=0 or an architectural host for an intentional upper-floor amenity.");
      if (["driveway", "path"].includes(object.type) && (Math.abs(object.transform.rotation[0]) > 1e-6 || Math.abs(object.transform.rotation[2]) > 1e-6)) fail(object.id, "must not slope on flat land.");
    }
  }
  return errors;
}
