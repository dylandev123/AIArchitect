import type { CuratedAsset } from "@/types/assets";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { placementBounds } from "@/lib/outdoor/placements";
import { v2SiteFrame } from "./siteFrame";
import { v2SitePlanOf, placeOutdoorBar } from "./v2SiteFeatures";
import { classifyAdditiveRequest, originForCentre, placeStandaloneObject, type LocalBounds, type StandaloneObject, type StandalonePlacementResult } from "./v2AdditiveObjects";

export type AdditiveObject = "chair" | "lounger" | "table" | "umbrella" | "planter" | "bar";
export type PlacementFailureCode = "UNSUPPORTED_OBJECT" | "NO_VALID_SITE_PLAN" | "NO_APPROVED_ASSET" | "ALL_CANDIDATES_COLLIDE" | "ARCHITECTURAL_EDIT" | "NOT_ADDITIVE" | Extract<StandalonePlacementResult, { ok: false }>["code"];
export type AdditivePlacementResult =
  | { ok: true; object: AdditiveObject; json: string; summary: string; assetId: string; usedProceduralFallback: boolean }
  | Extract<StandalonePlacementResult, { ok: true }>
  | { ok: false; code: PlacementFailureCode; error: string };
export type { StandaloneObject };

const SPEC: Record<Exclude<AdditiveObject, "bar">, { role: string; terms: string[]; width: number; depth: number; height: number }> = {
  chair: { role: "lounge-armchair", terms: ["chair", "armchair", "lounge"], width: .9, depth: .9, height: .8 },
  lounger: { role: "sun-lounger", terms: ["lounger", "sun lounger", "chaise"], width: .8, depth: 2.0, height: .5 },
  table: { role: "side-table", terms: ["table", "side table", "coffee table"], width: .7, depth: .7, height: .55 },
  umbrella: { role: "parasol", terms: ["umbrella", "parasol"], width: 2.5, depth: 2.5, height: 2.5 },
  planter: { role: "planter", terms: ["planter", "plant pot", "pot"], width: .9, depth: .9, height: .9 },
};

/** Deliberately non-catalog ids: the viewport recognizes these as cheap built-in stand-ins, never as GLBs. */
export const proceduralV2AssetId = (object: AdditiveObject) => `procedural-v2-${object}`;

function requestedObject(prompt: string): AdditiveObject | undefined {
  const p = prompt.toLowerCase();
  if (/outdoor[\s-]*bar|\bbar\b/.test(p)) return "bar";
  return (Object.keys(SPEC) as Exclude<AdditiveObject, "bar">[]).find((key) => SPEC[key].terms.some((term) => p.includes(term)));
}
function quantity(prompt: string): number {
  const word: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  const match = prompt.toLowerCase().match(/\b(\d+|one|two|three|four|five|six)\b/);
  return Math.min(6, Math.max(1, match ? (word[match[1]] ?? Number(match[1])) : 1));
}
function rectOverlap(a: { x: number; z: number; width: number; depth: number }, b: { x: number; z: number; width: number; depth: number }, gap = .35): boolean {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + gap;
}
function assetFor(object: Exclude<AdditiveObject, "bar">, assets: readonly CuratedAsset[], glbIds: readonly string[]): CuratedAsset | undefined {
  const spec = SPEC[object];
  return assets.find((asset) => asset.type === "glb-model" && asset.status === "approved" && glbIds.includes(asset.id) && asset.validation?.passed !== false &&
    [asset.name, ...(asset.tags ?? []), ...(asset.categories ?? []), asset.family ?? ""].join(" ").toLowerCase().split(/\W+/).some((term) => spec.terms.some((wanted) => term === wanted || term.includes(wanted.replace(" ", "")))));
}

function boundsFor(asset: CuratedAsset | undefined, spec: { width: number; depth: number; height: number }): LocalBounds {
  const bounds = asset?.validation?.bounds;
  if (bounds && bounds.min.every(Number.isFinite) && bounds.max.every(Number.isFinite)
    && bounds.max[0] > bounds.min[0] && bounds.max[1] > bounds.min[1] && bounds.max[2] > bounds.min[2]) return bounds;
  // Procedural shapes are authored around x/z zero and rest on their local y=0 plane.
  return { min: [-spec.width / 2, 0, -spec.depth / 2], max: [spec.width / 2, spec.height, spec.depth / 2] };
}
function dimensionsFor(bounds: LocalBounds) {
  return { width: bounds.max[0] - bounds.min[0], depth: bounds.max[2] - bounds.min[2], height: bounds.max[1] - bounds.min[1] };
}

/**
 * Deterministic executor for a small semantic additive request. It deliberately never edits the V2
 * architecture document or existing Site Plan geometry; only a new loose asset placement is appended.
 */
