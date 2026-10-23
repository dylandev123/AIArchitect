import { estateRouteClipsEntrance, estateRouteSupported } from './routeGeometry';
import { effectiveV3Scene } from './derivedSupport';
import { BLOCKING_FOOTPRINT_CODES, curvedMassConflicts } from './architectureSafety';
import { footprintDiagnostics } from './footprintDiagnostics';
import { v3EstatePlanSchema, auditV3EstatePlan } from './estatePlan';
import { resolveV3Fidelity } from './fidelity';
import { deriveV3MassJunctions } from './junctions';
import { resolveV3JunctionDatums } from './junctionDatums';
import { v3CompositionSchema } from "./composition";
import { type V3Scene, type V3SceneObject, type Vec3 } from "./scene";
import { auditV3SiteHierarchy } from "./siteHierarchy";
import { v3RenderWarnings } from "./renderability";
import { v3Capability } from "./capabilities";
import { isV3ArchitecturalGeometry, runtimeGeometryMatchesArchitecture } from "./architecture";
import { auditV3Interior, v3RelationshipTargetIds } from "./interior";

/**
 * `fatal` = structurally unusable. `physical` = renderable but imperfect (an error only in strict mode).
 * `advisory` = always a warning.
 */
export type V3IssueSeverity = "fatal" | "physical" | "advisory";
export interface V3Issue { code: string; targetId: string; targetIds?: string[]; message: string; severity: V3IssueSeverity; }
export interface V3Validation { ok: boolean; errors: string[]; warnings: string[]; issues: V3Issue[]; }
export interface V3ValidationOptions {
  /**
   * Generation mode: only structural problems are errors; physical/design problems become warnings
   * so the scene can still render. Strict mode is available for physical audits; production generation and edits use lenient mode.
   */
  lenient?: boolean;
  /** New generation must contain authored identity; persisted route-only scenes remain loadable. */
  requireObjects?: boolean;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const vec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);
const positive = (v: unknown): v is Vec3 => vec(v) && v.every((n) => n > 0);
/** Site-hierarchy audit codes which mean the hierarchy data itself is unusable, not merely imperfect. */
const FATAL_SITE_CODES = new Set(["DUPLICATE_SITE_LEVEL", "INVALID_SITE_LEVEL", "INVALID_SITE_CONNECTION"]);

function overlap(a: V3SceneObject, b: V3SceneObject): boolean {
  const pa = a.transform.position, pb = b.transform.position, sa = a.dimensions, sb = b.dimensions;
  return Math.abs(pa[0] - pb[0]) < (sa[0] + sb[0]) / 2 && Math.abs(pa[1] - pb[1]) < (sa[1] + sb[1]) / 2 && Math.abs(pa[2] - pb[2]) < (sa[2] + sb[2]) / 2;
}

