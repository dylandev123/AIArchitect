import { z } from "zod";
import type { ArchitecturalDesignDocument, MassVolume } from "../document";
import { sitePlanContextForDocument } from "../sitePlanContext";
import { siteFeatureRects, type SitePlan } from "../sitePlanContract";
import { sitePlanIntegrityErrors } from "./sitePlanStage";

/**
 * An Architect-authored explanation of a bounded spatial consequence of an edit.
 * It is deliberately a proposal, not a solver instruction: coordinates and sizes remain
 * in the document/Site Plan, while this graph makes every consequential change auditable.
 */
export const spatialReflowSchema = z.object({
  elements: z.array(z.object({
    id: z.string().min(1),
    action: z.enum(["move", "resize", "rotate", "reroute"]),
    dependsOn: z.string().min(1),
    reason: z.string().min(8).max(400),
  }).strict()).min(1).max(6),
}).strict();
export type SpatialReflow = z.infer<typeof spatialReflowSchema>;

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
};

const massElement = (id: string) => `mass:${id}`;
const pathId = (path: SitePlan["paths"][number], index: number) => `site:path:${path.from}>${path.to}:${index}`;
const landscapeId = (zone: SitePlan["landscape"][number], index: number) => `site:landscape:${zone.purpose}:${index}`;

/** Stable semantic identities for a Site Plan that predates per-item ids. */
export function sitePlanElements(plan: SitePlan): Map<string, unknown> {
  const elements = new Map<string, unknown>([
    ["site:entrance", plan.entrance], ["site:driveway", plan.driveway], ["site:pool", plan.pool],
    ["site:terrace", plan.terrace], ["site:poolDeck", plan.poolDeck],
  ]);
  plan.parking.forEach((value, index) => elements.set(`site:parking:${index}`, value));
  plan.paths.forEach((value, index) => elements.set(pathId(value, index), value));
  plan.landscape.forEach((value, index) => elements.set(landscapeId(value, index), value));
  plan.features?.forEach((value) => elements.set(`site:feature:${value.id}`, value));
  return elements;
}

export function changedSitePlanElements(before: SitePlan, after: SitePlan): string[] {
  const left = sitePlanElements(before), right = sitePlanElements(after);
  const ids = new Set([...left.keys(), ...right.keys()]);
  return [...ids].filter((id) => !left.has(id) || !right.has(id) || stable(left.get(id)) !== stable(right.get(id))).sort();
}

/** Complete, stable before/after evidence returned with an accepted reflow. */
export function spatialReflowDiff(beforeDocument: ArchitecturalDesignDocument, afterDocument: ArchitecturalDesignDocument, beforePlan: SitePlan, afterPlan: SitePlan): { id: string; before: unknown; after: unknown }[] {
  const changes: { id: string; before: unknown; after: unknown }[] = [];
  const oldMasses = new Map(beforeDocument.massing.masses.map((mass) => [mass.id, mass]));
  const newMasses = new Map(afterDocument.massing.masses.map((mass) => [mass.id, mass]));
  for (const id of new Set([...oldMasses.keys(), ...newMasses.keys()])) {
    const before = oldMasses.get(id), after = newMasses.get(id);
    if (stable({ position: before?.position, width: before?.width, depth: before?.depth, rotation: before?.rotation, elevation: before?.elevation }) !== stable({ position: after?.position, width: after?.width, depth: after?.depth, rotation: after?.rotation, elevation: after?.elevation })) changes.push({ id: massElement(id), before, after });
  }
  const oldSite = sitePlanElements(beforePlan), newSite = sitePlanElements(afterPlan);
  for (const id of new Set([...oldSite.keys(), ...newSite.keys()])) if (stable(oldSite.get(id)) !== stable(newSite.get(id))) changes.push({ id, before: oldSite.get(id), after: newSite.get(id) });
  return changes.sort((a, b) => a.id.localeCompare(b.id));
}

/** Site reflow may change geometry, never identity, purpose, relationship or membership. */
function identityErrors(before: SitePlan, after: SitePlan, direct: ReadonlyMap<string, "modify" | "add" | "remove"> = new Map()): string[] {
  const errors: string[] = [];
  const left = sitePlanElements(before), right = sitePlanElements(after);
  for (const id of new Set([...left.keys(), ...right.keys()])) {
    const action = direct.get(id);
    if (!left.has(id) && right.has(id) && action === "add") continue;
    if (left.has(id) && !right.has(id) && action === "remove") continue;
    if (!left.has(id) || !right.has(id)) errors.push(`${id} was added, removed, or had its semantic identity changed; reflow may only move, resize, rotate, or reroute existing elements.`);
  }
  const compare = (id: string, keys: readonly string[]) => {
    if (direct.get(id) === "modify") return; // a directly targeted element may change what it is, within integrity
    const a = left.get(id) as Record<string, unknown> | undefined, b = right.get(id) as Record<string, unknown> | undefined;
    if (!a || !b) return;
    for (const key of keys) if (stable(a[key]) !== stable(b[key])) errors.push(`${id}.${key} changed; reflow must preserve semantic relationships and identity.`);
  };
  compare("site:entrance", ["wall"]); compare("site:driveway", ["wall"]); compare("site:pool", ["wall", "shape"]); compare("site:terrace", ["wall"]);
  after.paths.forEach((_, i) => compare(pathId(before.paths[i] ?? after.paths[i], i), ["from", "to", "surface"]));
  after.landscape.forEach((_, i) => compare(landscapeId(before.landscape[i] ?? after.landscape[i], i), ["purpose", "kind"]));
  after.features?.forEach((feature) => compare(`site:feature:${feature.id}`, ["id", "kind", "assetId"]));
  return errors;
}

