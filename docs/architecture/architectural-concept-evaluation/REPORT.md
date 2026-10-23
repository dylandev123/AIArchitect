# Isolated architectural concept evaluation — 22 October 2026

Implemented a prompt → Terra → validated V3 massing → interactive preview experiment. It is available only when **both** `NODE_ENV=development` and `AI_V3_CONCEPT_EVALUATION=1`. No existing production or 2D implementation files were changed by this work. No migrations, key changes, commits or deployment were performed.

## 1. Files added

| Files | Purpose |
| --- | --- |
| `src/lib/v3/architecturalConcept.ts` | Compact authoring schema, architectural prompt, deterministic conversion, concept-specific geometry acceptance and envelope preservation signature. |
| `src/app/api/ai/concept/route.ts` | Gated, one-call generation endpoint using the existing Terra integration and usage tracking. |
| `src/app/dev/architectural-concept/page.tsx`, `viewer.tsx` | Gated page, prompt, generate action, V3 preview, errors and architectural rationale. |
| `src/lib/v3/__tests__/architecturalConcept.test.ts`, `fixtures/conceptExamples.ts` | Geometry, zero-room, roof-preservation and rejection cases; explicitly hand-authored examples. |
| `src/app/api/ai/concept/route.test.ts` | Real SDK/adapter/usage logger with intercepted provider transport and usage storage. |
| `scripts/architectural-concept-evidence.ts`, `architectural-concept-capture.mjs` | Reproducible offline geometry and WebGL evidence. |
| This directory | Report, fixture scenes, browser checks, six geometry screenshots, validation-error screenshot, actual live response and usage evidence. |

The workspace already contained extensive unrelated uncommitted changes. Those were retained. All evaluator implementation files are additions; no shared generation, saved-project or renderer behavior was edited.

## 2. Generation and preservation flow

1. The page accepts only an architectural brief. The endpoint rejects project JSON, project IDs, route actions and other extra request fields.
2. One call uses `getAiModel()`, `getAiModelId()`, `AI_PROVIDER_OPTIONS` and `withUsageLogging()` unchanged. Authentication remains in the existing provider integration. Usage has `stage:v3-concept-evaluation`, `projectId:null`, and the existing `v3-scene` generation mode. There is no model-selection override specific to this experiment.
3. Terra returns composition, design character, assumptions, building envelopes, footprint articulations or line/arc outlines, positions, yaw, plinth elevations, bottom-up storey heights, roofs, connected wings and outdoor spaces. The prompt scales ambition to the brief and has no required luxury amenities or room programme.
4. The temporary authoring document is lowered directly into a `V3Scene`. Named `architecture` owns envelopes, `composition.footprint` owns shapes, mass roof fields own roof intent, and existing semantic storeys own floor datums. `interior.rooms` is empty. Explicit empty openings prevent the production facade preset from inventing windows.
5. Concept validation checks schema/dimensions/identities, real rotated footprints and site placement, outdoor-space conflicts, supported footprint roofs, curved intersections, actual mass junction restrictions, finite compiled geometry, roof construction and compiled site bounds including eaves. Footprint preflight occurs before the compiler can use its legacy rectangular fallback. Rejected results return findings and no scene. Explicit unsupported requests can return `unsupportedFeatures`, which is rejected without a substitute preview.
6. The client uses `compileV3Scene`, the existing `PrimitiveMesh`, existing presentation bounds, R3F Canvas and OrbitControls. It renders V3 walls/slabs/roof meshes with neutral colors and simple lighting. It keeps only React state; there is no project store import, save, localStorage write, project API write or database design write.

Construction-readiness, room adjacency, access-route, detailed-opening, circulation and completeness reviews do not run on this stage. Their absence cannot become an unresolved concept error. Production validation remains unchanged.

