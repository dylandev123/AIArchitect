import type { AssetCategory, NeedDimensions } from "@/types/library";

export type QualityLevel = "draft" | "standard" | "high";

/** Everything a provider needs to produce one GLB for a Need. Provider-neutral: adapters translate it to their own API. */
export interface AssetGenerationRequest {
  needId: string;
  category: AssetCategory;
  description: string;
  style: string[];
  context: string[];
  /** Target size in metres; the finished model is validated against it. */
  dimensions?: NeedDimensions;
  quality: QualityLevel;
  /** Must load in a web viewer without a build step (single GLB, embedded/compressed textures, Y-up, metres). */
  webReady: boolean;
  /** Upper bound on triangles; validation rejects anything over it. */
  polygonBudget: number;
}

export type ProviderJobState = "queued" | "running" | "succeeded" | "failed";

export interface ProviderJob {
  providerId: string;
  jobId: string;
}

export interface ProviderJobStatus {
  state: ProviderJobState;
  /** 0–1 when the provider reports it. */
  progress?: number;
  /** Set when `state` is "succeeded": where to download the GLB from. */
  glbUrl?: string;
  error?: string;
}

/**
 * A GLB generation service (Meshy, Tripo, …). Adapters live behind this interface so the admin UI and the Needs
 * workflow never depend on one provider. Generated output is never trusted: it goes through GLB validation and
 * admin approval like an upload.
 */
export interface AssetGenerationProvider {
  id: string;
  label: string;
  /** False until credentials/config for this provider are present. */
  isConfigured(): boolean;
  /** Human-readable instruction shown in the admin UI when the provider is not configured. */
  configurationHint: string;
  submit(request: AssetGenerationRequest): Promise<ProviderJob>;
  poll(job: ProviderJob): Promise<ProviderJobStatus>;
}
