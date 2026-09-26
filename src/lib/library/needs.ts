import type { AssetRequest, Need, NeedStatus } from "@/types/library";
import { maxDimensions, sameFamily, titleFor } from "./taxonomy";

const MAX_PROJECT_REFS = 20;
const MAX_PHRASINGS = 8;

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

/** The existing need this request belongs to, if any. Ignored needs still match, so an ignored family stays ignored. */
export function findMatchingNeed(needs: readonly Need[], req: AssetRequest): Need | undefined {
  return needs.find((n) => sameFamily(n, req));
}

/**
 * Records one request: increments the matching Need or creates a new one. Pure — returns the changed/created need
 * and leaves the caller to persist it. A repeated request from the same project counts once per call, so callers
 * should dedupe within a generation (see `dedupeRequests`).
 */
export function recordRequest(needs: readonly Need[], req: AssetRequest, now: Date = new Date(), makeId: () => string = defaultId): Need {
  const at = now.toISOString();
  const existing = findMatchingNeed(needs, req);
  const ref = req.projectId ? [{ projectId: req.projectId, at }] : [];
  if (!existing) {
    return {
      id: makeId(),
      title: titleFor(req),
      category: req.category,
      styleTags: req.styleTags,
      contextTags: req.contextTags,
      dimensions: req.dimensions,
      requestedCount: 1,
      firstRequested: at,
      lastRequested: at,
      projectRefs: ref,
      phrasings: [req.text],
      status: "needed",
    };
  }
  return {
    ...existing,
    styleTags: unique([...existing.styleTags, ...req.styleTags]),
    contextTags: unique([...existing.contextTags, ...req.contextTags]),
    dimensions: maxDimensions(existing.dimensions, req.dimensions),
    requestedCount: existing.requestedCount + 1,
    lastRequested: at,
    projectRefs: [...existing.projectRefs, ...ref].slice(-MAX_PROJECT_REFS),
    phrasings: existing.phrasings.includes(req.text) ? existing.phrasings : [...existing.phrasings, req.text].slice(-MAX_PHRASINGS),
  };
}

function defaultId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `need-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Allowed transitions. The admin API never sets "approved" directly: it follows approval of the asset that satisfies the need. */
const TRANSITIONS: Record<NeedStatus, readonly NeedStatus[]> = {
  needed: ["generating", "review", "approved", "ignored"],
  generating: ["review", "approved", "needed", "ignored"],
  review: ["approved", "needed", "ignored"],
  approved: ["needed"],
  ignored: ["needed"],
};

export function canTransition(from: NeedStatus, to: NeedStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}
