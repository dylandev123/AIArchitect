"use client";

import { useEffect, useMemo } from "react";
import { useProjectStore } from "@/store/useProjectStore";
import { useSceneStore } from "@/store/useSceneStore";
import { CAMERA_FLIGHT_MS, listRooms, resolveRoomFocus, type RoomInfo, type RoomList } from "@/lib/house/roomView";

/** The project's rooms, re-derived only when its design changes. */
export function useRooms(projectId: string): RoomList {
  const json = useProjectStore((s) => s.getProject(projectId)?.houseConfigJson);
  return useMemo(() => listRooms(json ?? ""), [json]);
}

/** The room currently stepped into, resolved against the live design (null for the whole-house view). */
export function useFocusedRoom(projectId: string): RoomInfo | null {
  const { rooms } = useRooms(projectId);
  const focus = useSceneStore((s) => s.focusedRoom);
  return useMemo(() => resolveRoomFocus(rooms, focus), [rooms, focus]);
}

/**
 * Keeps room focus honest as the design changes underneath it. Mount once, alongside the viewport.
 *  - a room the AI removed (or an undo that erased it) sends the user back to the whole house;
 *  - an id backfilled by an edit, or a room that moved in the array, is followed without moving the camera;
 *  - the cutaway follows the room's floor and is lifted once the camera has flown back outside;
 *  - leaving the project drops the focus so it can't leak into the next one.
 */
export function useRoomFocusSync(projectId: string): void {
  const focused = useFocusedRoom(projectId);
  const focus = useSceneStore((s) => s.focusedRoom);
  const cutawayLevel = useSceneStore((s) => s.cutawayLevel);

  useEffect(() => {
    const { exitRoom, syncRoomFocus, setCutawayLevel } = useSceneStore.getState();
    if (!focus) return;
    if (!focused) {
      exitRoom();
      return;
    }
    if (focused.index !== focus.index || focused.id !== focus.id) syncRoomFocus({ index: focused.index, id: focused.id });
    if (cutawayLevel !== focused.level) setCutawayLevel(focused.level);
  }, [focus, focused, cutawayLevel]);

  useEffect(() => {
    if (focus || cutawayLevel === null) return;
    const timer = setTimeout(() => useSceneStore.getState().setCutawayLevel(null), CAMERA_FLIGHT_MS + 100);
    return () => clearTimeout(timer);
  }, [focus, cutawayLevel]);

  useEffect(
    () => () => {
      const { exitRoom, setCutawayLevel } = useSceneStore.getState();
      exitRoom({ camera: false });
      setCutawayLevel(null);
    },
    [projectId]
  );
}
