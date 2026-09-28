import type { AssetValidationReport, CuratedAsset } from "@/types/assets";
import type { AssetPlan, PlannedAsset } from "@/types/library";
import { ingestGlb } from "../glbIngest";
import { getGlbStore } from "../glbStorage";
import { assetHash, buildAsset, NATIVE_GENERATOR_VERSION } from "./build";
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

/** The parts of a planned asset staging reads. An upgrade has no planned asset any more, so it builds this from the approved asset. */
export type StagedFrom = Pick<PlannedAsset, "id" | "name" | "category" | "tags" | "style" | "contexts" | "generationPrompt">;
type PlanRef = Pick<AssetPlan, "id" | "needId" | "knowledgeId">;

/**
 * What staging needs to make an upgrade candidate of an approved native asset: its identity carried over (so the candidate
 * shares `stableAssetId`) and nothing new. Undefined when the asset has no native lineage.
 */
export function upgradeStagingInputs(base: CuratedAsset): { planned: StagedFrom; plan: PlanRef } | null {
  if (!base.stableAssetId || !base.family) return null;
  return {
    planned: { id: base.plannedAssetId ?? base.stableAssetId.replace(/^native:/, ""), name: base.name, category: base.family, tags: base.tags, style: base.styleTags ?? [], contexts: (base.contextTags ?? []) as StagedFrom["contexts"], generationPrompt: base.generationPrompt ?? base.name },
    plan: { id: base.planId ?? "", knowledgeId: base.knowledgeIds?.[0] },
  };
}

/**
 * Stages a spec as a pending library candidate. With `upgradeOf`, the candidate is an upgrade of that approved asset: same
 * `stableAssetId`, linked back to it by `upgradeOf`, and NO version yet: it is numbered only when approved, and the approved
 * version is not touched here or by anything the candidate does before review.
 */
export async function stageNativeAsset(spec: unknown, planned: StagedFrom, plan: PlanRef, id: string = nativeAssetId(), options: { upgradeOf?: CuratedAsset } = {}): Promise<{ ok: true; staged: StagedNative } | { ok: false; error: string }> {
  const built = buildAsset(spec);
  if (!built.ok) return built;
  const { asset: model } = built;
  try {
    const ingest = await ingestGlb(id, exportGlb(model), { family: planned.category, expectedDimensions: model.spec.dimensions });
    const primary = resolveSurface(model.spec.materials[0]);
    // The whole asset, not just its mesh: a version that only changes the colours or the light is still a different asset.
    const hash = assetHash(model);
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
      planId: plan.id || undefined,
      plannedAssetId: planned.id,
      knowledgeIds: options.upgradeOf?.knowledgeIds ?? (plan.knowledgeId ? [plan.knowledgeId] : undefined),
      // Stable across regenerations and upgrades of this asset. The version number is given on approval, never here.
      stableAssetId: options.upgradeOf?.stableAssetId ?? `native:${planned.id}`,
      ...(options.upgradeOf ? { upgradeOf: options.upgradeOf.id } : {}),
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
