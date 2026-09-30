import { z } from "zod";
import type { CuratedAsset } from "@/types/assets";

/**
 * The shape the asset API accepts. Only the fields the store keys on are checked; everything else (validation report,
 * relationships, source spec…) is kept exactly as sent so no CuratedAsset field is lost on the way to the server.
 */
export const curatedAssetSchema = z.looseObject({
  id: z.string().min(1).max(120),
  sourceSlug: z.string().max(500),
  source: z.enum(["polyhaven", "ambientcg", "upload", "generated"]),
  type: z.enum(["pbr-material", "hdri", "glb-model", "vegetation", "component-pack"]),
  status: z.enum(["pending", "approved", "rejected"]),
  name: z.string().max(300),
});

export const parseCuratedAsset = (raw: unknown) => curatedAssetSchema.safeParse(raw) as ReturnType<typeof curatedAssetSchema.safeParse> & { data?: CuratedAsset };

/** The server's own approval gate (the browser checks the same before approving; this stops a stale or scripted client). */
export function serverApprovalBlocker(asset: CuratedAsset): string | null {
  if (asset.status !== "approved" || asset.type !== "glb-model") return null;
  if (asset.source === "generated" && asset.validation?.passed !== true) return "Generated models must pass GLB validation before they can be approved.";
  if (asset.validation && !asset.validation.passed) return "GLB validation failed.";
  return null;
}
