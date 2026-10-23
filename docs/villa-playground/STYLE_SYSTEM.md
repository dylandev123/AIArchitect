# Solana Collection — implementation and visual review

Development route: `/dev/villa-playground`. Original Solana remains the initial selection. No deployment, commit, migration, new agent, V3 compiler, blueprint, project-store or production generation route change.

## 1. Reusable techniques discovered

See [the source audit](REVERSE_ENGINEERING.md) for metre dimensions, source files, composition, openings, materials, pool construction and hardcoded arrangements. The key techniques are real negative space behind glazing, roof/soffit/fascia layers, deep shadows, furnished interiors, repeated timber screens, restrained PBR finishes and a coordinated pool/terrace/garden foreground. Existing lighting, environment, water, palms, shrubs, furniture, camera and postprocessing are reused.

## 2. Components implemented

`villa-kit.tsx` adds dimensioned connected bays; pierced facades with coordinated piers, sills, glazing, shutters and doors; real extruded semicircular arch spandrels; covered verandas and masonry loggias; closed hip/gable roof planes with PBR metal or terracotta slopes, eaves, ridge and gable infill; upper balconies/guards and a derived exterior stair/landing. It reuses Solana's finished boxes, glazing, flat roof layers, instanced slats and sofas. The existing stone PBR set supplies actual stone detail for the new masonry walls.

`design-grounds.tsx` coordinates terrace strips and decks around the resized pool opening. The original pool component now accepts dimensions with its original defaults; basin, water, shelf, steps, coping, spill wall and channel derive together. Existing palms and vegetation provide tropical and Mediterranean garden choices. Solana's original rooftop planting is deliberately kept with Solana rather than copied into unsupported locations on new villas.

## 3. Supported vocabulary and variations

| Style | Composition rules | Roof families | Distinguishing architecture |
| --- | --- | --- | --- |
| Modern Contemporary | Stepped, garden L | Flat | Interconnected unequal-height glazed bays, floating roof slabs, stone blade, timber screens, recessed glass balcony |
| Caribbean Tropical | Pavilions, courtyard | Hip, gable | Broad metal roofs, deep eaves, shaded timber verandas, louvred shutters, light posts |
| Spanish Hacienda | Courtyard, garden L | Hip, gable | Stucco, tiled roofs, real masonry arcades, U-shaped open patio with ornamental basin, narrower divided windows |
| Tuscan Estate | Garden L, courtyard, stepped | Gable, hip | Stone PBR walls, loggias, pitched tile roofs, traditional window rhythm and proportions |

These are arrangements of the same bays and compatible families, not four separately authored house meshes. Ground-floor bay connections derive from dimensions. One/two levels, scale .85–1.05, wing ratio .85–1.1, four finishes, two glazing variants, veranda and terrace depth 1.6–2.8 m, rectangular pool length 10–18 m / width 4–6.4 m, pool on/off and two landscape palettes are supported. Geometry sizes and camera/lighting remain local. Scale is deliberately bounded to keep the building, verandas, deck and pool coordinated.

## 4. Actual visual review

The deterministic designs were built and visually inspected before the Terra files/endpoint were created. Initial browser review found an outward stair landing, overly large traditional windows, simple placeholder trees and a lack of modern facade depth. These were corrected before connecting AI. A later live-scale view exposed a planter encroaching into a veranda; it was moved outside the maximum building envelope.

| Style | Poolside | Arrival | Garden | Above | Golden hour |
| --- | --- | --- | --- | --- | --- |
| Modern | [image](styles/modern-poolside.jpg) | [image](styles/modern-arrival.jpg) | [image](styles/modern-garden.jpg) | [image](styles/modern-above.jpg) | [image](styles/modern-golden.jpg) |
| Caribbean | [image](styles/caribbean-poolside.jpg) | [image](styles/caribbean-arrival.jpg) | [image](styles/caribbean-garden.jpg) | [image](styles/caribbean-above.jpg) | [image](styles/caribbean-golden.jpg) |
| Spanish | [image](styles/spanish-poolside.jpg) | [image](styles/spanish-arrival.jpg) | [image](styles/spanish-garden.jpg) | [image](styles/spanish-above.jpg) | [image](styles/spanish-golden.jpg) |
| Tuscan | [image](styles/tuscan-poolside.jpg) | [image](styles/tuscan-arrival.jpg) | [image](styles/tuscan-garden.jpg) | [image](styles/tuscan-above.jpg) | [image](styles/tuscan-golden.jpg) |

The modern design reads as a stepped pavilion residence; Caribbean reads through its broad hipped silhouettes, shaded verandas and shutters; Spanish exposes its courtyard and semicircular arcades; Tuscan has a long gabled hall, projecting wing and stacked stone loggias. Garden views verify complete rear elevations and upper stair access. Solana remains more individually detailed at its entrance and interiors; these compact families reuse its visual techniques rather than reproducing every bespoke detail.

