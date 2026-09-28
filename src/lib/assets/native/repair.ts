import { Color } from "three";
import { MATERIAL_TYPES } from "@/lib/house/materials";
import { FAMILY_LIMITS, FAMILY_SIBLINGS, LIGHT_FAMILIES, NATIVE_FAMILIES, type NativeFamily } from "./families";
import { DETAIL_LEVELS, STYLE_PROFILE } from "./styleProfile";

/**
 * Spec repair: the difference between "the model formatted something oddly" and "this asset cannot be built".
 *
 * REJECTIONS (returned as errors, never guessed at): not an object, non-finite numbers, unknown family or primitive,
 * unknown material, a part that references a material that is not a slot, missing or non-positive dimensions, unusable
 * positions or paths, too many parts. These make geometry impossible or unsafe. Each carries `repairable`: true when the
 * message tells the model exactly what to change (the one automatic retry in `nativeAi.ts` sends it back); false for garbage
 * (not an object, non-finite numbers) and for a family the generator does not build, where a retry would only guess.
 *
 * AUTO-REPAIR (fixed and reported in `notes`): over-long or untidy labels, a long `style` sentence, colours written as
 * #rgb / rgb() / a CSS name, material synonyms ("fabric", "rattan"), out-of-range rotations, bevels and puff, mirror/axis
 * spelling, repeat counts, sizes given as width/height/depth, parts thinner than the minimum, sizes a little outside the
 * family's range, a chaise filed as a deck chair, unused optional fields. Repairs never change a part's position or the
 * overall silhouette; they only make values legal.
 *
 * Repair is idempotent: repairing a repaired spec changes nothing, so stored specs stay stable across rebuilds.
 */

type Rec = Record<string, unknown>;
export type Repair = { ok: true; spec: unknown; notes: string[] } | { ok: false; error: string; repairable: boolean };

class Rejected extends Error {
  constructor(message: string, readonly repairable: boolean) {
    super(message);
  }
}
/** Stops repair with the exact reason. `repairable` (the default): the model can fix it from the message; false: garbage or out of scope. */
const reject = (message: string, repairable = true): never => {
  throw new Rejected(message, repairable);
};

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MIN: number = STYLE_PROFILE.minPartThickness;

function findNonFinite(v: unknown, path = "spec"): string | null {
  if (typeof v === "number") return Number.isFinite(v) ? null : path;
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const bad = findNonFinite(v[i], `${path}.${i}`);
      if (bad) return bad;
    }
  } else if (isRec(v)) {
    for (const [k, x] of Object.entries(v)) {
      const bad = findNonFinite(x, `${path}.${k}`);
      if (bad) return bad;
    }
  }
  return null;
}

/** Exactly `n` finite numbers from an array, or undefined. Longer arrays are truncated, shorter ones padded only when `pad` is given. */
function vec(v: unknown, n: number, pad?: number): number[] | undefined {
  if (!Array.isArray(v) || v.length === 0 || !v.every((x) => num(x) !== undefined)) return undefined;
  const a = v as number[];
  if (a.length >= n) return a.slice(0, n);
  return pad === undefined ? undefined : [...a, ...Array<number>(n - a.length).fill(pad)];
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, "-");

const FAMILY_ALIASES: Record<string, NativeFamily> = {
  deckchair: "deck-chair", "sun-chair": "deck-chair", "lounge-chair": "deck-chair",
  chaise: "lounger", "chaise-lounge": "lounger", "chaise-longue": "lounger", "pool-chaise": "lounger", "sun-lounger": "lounger", sunlounger: "lounger", "pool-lounger": "lounger", "sun-bed": "lounger",
  pendant: "pendant-light", "pendant-lamp": "pendant-light", "hanging-light": "pendant-light", "hanging-lamp": "pendant-light",
  lantern: "lamp", "floor-lamp": "lamp", "table-lamp": "lamp", "wall-light": "lamp", "wall-lamp": "lamp", "wall-sconce": "lamp", sconce: "lamp", "path-light": "lamp", "garden-light": "lamp", light: "lamp",
  "planter-box": "planter", "plant-pot": "pot", "flower-pot": "pot", "plant-stand": "side-table",
  "coffee-table": "side-table", "end-table": "side-table", "outdoor-table": "dining-table", table: "dining-table", counter: "counter-module", "kitchen-counter": "counter-module",
  chair: "dining-chair", "lounge-armchair": "armchair", sofa: "bench", bookcase: "shelf", bbq: "appliance", grill: "appliance",
};

