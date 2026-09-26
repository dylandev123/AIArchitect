"use client";

import { useState, useEffect, useRef } from "react";
import { X, Search, Upload, CheckCircle, XCircle, Trash2, AlertTriangle } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { approvalBlocker, useAssetStore } from "@/store/useAssetStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useLearnStore } from "@/store/useLearnStore";
import { ingestGlb } from "@/lib/assets/glbIngest";
import { getGlbStore } from "@/lib/assets/glbStorage";
import { GlbPreview } from "./GlbPreview";
import { GlbReport } from "./GlbReport";
import { inferPBR, inferCompatibleStyles, makeAssetId, detectAssetType, hashContent } from "@/lib/assets/processor";
import { SOURCE_LABELS } from "@/lib/assets/sources";
import { LearnWorkspace } from "./LearnWorkspace";
import { UsageTab } from "./UsageTab";
import { NeedsTab } from "./NeedsTab";
import { RecipesTab } from "./RecipesTab";
import { ModalPortal } from "./ModalPortal";
import { categoryLabel } from "@/lib/library/taxonomy";
import { ASSET_CATEGORIES, type AssetCategory, type Need } from "@/types/library";
import type { BrowseAsset, AssetSource, CuratedAsset, PBRValues } from "@/types/assets";

// ── PBR Editor ──────────────────────────────────────────────────────────────

