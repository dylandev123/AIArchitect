import { v3CompositionSchema } from "./composition";
import type { V3GenerationNote } from "./generation";
import { v3NaturalGroundHeight } from "./grading";
import type { V3Scene } from "./scene";

/**
 * Provider-shape canonicalization. Runs on the raw parsed provider object before
 * `normalizeV3GenerationOutput` and only *relocates or re-expresses* intent that
 * Terra already authored in a non-canonical place or vocabulary. It never invents
 * semantic intent: geometry it derives (site extent, level regions) comes solely
 * from authored coordinates, and anything it cannot express is reported, not guessed.
 */
type Rec = Record<string, unknown>;
const isRecord = (value: unknown): value is Rec => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value.trim() : undefined;
const num = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};
const point = (value: unknown): [number, number] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const values = value.map(num);
  if (values.some((item) => item === undefined)) return undefined;
  return values.length === 3 ? [values[0]!, values[2]!] : values.length === 2 ? [values[0]!, values[1]!] : undefined;
};

/** Building-mass design intent the compiler reads from `object.composition`. */
const COMPOSITION_INTENT_KEYS = ["footprint","spaceHeight","massHierarchy", "facadeRoles", "roofDatumGroup", "mainEntry"] as const;
/** Object-level intent the compiler reads from the object itself. */
const OBJECT_INTENT_KEYS = ["levels", "roofForm", "overhang", "pitch", "pitchUnit", "facadePreset", "facadeNorth", "facadeEast", "facadeSouth", "facadeWest", "composition"] as const;
const CARDINAL_FALL: Record<string, string> = { north: "-z", south: "z", east: "x", west: "-x", "+z": "z", "+x": "x" };
const ROOF_FORM_WORDS: [RegExp, string][] = [[/gable/i, "gable"], [/\bhip/i, "hip"], [/mono|shed|skillion|single[- ]pitch/i, "mono-pitch"], [/floating|cantilever/i, "floating-flat"], [/roof[- ]?terrace|roof garden|accessible roof/i, "terrace"], [/flat|parapet|deck roof/i, "flat"]];
const COLLISION_CLASS: [RegExp, string][] = [[/water|pool/i, "water"], [/landscape|planting|garden|grass|passable/i, "passable"], [/walk|surface|vehicle|pedestrian|stair|ramp|terrace|deck/i, "walkable"], [/building|roof|wall|solid|structure/i, "solid"], [/none|decor/i, "none"]];
/** Ordered by how a designer names a finish; the earliest keyword in the description is the primary finish. */
const MATERIAL_WORDS: [RegExp, { surface: string; color: string; dark?: string; pale?: string }][] = [
  [/water|mosaic|pool/i, { surface: "water", color: "#2d788a" }],
  [/glass|glaz/i, { surface: "glass", color: "#3b4a52" }],
  [/teak|wood|timber|cedar|oak|walnut/i, { surface: "wood", color: "#8a5a3b", dark: "#5c3d2a", pale: "#b48a62" }],
  [/limestone|sandstone|travertine|marble|stone|basalt|granite|slate/i, { surface: "stone", color: "#a89e8d", dark: "#4a4744", pale: "#d6ccb8" }],
  [/concrete|cement/i, { surface: "concrete", color: "#9e9a92", dark: "#58534c", pale: "#c9c3b8" }],
  [/plant|grass|lawn|garden|shrub|palm|meadow|mulch|native/i, { surface: "grass", color: "#587048", dark: "#3f5b38" }],
  [/stucco|plaster|render|lime wash/i, { surface: "stucco", color: "#e6dfd2", dark: "#8f877b" }],
  [/bronze|steel|metal|zinc|copper|alumin/i, { surface: "metal", color: "#5a4a3a", pale: "#9a9a96" }],
  [/pav|tile|brick|cobble/i, { surface: "paving", color: "#a08f7c", dark: "#5f554b", pale: "#cbbfae" }],
];

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "material";

