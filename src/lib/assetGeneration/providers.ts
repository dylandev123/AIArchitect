import type { Need } from "@/types/library";
import { categoryLabel } from "@/lib/library/taxonomy";
import type { AssetGenerationProvider, AssetGenerationRequest, QualityLevel } from "./types";

/**
 * Registered generation providers. Empty on purpose: no provider is wired up yet, and nothing here pretends
 * otherwise. To add Meshy, Tripo or another service, implement `AssetGenerationProvider` in its own module and
 * append it to this list — the Needs screen picks it up automatically.
 */
export const PROVIDERS: readonly AssetGenerationProvider[] = [];

export type GenerationAvailability =
  | { available: true; providers: { id: string; label: string }[] }
  | { available: false; message: string };

export function generationAvailability(providers: readonly AssetGenerationProvider[] = PROVIDERS): GenerationAvailability {
  const ready = providers.filter((p) => p.isConfigured());
  if (ready.length > 0) return { available: true, providers: ready.map(({ id, label }) => ({ id, label })) };
  if (providers.length === 0) {
    return { available: false, message: "No asset-generation provider is configured. Add a provider adapter (e.g. Meshy or Tripo) in src/lib/assetGeneration/providers.ts to enable Generate." };
  }
  return { available: false, message: providers.map((p) => `${p.label}: ${p.configurationHint}`).join(" ") };
}

/** Polygon budgets per quality tier — sized for real-time web rendering of many instances on one site. */
export const POLYGON_BUDGETS: Record<QualityLevel, number> = { draft: 15_000, standard: 40_000, high: 80_000 };

export function buildGenerationRequest(need: Need, opts: { quality?: QualityLevel; polygonBudget?: number } = {}): AssetGenerationRequest {
  const quality = opts.quality ?? "standard";
  const style = need.styleTags.join(", ");
  const context = need.contextTags.length > 0 ? ` for a ${need.contextTags.join("/")} setting` : "";
  return {
    needId: need.id,
    category: need.category,
    description: `${style ? `${style} ` : ""}${categoryLabel(need.category).toLowerCase()}${context}, single freestanding object, clean silhouette, no ground plane or background`,
    style: need.styleTags,
    context: need.contextTags,
    dimensions: need.dimensions,
    quality,
    webReady: true,
    polygonBudget: opts.polygonBudget ?? POLYGON_BUDGETS[quality],
  };
}
