"use client";

import { useParams } from "next/navigation";
import { X } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useAssetStore } from "@/store/useAssetStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { setMaterialZone, setExteriorOption } from "@/lib/house/jsonEdit";
import { MATERIAL_LABELS, MATERIAL_TYPES, MATERIAL_ZONES, MATERIAL_ZONE_LABELS } from "@/lib/house/materials";
import { SURFACES } from "@/lib/house/catalog/surfaces";
import { DEFAULT_MATERIALS_CONFIG, type MaterialType, type MaterialZone, type SurfaceKey } from "@/types/house";
import type { CuratedAsset } from "@/types/assets";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SURFACE_KEYS = Object.keys(SURFACES) as SurfaceKey[];

// ── Imported-asset strip inside a zone card ───────────────────────────────────

function ImportedAssetStrip({
  assets,
  activeId,
  uvScale,
  onSelect,
  onClear,
  onUvScaleChange,
}: {
  assets: CuratedAsset[];
  activeId?: string;
  uvScale: number;
  onSelect: (asset: CuratedAsset) => void;
  onClear: () => void;
  onUvScaleChange: (v: number) => void;
}) {
  if (assets.length === 0) return null;

  return (
    <div className="mt-2 border-t border-white/5 pt-2">
      <p className="mb-1.5 text-[10px] text-neutral-600">Imported texture</p>
      <div className="flex flex-wrap gap-1.5">
        {assets.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            title={a.name}
            className={`h-7 w-7 rounded-md border transition ${
              a.id === activeId
                ? "border-amber-400 ring-1 ring-amber-400/40"
                : "border-white/10 hover:border-white/25"
            }`}
            style={{ backgroundColor: a.pbr.baseColor }}
          />
        ))}
      </div>

      {activeId && (
        <div className="mt-2 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[10px] text-neutral-500">UV Scale</span>
            <input
              type="range"
              min={0.25}
              max={8}
              step={0.25}
              value={uvScale}
              onChange={(e) => onUvScaleChange(parseFloat(e.target.value))}
              className="flex-1"
            />
            <span className="w-6 text-right text-[10px] font-mono text-neutral-400">{uvScale}×</span>
            <button
              onClick={onClear}
              title="Remove texture"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-600 hover:text-neutral-300 transition"
            >
              <X size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Patio / driveway / pool surface card ──────────────────────────────────────

function SurfaceCard({
  label,
  surfaceKey,
  activeAssetId,
  uvScale,
  allAssets,
  onSurfaceChange,
  onAssetSelect,
  onAssetClear,
  onUvScaleChange,
}: {
  label: string;
  surfaceKey: SurfaceKey;
  activeAssetId?: string;
  uvScale: number;
  allAssets: CuratedAsset[];
  onSurfaceChange: (key: SurfaceKey) => void;
  onAssetSelect: (asset: CuratedAsset) => void;
  onAssetClear: () => void;
  onUvScaleChange: (v: number) => void;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <p className="mb-2 text-xs font-medium text-neutral-300">{label}</p>
      <select
        value={surfaceKey}
        onChange={(e) => onSurfaceChange(e.target.value as SurfaceKey)}
        className="w-full rounded-md border border-white/10 bg-neutral-800/60 px-2.5 py-1.5 text-sm text-neutral-200 outline-none focus:border-amber-500/50"
      >
        {SURFACE_KEYS.map((key) => (
          <option key={key} value={key}>
            {SURFACES[key].label}
          </option>
        ))}
      </select>

      <ImportedAssetStrip
        assets={allAssets}
        activeId={activeAssetId}
        uvScale={uvScale}
        onSelect={onAssetSelect}
        onClear={onAssetClear}
        onUvScaleChange={onUvScaleChange}
      />
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function MaterialsPanel() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson ?? "{}"
  );
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const pbrMaterials = useAssetStore((s) => s.getPBRMaterials());

  const { site } = generateHouseFromJson(houseConfigJson);
  const materials = site?.materials ?? DEFAULT_MATERIALS_CONFIG;
  const extOpts = site?.exteriorOptions;

  // ── Zone handlers ──────────────────────────────────────────────────────────

  const handleZoneChange = (zone: MaterialZone, fields: Record<string, unknown>) => {
    updateHouseConfig(params.projectId, setMaterialZone(houseConfigJson, zone, fields));
  };

  const applyAssetToZone = (zone: MaterialZone, asset: CuratedAsset) => {
    handleZoneChange(zone, {
      color: asset.pbr.baseColor,
      roughness: asset.pbr.roughness,
      metalness: asset.pbr.metalness,
      assetId: asset.id,
      uvScale: materials[zone].uvScale ?? 1,
    });
  };

  const clearAssetFromZone = (zone: MaterialZone) => {
    handleZoneChange(zone, { assetId: null, uvScale: null });
  };

  const setZoneUvScale = (zone: MaterialZone, scale: number) => {
    handleZoneChange(zone, { uvScale: scale });
  };

  // ── Exterior option helpers ────────────────────────────────────────────────

  const setExtOpt = (key: string, value: unknown) => {
    updateHouseConfig(params.projectId, setExteriorOption(houseConfigJson, key, value));
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Materials
      </p>

      {/* ── Zone cards: exterior, roof, trim, decking ── */}
      {MATERIAL_ZONES.map((zone) => {
        const assignment = materials[zone];
        const activeId = assignment.assetId;
        const uvScale = assignment.uvScale ?? 1;

        return (
          <div key={zone} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs font-medium text-neutral-300">{MATERIAL_ZONE_LABELS[zone]}</p>
            <div className="flex items-center gap-2">
              <select
                value={assignment.material}
                onChange={(e) => {
                  // Clear imported asset when changing built-in material type
                  handleZoneChange(zone, {
                    material: e.target.value as MaterialType,
                    assetId: null,
                    uvScale: null,
                  });
                }}
                className="flex-1 rounded-md border border-white/10 bg-neutral-800/60 px-2.5 py-1.5 text-sm text-neutral-200 outline-none focus:border-amber-500/50"
              >
                {MATERIAL_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {MATERIAL_LABELS[type]}
                  </option>
                ))}
              </select>
              <input
                type="color"
                value={assignment.color}
                onChange={(e) => handleZoneChange(zone, { color: e.target.value })}
                title="Color"
                className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-white/10 bg-neutral-800/60 p-1"
              />
            </div>

            <ImportedAssetStrip
              assets={pbrMaterials}
              activeId={activeId}
              uvScale={uvScale}
              onSelect={(asset) => applyAssetToZone(zone, asset)}
              onClear={() => clearAssetFromZone(zone)}
              onUvScaleChange={(v) => setZoneUvScale(zone, v)}
            />
          </div>
        );
      })}

      {/* ── Surface overrides: patio, driveway, pool ── */}
      <p className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Surfaces
      </p>

      <SurfaceCard
        label="Patio"
        surfaceKey={(extOpts?.patioSurface ?? "concrete") as SurfaceKey}
        activeAssetId={extOpts?.patioAssetId}
        uvScale={extOpts?.patioUvScale ?? 1}
        allAssets={pbrMaterials}
        onSurfaceChange={(key) => {
          setExtOpt("patioSurface", key);
          setExtOpt("patioAssetId", null);
          setExtOpt("patioUvScale", null);
        }}
        onAssetSelect={(asset) => {
          setExtOpt("patioAssetId", asset.id);
          setExtOpt("patioUvScale", extOpts?.patioUvScale ?? 1);
        }}
        onAssetClear={() => {
          setExtOpt("patioAssetId", null);
          setExtOpt("patioUvScale", null);
        }}
        onUvScaleChange={(v) => setExtOpt("patioUvScale", v)}
      />

      <SurfaceCard
        label="Driveway"
        surfaceKey={(extOpts?.patioSurface ?? "concrete") as SurfaceKey}
        activeAssetId={extOpts?.drivewayAssetId}
        uvScale={extOpts?.drivewayUvScale ?? 1}
        allAssets={pbrMaterials}
        onSurfaceChange={(key) => {
          setExtOpt("patioSurface", key);
          setExtOpt("drivewayAssetId", null);
          setExtOpt("drivewayUvScale", null);
        }}
        onAssetSelect={(asset) => {
          setExtOpt("drivewayAssetId", asset.id);
          setExtOpt("drivewayUvScale", extOpts?.drivewayUvScale ?? 1);
        }}
        onAssetClear={() => {
          setExtOpt("drivewayAssetId", null);
          setExtOpt("drivewayUvScale", null);
        }}
        onUvScaleChange={(v) => setExtOpt("drivewayUvScale", v)}
      />

      <SurfaceCard
        label="Pool Tile"
        surfaceKey={(extOpts?.poolTile ?? "mosaic-tile") as SurfaceKey}
        activeAssetId={extOpts?.poolAssetId}
        uvScale={extOpts?.poolUvScale ?? 1}
        allAssets={pbrMaterials}
        onSurfaceChange={(key) => {
          setExtOpt("poolTile", key);
          setExtOpt("poolAssetId", null);
          setExtOpt("poolUvScale", null);
        }}
        onAssetSelect={(asset) => {
          setExtOpt("poolAssetId", asset.id);
          setExtOpt("poolUvScale", extOpts?.poolUvScale ?? 1);
        }}
        onAssetClear={() => {
          setExtOpt("poolAssetId", null);
          setExtOpt("poolUvScale", null);
        }}
        onUvScaleChange={(v) => setExtOpt("poolUvScale", v)}
      />

      <p className="px-1 text-xs text-neutral-600">
        Changes apply instantly. Imported textures load in the background — solid color shows as fallback.
      </p>
    </div>
  );
}
