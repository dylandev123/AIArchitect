"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ArchitecturalWorkspaceView, GenerationMode, Project, ProjectType, ProjectVersion, TimeOfDay } from "@/types/project";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { BLANK_V3_SCENE, isV3ProjectRoot } from "@/lib/v3/scene";
import { projectModeAuthority, resolveProjectGenerationMode } from "@/lib/v3/projectMode";
import { revalidateArchitecturalScene } from "@/lib/v3/architecturalAcceptance";
import { isV3PlanEvaluation, checkoutPlanEvaluation } from "@/lib/v3/architecturalPlanEvaluation";
import { needsInitialGeneration } from "@/lib/house/blank";
import { validateV3Scene } from "@/lib/v3/validation";
import { documentAudit } from "@/lib/architecture/renderAudit";
import { useRenderFlightStore } from "./useRenderFlightStore";
import { backupProjectsBeforeRecovery } from "@/lib/storage/recoveryBackup";
import { projectStorage, readProjectStorage } from "@/lib/storage/projectStorage";

function makeVersion(summary: string, houseConfigJson: string): ProjectVersion {
  return { id: crypto.randomUUID(), createdAt: Date.now(), summary, houseConfigJson };
}

export const PROJECT_STORAGE_KEY = "ai-architect-projects";
export interface RecoveredDraft {
  name: string;
  houseConfigJson: string;
  sha256: string;
  originalBlueprint: string;
}
let devConfigRevision = 0;

function normalizePersistedProject(project: Project): Project {
  // This also runs for a same-version rehydrate through `merge`, which is
  // essential for a V3 record written by an earlier experimental build.
  return { ...project, generationMode: project.generationMode === "v3-scene" ? "v3-scene" : resolveProjectGenerationMode(project) };
}

/** V3 commits cannot silently replace semantic authority with another project format. */
function assertV3Commit(project: Project | undefined, json: string): void {
  if (!project || (project.generationMode !== "v3-scene" && resolveProjectGenerationMode(project) !== "v3-scene")) return;
  let root: unknown;
  try { root = JSON.parse(json); } catch { throw new Error("V3 commit requires valid JSON; the current scene was preserved."); }
  if (!isV3ProjectRoot(root)) throw new Error("V3 project cannot commit a V2 or malformed root.");
  if(isV3PlanEvaluation(root.v3Scene)){
    const checked=checkoutPlanEvaluation(root.v3Scene);
    if(!checked.ok)throw new Error(`Plan commit rejected: ${checked.findings[0]?.message}`);
    return;
  }
  const validation = validateV3Scene(root.v3Scene, { lenient: true });
  if (!validation.ok) {
    // Blueprint drafts receive the full independent acceptance audit. A marker
    // alone never bypasses a structural or primary-access failure.
    if (root.v3Scene.metadata?.architecturalValidation && revalidateArchitecturalScene(root.v3Scene).ok) return;
    throw new Error(`V3 commit rejected: ${validation.errors[0]}`);
  }
}

/** State and diagnostics are committed in the same JSON/version as the scene. */
function prepareArchitecturalCommit(project: Project | undefined, json: string, writer: string): string {
  assertV3Commit(project,json);
  if (!project || (project.generationMode!=="v3-scene" && resolveProjectGenerationMode(project)!=="v3-scene")) return json;
  const root = JSON.parse(json);
  if (!isV3ProjectRoot(root)) return json;
  if(isV3PlanEvaluation(root.v3Scene)){
    const checked=checkoutPlanEvaluation(root.v3Scene);
    return JSON.stringify({...root,v3Scene:{...checked.scene,metadata:{...root.v3Scene.metadata,planDiagnostics:checked.findings,planUnresolved:checked.scene?.metadata.planUnresolved??[]}}});
  }
  const previous = JSON.parse(project.houseConfigJson);
  if (!root.v3Scene.metadata?.architecturalValidation && !previous.v3Scene?.metadata?.architecturalValidation) return json;
  const checked = revalidateArchitecturalScene(root.v3Scene);
  if (!checked.ok) throw new Error(`Architectural commit rejected: ${checked.findings.find(f=>f.severity==='fatal')?.message}`);
  if (checked.outcome==='draft' && writer==='ai-initial-generation' && !needsInitialGeneration(project))
    throw new Error('Draft generation cannot replace an existing designed project.');
  return JSON.stringify({...root,v3Scene:checked.scene});
}

export type PersistedModeVerification =
  | { ok: true; project: Project; persistedMode: GenerationMode }
  | { ok: false; error: string; persistedMode?: GenerationMode };

/**
 * Reads the browser-persisted record, rather than Zustand's current memory.
 * New V3 entry points call this immediately after creation before navigation.
 */
