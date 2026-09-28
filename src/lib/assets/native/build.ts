import { BufferGeometry, Box3, Euler, Matrix4, Quaternion, Vector3 } from "three";
import { buildLadder, describePlan, effectiveDetail, estimateTriangles, thinParts, type BuildPlan } from "./budget";
import { FAMILY_DEFAULTS } from "./families";
import * as P from "./primitives";
import { validateSpec, type AssetLight, type AssetPart, type AssetSpec } from "./spec";
import { resolveSurface, STYLE_PROFILE, type DetailLevel, type MaterialSlot, type ResolvedSurface } from "./styleProfile";

/** Deterministic geometry from an AssetSpec. Same spec in, same triangles out: nothing here is random or model-driven. */

export interface BuiltMesh {
  surface: ResolvedSurface;
  geometry: BufferGeometry;
}

/** A scene light placed on the finished asset: `position` is in the asset's final grounded, centred frame (metres). */
export type BuiltLight = Omit<AssetLight, "position"> & { position: [number, number, number] };

export interface BuiltAsset {
  spec: AssetSpec;
  /** One merged mesh per material, grounded (base on y=0) and centred on the footprint. */
  meshes: BuiltMesh[];
  /** Final size in metres (matches the spec's declared dimensions). */
  size: { width: number; depth: number; height: number };
  triangles: number;
  /** Scene-light metadata, positioned (lamps and pendants only). Emissive materials are separate and live in `meshes`. */
  light?: BuiltLight;
  /** The detail level actually used (drops a step only after slat density and small-part bevels have been spent). */
  detail: DetailLevel;
  /** Everything repaired or reduced on the way (spec repairs, family caps, budget reductions), for the review UI. */
  notes: string[];
}

/** `repairable`: the message names something the spec's author can change (see `SpecCheck`); a retry with it is worthwhile. */
export type BuildResult = { ok: true; asset: BuiltAsset } | { ok: false; error: string; repairable: boolean };

/** Bump when the prompt, spec schema or deterministic builders change in a way that makes old output distinguishable. */
export const NATIVE_GENERATOR_VERSION = "native-3";

const DEG = Math.PI / 180;

/**
 * Applies `repeat` and `mirror`, returning plain parts. A mirrored copy is the reflection of the part across the asset's
 * centre plane(s): position, path and rotation are all reflected (M·R·M for a reflection M just flips some Euler signs).
 */
export function expandParts(parts: readonly AssetPart[]): AssetPart[] {
  const out: AssetPart[] = [];
  for (const part of parts) {
    const step = part.repeat?.step ?? [0, 0, 0];
    for (let i = 0; i < (part.repeat?.count ?? 1); i++) {
      const c = { ...part, position: [part.position[0] + step[0] * i, part.position[1] + step[1] * i, part.position[2] + step[2] * i], repeat: undefined, mirror: undefined } as AssetPart;
      out.push(c);
      if (!part.mirror) continue;
      const [rx, ry, rz] = c.rotation ?? [0, 0, 0];
      const flip = (fx: number, fz: number): AssetPart => ({
        ...c,
        position: [c.position[0] * fx, c.position[1], c.position[2] * fz],
        // A shell that faces +z must turn around when reflected across z.
        rotation: [rx * fz, ry * fx * fz + (c.primitive === "curvedSurface" && fz < 0 ? 180 : 0), rz * fx],
        ...(c.primitive === "tube" ? { path: c.path.map(([x, y, z]) => [x * fx, y, z * fz] as [number, number, number]) } : {}),
      }) as AssetPart;
      if (part.mirror === "x" || part.mirror === "xz") out.push(flip(-1, 1));
      if (part.mirror === "z" || part.mirror === "xz") out.push(flip(1, -1));
      if (part.mirror === "xz") out.push(flip(-1, -1));
    }
  }
  return out;
}

function partGeometry(part: AssetPart, ctx: P.PrimitiveContext): BufferGeometry {
  const opts = { bevel: part.bevel };
  switch (part.primitive) {
    case "box": return P.beveledBox(part.size, ctx, { ...opts, taper: part.taper });
    case "cylinder": return P.cylinder(part.radius, part.height, ctx, opts);
    case "taperedCylinder": return P.taperedCylinder(part.radiusBottom, part.radiusTop, part.height, ctx, opts);
    case "sphere": return P.sphere(part.radius, ctx);
    case "cone": return P.cone(part.radius, part.height, ctx, opts);
    case "torus": return P.torus(part.radius, part.tubeRadius, ctx);
    case "roundedRect": return P.roundedRect(part.width, part.depth, part.height, part.cornerRadius, ctx, opts);
    case "tube": return P.tube(part.path, part.radius, ctx);
    case "cushion": return P.cushion(part.size, part.puff, ctx);
    case "panel": return P.panel(part.size, ctx, opts);
    case "slatArray": return P.slatArray(part.count, part.slatSize, part.gap, part.axis, ctx, opts);
    case "curvedSurface": return P.curvedSurface(part.radius, part.arcDegrees, part.height, part.thickness, ctx, opts);
    case "lattice": return P.lattice(part, ctx);
  }
}