`conceptEnvelopeSignature(scene)` derives a preservation boundary from the accepted V3 authority: site, building geometry/footprints, roof form/pitch/eaves, supports, geometry-related hierarchy, storeys and relationships. A future room-development operation can compare the approved signature with its candidate. Tests show room additions leave the signature and compiled roof geometry unchanged, whereas roof edits change the signature. This is a preservation seam only: no room-development transition or persistent approval workflow is implemented.

## 3. Geometry demonstrated

| Composition | Provenance | V3 mesh count | Result |
| --- | --- | ---: | --- |
| Two-storey U-shaped courtyard with unequal storey heights and floating roof | Hand-authored fixture | 60 | Pass |
| L-shaped notch with polygonal mono-pitch roof | Hand-authored fixture | 13 | Pass |
| Rotated hip-roof pavilion plus circular studio with floating roof | Hand-authored fixture | 22 | Pass |
| Connected rectangular wings with stepped gable/mono-pitch roofs | Hand-authored fixture | 30 | Pass |
| Modest 8 × 6 m gable-roof house | Hand-authored fixture | 11 | Pass |
| Compact U-shaped writer's home, matching flat roof, court, garden and arrival surface | **One live Terra response** | 25 | Pass |

The browser checks confirm mounted roof meshes, interactive orbit/pan/zoom, no JavaScript page errors, visible rejection findings, clearing the preview on rejection, and byte-identical saved-project browser storage. A further unit test accepts a separate pavilion inside a concave courtyard void without treating empty bounding-box overlap as a physical junction.

Screenshots: [live Terra result](live-result.png), [courtyard](courtyard.png), [L-shaped](l-shaped.png), [pavilions](pavilions.png), [connected wings](connected-wings.png), [modest home](modest.png), [rejection](validation-error.png). The final live screenshot is a replay of the same retained response after the UI layout fix; it made no second provider call.

## 4. Tests and evidence

- `npx tsc --noEmit`: pass.
- ESLint on all added implementation, tests and scripts: pass.
- New focused tests: **29 pass** (21 concept/conversion/geometry/preservation cases; 8 endpoint/integration cases).
- Relevant existing tests: **203 distinct cases pass across the runs**, covering the three 2D route suites, plan client, production V3 and architectural-blueprint API suites, saved blueprint/draft/view persistence, project storage, nonrectangular geometry and junctions.
- The first broad regression run was **172 pass / 31 fail**. Thirty existing 2D route cases failed at their setup's browser-storage write because `window` was absent, before reaching route logic. Those same 30 pass with a temporary in-memory `window.localStorage` harness outside the repository. No production storage code or existing test file was edited. One client save/undo/reload case exceeded the default five-second timeout under parallel load; all eight client cases pass when run alone with a 20-second test timeout.
- Offline endpoint tests retain the production SDK, OpenAI adapter, model factory and usage wrapper. Only provider transport and usage storage are intercepted. They verify actual developer/user request serialization, JSON mode, existing model overrides, token accounting, no retry, disabled production access, validation rejection, quota failures and incomplete output rejection.
- Static fixture and browser tests make **zero live provider calls**. They demonstrate engine capability, not Terra authorship or aesthetic judgment.

One real UI generation used `gpt-5.6-terra`, returned HTTP 200, produced zero rooms and zero findings, and used **2,079 input / 1,438 output tokens**. The application's existing pricing table estimated **$0.021414**; this is an application estimate, not a verified bill. The existing usage store was queried separately to confirm the recorded stage and token counts: [live response](live-response.json), [usage record](live-usage.json). The budget is 8,000 output tokens, one provider call, no automatic retries/repair and a 270-second request timeout.

Machine evidence: [browser checks](browser-checks.json), [offline inputs and V3 scenes](fixtures.json), [check summary](checks.json).

The selected existing regression files were:

