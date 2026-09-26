import type { CuratedAsset } from "@/types/assets";

export interface TextureUrls {
  mapUrl?: string;
  normalMapUrl?: string;
  roughnessMapUrl?: string;
  aoMapUrl?: string;
}

/** Derives texture map URLs from a CuratedAsset's source and sourceSlug. */
export function deriveTextureUrls(asset: CuratedAsset): TextureUrls {
  const { source, sourceSlug } = asset;

  // ambientCG has no stable hotlinkable per-map CDN (the old AmbientCG-Raw paths 404), so its assets resolve to nothing
  // rather than firing broken requests; surfaces then use the bundled PBR library. See public/textures/CREDITS.txt.
  if (source === "ambientcg") return {};

  if (source === "polyhaven") {
    const s = sourceSlug;
    return {
      mapUrl:          `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${s}/${s}_2k.jpg`,
      normalMapUrl:    `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${s}/${s}_2k_nor_gl.jpg`,
      roughnessMapUrl: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${s}/${s}_2k_rough.jpg`,
      aoMapUrl:        `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${s}/${s}_2k_ao.jpg`,
    };
  }

  return {};
}

/** True when the asset's maps resolve to real URLs. Assets that don't should be treated as absent by the renderer. */
export function hasUsableTextures(asset: CuratedAsset | undefined): boolean {
  return !!asset && !!deriveTextureUrls(asset).mapUrl;
}
