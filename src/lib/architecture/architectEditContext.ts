import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { targetCatalog, type TargetCatalogEntry } from "./sceneOperations";
import type { ArchitecturalDesignDocument } from "./document";
import type { SitePlan } from "./sitePlanContract";

/** The amount of authoritative world state an Architect edit is allowed to see. */
export type ArchitectEditContextTier = "local-object" | "local-architecture" | "global-architecture";

export const ARCHITECT_EDIT_CONTEXT_BUDGETS: Record<ArchitectEditContextTier, number> = {
  "local-object": 9_000, // ~2.25k tokens
  "local-architecture": 28_000, // ~7k tokens
  "global-architecture": Number.POSITIVE_INFINITY,
};

const OPERATIONS = ["create", "delete", "move", "rotate", "resize", "changeMaterial", "attach", "detach", "duplicate", "extrude", "cut"] as const;
const WORD = /[a-z0-9][a-z0-9-]*/gi;
const GLOBAL_SCOPE = /\b(?:entire|whole|all|throughout|everywhere|global|complete|full)\b/i;
const GLOBAL_CHANGE = /\b(?:redesign|rethink|restyle|overhaul|rebuild|recompose|change|transform|revise)\b/i;
const SIMPLE_OPERATION = /\b(?:delete|remove|move|rotate|turn|resize|scale|recolor|recolour|color|colour|paint|material|finish)\b/i;

export interface CompactSceneTarget {
  id: string;
  kind: TargetCatalogEntry["kind"];
  semanticType: string;
  label: string;
  parent?: string;
  host?: unknown;
  position?: readonly number[];
  rotation?: readonly number[];
  dimensions?: readonly number[];
  material?: unknown;
  source?: TargetCatalogEntry["source"];
  capabilities: readonly string[];
  groupMembers?: readonly string[];
}

export interface ArchitectEditContext {
  contextTier: ArchitectEditContextTier;
  sceneSummary: { masses: number; sceneObjects: number; outdoorAssets: number; siteElements: number };
  targets: CompactSceneTarget[];
  nearby: CompactSceneTarget[];
  dependencies: CompactSceneTarget[];
  availableOperations: readonly string[];
  knownCapabilityNeeds: readonly string[];
  /** Only global intent gets the full persistent record. */
  document?: ArchitecturalDesignDocument;
  diagnostics: {
    selectedTargetIds: readonly string[];
    contextChars: number;
    estimatedTokens: number;
    fullDocumentIncluded: boolean;
  };
}

export interface ArchitectEditUsage {
  architectAttempts: number;
  inputTokensTotal: number;
  outputTokensTotal: number;
  totalTokens: number;
  estimatedCost: number | null;
  contextTier: ArchitectEditContextTier;
  repaired: boolean;
}

export function createArchitectEditUsage(contextTier: ArchitectEditContextTier): ArchitectEditUsage {
  return { architectAttempts: 0, inputTokensTotal: 0, outputTokensTotal: 0, totalTokens: 0, estimatedCost: null, contextTier, repaired: false };
}

export function recordArchitectEditUsage(usage: ArchitectEditUsage, attempt: number, providerUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }): void {
  const input = Number.isFinite(providerUsage?.inputTokens) ? Math.max(0, providerUsage!.inputTokens!) : 0;
  const output = Number.isFinite(providerUsage?.outputTokens) ? Math.max(0, providerUsage!.outputTokens!) : 0;
  usage.architectAttempts += 1;
  usage.inputTokensTotal += input;
  usage.outputTokensTotal += output;
  usage.totalTokens += Number.isFinite(providerUsage?.totalTokens) ? Math.max(0, providerUsage!.totalTokens!) : input + output;
  usage.repaired ||= attempt > 1;
}

export interface ArchitectEditContextInput {
  document: ArchitecturalDesignDocument;
  sitePlan: SitePlan;
  outdoorAssetPlacements?: readonly OutdoorAssetPlacement[];
  request: string;
  selectedTargetIds?: readonly string[];
}

/** Deterministic and deliberately conservative: this measures the payload, not provider billing. */
export const estimateContextTokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

const words = (value: string) => new Set((value.toLowerCase().match(WORD) ?? []).filter((word) => word.length > 1));
const targetWords = (entry: TargetCatalogEntry) => words(`${entry.id} ${entry.kind} ${entry.semanticType} ${entry.label} ${entry.source?.assetId ?? ""} ${entry.source?.kind ?? ""}`);
const positionOf = (entry: TargetCatalogEntry) => entry.transform?.position;
const distance = (a?: readonly number[], b?: readonly number[]) => a && b ? Math.hypot(a[0] - b[0], a[2] - b[2]) : Number.POSITIVE_INFINITY;

