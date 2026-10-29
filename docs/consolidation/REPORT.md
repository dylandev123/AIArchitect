# AI Architect consolidation audit and implementation

**Historical audit:** see [the final audit](final-audit/REPORT.md) for the current integration status, additional changes and refreshed evidence.

This change establishes a shared primary direct-scene workflow and preserves the older engines explicitly. It does **not** make every experimental geometry builder available to the direct-scene model. The limitations below are material: this is a verified routing, persistence and construction consolidation, not proof of universal feature parity.

No live OpenAI calls, saved-project migration, commit or deployment was performed. Existing uncommitted work was preserved. Tests use mocked model calls and deterministic fixtures. Browser proof uses a separate temporary Chrome profile and intercepts all AI POST requests.

## Before and after

| Responsibility | Before | After |
|---|---|---|
| Home Generate | `app/page.tsx` creates V2 by default; experimental checkbox creates V3 | Creates `direct-scene` by default, verifies persisted mode, opens ordinary `/workspace/:id`; V3 remains explicit opt-in |
| Main generation/edit | `ChatPanel` → staged V2 generation or `/api/ai/house` with V2/V3 authority | Direct projects → shared `OperationStudio` → `/api/ai/scene` for generation and edits; existing V2/V3 projects retain `ChatPanel` |
| Normal Villa Playground | Composition/configuration `viewer.tsx` → `/api/ai/villa` | Shared direct studio by default; `?scene=legacy`, composition/response/offline URLs retain the composition viewer |
| Casa Ladera | Dev-only scene route and isolated browser record | Same scene contract, executor and renderer available in normal projects; old local record still supported in playground |
| Direct HTTP handler | `/api/ai/villa/scene`, development only | `/api/ai/scene`, available in production; old URL reexports exactly the same handler |
| Direct editor/renderer | Files owned by development route | `components/scene/OperationStudio.tsx`, `OperationScene.tsx`; development files are compatibility exports |
| Architectural parts | Villa-owned FinishBox, glazing, roof fascia, slats, entrance detailing | Shared `components/scene/architecture.tsx`, reused by original villa imports through reexport |
| Grounds/palms | Villa-owned implementation | Shared grounds and tropical-palm implementations; original imports preserved |
| Pitched direct roofs | Unsupported | Gable/hip adapters reuse `lib/house/roof/gableRoof.ts` and `hipRoof.ts` with existing `PrimitiveMesh` renderer |
| Scene persistence | `terra-direct-scene-1`, in-memory undo | Normal project JSON, append-only versions, persistent undo/redo cursor; playground record remains separate |
| Response recovery | Legacy V3 failure slots; villa response/request archives | Existing archives preserved; new development scene responses retained under `.data/scene-responses`, including rejected/incomplete outputs |

Primary path:

```text
Home brief → persisted direct-scene Project → /workspace/:id
  → shared OperationStudio
  → POST /api/ai/scene {mode, prompt, current?}
  → existing Terra model + usage tracking, one call, zero retries
  → sceneResultSchema → resolveSceneResult → applySceneOperations
  → validateScene (including graph/opening constraints)
  → appendVersion → shared OperationScene → shared architectural parts / PrimitiveMesh
```

The root `version: "architectural-scene-1"` is the durable format authority. The project `generationMode` mirrors it. No V2 or V3 root is relabeled as a direct scene. Direct commits cannot replace their root with a legacy house. Unrelated element objects are preserved by the transaction executor; IDs are stable across edits. The client rejects application of a response when the project JSON changed while the request was in flight.

## Architecture inventory and disposition

