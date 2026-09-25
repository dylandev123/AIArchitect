import { FEATURE_JSON_KEY, FEATURE_TYPES } from "./features/featureTypes";

/**
 * True when the project JSON has no site features at all — i.e. it is a fresh project that
 * still needs its initial generation. Anything with even one feature is an existing design
 * and must only ever be changed through scoped edits.
 */
export function isBlankSite(jsonText: string): boolean {
  let root: unknown;
  try {
    root = JSON.parse(jsonText);
  } catch {
    return false;
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) return false;
  const record = root as Record<string, unknown>;
  return FEATURE_TYPES.every((type) => {
    const arr = record[FEATURE_JSON_KEY[type]];
    return arr === undefined || (Array.isArray(arr) && arr.length === 0);
  });
}

/** A never-designed project: empty site and still on its first version, so its next prompt is the initial brief. */
export function needsInitialGeneration(project: { houseConfigJson: string; currentVersionIndex: number }): boolean {
  return project.currentVersionIndex === 0 && isBlankSite(project.houseConfigJson);
}
