import type { ArchitecturalDesignDocument } from "./document";
const pending = { status: "pending" as const };
const base = (brief: string): Omit<ArchitecturalDesignDocument, "massing" | "roofs"> => ({ version: 1, brief, siteStrategy: { environment: "beach", viewDirection: "south", arrivalDirection: "north", terrain: "level" }, facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending, metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" } });
export const ARCHITECTURE_FIXTURES: Record<string, ArchitecturalDesignDocument> = {
  modernTropicalCourtyardVilla: { ...base("Modern Tropical Courtyard Villa"), massing: { composition: "u-shaped", masses: [
    { id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 4 }, width: 16, depth: 5, floors: 1, elevation: 0, rotation: 0 },
    { id: "west", name: "West Bedroom Wing", role: "bedroom-wing", position: { x: -5.5, z: -2 }, width: 5, depth: 12, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "surrounds-courtyard", target: "living", side: "west", distance: 3 }] },
    { id: "east", name: "East Guest Wing", role: "guest-pavilion", position: { x: 5.5, z: -2 }, width: 5, depth: 12, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "surrounds-courtyard", target: "living", side: "east", distance: 3 }] },
  ] }, roofs: { recipes: [{ id: "living-roof", massId: "living", kind: "floating-flat" }, { id: "west-roof", massId: "west", kind: "mono-pitch" }, { id: "east-roof", massId: "east", kind: "flat" }] } },
  caribbeanPavilionEstate: { ...base("Caribbean Pavilion Estate"), massing: { composition: "pavilion-cluster", masses: [
    { id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 12, depth: 9, floors: 1, elevation: 0, rotation: 0 },
    { id: "guest", name: "Guest Pavilion", role: "guest-pavilion", position: { x: 15, z: -3 }, width: 7, depth: 7, floors: 1, elevation: 0, rotation: .18, relationships: [{ kind: "separated-from", target: "living", distance: 3 }] },
    { id: "bridge", name: "Covered Connector", role: "connector", position: { x: 7.5, z: -1.5 }, width: 6, depth: 2.5, floors: 1, elevation: 0, rotation: -.18, relationships: [{ kind: "bridge-between", target: "living" }] },
    { id: "garage", name: "Garage", role: "garage", position: { x: -13, z: 2 }, width: 7, depth: 6, floors: 1, elevation: 0, rotation: 0 },
  ] }, roofs: { recipes: [{ id: "living", massId: "living", kind: "pavilion" }, { id: "guest", massId: "guest", kind: "hip" }, { id: "bridge", massId: "bridge", kind: "gable" }, { id: "garage", massId: "garage", kind: "flat" }] } },
  contemporaryHillsideHouse: { ...base("Contemporary Hillside House"), siteStrategy: { environment: "hillside", viewDirection: "south", arrivalDirection: "north", terrain: "stepped" }, massing: { composition: "stepped-terraces", masses: [
    { id: "living", name: "Lower Living Volume", role: "main-living", position: { x: 0, z: 2 }, width: 14, depth: 7, floors: 1, elevation: 0, rotation: 0 },
    { id: "upper", name: "Upper Bedroom Wing", role: "bedroom-wing", position: { x: 5, z: -5 }, width: 10, depth: 5, floors: 1, elevation: 2.2, rotation: .35, relationships: [{ kind: "stepped-above", target: "living", distance: 2.2 }, { kind: "offset-from", target: "living" }] },
    { id: "studio", name: "Detached Studio", role: "guest-pavilion", position: { x: -11, z: -5 }, width: 6, depth: 5, floors: 1, elevation: 1.1, rotation: -.2 },
  ] }, roofs: { recipes: [{ id: "living", massId: "living", kind: "flat" }, { id: "upper", massId: "upper", kind: "shed" }, { id: "studio", massId: "studio", kind: "flat" }] } },
  /** Deterministic, non-AI visual proof that the live compile/render path is active: distinct masses, varied roofs, a courtyard, and a real capability outcome. */
  modernTropicalPavilionHouse: { ...base("Modern Tropical Pavilion House"), massing: { composition: "pavilion-cluster", masses: [
    { id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 4 }, width: 15, depth: 8, floors: 1, elevation: 0, rotation: 0 },
    { id: "bedroom", name: "Bedroom Wing", role: "bedroom-wing", position: { x: -11, z: -4 }, width: 9, depth: 6, floors: 1, elevation: 0, rotation: .3, relationships: [{ kind: "offset-from", target: "living" }] },
    { id: "guest", name: "Detached Guest Pavilion", role: "guest-pavilion", position: { x: 11, z: -3 }, width: 7, depth: 7, floors: 1, elevation: 0, rotation: -.18, relationships: [{ kind: "separated-from", target: "living", distance: 4 }, { kind: "surrounds-courtyard", target: "living" }] },
    { id: "garage", name: "Garage", role: "garage", position: { x: -9, z: 7 }, width: 6, depth: 6, floors: 1, elevation: 0, rotation: 0 },
  ] }, roofs: { recipes: [
    { id: "living-roof", massId: "living", kind: "floating-flat", overhang: 1.3, expression: { verticalGap: .6, supportStyle: "clerestory", clerestoryHeight: .45 } },
    { id: "bedroom-roof", massId: "bedroom", kind: "mono-pitch", overhang: .5 },
    { id: "guest-roof", massId: "guest", kind: "pavilion" },
    { id: "garage-roof", massId: "garage", kind: "flat", overhang: .4 },
  ] }, capabilities: [{ id: "corner-glazing", stage: "fixture", parameters: { massId: "living" } }] },

  // ── Architecture Engine V2 validation fixtures ──────────────────────────────────────────────────
  // Deterministic, non-AI proof that the articulated-geometry vocabulary (recess/projection/notch/
  // entry-recess/glazing-zone/opening-rhythm) plus the now-active surrounds-courtyard/view-facing/
  // arrival-facing relationships produce genuinely different shells, not the same box with a new roof.

  /** 3 masses, a real courtyard void, a recessed+glazed living facade, a projecting veranda, corner glazing and a mixed roof hierarchy. */
  tropicalCourtyardVilla: { ...base("Tropical Courtyard Villa"), massing: { composition: "courtyard", masses: [
    { id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 9, floors: 1, elevation: 0, rotation: 0,
      operations: [
        { type: "entry-recess", facade: "north", width: 2.6, depth: 1.2 },
        { type: "projection", facade: "west", start: 0.1, end: 0.7, depth: 1.8 },
      ],
      openings: [{ type: "glazing-zone", facade: "south", start: 0.1, end: 0.9, heightRatio: 0.85 }],
    },
    { id: "west-wing", name: "West Bedroom Wing", role: "bedroom-wing", position: { x: -14, z: -4 }, width: 6, depth: 12, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "surrounds-courtyard", target: "living", side: "west", distance: 3 }],
      openings: [{ type: "opening-rhythm", facade: "west", count: 3, width: 1.2, height: 1.4, sill: 0.8 }],
    },
    { id: "east-wing", name: "East Guest Wing", role: "guest-pavilion", position: { x: 14, z: -4 }, width: 6, depth: 12, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "surrounds-courtyard", target: "living", side: "east", distance: 3 }],
    },
  ] }, roofs: { recipes: [
    { id: "living-roof", massId: "living", kind: "floating-flat", overhang: 1.2, expression: { verticalGap: .5, supportStyle: "clerestory", clerestoryHeight: .4 } },
    { id: "west-wing-roof", massId: "west-wing", kind: "mono-pitch", overhang: .6 },
    { id: "east-wing-roof", massId: "east-wing", kind: "hip", overhang: .6 },
  ] }, capabilities: [{ id: "corner-glazing", stage: "fixture", parameters: { massId: "living" } }] },

  /** Two floors: the ground floor is recessed/shaded, the upper floor cantilevers out with generous glazing — a visibly different silhouette top vs. bottom, not a taller version of the same box. */
  cantileverHouse: { ...base("Cantilever House"), massing: { composition: "rectangular-pavilion", masses: [
    { id: "tower", name: "Cantilever Volume", role: "main-living", position: { x: 0, z: 0 }, width: 12, depth: 9, floors: 2, elevation: 0, rotation: 0,
      cantilever: { direction: "south", distance: 2.2 },
      operations: [{ type: "recess", facade: "south", start: 0.1, end: 0.9, depth: 1.6, floors: "ground" }],
      openings: [
        { type: "glazing-zone", facade: "south", start: 0.05, end: 0.95, heightRatio: 0.82, floors: "upper" },
        { type: "opening-rhythm", facade: "west", count: 2, width: 1.1, height: 1.3, sill: 0.9 },
      ],
    },
  ] }, roofs: { recipes: [{ id: "tower-roof", massId: "tower", kind: "floating-flat", overhang: 1.0 }] } },

  /** A genuinely L-shaped single-mass footprint (one corner notch, not a rectangle with a roof trick), with a protected patio pavilion sitting in the crook and its own distinct roof. */
  lShapedTropicalHouse: { ...base("L-Shaped Tropical House"), massing: { composition: "l-shaped", masses: [
    { id: "main", name: "Living & Bedroom Wing", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 12, floors: 1, elevation: 0, rotation: 0,
      operations: [{ type: "notch", corner: "se", width: 7, depth: 6 }],
      openings: [
        { type: "glazing-zone", facade: "south", start: 0.05, end: 0.5, heightRatio: 0.8 },
        { type: "opening-rhythm", facade: "west", count: 3, width: 1.2, height: 1.4, sill: 0.8 },
      ],
    },
    { id: "porch", name: "Covered Patio Pavilion", role: "terrace", position: { x: 4.5, z: 3 }, width: 6, depth: 5, floors: 1, elevation: 0, rotation: 0 },
  ] }, roofs: { recipes: [
    { id: "main-roof", massId: "main", kind: "hip", overhang: .8 },
    { id: "porch-roof", massId: "porch", kind: "gable", overhang: .6 },
  ] } },

  /** Detached, differently-rotated pavilions at different scales/heights (hierarchy between main and secondary buildings), joined by a procedural covered breezeway. */
  pavilionCompound: { ...base("Pavilion Compound"), massing: { composition: "pavilion-cluster", masses: [
    { id: "main", name: "Main Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 14, depth: 9, floors: 1, elevation: 0, rotation: 0,
      openings: [{ type: "glazing-zone", facade: "south", start: 0.1, end: 0.9, heightRatio: 0.82 }],
    },
    { id: "guest", name: "Guest Pavilion", role: "guest-pavilion", position: { x: 16, z: -2 }, width: 7, depth: 7, floors: 1, elevation: 0, rotation: .35,
      relationships: [{ kind: "separated-from", target: "main", side: "east", distance: 5 }],
    },
    { id: "service", name: "Service Pavilion", role: "service", position: { x: -13, z: 5 }, width: 6, depth: 5, floors: 1, elevation: 0, rotation: -.5,
      relationships: [{ kind: "separated-from", target: "main", side: "west", distance: 4 }],
    },
  ] }, roofs: { recipes: [
    { id: "main-roof", massId: "main", kind: "pavilion", overhang: 1.0 },
    { id: "guest-roof", massId: "guest", kind: "hip", overhang: .6 },
    { id: "service-roof", massId: "service", kind: "flat", overhang: .4 },
  ] }, capabilities: [{ id: "bridge-masses", stage: "fixture", parameters: { massId: "main", secondaryMassId: "guest", width: 2.4 } }] },

  /**
   * The Part 8 visual-regression fixture: everything the design-quality pass adds, in one deterministic,
   * non-AI composition, compiled through the exact same `compileArchitecture` as live generation — a
   * dominant floating-roofed living pavilion; a real 2-wing courtyard (auto-oriented inward, see
   * `computeCourtyards`/`resolveMasses`); a recessed, canopied arrival; a deep open-air covered terrace
   * (projection with `open`/`postSpacing`) facing the courtyard; courtyard-facing glazing on both wings, one
   * heavily framed, one recessed; a corner-glazing detail on the untouched corner; a connector + a small
   * quiet service pavilion beyond it (roof hierarchy: dominant floating roof vs. progressively lighter
   * secondary/connector/service roofs); and one articulated (notched) footprint on the dominant mass.
   */
  luxuryTropicalCourtyardVillaV2: { ...base("Luxury Tropical Courtyard Villa V2"), massing: { composition: "courtyard", masses: [
    { id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 18, depth: 10, floors: 1, elevation: 0, rotation: 0,
      operations: [
        { type: "entry-recess", facade: "north", width: 3.2, depth: 1.3 },
        { type: "notch", corner: "sw", width: 3, depth: 2.5 },
        { type: "projection", facade: "south", start: 0.15, end: 0.85, depth: 2.6, open: true, postSpacing: 2.4 },
      ],
      openings: [
        { type: "glazing-zone", facade: "south", start: .08, end: .92, heightRatio: .9, frame: true },
        { type: "glazing-zone", facade: "east", start: .18, end: .82, heightRatio: .82, reveal: .18 },
        { type: "door", facade: "north", start: .4, end: .6, height: 2.5, frame: true, reveal: .18 },
      ],
    },
    { id: "west-wing", name: "West Bedroom Wing", role: "bedroom-wing", position: { x: -15, z: 0 }, width: 6, depth: 13, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "surrounds-courtyard", target: "living", side: "west", distance: 3 }],
      openings: [
        { type: "glazing-zone", facade: "south", start: 0.1, end: 0.9, heightRatio: 0.85, frame: true },
        { type: "opening-rhythm", facade: "north", count: 3, width: 1.0, height: 1.3, sill: 0.9 },
      ],
    },
    { id: "east-wing", name: "East Guest Wing", role: "guest-pavilion", position: { x: 15, z: 0 }, width: 6, depth: 13, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "surrounds-courtyard", target: "living", side: "east", distance: 3 }],
      openings: [{ type: "glazing-zone", facade: "south", start: 0.1, end: 0.9, heightRatio: 0.8, reveal: 0.3 }],
    },
    { id: "connector", name: "Covered Connector", role: "connector", position: { x: 22.5, z: 0 }, width: 5, depth: 2.4, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "bridge-between", target: "east-wing", side: "east", distance: 1.2 }],
      operations: [{ type: "projection", facade: "south", start: 0, end: 1, depth: .7, open: true, postSpacing: 2 }],
    },
    { id: "service", name: "Service Pavilion", role: "service", position: { x: 30, z: 0 }, width: 6, depth: 5, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "adjacent-to", target: "connector", side: "east", distance: 1.5 }],
      openings: [{ type: "opening-rhythm", facade: "south", count: 2, width: 1.0, height: 1.2, sill: 0.9 }],
    },
  ] }, roofs: { recipes: [
    { id: "living-roof", massId: "living", kind: "floating-flat", overhang: 1.3, expression: { verticalGap: .5, supportStyle: "clerestory", clerestoryHeight: .45 } },
    { id: "west-wing-roof", massId: "west-wing", kind: "mono-pitch", overhang: .7 },
    { id: "east-wing-roof", massId: "east-wing", kind: "hip", overhang: .7 },
    { id: "connector-roof", massId: "connector", kind: "flat", overhang: .35 },
    { id: "service-roof", massId: "service", kind: "flat", overhang: .35 },
  ] }, capabilities: [
    { id: "corner-glazing", stage: "fixture", parameters: { massId: "living" } },
    { id: "entry-canopy", stage: "fixture", parameters: { massId: "living", facade: "north", width: 3.2, depth: 1.6, height: 2.8 } },
  ] },

  /**
   * DEV-ONLY diagnostic fixture, not a design reference — every dimension here is deliberately oversized and
   * round so the effect of each operation is unmistakable at a glance (no 0.3–0.8m changes that could be
   * mistaken for noise). Built to answer one question with the compiled output alone: does an intentionally
   * extreme, unambiguous articulated document actually compile into a visibly non-rectangular building? If
   * this fixture still reads as a box, the compiler — not the fixture — is the bottleneck.
   *
   * Covers, in one composition: an L-shaped mass (corner notch), a 3m recess, a 3m open veranda projection
   * (posts), a partial/setback upper floor (an upper-floor-only recess, so floor 2 is visibly smaller than
   * floor 1), a huge entrance recess, a full-height glazing wall, a detached pavilion with no relationship to
   * anything else, and a floating covered breezeway bridging two masses across an 8m gap.
   */
  architectureCompilerStressFixture: { ...base("DEV: Architecture Compiler Stress Test"), massing: { composition: "l-shaped", masses: [
    { id: "main", name: "Main L-Shaped Volume", role: "main-living", position: { x: 0, z: 0 }, width: 24, depth: 16, floors: 2, elevation: 0, rotation: 0,
      operations: [
        { type: "notch", corner: "se", width: 8, depth: 7 },
        { type: "entry-recess", facade: "north", width: 5, depth: 3 },
        { type: "recess", facade: "west", start: 0.15, end: 0.55, depth: 3, floors: "ground" },
        { type: "recess", facade: "west", start: 0.1, end: 0.9, depth: 2.5, floors: "upper" },
        { type: "projection", facade: "south", start: 0.1, end: 0.5, depth: 3, open: true, postSpacing: 2.5, floors: "ground" },
      ],
      openings: [{ type: "glazing-zone", facade: "east", start: 0.05, end: 0.95, heightRatio: 0.95, frame: true }],
    },
    { id: "bedroom-wing", name: "Bedroom Wing", role: "bedroom-wing", position: { x: 0, z: 0 }, width: 6, depth: 16, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "separated-from", target: "main", side: "east", distance: 8 }],
      openings: [{ type: "opening-rhythm", facade: "south", count: 5, width: 1.1, height: 1.4, sill: 0.9 }],
    },
    { id: "breezeway", name: "Covered Breezeway", role: "connector", position: { x: 0, z: 0 }, width: 4, depth: 3, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "bridge-between", target: "main", side: "east", distance: 2 }],
      operations: [{ type: "projection", facade: "south", start: 0, end: 1, depth: 1.5, open: true, postSpacing: 2 }],
    },
    { id: "pavilion", name: "Detached Guest Pavilion", role: "guest-pavilion", position: { x: -30, z: 18 }, width: 8, depth: 8, floors: 1, elevation: 0, rotation: 0 },
  ] }, roofs: { recipes: [
    { id: "main-roof", massId: "main", kind: "floating-flat", overhang: 1.5, expression: { verticalGap: .5, supportStyle: "clerestory", clerestoryHeight: .45 } },
    { id: "bedroom-wing-roof", massId: "bedroom-wing", kind: "mono-pitch", overhang: .6 },
    { id: "breezeway-roof", massId: "breezeway", kind: "flat", overhang: .4 },
    { id: "pavilion-roof", massId: "pavilion", kind: "hip", overhang: .8 },
  ] } },

  /**
   * DEV-ONLY visual proof of the V2 geometry vocabulary composing into a recognizable modern house with plain
   * materials — no AI. A plan first, then construction from primitives, not a stack of extruded boxes:
   *
   * - `ground`: a long, low, single-storey living pavilion under a thin, deep-eaved flat slab. Its arrival
   *   (north) side is solid except for a recessed entry under a freestanding entry canopy; its view (south)
   *   side opens up — a covered terrace carved into the footprint (an open projection framed by two solid
   *   side fin walls under the same roof slab), framed full-height glazing, and a glazed angled prow
   *   (`chamfer` + `glazed`) at the south-east corner turning toward the garden, with the square roof slab
   *   left over it so the cut reads as a sheltered wedge rather than a missing corner.
   * - `upper`: a solid bedroom box resting on the ground pavilion's west end and cantilevering 8m further
   *   west over an open carport, propped only where it's actually unsupported (`pilotis` skips columns that
   *   would stand inside the pavilion below). Crisp parapet roof (`parapet`, zero overhang), vertical slot
   *   windows to the street, and a continuous south strip window shaded by vertical fins (`brise-soleil`).
   * - `garage`: a quiet parapet-roofed block facing arrival, set forward of the house.
   */
  architectureCapabilityHouse: { ...base("DEV: Architecture Capability House"), siteStrategy: { environment: "suburban", viewDirection: "south", arrivalDirection: "north", terrain: "level" }, massing: { composition: "pavilion-cluster", masses: [
    { id: "ground", name: "Ground Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 16, depth: 10, floors: 1, elevation: 0, rotation: 0,
      operations: [
        { type: "entry-recess", facade: "north", width: 3.6, depth: 1.4 },
        { type: "projection", facade: "south", start: 0.04, end: 0.46, depth: 3, open: true },
        { type: "notch", corner: "nw", width: 2.8, depth: 2.2 },
        { type: "chamfer", corner: "se", size: 3.5, glazed: true },
      ],
      openings: [
        { type: "glazing-zone", facade: "south", start: 0.5, end: 0.98, heightRatio: 0.9, frame: true },
        { type: "glazing-zone", facade: "east", start: 0.1, end: 0.6, heightRatio: 0.7, reveal: 0.2 },
        { type: "opening-rhythm", facade: "west", count: 2, width: 0.7, height: 2.2, sill: 0.3 },
      ],
    },
    { id: "upper", name: "Cantilevered Bedroom Box", role: "bedroom-wing", position: { x: -10, z: -0.75 }, width: 12, depth: 7.5, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "stepped-above", target: "ground", distance: 3.45 }, { kind: "connected-to", target: "ground" }],
      openings: [
        { type: "glazing-zone", facade: "south", start: 0.06, end: 0.94, heightRatio: 0.62, reveal: 0.25 },
        { type: "opening-rhythm", facade: "north", count: 4, width: 0.6, height: 2, sill: 0.4 },
        { type: "glazing-zone", facade: "west", start: 0.2, end: 0.8, heightRatio: 0.55, frame: true },
      ],
    },
    { id: "garage", name: "Garage", role: "garage", position: { x: 7.5, z: 0 }, width: 6.5, depth: 6, floors: 1, elevation: 0, rotation: 0,
      relationships: [{ kind: "adjacent-to", target: "ground", side: "north", distance: 2.5 }],
      openings: [{ type: "door", facade: "north", start: 0.12, end: 0.88, height: 2.5 }],
    },
  ] }, roofs: { recipes: [
    { id: "ground-roof", massId: "ground", kind: "flat", overhang: 1.0 },
    { id: "upper-roof", massId: "upper", kind: "flat", overhang: 0, parapet: { height: 0.5, thickness: 0.2 } },
    { id: "garage-roof", massId: "garage", kind: "flat", overhang: 0, parapet: { height: 0.35 } },
  ] }, capabilities: [
    { id: "entry-canopy", stage: "fixture", parameters: { massId: "ground", facade: "north", width: 4.4, depth: 2.2, height: 2.9 } },
    { id: "pilotis", stage: "fixture", parameters: { massId: "upper", columnSize: 0.3, inset: 0.5 } },
    { id: "brise-soleil", stage: "fixture", parameters: { massId: "upper", facade: "south", count: 13, depth: 0.55, height: 2.7, sill: 0.3 } },
  ] },
};
