import type { OutdoorAssetPlacement } from "./placements";

export interface RenderedSupportSurface {
  id: string;
  kind: "terrain" | "patio" | "deck" | "terrace" | "roof" | "balcony" | "slab";
  elevation: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface SupportAuditIssue {
  placementId: string;
  code: "support-missing" | "support-elevation";
  detail: string;
}

/**
 * Validate against executable support geometry, not a semantic label. This is
 * deliberately geometry-agnostic so terrain, generated slabs, GLBs, and future
 * support compilers all use the same audit.
 */
export function auditAssetSupport(placements: readonly OutdoorAssetPlacement[], surfaces: readonly RenderedSupportSurface[]): SupportAuditIssue[] {
  return placements.flatMap((placement): SupportAuditIssue[] => {
    const support = placement.support;
    if (!support) return [{ placementId: placement.id, code: "support-missing" as const, detail: "No resolved support surface." }];
    const candidates = surfaces.filter((surface) => surface.kind === support.kind && placement.position[0] >= surface.x0 && placement.position[0] <= surface.x1 && placement.position[2] >= surface.z0 && placement.position[2] <= surface.z1);
    const surface = candidates.find((candidate) => Math.abs(candidate.elevation - support.elevation) < 0.001);
    if (!surface) return [{ placementId: placement.id, code: "support-missing" as const, detail: `${support.kind} support is not present in the rendered world at this asset position.` }];
    const base = placement.position[1] + (placement.localBounds?.min[1] ?? 0) * placement.scale;
    return Math.abs(base - surface.elevation) < 0.001
      ? []
      : [{ placementId: placement.id, code: "support-elevation" as const, detail: `Asset base ${base} does not meet ${surface.kind} support elevation ${surface.elevation}.` }];
  });
}
