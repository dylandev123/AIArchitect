import { DEFAULT_MATERIALS_CONFIG, type MaterialsConfig } from "@/types/house";
import type { HousePrimitive } from "@/lib/house/types";
import { pathCurve } from "@/lib/house/features/paths";
import { placementBounds, type OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { compileArchitecture, resolveMasses } from "../compiler";
import { isArchitecturalDesignDocument, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument } from "../document";
import { insideMass, toMassLocal, type MassFootprint } from "../massFootprint";
import { buildFloorFootprint, type Point } from "../geometry/footprint";
import { sitePlanContextForDocument } from "../sitePlanContext";
import { sitePlanSchema, SITE_COLLISION_TOLERANCE_M, type SitePlan } from "../sitePlanContract";
import { architectureAuthorityHash, sitePlanAuthorityHash } from "./authority";
import { v2SiteFrameForDocument } from "../siteFrame";
import { runDesignQualityGate, summarizeChecks, type QualityCheck, type QualityGateResult, type QualitySeverity } from "./qualityGate";
import { finalOutcome, type RecoveryOutcome } from "./recovery";
import { sitePlanIntegrityErrors, sitePlanOperations } from "./sitePlanStage";

/** What the authoritative stages handed over — the fingerprints the final artifact must still match. */
export interface V2Authority {
  /** `architectureAuthorityHash` of the document as Roof Composition finished it. */
  architectureHash: string;
  /** `sitePlanAuthorityHash` of the plan as the Site Plan stage accepted it (after endpoint snapping). */
  sitePlanHash: string;
}

export interface V2IntegrityInput {
  /** The project JSON exactly as it is about to be returned and saved. */
  json: string;
  brief: string;
  authority: V2Authority;
  /** Present only for an Architect edit, so collision diagnostics can say whether a footprint moved since the saved document. */
  previousArchitectureDocument?: ArchitecturalDesignDocument;
  /** The saved project before an Architect edit. Used only to compare the same scene-asset collision in the baseline. */
  previousJson?: string;
}

export interface V2IntegrityResult extends QualityGateResult {
  /** "failed" when a blocking check failed; otherwise "normalized" if intent-preserving corrections were applied, else "accepted". */
  outcome: Exclude<RecoveryOutcome, "repair-required">;
  /** The intent-preserving deterministic corrections present in the final artifact (eave trims, routed paths). */
  normalizations: string[];
}

/** Site operations and the project keys they are executed into. */
const SITE_OP_KEYS: Record<string, string> = { addDriveway: "driveways", addParking: "parking", addPool: "pools", addPatio: "patios", addDeck: "decks", addPath: "paths", addLandscape: "landscaping" };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
/** Every authored field is present, unchanged, on the executed feature (the executor may add ids/asset references). */
const carries = (executed: unknown, authored: Record<string, unknown>) => isRecord(executed) && Object.entries(authored).every(([key, value]) => JSON.stringify(executed[key]) === JSON.stringify(value));
const ROOF_SUPPORT_TOLERANCE_M = 0.05;

type SceneAssetCollision = {
  placement: OutdoorAssetPlacement;
  bounds: ReturnType<typeof placementBounds>;
  mass: MassFootprint;
  /** How far the placement centre is inside this footprint. This lets edit mode reject a worsened baseline hit. */
  penetration: number;
};

const pointInPolygon = (point: Point, polygon: readonly Point[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i], [xj, zj] = polygon[j];
    if ((zi > point[1]) !== (zj > point[1]) && point[0] < (xj - xi) * (point[1] - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

const pointToSegmentDistance = (point: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dz));
};

/** Includes articulated projections/recesses, while retaining the conservative cantilever-aware site-frame footprint. */
function buildingContains(document: ArchitecturalDesignDocument, mass: MassFootprint, x: number, z: number): { contains: boolean; penetration: number } {
  const [lx, lz] = toMassLocal(mass, x, z);
  const basePenetration = Math.min(mass.width / 2 - Math.abs(lx), mass.depth / 2 - Math.abs(lz));
  if (basePenetration > SITE_COLLISION_TOLERANCE_M) return { contains: true, penetration: basePenetration - SITE_COLLISION_TOLERANCE_M };

  const resolved = resolveMasses(document).find((candidate) => candidate.id === mass.id);
  if (!resolved) return { contains: false, penetration: 0 };
  const local: Point = toMassLocal({ ...mass, cx: resolved.position.x, cz: resolved.position.z, rotation: resolved.rotation }, x, z);
  let penetration = 0;
  for (let floor = 0; floor < resolved.floors; floor++) {
    const polygon = buildFloorFootprint(resolved.width, resolved.depth, resolved.operations ?? [], floor).polygon;
    if (!pointInPolygon(local, polygon)) continue;
    const edgeDistance = Math.min(...polygon.map((a, i) => pointToSegmentDistance(local, a, polygon[(i + 1) % polygon.length])));
    penetration = Math.max(penetration, edgeDistance);
  }
  return { contains: penetration > SITE_COLLISION_TOLERANCE_M, penetration: Math.max(0, penetration - SITE_COLLISION_TOLERANCE_M) };
}

function roofSurfaceAt(primitives: readonly HousePrimitive[], massId: string, x: number, z: number): number | undefined {
  for (const plane of primitives.filter((primitive) => primitive.id === `architecture-${massId}-roof-plane` || (primitive.id.startsWith(`architecture-${massId}-roof-`) && primitive.id.endsWith("-plane")))) {
    if (plane.kind === "box") {
      const [lx, lz] = toMassLocal({ id: massId, cx: plane.position[0], cz: plane.position[2], width: plane.size[0], depth: plane.size[2], rotation: plane.rotation[1] }, x, z);
      if (Math.abs(lx) <= plane.size[0] / 2 + ROOF_SUPPORT_TOLERANCE_M && Math.abs(lz) <= plane.size[2] / 2 + ROOF_SUPPORT_TOLERANCE_M) return plane.position[1] + plane.size[1] / 2;
      continue;
    }
    for (let i = 0; i + 8 < plane.vertices.length; i += 9) {
      const a: Point = [plane.vertices[i], plane.vertices[i + 2]], b: Point = [plane.vertices[i + 3], plane.vertices[i + 5]], c: Point = [plane.vertices[i + 6], plane.vertices[i + 8]];
      const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(denominator) < 1e-9) continue;
      const u = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (z - c[1])) / denominator;
      const v = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (z - c[1])) / denominator;
      const w = 1 - u - v;
      if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) return u * plane.vertices[i + 1] + v * plane.vertices[i + 4] + w * plane.vertices[i + 7];
    }
  }
  return undefined;
}

