import type { CuratedAsset } from "@/types/assets";
import type { AssetCategory, AssetRequest } from "@/types/library";
import type { HousePrimitive } from "@/lib/house/types";
import { DEFAULT_MATERIALS_CONFIG, type MaterialsConfig } from "@/types/house";
import { placementBounds, type OutdoorAssetPlacement, type PlacementIntentRecord } from "@/lib/outdoor/placements";
import type { ProxyCanopy, ProxyShape } from "@/lib/outdoor/proxyShapes";
import { extractContextTags, extractStyleTags } from "@/lib/library/taxonomy";
import { compileArchitecture, massTotalHeight, pickDominantMass, resolveMasses } from "./compiler";
import { isArchitecturalDesignDocument, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument, type MassVolume } from "./document";
import { v2SiteFrame } from "./siteFrame";
import { v2SitePlanOf } from "./v2SiteFeatures";

/**
 * Standalone additive objects beyond the original six-noun whitelist (see v2AdditivePlacement.ts). An approved GLB is
 * used when one exists; otherwise a small procedural proxy fills the same placement and a Need records the missing
 * asset. Nothing here edits the V2 document or Site Plan — only a loose `outdoorAssetPlacements` entry is appended.
 */

export type StandaloneObject = "gazebo" | "pergola" | "cabana" | "shade-structure" | "outdoor-kitchen" | "fire-pit" | "bench" | "sculpture";

interface StandaloneSpec {
  label: string;
  /** Matched against the request's subject (never its location phrases). */
  pattern: RegExp;
  shape: ProxyShape;
  canopy?: ProxyCanopy;
  category: AssetCategory;
  /** Canonical component key recorded on the Need. */
  component: string;
  /** Words an approved GLB's name/tags/family must contain to stand in for this object. */
  aliases: string[];
  size: { width: number; depth: number; height: number };
}

const STANDALONE: Record<StandaloneObject, StandaloneSpec> = {
  gazebo: { label: "gazebo", pattern: /\bgazebos?\b|\bbelvederes?\b/, shape: "post-frame", canopy: "solid", category: "gazebo", component: "gazebo", aliases: ["gazebo", "belvedere"], size: { width: 3.6, depth: 3.6, height: 2.9 } },
  pergola: { label: "pergola", pattern: /\bpergolas?\b|\barbou?rs?\b/, shape: "post-frame", canopy: "slatted", category: "pergola", component: "pergola", aliases: ["pergola", "arbor", "arbour"], size: { width: 4, depth: 3, height: 2.7 } },
  cabana: { label: "cabana", pattern: /\bcabanas?\b/, shape: "post-frame", canopy: "solid", category: "cabana", component: "cabana", aliases: ["cabana"], size: { width: 3, depth: 3, height: 2.7 } },
  "shade-structure": { label: "shade structure", pattern: /\b(?:freestanding\s+)?shade\s+(?:structures?|canop(?:y|ies)|sails?)\b|\bsun\s?shades?\b/, shape: "post-frame", canopy: "canopy", category: "pergola", component: "shade-structure", aliases: ["shade", "canopy", "sunshade"], size: { width: 3, depth: 3, height: 2.7 } },
  "outdoor-kitchen": { label: "outdoor kitchen", pattern: /\b(?:outdoor|summer|alfresco|patio|rooftop|garden)\s+kitchens?\b|\b(?:bbq|barbecue|barbeque)s?\b|\bgrill(?:\s+(?:station|island))?s?\b/, shape: "counter", category: "outdoor-kitchen", component: "kitchen-island", aliases: ["kitchen", "bbq", "barbecue", "grill"], size: { width: 3, depth: .8, height: .95 } },
  "fire-pit": { label: "fire pit", pattern: /\bfire[-\s]?pits?\b|\bfire\s?bowls?\b/, shape: "fire-pit", category: "fire-pit", component: "fire-pit", aliases: ["firepit", "fire-pit", "fire"], size: { width: 1.2, depth: 1.2, height: .45 } },
  bench: { label: "bench", pattern: /\bbench(?:es)?\b/, shape: "bench", category: "furniture", component: "outdoor-bench", aliases: ["bench"], size: { width: 1.6, depth: .6, height: .85 } },
  sculpture: { label: "sculpture", pattern: /\bsculptures?\b|\bstatues?\b/, shape: "sculpture", category: "decorative", component: "sculpture", aliases: ["sculpture", "statue"], size: { width: .8, depth: .8, height: 1.8 } },
};
export const STANDALONE_OBJECTS = Object.keys(STANDALONE) as StandaloneObject[];

