import { z } from "zod";
import type { AssetRoute } from "@/types/library";
import { MATERIAL_TYPES } from "@/lib/house/materials";
import { FAMILY_LIMITS, NATIVE_FAMILIES } from "./families";
import { repairSpec } from "./repair";
import { DETAIL_LEVELS, STYLE_PROFILE } from "./styleProfile";

/**
 * AssetSpec: what the AI returns instead of vertices. A short, structured description of a small prop as a handful of
 * primitive parts; deterministic builders (`build.ts`) turn it into geometry. Coordinates are metres, +y up, the asset's
 * front faces +z, `position` is a part's centre relative to the asset's own origin (the builder re-grounds and centres the
 * finished model, so the origin only needs to be consistent).
 */

export { FAMILY_LIMITS, NATIVE_FAMILIES, type NativeFamily } from "./families";

const num = z.number().finite();
const positive = z.number().finite().positive().max(8);
const vec3 = z.tuple([num, num, num]);
const size3 = z.tuple([positive, positive, positive]);

const common = {
  /** What the part is for ("leg", "seat-slat", "backrest"): shown in the review UI and useful when refining. */
  role: z.string().trim().min(1).max(40),
  /** Key of one of the spec's `materials`. */
  material: z.string().trim().min(1).max(30),
  position: vec3,
  /** Degrees, applied about the part's centre in x, y, z order. */
  rotation: vec3.optional(),
  /** Also emit mirrored copies across the asset's centre plane(s): halves the parts needed for legs and rails. */
  mirror: z.enum(["x", "z", "xz"]).optional(),
  /** Repeat `count` times, each copy offset by `step` (metres): rungs, slats, shelves. */
  repeat: z.object({ count: z.number().int().min(2).max(24), step: vec3 }).optional(),
  /** Multiplies the profile's bevel for this part (1 = the house style). */
  bevel: z.number().min(STYLE_PROFILE.bevel.multiplier.min).max(STYLE_PROFILE.bevel.multiplier.max).optional(),
};

export const partSchema = z.discriminatedUnion("primitive", [
  /** Beveled box; `taper` shrinks the top face (0 = straight, 0.4 = top 40% smaller) for tapered planters and legs. */
  z.object({ primitive: z.literal("box"), ...common, size: size3, taper: z.number().min(0).max(0.6).optional() }),
  z.object({ primitive: z.literal("cylinder"), ...common, radius: positive, height: positive }),
  z.object({ primitive: z.literal("taperedCylinder"), ...common, radiusBottom: positive, radiusTop: positive, height: positive }),
  /** Rounded rectangle plate/block, extruded upward. */
  z.object({ primitive: z.literal("roundedRect"), ...common, width: positive, depth: positive, height: positive, cornerRadius: z.number().min(0).max(4) }),
  /** A rail/tube swept along `path` (2-12 points, smoothed) with round end caps. */
  z.object({ primitive: z.literal("tube"), ...common, path: z.array(vec3).min(2).max(12), radius: z.number().positive().max(0.3) }),
  /** Soft, pillowy block. `puff` 0 = tight, 1 = very round. */
  z.object({ primitive: z.literal("cushion"), ...common, size: size3, puff: z.number().min(0).max(1).default(0.5) }),
  /** Thin flat board: size is [width, height, thickness]. */
  z.object({ primitive: z.literal("panel"), ...common, size: size3 }),
  /** `count` slats laid along `axis`, `gap` apart, centred on `position`. */
  z.object({ primitive: z.literal("slatArray"), ...common, count: z.number().int().min(2).max(24), slatSize: size3, gap: z.number().min(0).max(1), axis: z.enum(["x", "y", "z"]) }),
  /** A curved shell: an arc of `arcDegrees` at `radius`, `thickness` thick and `height` tall. */
  z.object({ primitive: z.literal("curvedSurface"), ...common, radius: positive, arcDegrees: z.number().min(20).max(330), height: positive, thickness: z.number().min(0.01).max(0.3) }),
  /**
   * A lightweight woven / lattice surface (rattan shades, woven panels, basket planters, screens): a grid of flat strands,
   * never fibres. panel = flat (`width` × `height`); tapered = a frustum (`radiusBottom` → `radiusTop`); dome = a shell that
   * closes toward `radiusTop` (default a small crown). `ribs` run up the surface, `bands` around it.
   */
  z.object({
    primitive: z.literal("lattice"), ...common,
    form: z.enum(["panel", "tapered", "dome"]),
    width: positive.optional(), radiusBottom: positive.optional(), radiusTop: positive.optional(),
    height: positive,
    ribs: z.number().int().min(3).max(48), bands: z.number().int().min(1).max(24),
    strand: z.number().min(STYLE_PROFILE.minPartThickness).max(0.1),
    weave: z.boolean().default(true),
  }).refine((p) => (p.form === "panel" ? p.width !== undefined : p.radiusBottom !== undefined), { message: "a lattice panel needs width; a tapered or dome lattice needs radiusBottom" }),
]);
export type AssetPart = z.infer<typeof partSchema>;
export type PartPrimitive = AssetPart["primitive"];
export const PART_PRIMITIVES = ["box", "cylinder", "taperedCylinder", "roundedRect", "tube", "cushion", "panel", "slatArray", "curvedSurface", "lattice"] as const satisfies readonly PartPrimitive[];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex colour");

