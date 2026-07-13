"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { useAssetStore } from "@/store/useAssetStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { setMaterialZone } from "@/lib/house/jsonEdit";
import { MATERIAL_LABELS, MATERIAL_TYPES, MATERIAL_ZONES, MATERIAL_ZONE_LABELS } from "@/lib/house/materials";
import { DEFAULT_MATERIALS_CONFIG, type MaterialType, type MaterialZone } from "@/types/house";

export function MaterialsPanel() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson ?? "{}"
  );
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const pbrMaterials = useAssetStore((s) => s.getPBRMaterials());
  const [applyZone, setApplyZone] = useState<string | null>(null);

  const { site } = generateHouseFromJson(houseConfigJson);
  const materials = site?.materials ?? DEFAULT_MATERIALS_CONFIG;

  const handleChange = (zone: MaterialZone, fields: Record<string, unknown>) => {
    updateHouseConfig(params.projectId, setMaterialZone(houseConfigJson, zone, fields));
  };

  const applyPBRToZone = (
    zone: MaterialZone,
    pbr: { baseColor: string; roughness: number; metalness: number }
  ) => {
    handleChange(zone, { color: pbr.baseColor, roughness: pbr.roughness, metalness: pbr.metalness });
  };

  return (
    <div className="flex flex-col gap-4 p-3">
      <p className="px-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Materials
      </p>

      {MATERIAL_ZONES.map((zone) => {
        const assignment = materials[zone];
        return (
          <div key={zone} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 text-xs font-medium text-neutral-300">{MATERIAL_ZONE_LABELS[zone]}</p>
            <div className="flex items-center gap-2">
              <select
                value={assignment.material}
                onChange={(e) => handleChange(zone, { material: e.target.value as MaterialType })}
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
                onChange={(e) => handleChange(zone, { color: e.target.value })}
                title="Color"
                className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-white/10 bg-neutral-800/60 p-1"
              />
            </div>
          </div>
        );
      })}

      {/* Imported Materials from the Asset Curator */}
      {pbrMaterials.length > 0 && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <p className="mb-2 text-xs font-medium text-neutral-300">Imported Materials</p>
          <div className="flex flex-wrap gap-2">
            {pbrMaterials.map((asset) => (
              <div key={asset.id} className="relative">
                <button
                  onClick={() => setApplyZone(applyZone === asset.id ? null : asset.id)}
                  title={asset.name}
                  className="group flex flex-col items-center gap-1 rounded-lg border border-white/5 bg-neutral-800/60 p-1.5 transition hover:border-white/15"
                >
                  <div
                    className="h-8 w-8 rounded-md border border-white/10"
                    style={{ backgroundColor: asset.pbr.baseColor }}
                  />
                  <span className="max-w-[48px] truncate text-[9px] text-neutral-500 group-hover:text-neutral-400">
                    {asset.name}
                  </span>
                </button>

                {/* Zone picker dropdown */}
                {applyZone === asset.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setApplyZone(null)} />
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-white/10 bg-neutral-900 py-1 shadow-2xl">
                      <p className="px-3 pb-1 pt-1.5 text-[10px] text-neutral-600">Apply to zone</p>
                      {MATERIAL_ZONES.map((zone) => (
                        <button
                          key={zone}
                          onClick={() => {
                            applyPBRToZone(zone, asset.pbr);
                            setApplyZone(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-neutral-300 hover:bg-white/5 transition"
                        >
                          <div
                            className="h-3 w-3 shrink-0 rounded-sm border border-white/10"
                            style={{ backgroundColor: materials[zone].color }}
                          />
                          {MATERIAL_ZONE_LABELS[zone]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-700">
            Click a swatch to apply it to a zone. Add more in the Asset Curator (shield icon).
          </p>
        </div>
      )}

      <p className="px-1 text-xs text-neutral-600">
        Changes apply instantly. Ask the AI Chat too — e.g. &quot;Make exterior white stucco&quot;
        or &quot;Use teak decking&quot;.
      </p>
    </div>
  );
}
