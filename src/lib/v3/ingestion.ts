import { v3FlatSiteErrors, type V3TerrainMode } from "./terrainMode";
import { normalizeV3GenerationOutput, repairV3GeneratedScene, type V3GenerationNote } from "./generation";
import { compileV3Scene, validateV3CompiledGeometry, type V3CompiledGeometryAudit, type V3Scene } from "./scene";
import { validateV3Scene, type V3Validation } from "./validation";

/**
 * The single production ingestion boundary for a parsed Terra V3 response.
 * Raw provider values are normalized before any canonical validation runs.
 */
export interface V3GenerationIngestion {
  ok: boolean;
  scene: V3Scene;
  notes: V3GenerationNote[];
  validation: V3Validation;
  geometryAudit?: V3CompiledGeometryAudit;
}

/** Omitted policy preserves legacy/offline ingestion; new API generations explicitly select flat or advanced. */
export function ingestV3GenerationOutput(raw: unknown, terrainMode?: V3TerrainMode): V3GenerationIngestion {
  const normalized = normalizeV3GenerationOutput(raw, terrainMode);
  const repaired = repairV3GeneratedScene(normalized.scene, normalized.notes);
  const validation = validateV3Scene(repaired.scene, { lenient: true, requireObjects: true });
  if (terrainMode === "flat" && validation.ok) {
    const errors = v3FlatSiteErrors(repaired.scene);
    validation.errors.push(...errors);
    validation.issues.push(...errors.map(message => ({ code: "FLAT_SITE_CONTRACT", targetId: "site", severity: "fatal" as const, message })));
    validation.ok = errors.length === 0;
  }
  if (!validation.ok) return { ok: false, scene: repaired.scene, notes: repaired.notes, validation };
  const geometryAudit = validateV3CompiledGeometry(repaired.scene, compileV3Scene(repaired.scene), { lenient: true });
  return { ok: geometryAudit.ok, scene: repaired.scene, notes: repaired.notes, validation, geometryAudit };
}