/** The original whitelist's nouns (chair, lounger, table, umbrella, planter, bar), located only to order mentions. */
const EXISTING_OBJECT = /\b(?:chairs?|armchairs?|lounge(?:rs?)?|chaises?|tables?|umbrellas?|parasols?|planters?|plant\s+pots?|pots?|bars?)\b/;
/** Buildings, rooms, envelope parts and roofs: requests about these are architectural-document edits, never objects. */
const ARCHITECTURAL = /\b(?:\w*rooms?|suites?|wings?|stor(?:e?ys?|ies)|floors?|levels?|walls?|windows?|doors?|doorways?|balcon(?:y|ies)|terraces?|verandas?|porch(?:es)?|recess(?:es)?|extensions?|additions?|annex(?:es)?|mass(?:es)?|volumes?|fa[cç]ades?|skylights?|roofs?|roofline|garages?|carports?|kitchens?|stairs?|staircases?|overhangs?|cantilevers?|glazing|houses?|buildings?|pavilions?|studios?|cottages?|basements?|attics?|lofts?|towers?|courtyards?)\b/;
/** Requests that change or remove something rather than add a new object. */
const NON_ADDITIVE = /^(?:please\s+|(?:can|could|would)\s+you\s+)?(?:remove|delete|move|relocate|replace|resize|rotate|swap|enlarge|shrink|widen|extend|deepen|raise|lower|change|modify|convert|turn|take\s+away|get\s+rid\s+of)\b/;

const PREPOSITIONS = new Set(["on", "onto", "atop", "upon", "to", "toward", "towards", "beside", "by", "near", "at", "of", "in", "inside", "into", "behind", "along", "alongside", "over", "under", "underneath", "above", "below", "beneath", "around", "across", "against", "within", "from", "between", "facing", "overlooking", "off", "outside", "with", "for"]);
const DETERMINERS = new Set(["the", "a", "an", "my", "our", "its", "this", "that", "their", "his", "her"]);
const CLAUSE_BREAKS = new Set(["and", "then", "also", "plus", "but"]);

interface RequestParts { subject: string; spans: { prep: string; text: string }[] }

/**
 * Splits a request into its subject ("add a modern rooftop gazebo") and its prepositional phrases ("toward | the rear
 * side", "of | the main roof"). Only the subject names what to add; a phrase names where it goes or what it is like,
 * so "a bench by the bedroom wing" is a bench, never a bedroom edit.
 */
