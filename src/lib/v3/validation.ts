import { type V3Scene, type V3SceneObject, type Vec3 } from "./scene";
import { auditV3SiteHierarchy } from "./siteHierarchy";

/**
 * `fatal` = structurally unusable. `physical` = renderable but imperfect (an error only in strict mode).
 * `advisory` = always a warning.
 */
export type V3IssueSeverity = "fatal" | "physical" | "advisory";
export interface V3Issue { code: string; targetId: string; message: string; severity: V3IssueSeverity; }
export interface V3Validation { ok: boolean; errors: string[]; warnings: string[]; issues: V3Issue[]; }
export interface V3ValidationOptions {
  /**
   * Generation mode: only structural problems are errors; physical/design problems become warnings
   * so the scene can still render. Default (strict) keeps every issue an error, as edits require.
   */
  lenient?: boolean;
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
  const add = (severity: V3IssueSeverity, code: string, targetId: string, message: string, text = message) => { const item = { severity, code, targetId, message }; issues.push(item); texts.set(item, text); };
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
  if (s.version !== 3) add("fatal", "INVALID_ROOT", "scene", "V3 scene version must be 3.");
  if (!s.site || !finite(s.site.width) || !finite(s.site.depth) || s.site.width <= 0 || s.site.depth <= 0) add("fatal", "INVALID_SITE", "site", "Site needs finite positive width and depth.");
  if (!Array.isArray(s.objects)) { add("fatal", "INVALID_ROOT", "scene", "Scene objects must be an array."); return finish(); }
  const ids = new Set<string>(); const groups = new Set<string>();
  for (const o of s.objects) { if (o?.groupId) groups.add(o.groupId); }
  const hasObject = (id: string) => s.objects.some((candidate) => candidate.id === id);
  for (const o of s.objects) {
    if (!o || typeof o !== "object" || !o.id) { add("fatal", "MISSING_OBJECT_ID", "scene", "Every object needs an id."); continue; }
    if (ids.has(o.id)) add("fatal", "DUPLICATE_OBJECT_ID", o.id, `Duplicate object id: ${o.id}.`); ids.add(o.id);
    if (!vec(o.transform?.position) || !vec(o.transform?.rotation) || !positive(o.transform?.scale) || !positive(o.dimensions)) add("fatal", "INVALID_TRANSFORM", o.id, `${o.id} has invalid transform or dimensions.`);
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
    if (o.type === "terrain-region" && !o.terrain) add("physical", "INCOMPLETE_TERRAIN", o.id, `${o.id} terrain region needs a terrain operation.`);
  }
  for (const r of s.relationships ?? []) if (!ids.has(r.from) || !ids.has(r.to)) add("physical", "MISSING_RELATIONSHIP_OBJECT", `${r.from}->${r.to}`, `Relationship ${r.kind} references a missing object.`);
  // Persisted hierarchy is mandatory for new V3 output, but older saved scenes remain readable and can be
  // re-rendered through the deterministic legacy adapter without another model request.
  if (s.siteHierarchy) {
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
  const volumes = s.objects.filter((o) => o.type === "volume");
  for (let i = 0; i < volumes.length; i++) for (let j = i + 1; j < volumes.length; j++) if (overlap(volumes[i], volumes[j])) add("advisory", "VOLUME_OVERLAP", volumes[i].id, `Building volumes ${volumes[i].id} and ${volumes[j].id} overlap; retained for intentional composition.`);
  return finish();
}