type Rect = { x0: number; x1: number; z0: number; z1: number };
const gap = (a: Rect, b: Rect) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
const massRect = (mass: MassVolume): Rect => {
  const c = Math.abs(Math.cos(mass.rotation)), s = Math.abs(Math.sin(mass.rotation));
  const halfW = (c * mass.width + s * mass.depth) / 2, halfD = (s * mass.width + c * mass.depth) / 2;
  return { x0: mass.position.x - halfW, x1: mass.position.x + halfW, z0: mass.position.z - halfD, z1: mass.position.z + halfD };
};

function siteRects(plan: SitePlan, document: ArchitecturalDesignDocument): Map<string, Rect> {
  const ctx = sitePlanContextForDocument(document.brief, document);
  if (!ctx) return new Map();
  const rects = siteFeatureRects(plan, ctx);
  const out = new Map<string, Rect>();
  for (const rect of rects) {
    const id = rect.label === "driveway" ? "site:driveway" : rect.label === "pool" ? "site:pool" : rect.label === "terrace" ? "site:terrace" : rect.label === "pool deck" ? "site:poolDeck" : rect.label.startsWith("parking ") ? `site:parking:${Number(rect.label.slice(8)) - 1}` : undefined;
    if (id) out.set(id, rect);
  }
  plan.landscape.forEach((zone, index) => out.set(landscapeId(zone, index), { x0: zone.x - zone.width / 2, x1: zone.x + zone.width / 2, z0: zone.z - zone.depth / 2, z1: zone.z + zone.depth / 2 }));
  plan.features?.forEach((feature) => out.set(`site:feature:${feature.id}`, { x0: feature.x - feature.width / 2, x1: feature.x + feature.width / 2, z0: feature.z - feature.depth / 2, z1: feature.z + feature.depth / 2 }));
  return out;
}

const nodeElement: Record<string, string> = { arrival: "site:driveway", parking: "site:parking:0", entrance: "site:entrance", "outdoor-living": "site:terrace", pool: "site:pool" };
const isPathFor = (id: string, dependency: string) => {
  const match = /^site:path:([^>]+)>([^:]+):/.exec(id);
  return Boolean(match && (nodeElement[match[1]] === dependency || nodeElement[match[2]] === dependency));
};

/** A conservative locality ceiling: large enough for a real clearance move, too small for a property redesign. */
const MAX_REFLOW_NEIGHBOR_GAP_M = 8;
const MAX_REFLOW_TRAVEL_M = 12;

function related(id: string, dependency: string, beforeRects: Map<string, Rect>, afterRects: Map<string, Rect>, before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument): boolean {
  if (dependency === "request" && id.startsWith("mass:")) return true;
  if (isPathFor(id, dependency)) return true;
  if (id.startsWith("site:path:") && dependency.startsWith("mass:")) return true; // a path is an access relationship to its adjacent architecture
  const own = beforeRects.get(id) ?? afterRects.get(id);
  if (!own) return false;
  if (dependency.startsWith("mass:")) {
    const massId = dependency.slice(5);
    const oldMass = before.massing.masses.find((mass) => mass.id === massId), newMass = after.massing.masses.find((mass) => mass.id === massId);
    return Boolean((oldMass && gap(own, massRect(oldMass)) <= MAX_REFLOW_NEIGHBOR_GAP_M) || (newMass && gap(own, massRect(newMass)) <= MAX_REFLOW_NEIGHBOR_GAP_M));
  }
  const other = beforeRects.get(dependency) ?? afterRects.get(dependency);
  return Boolean(other && gap(own, other) <= MAX_REFLOW_NEIGHBOR_GAP_M);
}

const changedMassSpatially = (before: MassVolume, after: MassVolume) =>
  stable({ position: before.position, width: before.width, depth: before.depth, rotation: before.rotation, elevation: before.elevation }) !== stable({ position: after.position, width: after.width, depth: after.depth, rotation: after.rotation, elevation: after.elevation });

