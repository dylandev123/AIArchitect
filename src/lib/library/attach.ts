import { GLB_BUILDING_CATEGORY } from "@/lib/assets/placement";
import type { AssetRequest } from "@/types/library";
import { requestForBuilding, requestsContext } from "./requests";
import { resolveAsset, type AssetIndexEntry } from "./retrieval";

/**
 * Semantic replacement, generation side. After a design is built, each feature that a library GLB could stand in
 * for is looked up with `resolveAsset`; a compatible approved asset is *referenced* by id on the feature. The
 * feature itself is unchanged and still fully procedural underneath, so a missing asset only ever means the
 * procedural version draws. A request with no good match gets no assetId — poor matches are never forced.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export interface AttachResult {
  json: string;
  /** feature array index -> asset attached, for logging/tests. */
  attached: { index: number; assetId: string; request: AssetRequest }[];
}

export function attachLibraryAssets(json: string, library: readonly AssetIndexEntry[]): AttachResult {
  const unchanged = { json, attached: [] };
  if (library.length === 0) return unchanged;
  let root: unknown;
  try {
    root = JSON.parse(json);
  } catch {
    return unchanged;
  }
  if (!isRecord(root) || !Array.isArray(root.buildings)) return unchanged;

  const ctx = requestsContext(root);
  const attached: AttachResult["attached"] = [];
  root.buildings.forEach((b, index) => {
    if (!isRecord(b) || typeof b.kind !== "string" || !(b.kind in GLB_BUILDING_CATEGORY)) return;
    const request = requestForBuilding(b, ctx, null);
    if (!request) return;
    const found = resolveAsset(library, request);
    if (found.kind !== "asset") return;
    b.assetId = found.asset.id;
    attached.push({ index, assetId: found.asset.id, request });
  });
  return attached.length === 0 ? unchanged : { json: JSON.stringify(root), attached };
}
