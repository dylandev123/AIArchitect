import type { OutdoorAssetPlacement, OutdoorAssetSource, OutdoorAssetTombstone } from "./placements";

/** Source identity is explicit. Never fall back to a position, size, or fuzzy match. */
export const sourceSemanticId = (placement: Pick<OutdoorAssetPlacement, "id" | "source">): string => placement.source?.semanticId ?? placement.id;

export function sourceIsSuppressed(
  generated: Pick<OutdoorAssetPlacement, "id" | "source">,
  persistent: readonly OutdoorAssetPlacement[],
  tombstones: readonly OutdoorAssetTombstone[] = [],
): boolean {
  const semanticId = sourceSemanticId(generated);
  return persistent.some((placement) => placement.source?.semanticId === semanticId)
    || tombstones.some((tombstone) => tombstone.semanticId === semanticId);
}

/**
 * Merge a generated projection into persisted records exactly once. Existing
 * source identities win, which makes repeated edit attempts and reloads stable.
 */
export function materializeGeneratedAssets(
  persistent: readonly OutdoorAssetPlacement[],
  generated: readonly OutdoorAssetPlacement[],
): OutdoorAssetPlacement[] {
  const generatedBySemanticId = new Map(generated.map((placement) => [sourceSemanticId(placement), placement]));
  const seen = new Set<string>();
  const keep = persistent.flatMap((placement) => {
    const semanticId = sourceSemanticId(placement);
    if (seen.has(semanticId)) return [];
    seen.add(semanticId);
    // Migrate older saved records by their stable id only. This is identity
    // migration, never transform matching, and makes prior projects suppress
    // their renderer source on their next edit/save.
    const generatedSource = generatedBySemanticId.get(semanticId)?.source;
    return [{ ...placement, ...(placement.source || !generatedSource ? {} : { source: generatedSource }) }];
  });
  for (const placement of generated) {
    const semanticId = sourceSemanticId(placement);
    if (seen.has(semanticId)) continue;
    seen.add(semanticId);
    keep.push({ ...placement, source: placement.source ?? sourceFor(placement.id, "renderer-derived", "unknown") });
  }
  return keep;
}

export const sourceFor = (semanticId: string, sourceType: OutdoorAssetSource["sourceType"], generatorId: string): OutdoorAssetSource => ({
  semanticId, sourceType, generatorId, ownership: "materialized",
});

export function tombstoneFor(placement: OutdoorAssetPlacement): OutdoorAssetTombstone | undefined {
  if (!placement.source) return undefined;
  return { semanticId: placement.source.semanticId, sourceType: placement.source.sourceType, generatorId: placement.source.generatorId };
}

export function appendTombstone(existing: readonly OutdoorAssetTombstone[] | undefined, placement: OutdoorAssetPlacement): OutdoorAssetTombstone[] {
  const tombstone = tombstoneFor(placement);
  if (!tombstone || existing?.some((value) => value.semanticId === tombstone.semanticId)) return [...(existing ?? [])];
  return [...(existing ?? []), tombstone];
}
