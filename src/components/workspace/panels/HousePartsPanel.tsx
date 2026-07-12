"use client";

import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { useSceneStore } from "@/store/useSceneStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { addFeature, getFeatureCount } from "@/lib/house/jsonEdit";
import {
  getDefaultBuildingConfig,
  getDefaultFeatureConfig,
  getDefaultLandscapeConfig,
  getDefaultRoomConfig,
} from "@/lib/house/features/defaults";
import { DEFAULT_HOUSE_CONFIG } from "@/types/house";
import {
  ELEMENT_REGISTRY,
  GROUP_LABELS,
  GROUP_ORDER,
  getElementsForType,
  getProjectTypeSwitchWarning,
  type ElementEntry,
} from "@/lib/elementRegistry";
import { PROJECT_TYPE_EMOJI, PROJECT_TYPE_LABELS, type ProjectType } from "@/types/project";

// ── Element card ──────────────────────────────────────────────────────────────

function ElementCard({ entry, onClick }: { entry: ElementEntry; onClick: () => void }) {
  const Icon = entry.icon;
  const isSoon = entry.action.kind === "coming-soon";

  return (
    <button
      onClick={isSoon ? undefined : onClick}
      disabled={isSoon}
      title={isSoon ? `${entry.label} — coming soon` : `Add ${entry.label}`}
      className={`group relative flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-neutral-400 transition-all duration-150 active:scale-95 ${
        isSoon
          ? "cursor-default border-white/[0.04] bg-white/[0.01] opacity-35"
          : "border-white/[0.07] bg-white/[0.03] hover:border-amber-500/25 hover:bg-amber-500/8 hover:text-amber-300"
      }`}
    >
      <span className="relative">
        <Icon size={17} />
        {isSoon && (
          <span className="absolute -right-4 -top-1 rounded px-0.5 text-[8px] font-bold uppercase tracking-wide text-neutral-600">
            soon
          </span>
        )}
      </span>
      <span className="text-[11px] font-medium leading-tight text-center">{entry.label}</span>
    </button>
  );
}

// ── Project type selector ─────────────────────────────────────────────────────

const PROJECT_TYPES: ProjectType[] = ["house", "villa", "resort", "restaurant", "commercial"];

function ProjectTypeSelector({
  projectId,
  currentType,
  houseConfigJson,
}: {
  projectId: string;
  currentType: ProjectType;
  houseConfigJson: string;
}) {
  const setProjectType = useProjectStore((s) => s.setProjectType);

  const handleChange = (newType: ProjectType) => {
    if (newType === currentType) return;
    const warning = getProjectTypeSwitchWarning(houseConfigJson, newType);
    if (warning) {
      const ok = window.confirm(`${warning}\n\nContinue?`);
      if (!ok) return;
    }
    setProjectType(projectId, newType);
  };

  return (
    <div className="flex flex-wrap gap-1 px-3 pb-3 pt-2">
      {PROJECT_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => handleChange(type)}
          title={PROJECT_TYPE_LABELS[type]}
          className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all ${
            type === currentType
              ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
              : "border-white/[0.07] bg-white/[0.03] text-neutral-500 hover:border-white/15 hover:text-neutral-300"
          }`}
        >
          <span>{PROJECT_TYPE_EMOJI[type]}</span>
          <span className="hidden sm:inline">{PROJECT_TYPE_LABELS[type]}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function ElementsPanel() {
  const params = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.getProject(params.projectId));
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const selectKey = useSceneStore((s) => s.selectKey);

  if (!project) return null;

  const { id: projectId, houseConfigJson, projectType } = project;
  const house = generateHouseFromJson(houseConfigJson).config ?? DEFAULT_HOUSE_CONFIG;

  const handleEntry = (entry: ElementEntry) => {
    const { action } = entry;

    if (action.kind === "coming-soon") return;

    if (action.kind === "add-feature") {
      const defaults = getDefaultFeatureConfig(action.featureType, house);
      const newIndex = getFeatureCount(houseConfigJson, action.featureType);
      updateHouseConfig(projectId, addFeature(houseConfigJson, action.featureType, defaults));
      selectKey(`${action.featureType}-${newIndex}`);
      return;
    }

    if (action.kind === "add-room") {
      const existingCount = getFeatureCount(houseConfigJson, "room");
      const defaults = getDefaultRoomConfig(action.roomType, house, existingCount);
      updateHouseConfig(projectId, addFeature(houseConfigJson, "room", defaults));
      selectKey(`room-${existingCount}`);
      return;
    }

    if (action.kind === "add-building") {
      const existingCount = getFeatureCount(houseConfigJson, "building");
      const defaults = getDefaultBuildingConfig(action.buildingKind, house, existingCount);
      updateHouseConfig(projectId, addFeature(houseConfigJson, "building", defaults));
      selectKey(`building-${existingCount}`);
      return;
    }

    if (action.kind === "add-landscape") {
      const existingCount = getFeatureCount(houseConfigJson, "landscape");
      const defaults = getDefaultLandscapeConfig(action.landscapeKind, house, existingCount);
      updateHouseConfig(projectId, addFeature(houseConfigJson, "landscape", defaults));
      selectKey(`landscape-${existingCount}`);
      return;
    }
  };

  const allowed = getElementsForType(projectType);
  const groups = GROUP_ORDER[projectType];

  // Map group → entries in registry order
  const groupedEntries = new Map<string, ElementEntry[]>();
  for (const groupId of groups) {
    // Pull from the full registry filtered by both group AND projectType
    const entries = ELEMENT_REGISTRY.filter(
      (e) => e.group === groupId && allowed.some((a) => a.id === e.id)
    );
    if (entries.length > 0) groupedEntries.set(groupId, entries);
  }

  return (
    <div className="flex flex-col">
      {/* Project type selector */}
      <div className="border-b border-white/[0.05]">
        <ProjectTypeSelector
          projectId={projectId}
          currentType={projectType}
          houseConfigJson={houseConfigJson}
        />
      </div>

      {/* Element groups */}
      <div className="space-y-4 p-3">
        {groups.map((groupId) => {
          const entries = groupedEntries.get(groupId);
          if (!entries) return null;
          return (
            <div key={groupId}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-600">
                {GROUP_LABELS[groupId]}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {entries.map((entry) => (
                  <ElementCard
                    key={entry.id}
                    entry={entry}
                    onClick={() => handleEntry(entry)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <p className="text-[11px] leading-relaxed text-neutral-700 px-1">
          Click to add an element, then tap it in the scene to edit.
        </p>
      </div>
    </div>
  );
}

// Re-export legacy name so any remaining imports don't break
export { ElementsPanel as HousePartsPanel };