/** A designer's finish description → a deterministic preview material. The description is kept as the material id. */
export function materialFromDescription(description: string): Rec {
  const lower = description.toLowerCase();
  const match = MATERIAL_WORDS.map(([pattern, finish]) => ({ index: lower.search(pattern), finish })).filter((entry) => entry.index >= 0).sort((a, b) => a.index - b.index)[0]?.finish;
  // Tone belongs to the clause naming the primary finish ("pale limestone, dark bronze glazing" is pale).
  const clause = (match ? lower.split(/,|;|\band\b|\bwith\b/).find((part) => MATERIAL_WORDS.find(([, finish]) => finish === match)![0].test(part)) : undefined) ?? lower;
  const tone = /charcoal|dark|black|basalt|graphite/.test(clause) ? "dark" : /pale|sand|white|light|bleached|limestone/.test(clause) ? "pale" : undefined;
  const color = match ? (tone === "dark" ? match.dark : tone === "pale" ? match.pale : undefined) ?? match.color : "#b8b0a2";
  return { id: slug(description), color, ...(match ? { surface: match.surface } : {}) };
}

/** Provider names for walkable floor-level glazing. Ordinary windows are never promoted to doors. */
const GLAZED_DOOR_ALIASES: Record<string, "hinged" | "sliding"> = { "glazed-door": "hinged", "glass-door": "hinged", "french-door": "hinged", "french-doors": "hinged", "sliding-door": "sliding", "sliding-doors": "sliding", "sliding-door-wall": "sliding", "door-wall": "sliding", "glass-slider": "sliding" };
function salvageComposition(raw: Rec, id: string, notes: V3GenerationNote[]): Rec | undefined {
  const out: Rec = {};
  if(raw.spaceHeight!==undefined)out.spaceHeight=raw.spaceHeight;
  if (raw.footprint !== undefined) {
    if (v3CompositionSchema.safeParse({footprint:raw.footprint}).success) out.footprint = raw.footprint;
    else if(raw.footprint!==undefined){out.footprint=raw.footprint;notes.push({code:'FOOTPRINT_INVALID',targetId:id,message:`${id} malformed outline retained for rejection; no rectangular substitute is permitted.`});}
    else notes.push({code:'FOOTPRINT_INVALID',targetId:id,message:`${id} malformed footprint omitted; rectangular fallback retained.`});
  }
  const massHierarchy = text(raw.massHierarchy)?.toLowerCase();
  if (massHierarchy && ["primary", "secondary", "connector"].includes(massHierarchy)) out.massHierarchy = massHierarchy;
  else if (raw.massHierarchy !== undefined) notes.push({ code: "COMPOSITION_ENTRY_OMITTED", targetId: id, message: `${id} massHierarchy "${String(raw.massHierarchy)}" is not primary/secondary/connector and was omitted.` });
  if (isRecord(raw.facadeRoles)) {
    const roles = Object.fromEntries(["north", "east", "south", "west"].flatMap((facade) => {
      const role = text(raw.facadeRoles && (raw.facadeRoles as Rec)[facade])?.toLowerCase();
      return role && ["arrival", "view", "private", "service"].includes(role) ? [[facade, role]] : [];
    }));
    if (Object.keys(roles).length) out.facadeRoles = roles;
  }
  if (text(raw.roofDatumGroup)) out.roofDatumGroup = text(raw.roofDatumGroup)!.slice(0, 64);
  // Provider vocabulary drift on otherwise-valid entries: descriptive frame finishes and stray keys.
  const openings = (Array.isArray(raw.openings) ? raw.openings : []).filter(isRecord).map((opening): Rec => {
    const { frame, ...rest } = opening;
    const alias = GLAZED_DOOR_ALIASES[String(rest.type ?? "").toLowerCase().replace(/[\s_]+/g, "-")];
    // A glazed door has no structural surround; the descriptive finish is dropped rather than inventing one.
    if (alias) return { ...rest, type: "glazed-door", ...(alias === "sliding" && rest.operation === undefined ? { operation: "sliding" } : {}) };
    return { ...rest, ...(frame === undefined ? {} : { frame: typeof frame === "boolean" ? frame : !!text(frame) }) };
  });
  const mainEntry = isRecord(raw.mainEntry) ? raw.mainEntry : undefined;
  const entryId = text(mainEntry?.openingId);
  const keptOpenings: Rec[] = [];
  for (const opening of openings) {
    // A door named as the main entry is a ground-floor door by definition.
    const candidate = opening.type === "door" && opening.id === entryId && opening.floors === undefined ? { ...opening, floors: "ground" } : opening;
    if (v3CompositionSchema.safeParse({ openings: [candidate] }).success) keptOpenings.push(candidate);
    else {keptOpenings.push(candidate);notes.push({code:"INVALID_COMPOSITION_ENTRY",targetId:id,message:`${id} opening ${String(opening.id??"(unnamed)")} is invalid and retained for correction.`});}
  }
  // An empty openings list means "every facade solid"; when nothing authored survives, fall back to facade presets instead.
  if (keptOpenings.length) out.openings = keptOpenings;
  else if (Array.isArray(raw.openings) && raw.openings.length) notes.push({ code: "COMPOSITION_FALLBACK", targetId: id, message: `${id} had no usable openings; facade preset openings are used.` });
  else if (Array.isArray(raw.openings)) out.openings = [];
  const keptAssemblies: Rec[] = [];
  for (const assembly of (Array.isArray(raw.assemblies) ? raw.assemblies : []).filter(isRecord)) {
    const candidate = { id: assembly.id, intent: text(assembly.intent) ?? String(assembly.id ?? "assembly"), parts: Array.isArray(assembly.parts) ? assembly.parts : [] };
    if (v3CompositionSchema.safeParse({ assemblies: [candidate] }).success) keptAssemblies.push(candidate);
    else {keptAssemblies.push(candidate);notes.push({code:"INVALID_COMPOSITION_ENTRY",targetId:id,message:`${id} assembly ${String(assembly.id??"(unnamed)")} is invalid and retained for correction.`});}
  }
  if (keptAssemblies.length || Array.isArray(raw.assemblies)) out.assemblies = keptAssemblies;
  if (mainEntry && entryId) {
    const canopyDepth = Math.min(6, Math.max(.1, num(mainEntry.canopyDepth) ?? 2.4));
    const color = typeof mainEntry.color === "string" && /^#[0-9a-fA-F]{6}$/.test(mainEntry.color) ? mainEntry.color : undefined;
    const entry = { openingId: entryId, canopyDepth, ...(color ? { color } : {}) };
    if (v3CompositionSchema.safeParse({ ...out, mainEntry: entry }).success) out.mainEntry = entry;
    else {out.mainEntry=entry;notes.push({code:"INVALID_COMPOSITION_ENTRY",targetId:id,message:`${id} mainEntry ${entryId} is retained for validation against its authored door.`});}
  }
  if (!Object.keys(out).length) return undefined;
  const parsed = v3CompositionSchema.safeParse(out);
  if (parsed.success || (out.footprint!==undefined)) return out;
  notes.push({ code: "COMPOSITION_FALLBACK", targetId: id, message: `${id} composition remained inconsistent after per-entry salvage (${parsed.error.issues[0]?.message ?? "invalid"}); facade presets are used.` });
  return out;
}

