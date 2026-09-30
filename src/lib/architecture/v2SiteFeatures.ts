import { buildBuilding } from "@/lib/house/features/buildings";
import { DEFAULT_MATERIALS_CONFIG, type MaterialsConfig } from "@/types/house";
import type { HousePrimitive } from "@/lib/house/types";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { v2SiteFrame } from "./siteFrame";
import { sitePlanSchema, type SitePlan, type V2SiteFeature } from "./sitePlanContract";

/** The V2-only edit surface. Architectural/massing operations are intentionally absent. */
export type V2SiteFeatureOperation =
  | { op: "addSiteFeature"; feature: V2SiteFeature }
  | { op: "moveSiteFeature"; id: string; x: number; z: number }
  | { op: "updateSiteFeature"; id: string; fields: Partial<Omit<V2SiteFeature, "id" | "kind">> }
  | { op: "removeSiteFeature"; id: string };

/** Compiles only typed V2 Site Plan additions, without consulting legacy `buildings`. */
export function compileV2SiteFeatures(plan: SitePlan, materials: MaterialsConfig = DEFAULT_MATERIALS_CONFIG): HousePrimitive[] {
  return (plan.features ?? []).flatMap((feature, index) =>
    buildBuilding({ kind: feature.kind, x: feature.x, z: feature.z, width: feature.width, depth: feature.depth, floors: 1, roof: "flat", rotation: feature.rotation, ...(feature.assetId ? { assetId: feature.assetId } : {}) }, materials, index)
      .map((primitive) => ({ ...primitive, id: `v2-site-feature-${feature.id}-${primitive.id}` }))
  );
}

export function v2SitePlanOf(root: Record<string, unknown>): SitePlan | undefined {
  const parsed = sitePlanSchema.safeParse(root.sitePlan);
  return parsed.success ? parsed.data : undefined;
}

export function applyV2SiteFeatureOperation(plan: SitePlan, operation: V2SiteFeatureOperation): SitePlan {
  switch (operation.op) {
    case "addSiteFeature": return { ...plan, features: [...(plan.features ?? []), operation.feature] };
    case "moveSiteFeature": return { ...plan, features: (plan.features ?? []).map((f) => f.id === operation.id ? { ...f, x: operation.x, z: operation.z } : f) };
    case "updateSiteFeature": return { ...plan, features: (plan.features ?? []).map((f) => f.id === operation.id ? { ...f, ...operation.fields } : f) };
    case "removeSiteFeature": return { ...plan, features: (plan.features ?? []).filter((f) => f.id !== operation.id) };
  }
}

type Rect = { x: number; z: number; width: number; depth: number };
const overlaps = (a: Rect, b: Rect, gap = 0.75) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + gap;
const rectOf = (p: HousePrimitive): Rect | undefined => p.kind === "box" ? { x: p.position[0], z: p.position[2], width: Math.abs(p.size[0] * Math.cos(p.rotation[1])) + Math.abs(p.size[2] * Math.sin(p.rotation[1])), depth: Math.abs(p.size[2] * Math.cos(p.rotation[1])) + Math.abs(p.size[0] * Math.sin(p.rotation[1])) } : undefined;

/**
 * Cheap deterministic placement for the first V2 follow-up feature. The existing Site Plan is read-only:
 * we only seek an empty ground rectangle beside its pool/deck/terrace, never move any existing feature.
 */
export function placeOutdoorBar(root: Record<string, unknown>, assetId?: string): { plan: SitePlan; feature: V2SiteFeature } | { error: string } {
  const plan = v2SitePlanOf(root);
  if (!plan) return { error: "This V2 project has no valid Site Plan to place an outdoor bar in." };
  const id = `site-feature-${crypto.randomUUID()}`;
  const width = 6, depth = 3;
  const legacy = generateHouseFromJson(JSON.stringify(root));
  const obstacles: Rect[] = [];
  for (const mass of v2SiteFrame(root)?.masses ?? []) obstacles.push({ x: mass.cx, z: mass.cz, width: mass.width, depth: mass.depth });
  for (const primitive of legacy.model?.primitives ?? []) {
    if (!["pool", "patio", "deck", "path", "driveway", "parking", "building"].includes(primitive.category)) continue;
    const rect = rectOf(primitive);
    if (rect) obstacles.push(rect);
  }
  // The persisted Site Plan is authoritative even when an older project has not retained its
  // compiled legacy deck primitives. Never set an addition on top of its pool deck.
  obstacles.push({ x: plan.poolDeck.x, z: plan.poolDeck.z, width: plan.poolDeck.width, depth: plan.poolDeck.depth });
  for (const existing of plan.features ?? []) obstacles.push({ x: existing.x, z: existing.z, width: existing.width, depth: existing.depth });
  const anchors = [
    { x: plan.poolDeck.x, z: plan.poolDeck.z },
    { x: plan.poolDeck.x + plan.poolDeck.width / 2 + width / 2 + 1.5, z: plan.poolDeck.z },
    { x: plan.poolDeck.x - plan.poolDeck.width / 2 - width / 2 - 1.5, z: plan.poolDeck.z },
    { x: plan.poolDeck.x, z: plan.poolDeck.z + plan.poolDeck.depth / 2 + depth / 2 + 1.5 },
    { x: plan.poolDeck.x, z: plan.poolDeck.z - plan.poolDeck.depth / 2 - depth / 2 - 1.5 },
  ];
  const candidate = anchors.map((a) => ({ ...a, width, depth })).find((r) => !obstacles.some((o) => overlaps(r, o)));
  if (!candidate) return { error: "There is no collision-safe ground-level space beside the existing outdoor-living area for an outdoor bar." };
  const feature: V2SiteFeature = { id, kind: "outdoor_bar", x: candidate.x, z: candidate.z, width, depth, rotation: 0, ...(assetId ? { assetId } : {}) };
  return { plan: applyV2SiteFeatureOperation(plan, { op: "addSiteFeature", feature }), feature };
}