/** Rooftop placement is an authored relationship, never an inference from object type or nearby geometry. */
function rooftopHostId(placement: OutdoorAssetPlacement): string | undefined {
  const supportMassId = placement.support?.kind === "roof" ? placement.support.massId : undefined;
  const intentMassId = placement.intent?.surface === "roof" ? placement.intent.massId : undefined;
  return supportMassId && intentMassId && supportMassId === intentMassId ? supportMassId : undefined;
}

const claimsRoofPlacement = (placement: OutdoorAssetPlacement) => placement.support?.kind === "roof" || placement.intent?.surface === "roof";
const sameBounds = (a: ReturnType<typeof placementBounds>, b: ReturnType<typeof placementBounds>) => (["x", "z", "y", "w", "d", "h"] as const).every((key) => Math.abs(a[key] - b[key]) <= 1e-6);

function isSupportedOnHostRoof(placement: OutdoorAssetPlacement, bounds: ReturnType<typeof placementBounds>, mass: MassFootprint, primitives: readonly HousePrimitive[]) {
  const hostId = rooftopHostId(placement);
  if (!hostId || hostId !== mass.id || placement.support?.elevation === undefined) return false;
  const roofY = roofSurfaceAt(primitives, hostId, bounds.x, bounds.z);
  return roofY !== undefined
    && Math.abs(placement.support.elevation - roofY) <= ROOF_SUPPORT_TOLERANCE_M
    && bounds.y >= roofY - ROOF_SUPPORT_TOLERANCE_M;
}

function sceneAssetCollisions(document: ArchitecturalDesignDocument, primitives: readonly HousePrimitive[], masses: readonly MassFootprint[], placements: readonly OutdoorAssetPlacement[]): SceneAssetCollision[] {
  return placements.flatMap((placement) => {
    const bounds = placementBounds(placement);
    return masses.flatMap((mass) => {
      const building = buildingContains(document, mass, bounds.x, bounds.z);
      if (!building.contains || isSupportedOnHostRoof(placement, bounds, mass, primitives)) return [];
      return [{ placement, bounds, mass, penetration: building.penetration }];
    });
  });
}

/**
 * The final V2 integrity gate. Runs after every authoritative stage and all deterministic execution, on the
 * exact project JSON that would be returned/saved, immediately before finalization — and inspects what is
 * actually in it: the architecture document, the geometry it compiles to, the roofs after clearance processing,
 * the canonical Site Plan after snapping and as executed after obstacle routing, and the placed scene assets.
 *
 * It only measures. A failed BLOCKING check means the artifact must not be returned or persisted as a
 * successful generation; nothing here repairs, substitutes or redesigns. Subjective observations are warnings.
 */