function canonicalizeObject(raw: unknown, sceneMainEntry: Rec | undefined, notes: V3GenerationNote[]): unknown {
  if (!isRecord(raw)) return raw;
  const object: Rec = { ...raw }, id = text(raw.id) ?? "(unknown)";
  const architecture = isRecord(raw.architecture) ? { ...raw.architecture } : undefined;
  const relocated: string[] = [];
  // 1. Object intent nested inside the named geometry belongs on the object.
  if (architecture) {
    for (const key of OBJECT_INTENT_KEYS) if (architecture[key] !== undefined) {
      if (object[key] === undefined) { object[key] = architecture[key]; relocated.push(key); }
      delete architecture[key];
    }
    for (const key of COMPOSITION_INTENT_KEYS) if (architecture[key] !== undefined) {
      if (object[key] === undefined) { object[key] = architecture[key]; relocated.push(key); }
      delete architecture[key];
    }
    object.architecture = architecture;
  }
  // 2. Composition intent authored on the object belongs inside composition.
  const compositionSource: Rec = isRecord(object.composition) ? { ...object.composition } : {};
  for (const key of COMPOSITION_INTENT_KEYS) if (object[key] !== undefined) {
    if (compositionSource[key] === undefined) { compositionSource[key] = object[key]; if (!relocated.includes(key)) relocated.push(key); }
    delete object[key];
  }
  const ownsSceneEntry = sceneMainEntry && Array.isArray(compositionSource.openings) && compositionSource.openings.some((opening) => isRecord(opening) && opening.id === sceneMainEntry.openingId);
  if (ownsSceneEntry && compositionSource.mainEntry === undefined) { compositionSource.mainEntry = sceneMainEntry; relocated.push("mainEntry"); }
  if (relocated.length) notes.push({ code: "INTENT_RELOCATED", targetId: id, message: `${id} ${relocated.join(", ")} moved to the canonical object/composition fields.` });
  if (Object.keys(compositionSource).length) {
    const salvaged = salvageComposition(compositionSource, id, notes);
    if (salvaged) object.composition = salvaged; else delete object.composition;
  }
  // 3. Descriptive vocabularies.
  const roofForm = text(object.roofForm);
  if (roofForm && !["flat", "floating-flat", "mono-pitch", "hip", "gable", "terrace"].includes(roofForm)) {
    const mapped = /butterfly|mansard|gambrel|sawtooth|barrel|dome|hyperbolic/i.test(roofForm) ? undefined : ROOF_FORM_WORDS.find(([pattern]) => pattern.test(roofForm))?.[1];
    if (mapped) { object.roofForm = mapped; notes.push({ code: "VOCABULARY_MAPPED", targetId: id, message: `${id} roofForm "${roofForm}" was read as ${mapped}.` }); }
  }
  if (typeof object.material === "string" && text(object.material)) {
    object.material = materialFromDescription(object.material);
    notes.push({ code: "VOCABULARY_MAPPED", targetId: id, message: `${id} material description was expressed as a deterministic ${(object.material as Rec).surface ?? "neutral"} preview finish.` });
  }
  const collisionClass = text(object.collisionClass);
  if (collisionClass && object.collision === undefined) {
    const mapped = ["solid", "walkable", "passable", "water", "none"].includes(collisionClass) ? collisionClass : COLLISION_CLASS.find(([pattern]) => pattern.test(collisionClass))?.[1];
    if (mapped) object.collision = mapped;
  }
  delete object.collisionClass;
  return object;
}

