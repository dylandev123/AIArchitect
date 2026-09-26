"use client";

import { useState } from "react";
import { ArrowLeft, ChevronDown, DoorOpen } from "lucide-react";
import { useSceneStore } from "@/store/useSceneStore";
import { floorName, floorShortName } from "@/lib/house/roomView";
import { useFocusedRoom, useRooms } from "../useRoomFocus";

const CARD = "rounded-xl border border-white/10 bg-neutral-900/90 shadow-lg backdrop-blur";

/**
 * Compact floor/room picker over the viewport's top-left. Picking a room steps into it (camera, cutaway and AI scope
 * all follow from the scene store's focused room); "Full House View" steps back out.
 */
export function RoomNavigator({ projectId }: { projectId: string }) {
  const { rooms } = useRooms(projectId);
  const focused = useFocusedRoom(projectId);
  const enterRoom = useSceneStore((s) => s.enterRoom);
  const exitRoom = useSceneStore((s) => s.exitRoom);

  const [open, setOpen] = useState(false);
  const [pickedLevel, setPickedLevel] = useState<number | null>(null);

  if (rooms.length === 0) return null;

  const levels = [...new Set(rooms.map((r) => r.level))].sort((a, b) => a - b);
  const activeLevel = pickedLevel !== null && levels.includes(pickedLevel) ? pickedLevel : (focused?.level ?? levels[0]);
  const onLevel = rooms.filter((r) => r.level === activeLevel);

  return (
    <div className="pointer-events-none absolute left-3 top-3 flex w-56 flex-col gap-2">
      {focused && (
        <div className={`pointer-events-auto flex flex-col gap-2 p-2.5 ${CARD}`}>
          <div className="px-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">{focused.floorName}</p>
            <p className="text-sm font-semibold text-violet-200">{focused.name}</p>
          </div>
          <button
            onClick={() => exitRoom()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={12} />
            Full House View
          </button>
        </div>
      )}

      <div className={`pointer-events-auto overflow-hidden ${CARD}`}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:text-white"
        >
          <span className="flex items-center gap-2">
            <DoorOpen size={13} className="text-neutral-500" />
            {focused ? "Switch room" : "Rooms"}
            <span className="text-neutral-600">{rooms.length}</span>
          </span>
          <ChevronDown size={13} className={`text-neutral-600 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="border-t border-white/[0.06] p-2">
            {levels.length > 1 && (
              <div className="mb-2 flex gap-1" role="tablist" aria-label="Floor">
                {levels.map((level) => (
                  <button
                    key={level}
                    role="tab"
                    aria-selected={level === activeLevel}
                    title={floorName(level)}
                    onClick={() => setPickedLevel(level)}
                    className={`h-6 min-w-6 flex-1 rounded-md px-1.5 text-[11px] font-semibold transition ${
                      level === activeLevel
                        ? "bg-violet-500/25 text-violet-200"
                        : "bg-white/[0.04] text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    {floorShortName(level)}
                  </button>
                ))}
              </div>
            )}
            <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">{floorName(activeLevel)}</p>
            <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
              {onLevel.map((room) => {
                const active = focused?.index === room.index;
                return (
                  <li key={room.id ?? room.index}>
                    <button
                      onClick={() => {
                        enterRoom({ index: room.index, id: room.id });
                        setOpen(false);
                      }}
                      aria-current={active ? "true" : undefined}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition ${
                        active ? "bg-violet-500/20 text-violet-200" : "text-neutral-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <span>{room.name}</span>
                      <span className="text-[10px] text-neutral-600">
                        {room.width.toFixed(1)} × {room.depth.toFixed(1)} m
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
