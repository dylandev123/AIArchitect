/**
 * The staged pipeline is retained only for deliberate debugging.  Do not coerce this
 * value: only the literal string "1" can select it.
 */
export type ArchitectureGenerationMode = "single-architect" | "legacy-staged";

export function architectureGenerationMode(env?: { AI_ARCHITECT_LEGACY_PIPELINE?: string | undefined }): ArchitectureGenerationMode {
  const legacyValue = env ? env.AI_ARCHITECT_LEGACY_PIPELINE : process.env.AI_ARCHITECT_LEGACY_PIPELINE;
  return legacyValue === "1" ? "legacy-staged" : "single-architect";
}