function requestParts(prompt: string): RequestParts {
  const text = prompt.toLowerCase().replace(/\broof[\s-]top\b/g, "rooftop").replace(/\b(?:a\s+)?(?:pair|couple|set|few|number)\s+of\b/g, " ");
  const tokens = text.match(/[a-z0-9]+(?:['.-][a-z0-9]+)*|[,.;:!?]/g) ?? [];
  const subject: string[] = [];
  const spans: { prep: string; words: string[]; sawAnd?: boolean }[] = [];
  let open: (typeof spans)[number] | undefined;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const between = open?.prep === "between" && tok === "and" && !open.sawAnd;
    if (/^[,.;:!?]$/.test(tok) || (CLAUSE_BREAKS.has(tok) && !between)) { open = undefined; subject.push("|"); continue; }
    if (between) { open!.sawAnd = true; open!.words.push(tok); continue; }
    const nextTo = tok === "next" && tokens[i + 1] === "to";
    if (nextTo || (PREPOSITIONS.has(tok) && (tok !== "to" || DETERMINERS.has(tokens[i + 1] ?? "")))) {
      open = { prep: nextTo ? "next to" : tok, words: [] };
      spans.push(open);
      if (nextTo) i++;
      continue;
    }
    (open ? open.words : subject).push(tok);
  }
  return { subject: subject.join(" "), spans: spans.map((s) => ({ prep: s.prep, text: s.words.join(" ") })) };
}

export type AdditiveClassification =
  | { kind: "standalone"; object: StandaloneObject }
  | { kind: "existing" }
  | { kind: "architectural"; reason: string }
  | { kind: "non-additive"; reason: string }
  | { kind: "unknown" };

/**
 * The boundary between "add a standalone object" and "change the architecture". Uncertain requests are not guessed
 * at: an architectural mention outside a location phrase, or a change/remove verb, is never turned into an object.
 */
export function classifyAdditiveRequest(prompt: string): AdditiveClassification {
  const lower = prompt.trim().toLowerCase();
  if (NON_ADDITIVE.test(lower)) return { kind: "non-additive", reason: "Additive object edits only add a new standalone object; changing, moving or removing something is not handled here." };
  const { subject } = requestParts(prompt);
  const mentions = [
    ...STANDALONE_OBJECTS.map((object) => ({ object, at: subject.search(STANDALONE[object].pattern) })),
    { object: "existing" as const, at: subject.search(EXISTING_OBJECT) },
  ].filter((m) => m.at >= 0).sort((a, b) => a.at - b.at);
  // "outdoor kitchen" is an object, not a kitchen; mask every object phrase before looking for architecture.
  const masked = [...STANDALONE_OBJECTS.map((o) => STANDALONE[o].pattern), EXISTING_OBJECT].reduce((s, re) => s.replace(new RegExp(re.source, "g"), " "), subject);
  const architectural = masked.match(ARCHITECTURAL)?.[0];
  if (architectural) return { kind: "architectural", reason: `"${architectural}" is part of the architecture, not a standalone object. That change belongs to the architectural design, so this additive object edit was not applied.` };
  const first = mentions[0];
  if (!first) return { kind: "unknown" };
  return first.object === "existing" ? { kind: "existing" } : { kind: "standalone", object: first.object };
}

// ── Placement intent ────────────────────────────────────────────────────────────────────────────────────────────

type Side = NonNullable<PlacementIntentRecord["side"]>;
const COMPASS: Record<"north" | "south" | "east" | "west", { x: number; z: number }> = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, east: { x: 1, z: 0 }, west: { x: -1, z: 0 } };

export interface ParsedIntent {
  surface: PlacementIntentRecord["surface"] | "unresolved";
  /** The words that named the surface, used to pick a specific mass ("garage roof"). */
  where: string;
  side?: Side;
  dimensions: { width: number; depth: number; height: number };
  count: number;
}

const unitScale = (unit: string | undefined) => (unit && /^(?:ft|feet|foot)$/.test(unit) ? .3048 : 1);
const NUM = String.raw`(\d+(?:\.\d+)?)\s*(m|meters?|metres?|ft|feet|foot)?`;

/** Reads where and how big from the request itself. Nothing is invented: unresolvable locations stay unresolved. */
export function parsePlacementIntent(prompt: string, object: StandaloneObject): ParsedIntent {
  const lower = prompt.toLowerCase().replace(/\broof[\s-]top\b/g, "rooftop");
  const { subject, spans } = requestParts(prompt);
  const located = spans.filter((s) => s.prep !== "with" && s.prep !== "for" && s.prep !== "facing" && s.prep !== "overlooking");
  const where = located.map((s) => s.text).join(" ");
  const sideWord = /\b(rear|back|front|north|south|east|west|left|right|centre|center|middle)\b/.exec(`${where} ${subject}`)?.[1];
  const side: Side | undefined = sideWord === "back" ? "rear" : sideWord === "centre" || sideWord === "middle" ? "center" : sideWord as Side | undefined;
  const sideOnly = (t: string) => t.replace(/\b(?:the|a|an|side|part|end|corner|edge|half|rear|back|front|north|south|east|west|left|right|centre|center|middle|of|it|there|here)\b/g, "").trim() === "";
  let surface: ParsedIntent["surface"];
  if (/\brooftop\b|\broof\s+(?:deck|terrace)\b/.test(lower) || /\broofs?\b/.test(where)) surface = "roof";
  else if (/\bpool(?:side)?\b/.test(where) || /\bpoolside\b/.test(subject)) surface = "poolside";
  else if (/\b(?:garden|lawn)\b/.test(where) || /\b(?:garden|lawn)\b/.test(subject)) surface = "garden";
  // No location at all keeps the established additive default (beside the pool); a location we cannot resolve is refused.
  else surface = located.every((s) => sideOnly(s.text)) && !side ? "poolside" : "unresolved";

  const spec = STANDALONE[object].size;
  const clamp = (v: number, base: number) => Math.min(base * 2.5, Math.max(base * .4, v));
  const plan = new RegExp(`${NUM}\\s*(?:x|by|×)\\s*${NUM}`).exec(lower);
  const tall = new RegExp(`${NUM}\\s*(?:tall|high)`).exec(lower);
  const dimensions = {
    width: plan ? clamp(Number(plan[1]) * unitScale(plan[2] ?? plan[4]), spec.width) : spec.width,
    depth: plan ? clamp(Number(plan[3]) * unitScale(plan[4] ?? plan[2]), spec.depth) : spec.depth,
    height: tall ? clamp(Number(tall[1]) * unitScale(tall[2]), spec.height) : spec.height,
  };
  // Count only words before the object noun, and never a measurement ("a 3m gazebo" is one gazebo).
  const before = subject.slice(0, Math.max(0, subject.search(STANDALONE[object].pattern)));
  const counted = /\b(two|three|four|pair|2|3|4)\b(?!\s*(?:m\b|meters?|metres?|ft\b|feet|x\b|by\b))/.exec(before)?.[1];
  const count = counted ? ({ two: 2, pair: 2, three: 3, four: 4 } as Record<string, number>)[counted] ?? Number(counted) : 1;
  return { surface, where, side, dimensions, count };
}

// ── Geometry helpers ────────────────────────────────────────────────────────────────────────────────────────────

export type LocalBounds = { min: [number, number, number]; max: [number, number, number] };
type Rect = { x: number; z: number; width: number; depth: number };

/** Turns a desired world geometry-centre into the model-origin transform persisted in project JSON. */
export function originForCentre(centre: { x: number; z: number }, bounds: LocalBounds, scale: number, yaw: number, supportY: number) {
  const cx = (bounds.min[0] + bounds.max[0]) * scale / 2, cz = (bounds.min[2] + bounds.max[2]) * scale / 2;
  return [centre.x - cx * Math.cos(yaw) - cz * Math.sin(yaw), supportY - bounds.min[1] * scale, centre.z + cx * Math.sin(yaw) - cz * Math.cos(yaw)] as [number, number, number];
}
const proceduralBounds = (d: { width: number; depth: number; height: number }): LocalBounds => ({ min: [-d.width / 2, 0, -d.depth / 2], max: [d.width / 2, d.height, d.depth / 2] });
function validBounds(asset: CuratedAsset): LocalBounds | undefined {
  const b = asset.validation?.bounds;
  return b && b.min.every(Number.isFinite) && b.max.every(Number.isFinite) && b.max[0] > b.min[0] && b.max[1] > b.min[1] && b.max[2] > b.min[2] ? b : undefined;
}
const sizeOf = (b: LocalBounds, scale = 1) => ({ width: (b.max[0] - b.min[0]) * scale, depth: (b.max[2] - b.min[2]) * scale, height: (b.max[1] - b.min[1]) * scale });
/** Local (x, z) in a frame rotated by `yaw` → world, using Three's Y rotation (see `placementBounds`). */
const toWorld = (c: { x: number; z: number }, lx: number, lz: number, yaw: number) => ({ x: c.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: c.z - lx * Math.sin(yaw) + lz * Math.cos(yaw) });
const toLocal = (v: { x: number; z: number }, yaw: number) => ({ x: v.x * Math.cos(yaw) - v.z * Math.sin(yaw), z: v.x * Math.sin(yaw) + v.z * Math.cos(yaw) });
const aabb = (c: { x: number; z: number }, width: number, depth: number, yaw: number): Rect => {
  const cos = Math.abs(Math.cos(yaw)), sin = Math.abs(Math.sin(yaw));
  return { x: c.x, z: c.z, width: width * cos + depth * sin, depth: depth * cos + width * sin };
};
const overlap = (a: Rect, b: Rect, gap: number) => Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + gap;
const placementRect = (p: OutdoorAssetPlacement): Rect => { const b = placementBounds(p); return { x: b.x, z: b.z, width: b.w, depth: b.d }; };

/** The compass direction the request's side word points at, given where the house is arrived at (its front). */
function sideVector(side: Side | undefined, arrival: keyof typeof COMPASS): { x: number; z: number } | undefined {
  if (!side || side === "center") return undefined;
  const front = COMPASS[arrival];
  if (side === "front") return front;
  if (side === "rear") return { x: -front.x, z: -front.z };
  // Left/right as seen standing at the front, looking at the house.
  if (side === "left" || side === "right") { const facing = { x: -front.x, z: -front.z }; const right = { x: -facing.z, z: facing.x }; return side === "right" ? right : { x: -right.x, z: -right.z }; }
  return COMPASS[side];
}

/** Top-face triangles of a flat roof plane, projected to plan (x, z). */
function topTriangles(p: HousePrimitive): { y: number; tris: [number, number][][] } {
  if (p.kind === "box") {
    const yaw = p.rotation[1], [w, , d] = p.size, c = { x: p.position[0], z: p.position[2] };
    const k = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => { const q = toWorld(c, sx * w / 2, sz * d / 2, yaw); return [q.x, q.z] as [number, number]; });
    return { y: p.position[1] + p.size[1] / 2, tris: [[k[0], k[1], k[2]], [k[0], k[2], k[3]]] };
  }
  const v = p.vertices, ys = v.filter((_, i) => i % 3 === 1), y = Math.max(...ys), tris: [number, number][][] = [];
  for (let i = 0; i + 8 < v.length; i += 9) if (Math.abs(v[i + 1] - y) < 1e-3 && Math.abs(v[i + 4] - y) < 1e-3 && Math.abs(v[i + 7] - y) < 1e-3) tris.push([[v[i], v[i + 2]], [v[i + 3], v[i + 5]], [v[i + 6], v[i + 8]]]);
  return { y, tris };
}
function inTriangle(p: [number, number], [a, b, c]: [number, number][]): boolean {
  const s = (p1: [number, number], p2: [number, number], p3: [number, number]) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
  return !((d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9) && (d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9));
}