/** Bounds of every authored plan coordinate, used only when the site extent itself was not authored. */
function authoredExtent(raw: Rec): number[] {
  const xs: number[] = [], zs: number[] = [];
  const add = (x: number, z: number) => { xs.push(Math.abs(x)); zs.push(Math.abs(z)); };
  for (const object of Array.isArray(raw.objects) ? raw.objects.filter(isRecord) : []) {
    const a = isRecord(object.architecture) ? object.architecture : undefined;
    if (a && num(a.x) !== undefined && num(a.z) !== undefined) {
      add(num(a.x)! + (num(a.width) ?? 0) / 2, num(a.z)! + (num(a.depth) ?? 0) / 2);
      add(num(a.x)! - (num(a.width) ?? 0) / 2, num(a.z)! - (num(a.depth) ?? 0) / 2);
    }
    const p = isRecord(object.transform) ? point(object.transform.position) : undefined;
    if (p) add(p[0], p[1]);
  }
  const hierarchy = isRecord(raw.siteHierarchy) ? raw.siteHierarchy : undefined;
  for (const connection of Array.isArray(hierarchy?.connections) ? hierarchy.connections.filter(isRecord) : []) for (const p of Array.isArray(connection.route) ? connection.route : []) { const xz = point(p); if (xz) add(xz[0], xz[1]); }
  return [xs.length ? Math.max(...xs) : 0, zs.length ? Math.max(...zs) : 0];
}

