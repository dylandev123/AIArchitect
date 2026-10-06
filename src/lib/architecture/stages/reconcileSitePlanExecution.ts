import type { MassFootprint } from "../massFootprint";
import type { SitePlan } from "../sitePlanContract";
import { sitePlanOperations } from "./sitePlanStage";

const KEYS: Record<string, string> = { addDriveway: "driveways", addParking: "parking", addPool: "pools", addPatio: "patios", addDeck: "decks", addPath: "paths", addLandscape: "landscaping" };

/**
 * Executes an already-authored Site Plan deterministically after an accepted reflow.
 * Existing renderer ids stay with their semantic array slot whenever one remains; no site
 * element is invented, deleted, or repositioned here.
 */
export function reconcileSitePlanExecution(root: Record<string, unknown>, plan: SitePlan, masses: readonly MassFootprint[] = []): Record<string, unknown> {
  const next: Record<string, unknown> = { ...root, sitePlan: plan };
  const operations = sitePlanOperations(plan, masses);
  for (const [operation, key] of Object.entries(KEYS)) {
    const previous = Array.isArray(root[key]) ? root[key] as Record<string, unknown>[] : [];
    const authored = operations.filter((entry) => entry.op === operation).map((entry) => entry.value as Record<string, unknown>);
    next[key] = authored.map((value, index) => {
      const prior = previous[index];
      return prior && typeof prior.id === "string" ? { id: prior.id, ...value } : value;
    });
  }
  return next;
}
