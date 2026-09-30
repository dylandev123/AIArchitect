import type { CuratedAsset } from "@/types/assets";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { placementBounds } from "@/lib/outdoor/placements";
import { v2SiteFrame } from "./siteFrame";
import { v2SitePlanOf, placeOutdoorBar } from "./v2SiteFeatures";

export type AdditiveObject = "chair" | "lounger" | "table" | "umbrella" | "planter" | "bar";
export type PlacementFailureCode = "UNSUPPORTED_OBJECT" | "NO_VALID_SITE_PLAN" | "NO_APPROVED_ASSET" | "ALL_CANDIDATES_COLLIDE";
export type AdditivePlacementResult =
  | { ok: true; object: AdditiveObject; json: string; summary: string; assetId: string }
  | { ok: false; code: PlacementFailureCode; error: string };

const SPEC: Record<Exclude<AdditiveObject, "bar">, { role: string; terms: string[]; width: number; depth: number; height: number }> = {
  chair: { role: "lounge-armchair", terms: ["chair", "armchair", "lounge"], width: .9, depth: .9, height: .8 },
  lounger: { role: "sun-lounger", terms: ["lounger", "sun lounger", "chaise"], width: .8, depth: 2.0, height: .5 },
  table: { role: "side-table", terms: ["table", "side table", "coffee table"], width: .7, depth: .7, height: .55 },
  umbrella: { role: "parasol", terms: ["umbrella", "parasol"], width: 2.5, depth: 2.5, height: 2.5 },
  planter: { role: "planter", terms: ["planter", "plant pot", "pot"], width: .9, depth: .9, height: .9 },
};

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

/**
 * Deterministic executor for a small semantic additive request. It deliberately never edits the V2
 * architecture document or existing Site Plan geometry; only a new loose asset placement is appended.
 */
export function placeV2AdditiveAsset(root: Record<string, unknown>, prompt: string, assets: readonly CuratedAsset[], glbIds: readonly string[]): AdditivePlacementResult {
  const object = requestedObject(prompt);
  if (!object) return { ok: false, code: "UNSUPPORTED_OBJECT", error: "This V2 additive edit supports chairs, loungers, tables, umbrellas, planters, and outdoor bars." };
  const plan = v2SitePlanOf(root);
  if (!plan) return { ok: false, code: "NO_VALID_SITE_PLAN", error: "This V2 project has no valid Site Plan, so I cannot safely anchor the requested object." };
  if (object === "bar") {
    const asset = assets.find((a) => a.type === "glb-model" && a.status === "approved" && glbIds.includes(a.id) && a.validation?.passed !== false && (a.family === "outdoor-bar" || /outdoor[\s-]*bar/i.test(a.name)));
    const placed = placeOutdoorBar(root, asset?.id);
    if ("error" in placed) return { ok: false, code: "ALL_CANDIDATES_COLLIDE", error: placed.error };
    return { ok: true, object, assetId: asset?.id ?? "procedural-outdoor-bar", summary: "Added a grounded outdoor bar beside the existing outdoor-living area.", json: JSON.stringify({ ...root, sitePlan: placed.plan }) };
  }
  const asset = assetFor(object, assets, glbIds);
  if (!asset) return { ok: false, code: "NO_APPROVED_ASSET", error: `No approved GLB matching a ${object} is available in the library.` };
  const spec = SPEC[object], count = quantity(prompt);
  const dimensions = { width: asset.validation?.footprint?.width ?? asset.dimensions?.width ?? spec.width, depth: asset.validation?.footprint?.depth ?? asset.dimensions?.depth ?? spec.depth, height: asset.dimensions?.height ?? spec.height };
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
    additions.push({ id: `outdoor-v2-${crypto.randomUUID()}`, assetId: asset.id, parentSpaceId: "v2-poolside", category: asset.family ?? "furniture", position: [candidate.x, 0, candidate.z], rotation: [0, yaw, 0], scale: 1, role: spec.role, relationship: { type: "around", targetId: "pool" }, dimensions });
  }
  return { ok: true, object, assetId: asset.id, summary: `Added ${additions.length} grounded ${object}${additions.length === 1 ? "" : "s"} by the pool, oriented toward it.`, json: JSON.stringify({ ...root, outdoorAssetPlacements: [...existing, ...additions] }) };
}