function canonicalizeSite(raw: Rec, notes: V3GenerationNote[]) {
  if (!isRecord(raw.site)) return;
  const site: Rec = { ...raw.site };
  // Only an absent extent is derived; a malformed authored extent remains a fatal validation error.
  if (site.width === undefined || site.depth === undefined) {
    const boundary = Array.isArray(site.boundary) ? site.boundary.map(point).filter((item): item is [number, number] => !!item) : [];
    // The runtime site is origin-centred: take the symmetric extent so every authored boundary vertex stays inside.
    const [halfX, halfZ] = boundary.length >= 3 ? [Math.max(...boundary.map(([x]) => Math.abs(x))), Math.max(...boundary.map(([, z]) => Math.abs(z)))] : authoredExtent(raw).map((value) => value + 8);
    if (halfX > 0 && halfZ > 0) {
      if (site.width === undefined) site.width = Math.ceil(halfX * 2);
      if (site.depth === undefined) site.depth = Math.ceil(halfZ * 2);
      notes.push({ code: "SITE_EXTENT_DERIVED", targetId: "site", message: `Site extent ${site.width}×${site.depth}m was derived from the authored ${boundary.length >= 3 ? "boundary" : "object and route coordinates"}.` });
    }
  }
  const fall = text(site.naturalFall)?.toLowerCase();
  if (fall && CARDINAL_FALL[fall]) { site.naturalFall = CARDINAL_FALL[fall]; notes.push({ code: "VOCABULARY_MAPPED", targetId: "site", message: `naturalFall "${fall}" was read as downhill axis ${site.naturalFall}.` }); }
  raw.site = site;
}

const REGION_KEYS = ["x", "z", "width", "depth"] as const;
const validRegion = (region: unknown) => isRecord(region) && REGION_KEYS.every((key) => num(region[key]) !== undefined) && num(region.width)! > 0 && num(region.depth)! > 0;
const BEARING_TYPES = new Set(["terrace", "building-mass", "slab", "deck", "pool-deck", "courtyard", "landscape-zone", "pad", "surface", "volume"]);
const CONNECTION_TYPES = new Set(["driveway", "path", "stair", "ramp"]);
const SUPPORT_TYPES = new Set(["terrain", "pad", "terrace", "slab", "deck", "roof", "object"]);

/**
 * Completes the hierarchy's deterministic geometry. Level elevations and connection
 * routes are authored intent; a missing level region is derived only from authored
 * objects resting at that elevation and the authored routes that land on it.
 */
