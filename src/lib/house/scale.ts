import type { DesignTier, ProjectScale } from "@/types/house";

/**
 * Project scale: how *big* the project is — footprint, floors, wings, garage, pool, deck, driveway, grounds and
 * outbuildings. It is independent of the design tier (which is how elaborate and richly detailed the design is), so
 * a "luxury cottage" is a small house with premium finishes and a "plain mansion" a huge one with simple detail.
 *
 * Scale only steers *initial generation*. It is stored on `site.projectScale`, and a project without one (everything
 * saved before this existed) is never touched by the scale rules. Scoped edits never regenerate anything because of it.
 */

export const PROJECT_SCALES: [ProjectScale, ...ProjectScale[]] = ["cottage", "family", "luxury", "estate", "mansion"];
export const DEFAULT_PROJECT_SCALE: ProjectScale = "family";

export const isProjectScale = (v: unknown): v is ProjectScale => typeof v === "string" && (PROJECT_SCALES as readonly string[]).includes(v);

/** 0 (cottage) … 4 (mansion). */
export const scaleRank = (scale: ProjectScale): number => PROJECT_SCALES.indexOf(scale);

type Range = readonly [number, number];

export interface ScaleProfile {
  key: ProjectScale;
  label: string;
  /** The main mass, in metres. The connected wings come on top of this. */
  footprint: { width: Range; depth: Range };
  floors: Range;
  /** Connected wings (attached blocks), counted in addition to the main mass. */
  wings: number;
  /** How far a wing projects from the house and how much of the house's side it runs along, in metres. */
  wing: { projection: Range; run: Range };
  /** Most rooms drawn per floor: interiors stay basic. */
  roomsPerFloor: number;
  /** Cars the garages hold in total; 0 = the scale never adds one. */
  garageCars: number;
  /** Outdoor living: the view-side patio and pool, and a sun deck beyond the pool. Absent = never added (only capped). */
  patio?: { width: number; depth: number };
  pool?: { width: Range; depth: Range };
  deck?: { width: number; depth: number };
  /** Caps applied to a pool or deck the design already has, so a cottage never gets a resort pool. */
  cap: { pool: { width: number; depth: number }; deck: { width: number; depth: number }; garageCars: number; driveway: number };
  driveway: { length: Range; width: number };
  /** Planted garden zones around the house. */
  gardens: { count: number; width: number; depth: number };
  /** Chance (0–1) of each detached structure; 1 means always. */
  outbuildings: { shed: number; guestHouse: number; gazebo: number; poolHouse: number };
  /** The front door is at least this wide (m). */
  door: number;
  /** Tier the design is lifted to when nothing states one. */
  minTier?: DesignTier;
  guidance: string;
}