function place(g: BufferGeometry, part: AssetPart): BufferGeometry {
  const [rx, ry, rz] = part.rotation ?? [0, 0, 0];
  const q = new Quaternion().setFromEuler(new Euler(rx * DEG, ry * DEG, rz * DEG, "XYZ"));
  return g.applyMatrix4(new Matrix4().compose(new Vector3(...part.position), q, new Vector3(1, 1, 1)));
}

/** The parts a plan builds: repeated slats / ribs thinned to the plan's density (and the family's slat cap), then mirror / repeat expanded. */
function planParts(spec: AssetSpec, plan: BuildPlan): AssetPart[] {
  return expandParts(thinParts(spec.parts, { density: plan.density, maxSlats: FAMILY_DEFAULTS[spec.family]?.maxSlats }));
}

const contextFor = (spec: AssetSpec, plan: BuildPlan): P.PrimitiveContext => ({ detail: plan.detail, bevel: spec.bevel, flatBelow: plan.flatBelow, leanCushion: plan.leanCushion });

function buildAt(spec: AssetSpec, plan: BuildPlan, parts: AssetPart[]): { meshes: BuiltMesh[]; box: Box3 } {
  const ctx = contextFor(spec, plan);
  const byMaterial = new Map<string, BufferGeometry[]>();
  for (const part of parts) {
    const list = byMaterial.get(part.material) ?? [];
    list.push(place(partGeometry(part, ctx), part));
    byMaterial.set(part.material, list);
  }
  const slots = new Map<string, MaterialSlot>(spec.materials.map((m) => [m.key, m]));
  const meshes = [...byMaterial.entries()].map(([key, list]) => ({ surface: resolveSurface(slots.get(key)!), geometry: P.mergeAll(list) }));
  const box = new Box3();
  for (const m of meshes) {
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox!);
  }
  return { meshes, box };
}

/**
 * Builds the asset. Cosmetic slips in the spec are repaired (see `repair.ts`); a spec that is over its triangle budget is
 * reduced along the ladder in `budget.ts` (thin slats, square-edge small parts, then lower detail) rather than rejected.
 * It fails (never guesses) only when the spec is genuinely unsafe or unbuildable, when the built model's proportions
 * disagree with its declared size beyond the profile's tolerance, or when even the last rung is over budget.
 */
