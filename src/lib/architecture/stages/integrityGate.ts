import { DEFAULT_MATERIALS_CONFIG, type MaterialsConfig } from "@/types/house";
import { pathCurve } from "@/lib/house/features/paths";
import { placementBounds, type OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { compileArchitecture } from "../compiler";
import { isArchitecturalDesignDocument, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument } from "../document";
import { insideMass } from "../massFootprint";
import { sitePlanContextForDocument } from "../sitePlanContext";
import { sitePlanSchema, SITE_COLLISION_TOLERANCE_M, type SitePlan } from "../sitePlanContract";
import { architectureAuthorityHash, sitePlanAuthorityHash } from "./authority";
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
  const embedded = placements.filter((placement) => {
    const b = placementBounds(placement);
    return masses.some((mass) => insideMass(mass, b.x, b.z, -SITE_COLLISION_TOLERANCE_M));
  });
  push("scene-assets-clear-of-building", embedded.length === 0, embedded.length ? `${embedded.length} placed scene asset(s) stand inside a building mass: ${embedded.map((p) => p.role ?? p.assetId ?? "asset").join(", ")}.` : `${placements.length} placed scene asset(s) stand clear of the building.`);

  return finish();
}

function materialsOf(root: Record<string, unknown>): MaterialsConfig {
  const site = root.site;
  const materials = isRecord(site) ? site.materials : undefined;
  return isRecord(materials) ? { ...DEFAULT_MATERIALS_CONFIG, ...(materials as Partial<MaterialsConfig>) } : DEFAULT_MATERIALS_CONFIG;
}
