# Creative freedom and estate-scale construction

Implemented locally on 23 October 2026. Terra now authors a property composition appropriate to its brief through the existing validated component executor. It is not restricted to the three local wing studies. The examples below are deterministic, hand-authored provider-shaped fixtures, replayed through the actual browser submit handler; they are not outputs of a live model call.

## What Terra controls

- The original footprint and hierarchy: one main residence, connected subordinate wings, detached guest buildings, aligned galleries, and one/two-storey height changes. There is no required wing or component count.
- Building placement across x/z = −200…200 m, replacing the compact ±30 m domain. Cardinal orientation, wing proportions, veranda depth, recessed balconies and compatible building heights remain authored parameters.
- Optional pool placement and dimensions: 8–32 m east-west by 4–12 m north-south, using the same basin, sun shelf, steps, coping, spill channel and water renderer.
- Terraces, open courtyards, arrival courts, promenades and outdoor rooms: original rectangles up to 256 m per side, split around pool water. Tropical or Mediterranean planting and shared architectural finishes remain available.
- Fictional grounds: the full union of roof/veranda envelopes, derived galleries, terraces, pool furniture and approved component approaches, plus a chosen 2–30 m planting/circulation margin. Changing the architecture recomputes the site without shrinking or dropping components. Garden centres/dimensions are derived; an arbitrary model garden hint cannot cause a fictional-site failure. The entire supported placement domain fits the expanded garden schema (12–1024 m, centre ±256 m).
- An optional version-pinned `curved-pavilion@1` open elliptical garden lounge, selected when appropriate. The Caribbean example uses one; the family and Tuscan examples use none. Stable component IDs support put, scoped adjust and remove operations in the same atomic editing executor as wings.

Terra's instructions now explicitly relate architecture to style, landscape, ambition, views and requested scale. They encourage distinct building hierarchies, proportions, orientations, roofline rhythms, attached/detached volumes and arrival sequences. Budgets indicate ambition, not verified construction costs. Modest briefs are not forced into estates.

## Pavilion approval and construction boundaries

The existing versioned descriptor now lives in `src/lib/villa/component-registry.ts`; `experimental/catalog.ts` retains a compatibility export for the original studies. Its lifecycle is **approved** and validation remains **passed**, supported by the previous finite-geometry/yaw/browser evidence and the new SDK, executor and estate browser checks. Approved retrieval requires both states. Placement pins the exact builder version; unknown versions, extra geometry fields and executable code fail validation. The original wing studies remain available.

The pavilion reuses the existing ellipse/annular extrusion builder, curved glass, masonry, timber soffit, bench, furniture and PrimitiveMesh materials. Its shape was not replaced or approximated with rectangular wings. Width remains 6–10 m, depth 5–8 m, shell height 3–4.2 m, yaw 0–359°, ivory or limestone shell. It is a detached, single-storey open lounge, without an enclosed thermal shell or automatic gallery attachments. The validator includes the exact rotated elliptical roof AABB and a conservative 2.4 m wide × 2.4 m outward pedestrian approach; blocked approaches reject the candidate.

Construction remains deliberately bounded:

| Capability | Current bound |
| --- | --- |
| Building wings | 1–8, rectangular, 4–32 m per local side |
| Heights | 1 or 2 storeys, 3–4.5 m per storey; stair width requirements retained |
| Orientation | Cardinal for wings; continuous yaw only for the approved pavilion |
| Galleries | Up to 8, straight and aligned, 1.2–5 m wide, spans up to 32 m |
| Outdoor surfaces | Up to 16 rectangular terraces/courtyards |
| Approved additional forms | Up to 4 elliptical lounge placements |
| Roof/style system | Existing modern flat, Caribbean hip/gable, Spanish and Tuscan hip/gable; shared roof/finish style across wings |
| Pool | One optional rectangle, 8–32 × 4–12 m |
| Site | Rectangle; authoritative fixed sites are never expanded |

Arbitrary meshes/code, domes, turrets, curved enclosed residences, diagonal building wings, freeform pools, per-wing roof systems, additional floors, detailed room plans, terrain/coastline construction and exact pricing remain unavailable. Unsupported requests must describe the missing reusable builder/roof/connection capability in `unsupported`, with an honest summary. Unsupported-only edits preserve the current property. Unknown component versions produce an explicit missing-capability diagnostic rather than fallback geometry.

Explicit request `site` data overrides contrary model output on both server and client. Fixed and legacy sites retain strict containment. A garden edit deliberately establishes a fixed boundary. For dimensions written only in prose, Terra is instructed to encode the exact lot as fixed; interpreting prose still depends on the model. Use the existing **Fixed site** fields when a lot must be authoritative independently of model interpretation.

## Deterministic visual evaluation

All configurations pass through `resolveVillaResult`, `validateComposition` and `buildComposition`. Floor area below is gross rectangular wing floor area, excluding galleries, verandas and terraces; it is not a floor-plan or cost certification.

| Example | Composition | Gross wing floor area | Derived grounds | Pool |
| --- | --- | ---: | --- | --- |
| Breeze Family Villa | One single-storey tropical house and shaded veranda | 104 m² | 22.15 × 29.35 m | 8 × 4 m |
| Caribbean Grande Estate | Five wings, two galleries, two detached retreats, stepped two-storey hierarchy and one elliptical lounge | 1,332 m² | 96.30 × 84.50 m | 28 × 8 m |
| Tenuta Belvedere | Five wings, two galleries, inward-facing loggias around an open court, detached arrival lodge and casita | 1,072 m² | 72.80 × 95.15 m | 18 × 6 m |

