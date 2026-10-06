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
    return isV3ProjectRoot(JSON.parse(project.houseConfigJson)) ? "v3-scene" : "v2-architectural";
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
export function projectModeBadgeLabel(project: { houseConfigJson: string }): "V2 ARCHITECTURAL" | "V3 SCENE" {
  return resolveProjectGenerationMode(project) === "v3-scene" ? "V3 SCENE" : "V2 ARCHITECTURAL";
}

/** A disagreement is unsafe: do not spend an AI call attempting to guess which mode was intended. */
export function projectModeDisagreementMessage(authority: ProjectModeAuthority): string | undefined {
  if (authority.agrees) return undefined;
  return `Generation mode disagreement: persisted root is ${authority.persistedMode}, but the project record is ${authority.recordMode}. Generation was blocked.`;
}
