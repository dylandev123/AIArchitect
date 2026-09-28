# Outdoor reusable asset placement validation

1. **Placement model.** Project JSON now stores `outdoorAssetPlacements`: placement ID, existing approved asset ID, parent outdoor space ID, category, position, rotation (radians), uniform scale, semantic role, dimensions and optional relationship. Realized outdoor spaces carry a placement frame (center, dimensions and yaw). No new asset IDs are minted for models; placement IDs identify instances. Existing version resolution still applies.

2. **Categories wired.** Existing furniture, pergola, light, decorative, outdoor-kitchen, outdoor-bar, fire-pit and cabana families. Roles include dining tables/chairs, loungers, side tables, lounge chairs, benches, stools, parasols, kitchen counters, fridge cabinets, bar counters, pergolas, pendants, lanterns, path lights, planters, pots, fire pits and cabanas. A supported role is applied only when its space has a safe slot.

3. **Collision rules.** Frames derive from generated patio/deck/garden surfaces, pool edges, the house/view axis and the outdoor-space footprint. Dining components share a center; chairs surround the table; pendants sit below a supporting pergola. Loungers face the pool from a clear edge. Placement reserves footprint margins and an entry corridor, excludes scene obstacles including buildings, pool, paths and deck posts, and checks previously placed assets. Pergola planning uses posts and an overhead roof volume; after loading, actual GLB triangles are checked against furniture bounds. Unsafe pergolas and unsupported pendants are omitted and reported. Loaded models are uniformly constrained to their reserved dimensions, including upgraded versions.

4. **Fixture evidence.** Zero live generations. The low-cost villa fixture uses the existing assembly pipeline. A native GLB fixture creates and validates approved test-library entries, loads them through the existing cache, instantiates nine models (one table, four dining chairs, one pergola, one pendant and two loungers), and verifies Applied → Rendered tracking. The same native geometry is software-rendered at the project transforms in `/tmp/aiarchitect-outdoor-fixture/dining.png`; it was visually inspected. Placement data is in `/tmp/aiarchitect-outdoor-fixture/placements.json`. A missing-file test confirms omission, failure recording and a valid house. Additional tests cover east-facing dining, path blockage, oversized assets and kitchen counters/stools/cabinets. This is fixture validation, not a browser GPU capture or a claim that a production user's library was inspected.

5. **Unsupported cases and tracking limits.** Tropical vegetation and built-in grill installation remain unsupported by this placement pass. Hanging lights require a placed support. Unknown roles, missing dimensions, incompatible styles and unsafe footprints remain Retrieved and keep their Needs open. Rendered/Failed observations are persisted in the browser and overlaid on Generation Intelligence; the server generation report records Retrieved/Applied because GLB files and rendering live on the client. Architectural generation, interiors, asset families and external providers are unchanged.

6. **Checks and changed files.** `npx tsc --noEmit`, `npm run lint`, `npm test` (704 passed, two existing skips), and `npm run build` pass. The build required network access for the existing Google Fonts downloads.

- `src/lib/outdoor/placements.ts`
- `src/lib/outdoor/spaces.ts`
- `src/types/house.ts`
- `src/app/api/ai/house/route.ts`
- `src/lib/library/retrieval.ts`
- `src/lib/library/spaceAssets.ts`
- `src/lib/library/generationLoop.ts`
- `src/lib/assets/placement.ts`
- `src/lib/assets/glbModels.ts`
- `src/lib/assets/outcomes.ts`
- `src/components/workspace/viewport/house/HouseRenderer.tsx`
- `src/components/workspace/viewport/house/GlbFeature.tsx`
- `src/types/library.ts`
- `src/store/useGenerationStore.ts`
- `src/components/admin/GenerationsTab.tsx`
- `src/lib/outdoor/__tests__/placements.test.ts`
- `src/lib/outdoor/__tests__/render.test.ts`
- `src/lib/library/__tests__/generationLoop.test.ts`
- `src/app/api/ai/house/__tests__/route.test.ts`
- `docs/outdoor-assets-validation.md` (this report)
