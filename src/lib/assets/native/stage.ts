import type { AssetValidationReport, CuratedAsset } from "@/types/assets";
import type { AssetPlan, PlannedAsset } from "@/types/library";
import { ingestGlb } from "../glbIngest";
import { getGlbStore } from "../glbStorage";
import { buildAsset, geometryHash, NATIVE_GENERATOR_VERSION } from "./build";
import { exportGlb } from "./glb";
import { resolveSurface, STYLE_PROFILE } from "./styleProfile";

/**
 * Turns a reviewed AssetSpec into a real library candidate: build → export GLB → the shared GLB pipeline
 * (`ingestGlb`: store the bytes, run the validator). The result is an ordinary pending CuratedAsset, so the existing
 * preview, queue, approval gate and library treat it exactly like an uploaded or provider-generated GLB.
 */

export interface StagedNative {
  asset: CuratedAsset;
  validation: AssetValidationReport;
  triangles: number;
  notes: string[];
}

const swatch = (hex: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="10" fill="${hex}"/></svg>`)}`;

export const nativeAssetId = () => `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export async function stageNativeAsset(spec: unknown, planned: PlannedAsset, plan: Pick<AssetPlan, "id" | "needId" | "knowledgeId">, id: string = nativeAssetId()): Promise<{ ok: true; staged: StagedNative } | { ok: false; error: string }> {
  const built = buildAsset(spec);
  if (!built.ok) return built;
  const { asset: model } = built;
  try {
    const ingest = await ingestGlb(id, exportGlb(model), { family: planned.category, expectedDimensions: model.spec.dimensions });
    const primary = resolveSurface(model.spec.materials[0]);
    const hash = geometryHash(model);
    const asset: CuratedAsset = {
      id,
      sourceSlug: `native:${planned.id}:${hash}`,
      source: "generated",
      type: "glb-model",
      name: planned.name,
      categories: [planned.category],
      tags: [...new Set([...planned.tags, model.spec.family, "native"])],
      thumbnailUrl: swatch(primary.color),
      pbr: { baseColor: primary.color, roughness: primary.roughness, metalness: primary.metalness },
      compatibleStyles: [],
      contentHash: `native-${hash}`,
      status: "pending",
      importedAt: new Date().toISOString(),
      family: planned.category,
      styleTags: planned.style,
      contextTags: planned.contexts,
      // No needId: one asset of a pack must not mark the whole Need approved (the plan link below tracks progress).
      planId: plan.id,
      plannedAssetId: planned.id,
      knowledgeIds: plan.knowledgeId ? [plan.knowledgeId] : undefined,
      // Versioning foundation: stable across regenerations of this planned asset; version stays 1 until Upgrade exists.
      stableAssetId: `native:${planned.id}`,
      version: 1,
      generatorVersion: NATIVE_GENERATOR_VERSION,
      styleProfileVersion: STYLE_PROFILE.version,
      generationPrompt: planned.generationPrompt,
      sourceSpec: model.spec,
      createdAt: new Date().toISOString(),
      ...ingest.derived,
    };
    const triangles = model.triangles;
    const notes = model.notes;
    model.meshes.forEach((m) => m.geometry.dispose());
    return { ok: true, staged: { asset, validation: ingest.validation, triangles, notes } };
  } catch (err) {
    model.meshes.forEach((m) => m.geometry.dispose());
    return { ok: false, error: err instanceof Error ? err.message : "Could not prepare the model." };
  }
}

/** Drops a staged model that was rejected or replaced (never call it for an approved asset: its bytes are the library's now). */
export function discardStaged(id: string): void {
  void getGlbStore().delete(id).catch(() => {});
}