// ── Assets ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** An approved, stored, validated GLB for this object, if the catalog has one. */
export function standaloneAssetFor(object: StandaloneObject, assets: readonly CuratedAsset[], glbIds: readonly string[]): CuratedAsset | undefined {
  const spec = STANDALONE[object];
  return assets.find((asset) => asset.type === "glb-model" && asset.status === "approved" && glbIds.includes(asset.id) && asset.validation?.passed !== false &&
    (asset.family === spec.category && spec.category !== "furniture" && spec.category !== "decorative"
      || [asset.name, ...(asset.tags ?? []), ...(asset.categories ?? []), asset.family ?? ""].join(" ").toLowerCase().split(/[^a-z-]+/).some((term) => spec.aliases.some((alias) => term === alias || term.replace(/-/g, "") === alias.replace(/-/g, "")))));
}

export const proceduralStandaloneAssetId = (object: StandaloneObject) => `procedural-v2-${object}`;

// ── Placement ───────────────────────────────────────────────────────────────────────────────────────────────────

export type StandalonePlacementResult =
  | { ok: true; object: StandaloneObject; json: string; summary: string; assetId: string; usedProceduralFallback: boolean; placementIds: string[]; needRequest?: Omit<AssetRequest, "projectId"> }
  | { ok: false; code: "NO_VALID_SITE_PLAN" | "UNSUPPORTED_LOCATION" | "NO_FLAT_ROOF" | "DOES_NOT_FIT" | "ALL_CANDIDATES_COLLIDE"; error: string };

