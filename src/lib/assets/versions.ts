import type { AssetLight } from "./native/spec";
import type { CuratedAsset, UpgradeRollout } from "@/types/assets";

/**
 * Versions of one native asset and the rules of Upgrade, as pure functions over the catalog so they are testable without the
 * store. The rules:
 *
 *  - Every version of an asset shares `stableAssetId`; each is its own CuratedAsset (own id, own GLB file), so nothing about an
 *    older version is ever edited or deleted by an upgrade.
 *  - An upgrade is a pending candidate (`upgradeOf` = the approved version it came from, no `version` yet). The approved
 *    version is not touched until the candidate is approved.
 *  - Approving gives the candidate the next version number and marks the old version `supersededBy` it, with a rollout:
 *    "new-projects" (existing projects keep the old version) or "all-projects" ("Make Current": the old id resolves to the new).
 *  - Only the current (unsuperseded) version is offered to new projects (`isRetrievableAsset`).
 */

const versionOf = (a: CuratedAsset) => a.version ?? 1;

/** Every version in the catalog under one stableAssetId, oldest first. */
export function versionsOf(catalog: readonly CuratedAsset[], stableAssetId: string): CuratedAsset[] {
  return catalog.filter((a) => a.stableAssetId === stableAssetId).sort((a, b) => versionOf(a) - versionOf(b));
}

/** The number the next approved version gets: one past the highest already in the library. */
export function nextVersion(catalog: readonly CuratedAsset[], stableAssetId: string): number {
  return Math.max(0, ...versionsOf(catalog, stableAssetId).map(versionOf)) + 1;
}

/** The newest version that has not been superseded: what new projects use. */
export function currentVersion(catalog: readonly CuratedAsset[], stableAssetId: string): CuratedAsset | undefined {
  return versionsOf(catalog, stableAssetId).filter((a) => !a.supersededBy).at(-1);
}

/** Only an approved, validated native asset that is still the current version can be upgraded. */
export function canUpgrade(asset: CuratedAsset): boolean {
  return asset.status === "approved" && asset.type === "glb-model" && !!asset.stableAssetId && !!asset.sourceSpec && !!asset.family && !asset.supersededBy && asset.validation?.passed === true;
}

/** An upgrade candidate still waiting for review. */
export const isUpgradeCandidate = (a: CuratedAsset): boolean => !!a.upgradeOf && a.status !== "approved";

/** The pending upgrade candidate for an asset, if one is waiting: there is at most one review at a time per asset. */
export function findPendingUpgrade(queue: readonly CuratedAsset[], stableAssetId: string): CuratedAsset | undefined {
  return queue.find((a) => a.stableAssetId === stableAssetId && isUpgradeCandidate(a));
}

/** Why an upgrade candidate cannot be approved right now (independent of its GLB validation), or null. */
export function upgradeBlocker(candidate: CuratedAsset, catalog: readonly CuratedAsset[]): string | null {
  if (!candidate.upgradeOf) return "This is not an upgrade candidate.";
  const base = catalog.find((a) => a.id === candidate.upgradeOf);
  if (!base) return "The version this upgrade was made from is no longer in the library. Discard the candidate and upgrade again.";
  if (base.supersededBy) return `The version this upgrade was made from has since been replaced by v${base.supersededBy.version}. Discard the candidate and upgrade the current version.`;
  return null;
}

/**
 * The catalog after approving `candidate`: it joins as the next version and the version it upgraded is marked superseded.
 * Nothing else changes: the old version keeps its file, spec, metadata and approval.
 */
export function applyUpgradeApproval(candidate: CuratedAsset, catalog: readonly CuratedAsset[], rollout: UpgradeRollout, at: string): CuratedAsset[] {
  const version = nextVersion(catalog, candidate.stableAssetId ?? "");
  const { upgradeOf } = candidate;
  return [
    ...catalog.map((a) => (a.id === upgradeOf ? { ...a, supersededBy: { id: candidate.id, version, rollout, at } } : a)),
    { ...candidate, status: "approved" as const, version },
  ];
}

/**
 * Follows "Make Current" upgrades from an asset id to the version that should be drawn. A version replaced "New Projects Only"
 * stops the chain: projects that use it keep it.
 */
export function resolveCurrentAssetId(catalog: readonly CuratedAsset[], id: string): string {
  const seen = new Set<string>();
  let at = id;
  while (!seen.has(at)) {
    seen.add(at);
    const next = catalog.find((a) => a.id === at)?.supersededBy;
    if (!next || next.rollout !== "all-projects" || !catalog.some((a) => a.id === next.id)) break;
    at = next.id;
  }
  return at;
}

/** The catalog without `id`. A version that was standing over an older one gives it back: removing v2 makes v1 current again. */
export function withoutVersion(catalog: readonly CuratedAsset[], id: string): CuratedAsset[] {
  return catalog
    .filter((a) => a.id !== id)
    .map((a) => {
      if (a.supersededBy?.id !== id) return a;
      const restored = { ...a };
      delete restored.supersededBy;
      return restored;
    });
}

// ── What the side-by-side review shows ──────────────────────────────────────

export const describeLight = (l: AssetLight): string => [l.type, `${l.intensity} cd`, `${l.range} m`, l.color, ...(l.type === "spot" ? [`${l.coneAngle}° ${l.direction ?? "down"}`] : [])].join(" · ");

export interface AssetFacts {
  /** "v2", or "v3 on approval" for a candidate that has not been given a number. */
  version: string;
  family: string;
  dimensions: string;
  triangles: string;
  detail: string;
  parts: string;
  materials: string;
  light: string;
  validation: string;
  generator: string;
  created: string;
}

/** Comparable facts for one version, as display strings; `pendingVersion` is the number a candidate would get. */
export function describeAsset(asset: CuratedAsset, pendingVersion?: number): AssetFacts {
  const spec = asset.sourceSpec;
  const v = asset.validation;
  const d = v?.dimensions ?? asset.dimensions;
  return {
    version: asset.version !== undefined && asset.status === "approved" ? `v${asset.version}` : pendingVersion !== undefined ? `v${pendingVersion} on approval` : "not yet versioned",
    family: spec?.family ?? asset.family ?? "—",
    dimensions: d?.width && d.depth && d.height ? `${d.width} × ${d.depth} × ${d.height} m` : "—",
    triangles: v?.triangleCount !== undefined ? v.triangleCount.toLocaleString("en-US") : "—",
    detail: spec?.detailLevel ?? "—",
    parts: spec ? `${spec.parts.length} part specs` : "—",
    materials: spec ? spec.materials.map((m) => m.key).join(", ") : "—",
    light: spec?.light ? describeLight(spec.light) : "none",
    validation: v ? (v.passed ? "passed" : "failed") : "unchecked",
    generator: asset.generatorVersion ?? "—",
    created: (asset.createdAt ?? asset.importedAt).slice(0, 10),
  };
}