| System | Actual implementation and role | Disposition |
|---|---|---|
| V1/site house JSON | `types/house.ts`, `lib/house/generateHouse.ts`, procedural house/roof/feature builders, workspace `PrimitiveMesh` | Retained legacy project format/rendering; roof builders and renderer reused directly |
| V2 architectural documents | `lib/architecture/document.ts`, geometry builders, stages, document/render audits; `lib/ai/stagedClient.ts` | Retained for existing projects; no longer default new home generation |
| V3 semantic scenes | `lib/v3/scene.ts`, capabilities, validation, support graph, terrain/site hierarchy, estate routes, interior/architecture compilation | Retained explicit alternative and saved-project renderer; not collapsed into rectangular elements |
| V3 blueprint/plan-first generation | `architecturalBlueprintGeneration.ts`, `architecturalBlueprint.ts`, `architecturalPlanFirst.ts`, `architecturalPlanAuthoring.ts`, room layouts and acceptance/recovery | Compatibility workflow; precise glazed-door frame contract fixed; no longer default home pipeline |
| Plan evaluation | `/api/ai/plan`, `planClient.ts`, `Design2DPlan`, plan editor | Retained separately gated evaluation; GET reports configuration, POST authors plans; no scene migration |
| Architectural concepts/images | `/api/ai/concept`, `/api/ai/concept/compact`, image/vision interpretation and retained concept artifacts | Separate analysis/concept responsibility; not an alternate direct-scene executor |
| Villa configuration/composition | `lib/villa/design.ts`, `composition.ts`, `terra.ts`, `/api/ai/villa`, `requestClient.ts`, `viewer.tsx` | Explicit compatibility viewer, request lifecycle/replay and old generation/edit contract retained |
| Villa Solana/custom architecture | `TropicalVilla` and authored parts in shared `architecture.tsx`, villa kit, custom/composed rendering | Functional comparison/legacy renderer retained, shared parts extracted; full Solana is not converted to operations |
| Footprints and curved outlines | `lib/villa/footprint.ts`, `footprint-building.tsx`, V3 footprint/curved geometry | Retained specialized geometry; arbitrary curved solids are not represented by new scene elements |
| Wings/stacks/levels | `wing-composition.ts`, `lib/villa/stacked-volumes.ts`, `stacked-building.tsx`, architectural-level renderers | Existing compositions retained; new operations have independent transforms/elevations and no wing/stack restrictions |
| Direct operations/Casa Ladera | `lib/villa/scene/{model,terra,example}.ts`, shared studio/renderer | Primary foundation, schema and executor reused rather than duplicated |
| Image-first and image fidelity | `lib/villa/image-first.ts`, `image-vision.ts`, `image-fidelity.ts`, image-first page and retained files | Separate interpretation/replay remains; offline tests and browser rendering verified |
| Reusable component registry | `lib/villa/component-registry.ts`, library UI and registered builder references | Preserved approved capabilities; direct model does not claim it can instantiate every registered builder |
| Experimental component creation | `lib/villa/creation/*`, `/api/ai/villa/create-component`, component studio | Explicit experimental/approved candidate lifecycle retained; no arbitrary executable model code added |
| Native/proxy assets and libraries | `lib/assets`, `lib/library`, outdoor support/ownership and placements, asset stores/endpoints | Retained independent asset responsibility, not merged with architecture scene generation |
| Visual review | `/api/ai/villa/visual-review`, `visual-review.ts`, review UI | Retained screenshot analysis/proposal stage; does not automatically approve/apply or run after every generation |
| Learning | `design-learning.ts`, `design-learning-store.ts`, candidate approval snapshots and lessons | Approval/provenance records preserved; no new implicit training or auto-approval |
| Rendering | Shared parts → workspace `PrimitiveMesh`, `WaterSurface`, PBR textures; `VillaScene` camera, light, environment and post effects | Rendering reused. The stage wrapper still lives in the villa route and references compatibility renderers; no second material engine |
| Persistence/recovery | Project store, compressed `projectStorage`, version cursor, recovery backups, response archives | Shared for main direct scenes; no destructive conversion, no archive deletion |

No engine was deleted merely because another exists. Compatibility export files replace duplicate entrypoint implementations. The old villa scene URL delegates rather than maintaining an independent handler. The normal playground links to its retained composition/components/review tools.

## Exact frame failure

Evidence: `original-frame-failure.json` is a copy of the retained `.v3-debug/failed-attempt-0.json` before tests ran. Its diagnostic is:

```text
PLAN_INPUT [buildings.0.accessOpenings.0]: Unrecognized key: "frame"
PLAN_INPUT [buildings.0.accessOpenings.1]: Unrecognized key: "frame"
PLAN_INPUT [buildings.0.accessOpenings.2]: Unrecognized key: "frame"
```

The model returned `v3-plan-first-1`, building `sea-villa`, with glazed doors `main-entry-door`, `living-terrace-door` and `dining-terrace-door`. All authored `frame: true`. Their `type` was `glazed-door`.

`v3GenerationCompositionSchema`, used by the parallel semantic-scene generation contract, advertises an optional boolean frame. The failing plan-first call instead uses `Output.json` with schema text produced by `v3ArchitecturalBlueprintPrompt`; its glazed-door variant did not advertise frame. The retained output proves the model supplied this extra field, but does not establish why it chose it. Runtime `v3CompositionSchema` accepted it on solid doors/glazing zones but omitted it on glazed doors. `architecturalPlanFirst` derives access-opening variants from that runtime schema; `architecturalPlanAuthoring` extends those variants. Strict validation therefore rejected the model response during **planning**, before construction. The glazed-door builder adapter also hard-coded `frame: false`.