interface Candidate { centre: { x: number; z: number }; yaw: number; supportY: number; support: NonNullable<OutdoorAssetPlacement["support"]>; parentSpaceId: string; intent: Omit<PlacementIntentRecord, "centre" | "yaw" | "dimensions"> }

function documentOf(root: Record<string, unknown>): ArchitecturalDesignDocument | undefined {
  const document = root.architecturalDesignDocument ?? root.architectureDocument;
  return isArchitecturalDesignDocument(document) && !validateArchitecturalDesignDocument(document).length ? document : undefined;
}
function materialsOf(root: Record<string, unknown>): MaterialsConfig {
  const site = root.site as { materials?: Partial<MaterialsConfig> } | undefined;
  return site && typeof site.materials === "object" && site.materials ? { ...DEFAULT_MATERIALS_CONFIG, ...site.materials } : DEFAULT_MATERIALS_CONFIG;
}

const STOP_WORDS = new Set(["main", "the", "roof", "wing", "volume", "pavilion", "house", "block", "of", "and", "a"]);
/** The mass a roof request names ("garage roof", "guest pavilion"), else the dominant (main) mass. */
function targetMass(masses: readonly MassVolume[], where: string): MassVolume | undefined {
  const scored = masses.map((m) => ({ m, score: [...new Set(`${m.id} ${m.role} ${m.name}`.toLowerCase().split(/[^a-z0-9]+/))].filter((w) => w.length > 2 && !STOP_WORDS.has(w) && new RegExp(`\\b${w}\\b`).test(where)).length }));
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a), { m: undefined as MassVolume | undefined, score: 0 });
  return best.score > 0 ? best.m : pickDominantMass(masses);
}

/**
 * Candidates on a flat V2 roof, resolved against the compiled roof plane of the requested mass — never the legacy
 * single-house rectangle. The requested side fixes which edge band the object sits in; deterministic code may only
 * slide it along that band to clear an obstacle, never move it to another side or another roof.
 */