const MATERIAL_ALIASES: Record<string, (typeof MATERIAL_TYPES)[number]> = {
  fabric: "stucco", cloth: "stucco", canvas: "stucco", linen: "stucco", cushion: "stucco", upholstery: "stucco", textile: "stucco", leather: "stucco", rope: "stucco", cotton: "stucco", paint: "render", plaster: "render", plastic: "render", resin: "render", rubber: "render", polymer: "render", fiberglass: "render", fibreglass: "render",
  rattan: "timber", wicker: "timber", bamboo: "timber", cane: "timber", straw: "timber", raffia: "timber", seagrass: "timber",
  teak: "wood", oak: "wood", pine: "wood", walnut: "wood", mahogany: "wood", plywood: "wood", ash: "wood", eucalyptus: "wood",
  steel: "metal", iron: "metal", aluminium: "metal", aluminum: "metal", chrome: "metal", stainless: "metal", "stainless-steel": "metal", "wrought-iron": "metal", brass: "copper", bronze: "copper",
  ceramic: "tile", porcelain: "tile", clay: "terracotta", sandstone: "stone", granite: "stone", limestone: "stone", pebble: "stone", gravel: "stone", soil: "timber", earth: "timber", dirt: "timber",
  bulb: "glass", lightbulb: "glass", light: "glass", emissive: "glass", flame: "glass", "frosted-glass": "glass", acrylic: "glass",
};

/** #rgb, #rrggbb, #rrggbbaa (alpha dropped), the same without `#`, rgb(r,g,b) or a CSS colour name → "#rrggbb", else null. */
export function normalizeHex(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(t);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const long = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(t);
  if (long) return `#${long[1]}`;
  const rgb = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/.exec(t);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => clamp(Number(n), 0, 255).toString(16).padStart(2, "0")).join("")}`;
  const named = (Color.NAMES as Record<string, number>)[t.replace(/[^a-z]/g, "")];
  return named === undefined ? null : `#${named.toString(16).padStart(6, "0")}`;
}

function tidyLabel(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  // Prefer a word boundary so "tropical rustic resort with woven…" does not end mid-word.
  const at = cut.lastIndexOf(" ");
  return (at >= max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-–—]+$/, "");
}

const PRIMITIVE_ALIASES: Record<string, string> = {
  "rounded-rect": "roundedRect", roundedrect: "roundedRect", "rounded-rectangle": "roundedRect", "tapered-cylinder": "taperedCylinder", taperedcylinder: "taperedCylinder", frustum: "taperedCylinder",
  ball: "sphere", orb: "sphere", globe: "sphere", bulb: "sphere", ellipsoid: "sphere", "tube-ring": "torus", ring: "torus", donut: "torus", doughnut: "torus", hoop: "torus", "torus-ring": "torus",
  "slat-array": "slatArray", slatarray: "slatArray", slats: "slatArray", "curved-surface": "curvedSurface", curvedsurface: "curvedSurface", curved: "curvedSurface", shell: "curvedSurface",
  cube: "box", block: "box", pillow: "cushion", pad: "cushion", rod: "tube", pipe: "tube", cable: "tube", cord: "tube",
  weave: "lattice", woven: "lattice", wicker: "lattice", rattan: "lattice", mesh: "lattice", grid: "lattice", latticework: "lattice", basket: "lattice",
};
const PRIMITIVES = new Set(["box", "cylinder", "taperedCylinder", "sphere", "cone", "torus", "roundedRect", "tube", "cushion", "panel", "slatArray", "curvedSurface", "lattice"]);

const LIGHT_DIRECTION_LIST: readonly string[] = ["down", "up", "forward", "back", "left", "right"];

const wrapDegrees = (d: number) => (((d % 360) + 540) % 360) - 180;

/** Cleans a spec. Never throws; returns the reason when the asset genuinely cannot be built. */
export function repairSpec(input: unknown): Repair {
  try {
    return run(input);
  } catch (err) {
    if (err instanceof Rejected) return { ok: false, error: err.message, repairable: err.repairable };
    throw err;
  }
}