Resolution: add only optional boolean `frame` to the glazed-door variant and pass it through `builderOpening` (`false` remains the omitted-field default). The existing builder renders the authored surround; glazed leaves still use their existing hollow-frame implementation. No passthrough/strip policy or arbitrary unknown-key acceptance was added. The unrelated opening-rhythm variant was not broadened.

`frameContract.test.ts` replays the retained plan through the actual `expandPlanAuthoring` boundary successfully, checks construction propagation, and rejects unknown fields/non-boolean frames. This proves the reported contract defect is fixed, not that every later design-acceptance audit of the retained estate would pass. New default generation bypasses this blueprint contract entirely.

## Active generation and editing paths

1. **Primary home/new direct scene:** home Generate and direct studio Generate/Edit → `/api/ai/scene` → direct JSON operations. Targeted manual position/size/finish/roof changes call the same executor locally. Undo/Redo use existing project versions. JSON import validates the same scene contract; export writes that contract unchanged.
2. **Normal playground/Casa:** same studio, schema, renderer and canonical route. Playground retains `terra-direct-scene-1` for backward compatibility. Solana comparison remains a separate renderer, never silently converted.
3. **Saved V2:** workspace `ChatPanel.send` uses `requestStagedGeneration` for blank V2 generation and `requestHouseEdit` for other work → `/api/ai/house`, with document/stage validation and existing scoped edits.
4. **Explicit/saved V3:** same ChatPanel uses non-SSE `requestHouseEdit` → `/api/ai/house`; persisted V3 root determines pipeline. Server feature flags/terrain determine plan-first/blueprint/semantic construction and repair policy. Plan evaluation projects have their own existing guardrails.
5. **Compatibility villa composition:** `?scene=legacy`, explicit composition/replay/offline links → `VillaPlayground`/`viewer.tsx` → `requestClient.ts` → `/api/ai/villa`, including retained request polling/recovery. This path is intentionally not relabeled direct-scene.
6. **Plan/concept/component/review:** separate `/api/ai/plan`, `/api/ai/concept`, `/api/ai/concept/compact`, `/api/ai/villa/create-component`, `/api/ai/villa/visual-review`. These have different outputs/responsibilities; keeping them is not another primary construction engine.

## Data and compatibility inventory

| Data | Location/format | Conversion policy |
|---|---|---|
| Current editable scenes | Project `houseConfigJson`, root `architectural-scene-1`; project versions in `ai-architect-projects` | Validated direct import/export; original IDs retained |
| Old Casa scene | Browser `terra-direct-scene-1`; scene JSON evidence under `docs/villa-playground/scene-operations` | Lossless direct import; old browser key is not deleted or silently migrated |
| Legacy houses/V2 documents | Existing project roots and embedded architectural documents | Keep existing renderer. No lossy bulk conversion |
| V3 scenes/plans | Root `version:3`, `generationMode:v3-scene`, `v3Scene`, plan metadata/blueprints | Keep existing compiler, support/acceptance rules and renderer |
| Normal project storage | `ai-architect-projects`, raw JSON or `ai-architect:gzip:v1:` compressed representation | Same storage adapter and append-only history; no storage version migration |
| Asset/learning browser data | `ai-architect-assets`, `ai-architect-learn`, other library browser/IndexedDB/server stores | Independent records untouched |
| Villa configurations/responses | `.data/villa-responses`, `.data/villa-generations`, `.data/villa-requests`, offline studies; retained docs/fixtures | Original response bytes/snapshots retained; compatibility replay remains |
| Experimental/approved components | `.data/villa-component-candidates/<id>@<version>.json`, registry builder references | Experimental and approved statuses/provenance remain explicit; approval requires exact stored candidate |
| Approved design feedback | `.data/villa-design-lessons` immutable lesson files + summaries | No deletion, implicit approval or silent reuse as direct geometry |
| Vision sources/results | `.data/image-vision/<run>/`, concept image hash, interpretation/validation/response files | Replay checks reference integrity; no shape conversion invented |
| Old V3 recovery evidence | `.v3-debug/failed-attempt-{0,1}.json`, revision evidence, recovery backups | Original failure copied into this report's evidence before mutable slots changed |
| New scene responses | `.data/scene-responses/<uuid>.json` in development | Accepted/rejected/incomplete outputs and input context retained with existing sensitive-text redaction, private file permissions; response ID returned |

## Primary architectural capabilities and limits

The normal website now supports editable floors/decks, rectangular walls with fitted openings, glazing divisions, flat roofs with villa detailing, shared gable/hip roofs, balconies/railings, solid entrances with hardware, screens/slats, sofas, explicit volumes and water surfaces. Each element has a stable ID, material, dimensions, arbitrary yaw/elevation and optional parent attachment. Detached pavilions, rotated floors, bridges, cantilevers and five-plus-level compositions no longer require old house families, cardinal wing placement, storey alignment or blueprint relationships.

