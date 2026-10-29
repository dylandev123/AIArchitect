import type { KnowledgeRevision } from './model';

/** Refinements to existing curated fragments, not scene templates or new approvals.
 * No coordinates, fixed layouts or amenity bundles are supplied to generation. */
export const fragmentDetails: Record<string, {
 terms: string[]; combinations: string; supports: string;
 requiredKinds?: NonNullable<KnowledgeRevision['construction']>['requiredKinds'];
}> = {
 'pool-shallow-zone': {
  terms:['sun shelf','baja shelf','tanning ledge','shallow pool'],
  combinations:'Combine with a rectangular lap basin for family lounging or a compact plunge basin for a private court. Keep a deeper swimming route where requested; a shelf is optional.',
  supports:'Construct a raised submerged plate inside basin walls, above the deep bottom and below water. Keep the dry deck separate and avoid covering the swimming zone.',
 },
 'pool-spa-separation': {
  terms:['spa','hot tub'],
  combinations:'Pair a separate rectangular spa with a dry connecting deck and optional privacy screen. Use only when wellness is requested; omit on a compact brief without spa priorities.',
  supports:'Construct distinct bottom, perimeter walls and water for each basin; connect their dry approaches. Water geometry does not provide heating, jets or hydraulic connection.',
 },
 'pool-infinity-limit': {
  terms:['infinity edge','vanishing edge','ocean-facing'],
  combinations:'Combine a view-facing rectangular basin with a stone deck and sheltered lounge. Use a conventional bounded basin when privacy or a courtyard is the primary purpose.',
  supports:'Build a bottom, complete perimeter and water below the rim. Coordinate the view edge with the deck; disclose that overflow, catch basin hydraulics and a true vanishing edge are unsupported.',
 },
 'pool-deck-width': {
  terms:['poolside','stone deck','pool deck'],
  combinations:'Combine dry limestone plates with a basin and optional shade or seating. Select one coherent route and occupied lounge area rather than filling every edge with amenities.',
  supports:'Arrange dry plates outside the bounded water footprint with a connected approach from a real door. Keep seating on dry supported surfaces and preserve circulation.',
 },
 'pool-step-representation': {
  terms:['pool steps','submerged seating','pool seating'],
  combinations:'Combine rectangular submerged steps or a sitting ledge with the basin edge and optional sun shelf. Preserve a clear swimming zone; do not imply certified entry safety.',
  supports:'Use explicit rectangular solids inside the perimeter, below the water datum and connected to the basin bottom or wall; names and water alone cannot represent steps.',
  requiredKinds:['plate','wall','water','volume'],
 },
};
