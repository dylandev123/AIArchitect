import { FEATURE_JSON_KEY, FEATURE_TYPES, type FeatureType } from "@/lib/house/features/featureTypes";
import { ensureStableIds } from "@/lib/house/stableIds";
import type { EditScope, TargetFilter, TargetIds } from "./targeting";
import { mentionedRoomTypes } from "./targeting";
import { resolveRoomTargets, type RoomGuard, type RoomTargets } from "./roomScope";

type Item = Record<string, unknown>;

/** How dependency items of another feature type relate to the targets being edited. */
type Relation = "wall" | "near" | "mentionedRooms";
interface Dependency {
  type: FeatureType;
  rel: Relation;
}

/**
 * Read-only neighbours a model needs to edit a feature without colliding with something
 * (same-wall openings, nearby site objects) — nothing broader than that.
 */
const DEPENDENCIES: Record<FeatureType, Dependency[]> = {
  window: [{ type: "door", rel: "wall" }, { type: "balcony", rel: "wall" }, { type: "room", rel: "mentionedRooms" }],
  door: [{ type: "window", rel: "wall" }, { type: "garage", rel: "wall" }, { type: "room", rel: "mentionedRooms" }],
  garage: [{ type: "driveway", rel: "wall" }, { type: "door", rel: "wall" }, { type: "window", rel: "wall" }],
  balcony: [{ type: "window", rel: "wall" }, { type: "door", rel: "wall" }, { type: "room", rel: "mentionedRooms" }],
  patio: [{ type: "pool", rel: "wall" }, { type: "driveway", rel: "wall" }, { type: "door", rel: "wall" }],
  pool: [{ type: "patio", rel: "wall" }, { type: "deck", rel: "near" }],
  driveway: [{ type: "garage", rel: "wall" }, { type: "patio", rel: "wall" }, { type: "parking", rel: "near" }],
  room: [],
  building: [{ type: "building", rel: "near" }, { type: "road", rel: "near" }, { type: "parking", rel: "near" }, { type: "landscape", rel: "near" }, { type: "pool", rel: "near" }],
  road: [{ type: "building", rel: "near" }, { type: "road", rel: "near" }, { type: "parking", rel: "near" }],
  parking: [{ type: "road", rel: "near" }, { type: "building", rel: "near" }],
  landscape: [{ type: "building", rel: "near" }, { type: "pool", rel: "near" }],
  deck: [{ type: "building", rel: "near" }, { type: "pool", rel: "near" }, { type: "patio", rel: "wall" }],
  porch: [{ type: "door", rel: "wall" }, { type: "window", rel: "wall" }, { type: "patio", rel: "wall" }, { type: "chimney", rel: "wall" }],
  chimney: [{ type: "porch", rel: "wall" }, { type: "window", rel: "wall" }, { type: "door", rel: "wall" }],
  curvedWall: [{ type: "building", rel: "near" }, { type: "landscape", rel: "near" }, { type: "pool", rel: "near" }],
  arch: [{ type: "window", rel: "wall" }, { type: "door", rel: "wall" }, { type: "porch", rel: "wall" }, { type: "bay", rel: "wall" }],
  bay: [{ type: "window", rel: "wall" }, { type: "door", rel: "wall" }, { type: "arch", rel: "wall" }, { type: "porch", rel: "wall" }],
  foundation: [{ type: "door", rel: "wall" }, { type: "stairs", rel: "wall" }],
  stairs: [{ type: "door", rel: "wall" }, { type: "porch", rel: "wall" }, { type: "foundation", rel: "wall" }],
  dormer: [{ type: "crossGable", rel: "wall" }, { type: "chimney", rel: "wall" }],
  crossGable: [{ type: "dormer", rel: "wall" }, { type: "chimney", rel: "wall" }],
  retainingWall: [{ type: "path", rel: "near" }, { type: "building", rel: "near" }, { type: "slope", rel: "near" }],
  path: [{ type: "door", rel: "wall" }, { type: "road", rel: "near" }, { type: "waterway", rel: "near" }, { type: "landscape", rel: "near" }],
  waterway: [{ type: "path", rel: "near" }, { type: "building", rel: "near" }, { type: "rockCluster", rel: "near" }],
  rockCluster: [{ type: "waterway", rel: "near" }, { type: "path", rel: "near" }],
  slope: [{ type: "retainingWall", rel: "near" }, { type: "building", rel: "near" }, { type: "path", rel: "near" }],
};