function parentOf(entry: TargetCatalogEntry): string | undefined {
  const parts = entry.id.split(":");
  if (entry.kind === "assembly") return `mass:${parts[1]}`;
  if (entry.kind === "part") return `assembly:${parts[1]}:${parts[2]}`;
  const host = entry.hostOrSupport as { massId?: unknown } | undefined;
  return typeof host?.massId === "string" ? `mass:${host.massId}` : undefined;
}

function compact(entry: TargetCatalogEntry, members: ReadonlyMap<string, readonly string[]>): CompactSceneTarget {
  return {
    id: entry.id, kind: entry.kind, semanticType: entry.semanticType, label: entry.label,
    ...(parentOf(entry) ? { parent: parentOf(entry) } : {}),
    ...(entry.hostOrSupport !== undefined ? { host: entry.hostOrSupport } : {}),
    ...(entry.transform?.position ? { position: entry.transform.position } : {}),
    ...(entry.transform?.rotation ? { rotation: entry.transform.rotation } : {}),
    ...(entry.transform?.dimensions ? { dimensions: entry.transform.dimensions } : {}),
    ...(entry.material ? { material: entry.material } : {}),
    ...(entry.source ? { source: entry.source } : {}), capabilities: entry.capabilities,
    ...(members.get(entry.id)?.length ? { groupMembers: members.get(entry.id) } : {}),
  };
}

/** Intent controls context breadth, never an architectural design decision. */
export function classifyArchitectEditContext(request: string): ArchitectEditContextTier {
  // "Keep the entire property unchanged" is a preservation constraint, not a
  // request for global reasoning. Broad scope needs both a breadth signal and a
  // change intent.
  if (GLOBAL_SCOPE.test(request) && GLOBAL_CHANGE.test(request)) return "global-architecture";
  return SIMPLE_OPERATION.test(request) ? "local-object" : "local-architecture";
}

function selectedIds(catalog: readonly TargetCatalogEntry[], supplied: readonly string[] | undefined): string[] {
  const valid = new Set<string>(catalog.map((entry) => entry.id));
  return [...new Set((supplied ?? []).filter((id): id is string => typeof id === "string" && valid.has(id)))];
}

/**
 * Build a compact, generic scene slice from the same catalog the executor uses.
 * It has no feature-noun routing: selection, lexical evidence, relationships and
 * spatial proximity are scored uniformly for any future scene type.
 */