function canonicalizeHierarchy(raw: Rec, notes: V3GenerationNote[]) {
  if (!isRecord(raw.siteHierarchy)) return;
  const hierarchy: Rec = { ...raw.siteHierarchy };
  const objects = Array.isArray(raw.objects) ? raw.objects.filter(isRecord) : [];
  const connections = (Array.isArray(hierarchy.connections) ? hierarchy.connections : []).filter(isRecord).map((connection) => {
    if (CONNECTION_TYPES.has(String(connection.type))) return connection;
    const surface = objects.find((object) => object.id === connection.surfaceObjectId);
    const inferred = CONNECTION_TYPES.has(String(surface?.type)) ? String(surface!.type) : "path";
    notes.push({ code: "CONNECTION_TYPE_INFERRED", targetId: String(connection.id ?? "connection"), message: `Connection ${String(connection.id)} type was taken from ${surface ? `its surface object ${String(surface.id)}` : "the default pedestrian path"} (${inferred}).` });
    return { ...connection, type: inferred };
  });
  hierarchy.connections = connections;
  const rawLevels = (Array.isArray(hierarchy.levels) ? hierarchy.levels : []).filter(isRecord);
  const endpoints = new Map<string, { at: [number, number]; width: number }[]>();
  for (const connection of connections) {
    const route = (Array.isArray(connection.route) ? connection.route : []).map(point).filter((item): item is [number, number] => !!item);
    const width = Math.max(1, num(connection.width) ?? 1);
    if (route.length < 2) continue;
    for (const [levelId, at] of [[connection.fromLevelId, route[0]], [connection.toLevelId, route.at(-1)!]] as const) {
      const list = endpoints.get(String(levelId)) ?? [];
      list.push({ at, width });
      endpoints.set(String(levelId), list);
    }
  }
  const footprintOf = (object: Rec) => {
    const a = isRecord(object.architecture) ? object.architecture : undefined;
    if (!a) return undefined;
    const [x, z, w, d, base] = [num(a.x), num(a.z), num(a.width), num(a.depth), num(a.baseElevation)];
    return x === undefined || z === undefined || w === undefined || d === undefined || base === undefined || w <= 0 || d <= 0 ? undefined : { x, z, w, d, base };
  };
  const distanceTo = (footprint: { x: number; z: number; w: number; d: number }, [px, pz]: [number, number]) => Math.hypot(Math.max(0, Math.abs(px - footprint.x) - footprint.w / 2), Math.max(0, Math.abs(pz - footprint.z) - footprint.d / 2));
  const referenced = new Set<string>([
    ...connections.flatMap((connection) => [String(connection.fromLevelId), String(connection.toLevelId)]),
    ...(Array.isArray(hierarchy.transitions) ? hierarchy.transitions.filter(isRecord).flatMap((transition) => [String(transition.fromLevelId), String(transition.toLevelId)]) : []),
    ...objects.flatMap((object) => [isRecord(object.support) ? String(object.support.levelId) : "", String(object.fromSupportId ?? ""), String(object.toSupportId ?? "")]),
  ]);
  // Each bearing object belongs to exactly one same-elevation level: the one whose authored route lands nearest it.
  const owner = new Map<Rec, string>();
  for (const object of objects) {
    const footprint = footprintOf(object);
    if (!footprint || !BEARING_TYPES.has(String(object.type))) continue;
    const candidates = rawLevels.filter((level) => num(level.elevation) !== undefined && Math.abs(num(level.elevation)! - footprint.base) <= .4)
      .map((level) => ({ id: String(level.id), distance: Math.min(Infinity, ...(endpoints.get(String(level.id)) ?? []).map((endpoint) => distanceTo(footprint, endpoint.at))) }))
      .sort((a, b) => a.distance - b.distance);
    if (candidates[0]) owner.set(object, candidates[0].id);
  }
  const levels: Rec[] = [];
  for (const rawLevel of rawLevels) {
    const id = String(rawLevel.id ?? "");
    // An authored site level is a graded pad unless Terra says otherwise; without a type it would never be graded.
    const level = SUPPORT_TYPES.has(String(rawLevel.supportType)) ? rawLevel : { ...rawLevel, supportType: "pad" };
    if (level !== rawLevel) notes.push({ code: "SITE_LEVEL_SUPPORT_DEFAULTED", targetId: id, message: `Site level ${id} ${rawLevel.supportType === undefined ? "omitted" : `used unknown "${String(rawLevel.supportType)}" for`} supportType; it is graded as a pad.` });
    if (validRegion(level.region) || num(level.elevation) === undefined) { levels.push(level); continue; }
    const rects = [
      ...objects.filter((object) => owner.get(object) === id).map(footprintOf).filter((footprint): footprint is NonNullable<ReturnType<typeof footprintOf>> => !!footprint).map((f) => [f.x - f.w / 2, f.z - f.d / 2, f.x + f.w / 2, f.z + f.d / 2]),
      ...(endpoints.get(id) ?? []).map(({ at, width }) => { const half = Math.max(3, width / 2 + 1); return [at[0] - half, at[1] - half, at[0] + half, at[1] + half]; }),
    ];
    if (!rects.length) {
      if (!referenced.has(id)) { notes.push({ code: "SITE_LEVEL_OMITTED", targetId: id, message: `Site level ${id} had no region and nothing rests on or connects to it; it was omitted rather than given an invented footprint.` }); continue; }
      levels.push(level);
      continue;
    }
    const [minX, minZ, maxX, maxZ] = [Math.min(...rects.map((r) => r[0])), Math.min(...rects.map((r) => r[1])), Math.max(...rects.map((r) => r[2])), Math.max(...rects.map((r) => r[3]))];
    const round = (value: number) => Math.round(value * 100) / 100;
    levels.push({ ...level, region: { x: round((minX + maxX) / 2), z: round((minZ + maxZ) / 2), width: round(maxX - minX), depth: round(maxZ - minZ) } });
    notes.push({ code: "SITE_LEVEL_REGION_DERIVED", targetId: id, message: `Site level ${id} region was derived from the authored objects at elevation ${num(level.elevation)} and the routes landing on it.` });
  }
  hierarchy.levels = levels;
  raw.siteHierarchy = hierarchy;
}

