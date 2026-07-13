import type { AssetSource } from "@/types/assets";

export const SOURCE_LABELS: Record<AssetSource, string> = {
  polyhaven:  "Poly Haven",
  ambientcg:  "ambientCG",
  upload:     "User Upload",
};

export const SOURCE_DESCRIPTIONS: Record<AssetSource, string> = {
  polyhaven:  "Free public-domain textures, HDRIs and 3D assets",
  ambientcg:  "Free CC0 PBR materials and textures",
  upload:     "Import your own local files",
};

export function polyHavenThumb(slug: string): string {
  return `https://cdn.polyhaven.com/asset_img/thumbs/${slug}.png?width=320`;
}

export function polyHavenAssetUrl(slug: string, type: string): string {
  return `https://dl.polyhaven.org/file/ph-assets/${type}/${slug}/${slug}_1k.hdr`;
}

export function ambientCGThumb(id: string): string {
  return `https://ambientcg.com/get?file=${id}_PREVIEW.jpg`;
}

export function ambientCGAssetUrl(id: string): string {
  return `https://ambientcg.com/get?file=${id}_1K-JPG.zip`;
}