Safety bounds remain: 400 elements, 800 operations per transaction, 40 panels per element, finite coordinates/dimensions within 10,000m, positive dimensions, valid IDs, acyclic/resolved attachments and openings contained by walls. These are executor/render budgets, not house-style restrictions. Pitched roofs require at least 0.6m rise because the reused builders enforce that minimum. Gable/hip ridges follow the longer rectangular span; overhang is explicit. Existing flat-scene JSON remains valid.

Still unavailable in the primary direct contract: arbitrary curved/polygonal solids, holes/CSG/meshes, curved roofs, shed/mansard/butterfly/sawtooth roof adapters, automated stairs/interiors, engineered structural validity and building-code checks. Multiple wall openings require separate wall elements. Materials remain five named presets; the full V3 material/asset vocabulary is not exposed here. The garden is shared visual staging, not a user-authored site plan. Cameras use the existing villa bounds-fitting system.

Specialized curved footprint, stack/wing, roof, façade and approved component builders remain available in their compatibility tools/renderers. Full Solana geometry cannot be losslessly converted to direct operations today. Vision/review/learning operate on their established configuration contracts and are **not** yet direct-scene authoring/review stages. No generic mesh fallback is claimed to implement those missing capabilities.

## Evidence and verification

See `browser-checks.json` and the screenshots in this directory. `scripts/consolidation-capture.mjs` is reproducible and blocks all non-local page requests and unexpected AI POST routes. The plan-configuration GET is mocked disabled; it does not author designs. Browser generation/edit output is intercepted, so screenshots establish integration and rendering, not live model design quality.

- `01-home-generation.png`: home Generate produced a 43-element, five-level rotated composition in the normal workspace.
- `02-targeted-edit.png`: one privacy screen moved; every unrelated element and ID compared equal.
- Undo/Redo, reload without regeneration and reopening from Recent Projects checked against persisted project JSON.
- `03-casa-ladera.png`: imported Casa scene matches source element data exactly in normal project history.
- `06-reused-gable-roof.png`: a targeted roof-form change reuses the established roof mesh builder.
- `07-legacy-saved-house.png`: an existing-format house opens the ordinary workspace with its source JSON unchanged.
- `04-solana-compatibility.png`: existing Solana comparison renderer opens.
- `05-image-first-compatibility.png`: offline image interpretation/replay renderer opens.

Focused tests cover scene operations, ID/attachment/opening safety, provider/runtime contracts, rejected output preservation, production canonical/compatibility handlers, roof reuse, persistent project versions, image-first/vision/fidelity, review and design learning. Plan-route/recovery tests were repaired with missing browser-storage stubs; product behavior was not weakened for those tests. A broad suite also exposed a missing diagnostic for invalid estate corridor owners, now explicitly reported as generic fallback while malformed-plan validation remains fatal. The support-registry compatibility test now includes the already implemented deterministic fountain policy.

Final results: **2,891 tests passed, 3 skipped, no failures** across 252 passing and 2 skipped test files. TypeScript and whitespace checks pass. Lint exits successfully with zero errors and three existing unused-variable warnings in capture scripts. The webpack production build passes (existing Google Fonts required network access); the default Turbopack build stalled and was stopped. The final 7 contract/route regression tests also pass. Exact commands and counts are recorded in `validation.json`.

The built production app was also tested at a local production server with the same mocked home/workspace flow. See `production/browser-checks.json` and production screenshots. Generation, targeted editing, undo/redo, reload/reopen, Casa import, shared roof geometry and legacy saved-house rendering all pass without page errors or unexpected requests. Development-only Solana/image-first routes were checked in development, not exposed by production.

## Remaining work

1. Add explicit, tested element adapters for more existing geometry families before allowing Terra to request them. Preserve authored semantics and stable child IDs rather than flattening them into unidentified triangles.
2. Adapt vision interpretation, screenshot review and approved component retrieval to direct scenes when their schema semantics can be honored; they currently remain separate compatibility workflows.
3. Move the shared camera/environment stage out of the development route without merging its compatibility scene builders. The primary editor already uses the same underlying lighting/PBR/rendering implementations.
4. Improve product UI continuity/mobile layout, durable brief recovery across a reload before first response, persistent direct-scene response archives outside development, and selection highlighting. The shared direct studio retains its existing responsive limitations and simpler UI; this is not a redesign of all workspace panels.
5. No live provider quality, spending, structural safety or code-compliance claim is established by offline proofs.