```text
src/app/api/ai/plan/route.test.ts
src/app/api/ai/plan/route.roomPlanning.test.ts
src/app/api/ai/plan/route.architecturalIntelligence.test.ts
src/app/api/ai/house/__tests__/route.v3.test.ts
src/app/api/ai/house/__tests__/route.architecturalBlueprint.test.ts
src/store/__tests__/v3ArchitecturalBlueprintPersistence.test.ts
src/store/__tests__/v3ArchitecturalDraftPersistence.test.ts
src/store/__tests__/architecturalWorkspaceView.test.ts
src/lib/ai/__tests__/planClient.test.ts
src/lib/storage/__tests__/projectStorage.test.ts
src/lib/v3/__tests__/nonrectangular.test.ts
src/lib/v3/__tests__/junctions.test.ts
```

## 5. Unsupported features

- Domes, cones, freeform shells and other roof families outside V3's supported forms.
- Hip/gable/butterfly roofs on nonrectangular or curved footprints.
- Skew, curved or articulated Boolean mass junctions; three mutually meeting roofs; ambiguous nearly equal connected roof datums; claimed connections between detached masses.
- Footprint holes, self-intersections and invalid overhang outlines. Courtyards use recesses or spatial arrangement instead.
- Advanced terrain, hillside levels, stacked/cantilevered buildings and elevated outdoor decks in this initial scoped contract. Building bases are limited to 0–0.6 m plinths; storey heights may differ within each mass.
- Arbitrarily shaped outdoor surfaces; these are rectangular ground-level concept reservations.

## 6. Known limitations

One successful live response proves the end-to-end path works; it does not establish consistent architectural quality across briefs. Creative quality, narrative accuracy, climate, budget and code compliance are not independently judged. The live response assumes approach from the south while placing its labelled arrival forecourt north of the building: that is an architectural review issue, not a geometry validation failure. There are no constructed access routes in this stage.

V3 still supplies its usual derived slabs, roof details and junction/eave treatment; this is its actual compiled architecture rather than a new simplified renderer. Roof preservation currently concerns that unchanged semantic envelope and its deterministic compilation. There is no separate structural feasibility analysis, construction-ready approval, room development, editing, autosave or project import. Reloading the evaluator discards the preview. Provider failures do not automatically spend another call. No production build, deployment or commit was performed.

## 7. Run and visually evaluate

From the repository root, stop your currently running development server if it is serving this same checkout, then start it with the opt-in flag:

```bash
AI_V3_CONCEPT_EVALUATION=1 npm run dev
```

Leave the existing key, provider configuration, model selection and usage settings as they are. Open **http://localhost:3000/dev/architectural-concept**. Enter a brief and click **Generate 3D Concept**. Drag to orbit, right-drag to pan and scroll to zoom. Review the massing and roof together with the design decisions, assumptions and building metadata beneath the viewport. Rejection findings appear above the empty preview. Generating again replaces only the temporary preview.

Example briefs:

- “A compact home for a writer around a sheltered outdoor reading court; no pool or guest house.”
- “A small cultural retreat with separate pavilions and one circular gathering space. Compose arrival and outdoor gathering thoughtfully.”
- “A two-storey family home with connected public and private wings, a clear height hierarchy and sheltered garden terraces.”

The diagnostic endpoint **http://localhost:3000/api/ai/concept** reports the selected model and call budget when enabled. In production, or with the flag absent, the page is unavailable and the API returns 403. The flag does not change the existing 2D or full-property routes.

Focused verification:

```bash
npx tsc --noEmit
npx vitest run src/lib/v3/__tests__/architecturalConcept.test.ts src/app/api/ai/concept/route.test.ts --maxWorkers=1
npx vite-node --config vitest.config.mts scripts/architectural-concept-evidence.ts
```

For offline browser captures, start the flagged dev server, then run the following with an installed Playwright module and Chromium/Chrome executable. The capture script intercepts concept responses and spends no provider calls:

```bash
CONCEPT_URL=http://localhost:3000 \
PLAYWRIGHT_MODULE=/path/to/playwright-core \
CHROMIUM_EXECUTABLE=/path/to/chrome \
node scripts/architectural-concept-capture.mjs
```
