import type { ArchitecturalIntent } from "../designEngine";
import type { MassVolume, SiteStrategy } from "../document";
import { computeCourtyards } from "../compiler";

/** Below this a declared courtyard is not a usable outdoor room. */
export const MIN_COURTYARD_GAP_M = 3;

export interface CompositionCompletion { masses: MassVolume[]; notes: string[] }

/**
 * Validation-only: Mass Expansion owns membership, relationships, plans, placement and orientation.
 * Coordinates are resolved later from authored relationships; conflicts become repair feedback.
 */
export function completeComposition(masses: readonly MassVolume[], intent: ArchitecturalIntent, _site: SiteStrategy): CompositionCompletion {
  const notes: string[] = [];
  const byId = new Set(masses.map((m) => m.id));
  for (const mass of masses) for (const relationship of mass.relationships ?? []) {
    if (!byId.has(relationship.target)) notes.push(`relationship conflict: "${mass.id}" references missing mass "${relationship.target}".`);
    if (relationship.kind === "surrounds-courtyard" && (!relationship.side || (relationship.distance ?? 0) < MIN_COURTYARD_GAP_M)) notes.push(`courtyard conflict: "${mass.id}" declares surrounds-courtyard without a usable authored side/distance (minimum ${MIN_COURTYARD_GAP_M}m).`);
  }
  for (const courtyard of computeCourtyards(masses)) if (courtyard.enclosingMassIds.length < 2) notes.push(`courtyard conflict: "${courtyard.anchorMassId}" has only ${courtyard.enclosingMassIds.length} authored enclosing wing(s); no mass was recruited.`);
  if (intent.spatialGoals.includes("indoor-outdoor") && !masses.some((m) => m.plan?.outdoor !== "none")) notes.push("program conflict: indoor-outdoor living was requested but Mass Expansion authored no outdoor-room plan; no plan was added.");
  return { masses: masses.map((m) => ({ ...m, relationships: m.relationships ? [...m.relationships] : undefined })), notes };
}
