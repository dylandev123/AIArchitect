"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { KnowledgeBase, KnowledgeBaseVersion, LearnProposal, LearnedStylePreset } from "@/types/learn";

const EMPTY_KB: KnowledgeBase = { version: 0, publishedAt: "", presets: [] };

interface LearnStore {
  proposals: LearnProposal[];
  publishedKnowledge: KnowledgeBase;
  history: KnowledgeBaseVersion[];

  addProposal: (p: LearnProposal) => void;
  updateProposal: (id: string, updates: Partial<LearnProposal>) => void;
  approve: (id: string) => void;
  reject: (id: string) => void;
  rollback: () => void;
  findPreset: (styleKey: string) => LearnedStylePreset | undefined;
}

export const useLearnStore = create<LearnStore>()(
  persist(
    (set, get) => ({
      proposals: [],
      publishedKnowledge: EMPTY_KB,
      history: [],

      addProposal: (p) =>
        set((s) => ({ proposals: [p, ...s.proposals] })),

      updateProposal: (id, updates) =>
        set((s) => ({
          proposals: s.proposals.map((p) => p.id === id ? { ...p, ...updates } : p),
        })),

      approve: (id) => {
        const { proposals, publishedKnowledge, history } = get();
        const proposal = proposals.find((p) => p.id === id);
        if (!proposal || proposal.validationErrors.length > 0) return;

        const snapshot: KnowledgeBaseVersion = {
          ...publishedKnowledge,
          reason: `Before approving "${proposal.prompt.slice(0, 60)}"`,
        };

        // Merge new presets into published knowledge, overwriting by styleKey
        const existingPresets = publishedKnowledge.presets.filter(
          (p) => !proposal.presets.some((np) => np.styleKey === p.styleKey)
        );
        const newKB: KnowledgeBase = {
          version: publishedKnowledge.version + 1,
          publishedAt: new Date().toISOString(),
          presets: [...existingPresets, ...proposal.presets],
        };

        set({
          proposals: proposals.map((p) =>
            p.id === id ? { ...p, status: "approved" as const, reviewedAt: new Date().toISOString() } : p
          ),
          publishedKnowledge: newKB,
          history: [snapshot, ...history].slice(0, 20),
        });
      },

      reject: (id) =>
        set((s) => ({
          proposals: s.proposals.map((p) =>
            p.id === id ? { ...p, status: "rejected" as const, reviewedAt: new Date().toISOString() } : p
          ),
        })),

      rollback: () => {
        const { history, publishedKnowledge } = get();
        if (history.length === 0) return;
        const [prev, ...rest] = history;
        set({
          publishedKnowledge: { version: prev.version, publishedAt: prev.publishedAt, presets: prev.presets },
          history: rest,
        });
        void publishedKnowledge; // suppress unused
      },

      findPreset: (styleKey) =>
        get().publishedKnowledge.presets.find((p) => p.styleKey === styleKey),
    }),
    { name: "ai-architect-learn" }
  )
);