export function runV2IntegrityGate(input: V2IntegrityInput): V2IntegrityResult {
  const checks: QualityCheck[] = [];
  const normalizations: string[] = [];
  const push = (id: string, passed: boolean, detail: string, severity: QualitySeverity = "blocking") => checks.push({ id, passed, detail, severity });
  const finish = (): V2IntegrityResult => {
    const summary = summarizeChecks(checks);
    return { ...summary, outcome: finalOutcome(summary.passed, normalizations), normalizations };
  };

  let root: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(input.json);
    if (!isRecord(parsed)) throw new Error("not an object");
    root = parsed;
  } catch {
    push("final-artifact", false, "The final project JSON is not a valid object.");
    return finish();
  }

  // 1. The final architecture document, and that nothing downstream of its authors changed it.
  const document = root.architecturalDesignDocument;
  if (!isArchitecturalDesignDocument(document)) {
    push("architecture-document", false, "The final artifact carries no V2 architecture document.");
    return finish();
  }
  const documentErrors = validateArchitecturalDesignDocument(document);
  push("architecture-document", documentErrors.length === 0, documentErrors.length ? `Invalid architecture document: ${documentErrors.join("; ")}.` : "The final artifact carries a valid V2 architecture document.");
  const unchanged = architectureAuthorityHash(document) === input.authority.architectureHash;
  push("authority-architecture", unchanged, unchanged ? "The architecture is exactly what its authoring stages produced." : "The architecture document was changed after Roof Composition by a stage with no write authority over it.");
  if (documentErrors.length) return finish();

  // 2. The compiled geometry and roofs (after clearance) of that document, with the materials it will render in.
  const compiled = compileArchitecture(document as ArchitecturalDesignDocument, { materials: materialsOf(root) });
  push("compiled-geometry", compiled.errors.length === 0 && !!compiled.diagnostics && compiled.model.primitives.length > 0, compiled.errors.length ? `The document does not compile: ${compiled.errors.join("; ")}.` : "The document compiles to geometry.");
  if (compiled.diagnostics) {
    checks.push(...runDesignQualityGate(document, compiled.diagnostics).checks);
    for (const c of compiled.diagnostics.roofClearance) if (c.cleared < c.authored && c.preservesLanguage) normalizations.push(`eave on "${c.massId}" trimmed ${c.authored.toFixed(2)}m → ${c.cleared.toFixed(2)}m for clearance.`);
  }

  // 3. The canonical Site Plan: present, valid, unchanged, connected, collision-free — and executed as authored.
  const context = sitePlanContextForDocument(input.brief, document);
  const parsedPlan = sitePlanSchema.safeParse(root.sitePlan);
  if (!parsedPlan.success || !context) {
    push("site-plan-canonical", false, root.sitePlan === undefined ? "The final artifact has no canonical V2 Site Plan." : `The canonical V2 Site Plan is invalid: ${parsedPlan.success ? "no V2 site frame" : parsedPlan.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}.`);
    return finish();
  }
  const plan: SitePlan = parsedPlan.data;
  push("site-plan-canonical", true, "The final artifact carries a valid canonical V2 Site Plan.");
  const planUnchanged = sitePlanAuthorityHash(plan) === input.authority.sitePlanHash;
  push("authority-site-plan", planUnchanged, planUnchanged ? "The Site Plan is exactly what the Site Plan stage authored." : "The canonical Site Plan was changed after the Site Plan stage accepted it.");
  const planErrors = sitePlanIntegrityErrors(plan, context);
  push("site-plan-integrity", planErrors.length === 0, planErrors.length ? planErrors.join(" ") : "The Site Plan is connected end to end and clear of the building.");

  const masses = context.masses ?? [];
  const expected = sitePlanOperations(plan, masses);
  const notExecuted: string[] = [];
  for (const [op, key] of Object.entries(SITE_OP_KEYS)) {
    const authored = expected.filter((e) => e.op === op).map((e) => e.value as Record<string, unknown>);
    const executed = Array.isArray(root[key]) ? (root[key] as unknown[]) : [];
    if (executed.length !== authored.length || !authored.every((value, i) => carries(executed[i], value))) notExecuted.push(`${key} (${executed.length} executed, ${authored.length} authored)`);
  }
  push("authority-site-geometry", notExecuted.length === 0, notExecuted.length ? `Executed site geometry differs from the authored Site Plan: ${notExecuted.join(", ")}.` : "Every site feature is executed exactly as the Site Plan authored it (paths routed around the building between their authored end points).");
  if (expected.filter((e) => e.op === "addPath").length > plan.paths.length) normalizations.push("site paths routed around the building between their authored end points.");

  const executedPaths = Array.isArray(root.paths) ? (root.paths as Parameters<typeof pathCurve>[0][]) : [];
  const crossing = executedPaths.filter((path) => pathCurve(path).some((p) => masses.some((mass) => insideMass(mass, p[0], p[1], -SITE_COLLISION_TOLERANCE_M)))).length;
  push("site-path-clear-of-building", crossing === 0, crossing ? `${crossing} executed path(s) run through a building mass.` : "No executed path runs through a building mass.");

  // 4. Placed scene assets, where a collision with the building is an integrity failure rather than a taste call.
  const placements = Array.isArray(root.outdoorAssetPlacements) ? (root.outdoorAssetPlacements as OutdoorAssetPlacement[]) : [];
  const baseline = baselineProject(input);
  const previousDocument = baseline?.document ?? input.previousArchitectureDocument;
  const previousMasses = previousDocument ? new Map((v2SiteFrameForDocument(previousDocument)?.masses ?? []).map((mass) => [mass.id, mass])) : undefined;
  const sameFootprint = (a: typeof masses[number], b: typeof masses[number]) => a.cx === b.cx && a.cz === b.cz && a.width === b.width && a.depth === b.depth && a.rotation === b.rotation;
  const embedded = sceneAssetCollisions(document, compiled.model.primitives, masses, placements);
  const baselineEmbedded = baseline ? sceneAssetCollisions(baseline.document, baseline.primitives, baseline.masses, baseline.placements) : [];
  // Baseline comparison is deliberately narrower than normal validation: only an identical, non-rooftop
  // scene-asset collision may survive an architectural edit. A new mass, deeper penetration, moved asset,
  // malformed rooftop metadata, or an embedded rooftop object is always a current blocking failure.
  const newOrWorsened = embedded.filter((hit) => {
    if (!baseline || claimsRoofPlacement(hit.placement)) return true;
    const previous = baselineEmbedded.find((prior) => prior.placement.id === hit.placement.id && prior.mass.id === hit.mass.id);
    return !previous || !sameBounds(hit.bounds, previous.bounds) || hit.penetration > previous.penetration + 1e-6;
  });
  const collisionDetail = (hit: typeof embedded[number]) => {
    const previous = previousMasses?.get(hit.mass.id);
    return JSON.stringify({
      placement: {
        id: hit.placement.id,
        type: hit.placement.role ?? hit.placement.category ?? hit.placement.assetId,
        worldPosition: hit.placement.position,
        boundsUsed: hit.bounds,
      },
      intersectingMass: {
        id: hit.mass.id,
        resolvedPosition: { x: hit.mass.cx, z: hit.mass.cz },
        rotation: hit.mass.rotation,
        bounds: { center: { x: hit.mass.cx, z: hit.mass.cz }, width: hit.mass.width, depth: hit.mass.depth },
        ...(previousMasses ? { footprintDiffersFromPreEdit: previous ? !sameFootprint(hit.mass, previous) : true } : {}),
      },
    });
  };
  push("scene-assets-clear-of-building", newOrWorsened.length === 0, newOrWorsened.length ? `${newOrWorsened.length} placed scene asset(s) stand inside a building mass: ${newOrWorsened.map((hit) => hit.placement.role ?? hit.placement.assetId ?? "asset").join(", ")}. ${newOrWorsened.map(collisionDetail).join(" ")}` : embedded.length ? `${embedded.length} pre-existing, unchanged non-rooftop scene-asset collision(s) were retained as edit baseline findings.` : `${placements.length} placed scene asset(s) stand clear of the building.`);

  return finish();
}