export function verifyPersistedProjectMode(projectId: string, expected: GenerationMode): PersistedModeVerification {
  if (typeof window === "undefined") return { ok: false, error: "Project storage is unavailable; workspace entry was blocked." };
  try {
    const raw = readProjectStorage(PROJECT_STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) as { state?: { projects?: Project[] } } : undefined;
    const project = saved?.state?.projects?.find((candidate) => candidate.id === projectId);
    if (!project) return { ok: false, error: "Project was not persisted; workspace entry was blocked." };
    const authority = projectModeAuthority(project);
    if (authority.persistedMode !== expected || !authority.agrees) {
      return { ok: false, persistedMode: authority.persistedMode, error: `Project mode was not persisted as ${expected}; workspace entry was blocked.` };
    }
    return { ok: true, project, persistedMode: authority.persistedMode };
  } catch {
    return { ok: false, error: "Project storage could not be read; workspace entry was blocked." };
  }
}

function logConfigChange(id: string, houseConfigJson: string, source: string): void {
  useRenderFlightStore.getState().noteWrite(source);
  if (process.env.NODE_ENV === "production") return;
  try {
    const raw = JSON.parse(houseConfigJson) as Record<string, unknown>;
    if (isV3ProjectRoot(raw)) {
      console.info("[V3 CONFIG]", { revision: ++devConfigRevision, source, projectId: id, objectCount: raw.v3Scene.objects.length });
      return;
    }
    const document = raw.architecturalDesignDocument ?? raw.architectureDocument;
    const audit = document && typeof document === "object" && "massing" in document ? documentAudit(document as Parameters<typeof documentAudit>[0]) : undefined;
    console.info("[V2 CONFIG]", { revision: ++devConfigRevision, source, projectId: id, hasArchitecturalDesignDocument: !!raw.architecturalDesignDocument, documentHash: audit?.hash, massCount: audit?.massCount ?? 0, operationCount: audit?.operationCount ?? 0 });
  } catch { console.info("[V2 CONFIG]", { revision: ++devConfigRevision, source, projectId: id, invalidJson: true }); }
}

