"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { compileArchitecture, type ArchitectureDiagnostics } from "@/lib/architecture/compiler";
import { isArchitecturalDesignDocument } from "@/lib/architecture/document";
import { DEFAULT_MATERIALS_CONFIG, BLANK_HOUSE_JSON } from "@/types/house";

const STATUS_STYLES: Record<string, string> = {
  applied: "text-emerald-400",
  fallback: "text-amber-400",
  unavailable: "text-neutral-500",
};

/** Temporary, dev-only view into what the live compile path actually produced — not part of the render pipeline itself. */
export function ArchitectureDebugPanel() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore((s) => s.getProject(params.projectId)?.houseConfigJson);

  const { source, diagnostics } = useMemo((): { source: "new" | "legacy"; diagnostics?: ArchitectureDiagnostics } => {
    try {
      const raw = JSON.parse(houseConfigJson ?? BLANK_HOUSE_JSON);
      const document = raw.architecturalDesignDocument ?? raw.architectureDocument;
      if (isArchitecturalDesignDocument(document)) {
        const legacy = generateHouseFromJson(houseConfigJson ?? BLANK_HOUSE_JSON);
        const { diagnostics } = compileArchitecture(document, { materials: legacy.site?.materials ?? DEFAULT_MATERIALS_CONFIG, mode: "full" });
        return { source: "new", diagnostics };
      }
    } catch { /* falls through to legacy */ }
    return { source: "legacy" };
  }, [houseConfigJson]);

  return (
    <div className="space-y-4 p-4 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-neutral-500">Architecture source</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${source === "new" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-neutral-400"}`}>
          {source === "new" ? "NEW · ArchitecturalDesignDocument" : "LEGACY · single-box shell"}
        </span>
      </div>

      {!diagnostics && (
        <p className="text-neutral-600">No architectural document on this project — rendering the legacy shell.</p>
      )}

      {diagnostics && (
        <>
          <section className="space-y-1.5">
            <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Masses ({diagnostics.massCount})</h3>
            {diagnostics.masses.map((mass) => (
              <div key={mass.id} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <div className="font-medium text-neutral-200">
                  {mass.name} <span className="text-neutral-600">· {mass.role}</span>
                </div>
                <div className="text-neutral-500">
                  pos ({mass.position.x.toFixed(1)}, {mass.position.z.toFixed(1)}) · rot {(mass.rotation * 180 / Math.PI).toFixed(0)}° · elev {mass.elevation.toFixed(1)}m
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Roof recipes</h3>
            {diagnostics.roofs.map((roof) => (
              <div key={roof.massId} className="flex justify-between text-neutral-400">
                <span>{roof.massId}</span>
                <span className="text-neutral-200">{roof.kind}</span>
              </div>
            ))}
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Capabilities</h3>
            {diagnostics.capabilities.length === 0 && <p className="text-neutral-600">None requested.</p>}
            {diagnostics.capabilities.map((capability, i) => (
              <div key={`${capability.id}-${capability.massId}-${i}`} className="flex items-center justify-between">
                <span className="text-neutral-400">
                  {capability.id} <span className="text-neutral-600">→ {capability.massId}</span>
                </span>
                <span className={STATUS_STYLES[capability.status] ?? "text-neutral-500"}>{capability.status}</span>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
