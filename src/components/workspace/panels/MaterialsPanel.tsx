"use client";

import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
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

  const { site } = generateHouseFromJson(houseConfigJson);
  const materials = site?.materials ?? DEFAULT_MATERIALS_CONFIG;

  const handleChange = (zone: MaterialZone, fields: Record<string, unknown>) => {
    updateHouseConfig(params.projectId, setMaterialZone(houseConfigJson, zone, fields));
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

      <p className="px-1 text-xs text-neutral-600">
        Changes apply instantly. Ask the AI Chat too — e.g. &quot;Make exterior white stucco&quot;
        or &quot;Use teak decking&quot;.
      </p>
    </div>
  );
}