export function placeV2AdditiveAsset(root: Record<string, unknown>, prompt: string, assets: readonly CuratedAsset[], glbIds: readonly string[]): AdditivePlacementResult {
  // Architectural changes and change/remove requests are refused before any noun is matched: they are never
  // disguised as an object. Standalone objects outside the original whitelist take the GLB-or-proxy path.
  const request = classifyAdditiveRequest(prompt);
  if (request.kind === "architectural") return { ok: false, code: "ARCHITECTURAL_EDIT", error: request.reason };
  if (request.kind === "non-additive") return { ok: false, code: "NOT_ADDITIVE", error: request.reason };
  if (request.kind === "standalone") return placeStandaloneObject(root, prompt, request.object, assets, glbIds);
  const object = requestedObject(prompt);
  if (!object) return { ok: false, code: "UNSUPPORTED_OBJECT", error: "This V2 additive edit supports chairs, loungers, tables, umbrellas, planters, outdoor bars, gazebos, pergolas, cabanas, shade structures, outdoor kitchens, fire pits, benches, and sculptures." };
  const plan = v2SitePlanOf(root);
  if (!plan) return { ok: false, code: "NO_VALID_SITE_PLAN", error: "This V2 project has no valid Site Plan, so I cannot safely anchor the requested object." };
  if (object === "bar") {
    const asset = assets.find((a) => a.type === "glb-model" && a.status === "approved" && glbIds.includes(a.id) && a.validation?.passed !== false && (a.family === "outdoor-bar" || /outdoor[\s-]*bar/i.test(a.name)));
    const placed = placeOutdoorBar(root, asset?.id);
    if ("error" in placed) return { ok: false, code: "ALL_CANDIDATES_COLLIDE", error: placed.error };
    return { ok: true, object, assetId: asset?.id ?? proceduralV2AssetId(object), usedProceduralFallback: !asset, summary: "Added a grounded outdoor bar beside the existing outdoor-living area.", json: JSON.stringify({ ...root, sitePlan: placed.plan }) };
  }
  const asset = assetFor(object, assets, glbIds);
  const spec = SPEC[object], count = quantity(prompt);
  // An approved, validated GLB always wins. Its absence is intentionally not a placement failure: the
  // procedural marker below is rendered as a small, recognizable local primitive set.
  // Bounds are validator-authored model-space geometry, including a bad/off-centre pivot. They are
  // the sole source for collision, grounding and the persisted transform — never a renderer-only fixup.
  const localBounds = boundsFor(asset, spec);
  const dimensions = dimensionsFor(localBounds);
  const pool = { x: plan.poolDeck.x, z: plan.poolDeck.z };
  const existing = Array.isArray(root.outdoorAssetPlacements) ? root.outdoorAssetPlacements as OutdoorAssetPlacement[] : [];
  const obstacles = [
    ...(v2SiteFrame(root)?.masses ?? []).map((m) => ({ x: m.cx, z: m.cz, width: m.width, depth: m.depth })),
    { x: plan.poolDeck.x, z: plan.poolDeck.z, width: plan.poolDeck.width, depth: plan.poolDeck.depth },
    ...(plan.features ?? []).map((f) => ({ x: f.x, z: f.z, width: f.width, depth: f.depth })),
    ...existing.map((p) => { const b = placementBounds(p); return { x: b.x, z: b.z, width: b.w, depth: b.d }; }),
  ];
  const offset = Math.max(dimensions.width, dimensions.depth) / 2 + 1;
  const anchors = [
    { x: pool.x + plan.poolDeck.width / 2 + offset, z: pool.z }, { x: pool.x - plan.poolDeck.width / 2 - offset, z: pool.z },
    { x: pool.x, z: pool.z + plan.poolDeck.depth / 2 + offset }, { x: pool.x, z: pool.z - plan.poolDeck.depth / 2 - offset },
  ];
  const additions: OutdoorAssetPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const candidate = anchors.map((a, n) => ({ x: a.x + (i ? ((i + 1) * (dimensions.width + .5)) * (n < 2 ? 0 : 1) : 0), z: a.z + (i ? ((i + 1) * (dimensions.depth + .5)) * (n < 2 ? 1 : 0) : 0) }))
      .find((p) => ![...obstacles, ...additions.map((q) => { const b = placementBounds(q); return { x: b.x, z: b.z, width: b.w, depth: b.d }; })].some((o) => rectOverlap({ ...p, width: dimensions.width, depth: dimensions.depth }, o)));
    if (!candidate) return { ok: false, code: "ALL_CANDIDATES_COLLIDE", error: `No chair-sized clear, grounded position remains beside the pool deck after checking building masses, paths/features, and existing outdoor assets.` };
    // Face the pool (or view-side pool deck) rather than use a fixed world rotation.
    const yaw = Math.atan2(pool.x - candidate.x, pool.z - candidate.z);
    const scale = 1;
    // These candidates deliberately sit outside the authored pool deck, therefore their support is
    // the site grade. Future deck/terrace anchors use the same explicit support contract.
    const support = { kind: "terrain" as const, elevation: 0 };
    additions.push({ id: `outdoor-v2-${crypto.randomUUID()}`, assetId: asset?.id ?? proceduralV2AssetId(object), parentSpaceId: "v2-poolside", category: asset?.family ?? (object === "planter" ? "decorative" : "furniture"), position: originForCentre(candidate, localBounds, scale, yaw, support.elevation), rotation: [0, yaw, 0], scale, role: spec.role, relationship: { type: "around", targetId: "pool" }, dimensions, localBounds, support });
  }
  return { ok: true, object, assetId: asset?.id ?? proceduralV2AssetId(object), usedProceduralFallback: !asset, summary: `Added ${additions.length} grounded ${object}${additions.length === 1 ? "" : "s"} by the pool, oriented toward it.`, json: JSON.stringify({ ...root, outdoorAssetPlacements: [...existing, ...additions] }) };
}