function run(input: unknown): Repair {
  if (!isRec(input)) return reject("Invalid asset spec (spec: expected an object).", false);
  const nonFinite = findNonFinite(input);
  if (nonFinite) return reject(`Invalid asset spec (${nonFinite}: not a finite number).`, false);

  const notes: string[] = [];
  const note = (m: string) => {
    if (!notes.includes(m)) notes.push(m);
  };

  // ── Family and size ──
  const rawFamily = typeof input.family === "string" ? slug(input.family) : "";
  let family = (NATIVE_FAMILIES as readonly string[]).includes(rawFamily) ? (rawFamily as NativeFamily) : FAMILY_ALIASES[rawFamily];
  if (!family) return reject(`Invalid asset spec (family: unknown family "${String(input.family).slice(0, 40)}").`, false);
  if (family !== input.family) note(`Family "${String(input.family).slice(0, 40)}" read as "${family}".`);

  const d = isRec(input.dimensions) ? input.dimensions : {};
  const dimensions = { width: num(d.width) ?? NaN, depth: num(d.depth) ?? NaN, height: num(d.height) ?? NaN };
  for (const axis of ["width", "depth", "height"] as const) {
    if (!(dimensions[axis] > 0)) return reject(`Invalid asset spec (dimensions.${axis}: must be a positive number of metres).`);
    if (dimensions[axis] > 8) return reject(`Invalid asset spec (dimensions.${axis}: ${dimensions[axis]} m is too large for a prop).`);
  }
  // The stated family if the size fits, else a sibling it fits (a 2 m "deck chair" is a lounger), else clamp a small excess.
  const fits = (f: NativeFamily, tol: number) => (["width", "depth", "height"] as const).every((a) => {
    const [lo, hi] = FAMILY_LIMITS[f][a];
    return dimensions[a] >= lo * (1 - tol) && dimensions[a] <= hi * (1 + tol);
  });
  const exact = (f: NativeFamily) => fits(f, 0);
  const candidates = [family, ...(FAMILY_SIBLINGS[family] ?? [])];
  if (!exact(family)) {
    const sibling = candidates.find(exact);
    const near = candidates.find((f) => fits(f, 0.25));
    if (sibling) {
      note(`Filed as "${sibling}" instead of "${family}": its size fits that family.`);
      family = sibling;
    } else if (near) {
      family = near;
      for (const a of ["width", "depth", "height"] as const) {
        const [lo, hi] = FAMILY_LIMITS[family][a];
        const v = clamp(dimensions[a], lo, hi);
        if (v !== dimensions[a]) note(`Declared ${a} ${dimensions[a]} m brought inside the ${family} range (${v} m).`);
        dimensions[a] = v;
      }
    } else {
      // Report the first offending axis of the stated family, as the strict check always did.
      for (const a of ["width", "depth", "height"] as const) {
        const [lo, hi] = FAMILY_LIMITS[family][a];
        if (dimensions[a] < lo || dimensions[a] > hi) return reject(`${family} ${a} of ${dimensions[a]} m is outside the realistic ${lo}–${hi} m.`);
      }
    }
  }

  // ── Materials ──
  if (!Array.isArray(input.materials) || input.materials.length === 0) return reject("Invalid asset spec (materials: at least one material is required).");
  let materials = input.materials.map((raw, i) => {
    if (!isRec(raw)) return reject(`Invalid asset spec (materials.${i}: expected an object).`);
    const key = tidyLabel(raw.key, 30);
    if (!key) return reject(`Invalid asset spec (materials.${i}.key: required).`);
    if (key !== raw.key) note("Material keys tidied.");
    const named = typeof raw.material === "string" ? slug(raw.material) : "";
    const material = (MATERIAL_TYPES as readonly string[]).includes(named) ? named : MATERIAL_ALIASES[named];
    if (!material) return reject(`Invalid asset spec (materials.${i}.material: unknown material "${String(raw.material).slice(0, 30)}").`);
    if (material !== raw.material) note(`Material "${String(raw.material).slice(0, 30)}" read as "${material}".`);
    const color = normalizeHex(raw.color);
    if (!color) return reject(`Invalid asset spec (materials.${i}.color: must be a 6-digit hex colour).`);
    if (color !== raw.color) note("Colours normalised to #rrggbb.");
    const slot: Rec = { key, material, color };
    for (const f of ["roughness", "metalness"] as const) {
      const v = num(raw[f]);
      if (v === undefined) continue;
      slot[f] = clamp(v, 0, 1);
      if (slot[f] !== v) note(`${f[0].toUpperCase()}${f.slice(1)} brought into 0-1.`);
    }
    const glowColor = raw.emissiveColor === undefined || raw.emissiveColor === null ? undefined : normalizeHex(raw.emissiveColor);
    if (raw.emissiveColor != null && !glowColor) note(`Glow colour on "${key}" was unreadable and dropped.`);
    const intensity = num(raw.emissiveIntensity);
    if (glowColor) slot.emissiveColor = glowColor;
    if (intensity !== undefined) {
      const { min, max } = STYLE_PROFILE.emissiveIntensity;
      slot.emissiveIntensity = clamp(intensity, min, max);
      if (slot.emissiveIntensity !== intensity) note("Glow intensity brought into range.");
    }
    return slot;
  });
  const slotKey = new Map<string, string>();
  for (const m of materials) {
    slotKey.set(m.key as string, m.key as string);
    if (!slotKey.has((m.key as string).toLowerCase())) slotKey.set((m.key as string).toLowerCase(), m.key as string);
  }
  // A part that names a material TYPE ("metal") where a slot key ("steel") belongs is unambiguous only when exactly one slot has that type.
  const byType = new Map<string, string[]>();
  for (const m of materials) byType.set(m.material as string, [...(byType.get(m.material as string) ?? []), m.key as string]);
  for (const [type, keys] of byType) if (keys.length === 1 && !slotKey.has(type)) slotKey.set(type, keys[0]);

  // ── Parts ──
  if (!Array.isArray(input.parts)) return reject("Invalid asset spec (parts: expected a list).");
  if (input.parts.length > STYLE_PROFILE.maxParts) return reject(`Too many parts (${input.parts.length}; limit ${STYLE_PROFILE.maxParts}). Use mirror and repeat.`);
  const parts = input.parts.map((raw, i) => repairPart(raw, i, slotKey, note));

  if (family === "lamp" || family === "pendant-light") addGlowIfMissing(materials, parts, note);
  const light = repairLight(input.light, family, materials, note);

  // More than the schema's slot limit: unused slots are the harmless surplus.
  if (materials.length > 8) {
    const used = new Set(parts.map((p) => p.material as string));
    materials = materials.filter((m) => used.has(m.key as string));
    note("Unused material slots dropped.");
  }

  const style = tidyLabel(input.style, 40);
  if (style !== input.style) note("Style label shortened.");
  const name = tidyLabel(input.name, 80);
  if (typeof input.name === "string" && name !== input.name.trim()) note("Name shortened.");
  const bevel = num(input.bevel);
  const detail = typeof input.detailLevel === "string" ? input.detailLevel.trim().toLowerCase() : undefined;
  const target = num(input.targetTriangles);
  if (detail !== undefined && !(DETAIL_LEVELS as readonly string[]).includes(detail)) note(`Unknown detail level "${detail.slice(0, 20)}" read as medium.`);
  if (target !== undefined && (target < 200 || target > STYLE_PROFILE.triangleBudget.high)) note("Out-of-range triangle estimate dropped (the real count is measured).");
  if (input.bevel !== undefined && bevel !== undefined && clamp(bevel, STYLE_PROFILE.bevel.multiplier.min, STYLE_PROFILE.bevel.multiplier.max) !== bevel) note("Bevel brought into range.");

  return {
    ok: true,
    notes,
    spec: {
      family,
      ...(name && name.length >= 3 ? { name } : {}),
      dimensions,
      style: style && style.length >= 2 ? style : family,
      materials,
      parts,
      ...(light ? { light } : {}),
      bevel: clamp(bevel ?? 1, STYLE_PROFILE.bevel.multiplier.min, STYLE_PROFILE.bevel.multiplier.max),
      detailLevel: (DETAIL_LEVELS as readonly string[]).includes(detail ?? "") ? detail : "medium",
      ...(target !== undefined && target >= 200 && target <= STYLE_PROFILE.triangleBudget.high ? { targetTriangles: Math.round(target) } : {}),
    },
  };
}

