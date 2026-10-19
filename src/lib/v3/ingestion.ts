import { auditV3DesignConsistency, type V3DesignConsistency } from './designConsistency';
import { v3FlatSiteErrors, type V3TerrainMode } from "./terrainMode";
import { normalizeV3GenerationOutput, repairV3GeneratedScene, type V3GenerationNote } from "./generation";
import { compileV3Scene, validateV3CompiledGeometry, type V3CompiledGeometryAudit, type V3Scene } from "./scene";
import { validateV3Scene, type V3Validation } from "./validation";
import type { V3BlueprintAudit } from './blueprint';
import { approveV3Blueprint, auditV3BlueprintElaboration, type V3BlueprintApproval } from './blueprintApproval';

/**
 * The single production ingestion boundary for a parsed Terra V3 response.
 * Raw provider values are normalized before any canonical validation runs.
 */
export interface V3GenerationIngestion {
  ok: boolean;
  scene: V3Scene;
  notes: V3GenerationNote[];
  validation: V3Validation;
  consistency?: V3DesignConsistency;
  blueprint?: V3BlueprintAudit;
  /** Ephemeral evidence for the existing follow-up attempt; never persisted. */
  blueprintApproval?: V3BlueprintApproval;
  geometryAudit?: V3CompiledGeometryAudit;
}

export interface V3GenerationIngestionOptions {
  requireDesignConsistency?: boolean;
  requireBlueprint?: boolean;
  approvedBlueprint?: V3BlueprintApproval;
}

function blueprintValidation(audit: V3BlueprintAudit): V3Validation {
  const issues = audit.findings.map(f => ({
    code: f.code, targetId: f.targetIds[0] ?? 'estatePlan', targetIds: f.targetIds,
    message: f.message, severity: f.severity,
  }));
  return {
    ok: audit.ok, issues,
    errors: issues.filter(i => i.severity === 'fatal').map(i => `${i.code}: ${i.message}`),
    warnings: issues.filter(i => i.severity === 'advisory').map(i => `${i.code}: ${i.message}`),
  };
}

/** Legacy/offline ingestion keeps its historical policy. The new-generation API explicitly enables design consistency; saved scenes and edits keep their existing validation/compilation. */
export function ingestV3GenerationOutput(raw: unknown, terrainMode?: V3TerrainMode, options: V3GenerationIngestionOptions = {}): V3GenerationIngestion {
  const normalized = normalizeV3GenerationOutput(raw, terrainMode);
  // Blueprint-bearing generations must pass BEFORE reference repair or any detailed
  // construction audit. Historical scenes without a blueprint keep their policy.
  const checkBlueprint = options.requireBlueprint || options.approvedBlueprint || normalized.scene?.estatePlan?.blueprint !== undefined;
  const planning = checkBlueprint && !options.approvedBlueprint ? approveV3Blueprint(normalized.scene) : undefined;
  let blueprint = options.approvedBlueprint ? auditV3BlueprintElaboration(options.approvedBlueprint, normalized.scene)
    : planning ? { ok: planning.ok, findings: planning.findings } : undefined;
  if (blueprint && !blueprint.ok) {
    return { ok: false, scene: normalized.scene, notes: normalized.notes, blueprint, validation: blueprintValidation(blueprint) };
  }
  const planningApproval = options.approvedBlueprint ?? planning?.approval;
  const repaired = repairV3GeneratedScene(normalized.scene, normalized.notes);
  if (blueprint) {
    // Repair may drop invalid support hints. It cannot silently revise an approved plan.
    blueprint = auditV3BlueprintElaboration(planningApproval!, repaired.scene);
    if (!blueprint.ok) return { ok: false, scene: repaired.scene, notes: repaired.notes, blueprint, validation: blueprintValidation(blueprint) };
  }
  const validation = validateV3Scene(repaired.scene, { lenient: true, requireObjects: true });
  if (terrainMode === "flat" && validation.ok) {
    const errors = v3FlatSiteErrors(repaired.scene);
    validation.errors.push(...errors);
    validation.issues.push(...errors.map(message => ({ code: "FLAT_SITE_CONTRACT", targetId: "site", severity: "fatal" as const, message })));
    validation.ok = errors.length === 0;
  }
  const consistency = options.requireDesignConsistency ? auditV3DesignConsistency(repaired.scene, validation.issues) : undefined;
  if (consistency && !consistency.ok) {
    for (const issue of validation.issues) {
      const finding = consistency.findings.find(f => f.code === issue.code && f.targetIds.includes(issue.targetId));
      if (finding) issue.targetIds = finding.targetIds;
    }
    validation.ok = false;
    for (const f of consistency.findings.filter(f => f.classification === 'repairable')) {
      if (validation.issues.some(i => i.severity === 'fatal' && i.code === f.code && f.targetIds.includes(i.targetId))) continue;
      validation.errors.push(`${f.code}: ${f.message}`);
      validation.issues.push({ code: f.code, targetId: f.targetIds[0], targetIds: f.targetIds, message: f.message, severity: 'physical' });
    }
  }
  if (!validation.ok) return { ok: false, scene: repaired.scene, notes: repaired.notes, consistency, blueprint, blueprintApproval: planningApproval, validation };
  const geometryAudit = validateV3CompiledGeometry(repaired.scene, compileV3Scene(repaired.scene), { lenient: true });
  return { ok: geometryAudit.ok, scene: repaired.scene, notes: repaired.notes, consistency, blueprint, blueprintApproval: planningApproval, validation, geometryAudit };
}