function PBREditor({ pbr, onChange }: { pbr: PBRValues; onChange: (pbr: PBRValues) => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] p-2.5 text-[11px]">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-500">Base Color</span>
        <input
          type="color"
          value={pbr.baseColor}
          onChange={(e) => onChange({ ...pbr, baseColor: e.target.value })}
          className="h-6 w-8 shrink-0 cursor-pointer rounded border border-white/10 bg-neutral-800 p-0.5"
        />
        <span className="font-mono text-neutral-400">{pbr.baseColor}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-500">Roughness</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={pbr.roughness}
          onChange={(e) => onChange({ ...pbr, roughness: parseFloat(e.target.value) })}
          className="flex-1"
        />
        <span className="w-8 text-right font-mono text-neutral-400">{pbr.roughness.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-500">Metalness</span>
        <input
          type="range" min={0} max={1} step={0.01}
          value={pbr.metalness}
          onChange={(e) => onChange({ ...pbr, metalness: parseFloat(e.target.value) })}
          className="flex-1"
        />
        <span className="w-8 text-right font-mono text-neutral-400">{pbr.metalness.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ── Browse Tab ───────────────────────────────────────────────────────────────

type PolyHavenType = "textures" | "hdris" | "models";

/** Set when the admin jumps here from a Need: which source to open, what to search, and the need being served. */
interface BrowseIntent {
  source: AssetSource;
  need: Need;
}

const needSearchText = (need: Need) => `${need.styleTags[0] ?? ""} ${categoryLabel(need.category)}`.trim();

/** Library metadata a queued asset inherits from the Need it was found or uploaded for. */
function needMetadata(need: Need | undefined): Partial<CuratedAsset> {
  return need ? { family: need.category, styleTags: need.styleTags, contextTags: need.contextTags, dimensions: need.dimensions, needId: need.id } : {};
}

function BrowseTab({ intent }: { intent?: BrowseIntent }) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const addToQueue = useAssetStore((s) => s.addToQueue);
  const isDuplicate = useAssetStore((s) => s.isDuplicate);

  const [source, setSource] = useState<AssetSource>(intent?.source ?? "polyhaven");
  const [polyType, setPolyType] = useState<PolyHavenType>(intent ? "models" : "textures");
  const [search, setSearch] = useState(intent && intent.source !== "upload" ? needSearchText(intent.need) : "");
  const [query, setQuery] = useState(intent && intent.source !== "upload" ? needSearchText(intent.need) : "");
  const setNeedStatus = useLibraryStore((s) => s.act);
  const [assets, setAssets] = useState<BrowseAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAssets = async (src: AssetSource, type: string, q: string) => {
    if (src === "upload") return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        source: src,
        type,
        search: q,
        adminEmail,
      });
      const res = await fetch(`/api/admin/sources?${params}`);
      const data = (await res.json()) as { assets?: BrowseAsset[]; error?: string };
      if (data.error) throw new Error(data.error);
      setAssets(data.assets ?? []);
    } catch (err) {
      setError((err as Error).message);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssets(source, source === "polyhaven" ? polyType : "Material", query);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, polyType, query]);

  const handleAdd = (asset: BrowseAsset) => {
    const pbr = inferPBR(asset.categories, asset.tags);
    const styles = inferCompatibleStyles(asset.categories, asset.tags);
    addToQueue({
      id: makeAssetId(),
      sourceSlug: asset.sourceSlug,
      source: asset.source,
      type: "pbr-material",
      name: asset.name,
      categories: asset.categories,
      tags: asset.tags,
      thumbnailUrl: asset.thumbnailUrl,
      pbr,
      compatibleStyles: styles,
      status: "pending",
      importedAt: new Date().toISOString(),
      ...(polyType === "models" && intent ? { ...needMetadata(intent.need), type: "glb-model" as const } : {}),
    });
    if (intent && polyType === "models") void setNeedStatus(adminEmail, { action: "setNeedStatus", id: intent.need.id, status: "review" });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const buffer = await file.arrayBuffer();
      const hash = hashContent(buffer);
      const blobUrl = URL.createObjectURL(file);
      const assetType = detectAssetType(file.name, file.type);
      const slugified = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-z0-9]+/gi, "_").toLowerCase();
      const pbr = inferPBR([], [slugified]);
      const styles = inferCompatibleStyles([], [slugified]);
      const id = makeAssetId();
      // A GLB goes through the shared validator (and its bytes are kept so the viewport can render it after approval).
      const glb = assetType === "glb-model" ? await ingestGlb(id, buffer, { family: intent?.need.category, expectedDimensions: intent?.need.dimensions }) : null;
      addToQueue({
        id,
        sourceSlug: slugified,
        source: "upload",
        type: assetType,
        name: file.name.replace(/\.[^/.]+$/, ""),
        categories: [],
        tags: [],
        thumbnailUrl: blobUrl,
        pbr,
        compatibleStyles: styles,
        contentHash: hash,
        status: "pending",
        importedAt: new Date().toISOString(),
        ...needMetadata(intent?.need),
        ...glb?.derived,
      });
      // The queue ignores a repeat of the same file; don't leave its bytes behind.
      if (glb && !useAssetStore.getState().queue.some((a) => a.id === id)) void getGlbStore().delete(id).catch(() => {});
      if (intent) void setNeedStatus(adminEmail, { action: "setNeedStatus", id: intent.need.id, status: "review" });
    }
    e.target.value = "";
  };

  const SOURCES: AssetSource[] = ["polyhaven", "ambientcg", "upload"];
  const POLY_TYPES: { value: PolyHavenType; label: string }[] = [
    { value: "textures", label: "Textures" },
    { value: "hdris",    label: "HDRIs" },
    { value: "models",   label: "3D Models" },
  ];

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Source selector */}
      <div className="flex shrink-0 gap-1.5">
        {SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => { setSource(s); setAssets([]); }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${
              source === s
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "border border-white/5 bg-white/[0.03] text-neutral-400 hover:text-neutral-200 hover:border-white/10"
            }`}
          >
            {SOURCE_LABELS[s]}
          </button>
        ))}
      </div>

      {intent && (
        <p className="shrink-0 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
          Finding an asset for need: <span className="font-medium">{intent.need.title}</span> — queued assets inherit its category, style and size.
        </p>
      )}

      {source !== "upload" && (
        <>
          {/* Type filter (Poly Haven only) */}
          {source === "polyhaven" && (
            <div className="flex shrink-0 gap-1">
              {POLY_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setPolyType(value)}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition ${
                    polyType === value
                      ? "bg-neutral-700 text-neutral-100"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative shrink-0">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQuery(search)}
              placeholder={`Search ${SOURCE_LABELS[source]}…`}
              className="w-full rounded-lg border border-white/8 bg-neutral-800/60 py-2 pl-8 pr-3 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/40"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setQuery(""); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-neutral-400"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </>
      )}

      {source === "upload" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-white/10 p-8">
          <Upload size={28} className="text-neutral-600" />
          <div className="text-center">
            <p className="text-sm font-medium text-neutral-300">Upload asset files</p>
            <p className="mt-1 text-xs text-neutral-600">Textures (.png, .jpg), 3D models (.glb), HDRIs (.hdr)</p>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-medium text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition"
          >
            Choose Files
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.hdr,.exr,.glb,.gltf"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center text-xs text-neutral-500">Loading…</div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={() => fetchAssets(source, polyType, query)}
            className="text-[11px] text-neutral-500 underline hover:text-neutral-300"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 pb-2 sm:grid-cols-3">
            {assets.map((asset) => {
              const dup = isDuplicate(asset.sourceSlug, asset.source);
              return (
                <div
                  key={asset.sourceSlug}
                  className="group relative flex flex-col overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] transition hover:border-white/10"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square overflow-hidden bg-neutral-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.thumbnailUrl}
                      alt={asset.name}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  {/* Info */}
                  <div className="flex flex-col gap-1 p-2">
                    <p className="truncate text-[11px] font-medium text-neutral-200" title={asset.name}>
                      {asset.name}
                    </p>
                    {asset.categories.length > 0 && (
                      <p className="truncate text-[10px] text-neutral-600">{asset.categories.slice(0, 3).join(", ")}</p>
                    )}
                    {dup ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
                        <AlertTriangle size={10} /> In {dup.status === "approved" ? "library" : "queue"}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(asset)}
                        className="mt-0.5 rounded-md bg-amber-500/15 py-1 text-[11px] font-medium text-amber-300 border border-amber-500/20 hover:bg-amber-500/25 transition"
                      >
                        + Queue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {assets.length === 0 && !loading && (
            <p className="py-10 text-center text-xs text-neutral-600">
              {query ? `No results for "${query}"` : "No assets found"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Metadata Editor ──────────────────────────────────────────────────────────

const csv = (s: string) => s.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
const dimOf = (v: string) => (Number.isFinite(parseFloat(v)) && parseFloat(v) > 0 ? parseFloat(v) : undefined);
const fieldCls = "rounded-md border border-white/8 bg-neutral-800/60 px-2 py-1 text-[11px] text-neutral-200 outline-none focus:border-amber-500/40";

/** Library metadata for placeable objects (family, style/context tags, real-world size, license). Materials don't need it. */
function MetadataEditor({ asset }: { asset: CuratedAsset }) {
  const update = useAssetStore((s) => s.updateAssetMeta);
  const d = asset.dimensions ?? {};
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] p-2.5 text-[11px]">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-500">Category</span>
        <select
          value={asset.family ?? ""}
          onChange={(e) => update(asset.id, { family: (e.target.value || undefined) as AssetCategory | undefined })}
          className={`${fieldCls} flex-1`}
        >
          <option value="">— none (not retrievable) —</option>
          {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-500">Style tags</span>
        <input defaultValue={(asset.styleTags ?? []).join(", ")} onBlur={(e) => update(asset.id, { styleTags: csv(e.target.value) })} placeholder="modern, tropical" className={`${fieldCls} flex-1`} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-500">Context</span>
        <input defaultValue={(asset.contextTags ?? []).join(", ")} onBlur={(e) => update(asset.id, { contextTags: csv(e.target.value) })} placeholder="poolside, terrace" className={`${fieldCls} flex-1`} />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-500">Size (m)</span>
        {(["width", "depth", "height"] as const).map((k) => (
          <input
            key={k}
            defaultValue={d[k] ?? ""}
            onBlur={(e) => update(asset.id, { dimensions: { ...asset.dimensions, [k]: dimOf(e.target.value) } })}
            placeholder={k[0].toUpperCase()}
            title={k}
            className={`${fieldCls} w-14`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-500">License</span>
        <input
          defaultValue={asset.license?.name ?? ""}
          onBlur={(e) => update(asset.id, { license: e.target.value.trim() ? { ...asset.license, name: e.target.value.trim() } : undefined })}
          placeholder="CC0, CC-BY 4.0, commercial…"
          className={`${fieldCls} flex-1`}
        />
      </div>
    </div>
  );
}

/** Validation report plus an on-demand 3D preview (one WebGL context at a time, opened only when asked for). */
function GlbReview({ asset }: { asset: CuratedAsset }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <GlbReport asset={asset} />
      <button onClick={() => setOpen((v) => !v)} className="self-start rounded border border-white/8 px-2 py-1 text-[11px] text-neutral-400 hover:text-neutral-200">
        {open ? "Hide 3D preview" : "Show 3D preview"}
      </button>
      {open && <GlbPreview asset={asset} />}
    </div>
  );
}

const isObjectAsset = (a: CuratedAsset) => a.type !== "pbr-material" && a.type !== "hdri";

// ── Queue Tab ────────────────────────────────────────────────────────────────

function QueueTab() {
  const queue = useAssetStore((s) => s.queue);
  const approve = useAssetStore((s) => s.approve);
  const reject = useAssetStore((s) => s.reject);
  const updateAssetPBR = useAssetStore((s) => s.updateAssetPBR);
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const act = useLibraryStore((s) => s.act);
  const generation = useLibraryStore((s) => s.generation);

  const approveAsset = (asset: CuratedAsset) => {
    approve(asset.id);
    // A need is satisfied only once its asset is in the global library.
    if (asset.needId && !approvalBlocker(asset)) void act(adminEmail, { action: "completeNeed", id: asset.needId, assetId: asset.id });
  };
  const rejectAsset = (asset: CuratedAsset) => {
    reject(asset.id);
    if (asset.needId) void act(adminEmail, { action: "setNeedStatus", id: asset.needId, status: "needed" });
  };

  if (queue.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-neutral-500">Queue is empty</p>
        <p className="text-xs text-neutral-600">Browse sources and click &quot;Queue&quot; to stage assets for review</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col gap-3 pb-2">
        {queue.map((asset) => (
          <div
            key={asset.id}
            className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
          >
            <div className="flex gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.thumbnailUrl}
                  alt={asset.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm font-medium text-neutral-100">{asset.name}</p>
                <p className="text-[11px] text-neutral-500">
                  {SOURCE_LABELS[asset.source]} · {asset.type}
                </p>
                {asset.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {asset.categories.slice(0, 4).map((c) => (
                      <span key={c} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-500">{c}</span>
                    ))}
                  </div>
                )}
                {asset.compatibleStyles.length > 0 && (
                  <p className="text-[10px] text-neutral-600 pt-0.5">
                    Styles: {asset.compatibleStyles.slice(0, 4).join(", ")}
                  </p>
                )}
              </div>
            </div>

            {asset.isDuplicate && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-400">
                <AlertTriangle size={12} />
                Similar asset already in catalog — review carefully before approving
              </div>
            )}

            {isObjectAsset(asset) ? (
              <div className="mt-2">
                <p className="mb-1 text-[11px] text-neutral-500">Library metadata (set a category so generation can find it)</p>
                <MetadataEditor asset={asset} />
              </div>
            ) : (
              <div className="mt-2">
                <p className="mb-1 text-[11px] text-neutral-500">Inferred PBR values (edit before approving)</p>
                <PBREditor
                  pbr={asset.pbr}
                  onChange={(pbr) => updateAssetPBR(asset.id, pbr)}
                />
              </div>
            )}

            {asset.type === "glb-model" && <GlbReview asset={asset} />}

            {approvalBlocker(asset) && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400">
                <AlertTriangle size={12} /> {approvalBlocker(asset)}
              </div>
            )}

            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => approveAsset(asset)}
                disabled={approvalBlocker(asset) !== null}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle size={13} /> Approve
              </button>
              {asset.source === "generated" && (
                <button
                  disabled
                  title={generation?.available === false ? generation.message : "Regeneration is not wired up yet."}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/8 py-1.5 text-xs font-medium text-neutral-600 cursor-not-allowed"
                >
                  Regenerate
                </button>
              )}
              <button
                onClick={() => rejectAsset(asset)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500/10 py-1.5 text-xs font-medium text-red-400 border border-red-500/15 hover:bg-red-500/20 transition"
              >
                <XCircle size={13} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Library Tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
  const catalog = useAssetStore((s) => s.catalog);
  const removeFromCatalog = useAssetStore((s) => s.removeFromCatalog);

  if (catalog.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-neutral-500">Library is empty</p>
        <p className="text-xs text-neutral-600">Approve queued assets to add them here</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="grid grid-cols-2 gap-2 pb-2 sm:grid-cols-3">
        {catalog.map((asset) => (
          <div
            key={asset.id}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] transition hover:border-white/10"
          >
            <div className="relative aspect-square overflow-hidden bg-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.thumbnailUrl}
                alt={asset.name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              {/* Color swatch overlay */}
              <div
                className="absolute bottom-1.5 right-1.5 h-5 w-5 rounded-full border-2 border-white/20 shadow"
                style={{ backgroundColor: asset.pbr.baseColor }}
              />
            </div>
            <div className="flex items-start justify-between gap-1 p-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-neutral-200">{asset.name}</p>
                <p className="text-[10px] text-neutral-600">
                  {SOURCE_LABELS[asset.source]}
                  {asset.family && <> · {categoryLabel(asset.family)}</>}
                </p>
              </div>
              <button
                onClick={() => removeFromCatalog(asset.id)}
                className="mt-0.5 shrink-0 text-neutral-700 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                title="Remove from library"
              >
                <Trash2 size={12} />
              </button>
            </div>
            {/* PBR pills */}
            <div className="flex gap-1 px-2 pb-2">
              <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">
                R {asset.pbr.roughness.toFixed(1)}
              </span>
              <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">
                M {asset.pbr.metalness.toFixed(1)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

type CuratorTab = "browse" | "needs" | "queue" | "library" | "recipes" | "learn" | "usage";

interface AssetCuratorProps {
  onClose: () => void;
  projectId?: string;
}

export function AssetCurator({ onClose, projectId }: AssetCuratorProps) {
  const [tab, setTab] = useState<CuratorTab>("learn");
  const [browseIntent, setBrowseIntent] = useState<BrowseIntent | undefined>();
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const openNeeds = useLibraryStore((s) => s.needs.filter((n) => n.status === "needed").length);
  const refreshLibrary = useLibraryStore((s) => s.refresh);

  useEffect(() => {
    void refreshLibrary(adminEmail);
  }, [adminEmail, refreshLibrary]);

  const goToBrowse = (source: AssetSource) => (need: Need) => {
    setBrowseIntent({ source, need });
    setTab("browse");
  };
  const queueLength = useAssetStore((s) => s.queue.length);
  const catalogLength = useAssetStore((s) => s.catalog.length);
  const pendingLearn = useLearnStore((s) => s.proposals.filter((p) => p.status === "pending").length);
  const clearAdmin = useAdminStore((s) => s.clearAdmin);

  const TABS: { id: CuratorTab; label: string; count?: number }[] = [
    { id: "learn",   label: "Learn",   count: pendingLearn },
    { id: "browse",  label: "Assets" },
    { id: "needs",   label: "Needs",   count: openNeeds },
    { id: "queue",   label: "Queue",   count: queueLength },
    { id: "library", label: "Library", count: catalogLength },
    { id: "recipes", label: "Recipes" },
    { id: "usage",   label: "Usage" },
  ];

  return (
    <ModalPortal onEscape={onClose}>
    <div className="fixed inset-0 flex flex-col bg-neutral-950/98 backdrop-blur" style={{ zIndex: 9999 }}>
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-neutral-100">Asset Curator</span>
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">Admin</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 rounded-lg border border-white/8 bg-white/[0.03] p-0.5">
          {TABS.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => { if (id === "browse") setBrowseIntent(undefined); setTab(id); }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                tab === id
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  tab === id ? "bg-amber-500/30 text-amber-300" : "bg-white/8 text-neutral-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { clearAdmin(); onClose(); }}
            className="text-[11px] text-neutral-600 hover:text-neutral-400 transition"
          >
            Sign out
          </button>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/8 hover:text-neutral-300 transition"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`mx-auto flex w-full flex-col overflow-hidden p-4 ${tab === "usage" ? "max-w-6xl" : "max-w-4xl"}`}>
          {tab === "learn"   && <LearnWorkspace projectId={projectId} />}
          {tab === "browse"  && <BrowseTab key={browseIntent?.need.id ?? "browse"} intent={browseIntent} />}
          {tab === "needs"   && <NeedsTab onSearch={goToBrowse("polyhaven")} onUpload={goToBrowse("upload")} />}
          {tab === "queue"   && <QueueTab />}
          {tab === "library" && <LibraryTab />}
          {tab === "recipes" && <RecipesTab />}
          {tab === "usage"   && <UsageTab />}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

