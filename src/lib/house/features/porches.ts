import type { HouseConfig, MaterialsConfig, PorchConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { FLOOR_THICKNESS, PORCH_LIMITS } from "../constants";
import { quad, tri } from "../geometryUtils";
import { resolveMaterial } from "../materials";
import { RAILING_STYLES } from "../catalog/railings";
import type { ResolvedExteriorOptions } from "../catalog/types";
import { box, paintOf, shade, wallFrame, type Paint, type WallFrame } from "../architecture/parts";
import { getArchitectureProfile, type PorchPosts } from "../architecture/profiles";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";

const DECK_TOP = FLOOR_THICKNESS;
/** Porches up to this width under a log-cabin profile get their own projecting gable. */
const GABLE_PORCH_MAX_WIDTH = 6.5;

export function validatePorch(raw: unknown, house: HouseConfig): FeatureValidation<PorchConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["offset", "width", "depth"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);

  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;
  const width = clampNumber(values.width, PORCH_LIMITS.width.min, Math.min(PORCH_LIMITS.width.max, Math.max(PORCH_LIMITS.width.min, wallLength)), "width", warnings);
  const depth = clampNumber(values.depth, PORCH_LIMITS.depth.min, PORCH_LIMITS.depth.max, "depth", warnings);
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);
  return { value: { wall: wall.value, offset, width, depth }, errors: [], warnings };
}

interface PostSpec {
  size: number;
  clear: number;
  color: string;
  paint: Paint;
}

function postSpec(kind: PorchPosts, timber: Paint, trim: Paint, steel: Paint): PostSpec {
  if (kind === "steel") return { size: 0.12, clear: 2.45, color: steel.color, paint: steel };
  if (kind === "log") return { size: 0.3, clear: 2.55, color: timber.color, paint: timber };
  if (kind === "turned") return { size: 0.22, clear: 2.6, color: trim.color, paint: trim };
  return { size: 0.2, clear: 2.55, color: trim.color, paint: trim };
}

export function buildPorch(
  config: PorchConfig,
  house: HouseConfig,
  materials: MaterialsConfig,
  index: number,
  opts?: ResolvedExteriorOptions
): HousePrimitive[] {
  const { offset, width, depth } = config;
  const f = wallFrame(house, config.wall);
  const profile = getArchitectureProfile(opts?.style);
  const trimMat = resolveMaterial(materials.trim);
  const deckMat = resolveMaterial(materials.decking);
  const roofMat = resolveMaterial(materials.roof);
  const trim = paintOf(trimMat);
  const trimIsWood = materials.trim.material === "timber" || materials.trim.material === "wood";
  const timber = paintOf(trimMat, trimIsWood ? trimMat.color : shade(deckMat.color, 0.6));
  const steel: Paint = { color: "#1c1f24", roughness: 0.3, metalness: 0.85 };
  const post = postSpec(profile?.porch.posts ?? "square", timber, trim, steel);
  const id = `porch-${index}`;
  const label = `Porch ${index + 1}`;
  const u0 = offset;
  const u1 = offset + width;
  const uMid = (u0 + u1) / 2;
  const out: HousePrimitive[] = [];

  // Deck
  const deckT = 0.16;
  out.push(box(`${id}-deck`, "porch", `${label} Deck`, f.at(uMid, DECK_TOP - deckT / 2, depth / 2), f.size(width, deckT, depth), paintOf(deckMat)));

  // Posts, then the header beam they carry.
  const postTop = DECK_TOP + post.clear;
  const beamH = post.size > 0.25 ? 0.3 : 0.22;
  const vPost = depth - post.size / 2 - 0.06;
  const posts = Math.max(2, Math.ceil(width / 3) + 1);
  const span = width - post.size - 0.1;
  for (let p = 0; p < posts; p++) {
    const u = u0 + post.size / 2 + 0.05 + (span * p) / (posts - 1);
    out.push(...buildPost(f, `${id}-post-${p}`, label, profile?.porch.posts ?? "square", post, u, vPost, postTop, trim));
    if (profile?.porch.posts === "log") {
      // Angled braces from each post up into the beam — the timber-frame signature.
      const reach = 0.65;
      for (const s of [-1, 1]) {
        if ((p === 0 && s === -1) || (p === posts - 1 && s === 1)) continue;
        out.push(
          box(`${id}-brace-${p}-${s < 0 ? "a" : "b"}`, "porch", `${label} Brace`, f.at(u + (s * reach) / 2, postTop - reach / 2, vPost), f.size(0.12, Math.hypot(reach, reach), 0.12), timber, f.lean(s * reach, reach))
        );
      }
    }
  }
  out.push(box(`${id}-beam`, "porch", `${label} Beam`, f.at(uMid, postTop + beamH / 2, vPost), f.size(width, beamH, post.size + 0.04), paintOf(trimMat, post.paint.color)));

  const beamTop = postTop + beamH;
  const character = profile?.roof.character;
  if (character === "floating-plate") out.push(...buildPlateCanopy(f, id, label, u0, u1, depth, beamTop, roofMat.color, steel));
  else if (character === "cabin-gable" && width <= GABLE_PORCH_MAX_WIDTH) out.push(...buildGablePorchRoof(f, id, label, u0, u1, depth, beamTop, roofMat.color, timber, paintOf(roofMat)));
  else out.push(...buildLeanToRoof(f, id, label, u0, u1, depth, beamTop, paintOf(roofMat)));

  // Railing around the deck, leaving a gap at the front for the steps (steel canopies stay open).
  if (character !== "floating-plate") out.push(...buildRailing(f, id, label, u0, u1, depth, opts, trim, post.size));

  // Landing step
  out.push(box(`${id}-step`, "porch", `${label} Step`, f.at(uMid, 0.05, depth + 0.28), f.size(Math.min(2, Math.max(1.2, width * 0.4)), 0.1, 0.5), paintOf(deckMat, shade(deckMat.color, 0.9))));
  return out;
}

