import { FEATURE_TYPES, type FeatureType } from "./featureTypes";

const FEATURE_ID_PATTERN = new RegExp(`^(${FEATURE_TYPES.join("|")})-(\\d+)`);
const FEATURE_KEY_PATTERN = new RegExp(`^(${FEATURE_TYPES.join("|")})-(\\d+)$`);

export interface FeatureRef {
  type: FeatureType;
  index: number;
}

/** Resolves any primitive id (e.g. "window-2-glass" or "garage-0-door") to its owning feature. */
export function parseFeatureMeshId(meshId: string): FeatureRef | null {
  const match = FEATURE_ID_PATTERN.exec(meshId);
  if (!match) return null;
  return { type: match[1] as FeatureType, index: Number(match[2]) };
}

/** Parses a selection key (e.g. "window-2") that exactly identifies a feature group. */
export function parseFeatureKey(key: string): FeatureRef | null {
  const match = FEATURE_KEY_PATTERN.exec(key);
  if (!match) return null;
  return { type: match[1] as FeatureType, index: Number(match[2]) };
}

export function featureKey(ref: FeatureRef): string {
  return `${ref.type}-${ref.index}`;
}
