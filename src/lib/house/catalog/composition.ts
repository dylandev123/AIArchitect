import type {
  ColumnStyleKey,
  DoorStyleKey,
  ExteriorOptions,
  HouseConfig,
  RailingStyleKey,
  StyleKey,
  SurfaceKey,
  WallFinishKey,
  WindowStyleKey,
} from "@/types/house";
import type { ResolvedExteriorOptions } from "./types";
import { STYLE_PRESETS } from "./styles";
import { WALL_FINISHES } from "./wallFinishes";
import { RAILING_STYLES } from "./railings";
import { COLUMN_STYLES } from "./columns";
import { WINDOW_STYLES } from "./openings";
import { DOOR_STYLES } from "./openings";

// ── Universal fallbacks ────────────────────────────────────────────────────────

const DEFAULTS: ResolvedExteriorOptions = {
  style:         "modern-minimalist",
  wallFinish:    "smooth-stucco",
  windowStyle:   "casement",
  doorStyle:     "flush",
  railingStyle:  "iron",
  columnStyle:   "square-pilaster",
  patioSurface:  "concrete",
  poolTile:      "mosaic-tile",
};

// ── Compatibility matrix ──────────────────────────────────────────────────────
// Maps each option key to the styles it works well with.
// Used to warn (not block) when a mixed combination is unusual.

function compatible(opts: ResolvedExteriorOptions): string[] {
  const warnings: string[] = [];

  const wallEntry   = WALL_FINISHES[opts.wallFinish];
  const railEntry   = RAILING_STYLES[opts.railingStyle];
  const colEntry    = COLUMN_STYLES[opts.columnStyle];
  const winEntry    = WINDOW_STYLES[opts.windowStyle];
  const doorEntry   = DOOR_STYLES[opts.doorStyle];

  const checkEntry = (name: string, compatStyles: StyleKey[]) => {
    if (compatStyles.length > 0 && !compatStyles.includes(opts.style)) {
      warnings.push(`${name} is not typical for "${opts.style}" — but it will render fine.`);
    }
  };

  checkEntry(`Wall finish "${wallEntry.label}"`,  wallEntry.compatibleStyles);
  checkEntry(`Railing "${railEntry.label}"`,       railEntry.compatibleStyles);
  checkEntry(`Column "${colEntry.label}"`,         colEntry.compatibleStyles);
  checkEntry(`Window "${winEntry.label}"`,         winEntry.compatibleStyles);
  checkEntry(`Door "${doorEntry.label}"`,          doorEntry.compatibleStyles);

  return warnings;
}

// ── Composition engine ────────────────────────────────────────────────────────

/**
 * Fills every field of ExteriorOptions:
 * 1. If `style` is set, look up its preset defaults.
 * 2. Individual field overrides in `raw` win over style defaults.
 * 3. Universal fallbacks fill anything still missing.
 *
 * Returns the fully-resolved options and any compatibility warnings.
 */
export function composeExteriorOptions(
  raw: ExteriorOptions,
  _house: HouseConfig,
): { opts: ResolvedExteriorOptions; warnings: string[] } {
  const style: StyleKey = raw.style ?? DEFAULTS.style;
  const preset = STYLE_PRESETS[style]?.defaults ?? DEFAULTS;

  const safeStr = (v: unknown): string | undefined =>
    typeof v === "string" && v.length > 0 ? v : undefined;
  const safePos = (v: unknown): number | undefined =>
    typeof v === "number" && v > 0 ? v : undefined;

  const opts: ResolvedExteriorOptions = {
    style,
    wallFinish:   safeWallFinish(  raw.wallFinish   ?? preset.wallFinish   ?? DEFAULTS.wallFinish),
    windowStyle:  safeWindowStyle( raw.windowStyle  ?? preset.windowStyle  ?? DEFAULTS.windowStyle),
    doorStyle:    safeDoorStyle(   raw.doorStyle     ?? preset.doorStyle    ?? DEFAULTS.doorStyle),
    railingStyle: safeRailing(     raw.railingStyle  ?? preset.railingStyle ?? DEFAULTS.railingStyle),
    columnStyle:  safeColumn(      raw.columnStyle   ?? preset.columnStyle  ?? DEFAULTS.columnStyle),
    patioSurface: safeSurface(     raw.patioSurface  ?? preset.patioSurface ?? DEFAULTS.patioSurface),
    poolTile:     safeSurface(     raw.poolTile      ?? preset.poolTile     ?? DEFAULTS.poolTile),
    patioAssetId:    safeStr(raw.patioAssetId),
    patioUvScale:    safePos(raw.patioUvScale),
    poolAssetId:     safeStr(raw.poolAssetId),
    poolUvScale:     safePos(raw.poolUvScale),
    drivewayAssetId: safeStr(raw.drivewayAssetId),
    drivewayUvScale: safePos(raw.drivewayUvScale),
  };

  return { opts, warnings: compatible(opts) };
}

// ── Safe cast helpers ─────────────────────────────────────────────────────────
// Fall back to universal default when an unknown string sneaks through from JSON.

const WALL_FINISH_KEYS   = new Set<WallFinishKey>  (["smooth-stucco","rough-stucco","board-batten","horizontal-lap","brick","stone-veneer","cedar-shingle","corrugated-metal","venetian-plaster","split-face-block"]);
const WINDOW_STYLE_KEYS  = new Set<WindowStyleKey> (["casement","double-hung","picture","arched","louvered"]);
const DOOR_STYLE_KEYS    = new Set<DoorStyleKey>   (["flush","paneled","glass-panel","double","pivot"]);
const RAILING_STYLE_KEYS = new Set<RailingStyleKey>(["iron","cable","glass-panel","timber","concrete-wall","picket"]);
const COLUMN_STYLE_KEYS  = new Set<ColumnStyleKey> (["none","square-pilaster","craftsman-post","steel-section","board-strip"]);
const SURFACE_KEYS       = new Set<SurfaceKey>     (["concrete","travertine","slate-tile","terracotta","pebble","brick-paver","teak-deck","mosaic-tile"]);

function safeWallFinish  (v: string): WallFinishKey   { return WALL_FINISH_KEYS.has(v as WallFinishKey)     ? v as WallFinishKey    : DEFAULTS.wallFinish;   }
function safeWindowStyle (v: string): WindowStyleKey  { return WINDOW_STYLE_KEYS.has(v as WindowStyleKey)   ? v as WindowStyleKey   : DEFAULTS.windowStyle;  }
function safeDoorStyle   (v: string): DoorStyleKey    { return DOOR_STYLE_KEYS.has(v as DoorStyleKey)       ? v as DoorStyleKey     : DEFAULTS.doorStyle;    }
function safeRailing     (v: string): RailingStyleKey { return RAILING_STYLE_KEYS.has(v as RailingStyleKey) ? v as RailingStyleKey  : DEFAULTS.railingStyle; }
function safeColumn      (v: string): ColumnStyleKey  { return COLUMN_STYLE_KEYS.has(v as ColumnStyleKey)   ? v as ColumnStyleKey   : DEFAULTS.columnStyle;  }
function safeSurface     (v: string): SurfaceKey      { return SURFACE_KEYS.has(v as SurfaceKey)            ? v as SurfaceKey       : DEFAULTS.patioSurface; }
