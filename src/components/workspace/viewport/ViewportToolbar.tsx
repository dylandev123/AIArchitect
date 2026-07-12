"use client";

import { useParams } from "next/navigation";
import {
  Eye,
  EyeOff,
  Globe,
  Home,
  LayoutGrid,
  PersonStanding,
  Square,
} from "lucide-react";
import { useSceneStore } from "@/store/useSceneStore";
import { useProjectStore } from "@/store/useProjectStore";
import { TIME_OF_DAY } from "@/lib/timeOfDay";
import type { TimeOfDay } from "@/types/project";

const CAM_BUTTONS = [
  { id: "site" as const,  icon: Globe,  title: "Full site view"  },
  { id: "house" as const, icon: Home,   title: "House close-up"  },
  { id: "top" as const,   icon: Square, title: "Top-down / plan" },
] as const;

const TOD_ORDER: TimeOfDay[] = ["morning", "midday", "sunset", "night"];

export function ViewportToolbar({
  onResetCamera,
  onEnterWalk,
}: {
  onResetCamera: () => void;
  onEnterWalk: () => void;
}) {
  const showRoof = useSceneStore((s) => s.showRoof);
  const toggleRoof = useSceneStore((s) => s.toggleRoof);
  const viewMode = useSceneStore((s) => s.viewMode);
  const setViewMode = useSceneStore((s) => s.setViewMode);
  const triggerCameraPreset = useSceneStore((s) => s.triggerCameraPreset);
  const roomLabel = useSceneStore((s) => s.roomLabel);
  const walkMode = useSceneStore((s) => s.walkMode);
  const setWalkMode = useSceneStore((s) => s.setWalkMode);

  const params = useParams<{ projectId: string }>();
  const timeOfDay: TimeOfDay = useProjectStore(
    (s) => s.getProject(params.projectId)?.timeOfDay ?? "midday"
  );
  const setTimeOfDay = useProjectStore((s) => s.setTimeOfDay);

  const handleCameraMode = (mode: "site" | "house" | "top") => {
    if (mode !== "top") setViewMode("site");
    if (!showRoof && mode !== "top") toggleRoof();
    triggerCameraPreset(mode);
    onResetCamera();
  };

  const handleExitRoomView = () => {
    setViewMode("site");
    if (!showRoof) toggleRoof();
    triggerCameraPreset("house");
  };

  return (
    <>
      {/* Room-view breadcrumb — top-left when in room mode */}
      {viewMode === "room" && (
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-2">
          <button
            onClick={handleExitRoomView}
            className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-900/90 px-3 py-1.5 text-xs font-medium text-neutral-300 shadow-lg backdrop-blur transition hover:bg-white/10 hover:text-white"
          >
            ← Full House View
            {roomLabel && (
              <>
                <span className="text-neutral-600">/</span>
                <span className="text-violet-300">{roomLabel}</span>
              </>
            )}
          </button>

          {!roomLabel && (
            <div className="pointer-events-none rounded-xl border border-white/[0.06] bg-neutral-900/80 px-3 py-2 text-[11px] text-neutral-500 backdrop-blur">
              Select a room in the scene to focus it
            </div>
          )}
        </div>
      )}

      {/* Right-side toolbar */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col gap-1.5">

        {/* Camera presets */}
        <div className="flex flex-col gap-1">
          {CAM_BUTTONS.map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              onClick={() => handleCameraMode(id)}
              title={title}
              className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-neutral-900/90 text-neutral-400 shadow-lg backdrop-blur transition hover:scale-105 hover:text-neutral-200 active:scale-95"
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <div className="mx-auto w-5 border-b border-white/[0.08]" />

        {/* Roof toggle */}
        <button
          onClick={toggleRoof}
          title={showRoof ? "Hide roof (see inside)" : "Show roof"}
          className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 shadow-lg backdrop-blur transition hover:scale-105 active:scale-95 ${
            showRoof
              ? "bg-neutral-900/90 text-neutral-400 hover:text-neutral-200"
              : "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
          }`}
        >
          {showRoof ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>

        {/* Grid toggle */}
        <button
          onClick={() => useSceneStore.getState().toggleGrid()}
          title="Toggle grid"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-neutral-900/90 text-neutral-400 shadow-lg backdrop-blur transition hover:scale-105 hover:text-neutral-200 active:scale-95"
        >
          <LayoutGrid size={15} />
        </button>

        {/* First-person walk */}
        <button
          onClick={() => (walkMode ? setWalkMode(false) : onEnterWalk())}
          title={walkMode ? "Exit walk mode (ESC)" : "Enter first-person walk (WASD)"}
          className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border shadow-lg backdrop-blur transition hover:scale-105 active:scale-95 ${
            walkMode
              ? "border-violet-500/40 bg-violet-500/20 text-violet-400 hover:bg-violet-500/30"
              : "border-white/10 bg-neutral-900/90 text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <PersonStanding size={15} />
        </button>

        <div className="mx-auto w-5 border-b border-white/[0.08]" />

        {/* Time-of-day picker */}
        <div className="flex flex-col gap-1">
          {TOD_ORDER.map((tod) => {
            const cfg = TIME_OF_DAY[tod];
            const isActive = timeOfDay === tod;
            return (
              <button
                key={tod}
                onClick={() => setTimeOfDay(params.projectId, tod)}
                title={cfg.label}
                className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-xl border text-sm shadow-lg backdrop-blur transition hover:scale-105 active:scale-95 ${
                  isActive
                    ? "border-sky-500/40 bg-sky-500/20 text-white"
                    : "border-white/10 bg-neutral-900/90 text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {cfg.emoji}
              </button>
            );
          })}
        </div>

      </div>
    </>
  );
}