The Caribbean residence has nearly thirteen times the family home's gross wing floor area and more than twelve times its site area. Its broad, offset composition differs from the Tuscan estate's deep axis, inward-facing court, gabled rooflines and rear arrival lodge. These are different placements, dimensions, orientations and building hierarchies, not material swaps. Their fixtures are evaluation examples only; Terra receives no requirement to reproduce them.

Actual Chromium WebGL screenshots were captured and inspected from Poolside, Arrival, Garden (reverse) and Above for each property, plus an elliptical-lounge close view. The screenshots retain the real application UI. Cameras, orbit limits, fog distance and ground coverage adapt to site size; the original Solana environment and architectural builders remain available. Larger authored grounds use the existing grass finish instead of extending the old bare base treatment.

| Example | Browser screenshots |
| --- | --- |
| Family villa | [Poolside](family-breeze-poolside.png) · [Arrival](family-breeze-arrival.png) · [Reverse](family-breeze-garden.png) · [Above](family-breeze-above.png) |
| Caribbean estate | [Poolside](caribbean-grande-poolside.png) · [Arrival](caribbean-grande-arrival.png) · [Reverse](caribbean-grande-garden.png) · [Above](caribbean-grande-above.png) · [Pavilion](caribbean-grande-pavilion.png) |
| Tuscan estate | [Poolside](tuscan-belvedere-poolside.png) · [Arrival](tuscan-belvedere-arrival.png) · [Reverse](tuscan-belvedere-garden.png) · [Above](tuscan-belvedere-above.png) |
| Reliability | [Rejected edit preserves estate](failed-edit-preserves-estate.png) · [Original Solana preserved](solana-preserved.png) |

Visual review confirms separate roofs and low galleries, unobstructed pool openings, differentiated upper/lower volumes, open loggias and court, detached structures and a genuinely elliptical pavilion. This is the existing real-time concept renderer: vegetation and furniture remain simplified, glazing uses environment reflections, and the flat context does not render the requested Caribbean coastline. Large lawns and facade detailing remain procedural; this work does not establish photorealism or a fully designed interior. Some context trees obscure parts of low camera views; the overhead and reverse captures expose the full compositions.

## Reliability and verification

The executor still clones the current design, applies scoped operations, and validates the final candidate atomically. Unaffected wings, connections, terraces, pool and finishes remain unchanged in a component-only edit. Failed server responses and locally rejected successful-looking responses leave the existing property mounted. Geometry, roof/veranda separation, gallery host heights, pool furniture, water openings, open courtyards, hierarchy and fixed-site containment checks remain active. A derived site cannot excuse a collision.

The development route retains returned provider text before SDK parsing, with secret redaction and owner-only files in `.data/villa-responses/<responseId>.response.json`. Offline tests exercise malformed/truncated responses, unsupported versions, schema failures and locally rejected geometry. No automatic repair generation was introduced; the route remains one provider call with zero retries. A transport failure with no returned text has no provider response to retain.

Validation completed:

- 101 focused Villa Playground/library/route tests passed, including four added real-SDK tests for the three creative fixtures and an unavailable builder version. All model providers in these tests are mocks; network fetch is forbidden in the SDK replay suite.
- 18 existing V3 scene and project persistence tests passed, with one worker and a 30 s test timeout. V3 authoring, store, persistence and rendering source were not changed by this task.
- `npm run typecheck` passed; scoped ESLint passed.
- Browser evidence checks mounted building/gallery counts, exact component placements, finite mesh positions, existing style controls, original Solana restoration, component-only editing and rejection preservation. All AI endpoints are intercepted or blocked; no live OpenAI calls were made.

Machine-readable evidence: [geometry checks](geometry-checks.json), [offline responses](offline-responses.json), and [browser checks](browser-checks.json). The first capture attempt completed the property views but reached an asynchronous scene transition before the legacy style was mounted; the capture harness was corrected to wait for the expected scene group and local vegetation assets before recording evidence.

Reproduce offline with the local dev server running:

```sh
npx vite-node --config vitest.config.mts scripts/villa-creative-evidence.ts
node scripts/villa-creative-capture.mjs
```

The capture supports `VILLA_URL`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE`, matching existing playground tooling. It intercepts the Villa API locally and blocks other AI routes. The three editable examples can also be opened directly at `/dev/villa-playground?composition=family-breeze`, `?composition=caribbean-grande`, or `?composition=tuscan-belvedere`; the Family villa, Caribbean estate and Tuscan estate buttons select them without provider calls.

## One authorized live generation

No live generation was performed in this task. When authorized to perform one live generation with the existing provider configuration:

1. Open `http://localhost:3000/dev/villa-playground` and select **New design**.
2. Leave **Fixed site** unchecked for the fictional estate.
3. Enter: **Design an extraordinary $15 million luxury estate overlooking the Caribbean Sea.**
4. Click **Generate villa** once. The request goes to `/api/ai/villa`; no automatic retry or second repair call occurs. Orbit and inspect all four camera views after acceptance. If rejected, the current property remains visible and any returned provider response is retained for offline debugging.

No agents, blueprint-generation changes, major rewrites, migrations, deployments or commits were made. Existing unrelated working-tree changes were preserved.