const NEAR_RADIUS_M = 30;
const MAX_DEPENDENCIES_PER_TYPE = 20;

/** Types whose look depends on the style reference — layout-only edits skip it. */
const STYLE_FREE_TYPES: readonly FeatureType[] = ["room", "road", "parking"];

export interface ScopedContext {
  /** Project root with stable ids backfilled on every array the scope may edit. */
  root: Record<string, unknown>;
  /** The user-turn text sent to the model (instruction + minimal context). */
  userMessage: string;
  /** Ids the model is allowed to update/remove. */
  targetIds: TargetIds;
  /** Set when the scope's target can't be resolved safely; the request must be rejected without calling the model. */
  blocked?: string;
  /** Room scope only: the geometry every room-scoped op is checked against. */
  roomGuard?: RoomGuard;
}

const json = (value: unknown) => JSON.stringify(value);
const isRecord = (v: unknown): v is Item => typeof v === "object" && v !== null && !Array.isArray(v);

function itemsOf(root: Record<string, unknown>, type: FeatureType): Item[] {
  const arr = root[FEATURE_JSON_KEY[type]];
  return Array.isArray(arr) ? arr.filter(isRecord) : [];
}

function positionOf(item: Item): [number, number] | null {
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const x = num(item.x) ?? num(item.siteX);
  const z = num(item.z) ?? num(item.siteZ);
  if (x !== null && z !== null) return [x, z];
  const [x1, z1, x2, z2] = [num(item.x1), num(item.z1), num(item.x2), num(item.z2)];
  if (x1 !== null && z1 !== null && x2 !== null && z2 !== null) return [(x1 + x2) / 2, (z1 + z2) / 2];
  return null;
}

/** Narrows an array to the items a filter names; falls back to all items when the filter matches none. */
function selectTargets(type: FeatureType, items: Item[], filter?: TargetFilter): Item[] {
  if (!filter) return items;
  if (filter.indices?.length) {
    const picked = filter.indices.map((i) => items[i]).filter(Boolean);
    return picked.length > 0 ? picked : items;
  }
  let out = items;
  if (type === "room" && filter.roomTypes?.length) out = out.filter((i) => filter.roomTypes!.includes(i.type as never));
  if (type === "building" && filter.buildingKinds?.length) out = out.filter((i) => filter.buildingKinds!.includes(i.kind as never));
  if (filter.ordinals?.length) out = filter.ordinals.map((n) => out[n]).filter(Boolean);
  if (filter.walls?.length) out = out.filter((i) => typeof i.wall !== "string" || filter.walls!.includes(i.wall as never));
  return out.length > 0 ? out : items;
}

function selectDependencies(
  dep: Dependency,
  candidates: Item[],
  targets: Item[],
  prompt: string
): Item[] {
  let picked: Item[];
  if (dep.rel === "wall") {
    const walls = new Set(targets.map((t) => t.wall).filter((w): w is string => typeof w === "string"));
    picked = walls.size > 0 ? candidates.filter((c) => typeof c.wall === "string" && walls.has(c.wall)) : candidates;
  } else if (dep.rel === "mentionedRooms") {
    const types = mentionedRoomTypes(prompt);
    picked = types.length > 0 ? candidates.filter((c) => types.includes(c.type as never)) : [];
  } else {
    const anchors = targets.map(positionOf).filter((p): p is [number, number] => p !== null);
    const dist = (c: Item) => {
      const p = positionOf(c);
      return p && anchors.length > 0 ? Math.min(...anchors.map(([x, z]) => Math.hypot(p[0] - x, p[1] - z))) : Infinity;
    };
    picked = candidates
      .map((c) => [c, dist(c)] as const)
      .filter(([, d]) => d <= NEAR_RADIUS_M)
      .sort((a, b) => a[1] - b[1])
      .map(([c]) => c);
  }
  return picked.slice(0, MAX_DEPENDENCIES_PER_TYPE);
}

/** Feature types whose placement depends on the view/approach sides, so they see `site` read-only. */
const SITE_AWARE_TYPES: FeatureType[] = ["patio", "pool", "deck", "balcony", "driveway", "garage", "door", "parking", "road", "landscape", "building", "path", "waterway", "rockCluster", "slope", "retainingWall", "curvedWall", "stairs"];

/**
 * Builds the smallest model-visible view of the project that can support the scoped edit:
 * the target objects, their direct read-only dependencies, and a compact style reference.
 * World scope is the one exception and receives the full JSON.
 */
