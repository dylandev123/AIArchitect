# Local architectural wing composition studies

Evaluate at `/dev/villa-playground` using the **Wing studies** buttons, or load a preset directly:

- `/dev/villa-playground?composition=compact-l` — Villa Canopée: a 16 × 7 m, two-storey main house and a perpendicular 10 × 7 m garden salon, joined by a low breeze gallery. A sheltered L around a compact terrace and 10 m pool.
- `/dev/villa-playground?composition=courtyard-u` — Palacio del Agua: a 22 × 8 m, two-storey great house, two inward-facing 13 × 7 m side wings and two lower galleries. Arcades, an axial fountain, a generous courtyard and a 14 m pool.
- `/dev/villa-playground?composition=pavilion-estate` — Villa Latitude: an offset two-storey main house, a linked single-storey salon, two detached guest/studio pavilions, and separate outdoor rooms around a 9.5 m pool. Four building wings, with independent heights and orientations.

The route remains development-only. The default route still opens original Villa Solana. Styles and their existing customization remain available through the top style buttons. The new wing studies have a preset selector; their individual wings are authored in local TypeScript, not through a drag-and-drop editor. In-page selection is transient; direct query routes provide reloadable entry points.

## Audit of the previous system

| Source | Fixed assumptions | Existing parameters / useful reusable parts |
| --- | --- | --- |
| `architecture.tsx` | Solana's salon, entrance, upper suite, dining pavilion, belvedere and stair all use absolute positions; room furniture and roof decks belong to that exact building. | FinishBox, Box, Slats, Glazing, Roof and Sofa accept dimensions/positions and can be reused. The original building is untouched. |
| `src/lib/villa/design.ts` | `composeVilla` emits fixed hall/west/east arrangements. “Pavilions” and “stepped” share positions; every bay faces +Z. All roofs are separate rectangular assemblies. | Four style rules; material/glazing/roof selection; overall scale, wing ratio, one/two levels, veranda/terrace/pool dimensions. No per-wing translation, rotation, height or wing count. |
| `villa-kit.tsx` | Bay height uses common BASE/FLOOR/WALL constants. It renders all four walls even at bay interfaces, a full-width front veranda and a predetermined rear stair. | Pierced façade bays, real masonry arches, hip/gable roof with soffit/fascia, glazing, covered verandas and furnishings derive from dimensions. This change only exports Wall, Facade and Veranda for reuse. |
| `design-grounds.tsx`, `grounds.tsx` | Fixed estate width, rear/side paths, vegetation positions, pool decks and lounge positions. Pool itself is centred at (-2, 12.4). | Existing pool, sun shelf, spill channel, planters, loungers and parasols are reused. The new grounds renderer translates the existing pool assembly as a unit. |
| `scene.tsx` | Four cameras framed the original estate size. | Existing Canvas, lighting, sky/environment, OrbitControls, postprocessing and materials stay in use. Composition-specific camera distance factors accommodate the different estate extents. |

## Focused implementation

`wing-composition.ts` defines rectangular wings and three deterministic, hand-tuned compositions. It does not use a blueprint, V3 objects, a mesh authoring language, a service, or a generation pipeline.

`operateWings(wings, operation)` supports:

- `add`: insert a building wing, including a detached guest pavilion.
- `remove`: remove a wing and its dependent connecting galleries.
- `adjust`: resize width/depth; translate X/Z; rotate 0/90/180/270 degrees; choose one/two storeys; set each storey's height; adjust front veranda and upper balcony depth.
- `connect`: derive a straight, enclosed low gallery between aligned separated wing faces. It derives its location, length, height and roof. Galleries regenerate when hosts move or resize. Impossible connections and overlapping wing bodies reject atomically.

The local renderer derives façade bay count, opening sizes, piers, lintels above lower galleries, glazing, roof dimensions, eaves, soffits, floors, ceiling slabs, upper balconies, veranda spans, interior furnishings and repeated screens. Shared contact spans are removed from both host and gallery walls. Two-storey wings have an interior stair with an actual slab opening and upper guards. Small residual façade segments become solid piers rather than invalid narrow windows.

Low flat-roof galleries enter below the pitched eaves or floating main slabs. This avoids needing arbitrary roof Boolean operations or a generalized hip-roof intersection system. Main-wing roof spans remain independent. Front veranda spans reserve gallery contacts; preset clearances account for overhangs.

`composed-villa.tsx` reuses the original kit and landscape components. Terrace rectangles, pool positions and landscape extents belong to each composition, rather than inheriting Solana's one outdoor arrangement.

Terra's schema, API route, prompts and execution path are unchanged. The Terra dock is absent while a wing study is selected. Select an existing style to return to its established customization and Terra flow.

## Limits

