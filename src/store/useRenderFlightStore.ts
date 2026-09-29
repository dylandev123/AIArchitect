"use client";

import { create } from "zustand";

export interface RenderFlightSnapshot {
  sequence: number; timestamp: number; source: string; projectId: string; configJson: string;
  configHash: string; documentHash?: string; v2: boolean; primitiveCount: number;
  primitiveHash: string; massIds: string[]; bounds?: unknown; lifecycle?: string;
}

interface RenderFlightState {
  snapshots: RenderFlightSnapshot[]; lastWriter: string; freeze: boolean; frozen?: RenderFlightSnapshot; viewed?: RenderFlightSnapshot;
  noteWrite: (source: string) => void;
  record: (snapshot: Omit<RenderFlightSnapshot, "sequence" | "timestamp" | "source">, lifecycle?: string) => void;
  captureCurrent: () => void; toggleFreeze: () => void; view: (snapshot?: RenderFlightSnapshot) => void;
}

let sequence = 0;
export const useRenderFlightStore = create<RenderFlightState>((set, get) => ({
  snapshots: [], lastWriter: "initial-load", freeze: false,
  noteWrite: (lastWriter) => set({ lastWriter }),
  record: (input, lifecycle) => {
    const snapshot: RenderFlightSnapshot = { ...input, sequence: ++sequence, timestamp: Date.now(), source: get().lastWriter, lifecycle };
    const previous = get().snapshots.at(-1);
    if (previous && (previous.primitiveHash !== snapshot.primitiveHash || previous.configHash !== snapshot.configHash || previous.v2 !== snapshot.v2)) console.warn("[RENDER TRANSITION]", { from: previous, to: snapshot, cause: snapshot.source });
    set((state) => ({ snapshots: [...state.snapshots, snapshot].slice(-30) }));
  },
  captureCurrent: () => set((state) => {
    const current = state.snapshots.at(-1);
    return current ? { snapshots: [...state.snapshots, { ...current, sequence: ++sequence, timestamp: Date.now(), source: "manual-capture", lifecycle: "manual-capture" }].slice(-30) } : state;
  }),
  toggleFreeze: () => set((state) => state.freeze ? { freeze: false, frozen: undefined } : { freeze: true, frozen: state.snapshots.at(-1) }),
  view: (viewed) => set({ viewed }),
}));