function roofCandidates(root: Record<string, unknown>, document: ArchitecturalDesignDocument, intent: ParsedIntent, dims: { width: number; depth: number; height: number }): { candidates: Candidate[]; label: string } | { code: "NO_FLAT_ROOF" | "DOES_NOT_FIT"; error: string } {
  const masses = resolveMasses(document);
  const mass = targetMass(masses, intent.where);
  if (!mass) return { code: "NO_FLAT_ROOF", error: "This V2 design has no building mass with a roof to place the object on." };
  const recipe = document.roofs.recipes.find((r) => r.massId === mass.id);
  const plane = compileArchitecture(document, { materials: materialsOf(root) }).model.primitives.find((p) => p.id === `architecture-${mass.id}-roof-plane`);
  if (!plane) return { code: "NO_FLAT_ROOF", error: `The ${mass.name} has a ${recipe?.kind ?? "pitched"} roof, so a standalone object cannot stand on it. Only flat V2 roofs can carry rooftop objects.` };
  const top = topTriangles(plane);
  const margin = .5 + (recipe?.parapet?.thickness ?? 0);
  const yaw = mass.rotation, half = { x: mass.width / 2 - margin, z: mass.depth / 2 - margin };
  const reach = { x: half.x - dims.width / 2, z: half.z - dims.depth / 2 };
  if (reach.x < 0 || reach.z < 0) return { code: "DOES_NOT_FIT", error: `A ${dims.width.toFixed(1)} × ${dims.depth.toFixed(1)} m object does not fit on the ${mass.name} roof (${mass.width.toFixed(1)} × ${mass.depth.toFixed(1)} m) with edge clearance.` };
  const vector = sideVector(intent.side, document.siteStrategy.arrivalDirection);
  const local = vector ? toLocal(vector, yaw) : undefined;
  const axis: "x" | "z" | undefined = local ? (Math.abs(local.x) >= Math.abs(local.z) ? "x" : "z") : undefined;
  const sign = local && axis ? Math.sign(local[axis]) || 1 : 0;
  const along: "x" | "z" = axis === "x" ? "z" : "x";
  const step = (along === "x" ? dims.width : dims.depth) + .6;
  const slides = [0, ...Array.from({ length: 6 }, (_, i) => (i % 2 ? -1 : 1) * Math.ceil((i + 1) / 2) * step)].filter((o) => Math.abs(o) <= reach[along] + 1e-9);
  const centre = { x: mass.position.x, z: mass.position.z };
  const candidates = slides.map((offset): Candidate => {
    const l = { x: 0, z: 0 };
    if (axis) l[axis] = sign * reach[axis];
    l[along] = offset;
    return {
      centre: toWorld(centre, l.x, l.z, yaw), yaw, supportY: top.y, support: { kind: "roof", elevation: top.y, massId: mass.id }, parentSpaceId: `v2-roof-${mass.id}`,
      intent: { surface: "roof", massId: mass.id, ...(intent.side ? { side: intent.side } : {}) },
    };
  }).filter((c) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(([sx, sz]) => {
    const q = toWorld(c.centre, sx * dims.width / 2, sz * dims.depth / 2, yaw);
    return top.tris.some((t) => inTriangle([q.x, q.z], t));
  }));
  // Another mass rising through the object's volume above this roof is a collision, not a place to stand.
  const blocked = (c: Candidate) => masses.some((m) => m.id !== mass.id && m.elevation < c.supportY + dims.height && m.elevation + massTotalHeight(m) > c.supportY + .05
    && overlap(aabb(c.centre, dims.width, dims.depth, yaw), aabb(m.position, m.width, m.depth, m.rotation), 0));
  return { candidates: candidates.filter((c) => !blocked(c)), label: `${intent.side && intent.side !== "center" ? `${intent.side} of the ` : ""}${mass.name} roof` };
}

/** Ground candidates beside the Site Plan's pool deck, limited to the requested side when one was named. */
function poolsideCandidates(root: Record<string, unknown>, document: ArchitecturalDesignDocument, intent: ParsedIntent, dims: { width: number; depth: number }): Candidate[] {
  const plan = v2SitePlanOf(root)!;
  const deck = plan.poolDeck;
  const offset = Math.max(dims.width, dims.depth) / 2 + 1;
  const anchors = [{ x: deck.x + deck.width / 2 + offset, z: deck.z, dir: { x: 1, z: 0 } }, { x: deck.x - deck.width / 2 - offset, z: deck.z, dir: { x: -1, z: 0 } }, { x: deck.x, z: deck.z + deck.depth / 2 + offset, dir: { x: 0, z: 1 } }, { x: deck.x, z: deck.z - deck.depth / 2 - offset, dir: { x: 0, z: -1 } }];
  const vector = sideVector(intent.side, document.siteStrategy.arrivalDirection);
  return anchors.filter((a) => !vector || a.dir.x * vector.x + a.dir.z * vector.z > .5).flatMap((a) => [0, 1, -1, 2, -2].map((k): Candidate => {
    const slide = k * (Math.max(dims.width, dims.depth) + .5);
    const centre = { x: a.x + (a.dir.x ? 0 : slide), z: a.z + (a.dir.z ? 0 : slide) };
    return { centre, yaw: Math.atan2(deck.x - centre.x, deck.z - centre.z), supportY: 0, support: { kind: "terrain", elevation: 0 }, parentSpaceId: "v2-poolside", intent: { surface: "poolside", ...(intent.side ? { side: intent.side } : {}) } };
  }));
}