export function buildScopeContext(root: Record<string, unknown>, scope: EditScope, prompt: string): ScopedContext {
  const isWorld = scope.level === "world";
  const prepared = ensureStableIds(root, scope.featureTypes);

  let room: RoomTargets | undefined;
  if (scope.kind === "room") {
    const resolved = resolveRoomTargets(prepared, scope, prompt);
    if ("error" in resolved) return { root: prepared, targetIds: {}, userMessage: "", blocked: resolved.error };
    room = resolved;
  }

  // Select each editable array's targets once; both the model view and the id allow-list derive from it.
  const picks: Partial<Record<FeatureType, Item[]>> = {};
  const targetIds: TargetIds = {};
  for (const type of scope.featureTypes) {
    const all = itemsOf(prepared, type);
    picks[type] = isWorld ? all : (room?.picks[type] ?? selectTargets(type, all, scope.filter));
    targetIds[type] = new Set(picks[type]!.map((i) => String(i.id)));
  }

  if (isWorld) {
    return {
      root: prepared,
      targetIds,
      userMessage: `Current project JSON:\n${json(prepared)}\n\nInstruction: ${prompt}`,
    };
  }

  // ── editable targets ──
  const targets: Record<string, unknown> = {};
  const shown: string[] = [];
  for (const type of scope.featureTypes) {
    const all = itemsOf(prepared, type);
    const picked = picks[type]!;
    targets[FEATURE_JSON_KEY[type]] = picked;
    if (picked.length < all.length) shown.push(`${FEATURE_JSON_KEY[type]} ${picked.length}/${all.length}`);
  }
  if (scope.houseFields.length > 0 && isRecord(prepared.house)) targets.house = prepared.house;
  if (scope.materialZones.length > 0 && isRecord(prepared.materials)) {
    targets.materials = Object.fromEntries(scope.materialZones.map((z) => [z, (prepared.materials as Item)[z]]));
  }
  if (scope.exterior) targets.exteriorOptions = prepared.exteriorOptions ?? {};
  if (scope.site) targets.site = prepared.site ?? {};

  // ── read-only dependencies ──
  const context: Record<string, unknown> = {};
  if (scope.houseFields.length === 0 && isRecord(prepared.house)) context.house = prepared.house;
  for (const type of scope.featureTypes) {
    for (const dep of DEPENDENCIES[type]) {
      const key = FEATURE_JSON_KEY[dep.type];
      if (scope.featureTypes.includes(dep.type) || context[key]) continue;
      const picked = selectDependencies(dep, itemsOf(prepared, dep.type), picks[type]!, prompt);
      if (picked.length > 0) context[key] = picked;
    }
  }

  // ── compact style reference (read-only parts only) ──
  const style: Record<string, unknown> = {};
  if (!scope.site && isRecord(prepared.site) && scope.featureTypes.some((t) => SITE_AWARE_TYPES.includes(t))) style.site = prepared.site;
  const needsStyle = scope.featureTypes.some((t) => !STYLE_FREE_TYPES.includes(t)) || scope.houseFields.length > 0;
  if (needsStyle) {
    if (scope.materialZones.length === 0 && isRecord(prepared.materials)) style.materials = prepared.materials;
    if (!scope.exterior && isRecord(prepared.exteriorOptions)) style.exteriorOptions = prepared.exteriorOptions;
  }

  const untouched = FEATURE_TYPES.filter(
    (t) => !scope.featureTypes.includes(t) && !context[FEATURE_JSON_KEY[t]] && itemsOf(prepared, t).length > 0
  ).map((t) => `${FEATURE_JSON_KEY[t]}×${itemsOf(prepared, t).length}`);

  const parts = [
    `Instruction: ${prompt}`,
    `EDITABLE TARGETS — address existing items only by their "id":\n${json(targets)}`,
    room ? `ROOM GEOMETRY — openings must sit within these wall-offset ranges, on the room's own level:\n${room.geometry}` : "",
    shown.length > 0 ? `(Showing a subset of larger arrays: ${shown.join(", ")}. Other items exist but are not editable this turn.)` : "",
    Object.keys(context).length > 0 ? `READ-ONLY CONTEXT — never edit or reference by id:\n${json(context)}` : "",
    Object.keys(style).length > 0 ? `STYLE REFERENCE (read-only):\n${json(style)}` : "",
    untouched.length > 0 ? `Not shown, unchanged: ${untouched.join(", ")}.` : "",
  ];
  return { root: prepared, targetIds, roomGuard: room?.guard, userMessage: parts.filter(Boolean).join("\n\n") };
}