export function buildAsset(input: unknown): BuildResult {
  const checked = validateSpec(input);
  if (!checked.ok) return checked;
  const spec = checked.spec;
  const notes: string[] = [...checked.notes];
  const requested = effectiveDetail(spec);
  if (requested !== spec.detailLevel) notes.push(`Detail held at ${requested} for a ${spec.family} (the family's default; slats stay light).`);

  const slatCap = FAMILY_DEFAULTS[spec.family]?.maxSlats;
  if (slatCap && thinParts(spec.parts, { density: 1, maxSlats: slatCap }).some((p, i) => p !== spec.parts[i])) notes.push(`Slat arrays held to ${slatCap} per array for a ${spec.family} (overall extent kept).`);

  const ladder = buildLadder(requested);
  let lastError = "Could not build within the triangle budget.";
  for (const [index, plan] of ladder.entries()) {
    const last = index === ladder.length - 1;
    const parts = planParts(spec, plan);
    if (parts.length > STYLE_PROFILE.maxExpandedParts) {
      lastError = `Too many parts after mirror/repeat (${parts.length}; limit ${STYLE_PROFILE.maxExpandedParts}).`;
      if (last) return { ok: false, error: lastError, repairable: true };
      continue;
    }
    const budget = STYLE_PROFILE.triangleBudget[plan.detail];
    // The estimate is exact for most primitives; a plan it says is far over budget is not worth building just to be measured.
    if (!last && estimateTriangles(parts, plan) > budget * 1.1) continue;
    const { meshes, box } = buildAt(spec, plan, parts);
    const triangles = meshes.reduce((n, m) => n + m.geometry.getAttribute("position").count / 3, 0);
    if (triangles > budget) {
      meshes.forEach((m) => m.geometry.dispose());
      lastError = `Too heavy: ${Math.round(triangles)} triangles at the lowest reduction (budget ${budget}). Use fewer or simpler parts.`;
      continue;
    }

    const size = box.getSize(new Vector3());
    const want = spec.dimensions;
    const ratio = [want.width / size.x, want.height / size.y, want.depth / size.z];
    const { min, max } = STYLE_PROFILE.fitRatio;
    if (ratio.some((r) => !Number.isFinite(r) || r < min || r > max)) {
      meshes.forEach((m) => m.geometry.dispose());
      return { ok: false, repairable: true, error: `The parts build to ${size.x.toFixed(2)}×${size.z.toFixed(2)}×${size.y.toFixed(2)} m, too far from the declared ${want.width}×${want.depth}×${want.height} m.` };
    }
    const reduction = describePlan(plan, requested);
    if (reduction) notes.push(reduction);
    // Small disagreements are absorbed by scaling to the declared size; the review shows the note.
    if (ratio.some((r) => Math.abs(r - 1) > 0.02)) notes.push(`Scaled to the declared size (×${ratio[0].toFixed(2)} wide, ×${ratio[1].toFixed(2)} tall, ×${ratio[2].toFixed(2)} deep).`);
    const center = box.getCenter(new Vector3());
    const scale = new Matrix4().makeScale(ratio[0], ratio[1], ratio[2]);
    // Scale about the box centre, then set the base on y=0: the model is grounded and centred like a placed GLB.
    const ground = new Matrix4().makeTranslation(0, want.height / 2, 0);
    for (const m of meshes) {
      m.geometry.applyMatrix4(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
      m.geometry.applyMatrix4(scale);
      m.geometry.applyMatrix4(ground);
      m.geometry.computeBoundingBox();
    }
    const light = spec.light ? placeLight(spec.light, meshes, want, center, ratio, notes) : undefined;
    return { ok: true, asset: { spec, meshes, size: { width: want.width, depth: want.depth, height: want.height }, triangles: Math.round(triangles), ...(light ? { light } : {}), detail: plan.detail, notes } };
  }
  return { ok: false, error: lastError, repairable: true };
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Puts the spec's light into the asset's final frame: the same transform the geometry got (centre, scale to the declared size,
 * ground). A light with no position sits at the glowing part, else near the top; one placed far outside the asset is pulled
 * back to within 15 cm of it, since a lamp's light belongs to the lamp.
 */
function placeLight(light: AssetLight, meshes: BuiltMesh[], want: AssetSpec["dimensions"], center: Vector3, ratio: number[], notes: string[]): BuiltLight {
  const { position: at, ...rest } = light;
  let position: Vector3;
  if (at) {
    position = new Vector3((at[0] - center.x) * ratio[0], (at[1] - center.y) * ratio[1] + want.height / 2, (at[2] - center.z) * ratio[2]);
    const roomy = new Box3(new Vector3(-want.width / 2, 0, -want.depth / 2), new Vector3(want.width / 2, want.height, want.depth / 2)).expandByScalar(0.15);
    const held = roomy.clampPoint(position, new Vector3());
    if (!held.equals(position)) {
      notes.push("Scene light moved back to within 15 cm of the asset.");
      position = held;
    }
  } else {
    const glow = new Box3();
    for (const m of meshes) if (m.surface.emissive) glow.union(m.geometry.boundingBox!);
    if (glow.isEmpty()) {
      position = new Vector3(0, want.height * 0.9, 0);
      notes.push("Scene light placed near the top of the asset (nothing glows to attach it to).");
    } else {
      position = glow.getCenter(new Vector3());
      notes.push("Scene light placed at the glowing part.");
    }
  }
  return { ...rest, position: [round4(position.x), round4(position.y), round4(position.z)] };
}

/** Order-independent-of-nothing stable fingerprint of the built geometry (1 mm quantised), for regression tests and change detection. */
export function geometryHash(asset: BuiltAsset): string {
  let h = 2166136261;
  for (const m of asset.meshes) {
    const pos = m.geometry.getAttribute("position");
    for (let i = 0; i < pos.count * 3; i++) {
      h ^= Math.round(pos.array[i] * 1000);
      h = Math.imul(h, 16777619);
    }
  }
  return (h >>> 0).toString(16);
}

/**
 * Fingerprint of everything that makes a built asset look or behave differently: its geometry, its surfaces (colour, roughness,
 * glow) and its scene light. `geometryHash` alone ignores the last two on purpose (a recolour keeps the same mesh), but two
 * versions of an asset that differ only in colour or light are different assets to the library.
 */
export function assetHash(asset: BuiltAsset): string {
  let h = 2166136261;
  for (const ch of `${geometryHash(asset)}|${JSON.stringify(asset.meshes.map((m) => m.surface))}|${JSON.stringify(asset.light ?? null)}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** Replaces material slots (recolour / material swap) without touching geometry: parts refer to slots by key. */
export function swapMaterials(spec: AssetSpec, patch: Record<string, Partial<Omit<MaterialSlot, "key">>>): AssetSpec {
  return { ...spec, materials: spec.materials.map((m) => (patch[m.key] ? { ...m, ...patch[m.key] } : m)) };
}