Five additional one-level renders exercise alternate arrangements: modern garden L, Caribbean courtyard, Spanish garden L, Tuscan courtyard and Tuscan stepped. See `styles/*-one-level.jpg`, `manual-customization.jpg`, `mobile.jpg` and the machine-readable browser check files. Screenshots are actual browser WebGL output, without image generation or image editing.

## 5. Terra generation and customization

`/api/ai/villa` is a separate development-only endpoint using the existing `getAiModel()` / `gpt-5.6-terra` policy and usage logging. One `generateText` invocation, structured output, `maxRetries: 0`, no tools, no repair calls, no mesh/blueprint generation. A complete validated configuration is required for generation. Edits return only requested fields. Strict local Zod validation rejects unknown fields, out-of-range dimensions and incompatible roofs/layouts.

`executeVillaPatch` is the shared local executor for sliders/selects and AI changes. Nested pool fields merge instead of replacing the pool. A style change only adapts incompatible roof/composition choices; unrelated selections remain. React memo boundaries keep the actual building geometry instances intact when only the pool changes. The converse grounds boundary avoids rebuilding the garden for a facade finish change. Inputs disable during an AI request, preventing duplicate submissions and stale manual overwrites; camera controls remain usable. Failed requests preserve the current design.

The prompt selects ambition/proportions from a budget; it does not calculate a property price. Unsupported requests are returned visibly in `unsupported`. The official [OpenAI structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs) was checked, along with the installed AI SDK and Next.js docs. The existing model and credentials were reused with user authorization; no key was printed or rewritten.

### Real provider verification

Two live browser requests completed successfully with `gpt-5.6-terra`:

1. The user's $8 million Spanish courtyard prompt returned scale 1.04, wing ratio 1.08, two levels, sand stucco, hip/tile roofs, divided glazing, 2.7 m veranda, 2.6 m terrace and a 17.2 × 6.1 m pool. One provider call, HTTP 200; actual mounted scene captured in `live-spanish-poolside.jpg` / `live-spanish-above.jpg`.
2. After a manual limestone-wall change, “change only the swimming pool” returned only `{pool:{width:12,depth:4.6}}`. One provider call, HTTP 200. Every unrelated config field, including the manual finish, was preserved. See `live-edit.json`, `live-spanish-edited.jpg` and `live-checks.json`.

The raw validated outputs and usage counts are retained in `styles/live-generation.json` and `styles/live-edit.json`. These were real calls, not intercepted responses. There were no browser JavaScript errors, and a saved-project localStorage sentinel remained unchanged.

## 6. Validation

- `npm run typecheck`: passed (installed Next.js `next typegen`, then TypeScript).
- Focused ESLint across playground, villa config, endpoint/tests and capture scripts: passed.
- 83 tests passed across seven files: villa configuration (14), endpoint (13), original model (2), GLB models (8), model cache (4), V3 scene (6) and architectural blueprint regressions (36).
- Configuration tests exercise every supported composition at both scale/wing extrema and both level counts, assert a connected bay graph and veranda/pool clearance, reject unsupported fields/options, and verify deep edits preserve unrelated fields.
- Endpoint tests cover exactly one provider call, zero retries/tools, full config validation, targeted edits, unsupported-feature reporting, invalid/truncated output, provider failures, missing credentials and development-only gating.
- Actual browser evidence covers all style/view/mood renders, five additional arrangements, manual controls, retained building geometry during pool resize, pool removal/restoration, orbit/pan/zoom, failed-edit preservation, duplicate-submission disabling and mobile overflow.
- Existing Three.js Clock / PCFSoftShadowMap deprecation notices remain in shared infrastructure. They are warnings, not browser JavaScript errors; this task does not rewrite that infrastructure.

## Remaining limitations

This is a visual home-design playground. It does not offer arbitrary footprints, freeform/circular pools, domes/turrets, garages, detached guest houses, more than two levels, room planning, structural engineering, custom roof intersections/drainage or construction-cost estimation. Pitched roofs are coordinated pavilion assemblies, not a general roof-union/valley solver. Courtyards are U-shaped and open toward the pool rather than fully enclosed cloisters. Simplified stairs, guards and furnishings are conceptual. Adjacent bays are composed geometrically; this does not promise a professionally resolved interior circulation plan.

Pool water and glass use approximate environment reflections. Roof tiles use the existing PBR covering rather than individually modelled tiles. New designs have fewer bespoke interior details than Solana. No panorama or unrestricted terrain context is added. Mobile layout is checked, but mobile hardware GPU performance is not benchmarked. No save/export/history system is added; designs live in local React state and reset on reload. Natural-language refinement works against the current configuration rather than retaining a full conversation transcript.

## Reproduce

Start `npm run dev -- --hostname 127.0.0.1 --port 3107`. Capture deterministic designs with `node scripts/villa-styles-capture.mjs`; test local controls with `node scripts/villa-controls-check.mjs`. Set `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` for your installed browser. `node scripts/villa-terra-check.mjs --live` deliberately makes two paid requests (one generation and one edit); do not use it for routine offline verification.