export const SCALE_PROFILES: Record<ProjectScale, ScaleProfile> = {
  cottage: {
    key: "cottage",
    label: "Cottage",
    footprint: { width: [8, 11], depth: [6, 8.5] },
    floors: [1, 1],
    wings: 0,
    wing: { projection: [0, 0], run: [0, 0] },
    roomsPerFloor: 3,
    garageCars: 0,
    cap: { pool: { width: 4.5, depth: 2.8 }, deck: { width: 4.5, depth: 3.5 }, garageCars: 1, driveway: 10 },
    driveway: { length: [5, 10], width: 3 },
    gardens: { count: 0, width: 0, depth: 0 },
    outbuildings: { shed: 0.3, guestHouse: 0, gazebo: 0, poolHouse: 0 },
    door: 0.95,
    guidance:
      "Compact, simple massing: one main volume, about 8–11 × 6–8.5 m and one storey (two only when the brief says so), under one simple roof. No wings are required. A tiny patio or deck at most, a short drive, no pool unless asked and then only a small plunge pool, at most a one-car garage, and a shed at most. Two or three rooms.",
  },
  family: {
    key: "family",
    label: "Family",
    footprint: { width: [12, 16], depth: [9, 11.5] },
    floors: [1, 2],
    wings: 0,
    wing: { projection: [0, 0], run: [0, 0] },
    roomsPerFloor: 5,
    garageCars: 2,
    cap: { pool: { width: 9, depth: 4.5 }, deck: { width: 8, depth: 6 }, garageCars: 2, driveway: 16 },
    driveway: { length: [8, 16], width: 3.6 },
    gardens: { count: 0, width: 0, depth: 0 },
    outbuildings: { shed: 0.2, guestHouse: 0, gazebo: 0, poolHouse: 0 },
    door: 1.1,
    guidance:
      "Simple to moderate massing, about 12–16 × 9–11.5 m, one or two storeys. A single well-proportioned block is fine, and offsets, an attached garage, a porch or a rear projection may break it up; no wings are required. A porch, patio or deck of ordinary size, an up-to-two-car garage, a modest pool only if the brief asks, a driveway of 8–16 m. Up to five rooms per floor.",
  },
  luxury: {
    key: "luxury",
    label: "Luxury",
    footprint: { width: [17, 22], depth: [11, 14] },
    floors: [2, 3],
    wings: 1,
    wing: { projection: [7, 9], run: [7, 10] },
    roomsPerFloor: 6,
    garageCars: 3,
    patio: { width: 8, depth: 5 },
    pool: { width: [9, 11], depth: [4.5, 5.5] },
    deck: { width: 10, depth: 6 },
    cap: { pool: { width: 12, depth: 6 }, deck: { width: 14, depth: 9 }, garageCars: 4, driveway: 26 },
    driveway: { length: [18, 24], width: 4.5 },
    gardens: { count: 2, width: 10, depth: 8 },
    outbuildings: { shed: 0, guestHouse: 0.35, gazebo: 0.5, poolHouse: 0 },
    door: 1.4,
    guidance:
      "Varied, composed massing: a main block about 17–22 × 11–14 m, two or three storeys, in an L, U, stepped or offset arrangement rather than a plain box. One connected secondary volume (a lower block, 7–9 m out from a side of the house) is typical but not mandatory. A three-car garage, a generous patio, a shaped pool about 10 × 5 m with a sun deck beyond it, a driveway of 18–24 m and two garden zones. A guest house is possible but not automatic. Up to six rooms per floor.",
  },
  estate: {
    key: "estate",
    label: "Estate",
    footprint: { width: [22, 28], depth: [13, 16] },
    floors: [2, 3],
    wings: 2,
    wing: { projection: [8, 11], run: [9, 12] },
    roomsPerFloor: 8,
    garageCars: 4,
    patio: { width: 12, depth: 6 },
    pool: { width: [12, 14], depth: [5.5, 6.5] },
    deck: { width: 14, depth: 7 },
    cap: { pool: { width: 16, depth: 8 }, deck: { width: 18, depth: 10 }, garageCars: 6, driveway: 34 },
    driveway: { length: [28, 34], width: 5 },
    gardens: { count: 3, width: 14, depth: 10 },
    outbuildings: { shed: 0, guestHouse: 0.75, gazebo: 1, poolHouse: 0.5 },
    door: 1.7,
    guidance:
      "Multi-volume composition: a main block about 22–28 × 13–16 m, two or three storeys, with two or more connected or closely related masses (wings 8–11 m out, pavilions, a stepped service block) in whatever arrangement suits the style (U, H, L with a pavilion, staggered). Courtyards and terraces are encouraged where the site allows. A four-car garage, a large terrace and a pool of about 13 × 6 m with a wide sun deck, a long driveway of 28–34 m, three garden zones, a gazebo and usually a guest house. Up to eight rooms per floor.",
  },
  mansion: {
    key: "mansion",
    label: "Mansion",
    footprint: { width: [30, 38], depth: [15, 19] },
    floors: [3, 4],
    wings: 3,
    wing: { projection: [10, 13], run: [11, 14] },
    roomsPerFloor: 10,
    garageCars: 6,
    patio: { width: 16, depth: 7 },
    pool: { width: [15, 18], depth: [6.5, 8] },
    deck: { width: 18, depth: 9 },
    cap: { pool: { width: 25, depth: 12 }, deck: { width: 30, depth: 14 }, garageCars: 10, driveway: 40 },
    driveway: { length: [36, 40], width: 6 },
    gardens: { count: 4, width: 18, depth: 12 },
    outbuildings: { shed: 0, guestHouse: 1, gazebo: 1, poolHouse: 1 },
    door: 2,
    minTier: "estate",
    guidance:
      "Large multi-wing composition with a clear hierarchy: a dominant main block about 30–38 × 15–19 m and three or four storeys, with multiple connected masses (wings 10–13 m out, lower service or garden wings) stepping down from it, and major outdoor rooms (courtyard, grand terrace, loggia). Avoid one dominant rectangle; the arrangement may be U, L, H or staggered. A six-car garage, a pool of about 16 × 7 m with a large deck, a driveway of 36–40 m, four large garden zones, a guest house, a gazebo and a pool house. Up to ten rooms per floor. It must read as genuinely large from any angle — never as a suburban house.",
  },
};