- These are three local authored studies, not a general architectural planner. New per-wing controls are available as typed local operations; only preset selection is exposed in the viewer.
- Rectangular wings, cardinal orientations, one/two storeys, 3–4.5 m storey heights; two-storey wings need at least 8 m local width for the compact stair. No arbitrary polygons, diagonal wings, curved volumes, split levels or terrain fitting.
- Connections require aligned faces with a clear rectangular gap. Roof intersections use lower galleries; no automatic compound pitched roofs or structural engineering.
- Validation rejects overlapping building bodies and invalid dimensions/connections. It does not solve arbitrary roof/veranda clearance, furniture layouts or landscape packing after every possible edit. Preset roof, terrace, pool and landscape clearances are tuned and visually checked. Outdoor rectangles are intentionally authored separately.
- Furnishings, stair support, landscape meshes, drainage and construction details remain architectural concept quality. Existing environment-based glass/water reflections and coarse vegetation remain.
- Camera preset checks cover exterior views. They are not a full interior walkthrough or a certification that every possible local operation yields a polished estate.

## Files changed in this task

- New `src/app/dev/villa-playground/wing-composition.ts`: wing operations, connection/contact derivation, validation and three presets.
- New `src/app/dev/villa-playground/composed-villa.tsx`: shared-component wing/grounds renderer.
- New `src/app/dev/villa-playground/wing-composition.test.ts`: geometry, connectivity, operations and isolation tests.
- `src/app/dev/villa-playground/villa-kit.tsx`: export three existing builders; existing behavior retained.
- `src/app/dev/villa-playground/scene.tsx`: optional composition rendering and camera distances.
- `src/app/dev/villa-playground/viewer.tsx`: local preset selection, correct study labels, isolation from Terra.
- `src/app/dev/villa-playground/page.tsx`: async searchParams for direct preset routes, following installed Next.js documentation.
- `src/app/dev/villa-playground/villa.module.css`: study selector and local-study notice layout.
- New `scripts/villa-compositions-capture.mjs`: actual WebGL capture, mounted geometry/camera assertions and AI-request monitoring.
- New `scripts/villa-compositions-regression.mjs`: local preset/style/customization and storage-isolation checks.
- This report, README entry and `compositions/` screenshot/verification artifacts.

No dependency changes, migrations, deployment, commits, external AI services or live OpenAI calls are part of this work. Existing unrelated working-tree changes were preserved.

## Validation and actual screenshots

- `npm run typecheck`: passed.
- Focused ESLint on all seven changed application TypeScript/TSX files: passed.
- `npx vitest run src/app/dev/villa-playground/wing-composition.test.ts src/app/dev/villa-playground/villa-model.test.ts src/lib/villa --maxWorkers=1`: **20 tests passed**.
- Actual Chromium/R3F captures: Poolside, Arrival, Garden and Above for each of the three compositions. Mounted scene and settled camera positions are asserted before each screenshot. [Browser evidence](compositions/browser-checks.json) records the mounted geometry and camera coordinates. Zero uncaught browser errors and zero AI requests.
- [Browser regression checks](compositions/regression-checks.json): original Solana still mounts; all three study buttons work; Terra is hidden for wing studies; all four original styles mount and their levels, exterior and pool-toggle controls work. Project-storage sentinel remains unchanged. Zero uncaught browser errors and zero AI requests. Existing style verification images remain in `styles/`; the new regression captures are separate `compositions/preserved-*.jpg` files.
- Visual inspection covered the front court, opposite oblique view, rear façades and elevated footprint of each estate. The lower galleries sit below the main roof systems; façades close at their connections; the compact L, axial U and dispersed pavilion footprints are visibly distinct. Veranda widths and pool approaches were refined after viewing the initial renders. No obvious exposed interior gaps or intersecting main building masses were seen in these exterior views.
- Initial capture attempts encountered an unresponsive pre-existing dev server and incomplete asynchronous vegetation loading. The server was restarted and the captures repeated. Final study captures wait for loaded planting as well as mounted buildings. Existing Three.js Clock and soft-shadow deprecation warnings remain; the global asset-library endpoint can time out independently of these static local scenes.

| Composition | Poolside | Arrival | Rear garden | Elevated footprint |
| --- | --- | --- | --- | --- |
| Compact tropical L | [Screenshot](compositions/compact-l-poolside.jpg) | [Screenshot](compositions/compact-l-arrival.jpg) | [Screenshot](compositions/compact-l-garden.jpg) | [Screenshot](compositions/compact-l-above.jpg) |
| Grand courtyard U | [Screenshot](compositions/courtyard-u-poolside.jpg) | [Screenshot](compositions/courtyard-u-arrival.jpg) | [Screenshot](compositions/courtyard-u-garden.jpg) | [Screenshot](compositions/courtyard-u-above.jpg) |
| Contemporary pavilion estate | [Screenshot](compositions/pavilion-estate-poolside.jpg) | [Screenshot](compositions/pavilion-estate-arrival.jpg) | [Screenshot](compositions/pavilion-estate-garden.jpg) | [Screenshot](compositions/pavilion-estate-above.jpg) |

Reproduce with `node scripts/villa-compositions-capture.mjs` and `node scripts/villa-compositions-regression.mjs`. Both use the existing local Playwright/Chromium installation; environment overrides are `VILLA_URL`, `PLAYWRIGHT_MODULE`, and `CHROMIUM_EXECUTABLE`. `COMPOSITION=compact-l` (or another preset ID) captures just that study and preserves the other study records. These are local UI checks and do not need API credentials.
