/** Retired authors remain available to offline replay and saved-project tooling only.
 * No environment flag can re-enable them as a new-house provider authority. */
export function legacyHouseAuthoringEnabled(): boolean { return false; }
/** True when a request must be answered by the canonical plan pipeline (or refused by a
 * retired endpoint). Production has exactly one answer; only the isolated retired-author
 * test project replaces this module to exercise the retained historical author code. */
export function canonicalGenerationRequired(mode: unknown): boolean { return mode === 'generate' && !legacyHouseAuthoringEnabled(); }