export function buildArchitectEditContext(input: ArchitectEditContextInput): ArchitectEditContext {
  const state = { document: input.document, sitePlan: input.sitePlan, outdoorAssetPlacements: input.outdoorAssetPlacements };
  const catalog = targetCatalog(state);
  const tier = classifyArchitectEditContext(input.request);
  const requestWords = words(input.request);
  const selected = selectedIds(catalog, input.selectedTargetIds);
  const groupMembers = new Map<string, string[]>();
  for (const placement of input.outdoorAssetPlacements ?? []) if (placement.group) {
    const id = `asset-group:${placement.group.id}`;
    groupMembers.set(id, [...(groupMembers.get(id) ?? []), `asset:${placement.id}`]);
  }
  const selectedSet = new Set(selected);
  const directIds = new Set<string>(selected);
  for (const entry of catalog) if (requestWords.size && [...targetWords(entry)].some((word) => requestWords.has(word))) directIds.add(entry.id);
  // Do not accidentally select generic catalog words such as "mass" without a real semantic match.
  const scored = catalog.map((entry) => {
    const overlap = [...targetWords(entry)].filter((word) => requestWords.has(word)).length;
    const direct = selectedSet.has(entry.id) ? 10_000 : overlap * 120;
    return { entry, score: direct + (entry.capabilities.some((op) => input.request.toLowerCase().includes(op.toLowerCase())) ? 8 : 0) };
  });
  const roots = scored.filter(({ entry, score }) => directIds.has(entry.id) || score >= 120).sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id)).slice(0, tier === "local-object" ? 6 : 12);
  // A request with no lexical evidence retains a small anchor set rather than dumping the whole scene.
  if (!roots.length && catalog.length) roots.push({ entry: catalog[0], score: 1 });
  const rootIds = new Set(roots.map(({ entry }) => entry.id));
  const dependencyIds = new Set<string>();
  for (const { entry } of roots) {
    const parent = parentOf(entry); if (parent) dependencyIds.add(parent);
    if (entry.kind === "asset-group") for (const member of groupMembers.get(entry.id) ?? []) dependencyIds.add(member);
    if (entry.kind === "asset") {
      const group = [...groupMembers.entries()].find(([, members]) => members.includes(entry.id))?.[0];
      if (group) dependencyIds.add(group);
    }
  }
  const rootPositions = roots.map(({ entry }) => positionOf(entry)).filter((value): value is readonly [number, number, number] => Boolean(value));
  const radius = tier === "local-object" ? 12 : 28;
  const nearby = catalog.filter((entry) => !rootIds.has(entry.id) && !dependencyIds.has(entry.id) && rootPositions.some((root) => distance(root, positionOf(entry)) <= radius));
  const rankedNearby = nearby.map((entry) => ({ entry, score: Math.min(...rootPositions.map((root) => distance(root, positionOf(entry)))) }))
    .sort((a, b) => a.score - b.score || a.entry.id.localeCompare(b.entry.id));
  const targetEntries = roots.map(({ entry }) => entry);
  const dependencyEntries = catalog.filter((entry) => dependencyIds.has(entry.id));
  const nearbyEntries = rankedNearby.map(({ entry }) => entry);
  const contextBase = {
    contextTier: tier,
    sceneSummary: { masses: input.document.massing.masses.length, sceneObjects: input.document.sceneObjects?.length ?? 0, outdoorAssets: input.outdoorAssetPlacements?.length ?? 0, siteElements: catalog.filter((entry) => entry.kind === "site").length },
    targets: targetEntries.map((entry) => compact(entry, groupMembers)),
    nearby: nearbyEntries.map((entry) => compact(entry, groupMembers)),
    dependencies: dependencyEntries.map((entry) => compact(entry, groupMembers)),
    availableOperations: OPERATIONS,
    knownCapabilityNeeds: [],
  };
  if (tier === "global-architecture") {
    // Global reasoning needs every executable id, not a lexical slice. Each target appears once (no
    // target/nearby/dependency duplicates), and the document carries the facade/assembly detail.
    const withDocument = { ...contextBase, targets: catalog.map((entry) => compact(entry, groupMembers)), nearby: [], dependencies: [], document: input.document };
    return { ...withDocument, diagnostics: { selectedTargetIds: selected, contextChars: JSON.stringify(withDocument).length, estimatedTokens: estimateContextTokens(withDocument), fullDocumentIncluded: true } };
  }
  const budget = ARCHITECT_EDIT_CONTEXT_BUDGETS[tier];
  // Always retain roots and their required relationships; trim only lowest-relevance neighbours.
  const keptNearby = [...contextBase.nearby];
  while (keptNearby.length && JSON.stringify({ ...contextBase, nearby: keptNearby }).length > budget) keptNearby.pop();
  const result = { ...contextBase, nearby: keptNearby };
  return { ...result, diagnostics: { selectedTargetIds: selected, contextChars: JSON.stringify(result).length, estimatedTokens: estimateContextTokens(result), fullDocumentIncluded: false } };
}

/**
 * Repair normally keeps only evidence around failed targets; it must never grow into initial context. The one
 * exception is `includeWorld`: an INCOMPLETE_PLAN is repaired by planning the missing goals, which needs the same
 * world the first plan was made from (and nothing more).
 */
export function buildArchitectRepairContext(initial: ArchitectEditContext, failedTargetIds: readonly string[], validation: unknown, previousPlan: unknown, options: { includeWorld?: boolean } = {}) {
  const all = [...initial.targets, ...initial.dependencies, ...initial.nearby];
  if (options.includeWorld) {
    const world = { targets: initial.targets, dependencies: initial.dependencies, nearby: initial.nearby, ...(initial.document ? { document: initial.document } : {}) };
    const repair = { userRequestContextTier: initial.contextTier, previousPlan, validation, world, availableOperations: initial.availableOperations };
    return { ...repair, diagnostics: { contextChars: JSON.stringify(repair).length, estimatedTokens: estimateContextTokens(repair), fullDocumentIncluded: Boolean(initial.document) } };
  }
  const ids = new Set(failedTargetIds);
  const relevant = all.filter((target) => ids.has(target.id) || target.parent && ids.has(target.parent)).slice(0, 16);
  const repair = { userRequestContextTier: initial.contextTier, previousPlan, validation, affectedTargets: relevant, availableTargetIds: [...new Set(all.map((target) => target.id))], availableOperations: initial.availableOperations };
  return { ...repair, diagnostics: { contextChars: JSON.stringify(repair).length, estimatedTokens: estimateContextTokens(repair), fullDocumentIncluded: false } };
}
