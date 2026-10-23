# Estate creativity — reviewed local capabilities

Implemented in the existing development-only Villa Playground. Open `/dev/villa-playground` and select **Palmhaven**, **Splay House**, or **Cortile** in the existing study bar. These are deterministic, editable configurations, not templates automatically imposed on Terra.

No live OpenAI calls, new agents, migrations, commits or deployment were used.

## Three different properties

| Study | Actual geometric and spatial distinction | Direct route |
| --- | --- | --- |
| Palmhaven Estate | Two-storey Caribbean great house, subordinate salon and detached garden suite; long reversing palm avenue, 22 × 18 m fountain court, two garden walks and continuous pool promenade | `/dev/villa-playground?composition=estate-palmhaven` |
| Splay House | Tall central residence with detached salon at 330° and retreat at 30°; the roofs, façades, verandas and furnishings follow those angles; branching walks reach separate garden decks and the water axis. No motor court or fountain | `/dev/villa-playground?composition=estate-splay` |
| Cortile degli Ulivi | Gallery-connected stone residence and inward-facing loggias enclose four formal planted beds; cross-axis walks connect the gardens, loggias and pool; a cypress approach meets a 24 × 17 m planted oval forecourt | `/dev/villa-playground?composition=estate-cortile` |

The garden sizes derive from the complete occupied composition, including circulation planting reserves: approximately **87.3 × 92.9 m**, **78.2 × 73.6 m**, and **72.7 × 90.8 m**, respectively. Threshold paving connects the arrival walks to the existing raised entrance slabs. Separate terraces bridge the verandas, garden decks and pool coping without paving across water.

The Mediterranean planting uses the existing stylized deciduous-tree and cypress assets; it is an olive-garden composition, not a newly modeled botanical olive species.

## Browser screenshots

Actual Chromium WebGL screenshots, with the existing lighting, materials, water and postprocessing. The complete scene was reviewed from all nine positions below. `-clear` files temporarily hide interface overlays in the browser; the rendered scene pixels are unedited. The adjacent files without `-clear` retain the interface.

| Study | Full property aerial | Arrival | Poolside |
| --- | --- | --- | --- |
| Palmhaven | [Aerial](estate-palmhaven-above-clear.png) · [with UI](estate-palmhaven-above.png) | [Arrival](estate-palmhaven-arrival-clear.png) · [with UI](estate-palmhaven-arrival.png) | [Poolside](estate-palmhaven-poolside-clear.png) · [with UI](estate-palmhaven-poolside.png) |
| Splay House | [Aerial](estate-splay-above-clear.png) · [with UI](estate-splay-above.png) | [Arrival](estate-splay-arrival-clear.png) · [with UI](estate-splay-arrival.png) | [Poolside](estate-splay-poolside-clear.png) · [with UI](estate-splay-poolside.png) |
| Cortile | [Aerial](estate-cortile-above-clear.png) · [with UI](estate-cortile-above.png) | [Arrival](estate-cortile-arrival-clear.png) · [with UI](estate-cortile-arrival.png) | [Poolside](estate-cortile-poolside-clear.png) · [with UI](estate-cortile-poolside.png) |

Reusable controls and validation evidence:

- [Rotated detached-wing controls](rotated-wing-controls.png): the manual editor preserves 330° and 30° when applying other changes.
- [Driveway control points, clear width and planting](arrival-path-controls.png).
- [The same court with no island](court-without-island.png) and [with a planted island](court-with-planted-island.png). The three primary Palmhaven views show its fountain version.
- [Insufficient court lane rejected](validation-court-lane.png), with the estate preserved.
- [Fixed boundary clipping the landscape rejected](validation-fixed-site.png), with the estate preserved.
- [Exact 100 × 110 m fixed site accepted](fixed-site-accepted.png).
- [Original Solana retained](solana-preserved.png).

[Browser assertions and scene transforms](browser-checks.json), [geometry and rejected-case results](geometry-checks.json), and [complete deterministic configurations](examples.json) are included alongside the images.

## Reusable kit and constraints

`estate-landscape@1` is an optional composition field. Omitting it retains the prior grounds. Its routes have stable IDs, a drive/walk role, explicit width, 2–8 x/z control points and an avenue/border/none planting choice. A centripetal spline passes through those controls. Its sampled centreline feeds the **existing house geometry ribbon builder**, and the existing `PrimitiveMesh` supplies the PBR finish. Edging and restrained bollards follow the same centreline.

The optional court uses the already established `ellipsePlate` / `ellipseArc` geometry. Equal dimensions produce a circle; unequal dimensions produce an oval. Centre choices are **none**, **planted**, and **fountain**. The fountain uses a stone basin, water-coloured surfaces and two tiers. Its water streams are conceptual static geometry.

Avenue trees and path-border shrubs derive from the route tangents. Ground planting is filtered against every route, the court, building envelopes, terraces and the pool reserve. Explicit formal garden beds supply a second compositional vocabulary. There is no random lawn scatter in these estates.

| Capability | Supported bounds / validation |
| --- | --- |
| Driveway | 3.5–6 m clear width; controlled flat-ground spline |
| Walk | 0.9–3 m clear width |
| Landscape | At most 10 routes, one optional court and 12 formal beds; route controls x/z within ±200 m |
| Court | Width and depth each 12–28 m; island dimensions 2–12 m; at least 3.5 m clear lane on both principal axes when an island is present |
| Formal bed | Width and depth each 1.5–12 m; no overlap with circulation, buildings or pool reserve |
| Rotated wing | 15° increments, 0–345°; existing 4–32 m local wing dimensions and one/two-storey limits |
| Non-cardinal connections | Detached secondary wings only; main wings stay cardinal; no diagonal galleries or shared-wall joins |
| Site | Derived sites include road/path width, planting reserves, courts, beds, roofs, verandas, galleries, terraces and pool furniture. Explicit fixed sites are never expanded automatically |

