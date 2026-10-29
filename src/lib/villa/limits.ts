/** Creative envelopes, not structural certification. Counts bound scene work;
 * geometric clearances, roof compatibility and sampling budgets remain independent. */
export const VILLA_LIMITS = {
  outputTokens: 12000, position: 512, rectangle: 512, wing: 64, storeyHeight: 4.5,
  veranda: 6, balcony: 2.4, galleryWidth: 10, gallerySpan: 64,
  poolWidth: 64, poolDepth: 24, garden: 2048, margin: 60,
  facadeWork: 2048, wings: 16, galleries: 16, terraces: 32, pavilions: 8,
  pavilionWidth: 20, pavilionDepth: 16, pavilionHeight: 6,
  driveWidth: 12, walkWidth: 6, court: 56, island: 24, bed: 64,
  routes: 10, controls: 8, beds: 24, routeSamples: 1200, routeSpacing: .65,
  bedEdgePlants: 8, circulationPlants: 128,
} as const;
