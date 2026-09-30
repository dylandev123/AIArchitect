import type { PlannedAsset } from "@/types/library";
import { deterministicTemplate } from "@/lib/assets/native/templates";

/** The sole native routing decision used by planning and both native-generation entry points. */
export type NativeResolution = { capabilityId: string; executable: boolean; template: ReturnType<typeof deterministicTemplate> };

export function resolveNativeCapability(asset: Pick<PlannedAsset, "name" | "description" | "category" | "dimensions">): NativeResolution {
  const text = `${asset.name} ${asset.description}`.toLowerCase();
  const vegetation = asset.category === "vegetation" || /\b(tree|palm|plant|vegetation)\b/.test(text);
  const template = deterministicTemplate(asset);
  // Native primitives can always accept a bounded AssetSpec; vegetation is executable only when the generic template exists.
  return { capabilityId: vegetation ? "native-vegetation" : `native-${asset.category}`, executable: vegetation ? Boolean(template) : true, template };
}