function buildPost(f: WallFrame, id: string, label: string, kind: PorchPosts, spec: PostSpec, u: number, v: number, top: number, trim: Paint): HousePrimitive[] {
  const h = top - DECK_TOP;
  if (kind !== "turned") return [box(id, "porch", `${label} Post`, f.at(u, DECK_TOP + h / 2, v), f.size(spec.size, h, spec.size), spec.paint)];
  // Turned column: a plinth, a slim shaft and a capital.
  const shaft = spec.size;
  return [
    box(`${id}-base`, "porch", `${label} Column Base`, f.at(u, DECK_TOP + 0.12, v), f.size(shaft + 0.12, 0.24, shaft + 0.12), trim),
    box(id, "porch", `${label} Column`, f.at(u, DECK_TOP + 0.24 + (h - 0.44) / 2, v), f.size(shaft, h - 0.44, shaft), spec.paint),
    box(`${id}-cap`, "porch", `${label} Column Capital`, f.at(u, top - 0.1, v), f.size(shaft + 0.14, 0.2, shaft + 0.14), trim),
  ];
}

/** A shallow single-slope roof from the porch's outer edge up to the wall. */
function buildLeanToRoof(f: WallFrame, id: string, label: string, u0: number, u1: number, depth: number, beamTop: number, roof: Paint): HousePrimitive[] {
  const lip = 0.3;
  const yOuter = beamTop + 0.04;
  const yWall = yOuter + (depth + lip) * 0.3;
  const a = f.at(u0 - lip, yOuter, depth + lip);
  const b = f.at(u1 + lip, yOuter, depth + lip);
  const c = f.at(u1 + lip, yWall, 0);
  const d = f.at(u0 - lip, yWall, 0);
  return [
    { kind: "triMesh", id: `${id}-roof`, category: "porch", label: `${label} Roof`, vertices: quad(a, b, c, d), ...roof },
    box(`${id}-fascia`, "porch", `${label} Fascia`, f.at((u0 + u1) / 2, yOuter - 0.1, depth + lip), f.size(u1 - u0 + lip * 2, 0.2, 0.08), roof),
  ];
}

/** A flat, cantilevered canopy plate on a thin steel edge — the modern entry. */
function buildPlateCanopy(f: WallFrame, id: string, label: string, u0: number, u1: number, depth: number, beamTop: number, color: string, steel: Paint): HousePrimitive[] {
  const lip = 0.35;
  const T = 0.2;
  const y = beamTop + T / 2;
  const w = u1 - u0 + lip * 2;
  const mid = (u0 + u1) / 2;
  return [
    box(`${id}-roof`, "porch", `${label} Canopy`, f.at(mid, y, (depth + lip) / 2), f.size(w, T, depth + lip), { color, roughness: 0.6, metalness: 0.1 }),
    box(`${id}-fascia`, "porch", `${label} Canopy Edge`, f.at(mid, y, depth + lip - 0.03), f.size(w, T + 0.06, 0.06), steel),
  ];
}

