import type {
  ColumnStyleKey,
  DoorStyleKey,
  MaterialType,
  MaterialsConfig,
  RoofType,
  RailingStyleKey,
  StyleKey,
  SurfaceKey,
  WallFinishKey,
  WindowStyleKey,
} from "@/types/house";

/** All exterior option fields guaranteed-filled after composition. */
export interface ResolvedExteriorOptions {
  style:         StyleKey;
  wallFinish:    WallFinishKey;
  windowStyle:   WindowStyleKey;
  doorStyle:     DoorStyleKey;
  railingStyle:  RailingStyleKey;
  columnStyle:   ColumnStyleKey;
  patioSurface:  SurfaceKey;
  poolTile:      SurfaceKey;
}

// ── Cladding detail ───────────────────────────────────────────────────────────

/** Describes procedural geometry layered onto the structural wall surface. */
export interface CladdingDetail {
  kind:           "horizontal-bands" | "vertical-strips";
  /** Metres between the centre of adjacent bands/strips. */
  spacing:        number;
  /** How far (m) the element projects outward from the wall face. */
  projection:     number;
  /** Height (m) of each horizontal band, or width (m) of each vertical strip. */
  elementSize:    number;
}

// ── Wall finishes ─────────────────────────────────────────────────────────────

export interface WallFinishEntry {
  key:              WallFinishKey;
  label:            string;
  description:      string;
  materialType:     MaterialType;
  defaultColor:     string;
  roughness:        number;
  metalness:        number;
  compatibleStyles: StyleKey[];
  cladding?:        CladdingDetail;
}

// ── Roof forms ────────────────────────────────────────────────────────────────

export interface RoofFormEntry {
  key:              RoofType;
  label:            string;
  description:      string;
  compatibleStyles: StyleKey[];
}

// ── Surfaces (floors, patios, pool tile) ─────────────────────────────────────

export interface SurfaceEntry {
  key:              SurfaceKey;
  label:            string;
  description:      string;
  materialType:     MaterialType;
  defaultColor:     string;
  roughness:        number;
  metalness:        number;
  compatibleStyles: StyleKey[];
}

// ── Window styles ─────────────────────────────────────────────────────────────

export interface WindowStyleEntry {
  key:              WindowStyleKey;
  label:            string;
  description:      string;
  compatibleStyles: StyleKey[];
  /** Number of horizontal rails dividing the glass (0 = none, 1 = centre rail). */
  mullions:         number;
  /** Add a triMesh arch cap above the frame. */
  archTop:          boolean;
  /** Replace glass with N horizontal louver slats (0 = standard glass). */
  louvers:          number;
  /** Scale factor for the frame border width (1.0 = default). */
  frameScale:       number;
}

// ── Door styles ───────────────────────────────────────────────────────────────

export interface DoorStyleEntry {
  key:              DoorStyleKey;
  label:            string;
  description:      string;
  compatibleStyles: StyleKey[];
  /** Number of raised panel boxes to overlay (0 = flush). */
  panels:           number;
  /** Fraction of door height that is glazed (top portion). 0 = solid. */
  glassRatio:       number;
  /** Split into two narrower sub-panels. */
  double:           boolean;
}

// ── Railing styles ────────────────────────────────────────────────────────────

export type RailingKind = "posts" | "cables" | "glass" | "solid";

export interface RailingStyleEntry {
  key:              RailingStyleKey;
  label:            string;
  description:      string;
  compatibleStyles: StyleKey[];
  kind:             RailingKind;
  /** Posts or cables per metre of railing length. */
  density:          number;
  /** Cross-section size (m) of each baluster / cable. */
  elementSize:      number;
  /** Whether elements are horizontal (cables) rather than vertical (pickets). */
  horizontal:       boolean;
  transparent:      boolean;
  opacity:          number;
  color:            string;
  roughness:        number;
  metalness:        number;
}

// ── Column / trim styles ──────────────────────────────────────────────────────

export interface ColumnStyleEntry {
  key:              ColumnStyleKey;
  label:            string;
  description:      string;
  compatibleStyles: StyleKey[];
  /** Footprint side length (m) — square cross section. */
  size:             number;
  /** How far (m) the column projects beyond the wall face. */
  projection:       number;
  /** Generate a wider capital at top + base at bottom. */
  capital:          boolean;
  /** Override color (defaults to trim material). */
  color?:           string;
  roughness?:       number;
  metalness?:       number;
}

// ── Style presets ─────────────────────────────────────────────────────────────

export interface StylePreset {
  key:         StyleKey;
  label:       string;
  description: string;
  roofType:    RoofType;
  defaults: {
    wallFinish:   WallFinishKey;
    windowStyle:  WindowStyleKey;
    doorStyle:    DoorStyleKey;
    railingStyle: RailingStyleKey;
    columnStyle:  ColumnStyleKey;
    patioSurface: SurfaceKey;
    poolTile:     SurfaceKey;
  };
  materials: MaterialsConfig;
}