/** Objective only: this validates executability without judging the architectural composition. */
export function validateV3Scene(scene: unknown, options: V3ValidationOptions = {}): V3Validation {
  const issues: V3Issue[] = [];
  const texts = new Map<V3Issue, string>();
  const add = (severity: V3IssueSeverity, code: string, targetId: string, message: string, text = message, targetIds?:string[]) => { const item = { severity, code, targetId, message, ...(targetIds?{targetIds}:{}) }; issues.push(item); texts.set(item, text); };
  const finish = (): V3Validation => {
    const errors: string[] = [], warnings: string[] = [];
    for (const item of issues) {
      const toWarning = item.severity === "advisory" || (options.lenient && item.severity === "physical");
      const line = texts.get(item) ?? item.message;
      // Warnings are machine-greppable: always `CODE [target]: message`.
      (toWarning ? warnings : errors).push(toWarning && line === item.message ? `${item.code} [${item.targetId}]: ${line}` : line);
    }
    return { ok: errors.length === 0, errors, warnings, issues };
  };
  if (!scene || typeof scene !== "object") { add("fatal", "INVALID_ROOT", "scene", "V3 scene must be an object."); return finish(); }
  const s = scene as V3Scene;
  if (s.estatePlan !== undefined) {
    const plan = v3EstatePlanSchema.safeParse(s.estatePlan);
    if (!plan.success) for (const issue of plan.error.issues) add("fatal", "INVALID_ESTATE_PLAN", "estatePlan", `Malformed estatePlan.${issue.path.join('.')}: ${issue.message}. Preserve authored commitments.`);
  }

  if (s.version !== 3) add("fatal", "INVALID_ROOT", "scene", "V3 scene version must be 3.");
  if (!s.site || !finite(s.site.width) || !finite(s.site.depth) || s.site.width <= 0 || s.site.depth <= 0) add("fatal", "INVALID_SITE", "site", "Site needs finite positive width and depth.");
  if (!Array.isArray(s.objects)) { add("fatal", "INVALID_ROOT", "scene", "Scene objects must be an array."); return finish(); }
  if (options.requireObjects && s.objects.length === 0) add("fatal", "EMPTY_SCENE", "scene", "V3 scene needs at least one object with a stable id.");
  if (s.site?.baseElevation !== undefined && !finite(s.site.baseElevation)) add("fatal", "INVALID_SITE", "site", "Site baseElevation must be finite.");
  for (const issue of footprintDiagnostics(s)) add(BLOCKING_FOOTPRINT_CODES.has(issue.code)?'fatal':'advisory',issue.code,issue.targetId,issue.message);
  const ids = new Set<string>(); const groups = new Set<string>();
  for (const o of s.objects) { if (o?.groupId) groups.add(o.groupId); }
  const hasObject = (id: string) => s.objects.some((candidate) => candidate?.id === id);
  for (const o of s.objects) {
    if (!o || typeof o !== "object" || typeof o.id !== "string" || !o.id.trim()) { add("fatal", "MISSING_OBJECT_ID", "scene", "Every object needs a usable stable id."); continue; }
    if (ids.has(o.id)) add("fatal", "DUPLICATE_OBJECT_ID", o.id, `Duplicate object id: ${o.id}.`); ids.add(o.id);
    const invalidBoxFields = [!vec(o.transform?.position) && "transform.position", !vec(o.transform?.rotation) && "transform.rotation", !positive(o.transform?.scale) && "transform.scale", !positive(o.dimensions) && "dimensions"].filter(Boolean);
    if (invalidBoxFields.length) add("fatal", "INVALID_TRANSFORM", o.id, `${o.id} has invalid transform or dimensions. Invalid fields: ${invalidBoxFields.join(", ")}.`);
    if (o.composition !== undefined && !v3CompositionSchema.safeParse(o.composition).success && !v3CompositionSchema.safeParse({...o.composition,footprint:undefined}).success) add("fatal", "INVALID_COMPOSITION", o.id, `${o.id} has invalid architectural composition.`);
    if (o.architecture && !isV3ArchitecturalGeometry(o.architecture)) add("fatal", "INVALID_ARCHITECTURE", o.id, `${o.id} has invalid named architectural geometry.`);
    else if (o.architecture && !runtimeGeometryMatchesArchitecture(o)) add("fatal", "ARCHITECTURE_RUNTIME_DRIFT", o.id, `${o.id} runtime arrays do not match its named architectural geometry.`);
    if (!o.material || !/^#[0-9a-fA-F]{6}$/.test(o.material.color)) add("fatal", "INVALID_MATERIAL", o.id, `${o.id} has invalid material.`);
    if (o.parentId && !hasObject(o.parentId)) add("physical", "MISSING_PARENT", o.id, `${o.id} references missing parent ${o.parentId}.`);
    if (o.hostId && !hasObject(o.hostId)) add("physical", "MISSING_HOST", o.id, `${o.id} references missing host ${o.hostId}.`);
    if (o.support?.levelId && !s.siteHierarchy?.levels.some((level) => level.id === o.support?.levelId)) add("physical", "UNRESOLVED_SUPPORT", o.id, `${o.id} references missing support level ${o.support.levelId}.`);
    if (o.support?.objectId && !hasObject(o.support.objectId)) add("physical", "UNRESOLVED_SUPPORT", o.id, `${o.id} references missing support object ${o.support.objectId}.`);
    if (o.support?.hostId && !hasObject(o.support.hostId)) add("physical", "UNRESOLVED_SUPPORT", o.id, `${o.id} references missing support host ${o.support.hostId}.`);
    if (o.support?.hostId && o.support?.objectId && o.support.hostId !== o.support.objectId) add("physical", "UNRESOLVED_SUPPORT", o.id, `${o.id} has conflicting support host ids.`);
    if (o.support?.relationship && !o.support.hostId && !o.support.objectId && o.support.relationship !== "terrain-following") add("physical", "UNRESOLVED_SUPPORT", o.id, `${o.id} declares ${o.support.relationship} without a support host.`);
    if ((o.fromSupportId && !o.toSupportId) || (!o.fromSupportId && o.toSupportId)) add("physical", "UNRESOLVED_CONNECTOR", o.id, `${o.id} must declare both connector endpoints.`);
    for (const endpoint of [o.fromSupportId, o.toSupportId].filter((id): id is string => !!id)) if (!hasObject(endpoint) && !s.siteHierarchy?.levels.some((level) => level.id === endpoint)) add("physical", "UNRESOLVED_CONNECTOR", o.id, `${o.id} references missing connector support ${endpoint}.`);
    if (o.groupId && !groups.has(o.groupId)) add("physical", "MISSING_GROUP", o.id, `${o.id} references missing group ${o.groupId}.`);
    if (o.source?.kind === "proxy" && (!vec(o.transform?.position) || !positive(o.dimensions))) add("fatal", "INVALID_TRANSFORM", o.id, `${o.id} proxy has no valid transform.`);
    if(o.unsupportedIntent?.roofForm&&o.unsupportedIntent.roofForm!=='butterfly')add('fatal','ROOF_INTENT_UNSUPPORTED',o.id,`${o.id}: roof intent ${o.unsupportedIntent.roofForm} is not constructible. Preserve the building footprint. Use a compatible roof only if the brief permits that choice; an explicitly requested unsupported roof requires user clarification, not a silent substitute.`);
    if(o.type==='building-mass'&&['cylinder','extrusion'].includes(o.geometryKind??'')&&!o.composition?.footprint)add('fatal','BUILDING_FORM_UNBUILT',o.id,`${o.id}: ${o.geometryKind} alone does not construct a building footprint. Author composition.footprint with line/arc segments and segment-addressed openings; no rectangular shell may stand in for this intent.`);
    const capability = v3Capability(o.type);
    if (capability?.validation?.requiresTerrainOperation && !o.terrain) add("physical", "INCOMPLETE_TERRAIN", o.id, `${o.id} terrain region needs a terrain operation.`);
    const levelLimit = Math.max(1, Math.min(20, Math.floor((o.architecture?.height ?? o.dimensions?.[1] ?? 0) / 2.2)));
    if (o.composition?.spaceHeight!=='double-height' && finite(o.levels) && o.levels > (capability?.validation?.levelsBoundedByHeight ? levelLimit : 20)) add("fatal", "LEVEL_COUNT_APPROXIMATED", o.id, `${o.id} requests ${o.levels} levels but its height fits ${levelLimit}. Increase only this mass height if the brief permits; do not silently discard requested storeys. The current builder supports at most 20 levels.`);
  }
  if (issues.some(issue => issue.severity === 'fatal' && !BLOCKING_FOOTPRINT_CODES.has(issue.code) && issue.code!=='INVALID_ESTATE_PLAN')) return finish();
  if(!issues.some(issue=>issue.severity==='fatal')&&s.objects.some(o=>o.composition?.footprint)){
    const effective=resolveV3Fidelity(effectiveV3Scene(s)).scene;
    for(const issue of footprintDiagnostics(effective))if(BLOCKING_FOOTPRINT_CODES.has(issue.code)&&!issues.some(i=>i.code===issue.code&&i.targetId===issue.targetId))add('fatal',issue.code,issue.targetId,issue.message);
  }
  for(const issue of curvedMassConflicts(s))add('fatal',issue.code,issue.targetId,issue.message);
  const interiorIssues = auditV3Interior(s);
  for (const item of interiorIssues.filter((candidate) => candidate.severity === "fatal")) add("fatal", item.code, item.targetId, item.message);
  if (issues.some(issue => issue.severity === 'fatal' && !BLOCKING_FOOTPRINT_CODES.has(issue.code) && issue.code!=='INVALID_ESTATE_PLAN')) return finish();
  const relationshipIds = v3RelationshipTargetIds(s);
  for (const r of s.relationships ?? []) if (!relationshipIds.has(r.from) || !relationshipIds.has(r.to)) add("physical", "MISSING_RELATIONSHIP_OBJECT", `${r.from}->${r.to}`, `Relationship ${r.kind} references a missing object.`);
  for (const item of interiorIssues.filter((candidate) => candidate.severity !== "fatal")) add(item.severity, item.code, item.targetId, item.message);
  // Supported estate corridors are compiled once from authoritative route
  // geometry before object dispatch. Their selectable owner box never reaches
  // generic rendering. Keep fallback warnings for every other object; estate
  // audits and construction receipts still independently verify these ribbons.
  const estateSurfaceIds = new Set(issues.some(i => i.code === 'INVALID_ESTATE_PLAN') ? [] : s.estatePlan?.circulation.filter(r => estateRouteSupported(s, r)).flatMap(r => r.via) ?? []);
  for (const warning of v3RenderWarnings(s.objects.filter(o => !(["path", "driveway"].includes(o.type) && estateSurfaceIds.has(o.id))))) add("advisory", warning.code, warning.targetId, warning.message);
  // Persisted hierarchy is mandatory for new V3 output, but older saved scenes remain readable and can be
  // re-rendered through the deterministic legacy adapter without another model request.
  if (s.siteHierarchy) {
    if (!Array.isArray(s.siteHierarchy.levels) || s.siteHierarchy.levels.length === 0) add("fatal", "INVALID_SITE_LEVEL", "siteHierarchy", "A supplied site hierarchy needs at least one usable level.");
    for (const connection of s.siteHierarchy.connections) {
      const validRoute = Array.isArray(connection.route) && connection.route.length >= 2 && connection.route.every((point) => Array.isArray(point) && (point.length === 2 || point.length === 3) && point.every(finite));
      if (!validRoute) add("fatal", "INVALID_SITE_CONNECTION", connection.id, `${connection.id} has an invalid hierarchy route; persisted routes must be legacy [x, z] or canonical [x, y, z].`);
    }
    for (const siteIssue of auditV3SiteHierarchy(s)) {
      const text = `${siteIssue.code} [${siteIssue.targetId}]: ${siteIssue.message}`;
      if (options.lenient) {
        // A connector whose endpoints do not resolve still renders; it is reported for audit/repair.
        const code = siteIssue.code === "INVALID_CONNECTOR_ENDPOINT" ? "UNRESOLVED_CONNECTOR" : siteIssue.code;
        if (code === "UNRESOLVED_CONNECTOR" && issues.some((existing) => existing.code === code && existing.targetId === siteIssue.targetId)) continue;
        add(FATAL_SITE_CODES.has(siteIssue.code) ? "fatal" : "physical", code, siteIssue.targetId, siteIssue.message, `${code} [${siteIssue.targetId}]: ${siteIssue.message}`);
      } else if (siteIssue.severity === "error") add("fatal", siteIssue.code, siteIssue.targetId, siteIssue.message, text);
      else add("advisory", siteIssue.code, siteIssue.targetId, siteIssue.message, text);
    }
  }
  const volumes = s.objects.filter((o) => v3Capability(o.type)?.validation?.overlapAdvisory);
  for (let i = 0; i < volumes.length; i++) for (let j = i + 1; j < volumes.length; j++) if (volumes[i].type === volumes[j].type && overlap(volumes[i], volumes[j])) add("advisory", "VOLUME_OVERLAP", volumes[i].id, `Building volumes ${volumes[i].id} and ${volumes[j].id} overlap; retained for intentional composition.`);
  if (!issues.some(issue => issue.severity === 'fatal')) {
    const fidelity = resolveV3Fidelity(s);
    for (const d of fidelity.diagnostics) add('advisory', d.code, d.targetId, d.message);
    const datum = resolveV3JunctionDatums(fidelity.scene);
    for (const issue of [...datum.diagnostics, ...deriveV3MassJunctions(datum.scene).diagnostics]) add('advisory', issue.code, issue.junctionId, issue.message);
  }
  // Independent construction failures must not hide estate diagnostics. Only malformed
  // prerequisites prevent this audit; an unresolved canopy or roof does not.
  const estateAuditSafe = !issues.some(issue => issue.severity === 'fatal' && !BLOCKING_FOOTPRINT_CODES.has(issue.code));
  for (const finding of estateAuditSafe ? auditV3EstatePlan(s) : []) add(finding.code==='ESTATE_ROUTE_BLOCKED'&&estateRouteClipsEntrance(s,finding.targetIds)?"physical":["ESTATE_FORM_UNBUILT","ESTATE_ROUTE_BLOCKED","ESTATE_POOL_CROSSING","ESTATE_ROUTE_UNSUPPORTED","ESTATE_ACCESS_POINT_MISSING"].includes(finding.code)?"fatal":"advisory", finding.code, finding.targetIds[0] ?? "estatePlan", finding.message, finding.message, finding.targetIds);
  return finish();
}