Validation rejects self-crossing/pinched routes, routes through building footprints or pool reserves, drives through roof/veranda envelopes, driveways that miss their court, paving through the island, inadequate court lanes, beds over circulation, duplicate landscape feature IDs, unsupported rotations/joins and out-of-site reserves. The shared executor applies manual changes atomically; rejection preserves the current property. Court/bed and rotated-building collision envelopes are deliberately conservative AABBs, so some tight but physically possible placements can be rejected.

This is a flat-ground architectural concept kit. It does not simulate vehicle turning, grades, drainage or structural construction. Pedestrian connections are authored through controls and the existing terraces; there is no automatic path planner or guarantee that an arbitrary submitted network connects every destination. Existing rectangular pools remain unchanged.

## Terra readiness

The existing versioned architectural registry now includes **estate-landscape@1** and **rotated-detached-wing@1**, with provenance, parameters, checks, evidence and limitations. Both are approved for these reviewed local uses and have `availability: local`. `terraComponents()` excludes those local records. The current provider schema and result boundary still restrict wings to cardinal orientations and omit `estateLandscape`.

Terra can already control its prior validated architecture: cardinal wings, proportions, placement, hierarchy, attached/detached volumes, storeys, shared style/roof/façade, straight galleries, terraces/courtyards, rectangular pools, derived versus fixed sites, landscape margins and approved `curved-pavilion@1` placements and edits.

The new estate routes, court/island choices and detached wing rotations work through the shared local schema, builder and atomic patch executor, and through the existing manual customizer. They are **not yet advertised for live Terra selection**.

The subsequent small integration step is explicit:

1. Extend the Terra generate/edit wire and result schemas to admit optional `estateLandscape` and the bounded detached-wing rotations; retain the fixed-site override and all local validation.
2. Update `compositionSystemPrompt` with the exact route/court contract and its connection limits; remove the corresponding missing-capability claim for detached rotated wings.
3. Expose the new records through an appropriate composition-capability listing. `rotated-detached-wing@1` is a wing orientation capability, not an item in the pavilion-only `components` placement array; `estate-landscape@1` belongs in `estateLandscape`.
4. State clearly that these features are optional and brief-dependent. Modest residential designs may omit all of them. Extend offline provider replays for generation, targeted edits, fixed sites and unsupported joins before an authorized live call.

No preset selector, minimum feature count or estate-size rule was added to Terra.

## Existing builders inspected and reused

- `grounds.tsx`: pool, water, coping, planters, loungers and parasols retained.
- `design-grounds.tsx`: existing configurable style grounds retained.
- `composed-villa.tsx`, `wing-composition.ts`, `villa-kit.tsx`: existing wing, roof, façade, stair, veranda, gallery and terrace builders; the entire local wing frame rotates together.
- `house/features/paths.ts` and `house/geometry/mesh.ts`: existing bowed paths and ribbon/offset helpers. The new sampler adds a controllable winding centreline, then reuses `ribbon`.
- `landscaping/terrain.ts`: existing environment approach road is terrain-derived rather than an authored estate circulation network; it remains unchanged.
- `v3/siteFeatureConstruction.ts`, `estateSpatial.ts`, `estateAccess.ts`: existing authored site geometry and estate route logic reviewed. No V3 blueprint pipeline, polygon authoring surface or parallel construction engine was introduced.
- `experimental/pavilion-geometry.ts`, `curved-pavilion.tsx`: existing ellipse extrusion and finished procedural surfaces reused.
- Existing `Vegetation`, feathered palms, asset caches, PBR materials, scene lighting, water and postprocessing retained.

The UI changes are limited to three study buttons, the existing customizer's nested arrival/site controls, detached-wing orientation options, estate captions and property-aware camera framing.

## Verification and reproduction

- **130 tests passed** across the villa library, playground model/wing tests and offline Villa API route/metadata tests. The API tests use mocked/offline providers.
- `npm run typecheck`: passed.
- ESLint for the changed source files: passed.
- Geometry evidence: all three examples validate and round-trip; all route vertices are finite; five intentionally invalid cases reject; an explicit fitting fixed boundary remains exact.
- Browser assertions cover finite mesh positions, complete scene groups, rotated roof/façade/veranda world transforms, all nine camera views, optional islands, manual apply preserving rotations, court/site rejection, fitting fixed sites and restoring original Solana. Every `/api/ai/**` request is blocked; the final check requires zero such requests and zero uncaught page errors.

Run locally:

```sh
npm run dev
npx vite-node --config vitest.config.mts scripts/estate-landscape-evidence.ts
npx vitest run src/lib/villa src/app/dev/villa-playground/wing-composition.test.ts src/app/dev/villa-playground/villa-model.test.ts src/app/api/ai/villa --maxWorkers=1 --testTimeout=30000
npm run typecheck
node scripts/estate-landscape-capture.mjs
```

The capture script uses the locally installed Playwright/Chromium paths documented in its source. It waits for circulation vegetation, asserts full viewport canvas dimensions, records real scene transforms, toggles overlay visibility in place for clear images, and blocks AI endpoints. Screenshot capture bypasses Playwright's font-ready wait after a timeout during an earlier attempt; the UI uses the existing Arial/Georgia fonts. A prior parallel test run hit timeouts while Chromium was rendering; the serial run above passed. Existing Three.js Clock/shadow-map deprecation warnings and an unrelated global `/api/assets` database timeout were observed; no change to those systems was made.
