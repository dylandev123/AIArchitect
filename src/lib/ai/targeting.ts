import { FEATURE_LABEL, FEATURE_TYPES, type FeatureType } from "@/lib/house/features/featureTypes";
import type { BuildingKind, MaterialZone, RoomType, WallSide } from "@/types/house";

/**
 * How much of the project an edit may touch — always the smallest that fits.
 *  - world:     full initial/redesign generation (sees and may change everything)
 *  - zone:      a related group of parts (master suite, pool area, garage area…)
 *  - component: one thing (the rooms, the windows, the roof, the materials…)
 */
export type ScopeLevel = "world" | "zone" | "component";
export type ScopeKind = "house" | "materials" | "feature" | "zone" | "full" | "site";

/** Narrows which existing items of an editable type are shown to (and editable by) the model. */
export interface TargetFilter {
  /** Positions in the item's array (0-based). Used by UI actions that already know the item. */
  indices?: number[];
  walls?: WallSide[];
  roomTypes?: RoomType[];
  buildingKinds?: BuildingKind[];
  /** "villa 12" / "second bedroom": 0-based position among items of the named room type / building kind (else the array). */
  ordinals?: number[];
}

export interface EditScope {
  level: ScopeLevel;
  /** Coarse legacy discriminator kept for existing UI callers. */
  kind: ScopeKind;
  featureType?: FeatureType;
  label: string;
  /** Exact op names the model may emit. Never empty; nothing outside this list is ever applied. */
  allowedOps: string[];
  /** Feature arrays the model may add to / update / remove from. */
  featureTypes: FeatureType[];
  /** Editable `house` keys (empty = house shell not editable). */
  houseFields: string[];
  /** Editable material zones (empty = materials not editable). */
  materialZones: MaterialZone[];
  /** exteriorOptions editable. */
  exterior: boolean;
  /** The `site` environment block (environment / view / slope / approach) editable. */
  site: boolean;
  filter?: TargetFilter;
}

const ALL_MATERIAL_ZONES: MaterialZone[] = ["exterior", "roof", "trim", "decking"];
const HOUSE_SHELL_FIELDS = ["width", "depth", "floors", "roof"];

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function featureOpNames(t: FeatureType): string[] {
  const cap = capitalize(t);
  return [`add${cap}`, `update${cap}`, `remove${cap}`];
}

type Surface = Pick<EditScope, "featureTypes" | "houseFields" | "materialZones" | "exterior" | "site" | "filter">;
type SurfaceInput = Partial<Surface> & { featureType?: FeatureType };

/** The complete op allow-list implied by a scope's editable surface. */
function opsFor(s: Surface): string[] {
  return [
    ...(s.houseFields.length > 0 ? ["setHouse"] : []),
    ...(s.materialZones.length > 0 ? ["setMaterials"] : []),
    ...(s.exterior ? ["setExteriorOptions"] : []),
    ...(s.site ? ["setSite"] : []),
    ...s.featureTypes.flatMap(featureOpNames),
  ];
}

function makeScope(level: ScopeLevel, kind: ScopeKind, label: string, input: SurfaceInput): EditScope {
  const surface: Surface = {
    featureTypes: input.featureTypes ?? [],
    houseFields: input.houseFields ?? [],
    materialZones: input.materialZones ?? [],
    exterior: input.exterior ?? false,
    site: input.site ?? false,
    filter: input.filter,
  };
  return { level, kind, label, featureType: input.featureType, ...surface, allowedOps: opsFor(surface) };
}

export const WORLD_SCOPE: EditScope = makeScope("world", "full", "Whole project", {
  featureTypes: [...FEATURE_TYPES],
  houseFields: HOUSE_SHELL_FIELDS,
  materialZones: ALL_MATERIAL_ZONES,
  exterior: true,
  site: true,
});

export function makeScopeForFeature(featureType: FeatureType, index?: number): EditScope {
  return makeScope("component", "feature", FEATURE_LABEL[featureType], {
    featureType,
    featureTypes: [featureType],
    filter: index !== undefined ? { indices: [index] } : undefined,
  });
}

// ── Rules ───────────────────────────────────────────────────────────────────