const GLOW_KEY = /bulb|flame|glow|\bled\b|lens|diffuser|filament|\blit\b|illuminat|light(?!weight)/i;
const NOT_GLOW_KEY = /frame|wax|cord|base|post|stem|body|shade|cage|handle|cap|canopy|wire|chain|rope|hook/i;

/**
 * A lamp or pendant that reads as a light needs something glowing. Models nearly always give the bulb / flame / glass its own
 * emissive slot; when they forgot, the slot that plainly is the light source (by name, else glass) is lit in a warm white.
 */
function addGlowIfMissing(materials: Rec[], parts: Rec[], note: (m: string) => void) {
  if (materials.some((m) => m.emissiveColor !== undefined || m.emissiveIntensity !== undefined)) return;
  const used = new Set(parts.map((p) => p.material));
  const pool = materials.filter((m) => used.has(m.key));
  const source = pool.find((m) => GLOW_KEY.test(m.key as string) && !NOT_GLOW_KEY.test(m.key as string)) ?? pool.find((m) => m.material === "glass");
  if (!source) return;
  const color = new Color(source.color as string);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  // Keep a warm, light slot colour as the glow; otherwise a warm white.
  source.emissiveColor = hsl.l > 0.6 && (hsl.h < 0.17 || hsl.h > 0.95) ? source.color : "#ffd27a";
  source.emissiveIntensity = 2;
  note(`"${String(source.key)}" is the light source, so it was made to glow.`);
}

