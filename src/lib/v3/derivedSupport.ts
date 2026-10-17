import type { V3Scene, V3SceneObject } from "./scene";
import type { V3SupportRef } from "./siteHierarchy";
import { v3ObjectNeedsSupport } from "./siteHierarchy";
import { materializeV3ArchitecturalScene } from "./architecture";
import { resolveObviousV3Support, v3HasDeterministicSupportPolicy } from "./supportGraph";
import { v3SupportCapability } from "./capabilities";
import { V3_GRADING_SUPPORT } from "./grading";

const dims = (o: V3SceneObject) => o.architecture ? [o.architecture.width, o.architecture.height, o.architecture.depth] : o.dimensions.map((v, i) => v * o.transform.scale[i]);
const baseOf = (o: V3SceneObject) => o.architecture ? o.architecture.baseElevation : o.transform.position[1] - dims(o)[1] / 2;
const shift = (o: V3SceneObject, dy: number) => {
  if (Math.abs(dy) < 1e-9) return;
  if (o.architecture) o.architecture = { ...o.architecture, baseElevation: o.architecture.baseElevation + dy };
  o.transform = { ...o.transform, position: [o.transform.position[0], o.transform.position[1] + dy, o.transform.position[2]] };
};
const centreIn = (o: V3SceneObject, host: V3SceneObject) => {
  const [w, , d] = dims(host), a = host.transform.rotation[1], c = Math.cos(a), s = Math.sin(a), dx = o.transform.position[0] - host.transform.position[0], dz = o.transform.position[2] - host.transform.position[2];
  return Math.abs(dx * c - dz * s) <= w / 2 && Math.abs(dx * s + dz * c) <= d / 2;
};

/**
 * Terrace dependants (derived, never persisted). A terrace surface explicitly on a graded level rests on that
 * level; a pool inside it is embedded with its rim flush with the deck; objects resting on a moved surface follow.
 * Building masses are never moved.
 */
function deriveSiteDatums(scene: V3Scene, derived: Map<string, V3DerivedSupport>) {
  const levels = new Map((scene.siteHierarchy?.levels ?? []).map((level) => [level.id, level]));
  const moved = new Map<string, number>();
  const decks = scene.objects.filter((o) => {
    const level = o.support?.levelId ? levels.get(o.support.levelId) : undefined, capability = v3SupportCapability(o.type);
    return !!level && V3_GRADING_SUPPORT.has(level.supportType) && capability.surfaceKind === "terrace" && capability.groundPad && !o.support?.hostId && !o.support?.objectId && !o.support?.grounding;
  });
  for (const deck of decks) { const dy = levels.get(deck.support!.levelId!)!.elevation - baseOf(deck); shift(deck, dy); moved.set(deck.id, dy); }
  for (const pool of scene.objects.filter((o) => o.type === "pool" && !o.support)) {
    // Deterministic, order-independent: the smallest containing deck, then id.
    const deck = decks.filter((candidate) => centreIn(pool, candidate)).sort((a, b) => dims(a)[0] * dims(a)[2] - dims(b)[0] * dims(b)[2] || a.id.localeCompare(b.id))[0];
    const level = deck ? levels.get(deck.support!.levelId!)! : [...levels.values()].filter((l) => V3_GRADING_SUPPORT.has(l.supportType) && Math.abs(pool.transform.position[0] - l.region.x) <= l.region.width / 2 && Math.abs(pool.transform.position[2] - l.region.z) <= l.region.depth / 2).sort((a, b) => b.elevation - a.elevation)[0];
    if (!level) continue;
    const rim = deck ? baseOf(deck) + dims(deck)[1] : level.elevation, top = baseOf(pool) + dims(pool)[1];
    if (Math.abs(rim - top) > 1.5 + Math.abs(deck ? moved.get(deck.id) ?? 0 : 0)) continue;
    shift(pool, rim - top); moved.set(pool.id, rim - top);
    pool.support = { kind: level.supportType, levelId: level.id, grounding: "embedded", ...(deck ? { hostId: deck.id, relationship: "embedded-in" as const } : {}) };
    derived.set(pool.id, { objectId: pool.id, support: pool.support, confidence: 100 });
  }
  // Supported site elements follow their moved host (one hop per pass; buildings excluded).
  for (let pass = 0; pass < 4; pass++) for (const o of scene.objects) {
    const host = o.support?.hostId ?? o.support?.objectId;
    if (!host || !moved.has(host) || moved.has(o.id) || o.type === "building-mass" || (o.support?.relationship && o.support.relationship !== "rests-on")) continue;
    shift(o, moved.get(host)!); moved.set(o.id, moved.get(host)!);
  }
}