interface Rule {
  level: "zone" | "component";
  label: string;
  pattern: RegExp;
  surface: SurfaceInput;
  kind?: ScopeKind;
  /** Vague modifiers ("bigger", "wider") that only count when nothing more specific is named. */
  weak?: boolean;
}

const RULES: Rule[] = [
  // ── zones: a named group; outranks any component it fully contains ──
  { level: "zone", label: "Master suite", pattern: /\b(master|primary|main)\s+(suite|bedroom|bath(room)?)\b|\ben-?suite\b/i,
    surface: { featureTypes: ["room", "balcony"], filter: { roomTypes: ["bedroom", "bathroom"] } } },
  { level: "zone", label: "Pool area", pattern: /\bpool\s*(area|deck|zone|surround|side)\b|\bpoolside\b/i,
    surface: { featureTypes: ["pool", "patio", "deck"], materialZones: ["decking"], exterior: true } },
  { level: "zone", label: "Garage area", pattern: /\b(garage|carport)\s+(area|zone|side)\b/i,
    surface: { featureTypes: ["garage", "driveway", "parking"] } },
  { level: "zone", label: "Outdoor living", pattern: /\b(outdoor\s+(living|area|space|entertaining)|backyard|back\s+yard|entertaining\s+area)\b/i,
    surface: { featureTypes: ["patio", "deck", "pool", "landscape", "balcony"], materialZones: ["decking"], exterior: true } },
  { level: "zone", label: "Facade", pattern: /\b(fa[cç]ade|elevation|curb\s+appeal)\b/i,
    surface: { featureTypes: ["window", "door"], materialZones: ["exterior", "trim"], exterior: true } },
  { level: "zone", label: "Interior", pattern: /\b(interior|floor\s*plan|all\s+(the\s+)?rooms)\b/i,
    surface: { featureTypes: ["room"] } },
  { level: "zone", label: "Site layout", pattern: /\b(site\s+(plan|layout)|master\s*plan|resort\s+layout)\b/i,
    surface: { featureTypes: ["building", "road", "parking", "landscape", "pool"] } },

  // ── components: exactly one thing ──
  { level: "component", label: "Garage", pattern: /\b(garages?|carports?|car\s+ports?)\b/i, surface: { featureType: "garage", featureTypes: ["garage"] } },
  { level: "component", label: "Windows", pattern: /\b(windows?|glazing|fenestration)\b/i, surface: { featureType: "window", featureTypes: ["window"] } },
  { level: "component", label: "Doors", pattern: /\b(doors?|entrance|entryway)\b/i, surface: { featureType: "door", featureTypes: ["door"] } },
  { level: "component", label: "Pool", pattern: /\b(pools?|swimming\s+pool|infinity\s+pool)\b/i, surface: { featureType: "pool", featureTypes: ["pool"] } },
  { level: "component", label: "Patio", pattern: /\b(patios?|(?<!rooftop\s)(?<!roof\s)terraces?)\b/i, surface: { featureType: "patio", featureTypes: ["patio"] } },
  { level: "component", label: "Balcony", pattern: /\b(balcon(y|ies))\b/i, surface: { featureType: "balcony", featureTypes: ["balcony"] } },
  { level: "component", label: "Deck", pattern: /\b(decks?|rooftop|roof\s+(terrace|deck))\b/i, surface: { featureType: "deck", featureTypes: ["deck"] } },
  { level: "component", label: "Driveway", pattern: /\bdriveways?\b/i, surface: { featureType: "driveway", featureTypes: ["driveway"] } },
  { level: "component", label: "Rooms", pattern: /\b(bedrooms?|bathrooms?|kitchens?|living\s+rooms?|dining|offices?|hallways?|laundry|gym|rooms?)\b/i,
    surface: { featureType: "room", featureTypes: ["room"] } },
  { level: "component", label: "Landscaping", pattern: /\b(gardens?|lawns?|landscap\w*|trees?|plants?|shrubs?)\b/i, surface: { featureType: "landscape", featureTypes: ["landscape"] } },
  { level: "component", label: "Buildings", pattern: /\b(villas?|resort|hotel|restaurants?|reception|gazebos?|bar)\b/i, surface: { featureType: "building", featureTypes: ["building"] } },
  { level: "component", label: "Roads", pattern: /\b(roads?|streets?|paths?)\b/i, surface: { featureType: "road", featureTypes: ["road"] } },
  { level: "component", label: "Parking", pattern: /\b(parking|car\s+park)\b/i, surface: { featureType: "parking", featureTypes: ["parking"] } },
  { level: "component", label: "Site setting", kind: "site",
    pattern: /\b(beach|seaside|oceanfront|cliff|hillside|countryside|farmland|forest|woodland|suburb\w*|urban|city|slope[ds]?|steep|terrain|view\s+direction|sunrise|sunset|(?:facing|faces|view\s+(?:to|toward|towards))\s+(?:the\s+)?(?:north|east|south|west|sunrise|sunset|ocean|sea)|entrance\s+(?:from|on)|approach\s+(?:from|side))\b/i,
    surface: { site: true } },
  { level: "component", label: "Roof", kind: "house",
    pattern: /\b(roof(ing|line)?|ridge|gable|hip(ped)?|mansard|sawtooth|butterfly|shed\s+roof|flat\s+roof)\b/i,
    surface: { houseFields: ["roof"], materialZones: ["roof"] } },
  { level: "component", label: "Exterior style", kind: "materials",
    pattern: /\b(style|cladding|wall\s+finish|window\s+style|door\s+style|railings?|columns?|pilasters?|pavers?|surface)\b/i,
    surface: { exterior: true } },
  { level: "component", label: "Materials", kind: "materials",
    pattern: /\b(materials?|paint|stucco|concrete|stone|wood|metal|tile|brick|timber|cedar|slate|copper|marble|zinc|corten|terracotta|render|textures?|colou?rs?|decking)\b/i,
    surface: { materialZones: ALL_MATERIAL_ZONES } },
  { level: "component", label: "House structure", kind: "house",
    pattern: /\b(floors?|storey|storeys|stories|footprint)\b/i,
    surface: { houseFields: ["width", "depth", "floors"] } },
  { level: "component", label: "House structure", kind: "house", weak: true,
    pattern: /\b(width|depth|bigger|larger|wider|longer|taller|smaller)\b/i,
    surface: { houseFields: ["width", "depth", "floors"] } },
];

