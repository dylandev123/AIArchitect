import type { GenerationMode } from "@/types/project";
import { isV3ProjectRoot } from "./scene";

/**
 * The root is the one durable mode authority shared with the server: it is the
 * JSON sent to `/api/ai/house`, whose V3 sentinel decides server routing.
 * `Project.generationMode` is retained as an auditable mirror, never as a way
 * to reinterpret a V2 root as V3.
 */
export function resolveProjectGenerationMode(project: { houseConfigJson: string }): GenerationMode {
  try {
    const root = JSON.parse(project.houseConfigJson);
    if (root?.version === "architectural-scene-1") return "direct-scene";
    return isV3ProjectRoot(root) ? "v3-scene" : "v2-architectural";
  } catch {
    return "v2-architectural";
  }
}

export interface ProjectModeAuthority {
  /** The mode the server will resolve from the persisted JSON root. */
  persistedMode: GenerationMode;
  /** The optional record mirror, useful only to detect corrupt/disagreeing state. */
  recordMode?: GenerationMode;
  agrees: boolean;
}

export function projectModeAuthority(project: { generationMode?: GenerationMode; houseConfigJson: string }): ProjectModeAuthority {
  const persistedMode = resolveProjectGenerationMode(project);
  return {
    persistedMode,
    recordMode: project.generationMode,
    agrees: project.generationMode === undefined || project.generationMode === persistedMode,
  };
}

/** The exact development badge text, intentionally derived only from the durable root. */
export function projectModeBadgeLabel(project: { houseConfigJson: string }): "V2 ARCHITECTURAL" | "V3 SCENE" | "DIRECT SCENE" {
  if (resolveProjectGenerationMode(project) === "direct-scene") return "DIRECT SCENE";
  return resolveProjectGenerationMode(project) === "v3-scene" ? "V3 SCENE" : "V2 ARCHITECTURAL";
}

/** A disagreement is unsafe: do not spend an AI call attempting to guess which mode was intended. */
export function projectModeDisagreementMessage(authority: ProjectModeAuthority): string | undefined {
  if (authority.agrees) return undefined;
  return `Generation mode disagreement: persisted root is ${authority.persistedMode}, but the project record is ${authority.recordMode}. Generation was blocked.`;
}

/** New houses are authored only by the canonical plan pipeline in the direct-scene workspace.
 * Historical V2/V3 projects stay openable and editable, but a blank one cannot start a new design. */
export const LEGACY_PROJECT_GENERATION_MESSAGE = "This project uses a retired generation format, so it can't start a new design. Create a new project from the home page to generate a house; your existing designs stay untouched.";
export function canStartNewDesign(project: { houseConfigJson: string }): boolean {
  return resolveProjectGenerationMode(project) === "direct-scene";
}
