import type { HousePrimitive } from "../types";
import type { FasciaEdge } from "../architecture/profiles";

const SUFFIX: Record<FasciaEdge, string> = { north: "-fascia-n", east: "-fascia-e", south: "-fascia-s", west: "-fascia-w" };

/** Keep fascia boards only on the listed edges; slopes and gable infill are never touched.
 * Undefined keeps every board (the historical behaviour). */
export function withFascia(primitives: HousePrimitive[], edges?: readonly FasciaEdge[]): HousePrimitive[] {
  if (!edges) return primitives;
  const dropped = (Object.keys(SUFFIX) as FasciaEdge[]).filter((e) => !edges.includes(e)).map((e) => SUFFIX[e]);
  return primitives.filter((p) => !dropped.some((suffix) => p.id.endsWith(suffix)));
}
