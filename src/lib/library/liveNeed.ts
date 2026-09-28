import type { Need, ReportAssetNeed } from "@/types/library";
import { normalizeAssetRequest, sameFamily } from "./taxonomy";

/**
 * Resolves the live planner record represented by a historical generation report.
 *
 * Report IDs are useful when they survived a migration, but are not stable identity
 * across storage backends.  A report's name is normalized through the same taxonomy
 * used to create Needs, then matched by category and style family.  Refuse an
 * ambiguous semantic match rather than risking a plan for the wrong Need.
 */
export function resolveLiveNeed(historical: ReportAssetNeed, liveNeeds: readonly Need[]): Need | undefined {
  const byId = liveNeeds.find((need) => need.id === historical.id);
  if (byId) return byId;

  const historicalFamily = normalizeAssetRequest(historical.name);
  if (!historicalFamily) return undefined;

  const semanticMatches = liveNeeds.filter((need) => sameFamily(need, historicalFamily));
  return semanticMatches.length === 1 ? semanticMatches[0] : undefined;
}
