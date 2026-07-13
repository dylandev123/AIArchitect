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

  if (source === "ambientcg") {
    return {
      mapUrl:          `https://cdn.ambientcg.com/AmbientCG-Raw/${sourceSlug}_1K-JPG_Color.jpg`,
      normalMapUrl:    `https://cdn.ambientcg.com/AmbientCG-Raw/${sourceSlug}_1K-JPG_NormalGL.jpg`,
      roughnessMapUrl: `https://cdn.ambientcg.com/AmbientCG-Raw/${sourceSlug}_1K-JPG_Roughness.jpg`,
      aoMapUrl:        `https://cdn.ambientcg.com/AmbientCG-Raw/${sourceSlug}_1K-JPG_AmbientOcclusion.jpg`,
    };
  }

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