/** Prompts that ask for (re)generation of the whole site rather than an edit of parts. */
const WORLD_INTENT =
  /\b(from\s+scratch|start\s+over|redesign|entire\s+(house|site|project|property)|whole\s+(house|site|project|property)|(design|build|create|generate)\s+(me\s+)?an?\s+\w+(\s+\w+)?\s+(resort|estate|compound|campus)|\d{2,}\s+(villas|buildings|bungalows|cabins))\b/i;

/** A union of this many feature arrays is no longer a "related group" — escalate to world. */
const MAX_ZONE_FEATURE_TYPES = 6;

// ── Target filters derived from the prompt ──────────────────────────────────

const WALL_WORDS: [RegExp, WallSide][] = [
  [/\bnorth(ern)?\b/i, "north"], [/\bsouth(ern)?\b/i, "south"], [/\beast(ern)?\b/i, "east"], [/\bwest(ern)?\b/i, "west"],
];
const ROOM_WORDS: [RegExp, RoomType][] = [
  [/\bbedrooms?\b/i, "bedroom"], [/\bbathrooms?\b/i, "bathroom"], [/\bkitchens?\b/i, "kitchen"], [/\bliving(\s+rooms?)?\b/i, "living"],
  [/\bdining\b/i, "dining"], [/\boffices?\b/i, "office"], [/\bhallways?\b/i, "hallway"], [/\blaundry\b/i, "laundry"], [/\bgym\b/i, "gym"],
];
const BUILDING_WORDS: [RegExp, BuildingKind][] = [
  [/\bvillas?\b/i, "villa"], [/\brestaurants?\b/i, "restaurant"], [/\breception\b/i, "reception"], [/\bgazebos?\b/i, "gazebo"], [/\bbar\b/i, "outdoor_bar"],
];
const ORDINAL_WORDS: Record<string, number> = {
  first: 0, second: 1, third: 2, fourth: 3, fifth: 4, sixth: 5, seventh: 6, eighth: 7, ninth: 8, tenth: 9,
};
const TARGET_NOUN =
  "villa|window|door|garage|balcon(?:y|ie)|patio|pool|driveway|room|bedroom|bathroom|kitchen|building|road|parking|deck|restaurant|gazebo|garden|lawn";

