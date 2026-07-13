import { NextRequest, NextResponse } from "next/server";
import type { BrowseAsset } from "@/types/assets";
import { polyHavenThumb, ambientCGThumb } from "@/lib/assets/sources";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "dylandevaux3@gmail.com";

function authGuard(email: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();
}

async function fetchPolyHaven(type: string, search: string): Promise<BrowseAsset[]> {
  const url = `https://api.polyhaven.com/assets?type=${encodeURIComponent(type)}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Poly Haven API error: ${res.status}`);
  const data = (await res.json()) as Record<string, { name?: string; type?: string; categories?: string[]; tags?: string[] }>;

  return Object.entries(data)
    .filter(([slug, asset]) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        slug.includes(q) ||
        (asset.name ?? "").toLowerCase().includes(q) ||
        (asset.categories ?? []).some((c) => c.toLowerCase().includes(q)) ||
        (asset.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    })
    .slice(0, 60)
    .map(([slug, asset]) => ({
      sourceSlug: slug,
      source: "polyhaven" as const,
      name: asset.name ?? slug.replace(/_/g, " "),
      thumbnailUrl: polyHavenThumb(slug),
      categories: asset.categories ?? [],
      tags: (asset.tags ?? []).slice(0, 8),
    }));
}

async function fetchAmbientCG(search: string): Promise<BrowseAsset[]> {
  const params = new URLSearchParams({ type: "Material", limit: "60" });
  if (search) params.set("q", search);
  const url = `https://ambientcg.com/api/v2/assets?${params}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`ambientCG API error: ${res.status}`);
  const data = (await res.json()) as {
    foundAssets?: { assetId?: string; displayName?: string; tags?: string[]; categories?: string[] }[];
  };

  return (data.foundAssets ?? []).map((asset) => {
    const id = asset.assetId ?? "";
    return {
      sourceSlug: id,
      source: "ambientcg" as const,
      name: asset.displayName ?? id,
      thumbnailUrl: ambientCGThumb(id),
      categories: asset.categories ?? [],
      tags: (asset.tags ?? []).slice(0, 8),
    };
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const adminEmail = searchParams.get("adminEmail");
  if (!authGuard(adminEmail)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = searchParams.get("source") ?? "polyhaven";
  const type = searchParams.get("type") ?? "textures";
  const search = searchParams.get("search") ?? "";

  try {
    let assets: BrowseAsset[];
    if (source === "polyhaven") {
      assets = await fetchPolyHaven(type, search);
    } else if (source === "ambientcg") {
      assets = await fetchAmbientCG(search);
    } else {
      return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    }
    return NextResponse.json({ assets });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
