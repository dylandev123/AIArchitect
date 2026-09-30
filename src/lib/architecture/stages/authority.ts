import type { ArchitecturalDesignDocument } from "../document";
import type { SitePlan } from "../sitePlanContract";

/** Explicit ownership for V2 pipeline artifacts. Downstream stages receive architecture read-only. */
export const STAGE_AUTHORITY = {
  foundation: { reads: [] as const, writes: ["architecture"] as const },
  "mass-expansion": { reads: ["architecture"] as const, writes: ["architecture"] as const },
  "architectural-geometry": { reads: ["architecture"] as const, writes: ["architecture"] as const },
  "roof-composition": { reads: ["architecture"] as const, writes: ["architecture"] as const },
  "site-plan": { reads: ["architecture"] as const, writes: ["sitePlan"] as const },
  "final-assembly": { reads: ["architecture", "sitePlan"] as const, writes: ["sceneSupport"] as const },
  "asset-placement": { reads: ["architecture", "sitePlan"] as const, writes: ["sitePlan", "sceneSupport"] as const },
} as const;

export type AuthorityStage = keyof typeof STAGE_AUTHORITY;

/** Stable enough for a boundary guard; metadata timestamps never affect geometry authority. */
export function architectureAuthorityHash(document: ArchitecturalDesignDocument): string {
  const { metadata: _metadata, ...owned } = document;
  return JSON.stringify(owned);
}

/** The canonical Site Plan's fingerprint, taken when the Site Plan stage accepts it (after endpoint snapping). */
export function sitePlanAuthorityHash(plan: SitePlan): string {
  return JSON.stringify(plan);
}

export function assertArchitectureReadOnly(stage: Exclude<AuthorityStage, "foundation" | "mass-expansion" | "architectural-geometry" | "roof-composition">, before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument): void {
  if (architectureAuthorityHash(before) !== architectureAuthorityHash(after)) {
    throw new Error(`[v2-authority] ${stage} attempted to mutate architecture outside its write authority.`);
  }
}