interface ProjectStore {
  importRecoveredDraft: (draft: RecoveredDraft) => Promise<Project>;
  projects: Project[];
  createProject: (name: string, projectType?: ProjectType, generationMode?: GenerationMode, v3TerrainMode?: "flat" | "advanced") => Project;
  renameProject: (id: string, name: string) => void;
  /** Copies a project (all versions) under a new ID, named "<name> (Copy)". Returns the copy. */
  duplicateProject: (id: string) => Project | undefined;
  setProjectType: (id: string, projectType: ProjectType) => void;
  /** Permanently removes a project. Returns false (and leaves it in place) if it couldn't be removed from storage. */
  deleteProject: (id: string) => boolean;
  touchProject: (id: string) => void;
  getProject: (id: string) => Project | undefined;
  /** Granular live-JSON edit (manual textarea/inspector/add-buttons) — does not touch version history. */
  updateHouseConfig: (id: string, houseConfigJson: string, debugWriter?: string) => void;
  /** Appends a new, permanent version (used after a successful AI edit) and jumps the cursor to it. */
  appendVersion: (id: string, summary: string, houseConfigJson: string, debugWriter?: string) => void;
  /** Moves the cursor one version back, if possible. Nothing is deleted. */
  undo: (id: string) => void;
  /** Moves the cursor one version forward, if possible. */
  redo: (id: string) => void;
  /** Jumps the cursor directly to an arbitrary version (e.g. from the History panel). */
  restoreVersion: (id: string, versionIndex: number) => void;
  /** Sets the visual time of day for the project's viewport. */
  setTimeOfDay: (id: string, tod: TimeOfDay) => void;
  setArchitecturalView: (id: string, patch: Partial<ArchitecturalWorkspaceView>) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],

      importRecoveredDraft: async (draft) => {
        if (!/^[a-f0-9]{64}$/.test(draft.sha256)) throw new Error("Invalid recovery source identity.");
        // Reopening a recovery must retain all subsequent user edits.
        const existing = get().projects.find((p) => p.recoverySource?.sha256 === draft.sha256);
        if (existing) return existing;
        const root = JSON.parse(draft.houseConfigJson);
        if (!isV3ProjectRoot(root)) throw new Error("Recovery requires a saved V3 scene.");
        const checked = revalidateArchitecturalScene(root.v3Scene);
        if (!checked.ok) throw new Error("The saved recovery has a blocking construction defect.");
        const houseConfigJson = JSON.stringify({ ...root, v3Scene: checked.scene });
        const now = Date.now();
        const project: Project = {
          id: crypto.randomUUID(), name: draft.name, createdAt: now, updatedAt: now,
          projectType: "villa", generationMode: "v3-scene", v3TerrainMode: "flat",
          houseConfigJson, versions: [makeVersion("Recovered saved mansion — no generation", houseConfigJson)],
          currentVersionIndex: 0,
          recoverySource: { sha256: draft.sha256, originalBlueprint: draft.originalBlueprint },
        };
        // Keep an exact browser-storage backup before adding anything.
        const raw = readProjectStorage(PROJECT_STORAGE_KEY);
        if (raw) await backupProjectsBeforeRecovery(raw, draft.sha256);
        if (readProjectStorage(PROJECT_STORAGE_KEY) !== raw) throw new Error("Projects changed during recovery. Please reopen the saved mansion.");
        const previous = get().projects;
        try {
          set({ projects: [...previous, project] });
          const saved = JSON.parse(readProjectStorage(PROJECT_STORAGE_KEY) ?? "null");
          const persisted = saved?.state?.projects?.find((p: Project) => p.id === project.id);
          if (persisted?.houseConfigJson !== houseConfigJson) throw new Error("Recovery could not be saved.");
          if (saved.state.projects.length !== previous.length + 1 || previous.some((p) =>
            JSON.stringify(saved.state.projects.find((candidate: Project) => candidate.id === p.id)) !== JSON.stringify(p))) {
            throw new Error("Existing projects did not persist unchanged; recovery was rolled back.");
          }
        } catch (error) {
          set({ projects: previous });
          throw error;
        }
        return project;
      },

      createProject: (name, projectType = "house", generationMode = "v2-architectural", v3TerrainMode = "flat") => {
        const initialJson = generationMode === "v3-scene" ? JSON.stringify(BLANK_V3_SCENE) : BLANK_HOUSE_JSON;
        const initialVersion = makeVersion("Blank project", initialJson);
        const project: Project = {
          id: crypto.randomUUID(),
          name: name.trim() || "Untitled Project",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectType,
          generationMode,
          ...(generationMode === "v3-scene" ? { v3TerrainMode } : {}),
          houseConfigJson: initialJson,
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
          const raw = readProjectStorage(PROJECT_STORAGE_KEY);
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

      updateHouseConfig: (id, houseConfigJson, debugWriter = "updateHouseConfig") => {
        houseConfigJson = prepareArchitecturalCommit(get().getProject(id), houseConfigJson, debugWriter);
        logConfigChange(id, houseConfigJson, debugWriter);
        set((state) => ({ projects: state.projects.map((p) => p.id === id ? { ...p, houseConfigJson, updatedAt: Date.now() } : p) }));
      },

      appendVersion: (id, summary, houseConfigJson, debugWriter = "appendVersion") =>
        (houseConfigJson = prepareArchitecturalCommit(get().getProject(id), houseConfigJson, debugWriter), logConfigChange(id, houseConfigJson, debugWriter), set((state) => ({
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
        }))),

      undo: (id) =>
        set((state) => ({
          projects: state.projects.map((p) => {
            if (p.id !== id || p.currentVersionIndex <= 0) return p;
            const nextIndex = p.currentVersionIndex - 1;
            assertV3Commit(p, p.versions[nextIndex].houseConfigJson);
            logConfigChange(id, p.versions[nextIndex].houseConfigJson, "undo");
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
            assertV3Commit(p, p.versions[nextIndex].houseConfigJson);
            logConfigChange(id, p.versions[nextIndex].houseConfigJson, "redo");
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
            assertV3Commit(p, p.versions[versionIndex].houseConfigJson);
            logConfigChange(id, p.versions[versionIndex].houseConfigJson, "restoreVersion");
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
      setArchitecturalView: (id, patch) => set((state) => ({
        projects: state.projects.map((p) => p.id === id ? {
          ...p,
          architecturalView: { mode: "finished", floor: 0, buildingId: null, cutaway: true, ...p.architecturalView, ...patch },
        } : p),
      })),
    }),
    {
      name: PROJECT_STORAGE_KEY,
      storage: createJSONStorage(() => projectStorage),
      version: 6,
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
            return normalizePersistedProject({ ...p, houseConfigJson, versions, currentVersionIndex, projectType });
          }),
        };
      },
      // Migrations run only after a version bump. Merge makes the invariant
      // hold for same-version persisted browser data as well.
      merge: (persisted, current) => {
        const saved = persisted as { projects?: Project[] };
        return {
          ...current,
          ...saved,
          projects: (saved.projects ?? []).map(normalizePersistedProject),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.projects.forEach((project) => logConfigChange(project.id, project.houseConfigJson, "storage-rehydrate"));
      },
    }
  )
);

// Keep other open tabs in sync so a project deleted here can't be re-saved (resurrected)
// by a stale tab; the workspace page redirects home once its project disappears.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PROJECT_STORAGE_KEY) void useProjectStore.persist.rehydrate();
  });
}
