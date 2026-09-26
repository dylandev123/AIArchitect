import type { AssetValidationReport, CuratedAsset } from "@/types/assets";
import type { AssetCategory, NeedDimensions } from "@/types/library";
import { getGlbStore } from "./glbStorage";
import { validateGlb } from "./glbValidator";

/**
 * The single entry point for bringing a GLB into the library: store the bytes, validate them, and derive the
 * asset fields the report determines. Uploads use it today; provider-generated models call the same function
 * with the bytes they downloaded, so both paths are gated by exactly the same rules.
 */

export interface IngestOptions {
  family?: AssetCategory;
  expectedDimensions?: NeedDimensions;
}

export interface IngestResult {
  validation: AssetValidationReport;
  /** Asset fields the queue entry should take from the measured model. */
  derived: Pick<CuratedAsset, "validation" | "dimensions">;
}

export async function ingestGlb(assetId: string, bytes: ArrayBuffer, options: IngestOptions = {}): Promise<IngestResult> {
  const validation = validateGlb(bytes, options);
  try {
    await getGlbStore().put(assetId, bytes);
  } catch (err) {
    // Without a stored file the model could never render, so this is a hard failure, not a warning.
    validation.errors.push(`The file could not be stored on this device (${err instanceof Error ? err.message : "storage error"}).`);
    validation.passed = false;
  }
  return {
    validation,
    // The asset's size is what the model measures, not what was requested: retrieval and fitting scale from it.
    derived: { validation, ...(validation.passed && validation.dimensions ? { dimensions: validation.dimensions } : {}) },
  };
}

/** Re-runs validation against the stored file (e.g. after the category changed, which the orientation check reads). */
export async function revalidateStoredGlb(asset: Pick<CuratedAsset, "id" | "family" | "dimensions">, expectedDimensions?: NeedDimensions): Promise<AssetValidationReport | null> {
  const bytes = await getGlbStore().get(asset.id);
  return bytes ? validateGlb(bytes, { family: asset.family, expectedDimensions }) : null;
}
