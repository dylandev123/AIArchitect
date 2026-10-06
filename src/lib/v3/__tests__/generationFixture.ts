import type { V3Scene } from "../scene";

/**
 * Test-only: renders a runtime `V3Scene` as the flat provider-facing shape Terra emits
 * (required flat `support`, no metadata, required `transitions`, flat terrain/source fields).
 */
export function toGenerationOutput(scene: V3Scene): Record<string, unknown> {
  const { metadata: _metadata, ...root } = structuredClone(scene) as V3Scene & { metadata?: unknown };
  void _metadata;
  return {
    ...root,
    site: (({ groundMaterial, ...site }) => ({ ...site, ...(groundMaterial ? { groundColor: groundMaterial.color } : {}) }))(root.site),
    siteHierarchy: { ...root.siteHierarchy, transitions: root.siteHierarchy?.transitions ?? [] },
    objects: root.objects.map(({ support, source, terrain, metadata: _m, ...object }) => {
      void _m;
      return {
        ...object,
        support: { kind: support?.kind ?? "none", levelId: support?.levelId ?? "", hostId: support?.hostId ?? support?.objectId ?? "", relationship: support?.relationship ?? "none", grounding: support?.grounding ?? "grounded" },
        ...(source ? { sourceKind: source.kind, ...(source.assetId ? { sourceAssetId: source.assetId } : {}), ...(source.replaceable !== undefined ? { sourceReplaceable: source.replaceable } : {}) } : {}),
        ...(terrain ? { terrainOperation: terrain.operation, ...(terrain.rise !== undefined ? { terrainRise: terrain.rise } : {}), ...(terrain.direction ? { terrainDirection: terrain.direction } : {}) } : {}),
      };
    }),
  };
}
