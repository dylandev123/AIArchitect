import type { VegetationKind } from "@/lib/landscaping/vegetationGeometry";
import { createRng, hashSeed } from "@/lib/landscaping/rng";
import type { V3Scene, V3SceneObject } from "./scene";
import { buildV3TerrainSurface } from "./scene";
import { getObjectTopY, scaledDimensionsOf } from "./elevation";
import { resolveSiteHierarchy } from "./siteHierarchy";

/**
 * Presentation-only planting for V3 landscape zones and planters. Derived on every render from authored zone intent
 * (role, label, material id) and footprint; never persisted, never part of the compiled/validated model, and
 * deterministic: the same scene always yields the same plants.
 */
export interface V3PlantPlacement { id: string; zoneId: string; kind: VegetationKind; variant: number; position: [number, number, number]; height: number; rotationY: number; foliageColor: string; }

interface Palette {
  trees: ReadonlyArray<[VegetationKind, number]>;
  shrubs: ReadonlyArray<[VegetationKind, number]>;
  /** Square metres of zone per tree / per shrub. */
  treeArea: number; shrubArea: number;
  treeHeight: [number, number];
}
const TROPICAL: Palette = { trees: [["palm", 1]], shrubs: [["shrub-flowering", 3], ["shrub", 2]], treeArea: 38, shrubArea: 13, treeHeight: [6.5, 10.5] };
const TROPICAL_SCREEN: Palette = { ...TROPICAL, treeArea: 24, shrubArea: 9 };
const TEMPERATE: Palette = { trees: [["oak", 3], ["oak-tall", 2], ["cypress", 1]], shrubs: [["shrub", 3], ["shrub-flowering", 1]], treeArea: 70, shrubArea: 16, treeHeight: [5.5, 8.5] };
const SCREEN: Palette = { trees: [["cypress", 3], ["oak-tall", 1]], shrubs: [["shrub", 1]], treeArea: 22, shrubArea: 10, treeHeight: [6, 9] };
const BEDS: Palette = { trees: [], shrubs: [["shrub-flowering", 1], ["shrub", 1]], treeArea: Infinity, shrubArea: 6, treeHeight: [0, 0] };
const VARIANTS: Record<VegetationKind, number> = { oak: 3, "oak-tall": 2, pine: 2, cypress: 1, palm: 2, shrub: 2, "shrub-flowering": 2 };

const TROPICAL_WORDS = /\b(tropical|palms?|heliconia|frangipani|plumeria|banana|bougainvillea|resort|beach|coastal|lanai|bird.of.paradise|monstera)\b/;
const SCREEN_WORDS = /\b(privacy|screen|screening|hedge|buffer|boundary|windbreak)\b/;
const OPEN_WORDS = /\b(lawn|turf|meadow|grass|green|playing.field)\b/;
const BED_WORDS = /\b(bed|border|planter|flower)\b/;

/** Authored intent → planting palette. An open lawn deliberately gets no trees or shrubs. */
export function v3PlantingPalette(zone: V3SceneObject): Palette | undefined {
  const text = `${zone.semanticRole} ${zone.label} ${zone.material?.id ?? ""}`.toLowerCase().replace(/[-_]+/g, " ");
  const tropical = TROPICAL_WORDS.test(text), screen = SCREEN_WORDS.test(text);
  if (tropical) return screen ? TROPICAL_SCREEN : TROPICAL;
  if (screen) return SCREEN;
  if (OPEN_WORDS.test(text) && !/\b(planting|garden|trees?)\b/.test(text)) return undefined;
  if (BED_WORDS.test(text) || zone.type === "planter") return BEDS;
  return TEMPERATE;
}

/** Objects that planting must keep clear of: everything physical except other planting and terrain intent. */
const NON_OBSTACLE = new Set(["landscape-zone", "planter", "terrain-region"]);

interface Rect { cx: number; cz: number; a: number; hw: number; hd: number; }
const rectOf = (o: V3SceneObject): Rect => { const [w, , d] = scaledDimensionsOf(o); return { cx: o.transform.position[0], cz: o.transform.position[2], a: o.transform.rotation[1], hw: w / 2, hd: d / 2 }; };
function toLocal(r: Rect, x: number, z: number): [number, number] {
  const c = Math.cos(r.a), s = Math.sin(r.a), dx = x - r.cx, dz = z - r.cz;
  return [dx * c - dz * s, dx * s + dz * c];
}
const insideRect = (r: Rect, x: number, z: number, margin: number) => { const [lx, lz] = toLocal(r, x, z); return Math.abs(lx) <= r.hw + margin && Math.abs(lz) <= r.hd + margin; };
function segmentDistance(x: number, z: number, a: readonly number[], b: readonly number[]): number {
  const dx = b[0] - a[0], dz = b[2] - a[2], len = dx * dx + dz * dz, t = len ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / len)) : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[2] + dz * t));
}

