"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, ProjectVersion } from "@/types/project";
import { DEFAULT_HOUSE_JSON } from "@/types/house";

function makeVersion(summary: string, houseConfigJson: string): ProjectVersion {
  return { id: crypto.randomUUID(), createdAt: Date.now(), summary, houseConfigJson };
}

interface ProjectStore {
  projects: Project[];
  createProject: (name: string) => Project;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  touchProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  /** Granular live-JSON edit (manual textarea/inspector/add-buttons) — does not touch version history. */
  updateHouseConfig: (id: string, houseConfigJson: string) => void;
  /** Appends a new, permanent version (used after a successful AI edit) and jumps the cursor to it. */
  appendVersion: (id: string, summary: string, houseConfigJson: string) => void;
  /** Moves the cursor one version back, if possible. Nothing is deleted. */
  undo: (id: string) => void;
  /** Moves the cursor one version forward, if possible. */
  redo: (id: string) => void;
  /** Jumps the cursor directly to an arbitrary version (e.g. from the History panel). */
  restoreVersion: (id: string, versionIndex: number) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],

      createProject: (name) => {
        const initialVersion = makeVersion("Initial design", DEFAULT_HOUSE_JSON);
        const project: Project = {
          id: crypto.randomUUID(),
          name: name.trim() || "Untitled Project",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          houseConfigJson: DEFAULT_HOUSE_JSON,
          versions: [initialVersion],
          currentVersionIndex: 0,
        };
        set((state) => ({ projects: [...state.projects, project] }));
        return project;
      },

      renameProject: (id, name) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p
          ),
        })),

      deleteProject: (id) =>
        set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

      touchProject: (id) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, updatedAt: Date.now() } : p
          ),
        })),

      getProject: (id) => get().projects.find((p) => p.id === id),

      updateHouseConfig: (id, houseConfigJson) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, houseConfigJson, updatedAt: Date.now() } : p
          ),
        })),

      appendVersion: (id, summary, houseConfigJson) =>
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id) return p;
            const versions = [...p.versions, makeVersion(summary, houseConfigJson)];
            return {
              ...p,
              houseConfigJson,
              versions,
              currentVersionIndex: versions.length - 1,
              updatedAt: Date.now(),
            };
          }),
        })),

      undo: (id) =>
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id || p.currentVersionIndex <= 0) return p;
            const nextIndex = p.currentVersionIndex - 1;
            return {
              ...p,
              currentVersionIndex: nextIndex,
              houseConfigJson: p.versions[nextIndex].houseConfigJson,
              updatedAt: Date.now(),
            };
          }),
        })),

      redo: (id) =>
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id || p.currentVersionIndex >= p.versions.length - 1) return p;
            const nextIndex = p.currentVersionIndex + 1;
            return {
              ...p,
              currentVersionIndex: nextIndex,
              houseConfigJson: p.versions[nextIndex].houseConfigJson,
              updatedAt: Date.now(),
            };
          }),
        })),

      restoreVersion: (id, versionIndex) =>
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id || versionIndex < 0 || versionIndex >= p.versions.length) return p;
            return {
              ...p,
              currentVersionIndex: versionIndex,
              houseConfigJson: p.versions[versionIndex].houseConfigJson,
              updatedAt: Date.now(),
            };
          }),
        })),
    }),
    {
      name: "ai-architect-projects",
      version: 4,
      migrate: (persisted) => {
        const state = persisted as { projects?: Project[] };
        return {
          projects: (state.projects ?? []).map((p) => {
            const houseConfigJson = p.houseConfigJson ?? DEFAULT_HOUSE_JSON;
            const versions =
              p.versions && p.versions.length > 0 ? p.versions : [makeVersion("Initial design", houseConfigJson)];
            const currentVersionIndex =
              typeof p.currentVersionIndex === "number" &&
              p.currentVersionIndex >= 0 &&
              p.currentVersionIndex < versions.length
                ? p.currentVersionIndex
                : versions.length - 1;
            return { ...p, houseConfigJson, versions, currentVersionIndex };
          }),
        };
      },
    }
  )
);