function baselineProject(input: V2IntegrityInput): { document: ArchitecturalDesignDocument; primitives: HousePrimitive[]; masses: readonly MassFootprint[]; placements: OutdoorAssetPlacement[] } | undefined {
  if (!input.previousJson) return undefined;
  try {
    const parsed: unknown = JSON.parse(input.previousJson);
    if (!isRecord(parsed) || !isArchitecturalDesignDocument(parsed.architecturalDesignDocument)) return undefined;
    const document = parsed.architecturalDesignDocument;
    if (validateArchitecturalDesignDocument(document).length) return undefined;
    const context = sitePlanContextForDocument(input.brief, document);
    if (!context) return undefined;
    const compiled = compileArchitecture(document, { materials: materialsOf(parsed) });
    if (compiled.errors.length) return undefined;
    return {
      document,
      primitives: compiled.model.primitives,
      masses: context.masses ?? [],
      placements: Array.isArray(parsed.outdoorAssetPlacements) ? parsed.outdoorAssetPlacements as OutdoorAssetPlacement[] : [],
    };
  } catch {
    return undefined;
  }
}

function materialsOf(root: Record<string, unknown>): MaterialsConfig {
  const site = root.site;
  const materials = isRecord(site) ? site.materials : undefined;
  return isRecord(materials) ? { ...DEFAULT_MATERIALS_CONFIG, ...(materials as Partial<MaterialsConfig>) } : DEFAULT_MATERIALS_CONFIG;
}