const LIGHT_DIRECTION_ALIASES: Record<string, string> = { downward: "down", downwards: "down", floor: "down", ground: "down", upward: "up", upwards: "up", ceiling: "up", front: "forward", "+z": "forward", rear: "back", backward: "back", "-z": "back", "-x": "left", "+x": "right" };
const SPOT_NAMES = new Set(["spotlight", "spot-light", "spot_light", "beam", "downlight", "uplight", "floodlight", "flood"]);

/**
 * Scene-light metadata is optional and never blocks a build: a light that cannot be read is dropped (the asset still glows
 * through its emissive slots) and every value that is missing or out of range is defaulted or clamped, all reported in the notes.
 */
function repairLight(raw: unknown, family: NativeFamily, materials: Rec[], note: (m: string) => void): Rec | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!(LIGHT_FAMILIES as readonly string[]).includes(family)) {
    note(`Scene light dropped: only lamps and pendants carry one, not a ${family}.`);
    return undefined;
  }
  if (!isRec(raw)) {
    note("An unreadable scene light was dropped.");
    return undefined;
  }
  const L = STYLE_PROFILE.light;
  const named = typeof raw.type === "string" ? raw.type.trim().toLowerCase() : "";
  const type = named === "spot" || SPOT_NAMES.has(named) ? "spot" : "point";
  if (named !== type) note(named ? `Scene light type "${named.slice(0, 20)}" read as ${type}.` : "Scene light type defaulted to point.");

  const fromSlot = materials.find((m) => typeof m.emissiveColor === "string")?.emissiveColor as string | undefined;
  const color = normalizeHex(raw.color) ?? fromSlot ?? "#ffd27a";
  if (color !== raw.color) note(normalizeHex(raw.color) ? "Scene light colour normalised to #rrggbb." : "Scene light colour taken from the glowing material.");

  const bounded = (label: string, v: number | undefined, fallback: number, lo: number, hi: number) => {
    if (v === undefined) {
      note(`Scene light ${label} defaulted to ${fallback}.`);
      return fallback;
    }
    const c = clamp(v, lo, hi);
    if (c !== v) note(`Scene light ${label} brought into ${lo}–${hi}.`);
    return c;
  };
  const out: Rec = {
    type,
    color,
    intensity: bounded("intensity", num(raw.intensity), type === "spot" ? 20 : 8, L.intensity.min, L.intensity.max),
    range: bounded("range", num(raw.range), type === "spot" ? 10 : 6, L.range.min, L.range.max),
  };
  if (raw.position !== undefined && raw.position !== null) {
    const position = vec(raw.position, 3);
    if (position) out.position = position;
    else note("An unreadable scene light position was dropped (the light sits at the glowing part).");
  }
  if (type === "spot") {
    out.coneAngle = bounded("cone angle", num(raw.coneAngle), L.defaultConeAngle, L.coneAngle.min, L.coneAngle.max);
    const dir = typeof raw.direction === "string" ? raw.direction.trim().toLowerCase() : "";
    const direction = LIGHT_DIRECTION_LIST.includes(dir) ? dir : LIGHT_DIRECTION_ALIASES[dir] ?? "down";
    if (direction !== raw.direction) note(dir ? `Spot direction "${dir.slice(0, 12)}" read as ${direction}.` : "Spot direction defaulted to down.");
    out.direction = direction;
  } else if (raw.coneAngle != null || raw.direction != null) note("Cone settings were ignored: a point light shines all around.");
  return out;
}