/** Ground candidates inside a Site Plan garden/lawn area the request named. */
function gardenCandidates(root: Record<string, unknown>, intent: ParsedIntent, dims: { width: number; depth: number }): Candidate[] {
  const landscape = ((root.sitePlan as { landscape?: unknown } | undefined)?.landscape ?? []) as { kind?: string; x: number; z: number; width: number; depth: number }[];
  const kind = /\blawn\b/.test(intent.where) ? "lawn" : "garden";
  return (Array.isArray(landscape) ? landscape : []).filter((a) => a?.kind === kind && [a.x, a.z, a.width, a.depth].every(Number.isFinite)).flatMap((a) =>
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([sx, sz]) => ({ x: a.x + sx * (a.width - dims.width) / 4, z: a.z + sz * (a.depth - dims.depth) / 4 }))
      .filter((c) => Math.abs(c.x - a.x) + dims.width / 2 <= a.width / 2 + 1e-9 && Math.abs(c.z - a.z) + dims.depth / 2 <= a.depth / 2 + 1e-9)
      .map((centre): Candidate => ({ centre, yaw: 0, supportY: 0, support: { kind: "terrain", elevation: 0 }, parentSpaceId: `v2-${kind}`, intent: { surface: "garden" } })));
}

/**
 * Places a standalone object (approved GLB, else a procedural proxy) at the location the request named. The V2
 * document, Site Plan and every existing placement are carried through untouched; one or more placements are appended.
 */
export function placeStandaloneObject(root: Record<string, unknown>, prompt: string, object: StandaloneObject, assets: readonly CuratedAsset[], glbIds: readonly string[]): StandalonePlacementResult {
  const document = documentOf(root);
  const plan = v2SitePlanOf(root);
  if (!document || !plan) return { ok: false, code: "NO_VALID_SITE_PLAN", error: "This V2 project has no valid Site Plan, so I cannot safely anchor the requested object." };
  const spec = STANDALONE[object];
  const intent = parsePlacementIntent(prompt, object);
  if (intent.surface === "unresolved") return { ok: false, code: "UNSUPPORTED_LOCATION", error: `I can place a ${spec.label} on a flat V2 roof, beside the pool, or in a Site Plan garden or lawn, but not "${intent.where || intent.side}". Say which of those it should go on.` };

  const asset = standaloneAssetFor(object, assets, glbIds);
  const bounds = asset ? validBounds(asset) ?? proceduralBounds(intent.dimensions) : proceduralBounds(intent.dimensions);
  const size = sizeOf(bounds);
  let candidates: Candidate[], where: string;
  if (intent.surface === "roof") {
    const roof = roofCandidates(root, document, intent, size);
    if ("code" in roof) return { ok: false, code: roof.code, error: roof.error };
    ({ candidates } = roof); where = `on the ${roof.label}`;
  } else if (intent.surface === "garden") {
    candidates = gardenCandidates(root, intent, size); where = `in the ${/\blawn\b/.test(intent.where) ? "lawn" : "garden"}`;
    if (!candidates.length) return { ok: false, code: "DOES_NOT_FIT", error: `The Site Plan has no ${/\blawn\b/.test(intent.where) ? "lawn" : "garden"} area large enough for a ${spec.label}.` };
  } else {
    candidates = poolsideCandidates(root, document, intent, size); where = intent.side ? `on the ${intent.side} side of the pool` : "beside the pool";
  }

  const existing = Array.isArray(root.outdoorAssetPlacements) ? root.outdoorAssetPlacements as OutdoorAssetPlacement[] : [];
  const onRoof = intent.surface === "roof";
  // Ground objects keep clear of the building, the pool deck, Site Plan features and other ground assets; roof
  // objects keep clear of whatever else already stands on that roof.
  const obstacles: Rect[] = onRoof
    ? existing.filter((p) => p.support?.kind === "roof" && p.support.massId === candidates[0]?.support.massId).map(placementRect)
    : [
      ...(v2SiteFrame(root)?.masses ?? []).map((m) => aabb({ x: m.cx, z: m.cz }, m.width, m.depth, m.rotation)),
      { x: plan.poolDeck.x, z: plan.poolDeck.z, width: plan.poolDeck.width, depth: plan.poolDeck.depth },
      ...(plan.features ?? []).map((f) => ({ x: f.x, z: f.z, width: f.width, depth: f.depth })),
      ...existing.filter((p) => p.support?.kind !== "roof").map(placementRect),
    ];
  const additions: OutdoorAssetPlacement[] = [];
  for (let i = 0; i < Math.min(4, intent.count); i++) {
    const taken = [...obstacles, ...additions.map(placementRect)];
    const pick = candidates.find((c) => !taken.some((o) => overlap(aabb(c.centre, size.width, size.depth, c.yaw), o, onRoof ? .3 : .35)));
    if (!pick) return { ok: false, code: "ALL_CANDIDATES_COLLIDE", error: `No clear spot ${where} is large enough for ${additions.length ? "another" : "a"} ${spec.label}; nothing was moved elsewhere. Try another location or a smaller size.` };
    additions.push({
      id: `outdoor-v2-${crypto.randomUUID()}`,
      assetId: asset?.id ?? proceduralStandaloneAssetId(object),
      parentSpaceId: pick.parentSpaceId,
      category: spec.category,
      position: originForCentre(pick.centre, bounds, 1, pick.yaw, pick.supportY),
      rotation: [0, pick.yaw, 0], scale: 1, role: spec.component, dimensions: size, localBounds: bounds, support: pick.support,
      intent: { ...pick.intent, centre: pick.centre, yaw: pick.yaw, dimensions: intent.dimensions },
      ...(asset ? {} : { proxy: { shape: spec.shape, ...(spec.canopy ? { canopy: spec.canopy } : {}), objectType: object, label: spec.label, requestText: prompt.trim().slice(0, 200) } }),
    });
  }
  const contextTags = extractContextTags(prompt);
  const needRequest: Omit<AssetRequest, "projectId"> | undefined = asset ? undefined : {
    text: prompt.trim().slice(0, 200), category: spec.category, styleTags: extractStyleTags(prompt),
    contextTags: onRoof && !contextTags.includes("rooftop") ? [...contextTags, "rooftop"] : contextTags,
    dimensions: { ...intent.dimensions }, components: [spec.component], source: "follow-up-edit", proxyInUse: true, aliases: spec.aliases,
  };
  const noun = `${spec.label}${additions.length === 1 ? "" : "s"}`;
  return {
    ok: true, object, assetId: asset?.id ?? proceduralStandaloneAssetId(object), usedProceduralFallback: !asset, placementIds: additions.map((a) => a.id), needRequest,
    summary: asset
      ? `Added ${additions.length === 1 ? "a" : additions.length} grounded ${noun} ${where}.`
      : `Added ${additions.length === 1 ? "a" : additions.length} ${noun} ${where} as a simple stand-in; no approved ${spec.label} model exists yet, so it was requested for the library and will take this exact placement once approved.`,
    json: JSON.stringify({ ...root, outdoorAssetPlacements: [...existing, ...additions] }),
  };
}