export const materialSlotSchema = z.object({
  key: z.string().trim().min(1).max(30),
  material: z.enum(MATERIAL_TYPES as [string, ...string[]]) as unknown as z.ZodType<(typeof MATERIAL_TYPES)[number]>,
  color: hex,
  roughness: z.number().min(0).max(1).optional(),
  metalness: z.number().min(0).max(1).optional(),
  /** Makes the surface glow (bulbs, flames, lit glass, lantern panels). Omit both for an ordinary surface. */
  emissiveColor: hex.optional(),
  emissiveIntensity: z.number().min(STYLE_PROFILE.emissiveIntensity.min).max(STYLE_PROFILE.emissiveIntensity.max).optional(),
});

export const assetSpecSchema = z.object({
  family: z.enum(NATIVE_FAMILIES),
  name: z.string().trim().min(3).max(80).optional(),
  /** Overall size the asset should end up at, metres. */
  dimensions: z.object({ width: positive, depth: positive, height: positive }),
  style: z.string().trim().min(2).max(40),
  materials: z.array(materialSlotSchema).min(1).max(8),
  parts: z.array(partSchema).min(2).max(STYLE_PROFILE.maxParts),
  /** Multiplier on the profile's bevel for the whole asset. */
  bevel: z.number().min(STYLE_PROFILE.bevel.multiplier.min).max(STYLE_PROFILE.bevel.multiplier.max).default(1),
  detailLevel: z.enum(DETAIL_LEVELS).default("medium"),
  /** The AI's own estimate; the real count is measured after building and is what is checked. */
  targetTriangles: z.number().int().min(200).max(STYLE_PROFILE.triangleBudget.high).optional(),
});
export type AssetSpec = z.infer<typeof assetSpecSchema>;

export type SpecCheck = { ok: true; spec: AssetSpec; notes: string[] } | { ok: false; error: string };

/**
 * Cleans, then checks, a spec. Cosmetic and formatting slips a model makes (long labels, out-of-range rotations, a slightly
 * excessive bevel, a size given as width/height/depth, a 2 m chaise filed under "deck-chair") are repaired and reported in
 * `notes` (see `repair.ts`); anything that would make geometry impossible or unsafe (unknown primitive, missing material,
 * non-finite or non-positive dimensions, nothing buildable) is a hard failure. Building (`build.ts`) adds the measured checks.
 */