function repairPart(raw: unknown, i: number, slotKey: Map<string, string>, note: (m: string) => void): Rec {
  if (!isRec(raw)) return reject(`Invalid asset spec (parts.${i}: expected an object).`);
  const named = typeof raw.primitive === "string" ? raw.primitive.trim() : "";
  const primitive = PRIMITIVES.has(named) ? named : PRIMITIVE_ALIASES[slug(named)] ?? PRIMITIVE_ALIASES[named.toLowerCase()];
  if (!primitive || !PRIMITIVES.has(primitive)) return reject(`Invalid asset spec (parts.${i}.primitive: unknown primitive "${named.slice(0, 30)}").`);
  if (primitive !== raw.primitive) note(`Primitive "${named.slice(0, 30)}" read as "${primitive}".`);

  const role = tidyLabel(raw.role, 40) || primitive;
  if (role !== raw.role) note("Part role labels tidied.");
  const matName = typeof raw.material === "string" ? raw.material.trim() : "";
  const material = slotKey.get(matName) ?? slotKey.get(matName.toLowerCase()) ?? slotKey.get(matName.slice(0, 30));
  if (!material) return reject(`Part "${role}" uses unknown material "${matName.slice(0, 30)}".`);
  if (material !== raw.material) note("Part material references matched to their slots (case, spacing, or a material type with one slot).");

  const position = vec(raw.position, 3);
  if (!position) return reject(`Invalid asset spec (parts.${i}.position: expected [x, y, z] in metres).`);
  const base: Rec = { primitive, role, material, position };

  const rot = raw.rotation === undefined || raw.rotation === null ? undefined : vec(raw.rotation, 3, 0);
  if (Array.isArray(raw.rotation) && raw.rotation.length !== 3) note("Rotations padded or trimmed to three angles.");
  if (rot) {
    const wrapped = rot.map((r) => (Math.abs(r) > 180 ? wrapDegrees(r) : r));
    if (wrapped.some((r, k) => r !== rot[k])) note("Rotations wrapped into ±180°.");
    if (wrapped.some((r) => r !== 0)) base.rotation = wrapped;
  }
  const mirror = typeof raw.mirror === "string" ? raw.mirror.trim().toLowerCase() : undefined;
  if (mirror) {
    const m = ["xz", "zx", "both", "xzboth", "x,z", "x+z"].includes(mirror) ? "xz" : mirror === "x" || mirror === "z" ? mirror : undefined;
    if (m) {
      base.mirror = m;
      if (m !== raw.mirror) note("Mirror settings normalised.");
    } else if (!["none", "false", "null", ""].includes(mirror)) note("Unreadable mirror settings dropped.");
  }
  if (isRec(raw.repeat)) {
    const count = Math.round(num(raw.repeat.count) ?? 0);
    const step = vec(raw.repeat.step, 3, 0);
    if (count >= 2 && step) {
      if (count > 24) note("Repeat counts capped at 24.");
      base.repeat = { count: Math.min(24, count), step };
    } else if (count >= 2) note("A repeat without a usable step was dropped.");
    else note("A repeat of fewer than 2 copies was dropped.");
  }
  const bevel = num(raw.bevel);
  if (bevel !== undefined) {
    const { min, max } = STYLE_PROFILE.bevel.multiplier;
    if (clamp(bevel, min, max) !== bevel) note("Bevel brought into range.");
    base.bevel = clamp(bevel, min, max);
  }

  const positive = (label: string, v: number | undefined): number => {
    if (v === undefined || !(v > 0)) return reject(`Part "${role}": ${label} must be a positive number of metres.`);
    return v;
  };
  const floor = (v: number, min = MIN) => {
    if (v >= min) return v;
    note(`Parts thinner than ${MIN * 1000} mm were thickened to ${MIN * 1000} mm.`);
    return min;
  };
  const size3 = (): number[] => {
    const s = vec(raw.size, 3);
    const alt = [num(raw.width), num(raw.height), num(raw.depth) ?? num(raw.thickness)];
    const size = s ?? (alt.every((v) => v !== undefined) ? (alt as number[]) : undefined);
    if (!size) return reject(`Invalid asset spec (parts.${i}.size: expected [w, h, d]).`);
    if (!s) note("Sizes given as width/height/depth were read as a size list.");
    return size.map((v, k) => floor(positive(`size[${k}]`, v)));
  };

  switch (primitive) {
    case "box": {
      const taper = num(raw.taper);
      return { ...base, size: size3(), ...(taper ? { taper: clamp(taper, 0, 0.6) } : {}) };
    }
    case "cushion": {
      const puff = num(raw.puff);
      if (puff !== undefined && clamp(puff, 0, 1) !== puff) note("Puff brought into range.");
      return { ...base, size: size3(), puff: clamp(puff ?? 0.5, 0, 1) };
    }
    case "panel":
      return { ...base, size: size3() };
    case "cylinder": {
      const s = vec(raw.size, 3);
      const radius = num(raw.radius) ?? (num(raw.diameter) !== undefined ? num(raw.diameter)! / 2 : undefined) ?? (num(raw.width) !== undefined ? num(raw.width)! / 2 : undefined) ?? (s ? s[0] / 2 : undefined);
      const height = num(raw.height) ?? s?.[1];
      return { ...base, radius: floor(positive("radius", radius), MIN / 2), height: floor(positive("height", height)) };
    }
    case "taperedCylinder": {
      const rb = num(raw.radiusBottom) ?? num(raw.radius);
      const rt = num(raw.radiusTop) ?? num(raw.radius) ?? rb;
      return { ...base, radiusBottom: floor(positive("radiusBottom", rb), MIN / 2), radiusTop: floor(positive("radiusTop", rt), MIN / 2), height: floor(positive("height", num(raw.height))) };
    }
    case "sphere": {
      const s = vec(raw.size, 3);
      const radius = num(raw.radius) ?? (num(raw.diameter) !== undefined ? num(raw.diameter)! / 2 : undefined) ?? (num(raw.width) !== undefined ? num(raw.width)! / 2 : undefined) ?? (s ? s[0] / 2 : undefined);
      if (s && s.some((v) => Math.abs(v - s[0]) > 1e-6)) note("A sphere is round: an uneven size was read as its first (width) value.");
      return { ...base, radius: floor(positive("radius", radius), MIN / 2) };
    }
    case "cone": {
      // A cone that also gives a top radius is a frustum: build it as one rather than dropping the top.
      const top = num(raw.radiusTop);
      if (top !== undefined && top > 0) {
        note("A cone with a top radius was read as a tapered cylinder.");
        const bottom = num(raw.radiusBottom) ?? num(raw.radius);
        return { ...base, primitive: "taperedCylinder", radiusBottom: floor(positive("radiusBottom", bottom), MIN / 2), radiusTop: floor(top, MIN / 2), height: floor(positive("height", num(raw.height))) };
      }
      const s = vec(raw.size, 3);
      const radius = num(raw.radius) ?? num(raw.radiusBottom) ?? (num(raw.diameter) !== undefined ? num(raw.diameter)! / 2 : undefined) ?? (num(raw.width) !== undefined ? num(raw.width)! / 2 : undefined) ?? (s ? s[0] / 2 : undefined);
      return { ...base, radius: floor(positive("radius", radius), MIN / 2), height: floor(positive("height", num(raw.height) ?? s?.[1])) };
    }
    case "torus": {
      const radius = positive("radius", num(raw.radius) ?? (num(raw.diameter) !== undefined ? num(raw.diameter)! / 2 : undefined));
      const tube = floor(positive("tubeRadius", num(raw.tubeRadius) ?? (num(raw.thickness) !== undefined ? num(raw.thickness)! / 2 : undefined) ?? (num(raw.tube) !== undefined ? num(raw.tube) : undefined)), MIN / 2);
      // A tube as fat as the ring closes the hole and self-intersects: keep a visible opening.
      const tubeRadius = Math.min(tube, radius * 0.9);
      if (tubeRadius !== tube) note("A torus tube as thick as its ring was thinned so the ring keeps an opening.");
      return { ...base, radius, tubeRadius };
    }
    case "roundedRect": {
      const s = vec(raw.size, 3);
      const width = floor(positive("width", num(raw.width) ?? s?.[0]));
      const height = floor(positive("height", num(raw.height) ?? s?.[1]));
      const depth = floor(positive("depth", num(raw.depth) ?? s?.[2]));
      const cr = num(raw.cornerRadius) ?? Math.min(width, depth) * 0.1;
      const cornerRadius = clamp(cr, 0, Math.min(4, Math.min(width, depth) / 2));
      if (cornerRadius !== cr) note("Corner radii limited to half the shorter side.");
      return { ...base, width, depth, height, cornerRadius };
    }
    case "tube": {
      if (!Array.isArray(raw.path)) return reject(`Part "${role}": a tube needs a path of 2-12 points.`);
      let path = raw.path.map((p) => vec(p, 3));
      if (path.some((p) => !p) || path.length < 2) return reject(`Part "${role}": a tube path needs at least two [x, y, z] points.`);
      if (path.length > 12) {
        path = Array.from({ length: 12 }, (_, k) => path[Math.round((k * (path.length - 1)) / 11)]);
        note("Long tube paths were thinned to 12 points.");
      }
      const radius = positive("radius", num(raw.radius) ?? (num(raw.thickness) !== undefined ? num(raw.thickness)! / 2 : undefined));
      if (radius > 0.3) note("Tube radii capped at 0.3 m.");
      return { ...base, path, radius: floor(Math.min(radius, 0.3), MIN / 2) };
    }
    case "slatArray": {
      const slatSize = vec(raw.slatSize, 3) ?? vec(raw.size, 3);
      if (!slatSize) return reject(`Invalid asset spec (parts.${i}.slatSize: expected [w, h, d]).`);
      const axis = typeof raw.axis === "string" ? raw.axis.trim().toLowerCase() : "";
      if (axis !== "x" && axis !== "y" && axis !== "z") return reject(`Invalid asset spec (parts.${i}.axis: expected "x", "y" or "z").`);
      const count = Math.round(num(raw.count) ?? 0);
      if (count < 2) return reject(`Part "${role}": a slat array needs at least 2 slats (use a box for one).`);
      if (count > 24) note("Slat counts capped at 24.");
      const gap = num(raw.gap);
      return { ...base, count: Math.min(24, count), slatSize: slatSize.map((v, k) => floor(positive(`slatSize[${k}]`, v))), gap: clamp(gap ?? 0.02, 0, 1), axis };
    }
    case "curvedSurface": {
      const arc = num(raw.arcDegrees) ?? 120;
      const thickness = num(raw.thickness) ?? 0.03;
      if (clamp(arc, 20, 330) !== arc || clamp(thickness, 0.01, 0.3) !== thickness) note("Curved-surface arc and thickness brought into range.");
      return { ...base, radius: positive("radius", num(raw.radius)), arcDegrees: clamp(arc, 20, 330), height: floor(positive("height", num(raw.height))), thickness: floor(clamp(thickness, 0.01, 0.3)) };
    }
    case "lattice":
      return { ...base, ...repairLattice(raw, role, positive, floor, note) };
  }
  return reject(`Invalid asset spec (parts.${i}.primitive: unknown primitive "${primitive}").`);
}

