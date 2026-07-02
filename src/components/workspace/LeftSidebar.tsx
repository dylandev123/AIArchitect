"use client";

import type { ComponentType } from "react";
import { useParams } from "next/navigation";
import { Boxes, Braces, Building2, History, Palette } from "lucide-react";
import { useUIStore, type LeftPanelTab } from "@/store/useUIStore";
import { ProjectsPanel } from "./panels/ProjectsPanel";
import { HouseJsonPanel } from "./panels/HouseJsonPanel";
import { HousePartsPanel } from "./panels/HousePartsPanel";
import { MaterialsPanel } from "./panels/MaterialsPanel";
import { HistoryPanel } from "./panels/HistoryPanel";

const TABS: { id: LeftPanelTab; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "projects", label: "Projects", icon: Building2 },
  { id: "houseJson", label: "Design", icon: Braces },
  { id: "parts", label: "Elements", icon: Boxes },
  { id: "materials", label: "Materials", icon: Palette },
  { id: "history", label: "History", icon: History },
];

export function LeftSidebar() {
  const params = useParams<{ projectId: string }>();
  const activeTab = useUIStore((s) => s.activeLeftTab);
  const setActiveTab = useUIStore((s) => s.setActiveLeftTab);

  return (
    <aside className="flex h-full w-72 shrink-0 border-r border-white/[0.07] bg-neutral-950/80">
      {/* Icon nav rail */}
      <nav className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.05] py-3">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            title={label}
            aria-label={label}
            className={`group flex h-10 w-10 flex-col items-center justify-center rounded-xl transition-all ${
              activeTab === id
                ? "bg-amber-500/15 text-amber-400 shadow-sm"
                : "text-neutral-600 hover:bg-white/[0.06] hover:text-neutral-300"
            }`}
          >
            <Icon size={17} />
          </button>
        ))}
      </nav>

      {/* Panel content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Panel header */}
        <div className="flex h-10 shrink-0 items-center border-b border-white/[0.05] px-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
            {TABS.find((t) => t.id === activeTab)?.label}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeTab === "projects" && <ProjectsPanel />}
          {activeTab === "houseJson" && <HouseJsonPanel key={params.projectId} />}
          {activeTab === "parts" && <HousePartsPanel />}
          {activeTab === "materials" && <MaterialsPanel />}
          {activeTab === "history" && <HistoryPanel />}
        </div>
      </div>
    </aside>
  );
}