export function validateSpec(raw: unknown): SpecCheck {
  const repaired = repairSpec(raw);
  if (!repaired.ok) return repaired;
  const parsed = assetSpecSchema.safeParse(repaired.spec);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Invalid asset spec (${issue?.path.join(".") || "spec"}: ${issue?.message}).` };
  }
  const spec = parsed.data;
  const limits = FAMILY_LIMITS[spec.family];
  for (const axis of ["width", "depth", "height"] as const) {
    const [lo, hi] = limits[axis];
    const v = spec.dimensions[axis];
    if (v < lo || v > hi) return { ok: false, error: `${spec.family} ${axis} of ${v} m is outside the realistic ${lo}–${hi} m.` };
  }
  const keys = new Set(spec.materials.map((m) => m.key));
  if (keys.size !== spec.materials.length) return { ok: false, error: "Duplicate material keys." };
  const unknown = spec.parts.find((p) => !keys.has(p.material));
  if (unknown) return { ok: false, error: `Part "${unknown.role}" uses unknown material "${unknown.material}".` };
  const thin = spec.parts.find((p) => minThickness(p) < STYLE_PROFILE.minPartThickness - 1e-9);
  if (thin) return { ok: false, error: `Part "${thin.role}" is thinner than ${STYLE_PROFILE.minPartThickness * 1000} mm.` };
  return { ok: true, spec, notes: repaired.notes };
}

/** Smallest edge of a part in metres (its thinnest dimension). */
export function minThickness(p: AssetPart): number {
  switch (p.primitive) {
    case "box": case "cushion": case "panel": return Math.min(...p.size);
    case "cylinder": return Math.min(p.radius * 2, p.height);
    case "taperedCylinder": return Math.min(p.radiusBottom * 2, p.radiusTop * 2, p.height);
    case "roundedRect": return Math.min(p.width, p.depth, p.height);
    case "tube": return p.radius * 2;
    case "slatArray": return Math.min(...p.slatSize);
    case "curvedSurface": return Math.min(p.thickness, p.height);
    case "lattice": return p.strand;
  }
}

// ── What the model returns ──────────────────────────────────────────────────

/** Optional in the loose schema means "absent or null": models sometimes write null for a field that does not apply. */
const opt = <T extends z.ZodType>(t: T) => t.nullish();

const loosePart = z.object({
  primitive: z.string(),
  role: opt(z.string()),
  material: z.string(),
  position: z.array(z.number()),
  rotation: opt(z.array(z.number())),
  mirror: opt(z.string()),
  repeat: opt(z.object({ count: z.number(), step: z.array(z.number()).nullish() })),
  bevel: opt(z.number()),
  size: opt(z.array(z.number())),
  taper: opt(z.number()),
  puff: opt(z.number()),
  radius: opt(z.number()),
  height: opt(z.number()),
  radiusBottom: opt(z.number()),
  radiusTop: opt(z.number()),
  width: opt(z.number()),
  depth: opt(z.number()),
  cornerRadius: opt(z.number()),
  path: opt(z.array(z.array(z.number()))),
  count: opt(z.number()),
  slatSize: opt(z.array(z.number())),
  gap: opt(z.number()),
  axis: opt(z.string()),
  arcDegrees: opt(z.number()),
  thickness: opt(z.number()),
  form: opt(z.string()),
  ribs: opt(z.number()),
  bands: opt(z.number()),
  strand: opt(z.number()),
  weave: opt(z.boolean()),
});

/** Loose shape sent to the provider (its JSON-schema mode cannot express the discriminated union); strict validation is local. */
export const specOutputSchema = z.object({
  /** Set when this object cannot be built from these primitives (organic, carved, figurative). Then the rest is ignored. */
  unsupported: opt(z.object({ reason: z.string() })),
  family: z.string(),
  name: opt(z.string()),
  dimensions: z.object({ width: z.number(), depth: z.number(), height: z.number() }),
  style: z.string(),
  materials: z.array(z.object({ key: z.string(), material: z.string(), color: z.string(), roughness: opt(z.number()), metalness: opt(z.number()), emissiveColor: opt(z.string()), emissiveIntensity: opt(z.number()) })),
  parts: z.array(loosePart),
  bevel: opt(z.number()),
  detailLevel: opt(z.string()),
  targetTriangles: opt(z.number()),
});
export type SpecOutput = z.infer<typeof specOutputSchema>;

const dropEmpty = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

/**
 * Drops the loose schema's unused optional keys so the strict union sees only what each primitive owns. Label and value
 * repair (long style, odd rotations, dimension aliases…) is `repairSpec`'s job and runs on every build, so a stored spec
 * benefits from it too.
 */
export function cleanLooseSpec(raw: SpecOutput): unknown {
  return {
    ...dropEmpty({ ...raw, unsupported: undefined }),
    materials: raw.materials.map(dropEmpty),
    parts: raw.parts.map((p) => ({ ...dropEmpty(p), ...(p.repeat ? { repeat: dropEmpty(p.repeat) } : {}) })),
  };
}

// ── Can the native generator build it? ──────────────────────────────────────


const ORGANIC = /\b(?:statue|sculpture|figurine|bust|fountain|tree|palm|plants?|flowers?|shrub|hedge|topiary|bamboo|herb garden|cactus|succulent|animal|person|people|boulder|rock|stone formation|vehicle|car|boat|yacht|hot tub|jacuzzi|hammock|rug|carpet|curtain|drape|gazebo|cabana|building|fireplace|fire pit|waterfall)\b/i;
const CATEGORIES_EXTERNAL = new Set(["vehicle", "vegetation", "rock", "gazebo", "cabana", "hot-tub", "fire-pit"]);

/** First-pass routing from the plan alone. The model can still refuse an asset when it tries to build it. */
export function nativeRoute(asset: { name: string; category: string; description?: string }): AssetRoute {
  if (CATEGORIES_EXTERNAL.has(asset.category)) return "external-generation-recommended";
  return ORGANIC.test(`${asset.name} ${asset.description ?? ""}`) ? "external-generation-recommended" : "native";
}