function repairLattice(raw: Rec, role: string, positive: (l: string, v: number | undefined) => number, floor: (v: number, min?: number) => number, note: (m: string) => void): Rec {
  const formName = typeof raw.form === "string" ? raw.form.trim().toLowerCase() : "";
  const form = formName === "panel" || formName === "tapered" || formName === "dome" ? formName : formName === "flat" || formName === "screen" ? "panel" : formName === "cylinder" || formName === "drum" || formName === "cone" || formName === "basket" ? "tapered" : formName === "shade" || formName === "hemisphere" || formName === "bowl" ? "dome" : num(raw.width) !== undefined && num(raw.radiusBottom) === undefined && num(raw.radius) === undefined ? "panel" : "tapered";
  if (form !== raw.form) note("Lattice form was inferred.");
  const height = floor(positive("height", num(raw.height)));
  let strand = num(raw.strand);
  if (strand === undefined) note("Lattice strand width defaulted to 2 cm.");
  strand = clamp(strand ?? 0.02, 0.001, 0.1);
  strand = floor(strand);
  let ribs = Math.round(clamp(num(raw.ribs) ?? 12, 3, 48));
  let bands = Math.round(clamp(num(raw.bands) ?? 5, 1, 24));
  const out: Rec = { form, height, strand, weave: typeof raw.weave === "boolean" ? raw.weave : true };
  let across: number;
  if (form === "panel") {
    out.width = floor(positive("width", num(raw.width)));
    across = out.width as number;
  } else {
    const rb = floor(positive("radiusBottom", num(raw.radiusBottom) ?? num(raw.radius)), MIN);
    out.radiusBottom = rb;
    const rt = num(raw.radiusTop);
    if (rt !== undefined) out.radiusTop = floor(positive("radiusTop", rt), MIN / 2);
    across = 2 * Math.PI * Math.min(rb, (out.radiusTop as number | undefined) ?? rb) * (form === "dome" ? 0.6 : 1);
  }
  // Strands must not overlap into a solid: thin the grid rather than fail.
  const maxRibs = Math.max(3, Math.floor((0.85 * across) / strand));
  const maxBands = Math.max(1, Math.floor((0.85 * height) / strand));
  if (ribs > maxRibs || bands > maxBands) {
    ribs = Math.min(ribs, maxRibs);
    bands = Math.min(bands, maxBands);
    note(`Lattice "${role}" had more strands than fit; the grid was thinned.`);
  }
  return { ...out, ribs, bands };
}