/**
 * Support authority.
 *
 *   authored `object.support`  → persisted intent (Terra/user), including suspended/cantilevered/embedded.
 *   inferred terrain/slab/host → derived here on demand, never written back to the persisted scene.
 *
 * Compile and audit consume the *effective* scene: authored support where present, deterministic inference
 * everywhere else. (Physically incompatible provider hints are removed at ingestion by repair, before they
 * are ever persisted; derivation itself never overrides authored support.) Because nothing derived is stored, moving nearby geometry simply
 * produces a different derivation next time instead of leaving a stale persisted guess behind.
 */
export interface V3DerivedSupport { objectId: string; support: V3SupportRef; confidence: number; }
export interface V3EffectiveSupportScene { scene: V3Scene; derived: ReadonlyMap<string, V3DerivedSupport>; }

/** Marks a scene whose support is already effective, so nested terrain/support sampling never re-derives. */
const EFFECTIVE = Symbol("v3-effective-support");
type Marked = V3Scene & { [EFFECTIVE]?: V3EffectiveSupportScene };
const cache = new WeakMap<V3Scene, { key: string; result: V3EffectiveSupportScene }>();

export const isV3EffectiveSupportScene = (scene: V3Scene) => !!(scene as Marked)[EFFECTIVE];

const needsDerivedSupport = (object: V3SceneObject) => !object.support && object.type !== "stair" && object.type !== "ramp"
  && (v3ObjectNeedsSupport(object) || (!!object.architecture && v3HasDeterministicSupportPolicy(object)));

function derive(input: V3Scene): V3EffectiveSupportScene {
  // A private working copy: inference is sequential (later objects may rest on earlier derived support),
  // exactly as the former persisted repair pass behaved, but the caller's scene is never touched.
  const scene = { ...input, objects: input.objects.map((object) => ({ ...object })) } as Marked;
  const derived = new Map<string, V3DerivedSupport>();
  const result: V3EffectiveSupportScene = { scene, derived };
  Object.defineProperty(scene, EFFECTIVE, { value: result, enumerable: false });
  const levels = scene.siteHierarchy?.levels ?? [];
  deriveSiteDatums(scene, derived);
  for (const object of scene.objects) {
    if (!object || !needsDerivedSupport(object)) continue;
    try {
      const resolved = resolveObviousV3Support(object, scene, levels), found = resolved.support;
      if (!found) continue;
      const hostObjectId = found.objectId ?? found.hostId, edge = object.type === "railing" || object.type === "fence";
      object.support = hostObjectId
        ? { kind: found.kind, hostId: hostObjectId, relationship: found.relationship ?? (edge ? "edge-hosted" : "rests-on"), ...(found.levelId ? { levelId: found.levelId } : {}) }
        : { kind: found.kind, ...(found.levelId ? { levelId: found.levelId } : {}) };
      derived.set(object.id, { objectId: object.id, support: object.support, confidence: resolved.confidence });
    } catch {
      // Inference is best-effort; the audit reports whatever stays unresolved.
    }
  }
  return result;
}

/**
 * The scene compile/audit should reason about. Idempotent and pure; memoized per scene object and
 * invalidated by content, so in-place mutation (tests, editors) can never serve a stale derivation.
 */
export function resolveV3EffectiveSupport(scene: V3Scene): V3EffectiveSupportScene {
  const marked = (scene as Marked)[EFFECTIVE];
  if (marked) return marked;
  if (!scene || !Array.isArray(scene.objects)) return { scene, derived: new Map() };
  const key = JSON.stringify([scene.site, scene.siteHierarchy, scene.objects]);
  const hit = cache.get(scene);
  if (hit?.key === key) return hit.result;
  const result = derive(scene);
  cache.set(scene, { key, result });
  return result;
}

export const withV3EffectiveSupport = (scene: V3Scene): V3Scene => resolveV3EffectiveSupport(scene).scene;

/**
 * Entry point for compile/audit/terrain: canonical runtime geometry plus effective support. A scene that is
 * already effective (including the private working copy during derivation) is only materialized, so nested
 * terrain sampling can never recurse into another derivation.
 */
export function effectiveV3Scene(scene: V3Scene): V3Scene {
  return isV3EffectiveSupportScene(scene) ? materializeV3ArchitecturalScene(scene) : withV3EffectiveSupport(materializeV3ArchitecturalScene(scene));
}