const MAX_PER_ZONE = { trees: 40, shrubs: 70 };
const CLEARANCE = { tree: 1.4, shrub: .45 };

function pick(rng: () => number, table: ReadonlyArray<[VegetationKind, number]>): VegetationKind {
  let roll = rng() * table.reduce((sum, [, w]) => sum + w, 0);
  for (const [kind, w] of table) if ((roll -= w) < 0) return kind;
  return table[table.length - 1][0];
}

/** Jittered grid over the zone footprint (local frame), so plants spread evenly but never read as a lattice. */
function scatter(rng: () => number, hw: number, hd: number, count: number, inset: number): [number, number][] {
  const w = Math.max(0, hw * 2 - inset * 2), d = Math.max(0, hd * 2 - inset * 2);
  if (!count || w <= 0 || d <= 0) return [];
  const cols = Math.max(1, Math.round(Math.sqrt(count * w / d))), rows = Math.max(1, Math.ceil(count / cols)), out: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([-w / 2 + (c + .15 + rng() * .7) * w / cols, -d / 2 + (r + .15 + rng() * .7) * d / rows]);
  return out;
}

export function v3VegetationPlacements(scene: V3Scene, heightAt: (x: number, z: number) => number = buildV3TerrainSurface(scene).heightAt): V3PlantPlacement[] {
  const obstacles = scene.objects.filter((o) => !NON_OBSTACLE.has(o.type)).map(rectOf);
  const routes = resolveSiteHierarchy(scene).hierarchy.connections;
  const halfW = scene.site.width / 2, halfD = scene.site.depth / 2;
  const clear = (x: number, z: number, margin: number) => Math.abs(x) <= halfW - margin && Math.abs(z) <= halfD - margin
    && !obstacles.some((r) => insideRect(r, x, z, margin))
    && !routes.some((route) => route.route.some((p, i) => i > 0 && segmentDistance(x, z, route.route[i - 1], p) < route.width / 2 + margin));
  const out: V3PlantPlacement[] = [];
  for (const zone of scene.objects) {
    if (zone.type !== "landscape-zone" && zone.type !== "planter") continue;
    const palette = v3PlantingPalette(zone);
    if (!palette) continue;
    const r = rectOf(zone), area = r.hw * r.hd * 4, rng = createRng(hashSeed("v3-planting", zone.id));
    const planter = zone.type === "planter";
    const place = (local: [number, number], tree: boolean, index: number) => {
      const c = Math.cos(r.a), s = Math.sin(r.a), x = r.cx + local[0] * c + local[1] * s, z = r.cz - local[0] * s + local[1] * c;
      const kind = pick(rng, tree ? palette.trees : palette.shrubs), variantRoll = rng(), heightRoll = rng(), spin = rng();
      // Planters hold their plants on their own top; ground zones follow the final terrain and keep clear of everything built.
      if (!planter && !clear(x, z, tree ? CLEARANCE.tree : CLEARANCE.shrub)) return;
      const height = tree ? palette.treeHeight[0] + heightRoll * (palette.treeHeight[1] - palette.treeHeight[0]) : (planter ? .6 : .8) + heightRoll * (planter ? .5 : .9);
      out.push({ id: `${zone.id}-${tree ? "tree" : "shrub"}-${index}`, zoneId: zone.id, kind, variant: Math.floor(variantRoll * VARIANTS[kind]), position: [x, planter ? getObjectTopY(zone) : heightAt(x, z), z], height, rotationY: spin * Math.PI * 2, foliageColor: zone.material?.color ?? "#4f7a43" });
    };
    const trees = planter || !palette.trees.length ? 0 : Math.min(MAX_PER_ZONE.trees, Math.floor(area / palette.treeArea));
    scatter(rng, r.hw, r.hd, trees, Math.min(1.5, r.hw * .4, r.hd * .4)).forEach((p, i) => place(p, true, i));
    const shrubs = Math.min(MAX_PER_ZONE.shrubs, Math.max(planter ? 1 : 0, Math.floor(area / palette.shrubArea)));
    scatter(rng, r.hw, r.hd, shrubs, Math.min(.5, r.hw * .3, r.hd * .3)).forEach((p, i) => place(p, false, i));
  }
  return out;
}
