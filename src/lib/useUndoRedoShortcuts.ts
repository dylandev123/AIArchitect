"use client";

import { useEffect } from "react";
import { useProjectStore } from "@/store/useProjectStore";

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/** Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) to redo — ignored while typing in a text field. */
export function useUndoRedoShortcuts(projectId: string) {
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || isTextInput(e.target)) return;

      if (e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        redo(projectId);
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo(projectId);
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo(projectId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [projectId, undo, redo]);
}