export interface SpatialReflowValidationInput {
  beforeDocument: ArchitecturalDesignDocument;
  afterDocument: ArchitecturalDesignDocument;
  beforePlan: SitePlan;
  afterPlan: SitePlan;
  reflow?: SpatialReflow;
  /** Masses the Architect's declared edit scope targets directly; the graph may only branch from these. */
  directMassIds: ReadonlySet<string>;
  /**
   * Site Plan elements the declared edit scope targets directly (e.g. moving the pool, extending the driveway, adding
   * a planting zone). They are roots of the reflow graph, may change their own semantics, and — only when declared
   * `add`/`remove` — may appear or disappear. Everything else in the Site Plan may still only be reflowed.
   */
  siteTargets?: readonly { element: string; action: "modify" | "add" | "remove" }[];
}

/**
 * Validates authored reflow only. It never searches for a position, changes a coordinate, or chooses a design.
 */
export function spatialReflowErrors(input: SpatialReflowValidationInput): string[] {
  const { beforeDocument, afterDocument, beforePlan, afterPlan, reflow, directMassIds } = input;
  const changedSite = changedSitePlanElements(beforePlan, afterPlan);
  const direct = new Map((input.siteTargets ?? []).map((target) => [target.element, target.action] as const));
  const scopeErrors = [...direct.keys()].filter((id) => !changedSite.includes(id)).map((id) => `Declared site target ${id} did not change; declare only the site elements the edit changes.`);
  const spatialMasses = afterDocument.massing.masses.filter((mass) => {
    const prior = beforeDocument.massing.masses.find((candidate) => candidate.id === mass.id);
    // A new mass the scope declares is the edit itself (a root), not a reflowed consequence.
    return prior ? changedMassSpatially(prior, mass) : !directMassIds.has(mass.id);
  }).map((mass) => massElement(mass.id));
  if (!changedSite.length && !spatialMasses.length) return scopeErrors;
  const errors = [...scopeErrors, ...identityErrors(beforePlan, afterPlan, direct)];
  const declared = new Map((reflow?.elements ?? []).map((entry) => [entry.id, entry]));
  // Directly targeted site elements are the edit itself, not a consequence of it; everything else must be reflowed.
  const changed = new Set([...changedSite, ...spatialMasses].filter((id) => !direct.has(id) || declared.has(id)));
  if (!reflow && changed.size) return [...errors, "Spatial changes require an explicit reflow proposal; preserve the Site Plan when no reflow is necessary."];
  for (const id of changed) if (!declared.has(id)) errors.push(`${id} changed without an auditable reflow proposal.`);
  for (const id of declared.keys()) if (!changed.has(id)) errors.push(`${id} was proposed for reflow but its geometry did not change.`);
  const beforeRects = siteRects(beforePlan, beforeDocument), afterRects = siteRects(afterPlan, afterDocument);
  for (const id of changedSite.filter((element) => !direct.has(element))) {
    const beforeRect = beforeRects.get(id), afterRect = afterRects.get(id);
    if (beforeRect && afterRect && Math.hypot((beforeRect.x0 + beforeRect.x1 - afterRect.x0 - afterRect.x1) / 2, (beforeRect.z0 + beforeRect.z1 - afterRect.z0 - afterRect.z1) / 2) > MAX_REFLOW_TRAVEL_M) errors.push(`Capability Need: ${id} requires a reflow beyond ${MAX_REFLOW_TRAVEL_M}m; that exceeds the bounded minimal-reflow capability.`);
  }
  const roots = new Set<string>(direct.keys());
  // A directly edited mass with non-spatial geometry is a legitimate root for a nearby site reflow.
  for (const mass of afterDocument.massing.masses) {
    const prior = beforeDocument.massing.masses.find((candidate) => candidate.id === mass.id);
    if ((!prior || stable(prior) !== stable(mass)) && directMassIds.has(mass.id)) roots.add(massElement(mass.id));
  }
  const visiting = new Set<string>(), reachesRoot = (id: string, depth = 0): boolean => {
    if (roots.has(id)) return true;
    if (depth > 3 || visiting.has(id)) return false;
    const proposal = declared.get(id);
    if (!proposal || !related(id, proposal.dependsOn, beforeRects, afterRects, beforeDocument, afterDocument)) return false;
    visiting.add(id); const result = reachesRoot(proposal.dependsOn, depth + 1); visiting.delete(id);
    return result;
  };
  for (const id of changed) if (!reachesRoot(id)) errors.push(`Capability Need: ${id} is outside the dependency-aware local reflow scope, has no valid relationship to its stated dependency, or exceeds the three-step cascade limit.`);
  const context = sitePlanContextForDocument(afterDocument.brief, afterDocument);
  if (!context) errors.push("Capability Need: this edit has no executable Site Plan frame for spatial reflow.");
  else errors.push(...sitePlanIntegrityErrors(afterPlan, context));
  return errors;
}