export function canonicalizeV3ProviderIntent(input: unknown, notes: V3GenerationNote[]): unknown {
  if (!isRecord(input)) return input;
  const raw: Rec = { ...input };
  if (typeof raw.version === "string" && /^v?3(\.0+)?$/i.test(raw.version.trim())) { raw.version = 3; notes.push({ code: "VOCABULARY_MAPPED", targetId: "scene", message: `Scene version "${input.version}" was read as 3.` }); }
  const sceneMainEntry = isRecord(raw.mainEntry) && text(raw.mainEntry.openingId) ? raw.mainEntry : undefined;
  delete raw.mainEntry;
  if (Array.isArray(raw.objects)) raw.objects = raw.objects.map((object) => canonicalizeObject(object, sceneMainEntry, notes));
  if (sceneMainEntry && !(raw.objects as unknown[] ?? []).some((object) => isRecord(object) && isRecord(object.composition) && isRecord(object.composition.mainEntry))) notes.push({ code: "COMPOSITION_ENTRY_OMITTED", targetId: "scene", message: `mainEntry ${String(sceneMainEntry.openingId)} references no authored building door and was omitted.` });
  // A textual commitment accidentally wrapped as range:{value} has one lossless
  // representation. Numeric ranges and conflicting values remain validation errors.
  if(isRecord(raw.estatePlan)&&Array.isArray(raw.estatePlan.requirements))raw.estatePlan={...raw.estatePlan,requirements:raw.estatePlan.requirements.map(req=>{
    if(!isRecord(req)||req.value!==undefined||!isRecord(req.range)||Object.keys(req.range).length!==1||typeof req.range.value!=='string')return req;
    const {range,...rest}=req;
    notes.push({code:'INTENT_RELOCATED',targetId:String(req.id),message:'Textual estate requirement range.value moved to value without changing its content.'});
    return {...rest,value:range.value};
  })};
  canonicalizeSite(raw, notes);
  canonicalizeHierarchy(raw, notes);
  return raw;
}

/**
 * Terra authors absolute level elevations (e.g. road 60 m, sea 0 m) but rarely the
 * natural-ground elevation at the site centre. Without it the slope is anchored at 0
 * and every pad becomes a fill mesa. When no datum was authored, anchor the natural
 * slope to the authored levels: the median offset between each level and the unanchored
 * natural surface at its region centre. Robust to cut/fill pads; never moves a level.
 */
export function deriveV3NaturalGroundDatum(scene: V3Scene, notes: V3GenerationNote[]): void {
  const site = scene.site, ground = site?.naturalGround;
  if (!ground || ground.elevation !== undefined || site.baseElevation !== undefined || ground.profile?.length) return;
  const levels = (scene.siteHierarchy?.levels ?? []).filter((level) => Number.isFinite(level.elevation) && Number.isFinite(level.region?.x) && Number.isFinite(level.region?.z));
  if (levels.length < 2) return;
  const unanchored = { ...site, naturalGround: { ...ground, elevation: 0 } };
  const offsets = levels.map((level) => level.elevation - v3NaturalGroundHeight(unanchored, level.region.x, level.region.z)).sort((a, b) => a - b);
  const middle = offsets.length / 2, median = offsets.length % 2 ? offsets[Math.floor(middle)] : (offsets[middle - 1] + offsets[middle]) / 2;
  if (Math.abs(median) < 1) return;
  site.naturalGround = { ...ground, elevation: Math.round(median * 10) / 10 };
  notes.push({ code: "NATURAL_GROUND_DATUM_DERIVED", targetId: "site", message: `Natural ground at the site centre was anchored at ${site.naturalGround.elevation} m from the ${levels.length} authored level elevations (median fit).` });
}