export const resolveScale = (scale: unknown): ProjectScale => (isProjectScale(scale) ? scale : DEFAULT_PROJECT_SCALE);

// ── Brief → scale ───────────────────────────────────────────────────────────────────────────────────────────────

/** Most specific first: a "luxury cottage" is small, a "luxury estate" is an estate, a "luxury family home" is a family home. */
const SCALE_WORDS: [RegExp, ProjectScale][] = [
  [/\b(mansions?|palatial|palace|megamansion|super[-\s]?mansion)\b/i, "mansion"],
  [/(?<!real\s)\b(estates?|manor|ch[aâ]teau|castle|stately\s+home|country\s+house)\b/i, "estate"],
  [/\b(cottages?|bungalows?|tiny\s+(?:home|house)|micro[-\s]?(?:home|house)|(?:tiny|small|little|compact|micro)\s+(?:\w+\s+)?(?:home|house|cabin|villa|dwelling|residence|retreat))\b/i, "cottage"],
  [/\b(family\s+(?:home|house|residence)|suburban\s+(?:home|house)|(?:three|four|3|4)[-\s]bed(?:room)?)\b/i, "family"],
  [/\b(luxur\w*|high[-\s]end|upscale|lavish|sprawling|(?:large|big|huge)\s+(?:\w+\s+)?(?:home|house|villa))\b/i, "luxury"],
];

/** The scale a brief states outright ("small cottage", "luxury home", "mansion"); undefined when it doesn't say. */
export function inferScaleFromBrief(brief: string): ProjectScale | undefined {
  return SCALE_WORDS.find(([pattern]) => pattern.test(brief))?.[1];
}

/** Whether the brief asks for more than one storey (only matters for a cottage, which is single-storey otherwise). */
export const wantsUpperFloor = (brief: string): boolean => /\b(two|2|three|3)[-\s]?(stor(?:e)?y|floor)s?\b|\b(loft|upper\s+floor|upstairs|multi[-\s]?stor(?:e)?y)\b/i.test(brief);

/** The floor range for a project, letting a brief that asks for a second storey lift a cottage's single floor. */
export function floorRangeFor(profile: ScaleProfile, brief: string): Range {
  if (profile.key === "cottage" && wantsUpperFloor(brief)) return [1, 2];
  return profile.floors;
}

// ── Deterministic variation ─────────────────────────────────────────────────────────────────────────────────────

/** A stable number in [0, 1) for a brief and a salt: the same brief always designs the same way. */
export function briefChance(brief: string, salt: string): number {
  let h = 2166136261;
  const text = `${salt}:${brief.trim().toLowerCase()}`;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** A value (to the nearest half metre) inside `range` at a stable, brief-dependent position between 25% and 75% of it. */
export const pickInRange = (range: Range, brief: string, salt: string): number =>
  Math.round((range[0] + (range[1] - range[0]) * (0.25 + 0.5 * briefChance(brief, salt))) * 2) / 2;

export function describeScales(): string {
  return PROJECT_SCALES.map((s) => `- projectScale "${s}": ${SCALE_PROFILES[s].guidance}`).join("\n");
}
