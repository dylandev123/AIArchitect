import type { CompassSide, SiteEnvironment, SiteSettings, TerrainSlope } from "@/types/house";

export const SITE_ENVIRONMENTS: [SiteEnvironment, ...SiteEnvironment[]] = [
  "countryside", "beach", "cliff", "hillside", "farm", "forest", "suburban", "urban",
];
export const COMPASS_SIDES: [CompassSide, ...CompassSide[]] = ["north", "east", "south", "west"];
export const TERRAIN_SLOPES: [TerrainSlope, ...TerrainSlope[]] = ["flat", "gentle", "steep"];

/** Used when a generated design is missing a value: outdoor living south, entrance north. */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  environment: "suburban",
  viewDirection: "south",
  terrainSlope: "flat",
  approachSide: "north",
};

const OPPOSITE: Record<CompassSide, CompassSide> = { north: "south", south: "north", east: "west", west: "east" };
export const oppositeSide = (side: CompassSide): CompassSide => OPPOSITE[side];

/** Unit vector of a compass side in world x/z (x = east, z = south). */
export const SIDE_VECTOR: Record<CompassSide, [number, number]> = {
  north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0],
};

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

/**
 * Reads the optional `site` block. Absent → undefined (legacy look). Present but with bad or
 * missing fields → each field falls back to its default with a warning, never an error, so a
 * hand-edited JSON never breaks the viewport.
 */
export function parseSiteSettings(raw: unknown, warnings: string[]): SiteSettings | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    warnings.push('"site" must be an object — ignoring.');
    return undefined;
  }
  const r = raw as Record<string, unknown>;
  const pick = <T extends string>(key: string, list: readonly T[], fallback: T): T => {
    if (isOneOf(list, r[key])) return r[key] as T;
    warnings.push(
      r[key] === undefined ? `site.${key} missing — using "${fallback}".` : `site.${key}: unknown value ${JSON.stringify(r[key])} — using "${fallback}".`
    );
    return fallback;
  };
  const d = DEFAULT_SITE_SETTINGS;
  const viewDirection = pick("viewDirection", COMPASS_SIDES, d.viewDirection);
  return {
    environment: pick("environment", SITE_ENVIRONMENTS, d.environment),
    viewDirection,
    terrainSlope: pick("terrainSlope", TERRAIN_SLOPES, d.terrainSlope),
    approachSide: pick("approachSide", COMPASS_SIDES, oppositeSide(viewDirection)),
  };
}

// ── Brief → site hints ──────────────────────────────────────────────────────

export interface SiteHints extends Partial<SiteSettings> {
  timeOfDay?: "morning" | "sunset";
}

const ENVIRONMENT_WORDS: [RegExp, SiteEnvironment][] = [
  [/\b(cliff|cliffs|clifftop|cliff-top|bluff|headland|escarpment)\b/i, "cliff"],
  [/\b(beach|beachfront|beachside|seaside|shoreline|oceanfront|sand dunes?|lagoon|coastal)\b/i, "beach"],
  [/\b(hillside|hilltop|hill|mountainside|mountain|alpine|slope|ridge)\b/i, "hillside"],
  [/\b(farm|farmhouse|farmland|ranch|barn|homestead|vineyard|orchard)\b/i, "farm"],
  [/\b(forest|woods|woodland|wooded|jungle|treehouse)\b/i, "forest"],
  [/\b(urban|city|downtown|townhouse|town\s+house|loft|penthouse|inner[- ]city|street\s+corner)\b/i, "urban"],
  [/\b(suburb|suburban|suburbs|cul-de-sac|subdivision|neighbou?rhood)\b/i, "suburban"],
  [/\b(countryside|country|rural|meadow|pasture|prairie|village|cottage)\b/i, "countryside"],
];

const COMPASS_ALT = "(north|east|south|west)(?:ern|ward|wards)?(?:[- ]?(?:facing))?";

/**
 * Cheap keyword read of an explicit brief. Only what the brief clearly states is returned, so
 * the model stays free to decide everything else. "sunrise" means the view is east, "sunset"
 * means west; environment words are checked most-specific first (a "cliff by the sea" is a cliff).
 */
export function inferSiteHints(brief: string): SiteHints {
  const hints: SiteHints = {};

  for (const [pattern, env] of ENVIRONMENT_WORDS) {
    if (pattern.test(brief)) { hints.environment = env; break; }
  }

  // Explicit compass view wins over sun words: "facing north", "north-facing", "views to the west".
  const explicit =
    new RegExp(`\\b(?:facing|faces|overlooking|views?\\s+(?:to|toward|towards|of)|oriented)\\s+(?:the\\s+)?${COMPASS_ALT}\\b`, "i").exec(brief) ??
    new RegExp(`\\b${COMPASS_ALT.replace("(?:[- ]?(?:facing))?", "[- ]facing")}\\b`, "i").exec(brief);
  if (explicit) hints.viewDirection = explicit[1].toLowerCase() as CompassSide;
  else if (/\b(sunrise|sun\s+rise|dawn|morning\s+sun)\b/i.test(brief)) hints.viewDirection = "east";
  else if (/\b(sunset|sun\s+set|dusk|evening\s+sun|golden\s+hour)\b/i.test(brief)) hints.viewDirection = "west";

  if (/\b(sunrise|dawn)\b/i.test(brief)) hints.timeOfDay = "morning";
  else if (/\b(sunset|dusk|golden\s+hour)\b/i.test(brief)) hints.timeOfDay = "sunset";

  if (/\b(steep|precipitous|sheer|dramatic\s+slope)\b/i.test(brief)) hints.terrainSlope = "steep";
  else if (/\b(gentle(?:ly)?\s+slop\w*|gentle\s+hill|slight\s+slope)\b/i.test(brief)) hints.terrainSlope = "gentle";
  else if (/\b(flat|level)\s+(site|land|lot|ground|terrain|plot)\b/i.test(brief)) hints.terrainSlope = "flat";

  const approach = new RegExp(`\\b(?:(?:entrance|entry|driveway|access|road|approach)\\s+(?:from|on|at|via)\\s+(?:the\\s+)?${COMPASS_ALT}|approach(?:ed)?\\s+from\\s+(?:the\\s+)?${COMPASS_ALT})\\b`, "i").exec(brief);
  const approachSide = approach && (approach[1] ?? approach[2]);
  if (approachSide) hints.approachSide = approachSide.toLowerCase() as CompassSide;

  return hints;
}

/**
 * Merges model-chosen settings with the brief's explicit statements (which always win) and
 * makes them coherent: the entrance never faces the view, and a view-side environment
 * (cliff/beach) always has its slope resolved sensibly.
 */
export function resolveSiteSettings(model: Partial<SiteSettings> | undefined, hints: SiteHints): SiteSettings {
  const d = DEFAULT_SITE_SETTINGS;
  const environment = hints.environment ?? model?.environment ?? d.environment;
  const viewDirection = hints.viewDirection ?? model?.viewDirection ?? d.viewDirection;
  let terrainSlope = hints.terrainSlope ?? model?.terrainSlope ?? d.terrainSlope;
  if (environment === "hillside" && terrainSlope === "flat") terrainSlope = "gentle";
  if (environment === "urban") terrainSlope = "flat";

  let approachSide = hints.approachSide ?? model?.approachSide ?? oppositeSide(viewDirection);
  if (approachSide === viewDirection && (hints.approachSide === undefined || hints.viewDirection === undefined)) {
    approachSide = oppositeSide(viewDirection);
  }
  return { environment, viewDirection, terrainSlope, approachSide };
}
