"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, ProjectType, ProjectVersion, TimeOfDay } from "@/types/project";
import { BLANK_HOUSE_JSON } from "@/types/house";

function makeVersion(summary: string, houseConfigJson: string): ProjectVersion {
  return { id: crypto.randomUUID(), createdAt: Date.now(), summary, houseConfigJson };
}

const STORAGE_KEY = "ai-architect-projects";

interface ProjectStore {
  projects: Project[];
  createProject: (name: string, projectType?: ProjectType) => Project;
  renameProject: (id: string, name: string) => void;
  /** Copies a project (all versions) under a new ID, named "<name> (Copy)". Returns the copy. */
  duplicateProject: (id: string) => Project | undefined;
  setProjectType: (id: string, projectType: ProjectType) => void;
  /** Permanently removes a project. Returns false (and leaves it in place) if it couldn't be removed from storage. */
  deleteProject: (id: string) => boolean;
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
  /** Sets the visual time of day for the project's viewport. */
  setTimeOfDay: (id: string, tod: TimeOfDay) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],

      createProject: (name, projectType = "house") => {
        const initialVersion = makeVersion("Blank project", BLANK_HOUSE_JSON);
        const project: Project = {
          id: crypto.randomUUID(),
          name: name.trim() || "Untitled Project",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectType,
          houseConfigJson: BLANK_HOUSE_JSON,
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

      duplicateProject: (id) => {
        const source = get().projects.find((p) => p.id === id);
        if (!source) return undefined;
        const now = Date.now();
        const copy: Project = {
          ...structuredClone(source),
          id: crypto.randomUUID(),
          name: `${source.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ projects: [...state.projects, copy] }));
        return copy;
      },

      setProjectType: (id, projectType) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, projectType, updatedAt: Date.now() } : p
          ),
        })),

      deleteProject: (id) => {
        const previous = get().projects;
        try {
          set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
          // Confirm the removal actually reached storage, not just memory.
          const raw = localStorage.getItem(STORAGE_KEY);
          const stored = raw ? (JSON.parse(raw).state?.projects as Project[] | undefined) : [];
          if (stored?.some((p) => p.id === id)) throw new Error("not persisted");
          return true;
        } catch {
          try {
            set({ projects: previous });
          } catch {
            // storage is failing; in-memory state is restored regardless
          }
          return false;
        }
      },

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

      setTimeOfDay: (id, tod) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, timeOfDay: tod } : p
          ),
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 5,
      migrate: (persisted) => {
        const state = persisted as { projects?: Project[] };
        return {
          projects: (state.projects ?? []).map((p) => {
            const houseConfigJson = p.houseConfigJson ?? BLANK_HOUSE_JSON;
            const versions =
              p.versions && p.versions.length > 0 ? p.versions : [makeVersion("Blank project", houseConfigJson)];
            const currentVersionIndex =
              typeof p.currentVersionIndex === "number" &&
              p.currentVersionIndex >= 0 &&
              p.currentVersionIndex < versions.length
                ? p.currentVersionIndex
                : versions.length - 1;
            // v5: backfill projectType — existing projects default to "house"
            const projectType: ProjectType = (p as Project & { projectType?: ProjectType }).projectType ?? "house";
            return { ...p, houseConfigJson, versions, currentVersionIndex, projectType };
          }),
        };
      },
    }
  )
);

// Keep other open tabs in sync so a project deleted here can't be re-saved (resurrected)
// by a stale tab; the workspace page redirects home once its project disappears.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) void useProjectStore.persist.rehydrate();
  });
}