/** "villa 12", "bedroom #2", "the third window" → 0-based ordinals. Floor/level phrases are ignored. */
function parseOrdinals(prompt: string): number[] {
  const text = prompt.replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(floor|storey|story|level)s?\b/gi, "");
  const out = new Set<number>();
  for (const m of text.matchAll(new RegExp(`\\b(?:${TARGET_NOUN})s?\\s*#?(\\d{1,3})\\b`, "gi"))) {
    const n = Number(m[1]);
    if (n >= 1) out.add(n - 1);
  }
  for (const m of text.matchAll(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/gi)) {
    out.add(ORDINAL_WORDS[m[1].toLowerCase()]);
  }
  return [...out];
}

/** Room types the prompt names ("kitchen", "second bedroom"…), for pulling in relevant rooms as context. */
export function mentionedRoomTypes(prompt: string): RoomType[] {
  return ROOM_WORDS.filter(([re]) => re.test(prompt)).map(([, t]) => t);
}

function deriveFilter(prompt: string, featureTypes: readonly FeatureType[], base?: TargetFilter): TargetFilter | undefined {
  const filter: TargetFilter = { ...base };
  const wallMounted = featureTypes.some((t) => ["window", "door", "garage", "balcony", "patio", "pool", "driveway"].includes(t));
  if (wallMounted && !filter.walls) {
    const walls = WALL_WORDS.filter(([re]) => re.test(prompt)).map(([, w]) => w);
    if (walls.length > 0 && walls.length < 4) filter.walls = walls;
  }
  if (featureTypes.includes("room") && !filter.roomTypes) {
    const types = mentionedRoomTypes(prompt);
    if (types.length > 0) filter.roomTypes = types;
  }
  if (featureTypes.includes("building") && !filter.buildingKinds) {
    const kinds = BUILDING_WORDS.filter(([re]) => re.test(prompt)).map(([, k]) => k);
    if (kinds.length > 0) filter.buildingKinds = kinds;
  }
  if (featureTypes.length === 1 && !filter.ordinals) {
    const ordinals = parseOrdinals(prompt);
    if (ordinals.length > 0) filter.ordinals = ordinals;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

// ── Classification ──────────────────────────────────────────────────────────

function mergeSurface(rules: Rule[]): Surface {
  const featureTypes = new Set<FeatureType>();
  const houseFields = new Set<string>();
  const zones = new Set<MaterialZone>();
  let exterior = false;
  let site = false;
  let filter: TargetFilter | undefined;
  for (const { surface } of rules) {
    surface.featureTypes?.forEach((t) => featureTypes.add(t));
    surface.houseFields?.forEach((f) => houseFields.add(f));
    surface.materialZones?.forEach((z) => zones.add(z));
    exterior ||= surface.exterior ?? false;
    site ||= surface.site ?? false;
    filter ??= surface.filter; // only a single-rule (zone) hit carries a base filter
  }
  return { featureTypes: [...featureTypes], houseFields: [...houseFields], materialZones: [...zones], exterior, site, filter };
}

/** True when every part of `inner` is already editable in `outer`. */
function covers(outer: Surface, inner: Surface): boolean {
  return (
    inner.featureTypes.every((t) => outer.featureTypes.includes(t)) &&
    inner.houseFields.every((f) => outer.houseFields.includes(f)) &&
    inner.materialZones.every((z) => outer.materialZones.includes(z)) &&
    (!inner.exterior || outer.exterior) &&
    (!inner.site || outer.site)
  );
}

/**
 * Picks the smallest valid scope for a prompt: one component if exactly one part is
 * named, a zone when a named group (or a small union of parts) covers it, and the
 * world only for explicit regeneration or when nothing specific is named.
 */
export function classifyPromptTarget(prompt: string): EditScope {
  if (WORLD_INTENT.test(prompt)) return WORLD_SCOPE;

  let hits = RULES.filter((r) => r.pattern.test(prompt));
  if (hits.some((h) => !h.weak)) hits = hits.filter((h) => !h.weak);
  if (hits.length === 0) return WORLD_SCOPE;

  // A component wholly inside a named zone is redundant (e.g. "pool" inside Pool area).
  const surfaces = new Map(hits.map((h) => [h, mergeSurface([h])] as const));
  hits = hits.filter(
    (h) => !hits.some((o) => o !== h && o.level === "zone" && covers(surfaces.get(o)!, surfaces.get(h)!))
  );

  if (hits.length === 1) {
    const [only] = hits;
    const surface = mergeSurface([only]);
    return makeScope(only.level, only.kind ?? (only.level === "zone" ? "zone" : "feature"), only.label, {
      ...surface,
      filter: deriveFilter(prompt, surface.featureTypes, surface.filter),
      featureType: only.surface.featureType,
    });
  }

  const merged = mergeSurface(hits);
  if (merged.featureTypes.length >= MAX_ZONE_FEATURE_TYPES) return WORLD_SCOPE;
  return makeScope("zone", "zone", [...new Set(hits.map((h) => h.label))].join(" + "), { ...merged, filter: undefined });
}

/**
 * Rebuilds a scope from an untrusted client hint. Only the *identity* of the target
 * (feature type / indices / "house" / "world") is honoured; the op allow-list is always
 * recomputed here, so a client can escalate cost but never smuggle in ops.
 */
export function scopeFromHint(hint: unknown, prompt: string): EditScope {
  const h = typeof hint === "object" && hint !== null ? (hint as Record<string, unknown>) : {};
  if (h.level === "world") return WORLD_SCOPE;

  const featureType = FEATURE_TYPES.find((t) => t === h.featureType);
  if (h.kind === "feature" && featureType) {
    const rawFilter = typeof h.filter === "object" && h.filter !== null ? (h.filter as Record<string, unknown>) : {};
    const indices = Array.isArray(rawFilter.indices)
      ? rawFilter.indices.filter((n): n is number => Number.isInteger(n) && n >= 0).slice(0, 50)
      : [];
    return {
      ...makeScopeForFeature(featureType),
      filter: indices.length > 0 ? { indices } : deriveFilter(prompt, [featureType]),
    };
  }
  if (h.kind === "house") {
    return makeScope("component", "house", "House", { houseFields: HOUSE_SHELL_FIELDS, materialZones: ALL_MATERIAL_ZONES });
  }
  return classifyPromptTarget(prompt);
}

// ── Op validation ───────────────────────────────────────────────────────────

/** Minimal op view needed to validate an op against a scope. */
export interface ScopedOp {
  op: string;
  id?: string;
  fields?: Record<string, unknown>;
}

/** Ids the model may update/remove, per feature type. */
export type TargetIds = Partial<Record<FeatureType, ReadonlySet<string>>>;

/**
 * Splits model output into ops that may run and reasons for the rest. An op runs only if
 * its name is in the scope allow-list, it touches only fields the scope may change, and
 * (for update/remove) its id is one of the targets shown to the model. There is deliberately
 * no fallback: rejected ops are never applied.
 */
export function partitionOpsForScope<T extends ScopedOp>(
  ops: readonly T[],
  scope: EditScope,
  targetIds: TargetIds
): { allowed: T[]; rejected: string[] } {
  const allowed: T[] = [];
  const rejected: string[] = [];

  for (const op of ops) {
    if (!scope.allowedOps.includes(op.op)) {
      rejected.push(`"${op.op}" is out of scope for "${scope.label}"`);
      continue;
    }
    if (op.op === "setHouse") {
      const bad = Object.keys(op.fields ?? {}).filter((k) => !scope.houseFields.includes(k));
      if (bad.length > 0) { rejected.push(`setHouse may not change ${bad.join(", ")} in "${scope.label}"`); continue; }
    } else if (op.op === "setMaterials") {
      const bad = Object.keys(op.fields ?? {}).filter((k) => !scope.materialZones.includes(k as MaterialZone));
      if (bad.length > 0) { rejected.push(`setMaterials may not change zone ${bad.join(", ")} in "${scope.label}"`); continue; }
    } else {
      const match = /^(update|remove)([A-Za-z]+)$/.exec(op.op);
      if (match) {
        const type = FEATURE_TYPES.find((t) => capitalize(t) === match[2]);
        if (!type || typeof op.id !== "string" || !targetIds[type]?.has(op.id)) {
          rejected.push(`"${op.op}" targets an id that was not offered as an editable target`);
          continue;
        }
      }
    }
    allowed.push(op);
  }
  return { allowed, rejected };
}