// ── Replacement ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Swaps an approved GLB into a proxy's logical placement: same id, centre, yaw, support and intent. The model is
 * uniformly scaled to fit the intended footprint and grounded on the same support; only the asset changes.
 */
export function replaceProxyPlacement(placement: OutdoorAssetPlacement, asset: CuratedAsset): OutdoorAssetPlacement {
  if (!placement.proxy || !placement.intent) return placement;
  const bounds = validBounds(asset) ?? proceduralBounds(placement.intent.dimensions);
  const native = sizeOf(bounds);
  const scale = Math.min(placement.intent.dimensions.width / native.width, placement.intent.dimensions.depth / native.depth);
  const rest: OutdoorAssetPlacement = { ...placement };
  delete rest.proxy;
  return {
    ...rest, assetId: asset.id, scale, localBounds: bounds, dimensions: sizeOf(bounds, scale),
    position: originForCentre(placement.intent.centre, bounds, scale, placement.intent.yaw, placement.support?.elevation ?? 0),
    rotation: [0, placement.intent.yaw, 0],
  };
}

/** Every proxy placement whose object now has an approved GLB, substituted in place. Other placements are untouched. */
export function substituteApprovedProxies(root: Record<string, unknown>, assets: readonly CuratedAsset[], glbIds: readonly string[]): { json: string; replaced: string[] } {
  const placements = Array.isArray(root.outdoorAssetPlacements) ? root.outdoorAssetPlacements as OutdoorAssetPlacement[] : [];
  const replaced: string[] = [];
  const next = placements.map((p) => {
    const object = p.proxy?.objectType as StandaloneObject | undefined;
    const asset = object && STANDALONE[object] ? standaloneAssetFor(object, assets, glbIds) : undefined;
    if (!asset) return p;
    replaced.push(p.id);
    return replaceProxyPlacement(p, asset);
  });
  return { json: JSON.stringify({ ...root, outdoorAssetPlacements: next }), replaced };
}