/** A projecting gable over a narrow porch, with an exposed king-post truss on its front. */
function buildGablePorchRoof(f: WallFrame, id: string, label: string, u0: number, u1: number, depth: number, beamTop: number, color: string, timber: Paint, roof: Paint): HousePrimitive[] {
  const lip = 0.35;
  const halfSpan = (u1 - u0) / 2 + lip;
  const mid = (u0 + u1) / 2;
  const rise = halfSpan * 2 * 0.36;
  const yEave = beamTop + 0.04;
  const yRidge = yEave + rise;
  const vFront = depth + lip;
  const vBack = 0;
  const out: HousePrimitive[] = [
    {
      kind: "triMesh", id: `${id}-roof-a`, category: "porch", label: `${label} Roof (Left)`,
      vertices: quad(f.at(mid - halfSpan, yEave, vFront), f.at(mid, yRidge, vFront), f.at(mid, yRidge, vBack), f.at(mid - halfSpan, yEave, vBack)),
      ...roof,
    },
    {
      kind: "triMesh", id: `${id}-roof-b`, category: "porch", label: `${label} Roof (Right)`,
      vertices: quad(f.at(mid, yRidge, vFront), f.at(mid + halfSpan, yEave, vFront), f.at(mid + halfSpan, yEave, vBack), f.at(mid, yRidge, vBack)),
      ...roof,
    },
    {
      kind: "triMesh", id: `${id}-gable`, category: "porch", label: `${label} Gable`,
      vertices: tri(f.at(mid - halfSpan, yEave, vFront), f.at(mid + halfSpan, yEave, vFront), f.at(mid, yRidge, vFront)),
      color: shade(color, 0.7), roughness: 0.85, metalness: 0,
    },
    box(`${id}-ridge`, "porch", `${label} Ridge Beam`, f.at(mid, yRidge + 0.03, (vFront + vBack) / 2), f.size(0.18, 0.18, vFront - vBack + 0.2), timber),
    box(`${id}-truss-tie`, "porch", `${label} Truss Tie`, f.at(mid, yEave + rise * 0.3, vFront + 0.05), f.size(halfSpan * 1.4, 0.16, 0.14), timber),
    box(`${id}-truss-king`, "porch", `${label} Truss King Post`, f.at(mid, yEave + rise * 0.65, vFront + 0.05), f.size(0.16, rise * 0.7, 0.14), timber),
  ];
  return out;
}

/** Rails and balusters on the side edges and (with a step gap) the front edge of the deck. */
function buildRailing(f: WallFrame, id: string, label: string, u0: number, u1: number, depth: number, opts: ResolvedExteriorOptions | undefined, fallback: Paint, postSize: number): HousePrimitive[] {
  const entry = RAILING_STYLES[opts?.railingStyle ?? "timber"];
  const H = 1.0;
  const paint: Paint = { color: entry.color || fallback.color, roughness: entry.roughness, metalness: entry.metalness, transparent: entry.transparent || undefined, opacity: entry.transparent ? entry.opacity : undefined };
  const rail = Math.max(0.05, entry.elementSize);
  const out: HousePrimitive[] = [];
  const gap = u1 - u0 >= 3.4 ? 1.7 : 0;
  const mid = (u0 + u1) / 2;
  const edge = postSize + 0.06;
  // Segments as [axis, fixed coordinate, from, to]: "u" runs along the wall at v=fixed, "v" runs outward at u=fixed.
  const segments: ["u" | "v", number, number, number][] = [
    ["v", u0 + 0.05, 0, depth],
    ["v", u1 - 0.05, 0, depth],
  ];
  if (gap > 0) {
    segments.push(["u", depth - 0.05, u0 + edge, mid - gap / 2], ["u", depth - 0.05, mid + gap / 2, u1 - edge]);
  } else {
    segments.push(["u", depth - 0.05, u0 + edge, u1 - edge]);
  }

  segments.forEach(([axis, fixed, from, to], s) => {
    const len = to - from;
    if (len < 0.2) return;
    const c = (from + to) / 2;
    const at = (y: number) => (axis === "u" ? f.at(c, y, fixed) : f.at(fixed, y, c));
    const size = (h: number, t: number, l = len) => (axis === "u" ? f.size(l, h, t) : f.size(t, h, l));
    const pid = `${id}-rail-${s}`;
    if (entry.kind === "glass") {
      out.push(box(`${pid}-glass`, "porch", `${label} Glass Rail`, at(DECK_TOP + H / 2), size(H, 0.03), paint));
      return;
    }
    if (entry.kind === "solid") {
      out.push(box(`${pid}-wall`, "porch", `${label} Rail Wall`, at(DECK_TOP + H / 2), size(H, 0.15), paint));
      return;
    }
    out.push(box(`${pid}-top`, "porch", `${label} Top Rail`, at(DECK_TOP + H), size(0.08, 0.1), paint));
    if (entry.kind === "cables") {
      for (let k = 1; k <= 4; k++) out.push(box(`${pid}-cable-${k}`, "porch", `${label} Cable`, at(DECK_TOP + (H * k) / 5), size(rail, rail), paint));
    } else {
      out.push(box(`${pid}-bottom`, "porch", `${label} Bottom Rail`, at(DECK_TOP + 0.12), size(0.07, 0.08), paint));
      const balusters = Math.max(2, Math.min(60, Math.round(len * Math.min(entry.density, 8))));
      for (let b = 0; b < balusters; b++) {
        const t = from + (len * (b + 0.5)) / balusters;
        const pos = axis === "u" ? f.at(t, DECK_TOP + H / 2, fixed) : f.at(fixed, DECK_TOP + H / 2, t);
        out.push(box(`${pid}-baluster-${b}`, "porch", `${label} Baluster`, pos, f.size(rail, H - 0.08, rail), paint));
      }
    }
  });
  return out;
}
