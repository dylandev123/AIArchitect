"use client";

import { useParams } from "next/navigation";
import { Boxes, Braces, MousePointerClick, Palette, X } from "lucide-react";
import { useUIStore, type MobileSheet } from "@/store/useUIStore";
import { HouseJsonPanel } from "./panels/HouseJsonPanel";
import { HousePartsPanel } from "./panels/HousePartsPanel";
import { MaterialsPanel } from "./panels/MaterialsPanel";
import { PropertyInspector } from "./inspector/PropertyInspector";

const NAV_ITEMS: { id: MobileSheet; icon: typeof Braces; label: string }[] = [
  { id: "design", icon: Braces, label: "Design" },
  { id: "elements", icon: Boxes, label: "Elements" },
  { id: "materials", icon: Palette, label: "Materials" },
  { id: "properties", icon: MousePointerClick, label: "Properties" },
];

export function MobileNav() {
  const params = useParams<{ projectId: string }>();
  const mobileSheet = useUIStore((s) => s.mobileSheet);
  const setMobileSheet = useUIStore((s) => s.setMobileSheet);

  const toggle = (sheet: MobileSheet) => {
    setMobileSheet(mobileSheet === sheet ? null : sheet);
  };

  return (
    <>
      {/* Slide-up panel */}
      {mobileSheet && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50"
            onClick={() => setMobileSheet(null)}
          />
          <div className="fixed bottom-14 left-0 right-0 z-40 max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-neutral-900 shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-neutral-900 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-100 capitalize">{mobileSheet}</p>
              <button
                onClick={() => setMobileSheet(null)}
                className="rounded-md p-1 text-neutral-500 hover:text-neutral-300"
              >
                <X size={16} />
              </button>
            </div>
            <div className="pb-safe">
              {mobileSheet === "design" && <HouseJsonPanel key={params.projectId} />}
              {mobileSheet === "elements" && <HousePartsPanel />}
              {mobileSheet === "materials" && <MaterialsPanel />}
              {mobileSheet === "properties" && <PropertyInspector />}
            </div>
          </div>
        </>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-stretch border-t border-white/10 bg-neutral-900/95 backdrop-blur md:hidden">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => toggle(id)}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
              mobileSheet === id ? "text-amber-400" : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <Icon size={18} />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
